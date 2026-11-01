"""Construtores de dados de teste com valores padrão sensatos."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

from one_percent.domain.models import ContentItem, ContentKind

NOW = datetime(2026, 11, 1, 8, 0, tzinfo=UTC)

_counter = 0


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
        title=title or f"Assunto número {_counter} sobre um tema qualquer",
        url=f"https://example.com/item-{_counter}",
        published_at=NOW - timedelta(hours=hours_ago),
        summary="Resumo do item.",
    )
    return replace(item, **overrides)
