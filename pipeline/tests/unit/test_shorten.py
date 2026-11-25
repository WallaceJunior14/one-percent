import pytest

from one_percent.summarizer.shorten import ELLIPSIS, shorten, shorten_fields


def test_text_within_limit_is_unchanged() -> None:
    assert shorten("Curto.", 10) == "Curto."


def test_cuts_at_last_sentence_end() -> None:
    text = "Primeira frase. Segunda frase! Terceira frase longa demais para caber."

    assert shorten(text, 35) == "Primeira frase. Segunda frase!"


def test_sentence_ending_exactly_at_the_limit_is_kept() -> None:
    assert shorten("Uma frase. Outra.", 10) == "Uma frase."


def test_falls_back_to_word_boundary_with_ellipsis() -> None:
    text = "Uma frase só, comprida, sem nenhum ponto antes do limite escolhido"

    shortened = shorten(text, 25)

    assert shortened == f"Uma frase só, comprida{ELLIPSIS}"


def test_single_long_word_is_cut_with_ellipsis() -> None:
    assert shorten("x" * 50, 10) == "x" * 9 + ELLIPSIS


@pytest.mark.parametrize(
    "abbreviation", ["Dr.", "Sr.", "Sra.", "et al.", "p. ex.", "EUA.", "etc.", "U.S."]
)
def test_does_not_cut_at_a_common_abbreviation(abbreviation: str) -> None:
    text = f"O estudo citado por {abbreviation} Silva afirmou que a vacina reduz internações"

    shortened = shorten(text, 45)

    assert shortened.endswith(ELLIPSIS)
    assert len(shortened) >= 30


def test_still_cuts_at_a_real_sentence_end_before_an_abbreviation() -> None:
    text = "A vacina funciona. O Dr. Silva afirmou que a vacina reduz internações"

    assert shorten(text, 40) == "A vacina funciona."


@pytest.mark.parametrize("limit", [1, 2, 7, 30, 99])
def test_keeps_text_within_limit(limit: int) -> None:
    text = "Isto é um teste. Com várias frases, vírgulas e palavras! Será? Sim. " * 3

    shortened = shorten(text, limit)

    assert 0 < len(shortened) <= limit
    assert text.startswith(shortened.removesuffix(ELLIPSIS))


def test_shorten_fields_reports_what_changed() -> None:
    data = {
        "title": "x" * 30,
        "summary": "ok",
        "quiz": {"question": "?", "distractors": ["a", "b" * 30]},
        "method": None,
    }
    limits = {"title": 10, "summary": 10, "quiz.question": 10, "quiz.distractors": 10}

    result, shortened = shorten_fields(data, limits)

    assert len(result["title"]) == 10 and result["summary"] == "ok"
    assert result["quiz"]["distractors"][0] == "a"
    assert len(result["quiz"]["distractors"][1]) == 10
    assert result["method"] is None
    assert shortened == ["title", "quiz.distractors"]
    assert data["title"] == "x" * 30
