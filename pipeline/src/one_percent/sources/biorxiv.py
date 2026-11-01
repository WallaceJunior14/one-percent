"""Adapter da API do bioRxiv/medRxiv (JSON), filtrado por categoria e janela de 7 dias."""

import json
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from one_percent.config import SourceConfig
from one_percent.domain.models import ContentItem
from one_percent.domain.normalize import clean_text
from one_percent.sources import SourceFetchError, fetch_bytes, new_item

API_URL = "https://api.biorxiv.org/details"
LOOKBACK = timedelta(days=7)
VENUE_BY_SERVER = {"biorxiv": "bioRxiv", "medrxiv": "medRxiv"}


class BiorxivSource:
    def __init__(self, config: SourceConfig, client: httpx.Client) -> None:
        if config.server is None:
            raise ValueError(f"fonte bioRxiv '{config.id}' sem server")
        self._config = config
        self._server = config.server
        self._client = client

    @property
    def id(self) -> str:
        return self._config.id

    def fetch(self, now: datetime) -> list[ContentItem]:
        interval = f"{(now - LOOKBACK).date().isoformat()}/{now.date().isoformat()}"
        items: list[ContentItem] = []
        for category in self._config.categories or ("",):
            params = {"category": category.replace(" ", "_")} if category else None
            body = fetch_bytes(
                self._client, self.id, f"{API_URL}/{self._server}/{interval}/0", params=params
            )
            items.extend(self._parse(body))
        return items

    def _parse(self, body: bytes) -> list[ContentItem]:
        try:
            collection: list[dict[str, Any]] = json.loads(body)["collection"]
        except (ValueError, KeyError, TypeError) as error:
            raise SourceFetchError(f"{self.id}: resposta JSON inesperada") from error
        items = []
        for paper in collection:
            try:
                items.append(self._to_item(paper))
            except (KeyError, ValueError):
                continue
        return items

    def _to_item(self, paper: dict[str, Any]) -> ContentItem:
        url = f"https://www.{self._server}.org/content/{paper['doi']}v{paper['version']}"
        published = date.fromisoformat(paper["date"])
        return new_item(
            self._config,
            title=clean_text(paper["title"]),
            url=url,
            published_at=datetime(published.year, published.month, published.day, tzinfo=UTC),
            summary=clean_text(paper.get("abstract", "")),
            authors=tuple(a.strip() for a in paper.get("authors", "").split(";") if a.strip()),
            venue=VENUE_BY_SERVER[self._server],
            is_preprint=paper.get("published", "NA") == "NA",
            pdf_url=f"{url}.full.pdf",
        )
