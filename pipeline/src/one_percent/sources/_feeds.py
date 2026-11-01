"""Leitura de feeds RSS/Atom com feedparser, depois da checagem de XML seguro."""

import time
from datetime import UTC, datetime
from typing import Any

import feedparser  # type: ignore[import-untyped]

from one_percent.sources import ensure_safe_xml


def parse_feed_entries(source_id: str, body: bytes) -> list[Any]:
    ensure_safe_xml(source_id, body)
    return list(feedparser.parse(body).entries)


def entry_datetime(entry: Any) -> datetime | None:
    parsed: time.struct_time | None = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed is None:
        return None
    return datetime(*parsed[:6], tzinfo=UTC)
