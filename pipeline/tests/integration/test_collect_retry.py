"""Toda fonte da configuração real usa a política de novas tentativas da execução."""

import httpx

from one_percent.config import load_config
from one_percent.sources import RetryPolicy
from one_percent.sources.collect import build_sources, collect, keywords_by_area
from tests.factories import NOW
from tests.helpers import fixture_bytes

FIXTURE_BY_HOST = {
    "export.arxiv.org": "arxiv.xml",
    "api.biorxiv.org": "biorxiv.json",
    "huggingface.co": "hf_daily_papers.json",
}


def test_every_source_recovers_from_one_transient_failure() -> None:
    failed_once: set[str] = set()

    def flaky_network(request: httpx.Request) -> httpx.Response:
        key = str(request.url)
        if key not in failed_once:
            failed_once.add(key)
            return httpx.Response(503)
        fixture = FIXTURE_BY_HOST.get(request.url.host, "rss_basic.xml")
        return httpx.Response(200, content=fixture_bytes(fixture))

    config = load_config()
    sleeps: list[float] = []
    with httpx.Client(transport=httpx.MockTransport(flaky_network)) as client:
        sources = build_sources(
            config,
            client,
            arxiv_interval=0,
            retry=RetryPolicy(sleep=sleeps.append, budget_seconds=1e9),
        )
        result = collect(sources, NOW, keywords_by_area(config))

    assert result.failed_sources == ()
    assert len(sleeps) == len(failed_once) >= len(config.sources)
