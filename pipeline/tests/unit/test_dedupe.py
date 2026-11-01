from one_percent.domain.dedupe import dedupe
from tests.factories import make_item


def test_same_url_is_duplicate() -> None:
    a = make_item(url="https://example.com/a?utm_source=x")
    b = make_item(url="https://example.com/a")

    assert len(dedupe([a, b])) == 1


def test_same_story_different_sources_is_duplicate() -> None:
    a = make_item(title="Banco Central corta a taxa Selic para 10% ao ano", source_id="g1")
    b = make_item(title="Banco Central corta taxa Selic para 10% ao ano!", source_id="valor")

    assert len(dedupe([a, b])) == 1


def test_different_stories_are_kept() -> None:
    a = make_item(title="Banco Central corta a taxa Selic para 10% ao ano")
    b = make_item(title="Nova vacina contra dengue é aprovada pela agência")

    assert len(dedupe([a, b])) == 2


def test_duplicate_counts_coverage_and_keeps_heaviest_source() -> None:
    light = make_item(title="Empresa lança chip de IA para celulares", source_weight=0.8)
    heavy = make_item(title="Empresa lança chip de IA para celulares", source_weight=1.2)
    third = make_item(title="Empresa lança novo chip de IA para celulares", source_weight=1.0)

    [kept] = dedupe([light, heavy, third])

    assert kept.url == heavy.url
    assert kept.coverage == 3


def test_items_from_different_subareas_are_not_merged_by_title() -> None:
    a = make_item(title="Relatório anual sobre o mercado", subarea_id="finance.markets")
    b = make_item(title="Relatório anual sobre o mercado", subarea_id="economy.world")

    assert len(dedupe([a, b])) == 2
