"""Montagem, validação e escrita do JSON do dia (T050, T051)."""

import json
import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from one_percent.config import PipelineConfig
from one_percent.contract import validate_daily_content

logger = logging.getLogger(__name__)

SAO_PAULO = ZoneInfo("America/Sao_Paulo")
MIN_CARDS = 15
"""Abaixo disso o dia não é publicado e o app continua com o último conteúdo (RNF-006)."""
STORY_MIN_SLIDES, STORY_MAX_SLIDES = 3, 5
KEEP_DAYS = 7


def local_date(now: datetime) -> date:
    """Dia de referência do conteúdo, no fuso do público do app."""
    return now.astimezone(SAO_PAULO).date()


def _areas(config: PipelineConfig) -> list[dict[str, Any]]:
    return [
        {
            "id": area.id,
            "name": area.name,
            "subareas": [{"id": s.id, "name": s.name} for s in area.subareas],
        }
        for area in config.areas
    ]


def _stories(config: PipelineConfig, cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    subarea_order = {s.id: i for area in config.areas for i, s in enumerate(area.subareas)}
    stories = []
    for area in config.areas:
        best = sorted(
            (card for card in cards if card["areaId"] == area.id),
            key=lambda card: (card["rank"], subarea_order.get(card["subareaId"], 0)),
        )[:STORY_MAX_SLIDES]
        if len(best) >= STORY_MIN_SLIDES:
            slides = [{"headline": card["title"], "cardId": card["id"]} for card in best]
            stories.append({"areaId": area.id, "slides": slides})
    return stories


def build_day(now: datetime, config: PipelineConfig, cards: list[dict[str, Any]]) -> dict[str, Any]:
    unique = list({card["id"]: card for card in reversed(cards)}.values())[::-1]
    return {
        "schemaVersion": 1,
        "date": local_date(now).isoformat(),
        "generatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "areas": _areas(config),
        "cards": unique,
        "stories": _stories(config, unique),
    }


def _write_atomically(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    os.replace(temporary, path)


def publish(day: dict[str, Any], out_dir: Path) -> bool:
    """Grava `daily/AAAA-MM-DD.json` e `latest.json` (cópia do dia).

    Lança `ContractViolationError` se o dia for inválido. Devolve False, sem escrever nada,
    se houver menos de `MIN_CARDS` cards: o `latest.json` anterior continua valendo.
    """
    validate_daily_content(day)
    if len(day["cards"]) < MIN_CARDS:
        logger.warning("dia %s não publicado: %d cards (mínimo %d)",
                       day["date"], len(day["cards"]), MIN_CARDS)  # fmt: skip
        return False
    content = json.dumps(day, ensure_ascii=False, separators=(",", ":"))
    _write_atomically(out_dir / "daily" / f"{day['date']}.json", content)
    _write_atomically(out_dir / "latest.json", content)
    logger.info("dia %s publicado com %d cards", day["date"], len(day["cards"]))
    return True


def prune_old_days(out_dir: Path, today: date, keep_days: int = KEEP_DAYS) -> None:
    cutoff = today - timedelta(days=keep_days)
    for path in (out_dir / "daily").glob("*.json"):
        try:
            day = date.fromisoformat(path.stem)
        except ValueError:
            continue
        if day < cutoff:
            path.unlink()
