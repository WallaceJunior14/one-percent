"""Entidades do domínio: puras, sem dependência de rede, LLM ou armazenamento."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

ContentKind = Literal["news", "paper"]


@dataclass(frozen=True, slots=True)
class ContentItem:
    """Um item coletado de uma fonte, já normalizado (URL canônica, data em UTC, texto limpo)."""

    source_id: str
    source_name: str
    kind: ContentKind
    area_id: str
    subarea_id: str
    title: str
    url: str
    published_at: datetime
    summary: str
    authors: tuple[str, ...] = ()
    venue: str | None = None
    is_preprint: bool = False
    pdf_url: str | None = None
    popularity: int = 0
    """Sinal de popularidade da fonte (ex.: upvotes do HF Daily Papers)."""
    source_weight: float = 1.0
    """Peso editorial da fonte, definido em config/areas.yaml."""
    coverage: int = 1
    """Quantas fontes cobriram o mesmo assunto (preenchido pela deduplicação)."""


@dataclass(frozen=True, slots=True)
class RankedItem:
    item: ContentItem
    rank: int
    """Posição dentro da subárea, começando em 1."""
    score: float
