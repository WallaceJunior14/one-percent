"""Linha de comando: `python -m one_percent run [--fake] [--limit N] [--out DIR]`."""

import argparse
import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

import anthropic
import httpx

from one_percent.config import load_config
from one_percent.pipeline import run_pipeline
from one_percent.sources.arxiv import MIN_INTERVAL_SECONDS
from one_percent.sources.collect import build_sources
from one_percent.summarizer import Summarizer
from one_percent.summarizer.anthropic import MAX_ITEMS_PER_RUN, AnthropicSummarizer
from one_percent.summarizer.fake import FakeSummarizer


def make_http_client() -> httpx.Client:
    return httpx.Client()


def make_arxiv_interval() -> float:
    return MIN_INTERVAL_SECONDS


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="one_percent", description="Pipeline do 1% ao Dia")
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run", help="coleta, resume e publica o conteúdo do dia")
    run.add_argument("--out", type=Path, default=Path("out"), help="pasta de saída (padrão: out)")
    run.add_argument("--fake", action="store_true", help="resumos falsos, sem chamar o LLM")
    run.add_argument(
        "--limit",
        type=int,
        default=MAX_ITEMS_PER_RUN,
        help=f"máximo de itens enviados ao LLM (padrão: {MAX_ITEMS_PER_RUN})",
    )
    run.add_argument("--now", type=datetime.fromisoformat, help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    """Código de saída 0 quando o dia é publicado; 1 caso contrário."""
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    now: datetime = args.now or datetime.now(UTC)
    summarizer: Summarizer = (
        FakeSummarizer()
        if args.fake
        else AnthropicSummarizer(anthropic.Anthropic(), max_items=args.limit)
    )
    config = load_config()
    with make_http_client() as client:
        sources = build_sources(config, client, arxiv_interval=make_arxiv_interval())
        report = run_pipeline(config, sources, summarizer, now, args.out)
    return 0 if report.published else 1
