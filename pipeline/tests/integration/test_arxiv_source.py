import httpx

from one_percent.sources.arxiv import ArxivSource
from one_percent.sources.rate_limit import RateLimiter
from tests.factories import NOW
from tests.helpers import fixture_bytes, mock_client, serve, source_config

ARXIV = {"type": "arxiv", "kind": "paper", "url": None, "query": "cat:cs.AI", "name": "arXiv"}


def _source(client: httpx.Client | None = None, limiter: RateLimiter | None = None) -> ArxivSource:
    return ArxivSource(
        source_config(**ARXIV),
        client or mock_client(serve(fixture_bytes("arxiv.xml"))),
        limiter or RateLimiter(min_interval_seconds=0),
    )


def test_parses_authors_and_pdf_link() -> None:
    first = _source().fetch(NOW)[0]

    assert first.title == "Learning When to Defer: Small Models as Routers"
    assert first.summary == "We train a small model to decide when to answer and when to defer."
    assert first.authors == ("Ana Exemplo", "Bruno Fictício", "Carla Inventada", "Davi Modelo")
    assert first.url == "https://arxiv.org/abs/2610.99001v1"
    assert first.pdf_url == "https://arxiv.org/pdf/2610.99001v1"


def test_marks_as_preprint() -> None:
    items = _source().fetch(NOW)

    assert all(item.is_preprint and item.venue == "arXiv" for item in items)
    assert all(item.kind == "paper" for item in items)


def test_upgrades_http_links_and_tolerates_missing_pdf() -> None:
    second = _source().fetch(NOW)[1]

    assert second.url == "https://arxiv.org/abs/2610.99002v2"
    assert second.pdf_url is None


def test_queries_newest_submissions_first() -> None:
    seen: list[httpx.URL] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url)
        return httpx.Response(200, content=fixture_bytes("arxiv.xml"))

    _source(mock_client(handler)).fetch(NOW)

    params = seen[0].params
    assert seen[0].host == "export.arxiv.org"
    assert params["search_query"] == "cat:cs.AI"
    assert (params["sortBy"], params["sortOrder"]) == ("submittedDate", "descending")


def test_waits_between_requests_to_respect_rate_limit() -> None:
    clock = [100.0]
    sleeps: list[float] = []

    def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        clock[0] += seconds

    limiter = RateLimiter(min_interval_seconds=3, clock=lambda: clock[0], sleep=sleep)
    _source(limiter=limiter).fetch(NOW)
    clock[0] += 1
    _source(limiter=limiter).fetch(NOW)

    assert sleeps == [2.0]
