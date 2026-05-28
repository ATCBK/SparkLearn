import json
import time
import uuid
from pathlib import Path
from typing import Any

import numpy as np

from .config import settings

VIDEO_ARTIFACT_ROOT = settings.data_dir / "artifacts" / "video"

# In-memory store: { memory_id: { video_id, title, segments, created_at } }
_memories: dict[str, dict[str, Any]] = {}

MEMORY_TTL_SEC = 600


def _load_timeline(video_id: str) -> dict[str, Any] | None:
    timeline_path = VIDEO_ARTIFACT_ROOT / video_id / "timeline.json"
    if not timeline_path.exists():
        return None
    return json.loads(timeline_path.read_text(encoding="utf-8"))


def _get_embedding(text: str) -> list[float] | None:
    model = getattr(settings, "video_ai_embedding_model", "") or ""
    if not model:
        return None

    import httpx

    base_url = settings.video_ai_base_url.rstrip("/")
    url = f"{base_url}/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.video_ai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "input": text,
    }
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]
    except Exception:
        return None


def _keyword_score(segment_text: str, query: str) -> float:
    """Simple Jaccard-like keyword overlap score as embedding fallback."""
    def tokenize(s: str) -> set[str]:
        # Basic Chinese + English tokenization by character bigrams and word boundaries
        chars = list(s.lower())
        bigrams = {chars[i] + chars[i + 1] for i in range(len(chars) - 1)}
        words = set(s.lower().split())
        return bigrams | words

    seg_tokens = tokenize(segment_text)
    query_tokens = tokenize(query)
    if not query_tokens:
        return 0.0
    intersection = seg_tokens & query_tokens
    union = seg_tokens | query_tokens
    return len(intersection) / len(union) if union else 0.0


def load_memory(video_id: str, user_id: str = "single_user") -> dict[str, Any]:
    timeline = _load_timeline(video_id)
    if not timeline:
        raise MemoryNotFoundError(f"视频 {video_id} 的脚本内容不存在")

    segments = timeline.get("segments", [])
    if not segments:
        raise NoScriptError(f"视频 {video_id} 没有脚本分段")

    title = timeline.get("title", video_id)
    memory_id = f"mem_{video_id}_{uuid.uuid4().hex[:6]}"

    enriched = []
    for seg in segments:
        narration = str(seg.get("narration") or seg.get("title", ""))
        embedding = _get_embedding(narration)
        enriched.append({
            "segment_id": str(seg.get("segment_id", "")),
            "title": str(seg.get("title", "")),
            "narration": narration,
            "start_ms": int(seg.get("start_ms") or 0),
            "end_ms": int(seg.get("end_ms") or 0),
            "embedding": embedding,
        })

    _memories[memory_id] = {
        "video_id": video_id,
        "title": title,
        "segments": enriched,
        "created_at": time.time(),
    }

    greeting = f"你好！我已经学习完了《{title}》这个视频，一共{len(segments)}个知识点。有什么想深入了解的，尽管问我！"

    return {
        "memory_id": memory_id,
        "video_title": title,
        "segment_count": len(segments),
        "greeting": greeting,
    }


def search(memory_id: str, query: str, top_k: int = 3) -> list[dict[str, Any]]:
    memory = _get_valid_memory(memory_id)
    segments = memory["segments"]

    query_embedding = _get_embedding(query)

    if query_embedding is not None:
        # Cosine similarity with embeddings
        query_vec = np.array(query_embedding)
        scored = []
        for seg in segments:
            emb = seg.get("embedding")
            if emb is None:
                continue
            seg_vec = np.array(emb)
            similarity = float(np.dot(query_vec, seg_vec) / (
                np.linalg.norm(query_vec) * np.linalg.norm(seg_vec) + 1e-8
            ))
            scored.append((similarity, seg))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {"segment_id": s["segment_id"], "title": s["title"], "narration": s["narration"], "score": round(score, 4)}
            for score, s in scored[:top_k]
        ]

    # Keyword fallback
    scored = []
    for seg in segments:
        text = f"{seg['title']} {seg['narration']}"
        score = _keyword_score(text, query)
        scored.append((score, seg))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {"segment_id": s["segment_id"], "title": s["title"], "narration": s["narration"], "score": round(score, 4)}
        for score, s in scored[:top_k] if score > 0.01
    ]


def get_memory(memory_id: str) -> dict[str, Any] | None:
    memory = _memories.get(memory_id)
    if not memory:
        return None
    if time.time() - memory["created_at"] > MEMORY_TTL_SEC:
        del _memories[memory_id]
        return None
    return {
        "memory_id": memory_id,
        "video_id": memory["video_id"],
        "video_title": memory["title"],
        "segment_count": len(memory["segments"]),
        "created_at": memory["created_at"],
        "ttl_sec": MEMORY_TTL_SEC,
    }


def clear_memory(memory_id: str) -> bool:
    if memory_id in _memories:
        del _memories[memory_id]
        return True
    return False


def _get_valid_memory(memory_id: str) -> dict[str, Any]:
    memory = _memories.get(memory_id)
    if not memory:
        raise MemoryNotFoundError(f"记忆 {memory_id} 不存在")
    if time.time() - memory["created_at"] > MEMORY_TTL_SEC:
        del _memories[memory_id]
        raise MemoryNotFoundError(f"记忆 {memory_id} 已过期，请重新选择视频")
    return memory


class MemoryNotFoundError(Exception):
    pass


class NoScriptError(Exception):
    pass
