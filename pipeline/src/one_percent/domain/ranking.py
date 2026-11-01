"""Ranking por relevância dentro de cada subárea (RF-005)."""

import math
from collections import defaultdict
from datetime import datetime

from one_percent.domain.models import ContentItem, ContentKind, RankedItem

ITEMS_PER_SUBAREA = 8

RECENCY_HALF_LIFE_HOURS: dict[ContentKind, float] = {"news": 12, "paper": 48}
COVERAGE_BONUS = 0.3
POPULARITY_BONUS = 0.15


def score(item: ContentItem, now: datetime) -> float:
    """Recência ponderada pela fonte + bônus por cobertura e popularidade."""
    age_hours = max(0.0, (now - item.published_at).total_seconds() / 3600)
    recency = math.pow(0.5, age_hours / RECENCY_HALF_LIFE_HOURS[item.kind])
    return (
        item.source_weight * recency
        + COVERAGE_BONUS * (item.coverage - 1)
        + POPULARITY_BONUS * math.log1p(max(0, item.popularity))
    )


def select_top(
    items: list[ContentItem], now: datetime, per_subarea: int = ITEMS_PER_SUBAREA
) -> list[RankedItem]:
    """Os `per_subarea` melhores itens de cada subárea, numerados a partir de 1.

    Empates são resolvidos pela URL, para que a mesma entrada gere sempre a mesma saída.
    """
    by_subarea: dict[str, list[ContentItem]] = defaultdict(list)
    for item in items:
        by_subarea[item.subarea_id].append(item)

    ranked: list[RankedItem] = []
    for subarea_id in sorted(by_subarea):
        scored = sorted(
            ((score(item, now), item) for item in by_subarea[subarea_id]),
            key=lambda pair: (-pair[0], pair[1].url),
        )
        ranked.extend(
            RankedItem(item=item, rank=position, score=value)
            for position, (value, item) in enumerate(scored[:per_subarea], start=1)
        )
    return ranked
