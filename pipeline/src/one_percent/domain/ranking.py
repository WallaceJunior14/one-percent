"""Ranking por relevância dentro de cada subárea (RF-005)."""

import math
from collections import defaultdict
from datetime import datetime

from one_percent.domain.models import ContentItem, ContentKind, RankedItem

ITEMS_PER_SUBAREA = 8
KIND_QUOTA: dict[ContentKind, int] = {"news": 5, "paper": 3}
"""Vagas reservadas por tipo em subáreas mistas; vagas não usadas vão para o outro tipo."""

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

    Em subáreas com notícias e artigos, cada tipo tem vagas reservadas (`KIND_QUOTA`), pois
    artigos envelhecem mais devagar e dominariam o ranking. Empates são resolvidos pela URL,
    para que a mesma entrada gere sempre a mesma saída.
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
        chosen = _apply_kind_quota(scored, per_subarea)
        ranked.extend(
            RankedItem(item=item, rank=position, score=value)
            for position, (value, item) in enumerate(chosen, start=1)
        )
    return ranked


def _apply_kind_quota(
    scored: list[tuple[float, ContentItem]], limit: int
) -> list[tuple[float, ContentItem]]:
    """Preenche primeiro as vagas reservadas de cada tipo, depois as restantes por score."""
    reserved = [
        pair
        for kind, quota in KIND_QUOTA.items()
        for pair in [p for p in scored if p[1].kind == kind][:quota]
    ]
    remaining = [pair for pair in scored if pair not in reserved]
    chosen = (reserved + remaining)[:limit]
    return sorted(chosen, key=lambda pair: (-pair[0], pair[1].url))
