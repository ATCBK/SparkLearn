import re
import uuid
import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime
from html import escape
from typing import Any
from urllib.parse import quote, unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

from ..coze import coze_adapter
from ..config import settings
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json
from .common import sse_wrap

router = APIRouter(prefix="/api/resources", tags=["resources"])


class GenerateReq(BaseModel):
    type: str = "document"
    prompt: str


def _now_date() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


@router.get("")
async def get_resources():
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    return ok(resources)


@router.post("/generate")
async def generate_resource(req: GenerateReq):
    async def gen() -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
        res_id = f"gen-{uuid.uuid4().hex[:8]}"
        yield ("progress", {"stage": "started", "resource_id": res_id, "progress": 5})
        chunks: list[str] = []
        explicit_source_url = ""
        progress = 10

        coze_prompt = _build_resource_prompt(req.type, req.prompt)
        async for evt_type, payload in coze_adapter.stream_resource_text(
            resource_type=req.type,
            prompt=coze_prompt,
            user_id=settings.single_user_id,
        ):
            if evt_type == "text":
                chunk = str(payload.get("content", ""))
                if chunk:
                    chunks.append(chunk)
                    progress = min(progress + 8, 90)
                    yield ("text", {"content": chunk, "resource_id": res_id})
                    yield (
                        "progress",
                        {"stage": "generating", "resource_id": res_id, "progress": progress},
                    )
            elif evt_type == "error":
                yield ("error", payload)
            elif evt_type == "meta":
                links = payload.get("links")
                if isinstance(links, list):
                    for item in links:
                        if isinstance(item, str) and _is_valid_url(item):
                            explicit_source_url = item
                            break

        content = "".join(chunks).strip()
        if not content:
            content = _fallback_resource_content(req.type, req.prompt)
        marker_url = _extract_marked_url(content)
        source_url = explicit_source_url or marker_url
        content = _strip_marked_url(content).strip()
        content = _normalize_generated_content(content, source_url)
        if source_url and not content:
            content = "Linked web document generated. Use preview or download to view it."
        resource = {
            "id": res_id,
            "title": req.prompt[:20] or "Generated Resource",
            "type": req.type,
            "status": "completed",
            "created_at": _now_date(),
            "content": f"# {req.prompt}\n\n{content}",
            "source_url": source_url or None,
            "progress": 100,
        }

        resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
        resources.append(resource)
        write_json(settings.single_user_id, "resources_index.json", resources)
        append_jsonl(
            settings.single_user_id,
            "resource_usage.jsonl",
            {"type": "resource_generated", "resource_id": res_id},
        )
        yield ("done", {"resource_id": res_id, "resource": resource})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.get("/{resource_id}")
async def get_resource_detail(resource_id: str):
    item = _find_resource(resource_id)
    return ok(item)


