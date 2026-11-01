"""Janela de tempo de cada tipo de conteúdo (RF-003)."""

from datetime import datetime, timedelta

from one_percent.domain.models import ContentItem, ContentKind

MAX_AGE: dict[ContentKind, timedelta] = {
    "news": timedelta(hours=36),
    "paper": timedelta(days=7),
}
CLOCK_SKEW_TOLERANCE = timedelta(hours=1)


def is_within_window(item: ContentItem, now: datetime) -> bool:
    age = now - item.published_at
    return -CLOCK_SKEW_TOLERANCE <= age <= MAX_AGE[item.kind]
