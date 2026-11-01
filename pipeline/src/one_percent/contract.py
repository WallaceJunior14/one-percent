"""Validação do JSON diário contra o contrato compartilhado com o app (ADR 0001)."""

import json
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "contracts"
SCHEMA_PATH = CONTRACTS_DIR / "daily-content.schema.json"
SAMPLE_DAY_PATH = CONTRACTS_DIR / "examples" / "sample-day.json"


class ContractViolationError(ValueError):
    """O conteúdo do dia não respeita `daily-content.schema.json`."""


@cache
def _validator() -> Draft202012Validator:
    with SCHEMA_PATH.open(encoding="utf-8") as file:
        schema = json.load(file)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_daily_content(content: dict[str, Any]) -> None:
    """Lança `ContractViolationError` listando cada violação com o caminho do campo."""
    errors = sorted(_validator().iter_errors(content), key=lambda error: error.json_path)
    if errors:
        details = "; ".join(
            f"{'/'.join(str(part) for part in error.absolute_path) or '<raiz>'}: {error.message}"
            for error in errors
        )
        raise ContractViolationError(f"{len(errors)} violação(ões) do contrato: {details}")
