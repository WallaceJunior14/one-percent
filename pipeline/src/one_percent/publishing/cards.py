"""Monta o card do contrato a partir do item da fonte + resumo do LLM (T041).

Regra de segurança (OWASP LLM02): URL, autores, datas, fonte e venue vêm sempre do item
original; do LLM só entram campos de texto, que o app exibe como texto puro.
"""

import logging
import random
from typing import Any

from one_percent.domain.models import RankedItem
from one_percent.summarizer import Summary, card_id

logger = logging.getLogger(__name__)

MAX_AUTHORS = 3
TIMESTAMP_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def _quiz(cid: str, summary: Summary) -> dict[str, Any] | None:
    options = [summary.quiz.correct_answer, *summary.quiz.distractors]
    if len(set(options)) != len(options):
        return None
    # Embaralhamento reprodutível (semente = id do card); não é uso criptográfico.
    random.Random(cid).shuffle(options)  # noqa: S311
    return {
        "question": summary.quiz.question,
        "options": options,
        "answerIndex": options.index(summary.quiz.correct_answer),
    }


def build_card(ranked: RankedItem, summary: Summary) -> dict[str, Any] | None:
    """Card pronto para o JSON do dia, ou None se o resumo não servir para o tipo do item."""
    item = ranked.item
    cid = card_id(item)
    quiz = _quiz(cid, summary)
    if quiz is None:
        logger.warning("card %s descartado: alternativas do quiz repetidas", cid)
        return None

    card: dict[str, Any] = {
        "id": cid,
        "type": item.kind,
        "areaId": item.area_id,
        "subareaId": item.subarea_id,
        "rank": ranked.rank,
        "title": summary.title,
        "summary": summary.summary,
        "whyItMatters": summary.why_it_matters,
        "sourceName": item.source_name,
        "url": item.url,
        "publishedAt": item.published_at.strftime(TIMESTAMP_FORMAT),
        "quiz": quiz,
    }
    if item.kind == "news":
        return card

    if not (summary.method and summary.result and summary.limitations):
        logger.warning("card %s descartado: artigo sem método/resultado/limitações", cid)
        return None
    if not item.authors or item.venue is None:
        logger.warning("card %s descartado: artigo sem autores ou venue", cid)
        return None
    card.update(
        {
            "originalTitle": item.title[:400],
            "method": summary.method,
            "result": summary.result,
            "limitations": summary.limitations,
            "authors": list(item.authors[:MAX_AUTHORS]),
            "authorsTruncated": len(item.authors) > MAX_AUTHORS,
            "venue": item.venue,
            "isPreprint": item.is_preprint,
        }
    )
    if item.pdf_url:
        card["pdfUrl"] = item.pdf_url
    return card
