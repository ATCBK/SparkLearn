import asyncio
import inspect
import ipaddress
import json
import os
import re
import shutil
import uuid
import zipfile
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from html import escape, unescape as html_unescape
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

from ..coze import coze_adapter
from ..auth import get_current_user, get_current_user_for_url_access
from ..config import settings
from ..db import execute, fetch_all, fetch_one
from ..llm import spark_lite
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json
from ..xfyun_ppt import XfyunPptError, xfyun_ppt_client
from .common import sse_wrap
from .knowledge import load_knowledge_context_async

router = APIRouter(prefix="/api/resources", tags=["resources"])


class GenerateReq(BaseModel):
    type: str = "document"
    prompt: str
    knowledge_file_ids: list[int] = []
    visual_mode: str = ""
    code_level: str = "beginner"


class CodeEvaluateReq(BaseModel):
    question: str
    student_code: str
    hint: str = ""


class ResourceQualityDimension(BaseModel):
    key: str
    label: str
    score: int
    level: str
    detail: str


class ResourceQualityResp(BaseModel):
    label: str
    summary: str
    advice: str
    dimensions: list[ResourceQualityDimension]


def _now_date() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


@router.get("")
async def get_resources(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    resources = read_json(user_id, "resources_index.json", [])
    # 合并视频资源
    video_resources = read_json(user_id, "video_resources.json", [])
    for vr in video_resources:
        resources.append({
            "id": vr.get("id", ""),
            "title": vr.get("title", "视频资源"),
            "type": "video",
            "status": vr.get("status", "completed"),
            "created_at": vr.get("created_at", ""),
            "content": f"# {vr.get('title', '视频')}\n\n视频资源，请前往视频中心播放。",
            "source_url": None,
            "progress": 100,
        })
    resources.extend(_web_material_resources(user_id))
    return ok(resources)


@router.post("/generate")
async def generate_resource(req: GenerateReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]

    async def gen() -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
        res_id = f"gen-{uuid.uuid4().hex[:8]}"
        yield ("progress", {"stage": "started", "resource_id": res_id, "progress": 5})
        resource_type = (req.type or "").strip().lower()
        rag_prompt = await _build_resource_prompt_with_rag(user_id, req.type, req.prompt, req.knowledge_file_ids)

        if resource_type == "ppt":
            try:
                yield ("progress", {"stage": "creating", "resource_id": res_id, "progress": 15})
                created = await xfyun_ppt_client.create_ppt(query=rag_prompt.strip() or "生成学习PPT")
                sid = str(created.get("sid", "")).strip()
                cover_img = str(created.get("coverImgSrc", "")).strip()
                title = str(created.get("title", "")).strip()

                yield ("progress", {"stage": "building", "resource_id": res_id, "progress": 35, "sid": sid})
                progress_data = await xfyun_ppt_client.wait_progress(sid)
                ppt_url = str(progress_data.get("pptUrl") or "").strip()
                if not _is_valid_url(ppt_url):
                    raise XfyunPptError("讯飞智文返回的 pptUrl 无效")

                yield ("progress", {"stage": "done", "resource_id": res_id, "progress": 95})
                content = (
                    f"已生成 PPT：{title or req.prompt[:20] or '智能演示文稿'}\n"
                    f"总页数：{int(progress_data.get('totalPages') or 0)}，已完成：{int(progress_data.get('donePages') or 0)}。\n"
                    "可在右侧进行预览或下载源文件。"
                )
                resource = {
                    "id": res_id,
                    "title": title or req.prompt[:20] or "新生成资源",
                    "type": "ppt",
                    "status": "completed",
                    "created_at": _now_date(),
                    "content": f"# {req.prompt}\n\n{content}",
                    "source_url": ppt_url,
                    "cover_img_src": cover_img or None,
                    "xf_sid": sid,
                    "progress": 100,
                }
            except Exception as ex:
                yield ("error", {"message": f"PPT 生成失败：{str(ex)}"})
                resource = {
                    "id": res_id,
                    "title": req.prompt[:20] or "新生成资源",
                    "type": "ppt",
                    "status": "failed",
                    "created_at": _now_date(),
                    "content": f"# {req.prompt}\n\nPPT 生成失败，请稍后重试。",
                    "source_url": None,
                    "progress": 100,
                }
        elif resource_type == "visual3d":
            yield ("progress", {"stage": "visual_scripting", "resource_id": res_id, "progress": 18})
            try:
                payload = await _generate_threejs_code_visual_payload(
                    topic=req.prompt,
                    level=req.code_level,
                    rag_prompt=rag_prompt,
                )
                payload["generation_mode"] = "ai"
                payload["provider"] = "deepseek"
                payload["model"] = "ds-pro"
                artifact = _save_code_visual_artifact(res_id, payload, resource_type="visual3d")
                resource = {
                    "id": res_id,
                    "title": artifact["title"],
                    "type": "visual3d",
                    "status": "completed",
                    "created_at": _now_date(),
                    "content": _code_visual_resource_markdown(payload),
                    "source_url": _code_artifact_url(res_id, resource_type="visual3d"),
                    "artifact_kind": "threejs",
                    "artifact_files": artifact["files"],
                    "generation_mode": "ai",
                    "provider": "deepseek",
                    "model": "ds-pro",
                    "progress": 100,
                }
                yield ("progress", {"stage": "artifact_saved", "resource_id": res_id, "progress": 95})
            except Exception as ex:
                fallback_payload = _build_safe_threejs_template_payload(req.prompt, str(ex))
                fallback_payload["generation_mode"] = "fallback_template"
                fallback_payload["provider"] = "deepseek"
                fallback_payload["model"] = "ds-pro"
                fallback_payload["fallback_reason"] = str(ex).strip() or "未知错误"
                artifact = _save_code_visual_artifact(res_id, fallback_payload, resource_type="visual3d")
                resource = {
                    "id": res_id,
                    "title": artifact["title"],
                    "type": "visual3d",
                    "status": "completed",
                    "created_at": _now_date(),
                    "content": _code_visual_resource_markdown(fallback_payload)
                    + f"\n\n## 生成说明\nAI 原始代码未通过校验，已使用安全模板兜底。\n\n失败原因：{str(ex).strip() or '未知错误'}",
                    "source_url": _code_artifact_url(res_id, resource_type="visual3d"),
                    "artifact_kind": "threejs",
                    "artifact_files": artifact["files"],
                    "generation_mode": "fallback_template",
                    "provider": "deepseek",
                    "model": "ds-pro",
                    "fallback_reason": str(ex).strip() or "未知错误",
                    "progress": 100,
                }
                yield ("progress", {"stage": "visual_fallback", "resource_id": res_id, "progress": 95})
        elif resource_type == "code" and (req.visual_mode or "").strip().lower() == "threejs":
            yield ("progress", {"stage": "visual_scripting", "resource_id": res_id, "progress": 18})
            try:
                payload = await _generate_threejs_code_visual_payload(
                    topic=req.prompt,
                    level=req.code_level,
                    rag_prompt=rag_prompt,
                )
                payload["generation_mode"] = "ai"
                payload["provider"] = "deepseek"
                payload["model"] = "ds-pro"
                artifact = _save_code_visual_artifact(res_id, payload)
                resource = {
                    "id": res_id,
                    "title": artifact["title"],
                    "type": "code",
                    "status": "completed",
                    "created_at": _now_date(),
                    "content": _code_visual_resource_markdown(payload),
                    "source_url": _code_artifact_url(res_id),
                    "artifact_kind": "threejs",
                    "artifact_files": artifact["files"],
                    "generation_mode": "ai",
                    "provider": "deepseek",
                    "model": "ds-pro",
                    "progress": 100,
                }
                yield ("progress", {"stage": "artifact_saved", "resource_id": res_id, "progress": 95})
            except Exception as ex:
                resource = {
                    "id": res_id,
                    "title": req.prompt[:20] or "代码可视化资源",
                    "type": "code",
                    "status": "completed",
                    "created_at": _now_date(),
                    "content": _fallback_code_visual_content(req.prompt, str(ex)),
                    "source_url": None,
                    "artifact_kind": "markdown_fallback",
                    "generation_mode": "markdown_fallback",
                    "provider": "deepseek",
                    "model": "ds-pro",
                    "fallback_reason": str(ex).strip() or "未知错误",
                    "progress": 100,
                }
                yield ("progress", {"stage": "visual_fallback", "resource_id": res_id, "progress": 95})
        elif resource_type == "blog":
            chunks: list[str] = []
            progress = 28
            yield ("progress", {"stage": "podcast_scripting", "resource_id": res_id, "progress": 12})
            script_brief = await _generate_podcast_script_brief(
                user_prompt=req.prompt,
                generation_prompt=rag_prompt,
            )

            yield ("progress", {"stage": "podcast_drafting", "resource_id": res_id, "progress": progress})
            blog_prompt = _build_podcast_final_prompt(req.prompt, script_brief)
            async for evt_type, payload in spark_lite.stream_chat_events(blog_prompt, mode="general", history=[]):
                if evt_type == "text":
                    chunk = str(payload.get("content", ""))
                    if chunk:
                        chunks.append(chunk)
                        progress = min(progress + 5, 90)
                        yield ("progress", {"stage": "podcast_drafting", "resource_id": res_id, "progress": progress})
                elif evt_type == "error":
                    yield ("error", payload)

            content = _sanitize_podcast_content("".join(chunks).strip())
            if not content:
                content = _fallback_resource_content("blog", req.prompt)
            else:
                yield ("text", {"content": content, "resource_id": res_id})

            resource = {
                "id": res_id,
                "title": req.prompt[:20] or "新生成播客",
                "type": "blog",
                "status": "completed",
                "created_at": _now_date(),
                "content": content,
                "source_url": None,
                "script_brief": script_brief,
                "progress": 100,
            }
        else:
            chunks: list[str] = []
            provider_errors: list[str] = []
            explicit_source_url = ""
            progress = 10
            resource_prompt = rag_prompt

            async for evt_type, payload in coze_adapter.stream_resource_text(
                resource_type=req.type,
                prompt=resource_prompt,
                user_id=user_id,
            ):
                if evt_type == "text":
                    chunk = str(payload.get("content", ""))
                    if chunk:
                        chunks.append(chunk)
                        progress = min(progress + 8, 90)
                        yield ("text", {"content": chunk, "resource_id": res_id})
                        yield ("progress", {"stage": "generating", "resource_id": res_id, "progress": progress})
                elif evt_type == "error":
                    message = str(payload.get("message") or payload.get("msg") or "Coze 生成失败")
                    provider_errors.append(message)
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
                yield ("progress", {"stage": "fallback", "resource_id": res_id, "progress": 45})
                spark_chunks: list[str] = []
                async for evt_type, payload in spark_lite.stream_chat_events(resource_prompt, mode="general", history=[]):
                    if evt_type == "text":
                        chunk = str(payload.get("content", ""))
                        if chunk:
                            spark_chunks.append(chunk)
                            progress = min(progress + 6, 90)
                            yield ("text", {"content": chunk, "resource_id": res_id})
                            yield ("progress", {"stage": "fallback", "resource_id": res_id, "progress": progress})
                    elif evt_type == "error":
                        message = str(payload.get("message") or payload.get("msg") or "Spark 生成失败")
                        provider_errors.append(message)
                        yield ("error", payload)
                content = "".join(spark_chunks).strip()
            generation_failed = not content
            if generation_failed:
                content = _fallback_resource_content(req.type, req.prompt, provider_errors)
            marker_url = _extract_marked_url(content)
            source_url = explicit_source_url or marker_url
            content = _strip_marked_url(content).strip()
            content = _normalize_generated_content(content, source_url)
            if source_url and not content:
                content = "已生成网页资源，请使用预览或下载查看。"

            resource = {
                "id": res_id,
                "title": req.prompt[:20] or "新生成资源",
                "type": req.type,
                "status": "failed" if generation_failed else "completed",
                "created_at": _now_date(),
                "content": f"# {req.prompt}\n\n{content}",
                "source_url": source_url or None,
                "progress": 100,
            }

        resources = read_json(user_id, "resources_index.json", [])
        resources.append(resource)
        write_json(user_id, "resources_index.json", resources)
        append_jsonl(user_id, "resource_usage.jsonl", {"type": "resource_generated", "resource_id": res_id})
        yield ("done", {"resource_id": res_id, "resource": resource})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.post("/code/evaluate/{resource_id}")
async def evaluate_code_resource(resource_id: str, req: CodeEvaluateReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    item = _find_resource(user_id, resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    if str(item.get("type", "")) != "code":
        raise HTTPException(status_code=400, detail="only code resources can be evaluated")

    student_code = req.student_code.strip()
    if not student_code:
        raise HTTPException(status_code=400, detail="student_code is required")

    result = await _evaluate_code_with_ai(
        resource_title=str(item.get("title") or "代码练习"),
        resource_content=str(item.get("content") or ""),
        question=req.question.strip(),
        hint=req.hint.strip(),
        student_code=student_code,
    )
    append_jsonl(user_id, "resource_code_evaluations.jsonl", {
        "resource_id": resource_id,
        "question": req.question.strip(),
        "student_code": student_code,
        "correct": result["correct"],
        "reason": result["reason"],
    })
    return ok(result)


@router.post("/{resource_id}/quality-evaluate")
async def evaluate_resource_quality(resource_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    item = _find_resource(user_id, resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")

    profile = read_json(user_id, "profile_snapshot.json", {})
    result = await _evaluate_resource_quality(item, profile if isinstance(profile, dict) else {})
    return ok(result)


@router.get("/{resource_id}")
async def get_resource_detail(resource_id: str, current_user: dict = Depends(get_current_user)):
    item = _find_resource(current_user["user_id"], resource_id)
    return ok(item)


@router.get("/{resource_id}/preview")
async def get_resource_preview(resource_id: str, current_user: dict = Depends(get_current_user)):
    item = _find_resource(current_user["user_id"], resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    artifact_link = str(item.get("source_url") or "")
    artifact_type = _artifact_type_from_url(artifact_link)
    if artifact_type:
        return ok({"url": artifact_link, "available": _code_artifact_file(resource_id, "index.html", resource_type=artifact_type).exists()})
    link = _resource_source_url(item)
    return ok({"url": link, "available": bool(link)})


@router.get("/{resource_id}/preview/html")
async def get_resource_preview_html(resource_id: str, current_user: dict = Depends(get_current_user_for_url_access)):
    item = _find_resource(current_user["user_id"], resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    artifact_link = str(item.get("source_url") or "")
    artifact_type = _artifact_type_from_url(artifact_link)
    if artifact_type:
        index_path = _code_artifact_file(resource_id, "index.html", resource_type=artifact_type)
        if not index_path.exists():
            raise HTTPException(status_code=404, detail="visual artifact not found")
        html = index_path.read_text(encoding="utf-8")
        html = _inject_code_artifact_base(html, resource_id)
        html = _inline_code_artifact_assets(html, resource_id, resource_type=artifact_type)
        return HTMLResponse(content=html, headers=_code_artifact_security_headers())

    link = _resource_source_url(item)

    # 没有外部链接时，直接渲染自身 content
    if not link:
        return HTMLResponse(content=_render_content_as_html(item))

    if _is_ppt_like_url(link):
        return HTMLResponse(content=_build_ppt_preview_html(link))

    if _is_shutu_url(link):
        try:
            html = await _fetch_url_text(link)
            image_url = _extract_shutu_image_url(html)
            if not image_url:
                image_url = await asyncio.to_thread(_extract_shutu_image_url_from_page_sync, link)
            if image_url:
                return HTMLResponse(content=_build_pan_zoom_image_preview_html(image_url, title=str(item.get("title") or "思维导图")))
        except Exception:
            pass

    if _is_iframe_embeddable_url(link):
        return HTMLResponse(content=_build_iframe_preview_html(link))

    try:
        html = await _fetch_url_text(link)
        safe_link = link.replace('"', "&quot;")
        if "<head" in html.lower():
            html = re.sub(r"(<head[^>]*>)", r'\1<base href="' + safe_link + '" />', html, count=1, flags=re.IGNORECASE)
        else:
            html = f'<base href="{safe_link}" />\n{html}'
        return HTMLResponse(content=html, headers=_code_artifact_security_headers())
    except Exception:
        # 外部 URL 获取失败（SSL 过期、404 等），fallback 显示资源自身内容
        return HTMLResponse(content=_render_content_as_html(item))


@router.get("/{resource_id}/preview/files/{file_path:path}")
async def get_code_artifact_preview_file(resource_id: str, file_path: str, current_user: dict = Depends(get_current_user_for_url_access)):
    item = _find_resource(current_user["user_id"], resource_id)
    artifact_type = _artifact_type_from_url(str(item.get("source_url") or "")) if item else ""
    if not item or not artifact_type:
        raise HTTPException(status_code=404, detail="visual artifact not found")
    target = _code_artifact_file(resource_id, file_path, resource_type=artifact_type)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="code artifact file not found")
    media_type = "text/javascript; charset=utf-8" if target.suffix == ".js" else "text/css; charset=utf-8"
    return StreamingResponse(iter([target.read_bytes()]), media_type=media_type, headers={**_code_artifact_security_headers(), "Cache-Control": "no-store"})


@router.get("/{resource_id}/download")
async def download_resource(resource_id: str, current_user: dict = Depends(get_current_user_for_url_access)):
    return await download_resource_pdf(resource_id, current_user)


@router.get("/{resource_id}/download/html")
async def download_resource_html(resource_id: str, current_user: dict = Depends(get_current_user_for_url_access)):
    item = _find_resource(current_user["user_id"], resource_id)
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
            headers={"Content-Disposition": _build_content_disposition(_safe_filename(title + ".md")), "Cache-Control": "no-store"},
        )

    html = await _fetch_url_text(link)
    return StreamingResponse(
        iter([html.encode("utf-8")]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": _build_content_disposition(filename), "Cache-Control": "no-store"},
    )


@router.get("/{resource_id}/download/pdf")
async def download_resource_pdf(resource_id: str, current_user: dict = Depends(get_current_user_for_url_access)):
    item = _find_resource(current_user["user_id"], resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    title = str(item.get("title", "resource")).strip() or "resource"
    filename = _safe_filename(f"{title}.pdf")
    pdf_bytes = await _render_resource_pdf(item)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": _build_content_disposition(filename), "Cache-Control": "no-store"},
    )


@router.get("/{resource_id}/download/source")
async def download_resource_source(resource_id: str, current_user: dict = Depends(get_current_user_for_url_access)):
    item = _find_resource(current_user["user_id"], resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
    artifact_link = str(item.get("source_url") or "")
    artifact_type = _artifact_type_from_url(artifact_link)
    if artifact_type:
        title = str(item.get("title", "visual-resource")).strip() or "visual-resource"
        data = await asyncio.to_thread(_zip_code_artifact_sync, resource_id, artifact_type)
        return StreamingResponse(
            iter([data]),
            media_type="application/zip",
            headers={"Content-Disposition": _build_content_disposition(_safe_filename(title + ".zip")), "Cache-Control": "no-store"},
        )

    source_url = _resource_source_url(item)
    if not source_url:
        raise HTTPException(status_code=404, detail="source link not found")

    data, content_type = await _fetch_url_binary(source_url)
    title = str(item.get("title", "resource")).strip() or "resource"
    ext = _guess_extension(source_url, content_type)
    filename = _safe_filename(f"{title}{ext}")
    return StreamingResponse(
        iter([data]),
        media_type=content_type or "application/octet-stream",
        headers={"Content-Disposition": _build_content_disposition(filename), "Cache-Control": "no-store"},
    )


@router.delete("/{resource_id}")
async def delete_resource(resource_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    if resource_id.startswith("webmat-"):
        file_id = _web_material_id(resource_id)
        if file_id:
            row = fetch_one("SELECT id, stored_path FROM tutor_files WHERE id = ? AND user_id = ? AND source_type = 'web_capture'", (file_id, user_id))
            if row:
                path = Path(str(row["stored_path"] or ""))
                if path.exists() and path.is_file():
                    path.unlink()
                execute("DELETE FROM tutor_file_chunks WHERE file_id = ?", (file_id,))
                execute("DELETE FROM tutor_files WHERE id = ? AND user_id = ?", (file_id, user_id))
                return ok({"resource_id": resource_id, "deleted": True})
        return ok({"resource_id": resource_id, "deleted": False})

    video_resources = read_json(user_id, "video_resources.json", [])
    if any(str(item.get("id", "")) == resource_id for item in video_resources):
        from .video import delete_video_resource_for_user

        deleted = delete_video_resource_for_user(user_id, resource_id)
        return ok({"resource_id": resource_id, "deleted": deleted})

    resources = read_json(user_id, "resources_index.json", [])
    before = len(resources)
    next_resources = [r for r in resources if str(r.get("id", "")) != resource_id]
    removed = before - len(next_resources)
    write_json(user_id, "resources_index.json", next_resources)
    append_jsonl(user_id, "resource_usage.jsonl", {"type": "resource_deleted", "resource_id": resource_id, "removed_count": removed})
    return ok({"resource_id": resource_id, "deleted": removed > 0})


@router.get("/recommendations/list")
async def get_recommendations(current_user: dict = Depends(get_current_user)):
    resources = read_json(current_user["user_id"], "resources_index.json", [])
    if not resources:
        return ok([])

    reason_map = [
        ("因为你当前基础较弱，建议先从这份资源开始补强。", "remedial"),
        ("基于你当前学习阶段，这份资源是更合适的下一步。", "stage"),
        ("今日复习建议：用这份资源做一次巩固练习。", "today"),
    ]
    recs: list[dict[str, Any]] = []
    for idx, resource in enumerate(resources[:3]):
        reason, category = reason_map[idx]
        recs.append({"id": f"rec{idx + 1}", "resource": resource, "reason": reason, "category": category})
    return ok(recs)


def _default_resources() -> list[dict[str, Any]]:
    return [
        {"id": "r1", "title": "变量与数据类型", "type": "document", "status": "completed", "created_at": "2026-04-15", "content": "# 变量与数据类型\n\n..."},
        {"id": "r2", "title": "Python 函数基础 PPT", "type": "ppt", "status": "completed", "created_at": "2026-04-14", "docmee_id": "demo-1"},
        {"id": "r3", "title": "条件逻辑思维导图", "type": "mindmap", "status": "completed", "created_at": "2026-04-13", "content": "# 条件逻辑\n\n..."},
        {"id": "r4", "title": "函数练习题集", "type": "quiz", "status": "completed", "created_at": "2026-04-12"},
        {"id": "r5", "title": "Python 标准库拓展阅读", "type": "reading", "status": "completed", "created_at": "2026-04-11", "content": "# Python 标准库\n\n..."},
        {"id": "r6", "title": "装饰器代码案例", "type": "code", "status": "completed", "created_at": "2026-04-10", "content": "```python\n...\n```"},
    ]


def _build_resource_prompt(resource_type: str, user_prompt: str, user_id: str) -> str:
    base = user_prompt.strip()
    profile_context = _profile_context_for_generation(user_id)
    if profile_context and resource_type != "document":
        base = f"{base}\n\n用户画像上下文:\n{profile_context}"
    if resource_type == "document":
        return base
    if resource_type == "mindmap":
        return base
    if resource_type == "quiz":
        return "请生成练习题（Markdown），包含题目、答案与解析，覆盖简单/中等/困难。\n\n主题：" + base
    if resource_type == "reading":
        return "请生成拓展阅读文档（Markdown），包含背景、关键知识、应用场景、延伸阅读建议。\n\n主题：" + base
    if resource_type == "code":
        return "请生成代码学习案例（Markdown），包含问题描述、完整代码、讲解与扩展练习。\n\n主题：" + base
    if resource_type == "blog":
        return (
            "你是一位专业的播客主播兼科普作者。请根据以下学习主题，生成一篇适合语音朗读的播客电台脚本。\n\n"
            "要求：\n"
            "1. 用口语化、亲切自然的语气，像在和听众聊天一样讲解知识\n"
            '2. 开头用一句吸引人的引入语（比如"嘿，大家好，欢迎收听今天的 SparkLearn 播客电台"）\n'
            "3. 把知识点拆成 3-5 个小段落，每段之间用自然的过渡语连接\n"
            "4. 多用生活化的类比和例子来解释抽象概念\n"
            "5. 结尾做一个简短总结，并给出一个思考问题\n"
            "6. 不要使用 Markdown 格式符号（不要 #、*、`、- 等），纯文本即可\n"
            "7. 每个段落之间用两个空行分隔（方便拆分为多个音频片段）\n"
            "8. 总长度控制在 800-1500 字，适合 5-8 分钟的音频播放\n\n"
            "主题：" + base
        )
    return base


async def _collect_spark_text(prompt: str, mode: str = "general") -> str:
    chunks: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode=mode, history=[]):
        if evt_type == "text":
            chunk = str(payload.get("content", ""))
            if chunk:
                chunks.append(chunk)
    return "".join(chunks).strip()


async def _generate_podcast_script_brief(user_prompt: str, generation_prompt: str) -> str:
    planning_prompt = _build_podcast_planning_prompt(user_prompt, generation_prompt)
    script = await _collect_spark_text(planning_prompt)
    if script:
        return script[:5000]
    return _fallback_podcast_script_brief(user_prompt)


def _build_podcast_planning_prompt(user_prompt: str, generation_prompt: str) -> str:
    return (
        "你是 SparkLearn 的资源生成编排 Agent。请先根据学习者需求、用户画像上下文和知识库内容，"
        "分析并生成播客制作脚本，而不是直接输出最终播客正文。\n\n"
        "必须完成以下结构：\n"
        "1. 学习者意图：用一句话说明这期播客真正要解决的问题。\n"
        "2. 画像依据：列出可以用于个性化讲解的专业、目标、薄弱点或偏好；没有依据就写“暂无明确画像依据”。\n"
        "3. 知识依据：列出来自知识库或题目本身的关键事实，避免无依据扩写。\n"
        "4. 播客结构：给出开场、3-5 个正文段落、结尾，每段写清楚讲解目标、类比或例子、过渡方式。\n"
        "5. 语气与约束：说明适合 TTS 朗读的语速、句长、禁用格式。\n\n"
        "输出要求：只输出脚本策划，不要写最终播客正文，不要使用 Markdown 标题。\n\n"
        f"用户原始需求：\n{user_prompt.strip()}\n\n"
        f"资源生成上下文：\n{generation_prompt.strip()}"
    )


def _build_podcast_final_prompt(user_prompt: str, script_brief: str) -> str:
    return (
        "你是一位专业的播客主播兼科普作者。请严格根据下方“播客制作脚本”生成最终可朗读的播客电台正文。\n\n"
        "要求：\n"
        "1. 必须落实脚本中的学习者意图、画像依据、知识依据和段落结构\n"
        "2. 用口语化、亲切自然的语气，像在和听众聊天一样讲解知识\n"
        "3. 开头用一句吸引人的引入语，并自然说明今天要解决的问题\n"
        "4. 把知识点拆成 3-5 个小段落，每段之间用自然过渡语连接\n"
        "5. 多用生活化类比和例子解释抽象概念，不编造知识库没有支撑的事实\n"
        "6. 结尾做简短总结，并给出一个思考问题或动手任务\n"
        "7. 不要使用 Markdown 格式符号（不要 #、*、`、- 等），纯文本即可\n"
        "8. 每个段落之间用两个空行分隔，便于拆分为多个音频片段\n"
        "9. 总长度控制在 800-1500 字，适合 5-8 分钟音频播放\n\n"
        "输出边界：只输出播客正文，不要输出 SOURCE_URL、提示词、脚本策划、字段名或任何内部说明。\n\n"
        f"用户原始需求：\n{user_prompt.strip()}\n\n"
        f"播客制作脚本：\n{script_brief.strip()}"
    )


def _fallback_podcast_script_brief(user_prompt: str) -> str:
    topic = user_prompt.strip() or "本次学习主题"
    return (
        f"学习者意图：围绕“{topic}”生成一段适合听的知识讲解。\n"
        "画像依据：暂无明确画像依据。\n"
        "知识依据：以用户原始需求为核心，不补充无依据的细节。\n"
        "播客结构：开场说明问题；正文分为概念解释、生活类比、常见误区、练习建议；结尾总结并提出思考任务。\n"
        "语气与约束：口语化、短句、自然过渡、纯文本、适合 TTS 朗读。"
    )


def _sanitize_podcast_content(content: str) -> str:
    text = _strip_marked_url(content).strip()
    text = re.sub(r"(?is)<!--\s*PODCAST_SCRIPT_BRIEF.*?-->", "", text).strip()
    text = re.sub(r"(?im)^\s*(播客制作脚本|脚本策划|系统提示词|提示词|用户原始需求|资源生成上下文)\s*[:：].*$", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


async def _build_resource_prompt_with_rag(user_id: str, resource_type: str, user_prompt: str | list[int], knowledge_file_ids: list[int] | None = None) -> str:
    if isinstance(user_prompt, list):
        knowledge_file_ids = user_prompt
        user_prompt = resource_type
        resource_type = user_id
        user_id = settings.single_user_id
    base = _build_resource_prompt(resource_type, user_prompt, user_id)

    file_ids = _resolve_generation_knowledge_file_ids(user_id, knowledge_file_ids or [])
    if not file_ids:
        return base

    load_kwargs: dict[str, Any] = {"query": user_prompt}
    if "max_chars" in inspect.signature(load_knowledge_context_async).parameters:
        load_kwargs["max_chars"] = 4200
    context = await load_knowledge_context_async(file_ids, user_id=user_id, **load_kwargs)
    if not context.strip():
        return base
    return (
        f"{base}\n\n"
        "学科知识库检索上下文:\n"
        f"{context}\n\n"
        "请优先依据以上知识库内容生成，若需要补充常识，请保持与知识库一致。"
    )


def _resolve_generation_knowledge_file_ids(user_id: str, explicit_ids: list[int]) -> list[int]:
    ids = [int(x) for x in explicit_ids if int(x) > 0]
    if ids:
        return ids

    subject_name = _current_profile_subject_name(user_id)
    if not subject_name:
        return []
    rows = fetch_all(
        """
        SELECT id
        FROM knowledge_files
        WHERE user_id = ? AND status = 'indexed' AND subject_name = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 8
        """,
        (user_id, subject_name),
    )
    return [int(row["id"]) for row in rows]


def _current_profile_subject_name(user_id: str) -> str:
    profile = read_json(user_id, "profile_snapshot.json", {})
    if isinstance(profile, dict):
        major = str(profile.get("major") or "").strip()
        if major:
            return major
    student = fetch_one("SELECT major FROM students WHERE user_id = ?", (user_id,))
    return str(student["major"]).strip() if student and student["major"] else ""


def _profile_context_for_generation(user_id: str) -> str:
    profile = read_json(user_id, "profile_snapshot.json", {})
    if not isinstance(profile, dict) or not profile:
        return ""
    parts = []
    student = fetch_one("SELECT major FROM students WHERE user_id = ?", (user_id,))
    major = str(profile.get("major") or "").strip()
    if not major and student and student["major"]:
        major = str(student["major"]).strip()
    if major:
        parts.append(f"专业方向: {major}")
    goal = profile.get("goal", [])
    if isinstance(goal, list) and goal:
        parts.append(f"学习目标: {json_like(goal)}")
    knowledge_level = str(profile.get("knowledge_level") or "").strip()
    if knowledge_level:
        parts.append(f"知识基础: {knowledge_level}")
    weak_points = profile.get("weak_points", [])
    if isinstance(weak_points, list) and weak_points:
        parts.append(f"薄弱点: {json_like(weak_points)}")
    learning_preference = profile.get("learning_preference", [])
    if isinstance(learning_preference, list) and learning_preference:
        parts.append(f"学习偏好: {json_like(learning_preference)}")
    return "\n".join(parts)


def json_like(value: Any) -> str:
    return ", ".join(str(item) for item in value if str(item).strip())


async def _evaluate_resource_quality(item: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    dimensions = _build_quality_dimensions(item, profile)
    label = _resolve_quality_label(dimensions)
    summary, advice = await _build_quality_ai_copy(item, profile, label, dimensions)
    return ResourceQualityResp(
        label=label,
        summary=summary,
        advice=advice,
        dimensions=[ResourceQualityDimension(**dimension) for dimension in dimensions],
    ).model_dump()


def _build_quality_dimensions(item: dict[str, Any], profile: dict[str, Any]) -> list[dict[str, Any]]:
    content = str(item.get("content") or "").strip()
    title = str(item.get("title") or "").strip()
    resource_type = str(item.get("type") or "document").strip()
    weak_points = profile.get("weak_points", []) if isinstance(profile.get("weak_points", []), list) else []
    preferences = profile.get("learning_preference", []) if isinstance(profile.get("learning_preference", []), list) else []
    goals = profile.get("goal", []) if isinstance(profile.get("goal", []), list) else []
    stage = str(profile.get("current_stage") or "").strip()

    search_text = f"{title}\n{content}\n{resource_type}".lower()
    fit_hits = 0
    for group in (weak_points[:4], goals[:3], [stage] if stage else []):
        for token in group:
            token_text = str(token).strip().lower()
            if token_text and token_text in search_text:
                fit_hits += 1
    type_fit_bonus = 1 if any(pref in resource_type or pref in content for pref in ["代码", "练习", "视频", "图", "示例"] if pref) else 0
    fit_score = min(100, 35 + fit_hits * 20 + type_fit_bonus * 8)
    if not content:
        fit_score = min(fit_score, 42)

    normalized = re.sub(r"\s+", " ", content)
    has_sections = len(re.findall(r"^#+\s|\n#+\s|：|\d+\.", content, flags=re.MULTILINE)) >= 2
    has_examples = any(marker in content.lower() for marker in ["示例", "例如", "example", "```", "步骤"])
    clarity_score = 24
    if normalized:
        clarity_score += min(38, max(0, len(normalized) // 45))
    if has_sections:
        clarity_score += 18
    if has_examples:
        clarity_score += 16
    clarity_score = min(100, clarity_score)

    practice_markers = ["练习", "自测", "题", "代码", "思考", "quiz", "task", "```"]
    practice_hits = sum(1 for marker in practice_markers if marker in content.lower())
    practice_score = 26 + practice_hits * 12
    if resource_type in {"quiz", "code"}:
        practice_score += 24
    elif resource_type in {"ppt", "document"}:
        practice_score += 10
    practice_score = min(100, practice_score)

    priority_score = int(round(fit_score * 0.45 + clarity_score * 0.2 + practice_score * 0.35))
    if not weak_points and not goals and not stage:
        priority_score = max(48, min(priority_score, 72))

    return [
        _dimension_payload("fit", "学情匹配", fit_score, _fit_detail(fit_score, weak_points, stage)),
        _dimension_payload("clarity", "内容清晰", clarity_score, _clarity_detail(clarity_score, has_sections, has_examples)),
        _dimension_payload("practice", "练习支撑", practice_score, _practice_detail(practice_score, resource_type)),
        _dimension_payload("priority", "当前优先级", priority_score, _priority_detail(priority_score)),
    ]


def _dimension_payload(key: str, label: str, score: int, detail: str) -> dict[str, Any]:
    level = "high" if score >= 75 else "medium" if score >= 50 else "low"
    return {
        "key": key,
        "label": label,
        "score": max(0, min(100, int(score))),
        "level": level,
        "detail": detail,
    }


def _resolve_quality_label(dimensions: list[dict[str, Any]]) -> str:
    scores = {item["key"]: int(item["score"]) for item in dimensions}
    fit_score = scores.get("fit", 0)
    priority_score = scores.get("priority", 0)
    average = round(sum(scores.values()) / max(len(scores), 1))
    if fit_score >= 75 and priority_score >= 72 and average >= 68:
        return "较适合"
    if fit_score <= 45 or priority_score <= 45:
        return "暂不优先"
    return "可补充"


async def _build_quality_ai_copy(
    item: dict[str, Any],
    profile: dict[str, Any],
    label: str,
    dimensions: list[dict[str, Any]],
) -> tuple[str, str]:
    title = str(item.get("title") or "当前资源").strip()
    resource_type = str(item.get("type") or "document").strip()
    content = str(item.get("content") or "").strip()
    profile_summary = _quality_profile_summary(profile)
    dimensions_text = "\n".join(
        f"- {dimension['label']}: {dimension['score']} / 100，{dimension['detail']}" for dimension in dimensions
    )
    prompt = (
        "你是学习规划老师。请根据已有规则评估结果，给出简短中文总结。\n"
        "不要推翻标签，不要重打分，不要使用 Markdown 列表，不要超过两句话。\n"
        "返回 JSON，格式必须是："
        "{\"summary\":\"一句总评\",\"advice\":\"一到两句建议\"}\n\n"
        f"资源标题：{title}\n"
        f"资源类型：{resource_type}\n"
        f"资源内容摘要：{content[:1200]}\n"
        f"当前学情：{profile_summary}\n"
        f"规则标签：{label}\n"
        f"规则维度：\n{dimensions_text}\n"
    )

    chunks: list[str] = []
    try:
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode="general", history=[]):
            if evt_type == "text":
                chunk = str(payload.get("content", ""))
                if chunk:
                    chunks.append(chunk)
        text = "".join(chunks).strip()
        data = json.loads(_extract_first_json(text))
        summary = str(data.get("summary") or "").strip()
        advice = str(data.get("advice") or "").strip()
        if summary or advice:
            return (
                summary or _default_quality_summary(label, title),
                advice or _default_quality_advice(label),
            )
    except Exception:
        pass
    return _default_quality_summary(label, title), _default_quality_advice(label)


def _extract_first_json(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start:end + 1]
    return "{}"


def _quality_profile_summary(profile: dict[str, Any]) -> str:
    goal = "、".join(str(item) for item in profile.get("goal", [])[:2]) or "未标记目标"
    weak = "、".join(str(item) for item in profile.get("weak_points", [])[:3]) or "未标记薄弱点"
    preference = "、".join(str(item) for item in profile.get("learning_preference", [])[:2]) or "常规讲解"
    stage = str(profile.get("current_stage") or "").strip() or "未标记阶段"
    return f"阶段：{stage}；薄弱点：{weak}；偏好：{preference}；目标：{goal}"


def _fit_detail(score: int, weak_points: list[Any], stage: str) -> str:
    if score >= 75:
        return f"内容和当前阶段{stage or '当前阶段'}、薄弱点较对口"
    if score >= 50:
        return "和当前学习任务有一定关联，但不是最直接命中"
    if weak_points:
        return "和当前薄弱点关联偏弱，更适合作为补充材料"
    return "缺少完整学情时只能做基础匹配判断"


def _clarity_detail(score: int, has_sections: bool, has_examples: bool) -> str:
    if score >= 75:
        return "结构完整，阅读路径清晰"
    if score >= 50:
        if has_sections or has_examples:
            return "有基本结构，但讲解层次还可以更明确"
        return "正文存在，但示例和分段还不够充分"
    return "内容较短或结构不足，理解成本偏高"


def _practice_detail(score: int, resource_type: str) -> str:
    if score >= 75:
        return "带有较强的练习或动手支撑"
    if score >= 50:
        return f"{resource_type} 形式能辅助学习，但练习闭环一般"
    return "练习支撑较弱，更偏阅读型输入"


def _priority_detail(score: int) -> str:
    if score >= 75:
        return "适合现在优先投入时间学习"
    if score >= 50:
        return "可以安排学习，但优先级不是最高"
    return "现阶段不建议优先投入过多时间"


def _default_quality_summary(label: str, title: str) -> str:
    if label == "较适合":
        return f"{title} 和你当前学情匹配度较高，适合作为现在的主学习资源。"
    if label == "暂不优先":
        return f"{title} 有参考价值，但和你当前最需要补的内容并不完全对口。"
    return f"{title} 可以作为补充材料使用，但不是当前最优先的一份资源。"


def _default_quality_advice(label: str) -> str:
    if label == "较适合":
        return "建议先完整看完这份资源，再接一组短练习做巩固。"
    if label == "暂不优先":
        return "建议先补当前薄弱点最直接相关的资源，再回来看这份内容。"
    return "建议把它放在主资源之后，用来补例子或做延伸阅读。"


async def _generate_threejs_code_visual_payload(*, topic: str, level: str, rag_prompt: str) -> dict[str, Any]:
    prompt = _build_threejs_code_visual_prompt(topic=topic, level=level, rag_context=rag_prompt)
    chunks: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode="general", history=[], model="ds-pro"):
        if evt_type == "text":
            chunk = str(payload.get("content", ""))
            if chunk:
                chunks.append(chunk)
        elif evt_type == "error":
            message = str(payload.get("message") or payload.get("error") or "DeepSeek 代码可视化生成失败")
            raise ValueError(message)
    return _parse_threejs_code_visual_payload("".join(chunks))


def _build_threejs_code_visual_prompt(*, topic: str, level: str, rag_context: str) -> str:
    return (
        "你是 SparkLearn 的代码可视化资源生成智能体。请根据学习主题生成一个可本地预览的 Three.js 教学动画资源。\n\n"
        f"学习主题：{topic.strip()}\n"
        f"学习者水平：{(level or 'beginner').strip()}\n"
        f"知识库上下文：{rag_context.strip()}\n"
        "输出语言：中文\n\n"
        "只输出合法 JSON，不要输出 Markdown。JSON 必须包含：\n"
        "{\n"
        '  "title": "资源标题",\n'
        '  "teaching_goal": "学习目标",\n'
        '  "concept_explanation": "概念解释",\n'
        '  "files": [\n'
        '    {"path": "index.html", "content": "完整 HTML，包含 canvas 容器和模块脚本"},\n'
        '    {"path": "src/main.js", "content": "完整 Three.js 代码"}\n'
        "  ],\n"
        '  "interactions": ["学习者可操作项"],\n'
        '  "acceptance": ["验收标准"],\n'
        '  "safety_notes": ["安全说明"]\n'
        "}\n\n"
        "重要：上面的字段值只是结构说明，严禁照抄“资源标题”“学习目标”“完整 HTML”“完整 Three.js 代码”等占位文字。\n"
        "files[].content 必须是真实可运行源码，index.html 必须是完整 HTML 文档，src/main.js 必须是完整 Three.js 模块脚本。\n\n"
        "生成要求：\n"
        "1. 代码必须可直接在浏览器 iframe 中运行，不能依赖构建工具。\n"
        "2. 只能使用 Three.js 官方 CDN 或系统提供的固定导入地址。\n"
        "3. 动画必须体现学习主题，不允许只做装饰性旋转物体。\n"
        "4. 必须包含播放/暂停、重置、全屏、退出全屏按钮，并包含一个 id=\"timelineSlider\" 的可拖动进度条，用于拖动查看算法或代码演示步骤。\n"
        "5. 所有屏幕文字使用中文。\n"
        "6. 不得访问网络 API、Cookie、localStorage、父窗口或用户文件。\n"
        "7. 不得输出省略号、伪代码或“请自行补充”。\n\n"
        "验收标准：\n"
        "1. 后端能保存 index.html、src/main.js、manifest.json 到本地 artifact 目录。\n"
        "2. /api/resources/{id}/preview/html 能打开动画预览。\n"
        "3. iframe 中 canvas 非空，动画在 3 秒内开始变化。\n"
        "4. 控件可点击，timelineSlider 拖动后必须改变当前演示步骤或动画状态。\n"
        "5. 资源库能展示标题、说明、预览入口和源码下载入口。\n"
        "6. 生成失败时返回明确错误，并回退为普通 Markdown 代码案例。"
    )


def _parse_threejs_code_visual_payload(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{", text)
        if not match:
            raise ValueError("DeepSeek 未返回合法 JSON。")
        try:
            data, _ = json.JSONDecoder().raw_decode(text[match.start():])
        except json.JSONDecodeError as ex:
            raise ValueError(f"DeepSeek 未返回合法 JSON：{ex.msg}") from ex
    if not isinstance(data, dict):
        raise ValueError("DeepSeek JSON 根节点必须是对象。")
    _validate_threejs_code_visual_payload(data)
    return data


def _validate_threejs_code_visual_payload(data: dict[str, Any]) -> None:
    files = data.get("files")
    if not isinstance(files, list) or not files:
        raise ValueError("可视化资源生成失败：files 不能为空。")
    by_path: dict[str, str] = {}
    for item in files:
        if not isinstance(item, dict):
            raise ValueError("可视化资源生成失败：files 中存在非法项目。")
        rel_path = _safe_code_artifact_relpath(str(item.get("path") or ""))
        content = str(item.get("content") or "")
        if not content.strip():
            raise ValueError(f"可视化资源生成失败：{rel_path} 内容为空。")
        _validate_code_artifact_content(rel_path, content)
        by_path[rel_path] = content
    if "index.html" not in by_path:
        raise ValueError("可视化资源生成失败：缺少 index.html。")
    if "src/main.js" not in by_path:
        raise ValueError("可视化资源生成失败：缺少 src/main.js。")
    if "canvas" not in by_path["index.html"].lower():
        raise ValueError("可视化资源生成失败：index.html 必须包含 canvas。")
    html_lowered = by_path["index.html"].lower()
    js_lowered = by_path["src/main.js"].lower()
    if "fullscreenbtn" not in html_lowered or "exitfullscreenbtn" not in html_lowered:
        raise ValueError("可视化资源生成失败：必须包含全屏和退出全屏按钮。")
    if "timelineslider" not in html_lowered or "type=\"range\"" not in html_lowered:
        raise ValueError("可视化资源生成失败：必须包含可拖动演示进度条 timelineSlider。")
    if "requestfullscreen" not in js_lowered or "exitfullscreen" not in js_lowered or "fullscreenchange" not in js_lowered:
        raise ValueError("可视化资源生成失败：必须实现完整全屏/退出全屏逻辑。")
    if "timelineslider" not in js_lowered:
        raise ValueError("可视化资源生成失败：必须实现 timelineSlider 拖动演示逻辑。")
    if not re.search(r"fullscreenBtn[\s\S]{0,220}\.addEventListener\(\s*['\"]click['\"]", by_path["src/main.js"]):
        raise ValueError("可视化资源生成失败：全屏按钮必须绑定 click 事件。")
    if not re.search(r"exitFullscreenBtn[\s\S]{0,220}\.addEventListener\(\s*['\"]click['\"]", by_path["src/main.js"]):
        raise ValueError("可视化资源生成失败：退出全屏按钮必须绑定 click 事件。")
    if not re.search(r"timelineSlider[\s\S]{0,220}\.addEventListener\(\s*['\"](?:input|change)['\"]", by_path["src/main.js"]):
        raise ValueError("可视化资源生成失败：timelineSlider 必须绑定拖动事件。")


def _validate_code_artifact_content(rel_path: str, content: str) -> None:
    lowered = content.lower()
    stripped = content.strip()
    placeholder_tokens = [
        "完整 HTML",
        "完整 Three.js",
        "请自行补充",
        "TODO",
        "...",
        "省略",
    ]
    if any(token.lower() in lowered for token in placeholder_tokens):
        raise ValueError(f"可视化资源生成失败：{rel_path} 包含占位内容。")
    if rel_path == "index.html":
        html_lowered = stripped.lower()
        if "<!doctype" not in html_lowered and "<html" not in html_lowered:
            raise ValueError("可视化资源生成失败：index.html 必须是完整 HTML 文档。")
        if "<canvas" not in html_lowered:
            raise ValueError("可视化资源生成失败：index.html 必须包含 canvas 元素。")
        if "<script" not in html_lowered:
            raise ValueError("可视化资源生成失败：index.html 必须包含模块脚本。")
    if rel_path == "src/main.js":
        if "three" not in lowered:
            raise ValueError("可视化资源生成失败：src/main.js 必须使用 Three.js。")
        if "requestanimationframe" not in lowered and "setanimationloop" not in lowered:
            raise ValueError("可视化资源生成失败：src/main.js 必须包含动画循环。")
        if "renderer.render" not in lowered:
            raise ValueError("可视化资源生成失败：src/main.js 必须渲染 Three.js 场景。")
    blocked = [
        "document.cookie",
        "localstorage",
        "sessionstorage",
        "indexeddb",
        "xmlhttprequest",
        "websocket",
        "navigator.sendbeacon",
        "window.parent",
        "window.top",
        "window.opener",
        "eval(",
        "new function",
    ]
    if any(token in lowered for token in blocked):
        raise ValueError(f"可视化资源生成失败：{rel_path} 包含不允许的浏览器能力。")
    if re.search(r"\bfetch\s*\(", content):
        raise ValueError(f"可视化资源生成失败：{rel_path} 不允许调用 fetch。")
    urls = re.findall(r"https?://[^\s'\"<>`]+", content)
    allowed_prefixes = (
        "https://unpkg.com/three@",
        "https://cdn.jsdelivr.net/npm/three@",
    )
    for url in urls:
        if not url.startswith(allowed_prefixes):
            raise ValueError(f"可视化资源生成失败：{rel_path} 只能引用 Three.js 官方 CDN。")


def _save_code_visual_artifact(resource_id: str, payload: dict[str, Any], resource_type: str = "code") -> dict[str, Any]:
    root = _code_artifact_dir(resource_id, resource_type=resource_type)
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)

    written: list[str] = []
    for item in payload["files"]:
        rel_path = _safe_code_artifact_relpath(str(item.get("path") or ""))
        target = _code_artifact_file(resource_id, rel_path, resource_type=resource_type)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(str(item.get("content") or ""), encoding="utf-8")
        written.append(rel_path)

    manifest = {
        "version": "1.0.0",
        "resource_id": resource_id,
        "resource_type": resource_type,
        "title": str(payload.get("title") or "代码可视化资源"),
        "teaching_goal": str(payload.get("teaching_goal") or ""),
        "concept_explanation": str(payload.get("concept_explanation") or ""),
        "interactions": _string_list(payload.get("interactions")),
        "acceptance": _string_list(payload.get("acceptance")),
        "safety_notes": _string_list(payload.get("safety_notes")),
        "files": written,
        "created_at": datetime.now(UTC).isoformat(),
        "artifact_kind": "threejs",
        "generation_mode": str(payload.get("generation_mode") or ""),
        "provider": str(payload.get("provider") or ""),
        "model": str(payload.get("model") or ""),
        "fallback_reason": str(payload.get("fallback_reason") or ""),
    }
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"title": manifest["title"], "files": written}


def _code_visual_resource_markdown(payload: dict[str, Any]) -> str:
    title = str(payload.get("title") or "代码可视化资源")
    goal = str(payload.get("teaching_goal") or "")
    explanation = str(payload.get("concept_explanation") or "")
    interactions = "\n".join(f"- {item}" for item in _string_list(payload.get("interactions")))
    acceptance = "\n".join(f"- {item}" for item in _string_list(payload.get("acceptance")))
    safety = "\n".join(f"- {item}" for item in _string_list(payload.get("safety_notes")))
    return (
        f"# {title}\n\n"
        f"## 学习目标\n{goal}\n\n"
        f"## 概念解释\n{explanation}\n\n"
        f"## 交互方式\n{interactions or '- 打开预览后观察动画并使用控制项'}\n\n"
        f"## 验收标准\n{acceptance or '- 预览页面可以正常显示 Three.js 动画'}\n\n"
        f"## 安全说明\n{safety or '- 资源仅在浏览器沙盒中预览'}"
    )


def _fallback_code_visual_content(prompt: str, reason: str) -> str:
    safe_reason = (reason or "未知错误").strip()
    return (
        f"# {prompt}\n\n"
        "代码可视化资源生成失败，已回退为普通 Markdown 代码案例。\n\n"
        f"失败原因：{safe_reason}\n\n"
        "## 普通代码案例\n"
        "请围绕该主题编写一个最小可运行示例，并在本资源中继续补充讲解、运行结果和扩展练习。"
    )


def _build_safe_threejs_template_payload(topic: str, reason: str = "") -> dict[str, Any]:
    normalized = (topic or "").lower()
    if any(key in normalized for key in ["bfs", "广度", "广搜", "队列", "图搜索", "搜索"]):
        return _build_bfs_threejs_template_payload(topic, reason)
    if any(key in normalized for key in ["排序", "冒泡", "bubble", "sort"]):
        return _build_bubble_sort_threejs_template_payload(topic, reason)
    return _build_generic_threejs_template_payload(topic, reason)


def _build_bubble_sort_threejs_template_payload(topic: str, reason: str = "") -> dict[str, Any]:
    title = "冒泡排序 3D 教学动画" if "排序" in topic or "冒泡" in topic else "3D 教学动画资源"
    safe_topic = json.dumps(topic.strip() or title, ensure_ascii=False)
    safe_reason = json.dumps((reason or "AI 生成内容未通过校验").strip()[:160], ensure_ascii=False)
    index_html = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>冒泡排序 3D 教学动画</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; font-family: Arial, "Microsoft YaHei", sans-serif; background: #f7fafc; color: #172033; }
    #scene { width: 100vw; height: 100vh; display: block; }
    .panel { position: fixed; left: 16px; top: 16px; display: grid; gap: 10px; width: min(360px, calc(100vw - 32px)); padding: 14px; border: 1px solid rgba(22, 32, 51, .12); border-radius: 12px; background: rgba(255,255,255,.9); box-shadow: 0 12px 32px rgba(15,23,42,.12); }
    .title { font-weight: 700; font-size: 16px; }
    .hint { font-size: 13px; line-height: 1.55; color: #526070; }
    .controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    button { height: 34px; border: 0; border-radius: 9px; padding: 0 12px; font-weight: 700; color: white; background: #2563eb; cursor: pointer; }
    button.secondary { color: #172033; background: #e8eef8; }
    label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; }
    input { accent-color: #2563eb; }
    #status { min-height: 40px; border-radius: 10px; padding: 10px; background: #eef6ff; font-size: 13px; line-height: 1.5; color: #1f3b64; }
    #exitFullscreenBtn { display: none; }
    :fullscreen .panel { background: rgba(255,255,255,.86); }
  </style>
</head>
<body>
  <canvas id="scene"></canvas>
  <section class="panel">
    <div class="title">冒泡排序 3D 教学动画</div>
    <div class="hint">观察相邻元素比较、交换、局部变量变化，以及函数最终 return 排序结果。</div>
    <div class="controls">
      <button id="pauseBtn">暂停</button>
      <button id="resetBtn" class="secondary">重置</button>
      <button id="fullscreenBtn" class="secondary">全屏</button>
      <button id="exitFullscreenBtn" class="secondary">退出全屏</button>
      <label>速度 <input id="speedSlider" type="range" min="0.5" max="3" value="1" step="0.5" /></label>
      <label>步骤 <input id="timelineSlider" type="range" min="0" max="15" value="0" step="1" /></label>
    </div>
    <div id="status">准备开始：bubble_sort(data) 接收参数 data。</div>
  </section>
  <script type="module" src="./src/main.js"></script>
</body>
</html>"""
    main_js = f"""import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const topic = {safe_topic};
const fallbackReason = {safe_reason};
const canvas = document.getElementById('scene');
const statusBox = document.getElementById('status');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
const speedSlider = document.getElementById('speedSlider');
const timelineSlider = document.getElementById('timelineSlider');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7fafc);
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 7.5, 12);
camera.lookAt(0, 1.5, 0);

const renderer = new THREE.WebGLRenderer({{ canvas, antialias: true }});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa0b8, 2.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(4, 8, 6);
scene.add(keyLight);

const bubbleData = [5, 2, 8, 4, 1, 6];
let values = bubbleData.slice();
let paused = false;
let stepIndex = 0;
let lastStepAt = 0;
let activePair = [-1, -1];
let sortedFrom = values.length;
let returnShown = false;
const totalSteps = bubbleData.length * (bubbleData.length - 1) / 2;
timelineSlider.max = String(totalSteps);

const bars = [];
const labels = [];
const compareColor = new THREE.Color(0xf59e0b);
const normalColor = new THREE.Color(0x3b82f6);
const sortedColor = new THREE.Color(0x10b981);
const swapColor = new THREE.Color(0xef4444);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(9, 0.08, 3.6),
  new THREE.MeshStandardMaterial({{ color: 0xe6edf7, roughness: 0.82 }})
);
floor.position.y = -0.08;
scene.add(floor);

function makeLabel(text) {{
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 96;
  const ctx = labelCanvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = '#172033';
  ctx.font = 'bold 34px Microsoft YaHei, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 48);
  const texture = new THREE.CanvasTexture(labelCanvas);
  const material = new THREE.SpriteMaterial({{ map: texture }});
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.25, 0.46, 1);
  return sprite;
}}

function buildBars() {{
  for (const item of bars) scene.remove(item);
  for (const item of labels) scene.remove(item);
  bars.length = 0;
  labels.length = 0;
  values.forEach((value, index) => {{
    const geometry = new THREE.BoxGeometry(0.82, value * 0.55, 0.82);
    const material = new THREE.MeshStandardMaterial({{ color: normalColor, roughness: 0.45, metalness: 0.08 }});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((index - (values.length - 1) / 2) * 1.25, value * 0.275, 0);
    mesh.userData.targetX = mesh.position.x;
    scene.add(mesh);
    bars.push(mesh);

    const label = makeLabel(String(value));
    label.position.set(mesh.position.x, value * 0.55 + 0.42, 0.08);
    scene.add(label);
    labels.push(label);
  }});
}}

function updateStatus(text) {{
  statusBox.textContent = text;
}}

function applyBubbleStep(showStatus) {{
  if (returnShown) return;
  const n = values.length;
  let pass = 0;
  let localStep = stepIndex;
  while (localStep >= n - pass - 1 && pass < n - 1) {{
    localStep -= (n - pass - 1);
    pass += 1;
  }}
  if (pass >= n - 1) {{
    activePair = [-1, -1];
    sortedFrom = 0;
    returnShown = true;
    if (showStatus) updateStatus(`return ${{JSON.stringify(values)}}：函数把排好序的新数组返回给调用方。`);
    return;
  }}
  const i = localStep;
  activePair = [i, i + 1];
  const left = values[i];
  const right = values[i + 1];
  if (left > right) {{
    values[i] = right;
    values[i + 1] = left;
    if (showStatus) updateStatus(`局部变量 i=${{i}}：比较 ${{left}} 和 ${{right}}，发现左边更大，交换两个元素。`);
    buildBars();
    bars[i].material.color.copy(swapColor);
    bars[i + 1].material.color.copy(swapColor);
  }} else {{
    if (showStatus) updateStatus(`局部变量 i=${{i}}：比较 ${{left}} 和 ${{right}}，顺序正确，不交换。`);
  }}
  if (i === n - pass - 2) sortedFrom = n - pass - 1;
  stepIndex += 1;
  timelineSlider.value = String(Math.min(stepIndex, totalSteps));
}}

function nextBubbleStep() {{
  applyBubbleStep(true);
}}

function seekBubbleStep(targetStep) {{
  values = bubbleData.slice();
  stepIndex = 0;
  activePair = [-1, -1];
  sortedFrom = values.length;
  returnShown = false;
  buildBars();
  const safeTarget = Math.max(0, Math.min(totalSteps, targetStep));
  for (let step = 0; step < safeTarget; step += 1) {{
    applyBubbleStep(false);
  }}
  timelineSlider.value = String(safeTarget);
  paused = true;
  pauseBtn.textContent = '继续';
  updateStatus(`已拖动到第 ${{safeTarget}} / ${{totalSteps}} 步：当前数组为 ${{JSON.stringify(values)}}。`);
}}

function paintBars(elapsed) {{
  bars.forEach((bar, index) => {{
    const isActive = activePair.includes(index);
    const isSorted = index >= sortedFrom;
    const color = isSorted ? sortedColor : isActive ? compareColor : normalColor;
    bar.material.color.lerp(color, 0.18);
    const lift = isActive ? Math.sin(elapsed * 0.006) * 0.08 + 0.12 : 0;
    bar.position.y = values[index] * 0.275 + lift;
    labels[index].position.x = bar.position.x;
    labels[index].position.y = values[index] * 0.55 + 0.42 + lift;
  }});
}}

function reset() {{
  values = bubbleData.slice();
  paused = false;
  stepIndex = 0;
  lastStepAt = 0;
  activePair = [-1, -1];
  sortedFrom = values.length;
  returnShown = false;
  timelineSlider.value = '0';
  pauseBtn.textContent = '暂停';
  buildBars();
  updateStatus(`主题：${{topic}}。参数 data=${{JSON.stringify(bubbleData)}} 进入 bubble_sort 函数。`);
}}

pauseBtn.addEventListener('click', () => {{
  paused = !paused;
  pauseBtn.textContent = paused ? '继续' : '暂停';
}});
resetBtn.addEventListener('click', reset);
timelineSlider.addEventListener('input', () => {{
  seekBubbleStep(Number(timelineSlider.value || 0));
}});
fullscreenBtn.addEventListener('click', async () => {{
  if (document.fullscreenElement) return;
  await document.documentElement.requestFullscreen();
}});
exitFullscreenBtn.addEventListener('click', async () => {{
  if (!document.fullscreenElement) return;
  await document.exitFullscreen();
}});
document.addEventListener('fullscreenchange', () => {{
  const active = Boolean(document.fullscreenElement);
  fullscreenBtn.style.display = active ? 'none' : 'inline-flex';
  exitFullscreenBtn.style.display = active ? 'inline-flex' : 'none';
}});
window.addEventListener('resize', () => {{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}});

reset();
console.info('SparkLearn 3D safe template fallback:', fallbackReason);

function animate(now) {{
  requestAnimationFrame(animate);
  const speed = Number(speedSlider.value || 1);
  if (!paused && now - lastStepAt > 1300 / speed) {{
    nextBubbleStep();
    lastStepAt = now;
  }}
  scene.rotation.y = Math.sin(now * 0.00025) * 0.08;
  paintBars(now);
  renderer.render(scene, camera);
}}

requestAnimationFrame(animate);
"""
    return {
        "title": title,
        "teaching_goal": "通过可操作的 3D 柱状数组理解冒泡排序中的参数传入、局部变量 i、相邻比较、交换和 return 返回值。",
        "concept_explanation": "每个柱体代表数组中的一个元素。动画按 bubble_sort(data) 的执行顺序逐步比较相邻柱体，左边更大时交换位置；绿色区域表示本轮已经确定的最大值。排序完成后，函数把排好序的新数组作为返回值交回调用方。",
        "files": [
            {"path": "index.html", "content": index_html},
            {"path": "src/main.js", "content": main_js},
        ],
        "interactions": ["暂停或继续动画", "重置排序过程", "拖动步骤进度条定位比较过程", "拖动速度滑块观察比较与交换节奏", "进入全屏和退出全屏"],
        "acceptance": ["预览页出现非空 3D 柱状数组", "动画会持续比较和交换元素", "步骤进度条可定位演示状态", "速度滑块会改变排序步进速度", "全屏和退出全屏按钮可操作"],
        "safety_notes": ["AI 原始代码未通过校验时启用安全模板兜底", "仅加载 Three.js 官方 CDN", "不访问网络 API、Cookie、localStorage、父窗口或用户文件"],
    }


def _build_bfs_threejs_template_payload(topic: str, reason: str = "") -> dict[str, Any]:
    safe_topic = json.dumps(topic.strip() or "BFS 广度优先搜索 3D 教学可视化", ensure_ascii=False)
    safe_reason = json.dumps((reason or "AI 生成内容未通过校验").strip()[:160], ensure_ascii=False)
    index_html = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BFS 广度优先搜索 3D 教学可视化</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; font-family: Arial, "Microsoft YaHei", sans-serif; background: #030712; color: #f8fafc; }
    #scene { width: 100vw; height: 100vh; display: block; }
    .panel { position: fixed; left: 20px; top: 18px; width: min(430px, calc(100vw - 40px)); padding: 18px; border-radius: 8px; background: rgba(3, 7, 18, .78); border: 1px solid rgba(148, 163, 184, .26); box-shadow: 0 18px 50px rgba(0,0,0,.35); backdrop-filter: blur(10px); }
    .title { font-size: 22px; font-weight: 800; letter-spacing: 0; }
    .hint { margin-top: 10px; color: #dbeafe; font-size: 14px; line-height: 1.6; }
    .queue { margin-top: 12px; min-height: 42px; border-radius: 8px; padding: 10px 12px; background: rgba(15, 23, 42, .78); color: #fef3c7; font-size: 13px; line-height: 1.5; }
    .legend { position: fixed; left: 20px; bottom: 20px; display: grid; gap: 8px; padding: 12px; border-radius: 8px; background: rgba(3, 7, 18, .72); border: 1px solid rgba(148, 163, 184, .24); font-size: 13px; }
    .legend span { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
    .swatch { width: 18px; height: 18px; border-radius: 4px; display: inline-block; }
    .controls { position: fixed; right: 24px; bottom: 24px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; max-width: min(720px, calc(100vw - 48px)); }
    button { height: 42px; border: 0; border-radius: 8px; padding: 0 16px; font-weight: 800; color: #f8fafc; background: #2563eb; cursor: pointer; box-shadow: 0 12px 24px rgba(37, 99, 235, .2); }
    button.secondary { color: #dbeafe; background: rgba(30, 41, 59, .92); border: 1px solid rgba(148, 163, 184, .24); }
    button:focus-visible, input:focus-visible { outline: 3px solid rgba(34, 211, 238, .55); outline-offset: 2px; }
    label { height: 42px; display: flex; align-items: center; gap: 8px; border-radius: 8px; padding: 0 12px; color: #e2e8f0; background: rgba(30, 41, 59, .9); border: 1px solid rgba(148, 163, 184, .24); font-size: 13px; }
    input { accent-color: #22d3ee; }
    #exitFullscreenBtn { display: none; }
    :fullscreen .panel { left: 24px; top: 22px; }
    :fullscreen .controls { right: 28px; bottom: 28px; }
    @media (max-width: 760px) {
      .panel { left: 12px; top: 12px; width: calc(100vw - 24px); padding: 14px; }
      .title { font-size: 18px; }
      .legend { display: none; }
      .controls { left: 12px; right: 12px; bottom: 12px; max-width: none; justify-content: stretch; }
      button, label { flex: 1 1 auto; }
    }
  </style>
</head>
<body>
  <canvas id="scene"></canvas>
  <section class="panel">
    <div class="title">BFS 广度优先搜索 · 3D 教学可视化</div>
    <div class="hint">从起点开始，按距离分层扩展。队列先进先出，保证在无权图中第一次到达终点就是最短路径。</div>
    <div id="queueStatus" class="queue">队列准备中</div>
  </section>
  <div class="legend" aria-label="图例">
    <span><i class="swatch" style="background:#3b82f6"></i>第0层 起点</span>
    <span><i class="swatch" style="background:#22d3ee"></i>第1层</span>
    <span><i class="swatch" style="background:#22c55e"></i>第2层</span>
    <span><i class="swatch" style="background:#facc15"></i>第3层</span>
    <span><i class="swatch" style="background:#fb923c"></i>第4层 终点方向</span>
  </div>
  <div class="controls">
    <button id="playBtn">播放</button>
    <button id="pauseBtn" class="secondary">暂停</button>
    <button id="resetBtn" class="secondary">重置</button>
    <button id="viewBtn" class="secondary">切换视角</button>
    <button id="fullscreenBtn" class="secondary">全屏</button>
    <button id="exitFullscreenBtn" class="secondary">退出全屏</button>
    <label>速度 <input id="speedSlider" type="range" min="0.5" max="3" value="1" step="0.5" /></label>
    <label>进度 <input id="timelineSlider" type="range" min="0" max="124" value="0" step="1" /></label>
  </div>
  <script type="module" src="./src/main.js"></script>
</body>
</html>"""
    main_js = f"""import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const topic = {safe_topic};
const fallbackReason = {safe_reason};
const canvas = document.getElementById('scene');
const queueStatus = document.getElementById('queueStatus');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const viewBtn = document.getElementById('viewBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
const speedSlider = document.getElementById('speedSlider');
const timelineSlider = document.getElementById('timelineSlider');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030712);
scene.fog = new THREE.Fog(0x030712, 12, 38);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
const cameraViews = [
  new THREE.Vector3(8.5, 9.5, 11.5),
  new THREE.Vector3(0, 14, 14),
  new THREE.Vector3(14, 6, 3),
];
let viewIndex = 0;
camera.position.copy(cameraViews[viewIndex]);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({{ canvas, antialias: true, alpha: false }});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.AmbientLight(0x93c5fd, 1.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(6, 10, 8);
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0x22d3ee, 1.2, 20);
cyanLight.position.set(-5, 4, 3);
scene.add(cyanLight);

const gridSize = 5;
const spacing = 1.32;
const start = {{ x: 0, y: 0, z: 0 }};
const goal = {{ x: 4, y: 4, z: 4 }};
const layerColors = [0x3b82f6, 0x22d3ee, 0x22c55e, 0xfacc15, 0xfb923c, 0xef4444];
const nodes = new Map();
const queue = [];
const visited = new Set();
const parents = new Map();
let visitOrder = [];
let currentIndex = 0;
let paused = false;
let reachedGoal = false;
let lastStepAt = 0;
let currentKey = "";

function keyOf(node) {{
  return `${{node.x}},${{node.y}},${{node.z}}`;
}}

function formatNodeKey(key) {{
  return `(${{key.replaceAll(',', ', ')}})`;
}}

function worldPosition(node) {{
  return new THREE.Vector3(
    (node.x - 2) * spacing,
    (node.y - 2) * spacing,
    (node.z - 2) * spacing
  );
}}

function distanceLayer(node) {{
  return Math.abs(node.x - start.x) + Math.abs(node.y - start.y) + Math.abs(node.z - start.z);
}}

function canVisit(node) {{
  if (node.x < 0 || node.y < 0 || node.z < 0) return false;
  if (node.x >= gridSize || node.y >= gridSize || node.z >= gridSize) return false;
  const blocked = (node.x === 2 && node.y <= 3 && node.z === 2) || (node.x === 1 && node.y === 3 && node.z <= 3);
  return !blocked;
}}

function neighborsOf(node) {{
  const deltas = [
    {{ x: 1, y: 0, z: 0 }}, {{ x: -1, y: 0, z: 0 }},
    {{ x: 0, y: 1, z: 0 }}, {{ x: 0, y: -1, z: 0 }},
    {{ x: 0, y: 0, z: 1 }}, {{ x: 0, y: 0, z: -1 }},
  ];
  return deltas.map(delta => ({{ x: node.x + delta.x, y: node.y + delta.y, z: node.z + delta.z }})).filter(canVisit);
}}

function createTextSprite(text, color = '#e0f2fe') {{
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 320;
  labelCanvas.height = 96;
  const ctx = labelCanvas.getContext('2d');
  ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
  ctx.fillStyle = 'rgba(3,7,18,0.76)';
  ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
  ctx.fillStyle = color;
  ctx.font = 'bold 30px Microsoft YaHei, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 160, 48);
  const texture = new THREE.CanvasTexture(labelCanvas);
  const material = new THREE.SpriteMaterial({{ map: texture, transparent: true }});
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.8, 0.54, 1);
  return sprite;
}}

function buildGrid() {{
  const cubeGeometry = new THREE.BoxGeometry(0.74, 0.74, 0.74);
  const edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);
  for (let x = 0; x < gridSize; x += 1) {{
    for (let y = 0; y < gridSize; y += 1) {{
      for (let z = 0; z < gridSize; z += 1) {{
        const node = {{ x, y, z }};
        if (!canVisit(node)) continue;
        const layer = Math.min(distanceLayer(node), layerColors.length - 1);
        const material = new THREE.MeshStandardMaterial({{
          color: layerColors[layer],
          transparent: true,
          opacity: 0.13,
          roughness: 0.52,
          metalness: 0.04,
        }});
        const mesh = new THREE.Mesh(cubeGeometry, material);
        mesh.position.copy(worldPosition(node));
        const edge = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({{ color: 0x64748b, transparent: true, opacity: 0.28 }}));
        edge.position.copy(mesh.position);
        scene.add(mesh);
        scene.add(edge);
        nodes.set(keyOf(node), {{ node, mesh, edge, layer, state: 'unseen' }});
      }}
    }}
  }}
  const startLabel = createTextSprite('起点');
  startLabel.position.copy(worldPosition(start)).add(new THREE.Vector3(0, 0.78, 0));
  scene.add(startLabel);
  const goalLabel = createTextSprite('终点', '#fed7aa');
  goalLabel.position.copy(worldPosition(goal)).add(new THREE.Vector3(0, 0.78, 0));
  scene.add(goalLabel);
  timelineSlider.max = String(Math.max(1, nodes.size));
}}

function resetSearch() {{
  queue.length = 0;
  visited.clear();
  parents.clear();
  visitOrder = [];
  currentIndex = 0;
  reachedGoal = false;
  lastStepAt = 0;
  currentKey = "";
  paused = false;
  queue.push(start);
  visited.add(keyOf(start));
  nodes.forEach(item => {{
    item.state = 'unseen';
    item.mesh.material.opacity = 0.13;
    item.mesh.scale.set(1, 1, 1);
  }});
  const startItem = nodes.get(keyOf(start));
  if (startItem) startItem.state = 'frontier';
  timelineSlider.value = '0';
  queueStatus.textContent = `主题：${{topic}}。初始化 queue=[${{formatNodeKey(keyOf(start))}}]，从起点按层扩展。`;
  updatePauseButton();
}}

function markNode(key, state) {{
  const item = nodes.get(key);
  if (!item) return;
  item.state = state;
  if (state === 'visited') item.mesh.material.opacity = 0.48;
  if (state === 'frontier') item.mesh.material.opacity = 0.66;
  if (state === 'current') item.mesh.material.opacity = 1;
  if (state === 'path') item.mesh.material.opacity = 1;
}}

function buildPathKeys() {{
  const result = [];
  let cursor = keyOf(goal);
  while (cursor) {{
    result.unshift(cursor);
    cursor = parents.get(cursor);
  }}
  return result;
}}

function stepBfs() {{
  if (reachedGoal) return;
  if (queue.length === 0) {{
    queueStatus.textContent = '队列为空：没有找到可达路径，搜索结束。';
    reachedGoal = true;
    return;
  }}
  const node = queue.shift();
  const key = keyOf(node);
  currentKey = key;
  markNode(key, 'current');
  visitOrder.push(key);
  if (key === keyOf(goal)) {{
    reachedGoal = true;
    currentIndex += 1;
    timelineSlider.value = String(currentIndex);
    buildPathKeys().forEach(pathKey => markNode(pathKey, 'path'));
    queueStatus.textContent = `到达终点 ${{formatNodeKey(key)}}：第一次到达即为最短路径，return path。`;
    return;
  }}
  const added = [];
  neighborsOf(node).forEach(next => {{
    const nextKey = keyOf(next);
    if (visited.has(nextKey)) return;
    visited.add(nextKey);
    parents.set(nextKey, key);
    queue.push(next);
    added.push(nextKey);
    markNode(nextKey, 'frontier');
  }});
  markNode(key, 'visited');
  currentIndex += 1;
  timelineSlider.value = String(currentIndex);
  const queueText = queue.slice(0, 5).map(item => formatNodeKey(keyOf(item))).join('  ');
  const addedText = added.length ? added.map(formatNodeKey).join('  ') : '无新节点';
  queueStatus.textContent = `出队 ${{formatNodeKey(key)}}，入队：${{addedText}}。当前 queue=[${{queueText}}]，已访问 ${{visited.size}} 个节点。`;
}}

function updatePauseButton() {{
  pauseBtn.textContent = paused ? '继续' : '暂停';
}}

function seekBfsStep(targetStep) {{
  const safeTarget = Math.max(0, Math.min(Number(timelineSlider.max || 1), targetStep));
  resetSearch();
  for (let step = 0; step < safeTarget && !reachedGoal; step += 1) {{
    stepBfs();
  }}
  paused = true;
  timelineSlider.value = String(currentIndex);
  queueStatus.textContent += ` 已拖动定位到第 ${{currentIndex}} 步。`;
  updatePauseButton();
}}

playBtn.addEventListener('click', () => {{
  paused = false;
  updatePauseButton();
}});
pauseBtn.addEventListener('click', () => {{
  paused = !paused;
  updatePauseButton();
}});
resetBtn.addEventListener('click', resetSearch);
timelineSlider.addEventListener('input', () => {{
  seekBfsStep(Number(timelineSlider.value || 0));
}});
viewBtn.addEventListener('click', () => {{
  viewIndex = (viewIndex + 1) % cameraViews.length;
}});
fullscreenBtn.addEventListener('click', async () => {{
  if (document.fullscreenElement) return;
  await document.documentElement.requestFullscreen();
}});
exitFullscreenBtn.addEventListener('click', async () => {{
  if (!document.fullscreenElement) return;
  await document.exitFullscreen();
}});
document.addEventListener('fullscreenchange', () => {{
  const active = Boolean(document.fullscreenElement);
  fullscreenBtn.style.display = active ? 'none' : 'inline-flex';
  exitFullscreenBtn.style.display = active ? 'inline-flex' : 'none';
}});
window.addEventListener('resize', () => {{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}});

buildGrid();
resetSearch();
console.info('SparkLearn 3D safe template fallback:', fallbackReason);

function animate(now) {{
  requestAnimationFrame(animate);
  const speed = Number(speedSlider.value || 1);
  if (!paused && !reachedGoal && now - lastStepAt > 900 / speed) {{
    stepBfs();
    lastStepAt = now;
  }}
  const targetPosition = cameraViews[viewIndex];
  camera.position.lerp(targetPosition, 0.045);
  camera.lookAt(0, 0, 0);
  nodes.forEach((item, key) => {{
    const pulse = key === currentKey ? 1.22 + Math.sin(now * 0.008) * 0.12 : item.state === 'frontier' ? 1.08 : 1;
    item.mesh.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.18);
    if (item.state === 'path') {{
      item.mesh.material.color.setHex(0xf97316);
    }} else if (item.state === 'current') {{
      item.mesh.material.color.setHex(0xfacc15);
    }} else {{
      item.mesh.material.color.setHex(layerColors[item.layer]);
    }}
  }});
  scene.rotation.y = Math.sin(now * 0.00018) * 0.08;
  renderer.render(scene, camera);
}}

requestAnimationFrame(animate);
"""
    return {
        "title": "BFS 广度优先搜索 3D 教学可视化",
        "teaching_goal": "通过 3D 网格、队列和层级颜色理解 BFS 如何从起点逐层扩展，并在无权图中找到最短路径。",
        "concept_explanation": "每个半透明方块是图中的一个节点。BFS 把起点放入队列，每一步取出队首节点，再把未访问的相邻节点放到队尾。颜色表示距离层级，发光节点表示当前出队节点；当终点第一次被取出时，路径就是最短路径。",
        "files": [
            {"path": "index.html", "content": index_html},
            {"path": "src/main.js", "content": main_js},
        ],
        "interactions": ["播放或暂停 BFS 扩展", "重置搜索过程", "拖动进度条定位 BFS 出队步骤", "拖动速度滑块调整步进速度", "切换观察视角", "进入全屏和退出全屏"],
        "acceptance": ["预览页出现非空 5x5x5 三维网格", "动画会在 3 秒内开始出队和入队", "队列文本会随动画变化", "进度条可定位 BFS 步骤", "速度滑块会改变 BFS 步进速度", "全屏和退出全屏按钮可操作"],
        "safety_notes": ["AI 原始代码未通过校验时启用安全模板兜底", "仅加载 Three.js 官方 CDN", "不读取用户文件，不访问浏览器持久化数据"],
    }


def _build_generic_threejs_template_payload(topic: str, reason: str = "") -> dict[str, Any]:
    safe_topic = json.dumps(topic.strip() or "3D 教学动画资源", ensure_ascii=False)
    safe_reason = json.dumps((reason or "AI 生成内容未通过校验").strip()[:160], ensure_ascii=False)
    index_html = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>3D 概念流程教学动画</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; font-family: Arial, "Microsoft YaHei", sans-serif; background: #07111f; color: #f8fafc; }
    #scene { width: 100vw; height: 100vh; display: block; }
    .panel { position: fixed; left: 18px; top: 18px; width: min(400px, calc(100vw - 36px)); padding: 16px; border-radius: 8px; background: rgba(7, 17, 31, .78); border: 1px solid rgba(148, 163, 184, .24); }
    .title { font-size: 20px; font-weight: 800; }
    #status { margin-top: 10px; color: #dbeafe; font-size: 14px; line-height: 1.55; }
    .controls { position: fixed; right: 20px; bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
    button { height: 40px; border: 0; border-radius: 8px; padding: 0 15px; font-weight: 800; color: #f8fafc; background: #2563eb; cursor: pointer; }
    button.secondary { background: rgba(30, 41, 59, .92); border: 1px solid rgba(148, 163, 184, .24); }
    #exitFullscreenBtn { display: none; }
  </style>
</head>
<body>
  <canvas id="scene"></canvas>
  <section class="panel">
    <div class="title">3D 概念流程教学动画</div>
    <div id="status">准备把主题拆成输入、处理、输出三个阶段。</div>
  </section>
  <div class="controls">
    <button id="pauseBtn">暂停</button>
    <button id="resetBtn" class="secondary">重置</button>
    <button id="fullscreenBtn" class="secondary">全屏</button>
    <button id="exitFullscreenBtn" class="secondary">退出全屏</button>
    <label>进度 <input id="timelineSlider" type="range" min="0" max="2" value="0" step="1" /></label>
  </div>
  <script type="module" src="./src/main.js"></script>
</body>
</html>"""
    main_js = f"""import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const topic = {safe_topic};
const fallbackReason = {safe_reason};
const canvas = document.getElementById('scene');
const statusBox = document.getElementById('status');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
const timelineSlider = document.getElementById('timelineSlider');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4.5, 9);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({{ canvas, antialias: true }});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
scene.add(new THREE.HemisphereLight(0xffffff, 0x1d4ed8, 2));
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(4, 8, 6);
scene.add(light);

const stages = ['输入参数', '局部处理', '返回结果'];
const colors = [0x38bdf8, 0xa3e635, 0xf97316];
const boxes = stages.map((stage, index) => {{
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardMaterial({{ color: colors[index], roughness: 0.45, metalness: 0.06 }})
  );
  mesh.position.x = (index - 1) * 2.7;
  scene.add(mesh);
  return mesh;
}});
let paused = false;
let active = 0;
let lastStepAt = 0;

function reset() {{
  active = 0;
  lastStepAt = 0;
  paused = false;
  timelineSlider.value = '0';
  pauseBtn.textContent = '暂停';
  statusBox.textContent = `主题：${{topic}}。先观察输入参数如何进入小项目。`;
}}

function updateFullscreenButtons() {{
  const on = Boolean(document.fullscreenElement);
  fullscreenBtn.style.display = on ? 'none' : 'inline-flex';
  exitFullscreenBtn.style.display = on ? 'inline-flex' : 'none';
}}

pauseBtn.addEventListener('click', () => {{
  paused = !paused;
  pauseBtn.textContent = paused ? '继续' : '暂停';
}});
resetBtn.addEventListener('click', reset);
timelineSlider.addEventListener('input', () => {{
  active = Number(timelineSlider.value || 0);
  paused = true;
  pauseBtn.textContent = '继续';
  statusBox.textContent = `${{stages[active]}}：已拖动到该演示阶段，观察代码数据流当前位置。`;
}});
fullscreenBtn.addEventListener('click', async () => {{
  if (document.fullscreenElement) return;
  await document.documentElement.requestFullscreen();
}});
exitFullscreenBtn.addEventListener('click', async () => {{
  if (!document.fullscreenElement) return;
  await document.exitFullscreen();
}});
document.addEventListener('fullscreenchange', updateFullscreenButtons);
window.addEventListener('resize', () => {{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}});

reset();
console.info('SparkLearn 3D safe template fallback:', fallbackReason);

function animate(now) {{
  requestAnimationFrame(animate);
  if (!paused && now - lastStepAt > 1100) {{
    active = (active + 1) % stages.length;
    timelineSlider.value = String(active);
    statusBox.textContent = `${{stages[active]}}：把知识点放进可运行小项目，看数据如何流动。`;
    lastStepAt = now;
  }}
  boxes.forEach((box, index) => {{
    const target = index === active ? 1.35 : 1;
    box.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
    box.rotation.x += 0.006 + index * 0.002;
    box.rotation.y += 0.01;
  }});
  scene.rotation.y = Math.sin(now * 0.00028) * 0.12;
  renderer.render(scene, camera);
}}

requestAnimationFrame(animate);
"""
    return {
        "title": "3D 概念流程教学动画",
        "teaching_goal": "用可运行的 3D 流程动画把学习主题拆成输入、处理和输出，帮助学生先建立整体结构。",
        "concept_explanation": "当模型没有生成合格的主题专属代码时，系统会使用安全模板兜底。三个立方体分别表示输入参数、局部处理和返回结果，动画会突出当前阶段，方便教师继续补充更细的知识点。",
        "files": [
            {"path": "index.html", "content": index_html},
            {"path": "src/main.js", "content": main_js},
        ],
        "interactions": ["暂停或继续动画", "重置流程", "拖动进度条定位输入、处理、返回阶段", "进入全屏和退出全屏"],
        "acceptance": ["预览页出现非空 3D 场景", "动画会在 3 秒内切换阶段", "进度条可定位演示阶段", "全屏和退出全屏按钮可操作"],
        "safety_notes": ["AI 原始代码未通过校验时启用安全模板兜底", "仅加载 Three.js 官方 CDN", "不读取用户文件，不访问浏览器持久化数据"],
    }


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _code_artifact_url(resource_id: str, resource_type: str = "code") -> str:
    return f"sparklearn-artifact://{_safe_artifact_type(resource_type)}/{resource_id}/index.html"


def _is_code_artifact_url(value: str) -> bool:
    return bool(_artifact_type_from_url(value))


def _artifact_type_from_url(value: str) -> str:
    match = re.fullmatch(r"sparklearn-artifact://(code|visual3d)/[A-Za-z0-9_-]+/index\.html", value or "")
    return match.group(1) if match else ""


def _safe_artifact_type(value: str) -> str:
    resource_type = (value or "").strip().lower()
    if resource_type not in {"code", "visual3d"}:
        raise HTTPException(status_code=400, detail="invalid visual artifact type")
    return resource_type


def _code_artifact_dir(resource_id: str, resource_type: str = "code") -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", resource_id or ""):
        raise HTTPException(status_code=400, detail="invalid visual artifact id")
    root = (settings.data_dir / "artifacts" / _safe_artifact_type(resource_type)).resolve()
    path = (root / resource_id).resolve()
    if root != path and root not in path.parents:
        raise HTTPException(status_code=400, detail="invalid visual artifact path")
    return path


def _safe_code_artifact_relpath(value: str) -> str:
    normalized = (value or "").replace("\\", "/").strip().lstrip("/")
    if not normalized or normalized.endswith("/"):
        raise ValueError("可视化资源生成失败：文件路径为空。")
    if normalized.startswith("../") or "/../" in normalized or normalized == "..":
        raise ValueError("可视化资源生成失败：文件路径不安全。")
    if not re.fullmatch(r"[A-Za-z0-9._/-]+", normalized):
        raise ValueError(f"可视化资源生成失败：文件路径不合法：{value}")
    if normalized not in {"index.html", "src/main.js", "style.css", "src/style.css"}:
        raise ValueError(f"可视化资源生成失败：不允许写入文件：{normalized}")
    return normalized


def _code_artifact_file(resource_id: str, rel_path: str, resource_type: str = "code") -> Path:
    safe_rel = _safe_code_artifact_relpath(rel_path)
    root = _code_artifact_dir(resource_id, resource_type=resource_type)
    target = (root / safe_rel).resolve()
    if root != target and root not in target.parents:
        raise HTTPException(status_code=400, detail="invalid visual artifact file")
    return target


def _code_artifact_security_headers() -> dict[str, str]:
    return {
        "Content-Security-Policy": (
            "default-src 'none'; "
            "script-src 'unsafe-inline' https://unpkg.com; "
            "style-src 'unsafe-inline'; "
            "img-src data: blob:; "
            "font-src 'none'; "
            "connect-src 'none'; "
            "media-src 'none'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'none'; "
            "frame-ancestors 'self' http://127.0.0.1:3000 http://localhost:3000"
        ),
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
    }


def _inject_code_artifact_base(html: str, resource_id: str) -> str:
    base = f'<base href="/api/resources/{resource_id}/preview/files/" />'
    if re.search(r"<base\b", html, flags=re.IGNORECASE):
        return html
    if re.search(r"<head[^>]*>", html, flags=re.IGNORECASE):
        return re.sub(r"(<head[^>]*>)", r"\1" + base, html, count=1, flags=re.IGNORECASE)
    return base + html


def _inline_code_artifact_assets(html: str, resource_id: str, resource_type: str = "code") -> str:
    main_path = _code_artifact_file(resource_id, "src/main.js", resource_type=resource_type)
    if main_path.exists():
        js = main_path.read_text(encoding="utf-8")
        inline = f"<!-- ./src/main.js -->\n<script type=\"module\">\n{js}\n</script>"
        html = re.sub(
            r"<script\b([^>]*?)\bsrc=[\"']\.?/src/main\.js[\"']([^>]*)>\s*</script>",
            inline,
            html,
            count=1,
            flags=re.IGNORECASE,
        )
    for rel_path in ("style.css", "src/style.css"):
        css_path = _code_artifact_file(resource_id, rel_path, resource_type=resource_type)
        if not css_path.exists():
            continue
        css = css_path.read_text(encoding="utf-8")
        html = re.sub(
            rf"<link\b([^>]*?)\bhref=[\"']\.?/{re.escape(rel_path)}[\"']([^>]*)>",
            f"<style>\n{css}\n</style>",
            html,
            count=1,
            flags=re.IGNORECASE,
        )
    return html


def _zip_code_artifact_sync(resource_id: str, resource_type: str = "code") -> bytes:
    root = _code_artifact_dir(resource_id, resource_type=resource_type)
    if not root.exists():
        raise HTTPException(status_code=404, detail="visual artifact not found")
    from io import BytesIO

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in root.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(root).as_posix())
    return buffer.getvalue()


def _fallback_resource_content(resource_type: str, prompt: str, errors: list[str] | None = None) -> str:
    details = ""
    clean_errors = [err.strip() for err in (errors or []) if err.strip()]
    if clean_errors:
        details = "\n\n失败原因：\n" + "\n".join(f"- {err}" for err in clean_errors[-3:])
    return f"# {prompt}\n\n{resource_type} 生成失败，请检查模型服务配置后重试。{details}"


async def _evaluate_code_with_ai(
    *,
    resource_title: str,
    resource_content: str,
    question: str,
    hint: str,
    student_code: str,
) -> dict[str, Any]:
    prompt = (
        "你是编程导师，请只做静态代码批改，不要运行代码。\n"
        "请根据题目要求、资源上下文和提示，判断学生代码是否满足要求。\n"
        "只输出 JSON，不要输出 Markdown，不要输出额外解释。\n"
        "JSON 格式必须是：{\"correct\": true/false, \"result\": \"正确\"或\"错误\", \"reason\": \"一句简短中文原因\"}\n\n"
        f"资源标题：{resource_title}\n\n"
        f"资源上下文：\n{resource_content[:6000]}\n\n"
        f"题目：\n{question or '请根据资源主题完成代码练习。'}\n\n"
        f"提示或参考：\n{hint or '无'}\n\n"
        f"学生代码：\n```python\n{student_code}\n```\n\n"
        "判定要求：\n"
        "1. 如果学生代码基本满足题目目标，即使写法和参考不同，也判为正确。\n"
        "2. 如果函数名/返回值/核心逻辑不满足题目，或明显语法错误，判为错误。\n"
        "3. reason 必须简短，最多 30 个汉字。"
    )

    chunks: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode="general", history=[]):
        if evt_type == "text":
            chunk = str(payload.get("content", ""))
            if chunk:
                chunks.append(chunk)
    raw = "".join(chunks).strip()
    parsed = _parse_code_evaluation_json(raw)
    if parsed:
        return parsed
    return {"correct": False, "result": "错误", "reason": "AI 暂时无法判断，请稍后重试。"}


def _parse_code_evaluation_json(raw: str) -> dict[str, Any] | None:
    if not raw:
        return None
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start:end + 1]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    correct = bool(data.get("correct"))
    result = "正确" if correct else "错误"
    reason = str(data.get("reason") or ("代码满足题目要求。" if correct else "代码未满足题目要求。")).strip()
    return {"correct": correct, "result": result, "reason": reason[:80]}


def _find_resource(user_id: str, resource_id: str) -> dict[str, Any] | None:
    if resource_id.startswith("webmat-"):
        return _find_web_material_resource(user_id, resource_id)
    resources = read_json(user_id, "resources_index.json", [])
    for item in resources:
        if str(item.get("id", "")) == resource_id:
            return item
    return None


def _web_material_id(resource_id: str) -> int | None:
    match = re.fullmatch(r"webmat-(\d+)", resource_id or "")
    return int(match.group(1)) if match else None


def _web_material_resources(user_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT *
        FROM tutor_files
        WHERE user_id = ? AND source_type = 'web_capture'
        ORDER BY created_at DESC, id DESC
        """,
        (user_id,),
    )
    return [_web_material_row_to_resource(row, include_content=False) for row in rows]


def _find_web_material_resource(user_id: str, resource_id: str) -> dict[str, Any] | None:
    file_id = _web_material_id(resource_id)
    if not file_id:
        return None
    row = fetch_one(
        "SELECT * FROM tutor_files WHERE id = ? AND user_id = ? AND source_type = 'web_capture'",
        (file_id, user_id),
    )
    return _web_material_row_to_resource(row, include_content=True) if row else None


def _web_material_row_to_resource(row, include_content: bool = False) -> dict[str, Any]:
    analysis = _safe_json_dict(row["analysis_json"] if "analysis_json" in row.keys() else "{}")
    content = ""
    path = Path(str(row["stored_path"] or ""))
    if include_content and path.exists() and path.is_file():
        content = path.read_text(encoding="utf-8", errors="ignore")
    stored_status = str(row["status"] or "completed") if "status" in row.keys() else "completed"
    resource_status = "completed" if stored_status in {"ready", "indexed"} else stored_status
    return {
        "id": f"webmat-{int(row['id'])}",
        "title": str(row["filename"] or "网页资料"),
        "type": "web_material",
        "status": resource_status,
        "created_at": str(row["created_at"] or ""),
        "updated_at": str(row["updated_at"] or row["created_at"] or "") if "updated_at" in row.keys() else str(row["created_at"] or ""),
        "content": content,
        "source_url": str(row["source_url"] or "") if "source_url" in row.keys() else "",
        "progress": 100,
        "analysis": analysis,
        "source_type": "web_capture",
        "file_id": int(row["id"]),
    }


def _safe_json_dict(raw: Any) -> dict[str, Any]:
    try:
        value = json.loads(raw or "{}")
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


async def _fetch_url_text(url: str) -> str:
    _validate_public_http_url(url, "preview link")
    try:
        resp = await _request_public_url_with_ssl_fallback(url, timeout=30.0)
        content_type = resp.headers.get("content-type", "").lower()
        if "html" not in content_type and "text/plain" not in content_type:
            raise HTTPException(status_code=400, detail=f"unsupported content type: {content_type}")
        return resp.text
    except HTTPException:
        raise
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"preview fetch failed: {ex}") from ex


async def _fetch_url_binary(url: str) -> tuple[bytes, str]:
    _validate_public_http_url(url, "source link")
    try:
        resp = await _request_public_url_with_ssl_fallback(url, timeout=45.0)
        ctype = resp.headers.get("content-type", "application/octet-stream").split(";")[0].strip().lower()
        return resp.content, ctype
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"source fetch failed: {ex}") from ex


async def _request_public_url_with_ssl_fallback(url: str, timeout: float) -> httpx.Response:
    trust_env = not _should_bypass_environment_proxy(url)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=3, trust_env=trust_env) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp
    except httpx.ConnectError as ex:
        if not _should_retry_insecure_ssl(url, ex):
            raise
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=3, verify=False, trust_env=trust_env) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp


def _should_bypass_environment_proxy(url: str) -> bool:
    """ContentCube 的静态预览页直连可用，但部分环境代理会关闭其 TLS 隧道。"""
    return (urlparse(url).hostname or "").strip().lower() == "preview.contentcube.cn"


def _should_retry_insecure_ssl(url: str, ex: Exception) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").strip().lower()
    if host not in {"ts.fyshark.com"}:
        return False
    message = str(ex).lower()
    return "certificate verify failed" in message or "cert" in message


def _validate_public_http_url(url: str, label: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail=f"invalid {label}")
    host = parsed.hostname.strip().lower()
    if host in {"localhost", "127.0.0.1", "0.0.0.0"} or host.endswith(".local"):
        raise HTTPException(status_code=400, detail=f"unsafe {label}")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
        raise HTTPException(status_code=400, detail=f"unsafe {label}")


def _safe_filename(name: str) -> str:
    normalized = re.sub(r'[\\/:*?"<>|]+', "_", name).strip()
    normalized = normalized.replace("\r", "").replace("\n", "")
    return normalized[:120] or "resource.html"


def _ascii_filename(name: str) -> str:
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


def _guess_extension(url: str, content_type: str) -> str:
    lowered = (url or "").lower()
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf", ".pptx", ".ppt"):
        if lowered.endswith(ext):
            return ext
    mapping = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/svg+xml": ".svg",
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        "application/vnd.ms-powerpoint": ".ppt",
    }
    return mapping.get((content_type or "").lower(), ".bin")


def _is_ppt_like_url(url: str) -> bool:
    lowered = (url or "").lower()
    return lowered.endswith(".pptx") or lowered.endswith(".ppt")


def _build_ppt_preview_html(source_url: str) -> str:
    embed = f"https://view.officeapps.live.com/op/embed.aspx?src={quote(source_url, safe='')}"
    safe = embed.replace('"', "&quot;")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PPT Preview</title>
  <style>
    html, body {{ margin: 0; padding: 0; width: 100%; height: 100%; background: #f7f8fa; }}
    .wrap {{ width: 100%; height: 100%; }}
    iframe {{ border: 0; width: 100%; height: 100%; }}
  </style>
</head>
<body>
  <div class="wrap">
    <iframe src="{safe}" allowfullscreen></iframe>
  </div>
</body>
</html>"""


def _is_iframe_embeddable_url(url: str) -> bool:
    """检测可以直接用 iframe 嵌入预览的 URL（如 mermaid.live、markmap 等）"""
    lowered = (url or "").lower()
    embeddable_domains = [
        "mermaid.live",
        "markmap.keepto.top",
        "markmap.js.org",
        "gapi.shutu.cn",
        "shutu.cn",
    ]
    return any(domain in lowered for domain in embeddable_domains)


def _is_shutu_url(url: str) -> bool:
    lowered = (url or "").lower()
    return "shutu.cn" in lowered


def _extract_shutu_image_url(html: str) -> str:
    if not html:
        return ""
    normalized = html_unescape(html).replace("\\/", "/")
    patterns = [
        r"https://static\.shutu\.cn/[^\"'<>\s]+?\.(?:png|jpe?g|webp)",
        r"https://[^\"'<>\s]+?/shutu/[^\"'<>\s]+?\.(?:png|jpe?g|webp)",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if match:
            return _sanitize_url(match.group(0))
    return ""


def _extract_shutu_image_url_from_page_sync(source_url: str) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return ""

    image_urls: list[str] = []

    def collect_url(url: str) -> None:
        cleaned = _sanitize_url(url)
        if cleaned and _is_shutu_image_url(cleaned) and cleaned not in image_urls:
            image_urls.append(cleaned)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page(viewport={"width": 1440, "height": 960})
                page.on("response", lambda response: collect_url(response.url))
                page.goto(source_url, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(5000)
                for url in page.eval_on_selector_all("img", "els => els.map(el => el.currentSrc || el.src).filter(Boolean)"):
                    collect_url(str(url))
                for url in page.eval_on_selector_all("meta[property='og:image'], meta[name='twitter:image']", "els => els.map(el => el.content).filter(Boolean)"):
                    collect_url(str(url))
            finally:
                browser.close()
    except Exception:
        return ""

    return image_urls[0] if image_urls else ""


def _is_shutu_image_url(url: str) -> bool:
    lowered = (url or "").lower()
    if re.search(r"\.(?:png|jpe?g|webp)(?:$|\?)", lowered) is None:
        return False
    return "static.shutu.cn/shutu/" in lowered or re.search(r"/shutu/(?:jpeg|jpg|png|webp)/", lowered) is not None


def _build_pan_zoom_image_preview_html(image_url: str, *, title: str) -> str:
    safe_url = image_url.replace('"', "&quot;")
    safe_title = escape(title or "思维导图")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{safe_title}</title>
  <style>
    html, body {{
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #f5f7ff;
      font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    }}
    .viewer {{
      position: fixed;
      inset: 0;
      overflow: hidden;
      cursor: grab;
      touch-action: none;
      background:
        radial-gradient(circle at 20% 20%, rgba(59, 130, 246, .08), transparent 28%),
        linear-gradient(135deg, #f8fbff 0%, #f4f6ff 100%);
    }}
    .viewer:active {{ cursor: grabbing; }}
    img {{
      position: absolute;
      left: 50%;
      top: 50%;
      max-width: none;
      max-height: none;
      user-select: none;
      -webkit-user-drag: none;
      transform-origin: 0 0;
      box-shadow: 0 18px 50px rgba(15, 23, 42, .14);
      border-radius: 12px;
      background: #fff;
    }}
    .toolbar {{
      position: fixed;
      right: 18px;
      top: 18px;
      z-index: 2;
      display: flex;
      gap: 8px;
      padding: 8px;
      border: 1px solid rgba(203, 213, 225, .9);
      border-radius: 12px;
      background: rgba(255, 255, 255, .92);
      box-shadow: 0 10px 30px rgba(15, 23, 42, .1);
      backdrop-filter: blur(10px);
    }}
    button {{
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 9px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 18px;
      font-weight: 800;
      cursor: pointer;
    }}
    button:hover {{ background: #dbeafe; }}
    .reset {{
      width: auto;
      padding: 0 12px;
      font-size: 13px;
    }}
  </style>
</head>
<body>
  <div class="viewer" id="viewer">
    <img id="mindmap" src="{safe_url}" alt="{safe_title}" draggable="false" />
  </div>
  <div class="toolbar">
    <button id="zoomOut" aria-label="缩小">-</button>
    <button id="zoomIn" aria-label="放大">+</button>
    <button id="reset" class="reset" aria-label="适配全图">适配</button>
  </div>
  <script>
    const viewer = document.getElementById('viewer');
    const img = document.getElementById('mindmap');
    let scale = 1;
    let minScale = 0.2;
    let maxScale = 5;
    let x = 0;
    let y = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function render() {{
      img.style.transform = `translate(${{x}}px, ${{y}}px) scale(${{scale}})`;
    }}

    function fit() {{
      const vw = viewer.clientWidth;
      const vh = viewer.clientHeight;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      scale = Math.min(vw / iw, vh / ih) * 0.92;
      minScale = Math.max(scale * 0.35, 0.05);
      x = -iw * scale / 2;
      y = -ih * scale / 2;
      render();
    }}

    function zoomAt(nextScale, clientX, clientY) {{
      nextScale = Math.min(maxScale, Math.max(minScale, nextScale));
      const rect = viewer.getBoundingClientRect();
      const px = clientX - rect.left - rect.width / 2;
      const py = clientY - rect.top - rect.height / 2;
      const beforeX = (px - x) / scale;
      const beforeY = (py - y) / scale;
      scale = nextScale;
      x = px - beforeX * scale;
      y = py - beforeY * scale;
      render();
    }}

    img.addEventListener('load', fit);
    window.addEventListener('resize', fit);
    viewer.addEventListener('wheel', (event) => {{
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      zoomAt(scale * factor, event.clientX, event.clientY);
    }}, {{ passive: false }});
    viewer.addEventListener('pointerdown', (event) => {{
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      viewer.setPointerCapture(event.pointerId);
    }});
    viewer.addEventListener('pointermove', (event) => {{
      if (!dragging) return;
      x += event.clientX - lastX;
      y += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      render();
    }});
    viewer.addEventListener('pointerup', () => {{ dragging = false; }});
    viewer.addEventListener('pointercancel', () => {{ dragging = false; }});
    document.getElementById('zoomIn').addEventListener('click', () => zoomAt(scale * 1.18, viewer.clientWidth / 2, viewer.clientHeight / 2));
    document.getElementById('zoomOut').addEventListener('click', () => zoomAt(scale * 0.85, viewer.clientWidth / 2, viewer.clientHeight / 2));
    document.getElementById('reset').addEventListener('click', fit);
    if (img.complete) fit();
  </script>
</body>
</html>"""


def _build_iframe_preview_html(source_url: str) -> str:
    safe = source_url.replace('"', "&quot;")
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview</title>
  <style>
    html, body {{ margin: 0; padding: 0; width: 100%; height: 100%; background: #f7f8fa; }}
    .wrap {{ width: 100%; height: 100%; }}
    iframe {{ border: 0; width: 100%; height: 100%; }}
  </style>
</head>
<body>
  <div class="wrap">
    <iframe src="{safe}" allowfullscreen></iframe>
  </div>
</body>
</html>"""


async def _render_resource_pdf(item: dict[str, Any]) -> bytes:
    source_url = _resource_source_url(item)
    html_content = str(item.get("content", "") or "")
    title = str(item.get("title", "学习文档") or "学习文档")

    try:
        if source_url:
            return await asyncio.to_thread(_render_pdf_from_url_sync, source_url)
        html_doc = _markdown_as_printable_html(title=title, markdown_text=html_content)
        return await asyncio.to_thread(_render_pdf_from_html_sync, html_doc)
    except HTTPException:
        raise
    except NotImplementedError as ex:
        raise HTTPException(status_code=502, detail="PDF 渲染失败：当前环境不支持子进程策略。") from ex
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"PDF 渲染失败：{type(ex).__name__}: {repr(ex)}") from ex


def _render_pdf_from_html_sync(html_doc: str) -> bytes:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as ex:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"未安装 Playwright：{ex}") from ex

    with sync_playwright() as p:
        browser = _launch_chromium(p)
        try:
            page = browser.new_page()
            page.set_content(html_doc, wait_until="domcontentloaded")
            return page.pdf(format="A4", print_background=True, margin={"top": "14mm", "right": "12mm", "bottom": "14mm", "left": "12mm"})
        finally:
            browser.close()


def _render_pdf_from_url_sync(source_url: str) -> bytes:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as ex:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"未安装 Playwright：{ex}") from ex

    clean_print_css = """
        @page { size: A4; margin: 14mm; }
        html, body { background: #ffffff !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        nav, header, footer, .no-print, [data-no-print="true"] { display: none !important; }
    """

    with sync_playwright() as p:
        browser = _launch_chromium(p)
        try:
            page = browser.new_page()
            page.goto(source_url, wait_until="networkidle", timeout=60000)
            page.add_style_tag(content=clean_print_css)
            return page.pdf(format="A4", print_background=True, margin={"top": "14mm", "right": "12mm", "bottom": "14mm", "left": "12mm"})
        finally:
            browser.close()


def _launch_chromium(playwright):
    chromium_path = (
        os.getenv("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
        or shutil.which("chromium")
        or shutil.which("chromium-browser")
        or shutil.which("google-chrome")
    )
    launch_kwargs = {"executable_path": chromium_path} if chromium_path else {}
    return playwright.chromium.launch(headless=True, **launch_kwargs)


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


def _render_content_as_html(item: dict[str, Any]) -> str:
    """将资源自身的 content 渲染为可预览的 HTML 页面"""
    title = str(item.get("title", "学习资源"))
    content = str(item.get("content", "") or "")
    return _markdown_as_printable_html(title=title, markdown_text=content)


def _sanitize_url(url: str) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        return ""

    decoded = unquote(cleaned)
    decoded = decoded.replace("\\n", "").replace("\\r", "").replace("\\t", "").replace("\n", "").replace("\r", "").replace("\t", "")
    for marker in ("##", "# ", "###", "```", "</", "<", "|"):
        idx = decoded.find(marker)
        if idx > 0:
            decoded = decoded[:idx]
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


def _extract_embeddable_markdown_url(text: str) -> str:
    if not text:
        return ""
    for match in re.finditer(r"\[[^\]]+\]\((https?://[^)\s]+)\)", text):
        value = _sanitize_url(match.group(1))
        if _is_valid_url(value) and _is_iframe_embeddable_url(value):
            return value
    return ""


def _strip_marked_url(text: str) -> str:
    if not text:
        return text
    lines = text.splitlines()
    if lines and re.match(r"^SOURCE_URL:\s*", lines[0].strip(), flags=re.IGNORECASE):
        return "\n".join(lines[1:])
    return text


def _resource_source_url(item: dict[str, Any]) -> str:
    raw = str(item.get("source_url") or "").strip()
    if _is_valid_url(raw):
        return raw
    content = str(item.get("content", ""))
    return _extract_marked_url(content) or _extract_embeddable_markdown_url(content)


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
        if source_url and source_url in line and " " not in line and "\t" not in line:
            scheme_hits = line.count("https://") + line.count("http://")
            if scheme_hits > 1:
                continue
        if source_url and re.search(r"\[[^\]]+\]\((https?://[^\s)]+)\)", line):
            m = re.search(r"\[[^\]]+\]\((https?://[^\s)]+)\)", line)
            if m and _sanitize_url(m.group(1)) == source_url:
                continue
        kept.append(line)
    return "\n\n".join(kept).strip()
