import json
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

import anthropic
import httpx
import pytest

from one_percent import cli
from one_percent.contract import ContractViolationError
from one_percent.domain.models import ContentItem
from one_percent.summarizer import SummarizerError, SummaryBatch
from tests.helpers import fixture_bytes

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=UTC).isoformat()


def _mocked_network(request: httpx.Request) -> httpx.Response:
    fixture = {
        "export.arxiv.org": "arxiv.xml",
        "api.biorxiv.org": "biorxiv.json",
        "huggingface.co": "hf_daily_papers.json",
    }.get(request.url.host, "rss_basic.xml")
    return httpx.Response(200, content=fixture_bytes(fixture))


def _no_network(request: httpx.Request) -> httpx.Response:
    raise AssertionError(f"rede não deveria ser usada: {request.url}")


def _api_error(error_class: type[anthropic.APIStatusError], status: int) -> Exception:
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages/batches")
    return error_class("falha", response=httpx.Response(status, request=request), body=None)


class FailingSummarizer:
    def __init__(self, error: Exception) -> None:
        self._error = error

    def summarize(self, items: Sequence[ContentItem]) -> SummaryBatch:
        raise self._error


@pytest.fixture
def network(monkeypatch: pytest.MonkeyPatch) -> None:
    transport = httpx.MockTransport(_mocked_network)
    monkeypatch.setattr(cli, "make_http_client", lambda: httpx.Client(transport=transport))
    monkeypatch.setattr(cli, "make_arxiv_interval", lambda: 0.0)


@pytest.mark.parametrize(
    ("error_class", "status"),
    [
        (anthropic.BadRequestError, 400),
        (anthropic.AuthenticationError, 401),
        (anthropic.PermissionDeniedError, 403),
    ],
)
@pytest.mark.usefixtures("network")
def test_permanent_api_error_exits_2_with_clear_message(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    error_class: type[anthropic.APIStatusError],
    status: int,
) -> None:
    error = _api_error(error_class, status)
    monkeypatch.setattr(cli, "make_summarizer", lambda args, settings: FailingSummarizer(error))

    exit_code = cli.main(["run", "--out", str(tmp_path), "--now", NOW])

    assert exit_code == cli.EXIT_PERMANENT_ERROR == 2
    assert f"erro permanente da API da Anthropic (HTTP {status})" in caplog.text
    assert not (tmp_path / "latest.json").exists()


@pytest.mark.usefixtures("network")
def test_transient_api_error_exits_1(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    error = _api_error(anthropic.InternalServerError, 500)
    monkeypatch.setattr(cli, "make_summarizer", lambda args, settings: FailingSummarizer(error))

    exit_code = cli.main(["run", "--out", str(tmp_path), "--now", NOW])

    assert exit_code == cli.EXIT_NOT_PUBLISHED == 1
    assert "erro temporário da API da Anthropic (HTTP 500)" in caplog.text


def test_skip_if_published_does_nothing_when_today_is_already_published(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    latest = tmp_path / "latest.json"
    latest.write_text(json.dumps({"date": "2026-11-01"}), encoding="utf-8")
    transport = httpx.MockTransport(_no_network)
    monkeypatch.setattr(cli, "make_http_client", lambda: httpx.Client(transport=transport))

    exit_code = cli.main(
        ["run", "--fake", "--skip-if-published", "--out", str(tmp_path), "--now", NOW]
    )

    assert exit_code == cli.EXIT_PUBLISHED == 0
    assert json.loads(latest.read_text(encoding="utf-8")) == {"date": "2026-11-01"}


@pytest.mark.usefixtures("network")
def test_skip_if_published_runs_when_latest_is_from_yesterday(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    (tmp_path / "latest.json").write_text(json.dumps({"date": "2026-10-31"}), encoding="utf-8")

    exit_code = cli.main(
        ["run", "--fake", "--skip-if-published", "--out", str(tmp_path), "--now", NOW]
    )

    assert exit_code == cli.EXIT_NOT_PUBLISHED
    assert "não publicado" in caplog.text


@pytest.mark.usefixtures("network")
def test_batch_timeout_exits_1_to_be_retried(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    error = SummarizerError("batch msgbatch_x: tempo esgotado; batch cancelado")
    monkeypatch.setattr(cli, "make_summarizer", lambda args, settings: FailingSummarizer(error))

    exit_code = cli.main(["run", "--out", str(tmp_path), "--now", NOW])

    assert exit_code == cli.EXIT_NOT_PUBLISHED
    assert "tempo esgotado" in caplog.text


def test_invalid_settings_exit_2_before_collecting(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    settings = tmp_path / "pipeline.yaml"
    settings.write_text("llm:\n  max_items_per_run: 0\n", encoding="utf-8")
    opened: list[bool] = []
    monkeypatch.setattr(cli, "make_http_client", lambda: opened.append(True))

    exit_code = cli.main(
        ["run", "--fake", "--settings", str(settings), "--out", str(tmp_path), "--now", NOW]
    )

    assert exit_code == cli.EXIT_PERMANENT_ERROR
    assert "llm.max_items_per_run" in caplog.text
    assert opened == []
    assert not (tmp_path / "latest.json").exists()


@pytest.mark.usefixtures("network")
def test_contract_violation_exits_2_without_retry(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def broken_publish(*args: object) -> bool:
        raise ContractViolationError("1 violação(ões) do contrato: cards/0/title: too long")

    monkeypatch.setattr("one_percent.pipeline.publish", broken_publish)

    exit_code = cli.main(["run", "--out", str(tmp_path), "--now", NOW, "--fake"])

    assert exit_code == cli.EXIT_PERMANENT_ERROR
    assert "violação(ões) do contrato" in caplog.text
