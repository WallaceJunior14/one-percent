"""Coleta de todas as fontes, isolando falhas individuais (T035)."""

import logging
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime

import httpx

from one_percent.config import PipelineConfig
from one_percent.domain.classify import classify_subarea
from one_percent.domain.models import ContentItem
from one_percent.sources import ContentSource
from one_percent.sources.arxiv import MIN_INTERVAL_SECONDS, ArxivSource
from one_percent.sources.biorxiv import BiorxivSource
from one_percent.sources.hf_papers import HfDailyPapersSource
from one_percent.sources.rate_limit import RateLimiter
from one_percent.sources.rss import RssSource

logger = logging.getLogger(__name__)

KeywordsByArea = Mapping[str, Mapping[str, Sequence[str]]]


@dataclass(frozen=True)
class CollectResult:
    items: tuple[ContentItem, ...]
    failed_sources: tuple[str, ...]


def collect(
    sources: Iterable[ContentSource], now: datetime, keywords_by_area: KeywordsByArea
) -> CollectResult:
    """Busca cada fonte; uma falha é registrada e não impede as demais."""
    items: list[ContentItem] = []
    failed: list[str] = []
    for source in sources:
        try:
            fetched = source.fetch(now)
        except Exception as error:
            logger.warning("fonte %s falhou: %s", source.id, error)
            failed.append(source.id)
            continue
        logger.info("fonte %s: %d itens", source.id, len(fetched))
        items.extend(
            classify_subarea(item, keywords_by_area.get(item.area_id, {})) for item in fetched
        )
    return CollectResult(items=tuple(items), failed_sources=tuple(failed))


def build_sources(
    config: PipelineConfig,
    client: httpx.Client,
    arxiv_interval: float = MIN_INTERVAL_SECONDS,
) -> list[ContentSource]:
    """Instancia o adapter de cada fonte da configuração."""
    arxiv_limiter = RateLimiter(arxiv_interval)
    sources: list[ContentSource] = []
    for source in config.sources:
        match source.type:
            case "rss":
                sources.append(RssSource(source, client))
            case "arxiv":
                sources.append(ArxivSource(source, client, arxiv_limiter))
            case "biorxiv":
                sources.append(BiorxivSource(source, client))
            case "hf_daily_papers":
                sources.append(HfDailyPapersSource(source, client))
    return sources


def keywords_by_area(config: PipelineConfig) -> dict[str, dict[str, list[str]]]:
    return {area.id: area.keywords_by_subarea for area in config.areas}