@router.get("/{resource_id}/preview")
async def get_resource_preview(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    link = _resource_source_url(item)
    return ok({"url": link, "available": bool(link)})


@router.get("/{resource_id}/preview/html")
async def get_resource_preview_html(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    link = _resource_source_url(item)
    if not link:
        raise HTTPException(status_code=404, detail="preview url not found")

    html = await _fetch_url_text(link)
    safe_link = link.replace('"', '&quot;')
    if '<head' in html.lower():
        html = re.sub(
            r'(<head[^>]*>)',
            r'\1<base href="' + safe_link + '" />',
            html,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        html = f'<base href="{safe_link}" />\n{html}'
    return HTMLResponse(content=html)


@router.get("/{resource_id}/download")
async def download_resource(resource_id: str):
    # Backward-compatible default download endpoint now serves PDF.
    return await download_resource_pdf(resource_id)


@router.get("/{resource_id}/download/html")
async def download_resource_html(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    link = _resource_source_url(item)
    title = str(item.get("title", "resource")).strip() or "resource"
    filename = _safe_filename(f"{title}.html")

    if not link:
        content = str(item.get("content", "")).encode("utf-8")
        return StreamingResponse(
            iter([content]),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": _build_content_disposition(_safe_filename(title + ".md")),
                "Cache-Control": "no-store",
            },
        )

    html = await _fetch_url_text(link)
    return StreamingResponse(
        iter([html.encode("utf-8")]),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": _build_content_disposition(filename),
            "Cache-Control": "no-store",
        },
    )


@router.get("/{resource_id}/download/pdf")
async def download_resource_pdf(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    title = str(item.get("title", "resource")).strip() or "resource"
    filename = _safe_filename(f"{title}.pdf")
    pdf_bytes = await _render_resource_pdf(item)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": _build_content_disposition(filename),
            "Cache-Control": "no-store",
        },
    )


@router.delete("/{resource_id}")
async def delete_resource(resource_id: str):
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    before = len(resources)
    next_resources = [r for r in resources if str(r.get("id", "")) != resource_id]
    removed = before - len(next_resources)
    write_json(settings.single_user_id, "resources_index.json", next_resources)
    append_jsonl(
        settings.single_user_id,
        "resource_usage.jsonl",
        {
            "type": "resource_deleted",
            "resource_id": resource_id,
            "removed_count": removed,
        },
    )
    return ok({"resource_id": resource_id, "deleted": removed > 0})


@router.get("/recommendations/list")
async def get_recommendations():
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    if not resources:
        return ok([])

    reason_map = [
        ("You need to strengthen fundamentals first, start from this resource.", "remedial"),
        ("Based on your current stage, this is the best next resource.", "stage"),
        ("Daily review tip: use this one for reinforcement practice.", "today"),
    ]

    recs: list[dict[str, Any]] = []
    for idx, resource in enumerate(resources[:3]):
        reason, category = reason_map[idx]
        recs.append(
            {
                "id": f"rec{idx + 1}",
                "resource": resource,
                "reason": reason,
                "category": category,
            }
        )
    return ok(recs)


def _default_resources() -> list[dict[str, Any]]:
    return [
        {
            "id": "r1",
            "title": "Variables and Data Types",
            "type": "document",
            "status": "completed",
            "created_at": "2026-04-15",
            "content": "# Variables and Data Types\n\n...",
        },
        {
            "id": "r2",
            "title": "Python Function Basics PPT",
            "type": "ppt",
            "status": "completed",
            "created_at": "2026-04-14",
            "docmee_id": "demo-1",
        },
        {
            "id": "r3",
            "title": "Conditional Logic Mindmap",
            "type": "mindmap",
            "status": "completed",
            "created_at": "2026-04-13",
            "content": "# Conditional Logic\n\n...",
        },
        {
            "id": "r4",
            "title": "Function Practice Set",
            "type": "quiz",
            "status": "completed",
            "created_at": "2026-04-12",
        },
        {
            "id": "r5",
            "title": "Python Stdlib Extended Reading",
            "type": "reading",
            "status": "completed",
            "created_at": "2026-04-11",
            "content": "# Python Standard Library\n\n...",
        },
        {
            "id": "r6",
            "title": "Decorator Code Example",
            "type": "code",
            "status": "completed",
            "created_at": "2026-04-10",
            "content": "```python\n...\n```",
        },
    ]


def _build_resource_prompt(resource_type: str, user_prompt: str) -> str:
    base = user_prompt.strip()
    if resource_type == "document":
        return (
            "Generate a structured learning document in Markdown format. "
            "Include learning goals, key concepts, examples, common mistakes, and practice suggestions. "
            "If there is a published webpage link, put exactly one first line as: SOURCE_URL: https://... "
            "If not available, put: SOURCE_URL: NONE"
            f"\n\nRequirement: {base}"
        )
    if resource_type == "mindmap":
        return (
            "Generate a mindmap-style Markdown outline with clear levels (topic -> branch -> points). "
            "If there is a published webpage link, put it on the first line."
            f"\n\nTopic: {base}"
        )
    if resource_type == "quiz":
        return (
            "Generate a quiz set in Markdown with question, options, answer, and explanation. "
            "Include easy/medium/hard progression. "
            "If there is a published webpage link, put it on the first line."
            f"\n\nTopic: {base}"
        )
    if resource_type == "reading":
        return (
            "Generate an extended reading article in Markdown with background, key knowledge, use cases, and next-reading tips. "
            "If there is a published webpage link, put it on the first line."
            f"\n\nTopic: {base}"
        )
    if resource_type == "code":
        return (
            "Generate a code-learning case in Markdown with problem statement, full code, explanation, and extension exercises. "
            "If there is a published webpage link, put it on the first line."
            f"\n\nTopic: {base}"
        )
    return base


def _fallback_resource_content(resource_type: str, prompt: str) -> str:
    return (
        f"# {prompt}\n\n"
        f"{resource_type} generation returned empty content. Please retry later."
    )


def _find_resource(resource_id: str) -> dict[str, Any] | None:
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    for item in resources:
        if str(item.get("id", "")) == resource_id:
            return item
    return None


def _extract_first_url(text: str) -> str | None:
    if not text:
        return None
    for m in re.finditer(r"\[[^\]]+\]\((https?://[^\s)]+)\)", text):
        cleaned = _sanitize_url(m.group(1))
        if _is_valid_url(cleaned):
            return cleaned
    for m in re.finditer(r"https?://[^\s)]+", text):
        cleaned = _sanitize_url(m.group(0))
        if _is_valid_url(cleaned):
            return cleaned
    return None


async def _fetch_url_text(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="invalid preview url")
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "").lower()
            if "html" not in content_type and "text/plain" not in content_type:
                raise HTTPException(status_code=400, detail=f"unsupported content-type: {content_type}")
            return resp.text
    except HTTPException:
        raise
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"fetch preview failed: {ex}") from ex


