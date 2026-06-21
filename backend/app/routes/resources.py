import asyncio
import ipaddress
import json
import re
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

from ..coze import coze_adapter
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
    return datetime.utcnow().strftime("%Y-%m-%d")


@router.get("")
async def get_resources():
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    # 合并视频资源
    video_resources = read_json(settings.single_user_id, "video_resources.json", [])
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
    resources.extend(_web_material_resources())
    return ok(resources)


@router.post("/generate")
async def generate_resource(req: GenerateReq):
    async def gen() -> AsyncGenerator[tuple[str, dict[str, Any]], None]:
        res_id = f"gen-{uuid.uuid4().hex[:8]}"
        yield ("progress", {"stage": "started", "resource_id": res_id, "progress": 5})
        resource_type = (req.type or "").strip().lower()

        if resource_type == "ppt":
            try:
                yield ("progress", {"stage": "creating", "resource_id": res_id, "progress": 15})
                created = await xfyun_ppt_client.create_ppt(query=req.prompt.strip() or "生成学习PPT")
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
        elif resource_type == "blog":
            # 播客电台：直接调用星火大模型生成播客脚本
            chunks: list[str] = []
            progress = 10
            blog_prompt = _build_resource_prompt("blog", req.prompt)

            yield ("progress", {"stage": "generating", "resource_id": res_id, "progress": 10})
            async for evt_type, payload in spark_lite.stream_chat_events(blog_prompt, mode="general", history=[]):
                if evt_type == "text":
                    chunk = str(payload.get("content", ""))
                    if chunk:
                        chunks.append(chunk)
                        progress = min(progress + 5, 90)
                        yield ("text", {"content": chunk, "resource_id": res_id})
                        yield ("progress", {"stage": "generating", "resource_id": res_id, "progress": progress})
                elif evt_type == "error":
                    yield ("error", payload)

            content = "".join(chunks).strip()
            if not content:
                content = _fallback_resource_content("blog", req.prompt)

            resource = {
                "id": res_id,
                "title": req.prompt[:20] or "新生成播客",
                "type": "blog",
                "status": "completed",
                "created_at": _now_date(),
                "content": f"# {req.prompt}\n\n{content}",
                "source_url": None,
                "progress": 100,
            }
        else:
            chunks: list[str] = []
            provider_errors: list[str] = []
            explicit_source_url = ""
            progress = 10
            resource_prompt = _build_resource_prompt(req.type, req.prompt)

            async for evt_type, payload in coze_adapter.stream_resource_text(
                resource_type=req.type,
                prompt=resource_prompt,
                user_id=settings.single_user_id,
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

        resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
        resources.append(resource)
        write_json(settings.single_user_id, "resources_index.json", resources)
        append_jsonl(settings.single_user_id, "resource_usage.jsonl", {"type": "resource_generated", "resource_id": res_id})
        yield ("done", {"resource_id": res_id, "resource": resource})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.post("/code/evaluate/{resource_id}")
async def evaluate_code_resource(resource_id: str, req: CodeEvaluateReq):
    item = _find_resource(resource_id)
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
    append_jsonl(settings.single_user_id, "resource_code_evaluations.jsonl", {
        "resource_id": resource_id,
        "question": req.question.strip(),
        "student_code": student_code,
        "correct": result["correct"],
        "reason": result["reason"],
    })
    return ok(result)


@router.post("/{resource_id}/quality-evaluate")
async def evaluate_resource_quality(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")

    profile = read_json(settings.single_user_id, "profile_snapshot.json", {})
    result = await _evaluate_resource_quality(item, profile if isinstance(profile, dict) else {})
    return ok(result)


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

    # 没有外部链接时，直接渲染自身 content
    if not link:
        return HTMLResponse(content=_render_content_as_html(item))

    if _is_ppt_like_url(link):
        return HTMLResponse(content=_build_ppt_preview_html(link))

    if _is_iframe_embeddable_url(link):
        return HTMLResponse(content=_build_iframe_preview_html(link))

    try:
        html = await _fetch_url_text(link)
        safe_link = link.replace('"', "&quot;")
        if "<head" in html.lower():
            html = re.sub(r"(<head[^>]*>)", r'\1<base href="' + safe_link + '" />', html, count=1, flags=re.IGNORECASE)
        else:
            html = f'<base href="{safe_link}" />\n{html}'
        return HTMLResponse(content=html)
    except Exception:
        # 外部 URL 获取失败（SSL 过期、404 等），fallback 显示资源自身内容
        return HTMLResponse(content=_render_content_as_html(item))


@router.get("/{resource_id}/download")
async def download_resource(resource_id: str):
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
            headers={"Content-Disposition": _build_content_disposition(_safe_filename(title + ".md")), "Cache-Control": "no-store"},
        )

    html = await _fetch_url_text(link)
    return StreamingResponse(
        iter([html.encode("utf-8")]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": _build_content_disposition(filename), "Cache-Control": "no-store"},
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
        headers={"Content-Disposition": _build_content_disposition(filename), "Cache-Control": "no-store"},
    )


@router.get("/{resource_id}/download/source")
async def download_resource_source(resource_id: str):
    item = _find_resource(resource_id)
    if not item:
        raise HTTPException(status_code=404, detail="resource not found")
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
async def delete_resource(resource_id: str):
    if resource_id.startswith("webmat-"):
        file_id = _web_material_id(resource_id)
        if file_id:
            row = fetch_one("SELECT id, stored_path FROM tutor_files WHERE id = ? AND user_id = ? AND source_type = 'web_capture'", (file_id, settings.single_user_id))
            if row:
                path = Path(str(row["stored_path"] or ""))
                if path.exists() and path.is_file():
                    path.unlink()
                execute("DELETE FROM tutor_file_chunks WHERE file_id = ?", (file_id,))
                execute("DELETE FROM tutor_files WHERE id = ? AND user_id = ?", (file_id, settings.single_user_id))
                return ok({"resource_id": resource_id, "deleted": True})
        return ok({"resource_id": resource_id, "deleted": False})

    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    before = len(resources)
    next_resources = [r for r in resources if str(r.get("id", "")) != resource_id]
    removed = before - len(next_resources)
    write_json(settings.single_user_id, "resources_index.json", next_resources)
    append_jsonl(settings.single_user_id, "resource_usage.jsonl", {"type": "resource_deleted", "resource_id": resource_id, "removed_count": removed})
    return ok({"resource_id": resource_id, "deleted": removed > 0})


@router.get("/recommendations/list")
async def get_recommendations():
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
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


def _build_resource_prompt(resource_type: str, user_prompt: str) -> str:
    base = user_prompt.strip()
    profile_context = _profile_context_for_generation()
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
            "SOURCE_URL: NONE\n\n"
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


def _profile_context_for_generation() -> str:
    profile = read_json(settings.single_user_id, "profile_snapshot.json", {})
    if not isinstance(profile, dict) or not profile:
        return ""
    parts = []
    student = fetch_one("SELECT major FROM students WHERE user_id = ?", (settings.single_user_id,))
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


def _find_resource(resource_id: str) -> dict[str, Any] | None:
    if resource_id.startswith("webmat-"):
        return _find_web_material_resource(resource_id)
    resources = read_json(settings.single_user_id, "resources_index.json", _default_resources())
    for item in resources:
        if str(item.get("id", "")) == resource_id:
            return item
    return None


def _web_material_id(resource_id: str) -> int | None:
    match = re.fullmatch(r"webmat-(\d+)", resource_id or "")
    return int(match.group(1)) if match else None


def _web_material_resources() -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT *
        FROM tutor_files
        WHERE user_id = ? AND source_type = 'web_capture'
        ORDER BY created_at DESC, id DESC
        """,
        (settings.single_user_id,),
    )
    return [_web_material_row_to_resource(row, include_content=False) for row in rows]


def _find_web_material_resource(resource_id: str) -> dict[str, Any] | None:
    file_id = _web_material_id(resource_id)
    if not file_id:
        return None
    row = fetch_one(
        "SELECT * FROM tutor_files WHERE id = ? AND user_id = ? AND source_type = 'web_capture'",
        (file_id, settings.single_user_id),
    )
    return _web_material_row_to_resource(row, include_content=True) if row else None


def _web_material_row_to_resource(row, include_content: bool = False) -> dict[str, Any]:
    analysis = _safe_json_dict(row["analysis_json"] if "analysis_json" in row.keys() else "{}")
    content = ""
    path = Path(str(row["stored_path"] or ""))
    if include_content and path.exists() and path.is_file():
        content = path.read_text(encoding="utf-8", errors="ignore")
    return {
        "id": f"webmat-{int(row['id'])}",
        "title": str(row["filename"] or "网页资料"),
        "type": "web_material",
        "status": str(row["status"] or "completed") if "status" in row.keys() else "completed",
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
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=3) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp
    except httpx.ConnectError as ex:
        if not _should_retry_insecure_ssl(url, ex):
            raise
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=3, verify=False) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp


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
    embeddable_domains = ["mermaid.live", "markmap.keepto.top", "markmap.js.org", "preview.contentcube.cn"]
    return any(domain in lowered for domain in embeddable_domains)


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
        browser = p.chromium.launch(headless=True)
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
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.goto(source_url, wait_until="networkidle", timeout=60000)
            page.add_style_tag(content=clean_print_css)
            return page.pdf(format="A4", print_background=True, margin={"top": "14mm", "right": "12mm", "bottom": "14mm", "left": "12mm"})
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
