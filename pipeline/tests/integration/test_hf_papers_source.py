from datetime import UTC, datetime

from one_percent.sources.hf_papers import HfDailyPapersSource
from tests.factories import NOW
from tests.helpers import fixture_bytes, mock_client, serve, source_config

HF = {"type": "hf_daily_papers", "kind": "paper", "url": None, "name": "Hugging Face Daily Papers"}


def _items() -> list:  # type: ignore[type-arg]
    client = mock_client(serve(fixture_bytes("hf_daily_papers.json")))
    return HfDailyPapersSource(source_config(**HF), client).fetch(NOW)


def test_parses_papers_with_upvotes_as_popularity() -> None:
    first, second = _items()

    assert first.title == "Agents that Test Before They Commit"
    assert first.authors == ("Gabi Exemplo", "Hugo Ficticio")
    assert (first.popularity, second.popularity) == (87, 0)
    assert first.published_at == datetime(2026, 10, 31, 5, 0, tzinfo=UTC)


def test_links_to_arxiv_abstract_and_pdf() -> None:
    first = _items()[0]

    assert first.url == "https://arxiv.org/abs/2610.99003"
    assert first.pdf_url == "https://arxiv.org/pdf/2610.99003"
    assert (first.venue, first.is_preprint) == ("arXiv", True)
