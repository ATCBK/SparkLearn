import json
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, UploadFile

from ..config import settings
from ..db import execute, fetch_all, fetch_one, get_conn, now_iso
from ..llm import spark_lite
from ..schemas import fail, ok

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/files")
async def list_knowledge_files(status: str | None = None, search: str | None = None):
    clauses = ["user_id = ?"]
    params: list[Any] = [settings.single_user_id]
    if status:
        clauses.append("status = ?")
        params.append(status)
    if search:
        clauses.append("(filename LIKE ? OR tags LIKE ? OR summary LIKE ?)")
        q = f"%{search}%"
        params.extend([q, q, q])

    rows = fetch_all(
        f"""
        SELECT *
        FROM knowledge_files
        WHERE {' AND '.join(clauses)}
        ORDER BY updated_at DESC, id DESC
        """,
        tuple(params),
    )
    return ok([_file_row_to_dict(r) for r in rows])


@router.post("/files")
async def upload_knowledge_file(files: list[UploadFile] = File(...)):
    saved: list[dict[str, Any]] = []
    upload_dir = settings.data_dir / "users" / settings.single_user_id / "knowledge"
    upload_dir.mkdir(parents=True, exist_ok=True)
    ts = now_iso()

    for f in files:
        raw = await f.read()
        if not raw:
            continue

        filename = f.filename or "knowledge-file"
        file_id = _execute_returning_id(
            """
            INSERT INTO knowledge_files(
              user_id, filename, stored_path, mime_type, size_bytes, status,
              tags, summary, chunk_count, reference_count, created_at, updated_at
            ) VALUES (?, ?, '', ?, ?, 'pending', '[]', '', 0, 0, ?, ?)
            """,
            (settings.single_user_id, filename, f.content_type or "application/octet-stream", len(raw), ts, ts),
        )

        ext = Path(filename).suffix
        stored_path = upload_dir / f"{file_id}_{uuid.uuid4().hex[:8]}{ext}"
        stored_path.write_bytes(raw)
        execute("UPDATE knowledge_files SET stored_path = ? WHERE id = ?", (str(stored_path), file_id))
        row = fetch_one("SELECT * FROM knowledge_files WHERE id = ?", (file_id,))
        saved.append(_file_row_to_dict(row))

    return ok(saved)


@router.get("/files/{file_id}")
async def get_knowledge_file(file_id: int):
    row = _get_owned_file(file_id)
    if not row:
        return fail("knowledge file not found")
    return ok(_file_row_to_dict(row))


@router.delete("/files/{file_id}")
async def delete_knowledge_file(file_id: int):
    row = _get_owned_file(file_id)
    if not row:
        return fail("knowledge file not found")
    path = Path(str(row["stored_path"] or ""))
    if path.exists() and path.is_file():
        path.unlink()
    execute("DELETE FROM knowledge_chunks WHERE file_id = ?", (file_id,))
    execute("DELETE FROM knowledge_files WHERE id = ? AND user_id = ?", (file_id, settings.single_user_id))
    return ok({"deleted": True, "id": file_id})


@router.put("/files/{file_id}/index")
async def index_knowledge_file(file_id: int):
    row = _get_owned_file(file_id)
    if not row:
        return fail("knowledge file not found")

    execute(
        "UPDATE knowledge_files SET status = 'processing', updated_at = ? WHERE id = ?",
        (now_iso(), file_id),
    )
    try:
        text = _extract_text(Path(str(row["stored_path"])), str(row["mime_type"] or ""), str(row["filename"] or ""))
        chunks = _chunk_text(text, size=800)
        if not chunks:
            raise ValueError("未提取到可整理文本")

        execute("DELETE FROM knowledge_chunks WHERE file_id = ?", (file_id,))
        ts = now_iso()
        with get_conn() as conn:
            conn.executemany(
                """
                INSERT INTO knowledge_chunks(file_id, chunk_index, content, created_at)
                VALUES (?, ?, ?, ?)
                """,
                [(file_id, idx, chunk, ts) for idx, chunk in enumerate(chunks)],
            )

        summary, tags = await _summarize_and_tag(text)
        execute(
            """
            UPDATE knowledge_files
            SET status = 'indexed', summary = ?, tags = ?, chunk_count = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (summary, json.dumps(tags, ensure_ascii=False), len(chunks), now_iso(), file_id, settings.single_user_id),
        )
        updated = _get_owned_file(file_id)
        return ok(_file_row_to_dict(updated))
    except Exception as ex:
        execute(
            """
            UPDATE knowledge_files
            SET status = 'failed', summary = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (f"整理失败：{ex}", now_iso(), file_id, settings.single_user_id),
        )
        return fail(f"整理失败：{ex}")


