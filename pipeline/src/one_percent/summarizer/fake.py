"""Summarizer determinístico, sem rede: para testes e para rodar o pipeline sem custo."""

from collections.abc import Sequence

from one_percent.domain.models import ContentItem
from one_percent.summarizer import Quiz, Summary, card_id


class FakeSummarizer:
    def summarize(self, items: Sequence[ContentItem]) -> dict[str, Summary]:
        return {card_id(item): self._summary(item) for item in items}

    @staticmethod
    def _summary(item: ContentItem) -> Summary:
        is_paper = item.kind == "paper"
        return Summary(
            title=item.title[:200],
            summary=(item.summary or item.title)[:600],
            why_it_matters="Resumo de exemplo gerado sem LLM.",
            method="Método descrito no artigo original." if is_paper else None,
            result="Resultado descrito no artigo original." if is_paper else None,
            limitations="Limitações descritas no artigo original." if is_paper else None,
            quiz=Quiz(
                question=f"Qual é o assunto de: {item.title[:150]}?",
                correct_answer=item.title[:200],
                distractors=("Outro assunto A", "Outro assunto B", "Outro assunto C"),
            ),
        )
