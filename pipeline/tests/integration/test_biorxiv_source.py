from datetime import UTC, datetime

import httpx

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
    return BiorxivSource(config, client or mock_client(serve(fixture_bytes("biorxiv.json"))))


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
