"""Validação do JSON diário contra o contrato compartilhado com o app (ADR 0001)."""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "contracts"
SCHEMA_PATH = CONTRACTS_DIR / "daily-content.schema.json"
SAMPLE_DAY_PATH = CONTRACTS_DIR / "examples" / "sample-day.json"


class ContractViolationError(ValueError):
    """O conteúdo do dia não respeita `daily-content.schema.json`."""


@dataclass(frozen=True, slots=True)
class TextLimits:
    """Tamanho máximo, em caracteres, de cada tipo de texto do card."""

    short: int
    medium: int
    long: int
    original_title: int


@cache
def _schema() -> dict[str, Any]:
    with SCHEMA_PATH.open(encoding="utf-8") as file:
        schema: dict[str, Any] = json.load(file)
    return schema


@cache
def _validator() -> Draft202012Validator:
    schema = _schema()
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


@cache
def text_limits() -> TextLimits:
    """Os `maxLength` do contrato: a única definição dos limites de texto."""
    defs = _schema()["$defs"]
    return TextLimits(
        short=defs["shortText"]["maxLength"],
        medium=defs["mediumText"]["maxLength"],
        long=defs["longText"]["maxLength"],
        original_title=defs["card"]["properties"]["originalTitle"]["maxLength"],
    )


def validate_daily_content(content: dict[str, Any]) -> None:
    """Lança `ContractViolationError` listando cada violação com o caminho do campo."""
    errors = sorted(_validator().iter_errors(content), key=lambda error: error.json_path)
    if errors:
        details = "; ".join(
            f"{'/'.join(str(part) for part in error.absolute_path) or '<raiz>'}: {error.message}"
            for error in errors
        )
        raise ContractViolationError(f"{len(errors)} violação(ões) do contrato: {details}")
