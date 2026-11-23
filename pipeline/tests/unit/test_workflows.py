"""Regras dos workflows do GitHub Actions (CR-002, SEC-001 a SEC-003)."""

import re
import tomllib
from pathlib import Path
from typing import Any

import pytest
import yaml

from one_percent.sources import RETRY_BUDGET_SECONDS
from one_percent.summarizer.anthropic import TIMEOUT_SECONDS

ROOT = Path(__file__).resolve().parents[3]
WORKFLOWS = ROOT / ".github" / "workflows"
DAILY = WORKFLOWS / "daily-content.yml"
LOCK = ROOT / "pipeline" / "requirements.lock"
COLLECTION_MARGIN_MINUTES = 3 + RETRY_BUDGET_SECONDS / 60
"""Coleta das fontes, instalação e publicação (~3 min) mais o orçamento de novas tentativas."""


def _load(path: Path) -> dict[str, Any]:
    workflow: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return workflow


def _jobs_with_api_key(workflow: dict[str, Any]) -> list[dict[str, Any]]:
    return [job for job in workflow["jobs"].values() if "ANTHROPIC_API_KEY" in yaml.dump(job)]


def _run_scripts(job: dict[str, Any]) -> str:
    return "\n".join(step.get("run", "") for step in job["steps"])


def test_two_attempts_fit_in_the_job_timeout() -> None:
    [job] = _jobs_with_api_key(_load(DAILY))
    pause = re.search(r"sleep (\d+)", _run_scripts(job))
    assert pause is not None

    attempt_minutes = TIMEOUT_SECONDS / 60 + COLLECTION_MARGIN_MINUTES
    assert 2 * attempt_minutes + int(pause.group(1)) / 60 < job["timeout-minutes"]


def test_job_with_api_key_cannot_write_to_the_repository() -> None:
    workflow = _load(DAILY)
    assert workflow.get("permissions", {}) == {}

    for job in _jobs_with_api_key(workflow):
        assert job["permissions"] == {"contents": "read"}
        checkouts = [s for s in job["steps"] if s.get("uses", "").startswith("actions/checkout@")]
        assert all(step["with"]["persist-credentials"] is False for step in checkouts)


def test_job_with_write_access_runs_no_project_code() -> None:
    jobs = _load(DAILY)["jobs"].values()
    writers = [job for job in jobs if job["permissions"].get("contents") == "write"]

    assert len(writers) == 1
    assert not re.search(r"\b(pip|python|npm|node)\b", _run_scripts(writers[0]))


def test_daily_run_installs_locked_dependencies_with_hashes() -> None:
    [job] = _jobs_with_api_key(_load(DAILY))
    scripts = _run_scripts(job)

    assert "pip install --require-hashes -r pipeline/requirements.lock" in scripts
    assert "pip install -e" not in scripts


def test_lock_covers_every_runtime_dependency() -> None:
    pyproject = tomllib.loads((ROOT / "pipeline" / "pyproject.toml").read_text(encoding="utf-8"))
    locked = set(re.findall(r"^([a-z0-9-]+)==", LOCK.read_text(encoding="utf-8"), re.MULTILINE))

    for requirement in pyproject["project"]["dependencies"]:
        name = re.split(r"[<>=!~\[; ]", requirement, maxsplit=1)[0].lower().replace("_", "-")
        assert name in locked, f"{name} não está em requirements.lock"


@pytest.mark.parametrize("path", sorted(WORKFLOWS.glob("*.yml")), ids=lambda p: p.name)
def test_actions_are_pinned_by_commit_sha(path: Path) -> None:
    uses = re.findall(r"uses:\s*(\S+)", path.read_text(encoding="utf-8"))

    assert uses
    for action in uses:
        assert re.fullmatch(r"[\w.-]+/[\w.-]+@[0-9a-f]{40}", action), action
