"""Encurta textos do LLM que passaram do limite, em vez de descartar o card inteiro."""

import re
from collections.abc import Mapping
from typing import Any

ELLIPSIS = "…"
_SENTENCE_END = re.compile(r"[.!?…](?=\s)")
_TRAILING_PUNCTUATION = " ,;:-–—"


def shorten(text: str, limit: int) -> str:
    """Corta no último fim de frase que caiba; senão, no último espaço, com reticências."""
    text = text.strip()
    if len(text) <= limit:
        return text

    # Um ponto exatamente no limite conta: o espaço depois dele fica fora do texto.
    sentence_ends = [m.end() for m in _SENTENCE_END.finditer(text, 0, limit + 1)]
    if sentence_ends:
        return text[: sentence_ends[-1]]

    room = limit - len(ELLIPSIS)
    space = text.rfind(" ", 0, room + 1)
    head = text[:space].rstrip(_TRAILING_PUNCTUATION) if space > 0 else ""
    return (head or text[:room]) + ELLIPSIS


def shorten_fields(
    data: Mapping[str, Any], limits: Mapping[str, int], prefix: str = ""
) -> tuple[dict[str, Any], list[str]]:
    """Cópia de `data` com cada texto dentro do limite do seu caminho (ex.: `quiz.question`).

    Listas de textos usam o limite do caminho da lista. Devolve também os caminhos encurtados.
    """
    result: dict[str, Any] = {}
    shortened: list[str] = []
    for key, value in data.items():
        path = f"{prefix}{key}"
        limit = limits.get(path)
        if isinstance(value, Mapping):
            result[key], inner = shorten_fields(value, limits, f"{path}.")
            shortened += inner
        elif limit is not None and isinstance(value, str):
            result[key] = shorten(value, limit)
            if result[key] != value.strip():
                shortened.append(path)
        elif limit is not None and isinstance(value, list):
            result[key] = [shorten(v, limit) if isinstance(v, str) else v for v in value]
            if any(isinstance(v, str) and len(v.strip()) > limit for v in value):
                shortened.append(path)
        else:
            result[key] = value
    return result, shortened
