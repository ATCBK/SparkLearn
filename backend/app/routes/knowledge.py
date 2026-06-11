import json
import math
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, UploadFile

from ..config import settings
from ..db import execute, fetch_all, fetch_one, get_conn, now_iso
from ..embeddings import xfyun_embedding
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


@router.put("/files/{file_id}/index")
async def index_knowledge_file(file_id: int):
    row = _get_owned_file(file_id)
    if not row:
        return fail("knowledge file not found")

    execute("UPDATE knowledge_files SET status = 'processing', updated_at = ? WHERE id = ?", (now_iso(), file_id))
    try:
        text = _extract_text(Path(str(row["stored_path"])), str(row["mime_type"] or ""), str(row["filename"] or ""))
        chunks = _chunk_text_by_structure(text, max_chars=700, overlap=120)
        if not chunks:
            raise ValueError("no content extracted from file")

        execute("DELETE FROM knowledge_chunks WHERE file_id = ?", (file_id,))
        ts = now_iso()
        rows_to_insert: list[tuple[Any, ...]] = []
        for idx, chunk in enumerate(chunks):
            emb = await xfyun_embedding.embed_para(chunk)
            rows_to_insert.append((file_id, idx, chunk, json.dumps(emb, ensure_ascii=False), ts))

        with get_conn() as conn:
            conn.executemany(
                """
                INSERT INTO knowledge_chunks(file_id, chunk_index, content, embedding_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                rows_to_insert,
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
            "UPDATE knowledge_files SET status = 'failed', summary = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (f"index failed: {ex}", now_iso(), file_id, settings.single_user_id),
        )
        return fail(f"index failed: {ex}")


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


@router.get("/stats")
async def knowledge_stats():
    row = fetch_one(
        """
        SELECT
          COUNT(1) AS total,
          SUM(CASE WHEN status = 'indexed' THEN 1 ELSE 0 END) AS indexed,
          SUM(chunk_count) AS chunks,
          SUM(reference_count) AS "references"
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


async def retrieve_knowledge_context_async(
    file_ids: list[int],
    query: str | None = None,
    max_chars: int = 5000,
    top_k: int = 10,
) -> tuple[str, list[dict[str, Any]]]:
    ids = [int(x) for x in file_ids if int(x) > 0]
    if not ids:
        return ("", [])
    try:
        query_vec = await xfyun_embedding.embed_query(query or "") if (query or "").strip() else []
    except Exception:
        query_vec = []

    placeholders = ",".join("?" for _ in ids)
    rows = fetch_all(
        f"""
        SELECT c.content, c.chunk_index, c.embedding_json, f.filename
        FROM knowledge_chunks c
        JOIN knowledge_files f ON f.id = c.file_id
        WHERE f.user_id = ? AND f.status = 'indexed' AND c.file_id IN ({placeholders})
        ORDER BY c.file_id ASC, c.chunk_index ASC
        """,
        (settings.single_user_id, *ids),
    )
    if not rows:
        return ("", [])

    scored: list[tuple[float, str, str, int]] = []
    for row in rows:
        content = str(row["content"] or "").strip()
        if not content:
            continue
        file_label = str(row["filename"] or "")
        idx = int(row["chunk_index"] or 0)
        text_piece = f"[{file_label}#{idx + 1}] {content}"
        if query_vec:
            chunk_vec = _safe_json_floats(row["embedding_json"])
            score = _cosine_similarity(query_vec, chunk_vec) if chunk_vec else 0.0
        else:
            score = 0.0
        scored.append((score, text_piece, file_label, idx))

    if query_vec:
        scored.sort(key=lambda x: x[0], reverse=True)
        candidates = scored[:top_k]
    else:
        candidates = scored[:top_k]

    selected: list[str] = []
    sources: list[dict[str, Any]] = []
    total = 0
    for score, piece, filename, chunk_index in candidates:
        if total + len(piece) > max_chars:
            break
        selected.append(piece)
        sources.append(
            {
                "filename": filename,
                "chunk_index": chunk_index,
                "score": round(float(score), 6),
                "snippet": piece[:260],
            }
        )
        total += len(piece)
    return ("\n\n".join(selected), sources)


async def load_knowledge_context_async(file_ids: list[int], query: str | None = None, max_chars: int = 5000) -> str:
    context, _sources = await retrieve_knowledge_context_async(file_ids, query=query, max_chars=max_chars, top_k=10)
    return context


def load_knowledge_context(file_ids: list[int], query: str | None = None, max_chars: int = 5000) -> str:
    import asyncio

    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            return ""
    except RuntimeError:
        pass
    return asyncio.run(load_knowledge_context_async(file_ids, query=query, max_chars=max_chars))


def _extract_text(path: Path, mime_type: str, filename: str) -> str:
    suffix = path.suffix.lower() or Path(filename).suffix.lower()
    if suffix == ".pdf" or "pdf" in mime_type:
        try:
            import fitz
        except Exception as ex:
            raise RuntimeError("PyMuPDF is required for PDF parsing") from ex
        doc = fitz.open(path)
        try:
            return "\n".join(page.get_text("text") for page in doc).strip()
        finally:
            doc.close()
    if suffix in {".txt", ".md"} or mime_type.startswith("text/"):
        return path.read_text(encoding="utf-8", errors="ignore").strip()
    raise RuntimeError(f"unsupported format: {suffix or mime_type}; only txt/md/pdf are enabled now")


def _chunk_text_by_structure(text: str, max_chars: int = 700, overlap: int = 120) -> list[str]:
    source = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not source:
        return []
    paras = [p.strip() for p in re.split(r"\n{2,}", source) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for para in paras:
        block = re.sub(r"\s+", " ", para).strip()
        if len(block) > max_chars * 1.5:
            sentences = re.split(r"(?<=[。！？.!?])\s+", block)
            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue
                if len(buf) + len(sentence) + 1 <= max_chars:
                    buf = f"{buf} {sentence}".strip()
                else:
                    if buf:
                        chunks.append(buf)
                    head = buf[-overlap:] if overlap > 0 and buf else ""
                    buf = f"{head} {sentence}".strip()
            continue
        if len(buf) + len(block) + 2 <= max_chars:
            buf = f"{buf}\n\n{block}".strip()
        else:
            if buf:
                chunks.append(buf)
            head = buf[-overlap:] if overlap > 0 and buf else ""
            buf = f"{head}\n\n{block}".strip()
    if buf:
        chunks.append(buf)
    return [c for c in chunks if c.strip()]


async def _summarize_and_tag(text: str) -> tuple[str, list[str]]:
    sample = text[:2200]
    try:
        raw = await spark_lite.summarize("请总结并提取标签：\n" + sample)
    except Exception:
        raw = ""
    raw = (raw or "").strip()
    if not raw:
        return ("已整理为可检索知识片段，可用于问答和资源生成。", ["学习资料", "用户上传", "可检索"])
    parts = re.split(r"[，,、\s]+", raw)
    tags = [p[:12] for p in parts if 1 < len(p) <= 12][:5]
    return (raw[:240], tags or ["学习资料", "用户上传", "可检索"])


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


def _get_owned_file(file_id: int):
    return fetch_one("SELECT * FROM knowledge_files WHERE id = ? AND user_id = ?", (file_id, settings.single_user_id))


def _safe_json_list(raw: Any) -> list[str]:
    try:
        value = json.loads(raw or "[]")
        if isinstance(value, list):
            return [str(x) for x in value]
    except Exception:
        pass
    return []


def _safe_json_floats(raw: Any) -> list[float]:
    try:
        value = json.loads(raw or "[]")
        if isinstance(value, list):
            return [float(x) for x in value]
    except Exception:
        pass
    return []


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def _execute_returning_id(query: str, params: tuple[Any, ...]) -> int:
    with get_conn() as conn:
        cur = conn.execute(query, params)
        return int(cur.lastrowid)
