import copy
import json
from typing import Any

import pytest

from one_percent.contract import (
    SAMPLE_DAY_PATH,
    ContractViolationError,
    validate_daily_content,
)


@pytest.fixture
def sample_day() -> dict[str, Any]:
    with SAMPLE_DAY_PATH.open(encoding="utf-8") as file:
        data: dict[str, Any] = json.load(file)
    return data


def _first_card_of_type(day: dict[str, Any], card_type: str) -> dict[str, Any]:
    card: dict[str, Any] = next(c for c in day["cards"] if c["type"] == card_type)
    return card


def test_valid_sample_passes(sample_day: dict[str, Any]) -> None:
    validate_daily_content(sample_day)


def test_sample_covers_every_area_and_has_preprint(sample_day: dict[str, Any]) -> None:
    area_ids = {area["id"] for area in sample_day["areas"]}
    card_area_ids = {card["areaId"] for card in sample_day["cards"]}

    assert len(sample_day["cards"]) >= 20
    assert card_area_ids == area_ids
    assert any(card.get("isPreprint") for card in sample_day["cards"])


def test_paper_without_method_fails(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    del _first_card_of_type(day, "paper")["method"]

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_news_with_paper_fields_fails(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    _first_card_of_type(day, "news")["isPreprint"] = True

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_quiz_requires_four_options(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["quiz"]["options"].pop()

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_quiz_answer_index_must_point_to_an_option(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["quiz"]["answerIndex"] = 4

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


@pytest.mark.parametrize(
    "url",
    ["http://example.com/news", "javascript:alert(1)", "file:///etc/passwd"],
)
def test_url_must_be_https(sample_day: dict[str, Any], url: str) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["url"] = url

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_unknown_card_type_fails(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["type"] = "video"

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_unexpected_field_fails(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["html"] = "<b>injetado</b>"

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_story_needs_at_least_three_slides(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["stories"][0]["slides"] = day["stories"][0]["slides"][:2]

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_error_message_points_to_the_invalid_field(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["url"] = "http://example.com"

    with pytest.raises(ContractViolationError, match=r"cards/0/url"):
        validate_daily_content(day)
