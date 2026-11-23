"""Porta `ContentSource` e utilitários comuns aos adapters de fontes (Strategy + Adapter)."""

import logging
import math
import time
from collections.abc import Callable, Mapping
from datetime import datetime
from typing import Any, Protocol
from xml.etree.ElementTree import ParseError

import httpx
from defusedxml import DefusedXmlException
from defusedxml.ElementTree import fromstring as safe_fromstring

from one_percent.config import SourceConfig
from one_percent.domain.models import ContentItem

USER_AGENT = "one-percent-pipeline/0.1 (+https://github.com/WallaceJunior14/one-percent)"
DEFAULT_MAX_BYTES = 5 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 20.0
TRANSIENT_STATUS_CODES = frozenset({429, 500, 502, 503, 504})
RETRY_BUDGET_SECONDS = 180.0
"""Tempo máximo gasto em novas tentativas numa execução, somando todas as fontes."""

logger = logging.getLogger(__name__)


class SourceFetchError(RuntimeError):
    """Falha ao buscar ou interpretar uma fonte. A mensagem começa com o id da fonte."""


class TransientFetchError(SourceFetchError):
    """Falha que pode passar sozinha (timeout, conexão cortada, limite de requisições, 5xx)."""

    def __init__(self, message: str, retry_after: str | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class RetryPolicy:
    """Novas tentativas com espera crescente, respeitando `Retry-After`.

    O orçamento vale para a execução inteira, compartilhado por todas as fontes: conta as esperas
    e o tempo das requisições repetidas, para que uma API instável não estoure o tempo do job.
    """

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay_seconds: float = 5.0,
        max_delay_seconds: float = 30.0,
        budget_seconds: float = RETRY_BUDGET_SECONDS,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_attempts = max_attempts
        self._base_delay = base_delay_seconds
        self._max_delay = max_delay_seconds
        self._budget = budget_seconds
        self._sleep = sleep
        self._clock = clock
        self.spent_seconds = 0.0

    def next_delay(self, attempt: int, retry_after: str | None) -> float | None:
        """Espera antes da próxima tentativa, ou None se não deve haver outra."""
        if attempt >= self._max_attempts:
            return None
        delay = self._base_delay * math.pow(3, attempt - 1)
        if retry_after is not None and retry_after.strip().isdigit():
            delay = max(delay, float(retry_after))
        delay = min(delay, self._max_delay)
        if self.spent_seconds + delay > self._budget:
            return None
        return delay

    def sleep(self, seconds: float) -> None:
        self._sleep(seconds)

    def now(self) -> float:
        return self._clock()

    def charge(self, started_at: float) -> None:
        self.spent_seconds += self._clock() - started_at


NO_RETRY = RetryPolicy(max_attempts=1)


class ContentSource(Protocol):
    @property
    def id(self) -> str: ...

    def fetch(self, now: datetime) -> list[ContentItem]: ...


def fetch_bytes(
    client: httpx.Client,
    source_id: str,
    url: str,
    params: Mapping[str, str | int] | None = None,
    max_bytes: int = DEFAULT_MAX_BYTES,
    *,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    retry: RetryPolicy = NO_RETRY,
    before_request: Callable[[], None] | None = None,
) -> bytes:
    """GET com User-Agent do projeto, timeout, limite de tamanho (em streaming) e só https.

    Falhas passageiras são repetidas conforme `retry`; `before_request` roda antes de cada
    tentativa (ex.: o intervalo mínimo do arXiv).
    """
    attempt = 1
    retry_started: float | None = None
    while True:
        if before_request is not None:
            before_request()
        try:
            body = _fetch_once(client, source_id, url, params, max_bytes, timeout)
        except TransientFetchError as failure:
            if retry_started is not None:
                retry.charge(retry_started)
            delay = retry.next_delay(attempt, failure.retry_after)
            if delay is None:
                raise
            logger.info("%s; nova tentativa em %.0f s", failure, delay)
            retry_started = retry.now()
            retry.sleep(delay)
            attempt += 1
            continue
        if retry_started is not None:
            retry.charge(retry_started)
        return body


def _fetch_once(
    client: httpx.Client,
    source_id: str,
    url: str,
    params: Mapping[str, str | int] | None,
    max_bytes: int,
    timeout: float,
) -> bytes:
    try:
        with client.stream(
            "GET",
            url,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
            follow_redirects=True,
        ) as response:
            if response.status_code in TRANSIENT_STATUS_CODES:
                raise TransientFetchError(
                    f"{source_id}: HTTP {response.status_code}",
                    retry_after=response.headers.get("Retry-After"),
                )
            if response.status_code >= 400:
                raise SourceFetchError(f"{source_id}: HTTP {response.status_code}")
            if response.url.scheme != "https":
                # Um redirecionamento para http tiraria o TLS do caminho.
                raise SourceFetchError(f"{source_id}: redirecionado para fora de https")
            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > max_bytes:
                    raise SourceFetchError(
                        f"{source_id}: resposta excede o limite de {max_bytes} bytes"
                    )
            return bytes(body)
    except httpx.TransportError as error:
        raise TransientFetchError(f"{source_id}: {type(error).__name__}") from error
    except httpx.HTTPError as error:
        raise SourceFetchError(f"{source_id}: {type(error).__name__}") from error


def ensure_safe_xml(source_id: str, body: bytes) -> None:
    """Rejeita XML com entidades ou referências externas (XXE, 'billion laughs').

    XML apenas malformado passa adiante: o feedparser tolera erros comuns de feeds.
    """
    try:
        safe_fromstring(body, forbid_dtd=False, forbid_entities=True, forbid_external=True)
    except DefusedXmlException as error:
        raise SourceFetchError(f"{source_id}: XML com entidades não permitidas") from error
    except ParseError:
        pass


def new_item(config: SourceConfig, **fields: Any) -> ContentItem:
    """Cria um item já preenchido com os dados da fonte (área, subárea padrão, peso)."""
    return ContentItem(
        source_id=config.id,
        source_name=config.name,
        kind=config.kind,
        area_id=config.area,
        subarea_id=config.default_subarea,
        source_weight=config.weight,
        **fields,
    )
