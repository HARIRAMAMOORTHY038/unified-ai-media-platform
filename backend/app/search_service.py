
"""Multilingual semantic search over a user's saved caption cues.

Uses FastEmbed's multilingual MPNet model on CPU.
Caption embeddings are cached in memory.
Search results are restricted to the signed-in user's videos.

Captions from different languages can both appear for the same moment.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

import numpy as np
from sqlalchemy.orm import Session, selectinload

from .models import CaptionTrack, Video

logger = logging.getLogger(__name__)

MODEL_NAME = (
    "sentence-transformers/"
    "paraphrase-multilingual-mpnet-base-v2"
)

# Keep the current threshold for initial testing.
# Tune it only after comparing relevant and irrelevant results.
MIN_SIMILARITY = 0.30

_MAX_CACHE_ITEMS = 12000

_model: Any = None

# Cache key -> (original caption text, normalized embedding vector)
_embedding_cache: Dict[str, Tuple[str, np.ndarray]] = {}


def _get_model():
    """Load the multilingual embedding model once per backend process."""
    global _model

    if _model is None:
        from fastembed import TextEmbedding

        logger.info("Loading semantic search model: %s", MODEL_NAME)
        _model = TextEmbedding(model_name=MODEL_NAME)
        logger.info("Semantic search model loaded")

    return _model


def _normalized(vector: Any) -> np.ndarray:
    """Convert an embedding to a normalized float32 vector."""
    arr = np.asarray(vector, dtype=np.float32)
    norm = float(np.linalg.norm(arr))

    if norm > 0:
        arr = arr / norm

    return arr


def _cache_key(cue_id: int, text: str) -> str:
    """Create a cache key that changes when caption text changes."""
    return f"{cue_id}:{hash(text)}"


def search_user_captions(
    db: Session,
    user_id: int,
    query_text: str,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Search caption meaning across languages for one user's videos."""

    cleaned_query = " ".join((query_text or "").split())

    if not cleaned_query:
        return []

    # Retrieve only videos owned by the signed-in user.
    videos = (
        db.query(Video)
        .filter(Video.user_id == user_id)
        .options(
            selectinload(Video.caption_tracks).selectinload(
                CaptionTrack.cues
            )
        )
        .all()
    )

    candidates: List[Dict[str, Any]] = []

    for video in videos:
        for track in video.caption_tracks:
            for cue in track.cues:
                text = (cue.text or "").strip()

                if not text:
                    continue

                candidates.append(
                    {
                        "video": video,
                        "track": track,
                        "cue": cue,
                        "text": text,
                        "cache_key": _cache_key(cue.id, text),
                    }
                )

    if not candidates:
        return []

    model = _get_model()

    # MPNet supports multilingual text without E5-style prefixes.
    query_vector = _normalized(
        next(model.query_embed(cleaned_query))
    )

    missing: List[Dict[str, Any]] = []

    # Reuse cached embeddings when caption text is unchanged.
    for item in candidates:
        cached = _embedding_cache.get(item["cache_key"])

        if cached is not None and cached[0] == item["text"]:
            item["vector"] = cached[1]
        else:
            missing.append(item)

    if missing:
        passage_texts = [item["text"] for item in missing]

        for item, vector in zip(
            missing,
            model.embed(passage_texts),
        ):
            normalized_vector = _normalized(vector)
            item["vector"] = normalized_vector

            _embedding_cache[item["cache_key"]] = (
                item["text"],
                normalized_vector,
            )

        # Prevent the in-memory cache from growing indefinitely.
        while len(_embedding_cache) > _MAX_CACHE_ITEMS:
            oldest_key = next(iter(_embedding_cache))
            _embedding_cache.pop(oldest_key)

    # Compare normalized embeddings using cosine similarity.
    for item in candidates:
        item["score"] = float(
            np.dot(query_vector, item["vector"])
        )

    # Deduplicate nearby cues within the SAME language track only.
    # This allows equivalent English and Tamil captions to both appear.
    best_by_moment: Dict[
        Tuple[int, str, int], Dict[str, Any]
    ] = {}

    for item in candidates:
        cue = item["cue"]
        track = item["track"]

        language = str(
            getattr(track, "language", "") or "unknown"
        ).lower()

        moment_key = (
            item["video"].id,
            language,
            int(round(float(cue.start_time) * 2)),
        )

        existing = best_by_moment.get(moment_key)

        if existing is None or item["score"] > existing["score"]:
            best_by_moment[moment_key] = item

    # Filter weak matches and rank the remaining results.
    ranked = sorted(
        (
            item
            for item in best_by_moment.values()
            if item["score"] >= MIN_SIMILARITY
        ),
        key=lambda item: item["score"],
        reverse=True,
    )

    safe_limit = max(1, min(int(limit), 50))

    return ranked[:safe_limit]
