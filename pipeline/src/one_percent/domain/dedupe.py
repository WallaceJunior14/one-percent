"""Deduplicação de itens que tratam do mesmo assunto (RF-004)."""

import re
import unicodedata
from dataclasses import dataclass, field, replace

from one_percent.domain.models import ContentItem
from one_percent.domain.normalize import canonical_url

TITLE_SIMILARITY_THRESHOLD = 0.6

_WORD = re.compile(r"\w+")
# Palavras de até 2 letras já são descartadas pelo tamanho; aqui ficam só as mais longas.
_STOPWORDS = frozenset(
    {
        "das", "dos", "nos", "nas", "uma", "uns", "umas", "para", "por", "com", "sem",
        "sobre", "que", "aos", "pela", "pelo", "pelas", "pelos", "mais", "menos", "ser",
        "foi", "sao", "the", "and", "for", "with", "from", "are", "was", "new",
    }
)  # fmt: skip


def _title_tokens(title: str) -> frozenset[str]:
    ascii_title = (
        unicodedata.normalize("NFKD", title.lower()).encode("ascii", "ignore").decode("ascii")
    )
    return frozenset(
        word
        for word in _WORD.findall(ascii_title)
        if len(word) > 2 and word not in _STOPWORDS and not word.isdigit()
    )


def _jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


@dataclass
class _Cluster:
    representative: ContentItem
    tokens: frozenset[str]
    urls: set[str] = field(default_factory=set)

    def matches(self, item: ContentItem, url: str, tokens: frozenset[str]) -> bool:
        if item.subarea_id != self.representative.subarea_id:
            return False
        return url in self.urls or _jaccard(tokens, self.tokens) >= TITLE_SIMILARITY_THRESHOLD


def dedupe(items: list[ContentItem]) -> list[ContentItem]:
    """Agrupa itens do mesmo assunto, mantém o da fonte de maior peso e registra a cobertura.

    A comparação por título só ocorre dentro da mesma subárea, para não fundir assuntos
    diferentes que compartilham palavras genéricas.
    """
    ordered = sorted(items, key=lambda item: (-item.source_weight, canonical_url(item.url)))
    clusters: list[_Cluster] = []
    for item in ordered:
        url = canonical_url(item.url)
        tokens = _title_tokens(item.title)
        cluster = next((c for c in clusters if c.matches(item, url, tokens)), None)
        if cluster is None:
            clusters.append(_Cluster(representative=item, tokens=tokens, urls={url}))
        else:
            cluster.urls.add(url)
    return [replace(c.representative, coverage=len(c.urls)) for c in clusters]
