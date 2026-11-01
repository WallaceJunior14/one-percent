from typing import Any

import pytest

from one_percent.config import ConfigError, load_config, parse_config


def _minimal_config(**source_overrides: Any) -> dict[str, Any]:
    source = {
        "id": "feed",
        "name": "Feed",
        "kind": "news",
        "type": "rss",
        "url": "https://example.com/feed",
        "area": "tech",
        "default_subarea": "tech.ai",
    }
    source.update(source_overrides)
    return {
        "areas": [
            {"id": "tech", "name": "Tecnologia", "subareas": [{"id": "tech.ai", "name": "IA"}]}
        ],
        "sources": [source],
    }


def test_project_config_is_valid() -> None:
    config = load_config()

    assert {area.id for area in config.areas} == {"tech", "science", "economy", "finance", "health"}
    assert len(config.sources) >= 10


def test_every_area_has_at_least_one_source() -> None:
    config = load_config()

    assert {area.id for area in config.areas} == {source.area for source in config.sources}


def test_minimal_config_parses() -> None:
    assert parse_config(_minimal_config()).sources[0].id == "feed"


def test_default_subarea_must_belong_to_source_area() -> None:
    with pytest.raises(ConfigError, match="tech.dev"):
        parse_config(_minimal_config(default_subarea="tech.dev"))


def test_rss_source_requires_https_url() -> None:
    with pytest.raises(ConfigError):
        parse_config(_minimal_config(url="http://example.com/feed"))


def test_arxiv_source_requires_query() -> None:
    with pytest.raises(ConfigError):
        parse_config(_minimal_config(type="arxiv", kind="paper", url=None))


def test_unknown_source_type_is_rejected() -> None:
    with pytest.raises(ConfigError):
        parse_config(_minimal_config(type="scraper"))


def test_unknown_field_is_rejected() -> None:
    with pytest.raises(ConfigError):
        parse_config(_minimal_config(api_key="segredo"))


def test_area_without_source_is_rejected() -> None:
    config = _minimal_config()
    config["areas"].append(
        {"id": "health", "name": "Saúde", "subareas": [{"id": "health.x", "name": "X"}]}
    )

    with pytest.raises(ConfigError, match="health"):
        parse_config(config)
