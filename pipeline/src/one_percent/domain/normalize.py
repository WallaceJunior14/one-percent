"""Normalização de URLs, datas e texto vindos das fontes."""

import re
from datetime import UTC, datetime
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_TRACKING_PARAMS = frozenset({"fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src"})
_BLOCK_TAGS = frozenset({"p", "br", "div", "li", "h1", "h2", "h3", "h4", "tr"})
_SKIPPED_TAGS = frozenset({"script", "style"})
_WHITESPACE = re.compile(r"\s+")


def canonical_url(url: str) -> str:
    """URL estável para comparar itens: https, host minúsculo, sem rastreamento nem fragmento."""
    parts = urlsplit(url.strip())
    query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in _TRACKING_PARAMS
    ]
    path = parts.path.rstrip("/") if parts.path not in ("", "/") else parts.path
    return urlunsplit(("https", parts.netloc.lower(), path, urlencode(query), ""))


def to_utc(moment: datetime) -> datetime:
    """Converte para UTC; datas sem fuso são tratadas como UTC (padrão de feeds RSS/Atom)."""
    if moment.tzinfo is None:
        return moment.replace(tzinfo=UTC)
    return moment.astimezone(UTC)


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skipping = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIPPED_TAGS:
            self._skipping += 1
        elif tag in _BLOCK_TAGS:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIPPED_TAGS:
            self._skipping = max(0, self._skipping - 1)
        elif tag in _BLOCK_TAGS:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self._skipping:
            self.parts.append(data)


def clean_text(raw: str) -> str:
    """Remove HTML (incluindo scripts), decodifica entidades e colapsa espaços."""
    extractor = _TextExtractor()
    extractor.feed(raw)
    extractor.close()
    return _WHITESPACE.sub(" ", "".join(extractor.parts)).strip()
