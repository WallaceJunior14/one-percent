import logging
from datetime import datetime

import pytest

from one_percent.domain.models import ContentItem
from one_percent.sources import SourceFetchError
from one_percent.sources.collect import collect
from tests.factories import NOW, make_item


class FakeSource:
    def __init__(self, id: str, items: list[ContentItem] | Exception) -> None:
        self.id = id
        self._items = items

    def fetch(self, now: datetime) -> list[ContentItem]:
        if isinstance(self._items, Exception):
            raise self._items
        return self._items


KEYWORDS = {"tech": {"tech.security": ["vazamento"], "tech.hardware": []}}


def test_one_failing_source_does_not_stop_others(caplog: pytest.LogCaptureFixture) -> None:
    ok = FakeSource("ok", [make_item(subarea_id="tech.hardware")])
    broken = FakeSource("broken", SourceFetchError("broken: HTTP 503"))

    with caplog.at_level(logging.WARNING):
        result = collect([broken, ok], NOW, KEYWORDS)

    assert len(result.items) == 1
    assert result.failed_sources == ("broken",)
    assert "broken" in caplog.text


def test_unexpected_errors_are_also_isolated() -> None:
    broken = FakeSource("bug", ValueError("parser quebrou"))

    result = collect([broken], NOW, KEYWORDS)

    assert result.items == ()
    assert result.failed_sources == ("bug",)


def test_news_are_classified_into_subareas() -> None:
    news = make_item(title="Vazamento expõe dados de clientes", subarea_id="tech.hardware")

    result = collect([FakeSource("ok", [news])], NOW, KEYWORDS)

    assert result.items[0].subarea_id == "tech.security"
