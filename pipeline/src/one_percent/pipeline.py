"""Orquestração: coletar → janela → deduplicar → ranquear → resumir → montar → publicar."""

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from one_percent.config import PipelineConfig
from one_percent.config.settings import PipelineSettings
from one_percent.domain.dedupe import dedupe
from one_percent.domain.identity import card_id
from one_percent.domain.ranking import select_top
from one_percent.domain.window import is_within_window
from one_percent.publishing.cards import build_card
from one_percent.publishing.day import build_day, local_date, prune_old_days, publish
from one_percent.sources import ContentSource
from one_percent.sources.collect import collect, keywords_by_area
from one_percent.summarizer import Summarizer

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RunReport:
    collected: int
    in_window: int
    unique: int
    selected: int
    summarized: int
    cards: int
    failed_sources: tuple[str, ...]
    published: bool


def run_pipeline(
    config: PipelineConfig,
    settings: PipelineSettings,
    sources: Iterable[ContentSource],
    summarizer: Summarizer,
    now: datetime,
    out_dir: Path,
) -> RunReport:
    content = settings.content
    collected = collect(sources, now, keywords_by_area(config))
    recent = [
        item for item in collected.items if is_within_window(item, now, content.windows.max_age)
    ]
    unique = dedupe(recent)
    # Se o summarizer cortar itens por custo, perde os piores de cada subárea, não uma subárea.
    ranked = sorted(select_top(unique, now), key=lambda r: (r.rank, r.item.subarea_id))

    summaries = summarizer.summarize([r.item for r in ranked])
    cards: list[dict[str, Any]] = []
    for r in ranked:
        summary = summaries.get(card_id(r.item))
        if summary and (card := build_card(r, summary)):
            cards.append(card)

    day = build_day(now, config, content, cards)
    published = publish(day, out_dir, content.min_cards.total)
    if published:
        prune_old_days(out_dir, local_date(now, content.zone), content.retention_days)

    report = RunReport(
        collected=len(collected.items),
        in_window=len(recent),
        unique=len(unique),
        selected=len(ranked),
        summarized=len(summaries),
        cards=len(day["cards"]),
        failed_sources=collected.failed_sources,
        published=published,
    )
    logger.info("resumo da execução: %s", report)
    return report
