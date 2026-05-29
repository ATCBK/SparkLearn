"""Tavily 联网搜索模块 —— 为 Chat 提供实时 web 搜索结果注入。"""

from __future__ import annotations

from typing import Any

from tavily import TavilyClient

from .config import settings


_client: TavilyClient | None = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        _client = TavilyClient(api_key=settings.tavily_api_key)
    return _client


def search_web(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """执行 Tavily 搜索并返回精简结果列表。"""
    if not settings.tavily_api_key:
        return []

    try:
        client = _get_client()
        response = client.search(query, max_results=max_results)
        results: list[dict[str, Any]] = []
        for item in response.get("results", [])[:max_results]:
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": item.get("content", ""),
                "score": item.get("score", 0.0),
            })
        return results
    except Exception:
        return []


def format_search_results(results: list[dict[str, Any]]) -> str:
    """将搜索结果格式化为注入 prompt 的文本。"""
    if not results:
        return ""

    lines = ["以下是联网搜索获取的最新信息，请基于这些信息回答用户问题："]
    for i, r in enumerate(results, 1):
        lines.append(f"\n[来源{i}] {r['title']}")
        lines.append(f"URL: {r['url']}")
        lines.append(f"内容: {r['content']}")
    lines.append("\n请综合以上搜索结果回答用户问题，并在回答中引用来源编号（如 [来源1]）。")
    return "\n".join(lines)
