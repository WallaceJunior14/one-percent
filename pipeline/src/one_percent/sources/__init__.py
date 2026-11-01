"""Porta `ContentSource` e utilitários comuns aos adapters de fontes (Strategy + Adapter)."""

from collections.abc import Mapping
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


class SourceFetchError(RuntimeError):
    """Falha ao buscar ou interpretar uma fonte. A mensagem começa com o id da fonte."""


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
) -> bytes:
    """GET com User-Agent do projeto, timeout e limite de tamanho (lido em streaming)."""
    try:
        with client.stream(
            "GET",
            url,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=DEFAULT_TIMEOUT_SECONDS,
            follow_redirects=True,
        ) as response:
            if response.status_code >= 400:
                raise SourceFetchError(f"{source_id}: HTTP {response.status_code}")
            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > max_bytes:
                    raise SourceFetchError(
                        f"{source_id}: resposta excede o limite de {max_bytes} bytes"
                    )
            return bytes(body)
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
