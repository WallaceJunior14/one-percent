from typing import Any

import pytest

from one_percent.contract import validate_daily_content
from one_percent.domain.models import RankedItem
from one_percent.publishing.cards import build_card
from one_percent.summarizer import Quiz, Summary
from tests.factories import make_item


def _summary(**overrides: Any) -> Summary:
    values: dict[str, Any] = {
        "title": "Título em português",
        "summary": "Resumo em até três frases.",
        "why_it_matters": "Por que importa.",
        "quiz": Quiz(
            question="Qual é a ideia principal?",
            correct_answer="A resposta certa",
            distractors=("Errada 1", "Errada 2", "Errada 3"),
        ),
    }
    values.update(overrides)
    return Summary(**values)


def _paper_summary() -> Summary:
    return _summary(
        method="Ensaio com 100 pessoas.", result="Melhora de 10%.", limitations="Amostra pequena."
    )


def _ranked(**item_overrides: Any) -> RankedItem:
    return RankedItem(item=make_item(**item_overrides), rank=2, score=1.0)


def _as_day(card: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "date": "2026-11-01",
        "generatedAt": "2026-11-01T08:00:00Z",
        "areas": [
            {"id": "tech", "name": "Tecnologia", "subareas": [{"id": "tech.ai", "name": "IA"}]}
        ],
        "cards": [card],
        "stories": [],
    }


def test_news_card_follows_the_contract() -> None:
    card = build_card(_ranked(), _summary())

    assert card is not None
    validate_daily_content(_as_day(card))
    assert card["type"] == "news" and card["rank"] == 2


def test_url_comes_from_source_not_llm() -> None:
    ranked = _ranked(url="https://example.com/original")
    sneaky = _summary(summary="Leia mais em https://malicioso.example/phishing")

    card = build_card(ranked, sneaky)

    assert card is not None
    assert card["url"] == "https://example.com/original"
    assert card["sourceName"] == ranked.item.source_name
    assert card["publishedAt"] == ranked.item.published_at.strftime("%Y-%m-%dT%H:%M:%SZ")


def test_paper_card_has_method_result_limitations() -> None:
    ranked = _ranked(
        kind="paper",
        title="Original English Title",
        authors=("A", "B", "C", "D"),
        venue="arXiv",
        is_preprint=True,
        pdf_url="https://arxiv.org/pdf/1",
    )

    card = build_card(ranked, _paper_summary())

    assert card is not None
    validate_daily_content(_as_day(card))
    assert card["originalTitle"] == "Original English Title"
    assert (card["method"], card["result"], card["limitations"]) == (
        "Ensaio com 100 pessoas.",
        "Melhora de 10%.",
        "Amostra pequena.",
    )
    assert card["authors"] == ["A", "B", "C"] and card["authorsTruncated"] is True
    assert card["pdfUrl"] == "https://arxiv.org/pdf/1"


def test_invalid_summary_is_discarded() -> None:
    paper = _ranked(kind="paper", venue="arXiv", authors=("A",))

    assert build_card(paper, _summary()) is None


def test_paper_without_authors_is_discarded() -> None:
    paper = _ranked(kind="paper", venue="arXiv", authors=())

    assert build_card(paper, _paper_summary()) is None


def test_quiz_options_are_shuffled_but_answer_index_points_to_correct_answer() -> None:
    positions = set()
    for n in range(12):
        card = build_card(_ranked(url=f"https://example.com/q{n}"), _summary())
        assert card is not None
        quiz = card["quiz"]
        assert quiz["options"][quiz["answerIndex"]] == "A resposta certa"
        positions.add(quiz["answerIndex"])

    assert len(positions) > 1


def test_same_item_produces_the_same_card() -> None:
    ranked = _ranked(url="https://example.com/fixo")

    assert build_card(ranked, _summary()) == build_card(ranked, _summary())


@pytest.mark.parametrize("field", ["title", "summary", "why_it_matters"])
def test_summary_rejects_empty_or_too_long_text(field: str) -> None:
    with pytest.raises(ValueError):
        _summary(**{field: ""})
    with pytest.raises(ValueError):
        _summary(**{field: "x" * 601})
