"""外部信息流路由

提供外部信息流搜索、推荐、收藏功能。
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth import get_current_user
from ..content_filter import check_keyword, filter_results
from ..db import execute, fetch_all, fetch_one, now_iso
from ..info_stream import info_aggregator
from ..schemas import ok
from ..storage import read_json, write_json
from ..config import settings

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
    """搜索外部信息流（含敏感内容过滤）"""
    # 第一层：关键词黑名单检查
    blocked, reason = check_keyword(keyword)
    if blocked:
        return ok({"items": [], "total": 0, "page": page, "blocked": reason})

    items = await info_aggregator.search(keyword, source=source, page=page, page_size=page_size)

    # 第二层：结果内容过滤
    items = filter_results(items)

    return ok({"items": items, "total": len(items), "page": page})


@router.get("/recommendations")
async def get_recommendations(
    current_user: dict = Depends(get_current_user),
):
    """基于学习画像的智能推荐"""
    user_id = current_user["user_id"]

    # 从用户画像获取关键词
    profile = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    keywords = []
    if profile:
        import json
        weak_points = json.loads(profile["weak_points"] or "[]")
        current_stage = profile["current_stage"] or ""
        keywords = weak_points[:2]
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

    # 对推荐结果也做过滤
    items = filter_results(items)

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
        expires_at = (datetime.utcnow() + timedelta(hours=24)).isoformat() + "Z"
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
        # 取消收藏 — 同步从资源中心删除
        execute("DELETE FROM info_stream_bookmarks WHERE id = ?", (existing_bookmark["id"],))
        _remove_from_resource_center(req.source, req.external_id)
        return ok({"bookmarked": False})

    # 添加收藏 — 同步写入资源中心
    execute(
        "INSERT INTO info_stream_bookmarks (user_id, cache_id, created_at) VALUES (?, ?, ?)",
        (user_id, cache_id, ts),
    )
    _sync_to_resource_center(req)
    return ok({"bookmarked": True})


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


def _sync_to_resource_center(req: BookmarkReq):
    """将收藏的外部资源同步写入资源中心"""
    resource_id = f"ext-{req.source}-{req.external_id}"
    resources = read_json(settings.single_user_id, "resources_index.json", [])

    # 去重
    if any(r.get("id") == resource_id for r in resources):
        return

    resource = {
        "id": resource_id,
        "title": req.title,
        "type": "external",
        "status": "completed",
        "created_at": datetime.utcnow().strftime("%Y-%m-%d"),
        "content": f"# {req.title}\n\n{req.summary}",
        "source_url": req.url,
        "thumbnail": req.thumbnail,
        "author": req.author,
        "tags": req.tags,
        "extra": {"source": req.source, "external_id": req.external_id},
        "progress": 100,
    }
    resources.append(resource)
    write_json(settings.single_user_id, "resources_index.json", resources)


def _remove_from_resource_center(source: str, external_id: str):
    """从资源中心删除对应的外部资源"""
    resource_id = f"ext-{source}-{external_id}"
    resources = read_json(settings.single_user_id, "resources_index.json", [])
    resources = [r for r in resources if r.get("id") != resource_id]
    write_json(settings.single_user_id, "resources_index.json", resources)
