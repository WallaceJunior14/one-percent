import hashlib

from one_percent.domain.models import ContentItem
from one_percent.domain.normalize import canonical_url

CARD_ID_HEX_LENGTH = 12


def card_id(item: ContentItem) -> str:
    """Id estável do card: o mesmo item, vindo de qualquer fonte, gera sempre o mesmo id."""
    digest = hashlib.sha256(canonical_url(item.url).encode()).hexdigest()
    return f"c_{digest[:CARD_ID_HEX_LENGTH]}"
