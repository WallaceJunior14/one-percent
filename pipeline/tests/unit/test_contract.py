import copy
import json
from typing import Any

import pytest

from one_percent.contract import (
    SAMPLE_DAY_PATH,
    SCHEMA_PATH,
    ContractViolationError,
    text_limits,
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


@pytest.mark.parametrize("count", [2, 6])
def test_quiz_accepts_two_to_six_options(sample_day: dict[str, Any], count: int) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["quiz"]["options"] = [f"Opção {n}" for n in range(count)]
    day["cards"][0]["quiz"]["answerIndex"] = 0

    validate_daily_content(day)


@pytest.mark.parametrize("count", [1, 7])
def test_quiz_rejects_too_few_or_too_many_options(sample_day: dict[str, Any], count: int) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["quiz"]["options"] = [f"Opção {n}" for n in range(count)]
    day["cards"][0]["quiz"]["answerIndex"] = 0

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_quiz_answer_index_must_point_to_an_option(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["quiz"]["answerIndex"] = 6

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


def test_story_needs_at_least_one_slide(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["stories"][0]["slides"] = []

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_error_message_points_to_the_invalid_field(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["cards"][0]["url"] = "http://example.com"

    with pytest.raises(ContractViolationError, match=r"cards/0/url"):
        validate_daily_content(day)


@pytest.mark.parametrize("field", ["method", "result", "limitations"])
def test_paper_scientific_fields_accept_up_to_300_chars(
    sample_day: dict[str, Any], field: str
) -> None:
    day = copy.deepcopy(sample_day)
    _first_card_of_type(day, "paper")[field] = "x" * 300

    validate_daily_content(day)


@pytest.mark.parametrize("field", ["method", "result", "limitations"])
def test_paper_scientific_fields_reject_over_300_chars(
    sample_day: dict[str, Any], field: str
) -> None:
    day = copy.deepcopy(sample_day)
    _first_card_of_type(day, "paper")[field] = "x" * 301

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_reads_text_limits_from_schema() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    defs = schema["$defs"]

    limits = text_limits()

    assert limits.short == defs["shortText"]["maxLength"]
    assert limits.medium == defs["mediumText"]["maxLength"]
    assert limits.long == defs["longText"]["maxLength"]
    assert limits.original_title == defs["card"]["properties"]["originalTitle"]["maxLength"]


def test_sample_has_catalog_and_feed_settings(sample_day: dict[str, Any]) -> None:
    group_ids = {group["id"] for group in sample_day["groups"]}

    assert all(area["groupId"] in group_ids and area["weight"] > 0 for area in sample_day["areas"])
    assert sample_day["settings"]["feedSize"] > 0


def test_payload_without_new_optional_fields_is_still_valid(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    del day["groups"], day["settings"]
    for area in day["areas"]:
        del area["groupId"], area["weight"]

    validate_daily_content(day)


def test_area_weight_must_be_positive(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["areas"][0]["weight"] = 0

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_producer_rejects_unknown_setting(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["settings"]["typo"] = 1

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


@pytest.mark.parametrize(
    ("section", "field", "value"),
    [
        ("settings", "feedSize", 51),
        ("settings", "publishIntervalHours", 169),
        ("settings", "freshnessToleranceHours", 169),
        ("settings", "quizQuestions", 11),
        ("settings", "secondsPerCard", 601),
    ],
)
def test_published_settings_have_an_upper_bound(
    sample_day: dict[str, Any], section: str, field: str, value: int
) -> None:
    day = copy.deepcopy(sample_day)
    day[section][field] = value

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)


def test_area_weight_has_an_upper_bound(sample_day: dict[str, Any]) -> None:
    day = copy.deepcopy(sample_day)
    day["areas"][0]["weight"] = 101

    with pytest.raises(ContractViolationError):
        validate_daily_content(day)
