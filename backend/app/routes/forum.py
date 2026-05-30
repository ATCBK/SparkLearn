import json
import re
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..config import settings
from ..db import fetch_all, fetch_one, get_conn, now_iso
from ..schemas import ok

router = APIRouter(prefix="/api/forum", tags=["forum"])

_MAX_TITLE_LEN = 120
_MAX_CONTENT_LEN = 10000
_MAX_ATTACHMENTS_PER_POST = 5
_MAX_FILE_SIZE = 20 * 1024 * 1024
_ALLOWED_SUFFIXES = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".png", ".jpg", ".jpeg"}


class PostCreateReq(BaseModel):
    title: str
    content: str
    tags: list[str] = []


class CommentCreateReq(BaseModel):
    content: str


class ForumModerationReq(BaseModel):
    status: str
    reason: str = ""


def _forum_user_dir() -> Path:
    base = settings.data_dir / "users" / settings.single_user_id / "forum" / "attachments"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _sanitize_filename(name: str) -> str:
    clean = re.sub(r'[\\/:*?"<>|]+', "_", name).strip().replace("\n", "").replace("\r", "")
    return clean[:120] or "file.bin"


def _post_row_to_dict(row, *, include_flags: bool = False) -> dict:
    data = {
        "id": int(row["id"]),
        "user_id": row["user_id"],
        "title": row["title"],
        "content": row["content"],
        "tags": json.loads(row["tags"] or "[]"),
        "status": row["status"],
        "like_count": int(row["like_count"]),
        "comment_count": int(row["comment_count"]),
        "favorite_count": int(row["favorite_count"]),
        "view_count": int(row["view_count"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    if include_flags:
        data["liked"] = bool(row["liked"]) if "liked" in row.keys() else False
        data["favorited"] = bool(row["favorited"]) if "favorited" in row.keys() else False
    return data


def _attachment_row_to_dict(row) -> dict:
    return {
        "id": int(row["id"]),
        "post_id": int(row["post_id"]),
        "filename": row["filename"],
        "mime_type": row["mime_type"],
        "size_bytes": int(row["size_bytes"]),
        "created_at": row["created_at"],
    }


@router.get("/admin/posts")
async def admin_list_posts(status: str = "pending", q: str = "", page: int = 1, page_size: int = 20):
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    normalized_status = status.strip().lower()
    allowed_statuses = {"all", "pending", "published", "rejected", "deleted", "hidden"}
    if normalized_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="invalid status")

    where: list[str] = []
    params: list = []
    if normalized_status != "all":
        where.append("status = ?")
        params.append(normalized_status)
    if q.strip():
        keyword = f"%{q.strip()}%"
        where.append("(title LIKE ? OR content LIKE ? OR tags LIKE ? OR user_id LIKE ?)")
        params.extend([keyword, keyword, keyword, keyword])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    rows = fetch_all(
        f"""
        SELECT * FROM forum_posts
        {where_sql}
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ? OFFSET ?
        """,
        tuple(params + [page_size, (page - 1) * page_size]),
    )
    stats_rows = fetch_all(
        """
        SELECT status, COUNT(1) AS count
        FROM forum_posts
        GROUP BY status
        """
    )
    stats = {"pending": 0, "published": 0, "rejected": 0, "deleted": 0, "hidden": 0}
    for row in stats_rows:
        stats[str(row["status"] or "")] = int(row["count"])

    return ok({"items": [_post_row_to_dict(row) for row in rows], "stats": stats, "page": page, "page_size": page_size})


@router.patch("/admin/posts/{post_id}/status")
async def admin_update_post_status(post_id: int, req: ForumModerationReq):
    status = req.status.strip().lower()
    if status not in {"pending", "published", "rejected", "deleted", "hidden"}:
        raise HTTPException(status_code=400, detail="invalid status")

    with get_conn() as conn:
        row = conn.execute("SELECT * FROM forum_posts WHERE id = ?", (post_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="post not found")
        conn.execute("UPDATE forum_posts SET status = ?, updated_at = ? WHERE id = ?", (status, now_iso(), post_id))
        updated = conn.execute("SELECT * FROM forum_posts WHERE id = ?", (post_id,)).fetchone()

    return ok({"post": _post_row_to_dict(updated), "reason": req.reason.strip()})


@router.get("/posts")
async def list_posts(tab: str = "latest", q: str = "", tag: str = "", page: int = 1, page_size: int = 20):
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    user_id = settings.single_user_id

    where = ["p.status = 'published'"]
    params: list = [user_id, user_id]

    if q.strip():
        keyword = f"%{q.strip()}%"
        where.append("(p.title LIKE ? OR p.content LIKE ? OR p.tags LIKE ?)")
        params.extend([keyword, keyword, keyword])
    if tag.strip():
        where.append("p.tags LIKE ?")
        params.append(f'%"{tag.strip()}"%')

    order_by = "p.created_at DESC"
    if tab == "hot":
        order_by = "(p.like_count * 2 + p.comment_count * 3 + p.favorite_count * 2 + p.view_count) DESC, p.created_at DESC"
    elif tab == "recommended":
        order_by = "(p.favorite_count * 3 + p.comment_count * 2 + p.like_count) DESC, p.created_at DESC"

    sql = f"""
        SELECT p.*,
               EXISTS(SELECT 1 FROM forum_post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked,
               EXISTS(SELECT 1 FROM forum_post_favorites f WHERE f.post_id = p.id AND f.user_id = ?) AS favorited
        FROM forum_posts p
        WHERE {' AND '.join(where)}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
    """
    params.extend([page_size, (page - 1) * page_size])

    rows = fetch_all(sql, tuple(params))
    items = [_post_row_to_dict(row, include_flags=True) for row in rows]
    return ok({"items": items, "page": page, "page_size": page_size})


@router.post("/posts")
async def create_post(req: PostCreateReq):
    title = req.title.strip()
    content = req.content.strip()
    tags = [str(x).strip() for x in req.tags if str(x).strip()][:8]

    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    if len(title) > _MAX_TITLE_LEN:
        raise HTTPException(status_code=400, detail="title too long")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")
    if len(content) > _MAX_CONTENT_LEN:
        raise HTTPException(status_code=400, detail="content too long")

    ts = now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO forum_posts(user_id, title, content, tags, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'published', ?, ?)
            """,
            (settings.single_user_id, title, content, json.dumps(tags, ensure_ascii=False), ts, ts),
        )
        row = conn.execute("SELECT * FROM forum_posts WHERE id = last_insert_rowid()")
        created = row.fetchone()

    return ok(_post_row_to_dict(created))


@router.get("/posts/{post_id}")
async def get_post_detail(post_id: int):
    user_id = settings.single_user_id
    with get_conn() as conn:
        conn.execute("UPDATE forum_posts SET view_count = view_count + 1, updated_at = ? WHERE id = ? AND status = 'published'", (now_iso(), post_id))
        conn.execute(
            """
            INSERT INTO forum_browsing_history(user_id, post_id, viewed_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, post_id) DO UPDATE SET viewed_at=excluded.viewed_at
            """,
            (user_id, post_id, now_iso()),
        )
        row = conn.execute(
            """
            SELECT p.*,
                   EXISTS(SELECT 1 FROM forum_post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked,
                   EXISTS(SELECT 1 FROM forum_post_favorites f WHERE f.post_id = p.id AND f.user_id = ?) AS favorited
            FROM forum_posts p
            WHERE p.id = ? AND p.status = 'published'
            """,
            (user_id, user_id, post_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="post not found")

    attachments = fetch_all("SELECT * FROM forum_attachments WHERE post_id = ? ORDER BY id ASC", (post_id,))
    return ok({"post": _post_row_to_dict(row, include_flags=True), "attachments": [_attachment_row_to_dict(x) for x in attachments]})


@router.delete("/posts/{post_id}")
async def delete_post(post_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM forum_posts WHERE id = ? AND user_id = ? AND status = 'published'", (post_id, settings.single_user_id)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="post not found")
        conn.execute("UPDATE forum_posts SET status = 'deleted', updated_at = ? WHERE id = ?", (now_iso(), post_id))
    return ok({"post_id": post_id, "deleted": True})


@router.get("/posts/{post_id}/comments")
async def list_comments(post_id: int):
    rows = fetch_all(
        "SELECT * FROM forum_comments WHERE post_id = ? AND status = 'published' ORDER BY created_at ASC",
        (post_id,),
    )
    items = [
        {
            "id": int(r["id"]),
            "post_id": int(r["post_id"]),
            "user_id": r["user_id"],
            "content": r["content"],
            "status": r["status"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]
    return ok(items)


@router.post("/posts/{post_id}/comments")
async def create_comment(post_id: int, req: CommentCreateReq):
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    ts = now_iso()
    with get_conn() as conn:
        post = conn.execute("SELECT id FROM forum_posts WHERE id = ? AND status = 'published'", (post_id,)).fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="post not found")

        conn.execute(
            """
            INSERT INTO forum_comments(post_id, user_id, content, status, created_at, updated_at)
            VALUES (?, ?, ?, 'published', ?, ?)
            """,
            (post_id, settings.single_user_id, content, ts, ts),
        )
        conn.execute(
            "UPDATE forum_posts SET comment_count = comment_count + 1, updated_at = ? WHERE id = ?",
            (ts, post_id),
        )
        row = conn.execute("SELECT * FROM forum_comments WHERE id = last_insert_rowid()").fetchone()

    return ok(
        {
            "id": int(row["id"]),
            "post_id": int(row["post_id"]),
            "user_id": row["user_id"],
            "content": row["content"],
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
    )


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: int):
    ts = now_iso()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, post_id FROM forum_comments WHERE id = ? AND user_id = ? AND status = 'published'",
            (comment_id, settings.single_user_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="comment not found")

        conn.execute("UPDATE forum_comments SET status = 'deleted', updated_at = ? WHERE id = ?", (ts, comment_id))
        conn.execute(
            "UPDATE forum_posts SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END, updated_at = ? WHERE id = ?",
            (ts, int(row["post_id"])),
        )

    return ok({"comment_id": comment_id, "deleted": True})


@router.post("/posts/{post_id}/like")
async def toggle_like(post_id: int):
    ts = now_iso()
    with get_conn() as conn:
        post = conn.execute("SELECT id FROM forum_posts WHERE id = ? AND status = 'published'", (post_id,)).fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="post not found")

        liked = conn.execute(
            "SELECT id FROM forum_post_likes WHERE post_id = ? AND user_id = ?",
            (post_id, settings.single_user_id),
        ).fetchone()
        if liked:
            conn.execute("DELETE FROM forum_post_likes WHERE id = ?", (int(liked["id"]),))
            conn.execute("UPDATE forum_posts SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END, updated_at = ? WHERE id = ?", (ts, post_id))
            current = False
        else:
            conn.execute("INSERT INTO forum_post_likes(post_id, user_id, created_at) VALUES (?, ?, ?)", (post_id, settings.single_user_id, ts))
            conn.execute("UPDATE forum_posts SET like_count = like_count + 1, updated_at = ? WHERE id = ?", (ts, post_id))
            current = True

        count = conn.execute("SELECT like_count FROM forum_posts WHERE id = ?", (post_id,)).fetchone()["like_count"]

    return ok({"liked": current, "like_count": int(count)})


@router.post("/posts/{post_id}/favorite")
async def toggle_favorite(post_id: int):
    ts = now_iso()
    with get_conn() as conn:
        post = conn.execute("SELECT id FROM forum_posts WHERE id = ? AND status = 'published'", (post_id,)).fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="post not found")

        favored = conn.execute(
            "SELECT id FROM forum_post_favorites WHERE post_id = ? AND user_id = ?",
            (post_id, settings.single_user_id),
        ).fetchone()
        if favored:
            conn.execute("DELETE FROM forum_post_favorites WHERE id = ?", (int(favored["id"]),))
            conn.execute("UPDATE forum_posts SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END, updated_at = ? WHERE id = ?", (ts, post_id))
            current = False
        else:
            conn.execute("INSERT INTO forum_post_favorites(post_id, user_id, created_at) VALUES (?, ?, ?)", (post_id, settings.single_user_id, ts))
            conn.execute("UPDATE forum_posts SET favorite_count = favorite_count + 1, updated_at = ? WHERE id = ?", (ts, post_id))
            current = True

        count = conn.execute("SELECT favorite_count FROM forum_posts WHERE id = ?", (post_id,)).fetchone()["favorite_count"]

    return ok({"favorited": current, "favorite_count": int(count)})


@router.post("/posts/{post_id}/attachments")
async def upload_attachments(post_id: int, files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="files are required")

    ts = now_iso()
    base_dir = _forum_user_dir() / f"post_{post_id}"
    base_dir.mkdir(parents=True, exist_ok=True)

    with get_conn() as conn:
        post = conn.execute("SELECT id FROM forum_posts WHERE id = ? AND user_id = ? AND status = 'published'", (post_id, settings.single_user_id)).fetchone()
        if not post:
            raise HTTPException(status_code=404, detail="post not found")

        existed = conn.execute("SELECT COUNT(1) AS cnt FROM forum_attachments WHERE post_id = ?", (post_id,)).fetchone()["cnt"]
        if int(existed) + len(files) > _MAX_ATTACHMENTS_PER_POST:
            raise HTTPException(status_code=400, detail="too many attachments")

        created: list[dict] = []
        for file in files:
            origin = _sanitize_filename(file.filename or "file.bin")
            suffix = Path(origin).suffix.lower()
            if suffix not in _ALLOWED_SUFFIXES:
                raise HTTPException(status_code=400, detail=f"unsupported file type: {suffix or 'unknown'}")

            data = await file.read()
            if len(data) > _MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="file too large")

            stored_name = f"{ts.replace(':', '').replace('.', '')}_{origin}"
            stored_path = base_dir / stored_name
            stored_path.write_bytes(data)

            conn.execute(
                """
                INSERT INTO forum_attachments(post_id, user_id, filename, stored_path, mime_type, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (post_id, settings.single_user_id, origin, str(stored_path), file.content_type or "application/octet-stream", len(data), ts),
            )
            row = conn.execute("SELECT * FROM forum_attachments WHERE id = last_insert_rowid()").fetchone()
            created.append(_attachment_row_to_dict(row))

    return ok(created)


@router.get("/posts/{post_id}/attachments")
async def list_attachments(post_id: int):
    rows = fetch_all("SELECT * FROM forum_attachments WHERE post_id = ? ORDER BY id ASC", (post_id,))
    return ok([_attachment_row_to_dict(r) for r in rows])


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(attachment_id: int):
    row = fetch_one("SELECT * FROM forum_attachments WHERE id = ?", (attachment_id,))
    if not row:
        raise HTTPException(status_code=404, detail="attachment not found")

    path = Path(row["stored_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="attachment file not found")

    return FileResponse(path=str(path), filename=row["filename"], media_type=row["mime_type"] or "application/octet-stream")


@router.get("/my/posts")
async def get_my_posts(page: int = 1, page_size: int = 20):
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    rows = fetch_all(
        """
        SELECT * FROM forum_posts
        WHERE user_id = ? AND status = 'published'
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        (settings.single_user_id, page_size, (page - 1) * page_size),
    )
    return ok({"items": [_post_row_to_dict(r) for r in rows], "page": page, "page_size": page_size})


@router.get("/my/favorites")
async def get_my_favorites(page: int = 1, page_size: int = 20):
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    rows = fetch_all(
        """
        SELECT p.*,
               1 AS liked,
               1 AS favorited
        FROM forum_post_favorites f
        JOIN forum_posts p ON p.id = f.post_id
        WHERE f.user_id = ? AND p.status = 'published'
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
        """,
        (settings.single_user_id, page_size, (page - 1) * page_size),
    )
    return ok({"items": [_post_row_to_dict(r, include_flags=True) for r in rows], "page": page, "page_size": page_size})


@router.get("/my/likes")
async def get_my_likes(page: int = 1, page_size: int = 20):
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    rows = fetch_all(
        """
        SELECT p.*,
               1 AS liked,
               EXISTS(SELECT 1 FROM forum_post_favorites f WHERE f.post_id = p.id AND f.user_id = ?) AS favorited
        FROM forum_post_likes l
        JOIN forum_posts p ON p.id = l.post_id
        WHERE l.user_id = ? AND p.status = 'published'
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?
        """,
        (settings.single_user_id, settings.single_user_id, page_size, (page - 1) * page_size),
    )
    return ok({"items": [_post_row_to_dict(r, include_flags=True) for r in rows], "page": page, "page_size": page_size})


@router.get("/my/comments")
async def get_my_comments(page: int = 1, page_size: int = 20):
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    rows = fetch_all(
        """
        SELECT c.id, c.post_id, c.content, c.created_at, p.title AS post_title
        FROM forum_comments c
        JOIN forum_posts p ON p.id = c.post_id
        WHERE c.user_id = ? AND c.status = 'published' AND p.status = 'published'
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        """,
        (settings.single_user_id, page_size, (page - 1) * page_size),
    )
    items = [
        {
            "id": int(r["id"]),
            "post_id": int(r["post_id"]),
            "post_title": str(r["post_title"] or ""),
            "content": str(r["content"] or ""),
            "created_at": str(r["created_at"] or ""),
        }
        for r in rows
    ]
    return ok({"items": items, "page": page, "page_size": page_size})


@router.get("/my/history")
async def get_my_history(page: int = 1, page_size: int = 20):
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    rows = fetch_all(
        """
        SELECT p.*, h.viewed_at
        FROM forum_browsing_history h
        JOIN forum_posts p ON p.id = h.post_id
        WHERE h.user_id = ? AND p.status = 'published'
        ORDER BY h.viewed_at DESC
        LIMIT ? OFFSET ?
        """,
        (settings.single_user_id, page_size, (page - 1) * page_size),
    )
    items = []
    for r in rows:
        item = _post_row_to_dict(r)
        item["viewed_at"] = str(r["viewed_at"] or "")
        items.append(item)
    return ok({"items": items, "page": page, "page_size": page_size})
