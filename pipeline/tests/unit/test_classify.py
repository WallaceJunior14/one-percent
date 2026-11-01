from one_percent.domain.classify import classify_subarea
from tests.factories import make_item

TECH_KEYWORDS = {
    "tech.ai": ["inteligência artificial", "IA", "LLM"],
    "tech.security": ["vazamento", "hacker", "senha"],
    "tech.hardware": ["chip", "celular"],
}


def test_uses_default_when_no_keyword_matches() -> None:
    item = make_item(title="Empresa anuncia novo escritório em Recife", subarea_id="tech.hardware")

    assert classify_subarea(item, TECH_KEYWORDS).subarea_id == "tech.hardware"


def test_picks_subarea_with_most_keyword_matches() -> None:
    item = make_item(
        title="Vazamento expõe senha de usuários de app de IA",
        summary="Hacker publicou os dados em um fórum.",
        subarea_id="tech.hardware",
    )

    assert classify_subarea(item, TECH_KEYWORDS).subarea_id == "tech.security"


def test_ignores_case_and_accents() -> None:
    item = make_item(
        title="Avanços da INTELIGENCIA ARTIFICIAL no Brasil", subarea_id="tech.hardware"
    )

    assert classify_subarea(item, TECH_KEYWORDS).subarea_id == "tech.ai"


def test_matches_whole_words_only() -> None:
    item = make_item(title="Chipre aprova nova lei de telecomunicações", subarea_id="tech.dev")

    assert classify_subarea(item, TECH_KEYWORDS).subarea_id == "tech.dev"


def test_title_matches_weigh_more_than_summary_matches() -> None:
    item = make_item(
        title="Novo chip promete celulares mais rápidos",
        summary="O chip usa IA para economizar bateria.",
        subarea_id="tech.dev",
    )

    assert classify_subarea(item, TECH_KEYWORDS).subarea_id == "tech.hardware"


def test_papers_keep_source_subarea() -> None:
    paper = make_item(kind="paper", title="LLM agents for security", subarea_id="tech.hardware")

    assert classify_subarea(paper, TECH_KEYWORDS).subarea_id == "tech.hardware"
