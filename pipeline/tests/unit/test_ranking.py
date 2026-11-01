from one_percent.domain.ranking import select_top
from tests.factories import NOW, make_item


def test_newer_item_ranks_higher_all_else_equal() -> None:
    old = make_item(hours_ago=20)
    new = make_item(hours_ago=2)

    ranked = select_top([old, new], NOW)

    assert [r.item.url for r in ranked] == [new.url, old.url]


def test_story_covered_by_more_sources_ranks_higher() -> None:
    single = make_item(hours_ago=2, coverage=1)
    widely_covered = make_item(hours_ago=6, coverage=4)

    ranked = select_top([single, widely_covered], NOW)

    assert ranked[0].item.url == widely_covered.url


def test_popular_paper_ranks_higher() -> None:
    quiet = make_item(kind="paper", hours_ago=24, popularity=0)
    popular = make_item(kind="paper", hours_ago=48, popularity=120)

    ranked = select_top([quiet, popular], NOW)

    assert ranked[0].item.url == popular.url


def test_keeps_top_8_per_subarea() -> None:
    items = [make_item(subarea_id="tech.ai", hours_ago=h) for h in range(1, 13)]
    items += [make_item(subarea_id="health.mental", hours_ago=h) for h in range(1, 4)]

    ranked = select_top(items, NOW)

    assert sum(r.item.subarea_id == "tech.ai" for r in ranked) == 8
    assert sum(r.item.subarea_id == "health.mental" for r in ranked) == 3


def test_ranks_start_at_1_within_each_subarea() -> None:
    items = [make_item(subarea_id="tech.ai", hours_ago=h) for h in (1, 2)]
    items += [make_item(subarea_id="tech.dev", hours_ago=h) for h in (1, 2, 3)]

    ranked = select_top(items, NOW)

    assert sorted(r.rank for r in ranked if r.item.subarea_id == "tech.ai") == [1, 2]
    assert sorted(r.rank for r in ranked if r.item.subarea_id == "tech.dev") == [1, 2, 3]


def test_same_input_same_output() -> None:
    items = [make_item(hours_ago=5) for _ in range(5)]

    assert select_top(items, NOW) == select_top(list(reversed(items)), NOW)
