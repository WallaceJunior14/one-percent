"""Porta `Summarizer`: transforma itens coletados em textos de card."""

from collections.abc import Sequence
from typing import Annotated, Protocol

from pydantic import BaseModel, ConfigDict, StringConstraints

from one_percent.domain.models import ContentItem

SHORT_TEXT_MAX = 200
MEDIUM_TEXT_MAX = 300
LONG_TEXT_MAX = 600


def _text(max_length: int) -> object:
    return StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)


ShortText = Annotated[str, _text(SHORT_TEXT_MAX)]
MediumText = Annotated[str, _text(MEDIUM_TEXT_MAX)]
LongText = Annotated[str, _text(LONG_TEXT_MAX)]


class SummarizerError(RuntimeError):
    """Falha que impede gerar os resumos do dia."""


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
    method: MediumText | None = None
    result: MediumText | None = None
    limitations: MediumText | None = None
    quiz: Quiz


class Summarizer(Protocol):
    def summarize(self, items: Sequence[ContentItem]) -> dict[str, Summary]:
        """Resumos indexados por `card_id`; itens que falharem ficam de fora."""
        ...
