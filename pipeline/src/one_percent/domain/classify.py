"""Encaixa notícias de feeds gerais na subárea certa por palavras-chave (T024)."""

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import replace
from functools import cache

from one_percent.domain.models import ContentItem

TITLE_WEIGHT = 2
SUMMARY_WEIGHT = 1


def _fold(text: str) -> str:
    """Minúsculas e sem acentos, para comparar 'Inteligência' com 'INTELIGENCIA'."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


@cache
def _keyword_pattern(keyword: str) -> re.Pattern[str]:
    return re.compile(rf"\b{re.escape(_fold(keyword))}\b")


def _matches(keywords: Sequence[str], text: str) -> int:
    return sum(1 for keyword in keywords if _keyword_pattern(keyword).search(text))


def classify_subarea(
    item: ContentItem, keywords_by_subarea: Mapping[str, Sequence[str]]
) -> ContentItem:
    """Devolve o item na subárea com mais palavras-chave encontradas.

    Casamentos no título valem mais que no resumo. Sem nenhum casamento, mantém a subárea
    padrão da fonte. Artigos científicos nunca são reclassificados: a categoria vem da fonte.
    """
    if item.kind == "paper":
        return item

    title, summary = _fold(item.title), _fold(item.summary)
    best_subarea, best_score = item.subarea_id, 0
    for subarea_id, keywords in keywords_by_subarea.items():
        score = TITLE_WEIGHT * _matches(keywords, title) + SUMMARY_WEIGHT * _matches(
            keywords, summary
        )
        if score > best_score:
            best_subarea, best_score = subarea_id, score
    return replace(item, subarea_id=best_subarea)
