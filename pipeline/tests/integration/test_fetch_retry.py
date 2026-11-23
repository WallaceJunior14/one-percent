"""Novas tentativas para falhas passageiras das fontes (timeouts e 429 do arXiv, conexão cortada
do bioRxiv), com espera crescente e um orçamento por execução."""

from collections.abc import Callable

import httpx
import pytest

from one_percent.sources import RetryPolicy, SourceFetchError, fetch_bytes
from tests.helpers import mock_client

URL = "https://export.arxiv.org/api/query"


class FakeTime:
    """Relógio que só anda quando alguém dorme ou quando uma requisição "demora"."""

    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def _policy(time: FakeTime, **overrides: float) -> RetryPolicy:
    return RetryPolicy(sleep=time.sleep, clock=lambda: time.now, **overrides)  # type: ignore[arg-type]


def _responses(*steps: object, time: FakeTime | None = None) -> tuple[httpx.Client, list[int]]:
    """Cada passo é um status HTTP, uma exceção do httpx ou (status, headers)."""
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        step = steps[min(len(calls), len(steps) - 1)]
        calls.append(len(calls) + 1)
        if time is not None:
            time.now += 2  # cada requisição leva 2 s
        if isinstance(step, type) and issubclass(step, httpx.TransportError):
            raise step("falha", request=request)
        if isinstance(step, tuple):
            status, headers = step
            return httpx.Response(status, headers=headers, content=b"ok")
        assert isinstance(step, int)
        return httpx.Response(step, content=b"ok")

    return mock_client(handler), calls


def _fetch(client: httpx.Client, policy: RetryPolicy, **kwargs: object) -> bytes:
    return fetch_bytes(client, "arxiv-ml", URL, retry=policy, **kwargs)  # type: ignore[arg-type]


def test_retries_a_timeout_and_succeeds() -> None:
    time = FakeTime()
    client, calls = _responses(httpx.ReadTimeout, 200)

    assert _fetch(client, _policy(time)) == b"ok"
    assert calls == [1, 2]
    assert time.sleeps == [5.0]


def test_retries_a_dropped_connection() -> None:
    time = FakeTime()
    client, calls = _responses(httpx.RemoteProtocolError, 200)

    assert _fetch(client, _policy(time)) == b"ok"
    assert len(calls) == 2


@pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
def test_retries_transient_http_status(status: int) -> None:
    time = FakeTime()
    client, calls = _responses(status, 200)

    assert _fetch(client, _policy(time)) == b"ok"
    assert len(calls) == 2


def test_waits_longer_on_each_attempt_then_gives_up() -> None:
    time = FakeTime()
    client, calls = _responses(httpx.ReadTimeout)

    with pytest.raises(SourceFetchError, match="arxiv-ml: ReadTimeout"):
        _fetch(client, _policy(time))
    assert len(calls) == 3
    assert time.sleeps == [5.0, 15.0]


def test_honors_retry_after_up_to_a_limit() -> None:
    time = FakeTime()
    client, _ = _responses((429, {"Retry-After": "12"}), (429, {"Retry-After": "600"}), 200)

    _fetch(client, _policy(time))

    assert time.sleeps == [12.0, 30.0]


@pytest.mark.parametrize("status", [400, 403, 404])
def test_does_not_retry_permanent_errors(status: int) -> None:
    time = FakeTime()
    client, calls = _responses(status)

    with pytest.raises(SourceFetchError, match=str(status)):
        _fetch(client, _policy(time))
    assert calls == [1]
    assert time.sleeps == []


def test_retry_budget_is_shared_by_the_whole_run() -> None:
    time = FakeTime()
    policy = _policy(time, budget_seconds=30)
    first, _ = _responses(httpx.ReadTimeout, 200, time=time)
    second, second_calls = _responses(httpx.ReadTimeout, 200, time=time)
    third, third_calls = _responses(httpx.ReadTimeout, 200, time=time)

    _fetch(first, policy)  # gasta 5 s de espera + 2 s de requisição
    _fetch(second, policy)  # gasta mais 7 s (14 de 30)
    third_policy_spent_before = policy.spent_seconds
    _fetch(third, policy)  # mais 7 s (21 de 30)

    assert third_policy_spent_before == 14
    assert len(second_calls) == 2 and len(third_calls) == 2

    fourth, fourth_calls = _responses(httpx.ReadTimeout, time=time)
    with pytest.raises(SourceFetchError):
        _fetch(fourth, policy)  # 5 s cabem (26), os 15 s seguintes não
    assert len(fourth_calls) == 2


def test_runs_the_hook_before_every_attempt() -> None:
    time = FakeTime()
    client, _ = _responses(httpx.ReadTimeout, 200)
    hook_calls: list[int] = []
    before: Callable[[], None] = lambda: hook_calls.append(1)  # noqa: E731

    _fetch(client, _policy(time), before_request=before)

    assert len(hook_calls) == 2


def test_no_retry_by_default() -> None:
    client, calls = _responses(httpx.ReadTimeout, 200)

    with pytest.raises(SourceFetchError, match="ReadTimeout"):
        fetch_bytes(client, "arxiv-ml", URL)
    assert calls == [1]
