from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest

from one_percent.config.settings import (
    DEFAULT_SETTINGS_PATH,
    SettingsError,
    load_settings,
    parse_settings,
)


def test_project_settings_file_is_valid() -> None:
    assert load_settings(DEFAULT_SETTINGS_PATH).llm.model


def test_loads_defaults() -> None:
    settings = parse_settings({})

    assert settings.content.timezone == "America/Sao_Paulo"
    assert settings.content.retention_days == 7
    assert settings.content.windows.max_age == {
        "news": timedelta(hours=36),
        "paper": timedelta(days=7),
    }
    assert (settings.content.min_cards.total, settings.content.min_cards.per_group) == (15, 7)
    assert (settings.content.stories.min_slides, settings.content.stories.max_slides) == (3, 5)
    assert settings.content.quiz.distractors == 3
    assert settings.feed.size == 15
    assert settings.llm.model == "claude-haiku-5-5"
    assert settings.llm.max_items_per_run == 150
    assert settings.llm.max_tokens == 2048
    assert settings.llm.batch_timeout_minutes == 25
    assert settings.llm.prompt_target_ratio == 0.8
    assert dict(settings.llm.prompt_target_overrides) == {"title": 0.6, "quiz": 0.5}
    assert (settings.llm.price_per_mtok.input, settings.llm.price_per_mtok.output) == (0.05, 0.25)
    assert (settings.budget.monthly_usd, settings.budget.alert_ratio) == (5, 0.8)


def test_partial_section_keeps_other_defaults() -> None:
    settings = parse_settings({"llm": {"model": "outro-modelo"}})

    assert settings.llm.model == "outro-modelo"
    assert settings.llm.max_items_per_run == 150


@pytest.mark.parametrize(
    ("raw", "field"),
    [
        ({"llm": {"max_items_per_run": 0}}, "llm.max_items_per_run"),
        ({"content": {"windows": {"news_hours": -1}}}, "content.windows.news_hours"),
        ({"content": {"timezone": "Marte/Olympus"}}, "content.timezone"),
        ({"content": {"stories": {"min_slides": 6, "max_slides": 5}}}, "content.stories"),
        ({"llm": {"prompt_target_overrides": {"titulo": 0.5}}}, "llm.prompt_target_overrides"),
        ({"budget": {"alert_ratio": 1.5}}, "budget.alert_ratio"),
        ({"llm": {"api_key": "segredo"}}, "llm.api_key"),
        ({"feed": {"size": 51}}, "feed.size"),
        ({"feed": {"publish_interval_hours": 169}}, "feed.publish_interval_hours"),
        ({"feed": {"freshness_tolerance_hours": 169}}, "feed.freshness_tolerance_hours"),
        ({"feed": {"quiz_questions": 11}}, "feed.quiz_questions"),
        ({"feed": {"seconds_per_card": 601}}, "feed.seconds_per_card"),
    ],
)
def test_rejects_invalid_value_with_field_path(raw: dict[str, Any], field: str) -> None:
    with pytest.raises(SettingsError, match=field.replace(".", r"\.")):
        parse_settings(raw)


def test_empty_file_uses_defaults(tmp_path: Path) -> None:
    path = tmp_path / "pipeline.yaml"
    path.write_text("", encoding="utf-8")

    assert load_settings(path) == parse_settings({})


def test_unreadable_yaml_is_a_settings_error(tmp_path: Path) -> None:
    path = tmp_path / "pipeline.yaml"
    path.write_text("llm: [sem fim", encoding="utf-8")

    with pytest.raises(SettingsError):
        load_settings(path)
