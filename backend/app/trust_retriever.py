from __future__ import annotations

import json
from typing import Any

from .config import settings
from .db import fetch_all
from .routes.knowledge import retrieve_knowledge_context_async
from .storage import read_json
from .trust_schemas import EvidenceBundle, EvidenceItem, RoutedQuery, TrustAnswerRequest


async def retrieve_evidence(req: TrustAnswerRequest, routed: RoutedQuery) -> EvidenceBundle:
    bundle = EvidenceBundle()
    if routed.need_knowledge:
        knowledge_ids = req.knowledge_file_ids or _list_indexed_knowledge_file_ids(limit=30)
        _ctx, sources = await retrieve_knowledge_context_async(knowledge_ids, query=req.query, max_chars=5000, top_k=8)
        for s in sources:
            file_name = str(s.get("filename") or "knowledge")
            idx = int(s.get("chunk_index") or 0) + 1
            bundle.knowledge.append(
                EvidenceItem(
                    id=f"knowledge:{file_name}:{idx}",
                    source_type="knowledge",
                    source_id=file_name,
                    title=f"{file_name} · 第{idx}片段",
                    snippet=str(s.get("snippet") or ""),
                    score=float(s.get("score") or 0.0),
                    metadata={"chunk_index": int(s.get("chunk_index") or 0)},
                )
            )

    if routed.need_profile and req.use_profile:
        profile = read_json(settings.single_user_id, "profile_snapshot.json", {})
        if profile:
            bundle.profile.append(
                EvidenceItem(
                    id=f"profile:{settings.single_user_id}",
                    source_type="profile",
                    source_id=settings.single_user_id,
                    title="学习画像",
                    snippet=_profile_snippet(profile),
                    score=0.72,
                    metadata={},
                )
            )

    if routed.need_rules:
        bundle.rules.append(
            EvidenceItem(
                id="rules:trust_baseline",
                source_type="rules",
                source_id="trust_baseline",
                title="可信回答规则",
                snippet="先检索再回答；证据不足时降级表达；避免强确定性结论。",
                score=1.0,
                metadata={},
            )
        )

    for s in req.user_file_sources or []:
        filename = str(s.get("filename") or "user_file")
        idx = int(s.get("chunk_index") or 0) + 1
        bundle.files.append(
            EvidenceItem(
                id=f"file:{filename}:{idx}",
                source_type="file",
                source_id=filename,
                title=f"{filename} · 第{idx}片段",
                snippet=str(s.get("snippet") or ""),
                score=float(s.get("score") or 0.0),
                metadata={"chunk_index": int(s.get("chunk_index") or 0)},
            )
        )

    return bundle


def _list_indexed_knowledge_file_ids(limit: int = 20) -> list[int]:
    rows = fetch_all(
        """
        SELECT id
        FROM knowledge_files
        WHERE user_id = ? AND status = 'indexed'
        ORDER BY updated_at DESC
        LIMIT ?
        """,
        (settings.single_user_id, max(1, limit)),
    )
    return [int(r["id"]) for r in rows]


def _profile_snippet(profile: dict[str, Any]) -> str:
    weak = profile.get("weak_points", [])
    goal = profile.get("goal", [])
    stage = profile.get("current_stage", "")
    return (
        f"目标: {json.dumps(goal, ensure_ascii=False)}；"
        f"薄弱点: {json.dumps(weak, ensure_ascii=False)}；"
        f"当前阶段: {stage or '未知'}"
    )
