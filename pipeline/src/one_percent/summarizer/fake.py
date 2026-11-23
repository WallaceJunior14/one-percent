"""Summarizer determinístico, sem rede: para testes e para rodar o pipeline sem custo."""

from collections.abc import Sequence
from string import ascii_uppercase

from one_percent.config.settings import QuizSettings
from one_percent.domain.identity import card_id
from one_percent.domain.models import ContentItem
from one_percent.summarizer import LIMITS, Quiz, Summary, SummaryBatch


class FakeSummarizer:
    def __init__(self, distractors: int = QuizSettings().distractors) -> None:
        self._distractors = tuple(f"Outro assunto {ascii_uppercase[n]}" for n in range(distractors))

    def summarize(self, items: Sequence[ContentItem]) -> SummaryBatch:
        return SummaryBatch({card_id(item): self._summary(item) for item in items})

    def _summary(self, item: ContentItem) -> Summary:
        is_paper = item.kind == "paper"
        return Summary(
            title=item.title[: LIMITS.short],
            summary=(item.summary or item.title)[: LIMITS.long],
            why_it_matters="Resumo de exemplo gerado sem LLM.",
            method="Método descrito no artigo original." if is_paper else None,
            result="Resultado descrito no artigo original." if is_paper else None,
            limitations="Limitações descritas no artigo original." if is_paper else None,
            quiz=Quiz(
                question=f"Qual é o assunto de: {item.title}?"[: LIMITS.short],
                correct_answer=item.title[: LIMITS.short],
                distractors=self._distractors,
            ),
        )
