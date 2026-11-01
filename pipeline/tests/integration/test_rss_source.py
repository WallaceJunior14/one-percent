from datetime import UTC, datetime

import httpx
import pytest

from one_percent.sources import SourceFetchError
from one_percent.sources.rss import RssSource
from tests.factories import NOW
from tests.helpers import fixture_bytes, mock_client, serve, source_config


def _source(handler: object = None, **kwargs: object) -> RssSource:
    client = mock_client(handler or serve(fixture_bytes("rss_basic.xml")))  # type: ignore[arg-type]
    return RssSource(source_config(), client, **kwargs)  # type: ignore[arg-type]


def test_parses_items() -> None:
    first = _source().fetch(NOW)[0]

    assert first.title == "Startup lança chip de IA para celulares"
    assert first.url == "https://example.com/noticias/chip-ia"
    assert first.published_at == datetime(2026, 11, 1, 9, 30, tzinfo=UTC)
    assert first.summary == "O chip promete economizar bateria."
    assert (first.source_id, first.source_name, first.kind) == ("exemplo", "Exemplo", "news")
    assert (first.area_id, first.subarea_id, first.source_weight) == ("tech", "tech.hardware", 1.2)


def test_ignores_malformed_entry() -> None:
    items = _source().fetch(NOW)

    assert [item.url for item in items] == [
        "https://example.com/noticias/chip-ia",
        "https://example.com/noticias/credito",
    ]


def test_fails_gracefully_on_timeout() -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timeout", request=request)

    with pytest.raises(SourceFetchError, match="exemplo"):
        _source(timeout).fetch(NOW)


def test_http_error_raises_source_error() -> None:
    with pytest.raises(SourceFetchError, match="503"):
        _source(serve(b"", status=503)).fetch(NOW)


def test_rejects_xml_with_entities() -> None:
    with pytest.raises(SourceFetchError, match="XML"):
        _source(serve(fixture_bytes("rss_xxe.xml"))).fetch(NOW)


def test_rejects_oversized_response() -> None:
    with pytest.raises(SourceFetchError, match="limite"):
        _source(max_bytes=100).fetch(NOW)


def test_sends_project_user_agent() -> None:
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers["user-agent"])
        return httpx.Response(200, content=fixture_bytes("rss_basic.xml"))

    _source(handler).fetch(NOW)

    assert seen == ["one-percent-pipeline/0.1 (+https://github.com/WallaceJunior14/one-percent)"]
