from datetime import UTC, datetime

import httpx
import pytest

from one_percent.config.settings import WindowSettings
from one_percent.sources import SourceFetchError
from one_percent.sources.biorxiv import BiorxivSource
from tests.factories import NOW
from tests.helpers import fixture_bytes, mock_client, serve, source_config

MEDRXIV = {
    "id": "medrxiv-nutrition",
    "name": "medRxiv",
    "type": "biorxiv",
    "kind": "paper",
    "url": None,
    "server": "medrxiv",
    "categories": ["nutrition"],
    "area": "health",
    "default_subarea": "health.nutrition",
}


def _source(client: httpx.Client | None = None, **overrides: object) -> BiorxivSource:
    config = source_config(**{**MEDRXIV, **overrides})
    client = client or mock_client(serve(fixture_bytes("biorxiv.json")))
    return BiorxivSource(config, client, window=WindowSettings().max_age["paper"])


def test_parses_papers() -> None:
    first = _source().fetch(NOW)[0]

    assert first.title == "Short post-meal walks and glycemic control"
    assert first.summary == "A randomized trial of short walks after meals."
    assert first.authors == ("Exemplo, A.", "Ficticio, B. C.", "Inventado, D.", "Modelo, E.")
    assert first.url == "https://www.medrxiv.org/content/10.1101/2026.10.29.99001v2"
    assert first.pdf_url == "https://www.medrxiv.org/content/10.1101/2026.10.29.99001v2.full.pdf"
    assert first.published_at == datetime(2026, 10, 29, tzinfo=UTC)
    assert (first.venue, first.is_preprint) == ("medRxiv", True)


def test_paper_already_published_in_journal_is_not_preprint() -> None:
    second = _source().fetch(NOW)[1]

    assert second.is_preprint is False


def test_queries_each_category_within_the_last_7_days() -> None:
    seen: list[httpx.URL] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url)
        return httpx.Response(200, content=fixture_bytes("biorxiv.json"))

    _source(
        mock_client(handler), categories=["nutrition", "psychiatry and clinical psychology"]
    ).fetch(NOW)

    assert [url.path for url in seen] == ["/details/medrxiv/2026-10-25/2026-11-01/0"] * 2
    assert [url.params["category"] for url in seen] == [
        "nutrition",
        "psychiatry_and_clinical_psychology",
    ]


def test_biorxiv_server_uses_biorxiv_domain() -> None:
    first = _source(server="biorxiv").fetch(NOW)[0]

    assert first.url.startswith("https://www.biorxiv.org/content/")
    assert first.venue == "bioRxiv"


def _paginated_api(total: int, page_size: int = 30) -> tuple[httpx.Client, list[int]]:
    """API fake como a real: `page_size` itens por página, do mais antigo para o mais novo."""
    cursors: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        cursor = int(request.url.path.rsplit("/", 1)[1])
        cursors.append(cursor)
        papers = [
            {
                "doi": f"10.1101/2026.10.{position:05d}",
                "title": f"Paper {position}",
                "authors": "Exemplo, A.",
                "date": "2026-10-25" if position < total - 10 else "2026-10-31",
                "version": "1",
                "abstract": "Resumo.",
                "published": "NA",
            }
            for position in range(cursor, min(cursor + page_size, total))
        ]
        messages = [{"status": "ok", "cursor": cursor, "count": len(papers), "total": str(total)}]
        return httpx.Response(200, json={"messages": messages, "collection": papers})

    return mock_client(handler), cursors


def test_fetches_the_newest_pages_when_results_are_paginated() -> None:
    client, cursors = _paginated_api(total=95)

    items = _source(client).fetch(NOW)

    assert cursors == [0, 35, 65]
    assert [item.title for item in items] == [f"Paper {n}" for n in range(35, 95)]
    assert items[-1].published_at == datetime(2026, 10, 31, tzinfo=UTC)


def test_single_page_needs_a_single_request() -> None:
    client, cursors = _paginated_api(total=25)

    items = _source(client).fetch(NOW)

    assert cursors == [0]
    assert len(items) == 25


def test_no_posts_found_is_an_empty_result() -> None:
    body = b'{"messages":[{"status":"no posts found"}], "collection":[]}'

    assert _source(mock_client(serve(body))).fetch(NOW) == []


def test_a_failing_category_does_not_drop_the_others() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params["category"] == "nutrition":
            raise httpx.ReadTimeout("lento", request=request)
        return httpx.Response(200, content=fixture_bytes("biorxiv.json"))

    items = _source(
        mock_client(handler), categories=["nutrition", "psychiatry and clinical psychology"]
    ).fetch(NOW)

    assert len(items) == 2


def test_fails_when_every_category_fails() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("lento", request=request)

    with pytest.raises(SourceFetchError, match="ReadTimeout"):
        _source(mock_client(handler), categories=["nutrition", "genomics"]).fetch(NOW)