@router.get("/stats")
async def knowledge_stats():
    row = fetch_one(
        """
        SELECT
          COUNT(1) AS total,
          SUM(CASE WHEN status = 'indexed' THEN 1 ELSE 0 END) AS indexed,
          SUM(chunk_count) AS chunks,
          SUM(reference_count) AS references
        FROM knowledge_files
        WHERE user_id = ?
        """,
        (settings.single_user_id,),
    )
    return ok(
        {
            "total": int(row["total"] or 0) if row else 0,
            "indexed": int(row["indexed"] or 0) if row else 0,
            "chunks": int(row["chunks"] or 0) if row else 0,
            "references": int(row["references"] or 0) if row else 0,
        }
    )


@router.get("/chunks")
async def knowledge_chunks(file_id: int):
    row = _get_owned_file(file_id)
    if not row:
        return fail("knowledge file not found")
    rows = fetch_all(
        """
        SELECT id, file_id, chunk_index, content, created_at
        FROM knowledge_chunks
        WHERE file_id = ?
        ORDER BY chunk_index ASC
        """,
        (file_id,),
    )
    return ok([dict(r) for r in rows])


def load_knowledge_context(file_ids: list[int], max_chars: int = 5000) -> str:
    ids = [int(x) for x in file_ids if int(x) > 0]
    if not ids:
        return ""
    placeholders = ",".join("?" for _ in ids)
    rows = fetch_all(
        f"""
        SELECT c.content, f.filename
        FROM knowledge_chunks c
        JOIN knowledge_files f ON f.id = c.file_id
        WHERE f.user_id = ? AND f.status = 'indexed' AND c.file_id IN ({placeholders})
        ORDER BY c.file_id ASC, c.chunk_index ASC
        """,
        (settings.single_user_id, *ids),
    )
    parts: list[str] = []
    total = 0
    for row in rows:
        piece = f"【{row['filename']}】{row['content']}"
        if total + len(piece) > max_chars:
            break
        parts.append(piece)
        total += len(piece)
    if not parts:
        return ""
    return "\n\n".join(parts)


def _get_owned_file(file_id: int):
    return fetch_one("SELECT * FROM knowledge_files WHERE id = ? AND user_id = ?", (file_id, settings.single_user_id))


def _file_row_to_dict(row) -> dict[str, Any]:
    if not row:
        return {}
    return {
        "id": int(row["id"]),
        "filename": row["filename"],
        "mime_type": row["mime_type"],
        "size_bytes": int(row["size_bytes"] or 0),
        "status": row["status"],
        "tags": _safe_json_list(row["tags"]),
        "summary": row["summary"] or "",
        "chunk_count": int(row["chunk_count"] or 0),
        "reference_count": int(row["reference_count"] or 0),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _extract_text(path: Path, mime_type: str, filename: str) -> str:
    suffix = path.suffix.lower() or Path(filename).suffix.lower()
    if suffix == ".pdf" or "pdf" in mime_type:
        try:
            import fitz
        except Exception as ex:
            raise RuntimeError("缺少 PyMuPDF，无法提取 PDF") from ex
        doc = fitz.open(path)
        try:
            return "\n".join(page.get_text("text") for page in doc).strip()
        finally:
            doc.close()
    if suffix == ".docx" or "word" in mime_type:
        try:
            from docx import Document
        except Exception as ex:
            raise RuntimeError("缺少 python-docx，无法提取 DOCX") from ex
        document = Document(str(path))
        return "\n".join(p.text for p in document.paragraphs).strip()
    if suffix in {".txt", ".md", ".csv", ".json"} or mime_type.startswith("text/"):
        return path.read_text(encoding="utf-8", errors="ignore").strip()
    return path.read_text(encoding="utf-8", errors="ignore").strip()


def _chunk_text(text: str, size: int) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    return [cleaned[i : i + size] for i in range(0, len(cleaned), size) if cleaned[i : i + size].strip()]


async def _summarize_and_tag(text: str) -> tuple[str, list[str]]:
    sample = text[:2600]
    try:
        raw = await spark_lite.summarize(
            "请阅读下面学习资料，输出一段80字以内摘要，最后一行用“标签：”列出3到5个中文标签。\n\n"
            + sample
        )
    except Exception:
        raw = ""
    raw = raw.strip()
    if not raw:
        return ("已整理为可检索知识片段，可用于资源生成和 AI 问答。", ["学习资料", "用户上传", "可检索"])
    tag_match = re.search(r"标签[:：]\s*(.+)$", raw)
    if tag_match:
        tags = [x.strip(" ，,、;；") for x in re.split(r"[，,、;；\s]+", tag_match.group(1)) if x.strip()]
        summary = raw[: tag_match.start()].strip()
    else:
        tags = ["学习资料", "用户上传", "可检索"]
        summary = raw
    return (summary[:240] or "已整理为可检索知识片段。", tags[:5])


def _safe_json_list(raw: Any) -> list[str]:
    try:
        value = json.loads(raw or "[]")
        if isinstance(value, list):
            return [str(x) for x in value]
    except Exception:
        pass
    return []


def _execute_returning_id(query: str, params: tuple[Any, ...]) -> int:
    with get_conn() as conn:
        cur = conn.execute(query, params)
        return int(cur.lastrowid)
