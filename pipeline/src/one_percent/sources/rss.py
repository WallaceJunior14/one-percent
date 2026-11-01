"""Adapter genérico para feeds RSS/Atom de notícias."""

from datetime import datetime

import httpx

from one_percent.config import SourceConfig
from one_percent.domain.models import ContentItem
from one_percent.domain.normalize import canonical_url, clean_text
from one_percent.sources import DEFAULT_MAX_BYTES, fetch_bytes, new_item
from one_percent.sources._feeds import entry_datetime, parse_feed_entries


class RssSource:
    def __init__(
        self, config: SourceConfig, client: httpx.Client, max_bytes: int = DEFAULT_MAX_BYTES
    ) -> None:
        if config.url is None:
            raise ValueError(f"fonte RSS '{config.id}' sem url")
        self._config = config
        self._url = config.url
        self._client = client
        self._max_bytes = max_bytes

    @property
    def id(self) -> str:
        return self._config.id

    def fetch(self, now: datetime) -> list[ContentItem]:
        body = fetch_bytes(self._client, self.id, self._url, max_bytes=self._max_bytes)
        items: list[ContentItem] = []
        for entry in parse_feed_entries(self.id, body):
            title = clean_text(entry.get("title", ""))
            link = entry.get("link")
            published_at = entry_datetime(entry)
            if not title or not link or published_at is None:
                continue
            items.append(
                new_item(
                    self._config,
                    title=title,
                    url=canonical_url(link),
                    published_at=published_at,
                    summary=clean_text(entry.get("summary", "")),
                )
            )
        return items
