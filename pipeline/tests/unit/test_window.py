from one_percent.domain.window import is_within_window
from tests.factories import NOW, make_item


def test_keeps_news_from_35_hours_ago() -> None:
    assert is_within_window(make_item(kind="news", hours_ago=35), NOW)


def test_drops_news_older_than_36h() -> None:
    assert not is_within_window(make_item(kind="news", hours_ago=37), NOW)


def test_keeps_paper_from_6_days_ago() -> None:
    assert is_within_window(make_item(kind="paper", hours_ago=6 * 24), NOW)


def test_drops_paper_older_than_7_days() -> None:
    assert not is_within_window(make_item(kind="paper", hours_ago=7 * 24 + 1), NOW)


def test_drops_items_dated_in_the_future() -> None:
    assert not is_within_window(make_item(hours_ago=-2), NOW)


def test_tolerates_small_clock_skew() -> None:
    assert is_within_window(make_item(hours_ago=-0.5), NOW)
