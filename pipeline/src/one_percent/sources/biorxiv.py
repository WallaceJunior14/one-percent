"""Adapter da API do bioRxiv/medRxiv (JSON), filtrado por categoria e pela janela de artigos."""

import json
import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from one_percent.config import SourceConfig
from one_percent.domain.models import ContentItem
from one_percent.domain.normalize import clean_text
from one_percent.sources import NO_RETRY, RetryPolicy, SourceFetchError, fetch_bytes, new_item

logger = logging.getLogger(__name__)

API_URL = "https://api.biorxiv.org/details"
VENUE_BY_SERVER = {"biorxiv": "bioRxiv", "medrxiv": "medRxiv"}
MAX_PER_CATEGORY = 60
"""Teto por categoria. A API pagina do mais antigo para o mais novo, então lemos as últimas
páginas: as mais recentes da janela."""

Page = tuple[list[dict[str, Any]], int]


class BiorxivSource:
    def __init__(
        self,
        config: SourceConfig,
        client: httpx.Client,
        retry: RetryPolicy = NO_RETRY,
        *,
        window: timedelta,
    ) -> None:
        if config.server is None:
            raise ValueError(f"fonte bioRxiv '{config.id}' sem server")
        self._config = config
        self._server = config.server
        self._client = client
        self._retry = retry
        self._window = window

    @property
    def id(self) -> str:
        return self._config.id

    def fetch(self, now: datetime) -> list[ContentItem]:
        interval = f"{(now - self._window).date().isoformat()}/{now.date().isoformat()}"
        items: list[ContentItem] = []
        failures: list[SourceFetchError] = []
        categories = self._config.categories or ("",)
        for category in categories:
            params = {"category": category.replace(" ", "_")} if category else None
            try:
                items.extend(self._fetch_newest(interval, params))
            except SourceFetchError as error:
                logger.warning("%s (categoria %s); seguindo com as demais", error, category)
                failures.append(error)
        if len(failures) == len(categories):
            raise failures[0]
        return items

    def _fetch_page(self, interval: str, cursor: int, params: dict[str, str] | None) -> Page:
        url = f"{API_URL}/{self._server}/{interval}/{cursor}"
        try:
            body = fetch_bytes(self._client, self.id, url, params=params, retry=self._retry)
            page = json.loads(body)
            collection: list[dict[str, Any]] = page["collection"]
            # Sem resultados, a resposta não traz `total`.
            total = int(page["messages"][0].get("total", len(collection)))
        except (ValueError, KeyError, TypeError, IndexError) as error:
            raise SourceFetchError(f"{self.id}: resposta JSON inesperada") from error
        return collection, total

    def _fetch_newest(self, interval: str, params: dict[str, str] | None) -> list[ContentItem]:
        first_page, total = self._fetch_page(interval, 0, params)
        page_size = len(first_page)
        start = max(0, total - MAX_PER_CATEGORY)
        if page_size == 0 or start == 0 and total <= page_size:
            return self._parse(first_page)

        papers = first_page if start == 0 else []
        cursor = page_size if start == 0 else start
        while cursor < total:
            page, _ = self._fetch_page(interval, cursor, params)
            if not page:
                break
            papers.extend(page)
            cursor += len(page)
        return self._parse(papers)

    def _parse(self, collection: list[dict[str, Any]]) -> list[ContentItem]:
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
