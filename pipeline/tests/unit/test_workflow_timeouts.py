"""O workflow diário precisa caber duas tentativas completas no timeout do job (CR-002)."""

import re
from pathlib import Path

import yaml

from one_percent.summarizer.anthropic import TIMEOUT_SECONDS

WORKFLOW = Path(__file__).resolve().parents[3] / ".github" / "workflows" / "daily-content.yml"
COLLECTION_MARGIN_MINUTES = 5
"""Coleta das fontes, instalação e publicação, com folga."""


def test_two_attempts_fit_in_the_job_timeout() -> None:
    workflow = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    job = workflow["jobs"]["publish"]
    script = next(step["run"] for step in job["steps"] if "attempt" in step.get("run", ""))
    pause_minutes = int(re.search(r"sleep (\d+)", script).group(1)) / 60  # type: ignore[union-attr]

    attempt_minutes = TIMEOUT_SECONDS / 60 + COLLECTION_MARGIN_MINUTES
    assert 2 * attempt_minutes + pause_minutes < job["timeout-minutes"]
