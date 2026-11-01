from datetime import UTC, datetime, timedelta, timezone

import pytest

from one_percent.domain.normalize import canonical_url, clean_text, to_utc


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (
            "https://Example.com/news/a?utm_source=rss&utm_medium=feed&id=7",
            "https://example.com/news/a?id=7",
        ),
        ("https://example.com/a?fbclid=x&gclid=y", "https://example.com/a"),
        ("https://example.com/a#comments", "https://example.com/a"),
        ("https://example.com/a/", "https://example.com/a"),
        ("https://example.com/", "https://example.com/"),
    ],
)
def test_strips_tracking_params(url: str, expected: str) -> None:
    assert canonical_url(url) == expected


def test_canonical_url_upgrades_http_to_https() -> None:
    assert canonical_url("http://example.com/a") == "https://example.com/a"


def test_converts_dates_to_utc() -> None:
    brasilia = timezone(timedelta(hours=-3))
    local = datetime(2026, 11, 1, 5, 0, tzinfo=brasilia)

    assert to_utc(local) == datetime(2026, 11, 1, 8, 0, tzinfo=UTC)


def test_naive_dates_are_assumed_utc() -> None:
    assert to_utc(datetime(2026, 11, 1, 8, 0)) == datetime(2026, 11, 1, 8, 0, tzinfo=UTC)


def test_strips_html_from_summary() -> None:
    raw = "<p>Novo <b>modelo</b> &amp; dados</p>\n\n<script>alert(1)</script>  lançado"

    assert clean_text(raw) == "Novo modelo & dados lançado"


def test_clean_text_handles_empty_input() -> None:
    assert clean_text("") == ""