def _safe_filename(name: str) -> str:
    normalized = re.sub(r'[\\/:*?"<>|]+', "_", name).strip()
    normalized = normalized.replace("\r", "").replace("\n", "")
    return normalized[:120] or "resource.html"


def _ascii_filename(name: str) -> str:
    # HTTP header fallback filename should be ASCII-safe.
    ascii_only = "".join(ch if ord(ch) < 128 else "_" for ch in name)
    ascii_only = re.sub(r"\s+", "_", ascii_only)
    ascii_only = re.sub(r"[^A-Za-z0-9._-]", "_", ascii_only)
    ascii_only = ascii_only.strip("._") or "resource"
    return ascii_only[:120]


def _build_content_disposition(filename: str) -> str:
    safe_name = _safe_filename(filename)
    ascii_name = _ascii_filename(safe_name)
    utf8_name = quote(safe_name)
    return f"attachment; filename={ascii_name}; filename*=UTF-8''{utf8_name}"


async def _render_resource_pdf(item: dict[str, Any]) -> bytes:
    source_url = _resource_source_url(item)
    html_content = str(item.get("content", "") or "")
    title = str(item.get("title", "Learning Document") or "Learning Document")

    try:
        if source_url:
            remote_html = await _fetch_url_text(source_url)
            html_doc = _inject_base_and_print_style(remote_html, source_url)
        else:
            html_doc = _markdown_as_printable_html(title=title, markdown_text=html_content)

        return await asyncio.to_thread(_render_pdf_from_html_sync, html_doc)
    except HTTPException:
        raise
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"pdf render failed: {type(ex).__name__}: {repr(ex)}") from ex


def _render_pdf_from_html_sync(html_doc: str) -> bytes:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as ex:  # pragma: no cover
        raise HTTPException(
            status_code=500,
            detail=f"playwright not installed: {ex}",
        ) from ex

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.set_content(html_doc, wait_until="domcontentloaded")
            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "14mm", "right": "12mm", "bottom": "14mm", "left": "12mm"},
            )
            return pdf_bytes
        finally:
            browser.close()


