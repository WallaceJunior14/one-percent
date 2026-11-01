"""Utilitários de teste para adapters de fontes: HTTP falso e configs mínimas."""

from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx

from one_percent.config import SourceConfig

FIXTURES = Path(__file__).parent / "fixtures"

Handler = Callable[[httpx.Request], httpx.Response]


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def serve(body: bytes, status: int = 200) -> Handler:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, content=body)

    return handler


def mock_client(handler: Handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def source_config(**overrides: Any) -> SourceConfig:
    values: dict[str, Any] = {
        "id": "exemplo",
        "name": "Exemplo",
        "kind": "news",
        "type": "rss",
        "url": "https://example.com/feed",
        "area": "tech",
        "default_subarea": "tech.hardware",
        "weight": 1.2,
    }
    values.update(overrides)
    return SourceConfig.model_validate(values)
