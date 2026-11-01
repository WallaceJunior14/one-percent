import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from one_percent.config import load_config
from one_percent.contract import validate_daily_content
from one_percent.publishing.day import (
    MIN_CARDS,
    build_day,
    local_date,
    prune_old_days,
    publish,
)

CONFIG = load_config()


def _card(n: int, area: str = "tech", subarea: str = "tech.ai", rank: int = 1) -> dict[str, Any]:
    return {
        "id": f"c_{n:012x}",
        "type": "news",
        "areaId": area,
        "subareaId": subarea,
        "rank": rank,
        "title": f"Título {n}",
        "summary": "Resumo.",
        "whyItMatters": "Importa.",
        "sourceName": "Exemplo",
        "url": f"https://example.com/{n}",
        "publishedAt": "2026-11-01T06:00:00Z",
        "quiz": {"question": "?", "options": ["a", "b", "c", "d"], "answerIndex": 0},
    }


def _cards(count: int, area: str = "tech", subarea: str = "tech.ai") -> list[dict[str, Any]]:
    return [_card(n, area, subarea, rank=n + 1) for n in range(count)]


NOW = datetime(2026, 11, 1, 8, 0, tzinfo=UTC)


def test_output_passes_schema() -> None:
    day = build_day(NOW, CONFIG, _cards(20))

    validate_daily_content(day)
    assert day["date"] == "2026-11-01"
    assert day["generatedAt"] == "2026-11-01T08:00:00Z"


def test_areas_come_from_config_without_keywords() -> None:
    day = build_day(NOW, CONFIG, _cards(3))

    assert [area["id"] for area in day["areas"]] == [area.id for area in CONFIG.areas]
    assert "keywords" not in day["areas"][0]["subareas"][0]


def test_stories_reference_existing_cards() -> None:
    day = build_day(NOW, CONFIG, _cards(6) + _cards(4, "health", "health.mental")[:0])

    card_ids = {card["id"] for card in day["cards"]}
    assert all(slide["cardId"] in card_ids for story in day["stories"] for slide in story["slides"])


def test_story_uses_best_ranked_cards_up_to_5() -> None:
    day = build_day(NOW, CONFIG, list(reversed(_cards(8))))

    [story] = day["stories"]
    assert story["areaId"] == "tech"
    assert [s["cardId"] for s in story["slides"]] == [f"c_{n:012x}" for n in range(5)]


def test_stories_only_for_areas_with_at_least_3_cards() -> None:
    cards = _cards(5) + [
        _card(100, "health", "health.mental"),
        _card(101, "health", "health.mental"),
    ]

    day = build_day(NOW, CONFIG, cards)

    assert [story["areaId"] for story in day["stories"]] == ["tech"]


def test_duplicate_card_ids_are_kept_once() -> None:
    cards = _cards(3) + [{**_card(0), "subareaId": "tech.dev"}]

    day = build_day(NOW, CONFIG, cards)

    assert len(day["cards"]) == 3


def test_day_date_uses_sao_paulo_timezone() -> None:
    assert local_date(datetime(2026, 11, 1, 2, 0, tzinfo=UTC)) == date(2026, 10, 31)


def test_writes_daily_file_and_latest(tmp_path: Path) -> None:
    day = build_day(NOW, CONFIG, _cards(MIN_CARDS))

    assert publish(day, tmp_path) is True

    latest = json.loads((tmp_path / "latest.json").read_text(encoding="utf-8"))
    daily = json.loads((tmp_path / "daily" / "2026-11-01.json").read_text(encoding="utf-8"))
    assert latest == daily == day


def test_does_not_publish_below_15_cards(tmp_path: Path) -> None:
    (tmp_path / "latest.json").write_text('{"previous": true}', encoding="utf-8")
    day = build_day(NOW, CONFIG, _cards(MIN_CARDS - 1))

    assert publish(day, tmp_path) is False

    assert json.loads((tmp_path / "latest.json").read_text(encoding="utf-8")) == {"previous": True}
    assert not (tmp_path / "daily").exists()


def test_does_not_publish_invalid_day(tmp_path: Path) -> None:
    day = build_day(NOW, CONFIG, _cards(MIN_CARDS))
    day["cards"][0]["url"] = "http://inseguro.example"

    with pytest.raises(ValueError):
        publish(day, tmp_path)

    assert not (tmp_path / "latest.json").exists()


def test_prunes_days_older_than_7(tmp_path: Path) -> None:
    daily = tmp_path / "daily"
    daily.mkdir()
    for name in ["2026-10-24.json", "2026-10-25.json", "2026-11-01.json", "notes.txt"]:
        (daily / name).write_text("{}", encoding="utf-8")

    prune_old_days(tmp_path, date(2026, 11, 1), keep_days=7)

    assert sorted(p.name for p in daily.iterdir()) == [
        "2026-10-25.json",
        "2026-11-01.json",
        "notes.txt",
    ]