def _markdown_as_printable_html(*, title: str, markdown_text: str) -> str:
    body = escape(markdown_text or "").replace("\n", "<br/>")
    safe_title = escape(title)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>{safe_title}</title>
  <style>
    @page {{ size: A4; margin: 14mm; }}
    body {{
      font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1f2937;
      margin: 0;
      background: #fff;
    }}
    h1 {{ font-size: 26px; margin: 0 0 18px; }}
    .content {{ white-space: normal; word-break: break-word; }}
  </style>
</head>
<body>
  <h1>{safe_title}</h1>
  <div class="content">{body}</div>
</body>
</html>"""


def _inject_base_and_print_style(html: str, source_url: str) -> str:
    safe_link = source_url.replace('"', "&quot;")
    print_style = """
<style>
  @page { size: A4; margin: 14mm; }
  html, body { background: #ffffff !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  nav, header, footer, .no-print, [data-no-print="true"] { display: none !important; }
</style>
"""
    if "<head" in html.lower():
        out = re.sub(
            r"(<head[^>]*>)",
            r'\1<base href="' + safe_link + '" />' + print_style,
            html,
            count=1,
            flags=re.IGNORECASE,
        )
        return out
    return f'<base href="{safe_link}" />{print_style}{html}'


def _sanitize_url(url: str) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        return ""

    # Decode once to catch cases like %5Cn from escaped newlines.
    decoded = unquote(cleaned)

    # Remove escaped newline/tab tokens and then trim obvious markdown tails.
    decoded = (
        decoded.replace("\\n", "")
        .replace("\\r", "")
        .replace("\\t", "")
        .replace("\n", "")
        .replace("\r", "")
        .replace("\t", "")
    )

    for marker in ("##", "# ", "###", "```", "</", "<", "|"):
        idx = decoded.find(marker)
        if idx > 0:
            decoded = decoded[:idx]

    # Trim punctuation/noise that often sticks to URLs in markdown text.
    decoded = decoded.rstrip('.,;:!?"\' )]>')
    return decoded.strip()


def _is_valid_url(url: str) -> bool:
    if not url:
        return False
    try:
        p = urlparse(url)
        if p.scheme not in {"http", "https"}:
            return False
        if not p.netloc:
            return False
        if any(ch in url for ch in ("\n", "\r", "\\n", "\\r")):
            return False
        return True
    except Exception:
        return False


def _extract_marked_url(text: str) -> str:
    if not text:
        return ""
    first_line = text.splitlines()[0].strip() if text.splitlines() else ""
    m = re.match(r"^SOURCE_URL:\s*(.+)$", first_line, flags=re.IGNORECASE)
    if not m:
        return ""
    value = _sanitize_url(m.group(1).strip())
    if value.upper() == "NONE":
        return ""
    return value if _is_valid_url(value) else ""


def _strip_marked_url(text: str) -> str:
    if not text:
        return text
    lines = text.splitlines()
    if not lines:
        return text
    if re.match(r"^SOURCE_URL:\s*", lines[0].strip(), flags=re.IGNORECASE):
        return "\n".join(lines[1:])
    return text


def _resource_source_url(item: dict[str, Any]) -> str:
    raw = str(item.get("source_url") or "").strip()
    if _is_valid_url(raw):
        return raw
    return _extract_marked_url(str(item.get("content", "")))


def _normalize_generated_content(content: str, source_url: str) -> str:
    lines = [ln.strip() for ln in (content or "").splitlines()]
    kept: list[str] = []
    for line in lines:
        if not line:
            continue
        lower = line.lower()
        if "generate_answer_finish" in lower:
            continue
        if line.startswith("{") and "msg_type" in lower:
            continue
        if source_url and line == source_url:
            continue
        # skip markdown link that points to same source_url
        if source_url and re.search(r"\[[^\]]+\]\((https?://[^\s)]+)\)", line):
            m = re.search(r"\[[^\]]+\]\((https?://[^\s)]+)\)", line)
            if m and _sanitize_url(m.group(1)) == source_url:
                continue
        kept.append(line)
    return "\n\n".join(kept).strip()
