from one_percent.summarizer import card_id
from one_percent.summarizer.fake import FakeSummarizer
from tests.factories import make_item


def test_summarizes_every_item_keyed_by_card_id() -> None:
    items = [make_item(), make_item(kind="paper")]

    summaries = FakeSummarizer().summarize(items)

    assert set(summaries) == {card_id(item) for item in items}


def test_paper_summaries_include_scientific_fields() -> None:
    paper = make_item(kind="paper")

    summary = FakeSummarizer().summarize([paper])[card_id(paper)]

    assert summary.method and summary.result and summary.limitations


def test_is_deterministic() -> None:
    items = [make_item(), make_item()]

    assert FakeSummarizer().summarize(items) == FakeSummarizer().summarize(items)


def test_card_id_is_stable_for_the_same_canonical_url() -> None:
    a = make_item(url="https://example.com/a?utm_source=rss")
    b = make_item(url="https://example.com/a")

    assert card_id(a) == card_id(b)
    assert card_id(a).startswith("c_") and len(card_id(a)) == 14
