"""外部信息流路由

提供外部信息流搜索、推荐、收藏功能。
"""

import re
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth import get_current_user
from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..info_stream import info_aggregator
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json

router = APIRouter(prefix="/api/info-stream", tags=["info-stream"])


@router.get("/sources")
async def get_sources():
    """获取可用数据源列表"""
    return ok([
        {"id": "all", "name": "全部", "icon": "globe"},
        {"id": "bilibili", "name": "B站视频", "icon": "play-circle"},
        {"id": "github", "name": "GitHub", "icon": "github"},
        {"id": "arxiv", "name": "学术论文", "icon": "file-text"},
        {"id": "juejin", "name": "掘金", "icon": "pen-tool"},
    ])


@router.get("/search")
async def search(
    keyword: str = Query(..., min_length=1, max_length=100),
    source: str = Query(default="all"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=30),
):
    """搜索外部信息流"""
    items = await info_aggregator.search(keyword, source=source, page=page, page_size=page_size)
    return ok({"items": items, "total": len(items), "page": page})


@router.get("/recommendations")
async def get_recommendations(
    current_user: dict = Depends(get_current_user),
):
    """基于学习画像的智能推荐"""
    user_id = current_user["user_id"]

    # 从用户画像获取关键词
    profile = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    student = fetch_one("SELECT major FROM students WHERE user_id = ?", (user_id,))
    keywords = []
    major = str(student["major"]).strip() if student and student["major"] else ""
    if major:
        keywords.append(major)
    if profile:
        import json
        weak_points = json.loads(profile["weak_points"] or "[]")
        current_stage = profile["current_stage"] or ""
        keywords.extend(weak_points[:2])
        if current_stage:
            keywords.append(current_stage)

    if not keywords:
        keywords = ["Python", "编程入门"]

    # 从各源搜索推荐
    import asyncio
    tasks = []
    for kw in keywords[:2]:
        tasks.append(info_aggregator.search(kw, source="all", page=1, page_size=5))
    results = await asyncio.gather(*tasks, return_exceptions=True)

    items = []
    for result in results:
        if isinstance(result, list):
            items.extend(result)

    return ok({"items": items[:10], "keywords": keywords})


class BookmarkReq(BaseModel):
    source: str
    external_id: str
    title: str
    url: str
    summary: str = ""
    thumbnail: str = ""
    author: str = ""
    tags: list[str] = []


class InfoImportResourceReq(BaseModel):
    source: str
    external_id: str
    title: str
    url: str
    summary: str = ""
    thumbnail: str = ""
    author: str = ""
    tags: list[str] = []
    extra_data: dict[str, Any] = {}


def _safe_resource_key(value: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower()
    return clean[:80] or "item"


def _upsert_info_resource(user_id: str, resource: dict[str, Any]) -> dict[str, Any]:
    resources = read_json(user_id, "resources_index.json", [])
    if not isinstance(resources, list):
        resources = []

    for idx, item in enumerate(resources):
        if str(item.get("id", "")) == str(resource.get("id", "")):
            resources[idx] = {**item, **resource}
            write_json(user_id, "resources_index.json", resources)
            return resources[idx]

    resources.insert(0, resource)
    write_json(user_id, "resources_index.json", resources)
    return resource


def _info_resource(req: InfoImportResourceReq) -> dict[str, Any]:
    source = req.source.strip().lower()
    external_id = req.external_id.strip()
    tags = [str(tag).strip() for tag in req.tags if str(tag).strip()]
    title = req.title.strip() or "学习发现资源"
    summary = req.summary.strip()
    author = req.author.strip()
    return {
        "id": f"info-{_safe_resource_key(source)}-{_safe_resource_key(external_id or title)}",
        "title": f"学习发现：{title[:48]}",
        "type": "discovery",
        "status": "completed",
        "created_at": now_iso()[:10],
        "content": (
            f"# {title}\n\n"
            f"{summary or '该内容来自学习发现，可作为拓展学习资料。'}\n\n"
            f"---\n来源：学习发现 / {source or 'external'}\n"
            f"作者：{author or '未知'}\n"
            f"标签：{'、'.join(tags) if tags else '无'}\n"
            f"原文链接：{req.url}\n"
        ),
        "source_url": req.url,
        "source_type": "info_stream",
        "source_id": external_id,
        "info_source": source,
        "thumbnail": req.thumbnail,
        "author": author,
        "tags": tags,
        "extra_data": req.extra_data,
        "progress": 0,
    }


@router.post("/bookmark")
async def bookmark(
    req: BookmarkReq,
    current_user: dict = Depends(get_current_user),
):
    """收藏外部资源"""
    user_id = current_user["user_id"]
    ts = now_iso()

    # 先缓存到 info_stream_cache
    existing = fetch_one(
        "SELECT id FROM info_stream_cache WHERE source = ? AND external_id = ?",
        (req.source, req.external_id),
    )

    if existing:
        cache_id = existing["id"]
    else:
        expires_at = (datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=24)).isoformat() + "Z"
        execute(
            """
            INSERT INTO info_stream_cache (source, external_id, title, summary, url, thumbnail, author, tags, cached_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (req.source, req.external_id, req.title, req.summary, req.url,
             req.thumbnail, req.author, str(req.tags), ts, expires_at),
        )
        cache_id = fetch_one(
            "SELECT id FROM info_stream_cache WHERE source = ? AND external_id = ?",
            (req.source, req.external_id),
        )["id"]

    # 检查是否已收藏
    existing_bookmark = fetch_one(
        "SELECT id FROM info_stream_bookmarks WHERE user_id = ? AND cache_id = ?",
        (user_id, cache_id),
    )
    if existing_bookmark:
        # 取消收藏
        execute("DELETE FROM info_stream_bookmarks WHERE id = ?", (existing_bookmark["id"],))
        return ok({"bookmarked": False})

    # 添加收藏
    execute(
        "INSERT INTO info_stream_bookmarks (user_id, cache_id, created_at) VALUES (?, ?, ?)",
        (user_id, cache_id, ts),
    )
    return ok({"bookmarked": True})


@router.post("/import-resource")
async def import_resource(
    req: InfoImportResourceReq,
    current_user: dict = Depends(get_current_user),
):
    """将学习发现内容加入我的资源库"""
    if not req.title.strip() or not req.url.strip():
        raise HTTPException(status_code=400, detail="title and url are required")

    user_id = current_user["user_id"]
    resource = _upsert_info_resource(user_id, _info_resource(req))
    append_jsonl(
        user_id,
        "resource_usage.jsonl",
        {
            "type": "info_stream_imported",
            "resource_id": resource["id"],
            "source": req.source,
            "external_id": req.external_id,
            "user_id": user_id,
        },
    )
    return ok({"resource": resource})


@router.get("/bookmarks")
async def get_bookmarks(
    current_user: dict = Depends(get_current_user),
):
    """获取我的收藏"""
    user_id = current_user["user_id"]
    rows = fetch_all(
        """
        SELECT c.id, c.source, c.external_id, c.title, c.summary, c.url,
               c.thumbnail, c.author, c.tags, b.created_at as bookmarked_at
        FROM info_stream_bookmarks b
        JOIN info_stream_cache c ON b.cache_id = c.id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
        """,
        (user_id,),
    )
    items = [dict(r) for r in rows]
    return ok(items)
