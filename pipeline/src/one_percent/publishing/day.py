"""Montagem, validação e escrita do JSON do dia."""

import json
import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from one_percent.config import PipelineConfig
from one_percent.config.settings import ContentSettings, StorySettings
from one_percent.contract import validate_daily_content

logger = logging.getLogger(__name__)


def local_date(now: datetime, zone: ZoneInfo) -> date:
    """Dia de referência do conteúdo, no fuso do público do app."""
    return now.astimezone(zone).date()


def _areas(config: PipelineConfig) -> list[dict[str, Any]]:
    return [
        {
            "id": area.id,
            "name": area.name,
            "subareas": [{"id": s.id, "name": s.name} for s in area.subareas],
        }
        for area in config.areas
    ]


def _stories(
    config: PipelineConfig, slides_range: StorySettings, cards: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    subarea_order = {s.id: i for area in config.areas for i, s in enumerate(area.subareas)}
    stories = []
    for area in config.areas:
        best = sorted(
            (card for card in cards if card["areaId"] == area.id),
            key=lambda card: (card["rank"], subarea_order.get(card["subareaId"], 0)),
        )[: slides_range.max_slides]
        if len(best) >= slides_range.min_slides:
            slides = [{"headline": card["title"], "cardId": card["id"]} for card in best]
            stories.append({"areaId": area.id, "slides": slides})
    return stories


def build_day(
    now: datetime,
    config: PipelineConfig,
    settings: ContentSettings,
    cards: list[dict[str, Any]],
) -> dict[str, Any]:
    unique = list({card["id"]: card for card in reversed(cards)}.values())[::-1]
    return {
        "schemaVersion": 1,
        "date": local_date(now, settings.zone).isoformat(),
        "generatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "areas": _areas(config),
        "cards": unique,
        "stories": _stories(config, settings.stories, unique),
    }


def _write_atomically(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    os.replace(temporary, path)


def publish(day: dict[str, Any], out_dir: Path, min_cards: int) -> bool:
    """Grava `daily/AAAA-MM-DD.json` e `latest.json` (cópia do dia).

    Lança `ContractViolationError` se o dia for inválido. Devolve False, sem escrever nada,
    se houver menos de `min_cards` cards: o `latest.json` anterior continua valendo.
    """
    validate_daily_content(day)
    if len(day["cards"]) < min_cards:
        logger.warning("dia %s não publicado: %d cards (mínimo %d)",
                       day["date"], len(day["cards"]), min_cards)  # fmt: skip
        return False
    content = json.dumps(day, ensure_ascii=False, separators=(",", ":"))
    _write_atomically(out_dir / "daily" / f"{day['date']}.json", content)
    _write_atomically(out_dir / "latest.json", content)
    logger.info("dia %s publicado com %d cards", day["date"], len(day["cards"]))
    return True


def prune_old_days(out_dir: Path, today: date, keep_days: int) -> None:
    cutoff = today - timedelta(days=keep_days)
    for path in (out_dir / "daily").glob("*.json"):
        try:
            day = date.fromisoformat(path.stem)
        except ValueError:
            continue
        if day < cutoff:
            path.unlink()
