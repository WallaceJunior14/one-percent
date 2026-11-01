"""Adapter do Hugging Face Daily Papers: artigos do arXiv em destaque, com upvotes."""

import json
from datetime import datetime
from typing import Any

import httpx

from one_percent.config import SourceConfig
from one_percent.domain.models import ContentItem
from one_percent.domain.normalize import clean_text, to_utc
from one_percent.sources import SourceFetchError, fetch_bytes, new_item

API_URL = "https://huggingface.co/api/daily_papers"
LIMIT = 50


class HfDailyPapersSource:
    def __init__(self, config: SourceConfig, client: httpx.Client) -> None:
        self._config = config
        self._client = client

    @property
    def id(self) -> str:
        return self._config.id

    def fetch(self, now: datetime) -> list[ContentItem]:
        body = fetch_bytes(self._client, self.id, API_URL, params={"limit": LIMIT})
        try:
            entries: list[dict[str, Any]] = json.loads(body)
        except ValueError as error:
            raise SourceFetchError(f"{self.id}: resposta JSON inesperada") from error
        items = []
        for entry in entries:
            try:
                items.append(self._to_item(entry["paper"]))
            except (KeyError, ValueError, TypeError):
                continue
        return items

    def _to_item(self, paper: dict[str, Any]) -> ContentItem:
        arxiv_id = paper["id"]
        return new_item(
            self._config,
            title=clean_text(paper["title"]),
            url=f"https://arxiv.org/abs/{arxiv_id}",
            published_at=to_utc(datetime.fromisoformat(paper["publishedAt"])),
            summary=clean_text(paper.get("summary", "")),
            authors=tuple(a["name"] for a in paper.get("authors", []) if a.get("name")),
            venue="arXiv",
            is_preprint=True,
            pdf_url=f"https://arxiv.org/pdf/{arxiv_id}",
            popularity=int(paper.get("upvotes", 0)),
        )
