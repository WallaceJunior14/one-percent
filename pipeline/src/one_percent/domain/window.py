"""Janela de tempo de cada tipo de conteúdo."""

from collections.abc import Mapping
from datetime import datetime, timedelta

from one_percent.domain.models import ContentItem, ContentKind

CLOCK_SKEW_TOLERANCE = timedelta(hours=1)


def is_within_window(
    item: ContentItem, now: datetime, max_age: Mapping[ContentKind, timedelta]
) -> bool:
    age = now - item.published_at
    return -CLOCK_SKEW_TOLERANCE <= age <= max_age[item.kind]
