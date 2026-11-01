"""Porta `Summarizer`: transforma itens coletados em textos de card em português."""

import hashlib
from collections.abc import Sequence
from typing import Annotated, Protocol

from pydantic import BaseModel, ConfigDict, StringConstraints

from one_percent.domain.models import ContentItem
from one_percent.domain.normalize import canonical_url

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]


class SummarizerError(RuntimeError):
    """Falha que impede gerar os resumos do dia (ex.: batch não terminou a tempo)."""


class Quiz(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    question: ShortText
    correct_answer: ShortText
    distractors: tuple[ShortText, ShortText, ShortText]


class Summary(BaseModel):
    """Campos de texto escritos pelo LLM. URLs, autores, datas e fonte nunca vêm daqui."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    title: ShortText
    summary: LongText
    why_it_matters: ShortText
    method: ShortText | None = None
    result: ShortText | None = None
    limitations: ShortText | None = None
    quiz: Quiz


class Summarizer(Protocol):
    def summarize(self, items: Sequence[ContentItem]) -> dict[str, Summary]:
        """Resumos indexados por `card_id`; itens que falharem ficam de fora."""
        ...


def card_id(item: ContentItem) -> str:
    """Id estável do card, derivado da URL canônica (formato do contrato: c_ + 12 hex)."""
    digest = hashlib.sha256(canonical_url(item.url).encode()).hexdigest()
    return f"c_{digest[:12]}"
