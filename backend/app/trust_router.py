from __future__ import annotations

from .trust_schemas import RoutedQuery


def route_query(query: str, mode: str = "knowledge_qa") -> RoutedQuery:
    text = (query or "").strip()
    lower = text.lower()

    asks_personal = any(k in text for k in ["我适合", "根据我的情况", "给我学习建议", "学习路径"])
    asks_file = any(k in text for k in ["这份资料", "这个文档", "上面内容", "讲义", "截图"])
    asks_fact = any(k in text for k in ["什么是", "原理", "定义", "步骤", "为什么"])

    query_type = "open_ended"
    if asks_file:
        query_type = "resource_based"
    elif asks_personal:
        query_type = "personalized_guidance"
    elif asks_fact or mode in {"knowledge_qa", "step_hint"}:
        query_type = "knowledge_qa"

    if "必须" in text or "一定" in text or "唯一" in text:
        risk = "high"
    elif len(text) > 120 or "?" in lower or "？" in text:
        risk = "medium"
    else:
        risk = "low"

    return RoutedQuery(
        query_type=query_type,
        risk_level=risk,
        need_knowledge=query_type in {"knowledge_qa", "resource_based", "personalized_guidance"},
        need_profile=query_type == "personalized_guidance",
        need_memory=True,
        need_rules=True,
        need_user_files=asks_file or query_type == "resource_based",
    )
