"""Porta `Summarizer`: transforma itens coletados em textos de card.

Os limites de texto vêm do contrato (`contract.text_limits`), lidos uma vez na importação.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import cache
from typing import Annotated, Protocol

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, create_model

from one_percent.contract import TextLimits, text_limits
from one_percent.domain.models import ContentItem

LIMITS = text_limits()


def _text(max_length: int) -> object:
    return StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)


ShortText = Annotated[str, _text(LIMITS.short)]
MediumText = Annotated[str, _text(LIMITS.medium)]
LongText = Annotated[str, _text(LIMITS.long)]


def field_limits(limits: TextLimits) -> dict[str, int]:
    """Limite de cada campo escrito pelo LLM, pelo caminho do campo no resumo."""
    return {
        "title": limits.short,
        "summary": limits.long,
        "why_it_matters": limits.short,
        "method": limits.medium,
        "result": limits.medium,
        "limitations": limits.medium,
        "quiz.question": limits.short,
        "quiz.correct_answer": limits.short,
        "quiz.distractors": limits.short,
    }


FIELD_LIMITS: Mapping[str, int] = field_limits(LIMITS)


class SummarizerError(RuntimeError):
    """Falha que impede gerar os resumos do dia."""


class Quiz(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    question: ShortText
    correct_answer: ShortText
    distractors: tuple[ShortText, ...] = Field(min_length=1)


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


@cache
def summary_model(distractors: int) -> type[Summary]:
    """`Summary` que exige exatamente `distractors` alternativas erradas no quiz."""
    exact = Field(min_length=distractors, max_length=distractors)
    quiz = create_model(
        "Quiz", __base__=Quiz, distractors=(Annotated[tuple[ShortText, ...], exact], ...)
    )
    return create_model("Summary", __base__=Summary, quiz=(quiz, ...))


@dataclass(frozen=True)
class SummaryBatch:
    summaries: dict[str, Summary]
    """Resumos indexados por `card_id`; itens que falharam ficam de fora."""
    shortened_fields: int = 0
    """Textos acima do limite que foram encurtados em vez de descartados."""


class Summarizer(Protocol):
    def summarize(self, items: Sequence[ContentItem]) -> SummaryBatch: ...
