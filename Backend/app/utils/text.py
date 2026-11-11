"""Text helpers: chunking for the knowledge base, token estimates, slugs."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from typing import Callable

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?।])\s+")
_WHITESPACE = re.compile(r"\s+")
_WORD = re.compile(r"[a-z0-9\u0900-\u0DFF]+", re.IGNORECASE)

STOPWORDS = frozenset(
    """
    a an and are as at be by for from has have how i if in into is it its of on or
    that the their there these this to was were what when where which who will with
    you your kya hai ka ki ke ko me mein aur par se
    """.split()
)


def collapse_whitespace(text: str) -> str:
    return _WHITESPACE.sub(" ", text or "").strip()


def estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 characters per token) without a tokenizer."""
    return max(1, len(collapse_whitespace(text)) // 4) if text else 0


def chunk_text(text: str, *, max_chars: int = 1200, overlap_chars: int = 150) -> list[str]:
    """Split text into overlapping chunks suitable for embedding/retrieval.

    Sentence boundaries are preferred; oversized sentences are hard-split so a
    single chunk never exceeds ``max_chars`` by much.
    """
    cleaned = collapse_whitespace(text)
    if not cleaned:
        return []

    sentences = _SENTENCE_SPLIT.split(cleaned)
    chunks: list[str] = []
    buffer = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        while len(sentence) > max_chars:
            head, sentence = sentence[:max_chars], sentence[max_chars:]
            if buffer:
                chunks.append(buffer)
                buffer = ""
            chunks.append(head.strip())

        if not buffer:
            buffer = sentence
        elif len(buffer) + len(sentence) + 1 <= max_chars:
            buffer = f"{buffer} {sentence}"
        else:
            chunks.append(buffer)
            tail = buffer[-overlap_chars:] if overlap_chars else ""
            buffer = f"{tail} {sentence}".strip()

    if buffer:
        chunks.append(buffer)
    return [chunk for chunk in chunks if chunk]


def slugify(value: str, *, fallback: str = "org") -> str:
    """Lowercase, ASCII-only, dash separated slug."""
    normalised = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalised).strip("-").lower()
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:60] or fallback


def unique_slug(base: str, *, exists: Callable[[str], bool]) -> str:
    """Return a slug that is not taken yet, appending a numeric suffix if needed.

    ``exists`` is a predicate answering "is this slug already used?".
    """
    slug = slugify(base)
    candidate = slug
    counter = 2
    while exists(candidate):
        candidate = f"{slug}-{counter}"
        counter += 1
    return candidate


def keywords(text: str) -> set[str]:
    """Extract lowercased content words, dropping stopwords."""
    return {word.lower() for word in _WORD.findall(text or "") if word.lower() not in STOPWORDS}


def lexical_score(query: str, document: str) -> float:
    """A cheap TF-style relevance score in the range 0..1.

    Used when no embedding provider is configured, so the knowledge base still
    returns useful hits with zero external calls.
    """
    query_terms = keywords(query)
    if not query_terms:
        return 0.0
    document_terms = keywords(document)
    if not document_terms:
        return 0.0
    matched = query_terms & document_terms
    if not matched:
        return 0.0
    coverage = len(matched) / len(query_terms)
    density = len(matched) / (len(document_terms) ** 0.5)
    return round(min(1.0, coverage * 0.75 + min(density, 0.25)), 4)


def short_hash(value: str, *, length: int = 12) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def truncate(value: str | None, limit: int = 240, *, suffix: str = "…") -> str | None:
    if value is None:
        return None
    text = collapse_whitespace(value)
    if len(text) <= limit:
        return text
    return text[: limit - len(suffix)].rstrip() + suffix
