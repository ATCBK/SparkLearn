"""资料分享链接路由

提供学习资料的分享链接生成、访问、管理功能。
"""

import json
import random
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import get_current_user, get_optional_user
from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..schemas import ok

router = APIRouter(prefix="/api/sharing", tags=["sharing"])


def _generate_share_code(length: int = 8) -> str:
    """生成随机分享码"""
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


class CreateShareLinkReq(BaseModel):
    resource_type: str = Field(description="资源类型: resource / attachment / material")
    resource_id: str = Field(description="资源 ID")
    title: str = Field(default="", max_length=200)
    access_type: str = Field(default="public")  # public / password / specific
    password: str = Field(default="", max_length=64)
    allowed_user_ids: list[str] = Field(default=[])
    max_views: int | None = None
    expire_hours: int | None = None


class AccessShareReq(BaseModel):
    password: str = Field(default="")


@router.post("/links")
async def create_share_link(
    req: CreateShareLinkReq,
    current_user: dict = Depends(get_current_user),
):
    """创建分享链接"""
    user_id = current_user["user_id"]
    share_code = _generate_share_code()
    ts = now_iso()

    # 确保 share_code 唯一
    while fetch_one("SELECT id FROM share_links WHERE share_code = ?", (share_code,)):
        share_code = _generate_share_code()

    expires_at = None
    if req.expire_hours:
        expires_at = (datetime.utcnow() + timedelta(hours=req.expire_hours)).isoformat() + "Z"

    execute(
        """
        INSERT INTO share_links (
            share_code, creator_id, resource_type, resource_id, title,
            access_type, password, allowed_user_ids, max_views, view_count,
            expires_at, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'active')
        """,
        (
            share_code,
            user_id,
            req.resource_type,
            req.resource_id,
            req.title,
            req.access_type,
            req.password,
            json.dumps(req.allowed_user_ids, ensure_ascii=False),
            req.max_views,
            expires_at,
            ts,
        ),
    )

    return ok({
        "share_code": share_code,
        "share_url": f"/share/{share_code}",
        "access_type": req.access_type,
        "expires_at": expires_at,
    })


@router.get("/links")
async def list_my_share_links(
    current_user: dict = Depends(get_current_user),
):
    """获取我的分享列表"""
    user_id = current_user["user_id"]
    rows = fetch_all(
        """
        SELECT id, share_code, resource_type, resource_id, title,
               access_type, max_views, view_count, expires_at, created_at, status
        FROM share_links
        WHERE creator_id = ?
        ORDER BY created_at DESC
        """,
        (user_id,),
    )
    items = [dict(r) for r in rows]
    return ok(items)


@router.delete("/links/{link_id}")
async def delete_share_link(
    link_id: int,
    current_user: dict = Depends(get_current_user),
):
    """取消分享"""
    user_id = current_user["user_id"]
    link = fetch_one(
        "SELECT id, creator_id FROM share_links WHERE id = ?",
        (link_id,),
    )
    if not link:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    if link["creator_id"] != user_id:
        raise HTTPException(status_code=403, detail="无权操作")

    execute("UPDATE share_links SET status = 'revoked' WHERE id = ?", (link_id,))
    return ok({"message": "已取消分享"})


@router.get("/{share_code}")
async def get_share_info(share_code: str):
    """获取分享信息（无需登录）"""
    link = fetch_one(
        """
        SELECT id, share_code, creator_id, resource_type, resource_id, title,
               access_type, max_views, view_count, expires_at, created_at, status
        FROM share_links
        WHERE share_code = ?
        """,
        (share_code,),
    )

    if not link:
        raise HTTPException(status_code=404, detail="分享链接不存在")

    link_dict = dict(link)

    # 检查状态
    if link_dict["status"] != "active":
        raise HTTPException(status_code=410, detail="分享链接已失效")

    # 检查过期
    if link_dict["expires_at"]:
        expires_at = datetime.fromisoformat(link_dict["expires_at"].rstrip("Z"))
        if datetime.utcnow() > expires_at:
            execute("UPDATE share_links SET status = 'expired' WHERE id = ?", (link_dict["id"],))
            raise HTTPException(status_code=410, detail="分享链接已过期")

    # 检查查看次数
    if link_dict["max_views"] and link_dict["view_count"] >= link_dict["max_views"]:
        raise HTTPException(status_code=410, detail="分享链接已达最大查看次数")

    # 如果需要密码，不返回资源详情
    needs_password = link_dict["access_type"] == "password"

    return ok({
        "share_code": link_dict["share_code"],
        "title": link_dict["title"],
        "resource_type": link_dict["resource_type"],
        "access_type": link_dict["access_type"],
        "needs_password": needs_password,
        "view_count": link_dict["view_count"],
        "created_at": link_dict["created_at"],
    })


@router.post("/{share_code}/access")
async def access_share(
    share_code: str,
    req: AccessShareReq,
    current_user: dict | None = Depends(get_optional_user),
):
    """访问分享资源（验证密码并返回资源信息）"""
    link = fetch_one(
        """
        SELECT id, share_code, creator_id, resource_type, resource_id, title,
               access_type, password, allowed_user_ids, max_views, view_count,
               expires_at, status
        FROM share_links
        WHERE share_code = ?
        """,
        (share_code,),
    )

    if not link:
        raise HTTPException(status_code=404, detail="分享链接不存在")

    link_dict = dict(link)

    if link_dict["status"] != "active":
        raise HTTPException(status_code=410, detail="分享链接已失效")

    # 检查过期
    if link_dict["expires_at"]:
        expires_at = datetime.fromisoformat(link_dict["expires_at"].rstrip("Z"))
        if datetime.utcnow() > expires_at:
            raise HTTPException(status_code=410, detail="分享链接已过期")

    # 验证密码
    if link_dict["access_type"] == "password":
        if link_dict["password"] != req.password:
            raise HTTPException(status_code=403, detail="密码错误")

    # 检查指定用户
    if link_dict["access_type"] == "specific" and current_user:
        allowed = json.loads(link_dict["allowed_user_ids"] or "[]")
        if current_user["user_id"] not in allowed:
            raise HTTPException(status_code=403, detail="您无权访问此资源")

    # 增加查看次数
    execute(
        "UPDATE share_links SET view_count = view_count + 1 WHERE id = ?",
        (link_dict["id"],),
    )

    return ok({
        "resource_type": link_dict["resource_type"],
        "resource_id": link_dict["resource_id"],
        "title": link_dict["title"],
    })
