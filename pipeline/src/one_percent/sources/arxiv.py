"""Adapter da API do arXiv (Atom). Termos: 1 requisição a cada 3 s; metadados em CC0."""

from datetime import datetime
from typing import Any

import httpx

from one_percent.config import SourceConfig
from one_percent.domain.models import ContentItem
from one_percent.domain.normalize import canonical_url, clean_text
from one_percent.sources import fetch_bytes, new_item
from one_percent.sources._feeds import entry_datetime, parse_feed_entries
from one_percent.sources.rate_limit import RateLimiter

API_URL = "https://export.arxiv.org/api/query"
MIN_INTERVAL_SECONDS = 3.0
MAX_RESULTS = 50


def _link(entry: Any, *, rel: str | None = None, title: str | None = None) -> str | None:
    for link in entry.get("links", []):
        if (rel is None or link.get("rel") == rel) and (
            title is None or link.get("title") == title
        ):
            href: str | None = link.get("href")
            return canonical_url(href) if href else None
    return None


class ArxivSource:
    def __init__(self, config: SourceConfig, client: httpx.Client, limiter: RateLimiter) -> None:
        if config.query is None:
            raise ValueError(f"fonte arXiv '{config.id}' sem query")
        self._config = config
        self._query = config.query
        self._client = client
        self._limiter = limiter

    @property
    def id(self) -> str:
        return self._config.id

    def fetch(self, now: datetime) -> list[ContentItem]:
        self._limiter.wait()
        body = fetch_bytes(
            self._client,
            self.id,
            API_URL,
            params={
                "search_query": self._query,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
                "max_results": MAX_RESULTS,
            },
        )
        items: list[ContentItem] = []
        for entry in parse_feed_entries(self.id, body):
            title = clean_text(entry.get("title", ""))
            url = _link(entry, rel="alternate")
            published_at = entry_datetime(entry)
            if not title or url is None or published_at is None:
                continue
            items.append(
                new_item(
                    self._config,
                    title=title,
                    url=url,
                    published_at=published_at,
                    summary=clean_text(entry.get("summary", "")),
                    authors=tuple(a["name"] for a in entry.get("authors", []) if a.get("name")),
                    venue="arXiv",
                    is_preprint=True,
                    pdf_url=_link(entry, title="pdf"),
                )
            )
        return items
