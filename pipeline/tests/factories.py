"""Construtores de dados de teste com valores padrão sensatos."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

from one_percent.domain.models import ContentItem, ContentKind

NOW = datetime(2026, 11, 1, 8, 0, tzinfo=UTC)

_counter = 0


def _word(n: int) -> str:
    """Palavra única por número (ex.: 1 -> 'bab'), para títulos que o dedupe não funda."""
    letters = "abcdefghijklmnopqrstuvwxyz"
    word = ""
    while True:
        n, remainder = divmod(n, 26)
        word = letters[remainder] + word
        if n == 0:
            return f"ba{word}"


def make_item(
    *,
    kind: ContentKind = "news",
    title: str | None = None,
    hours_ago: float = 1,
    subarea_id: str = "tech.ai",
    **overrides: Any,
) -> ContentItem:
    global _counter
    _counter += 1
    area_id = subarea_id.split(".")[0]
    item = ContentItem(
        source_id="example-source",
        source_name="Exemplo",
        kind=kind,
        area_id=area_id,
        subarea_id=subarea_id,
        title=title or f"Notícia {_word(_counter)} sobre {_word(_counter * 7919)}",
        url=f"https://example.com/item-{_counter}",
        published_at=NOW - timedelta(hours=hours_ago),
        summary="Resumo do item.",
    )
    return replace(item, **overrides)
