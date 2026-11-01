import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest

from one_percent import cli
from one_percent.config import load_config
from one_percent.contract import validate_daily_content
from one_percent.domain.models import ContentItem
from one_percent.pipeline import run_pipeline
from one_percent.summarizer.fake import FakeSummarizer
from tests.factories import NOW, make_item
from tests.helpers import fixture_bytes

CONFIG = load_config()


class FakeSource:
    def __init__(self, id: str, items: list[ContentItem]) -> None:
        self.id = id
        self._items = items

    def fetch(self, now: datetime) -> list[ContentItem]:
        return self._items


def _sources_covering_all_areas() -> list[FakeSource]:
    sources = []
    for area in CONFIG.areas:
        for subarea in area.subareas:
            kind = "paper" if area.id == "science" else "news"
            items = [
                make_item(
                    kind=kind, subarea_id=subarea.id, hours_ago=h, authors=("A",), venue="arXiv"
                )
                for h in (1, 2, 3)
            ]
            sources.append(FakeSource(subarea.id, items))
    return sources


def test_pipeline_publishes_a_valid_day(tmp_path: Path) -> None:
    report = run_pipeline(CONFIG, _sources_covering_all_areas(), FakeSummarizer(), NOW, tmp_path)

    assert report.published
    day = json.loads((tmp_path / "latest.json").read_text(encoding="utf-8"))
    validate_daily_content(day)
    assert len(day["cards"]) == report.cards >= 15
    assert {story["areaId"] for story in day["stories"]} == {area.id for area in CONFIG.areas}


def test_pipeline_summarizes_best_ranked_items_first(tmp_path: Path) -> None:
    class RecordingSummarizer(FakeSummarizer):
        def __init__(self) -> None:
            self.seen: list[ContentItem] = []

        def summarize(self, items):  # type: ignore[no-untyped-def]
            self.seen = list(items)
            return super().summarize(items)

    summarizer = RecordingSummarizer()
    run_pipeline(CONFIG, _sources_covering_all_areas(), summarizer, NOW, tmp_path)

    subareas_in_first_round = {item.subarea_id for item in summarizer.seen[:16]}
    assert len(subareas_in_first_round) == 16


def _mocked_network(request: httpx.Request) -> httpx.Response:
    fixture = {
        "export.arxiv.org": "arxiv.xml",
        "api.biorxiv.org": "biorxiv.json",
        "huggingface.co": "hf_daily_papers.json",
    }.get(request.url.host, "rss_basic.xml")
    return httpx.Response(200, content=fixture_bytes(fixture))


def test_cli_fake_run_with_mocked_network_keeps_previous_day_when_too_few_cards(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(
        cli,
        "make_http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(_mocked_network)),
    )
    monkeypatch.setattr(cli, "make_arxiv_interval", lambda: 0.0)
    now = datetime(2026, 11, 1, 10, 0, tzinfo=UTC).isoformat()

    exit_code = cli.main(["run", "--fake", "--out", str(tmp_path), "--now", now])

    assert exit_code == 1
    assert not (tmp_path / "latest.json").exists()
    assert "não publicado" in caplog.text
