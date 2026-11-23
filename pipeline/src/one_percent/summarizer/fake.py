"""Summarizer determinístico, sem rede: para testes e para rodar o pipeline sem custo."""

from collections.abc import Sequence

from one_percent.domain.identity import card_id
from one_percent.domain.models import ContentItem
from one_percent.summarizer import LONG_TEXT_MAX, SHORT_TEXT_MAX, Quiz, Summary


class FakeSummarizer:
    def summarize(self, items: Sequence[ContentItem]) -> dict[str, Summary]:
        return {card_id(item): self._summary(item) for item in items}

    @staticmethod
    def _summary(item: ContentItem) -> Summary:
        is_paper = item.kind == "paper"
        return Summary(
            title=item.title[:SHORT_TEXT_MAX],
            summary=(item.summary or item.title)[:LONG_TEXT_MAX],
            why_it_matters="Resumo de exemplo gerado sem LLM.",
            method="Método descrito no artigo original." if is_paper else None,
            result="Resultado descrito no artigo original." if is_paper else None,
            limitations="Limitações descritas no artigo original." if is_paper else None,
            quiz=Quiz(
                question=f"Qual é o assunto de: {item.title}?"[:SHORT_TEXT_MAX],
                correct_answer=item.title[:SHORT_TEXT_MAX],
                distractors=("Outro assunto A", "Outro assunto B", "Outro assunto C"),
            ),
        )
