"""Linha de comando: `python -m one_percent run --help`."""

import argparse
import json
import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

import anthropic
import httpx

from one_percent.config import load_config
from one_percent.config.settings import (
    DEFAULT_SETTINGS_PATH,
    PipelineSettings,
    SettingsError,
    load_settings,
)
from one_percent.contract import ContractViolationError
from one_percent.pipeline import run_pipeline
from one_percent.publishing.day import local_date
from one_percent.sources.arxiv import MIN_INTERVAL_SECONDS
from one_percent.sources.collect import build_sources
from one_percent.summarizer import Summarizer, SummarizerError
from one_percent.summarizer.anthropic import AnthropicSummarizer
from one_percent.summarizer.fake import FakeSummarizer

logger = logging.getLogger(__name__)

EXIT_PUBLISHED = 0
EXIT_NOT_PUBLISHED = 1
"""Falha que pode se resolver sozinha: vale tentar de novo."""
EXIT_PERMANENT_ERROR = 2
"""Falha de configuração, conta ou contrato: repetir não adianta."""

PERMANENT_STATUS_CODES = frozenset({400, 401, 403, 404})


def make_http_client() -> httpx.Client:
    return httpx.Client()


def make_arxiv_interval() -> float:
    return MIN_INTERVAL_SECONDS


def make_summarizer(args: argparse.Namespace, settings: PipelineSettings) -> Summarizer:
    if args.fake:
        return FakeSummarizer()
    return AnthropicSummarizer(anthropic.Anthropic(), settings, max_items=args.limit)


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="one_percent", description="Pipeline do 1% ao Dia")
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run", help="coleta, resume e publica o conteúdo do dia")
    run.add_argument("--out", type=Path, default=Path("out"), help="pasta de saída (padrão: out)")
    run.add_argument(
        "--settings",
        type=Path,
        default=DEFAULT_SETTINGS_PATH,
        help="parâmetros da operação (padrão: config/pipeline.yaml do pacote)",
    )
    run.add_argument("--fake", action="store_true", help="resumos falsos, sem chamar o LLM")
    run.add_argument(
        "--limit",
        type=int,
        help="máximo de itens enviados ao LLM (padrão: llm.max_items_per_run da configuração)",
    )
    run.add_argument(
        "--skip-if-published",
        action="store_true",
        help="não faz nada se o latest.json já for do dia de hoje (para agendamentos repetidos)",
    )
    run.add_argument("--now", type=datetime.fromisoformat, help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def _already_published(out_dir: Path, today: str) -> bool:
    try:
        latest = json.loads((out_dir / "latest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return isinstance(latest, dict) and latest.get("date") == today


def main(argv: Sequence[str] | None = None) -> int:
    """Códigos de saída: `EXIT_PUBLISHED`, `EXIT_NOT_PUBLISHED` ou `EXIT_PERMANENT_ERROR`."""
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    try:
        settings = load_settings(args.settings)
    except SettingsError as error:
        logger.error("%s. Nada foi coletado; o conteúdo anterior continua valendo.", error)
        return EXIT_PERMANENT_ERROR

    now: datetime = args.now or datetime.now(UTC)
    today = local_date(now, settings.content.zone).isoformat()
    if args.skip_if_published and _already_published(args.out, today):
        logger.info("dia %s já publicado; nada a fazer", today)
        return EXIT_PUBLISHED

    config = load_config()
    try:
        with make_http_client() as client:
            sources = build_sources(
                config,
                client,
                paper_window=settings.content.windows.max_age["paper"],
                arxiv_interval=make_arxiv_interval(),
            )
            summarizer = make_summarizer(args, settings)
            report = run_pipeline(config, settings, sources, summarizer, now, args.out)
    except anthropic.APIStatusError as error:
        if error.status_code in PERMANENT_STATUS_CODES:
            logger.error(
                "erro permanente da API da Anthropic (HTTP %d): %s. Verifique a chave, os "
                "créditos e as permissões; repetir não resolve.",
                error.status_code,
                error.message,
            )
            return EXIT_PERMANENT_ERROR
        logger.error("erro temporário da API da Anthropic (HTTP %d): %s",
                     error.status_code, error.message)  # fmt: skip
        return EXIT_NOT_PUBLISHED
    except anthropic.APIConnectionError as error:
        logger.error("sem conexão com a API da Anthropic: %s", error)
        return EXIT_NOT_PUBLISHED
    except SummarizerError as error:
        logger.error("resumos não gerados: %s", error)
        return EXIT_NOT_PUBLISHED
    except ContractViolationError as error:
        logger.error("dia não publicado, conteúdo fora do contrato: %s", error)
        return EXIT_PERMANENT_ERROR
    return EXIT_PUBLISHED if report.published else EXIT_NOT_PUBLISHED
