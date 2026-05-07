from __future__ import annotations

import json
import re
import uuid
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..llm import spark_lite
from ..schemas import ok

router = APIRouter(prefix="/api/ppt", tags=["ppt"])

SlideLayout = Literal["cover", "bullets", "process", "summary"]


class GeneratePptSchemaReq(BaseModel):
    topic: str = Field(min_length=2, max_length=120)
    outline: str = ""
    style: str = "tech-blue"
    slide_count: int = Field(default=6, ge=3, le=12)


@router.post("/generate-schema")
async def generate_schema(req: GeneratePptSchemaReq):
    schema = await _generate_schema_with_llm(req)
    return ok(schema)


async def _generate_schema_with_llm(req: GeneratePptSchemaReq) -> dict[str, Any]:
    prompt = (
        "你是幻灯片结构生成器。请只输出合法 JSON，不要 markdown，不要解释。\n"
        "输出格式:\n"
        "{\n"
        '  "theme": "tech-blue",\n'
        '  "title": "xxx",\n'
        '  "slides": [\n'
        "    {\n"
        '      "id": "s1",\n'
        '      "layout": "cover|bullets|process|summary",\n'
        '      "title": "页面标题",\n'
        '      "subtitle": "可选副标题",\n'
        '      "bullets": [{"id":"b1","text":"要点","step":1}],\n'
        '      "nodes": [{"id":"n1","label":"流程节点","step":1}],\n'
        '      "summary_points": ["结论1","结论2"],\n'
        '      "narration": [{"id":"n1","text":"讲解词","target":"b1"}]\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "约束:\n"
        "1) layout 只能是 cover/bullets/process/summary;\n"
        "2) slides 数量严格等于要求;\n"
        "3) cover 页必须是第一页，summary 页必须是最后一页;\n"
        "4) bullets 页使用 bullets 字段，process 页使用 nodes 字段，summary 页使用 summary_points;\n"
        "5) narration 每页至少1条，target 要指向本页元素 id 或标题 id;\n"
        "6) 所有中文简洁，不超过答辩PPT风格长度。\n"
        f"主题: {req.topic}\n"
        f"大纲: {req.outline or '无'}\n"
        f"风格: {req.style}\n"
        f"页数: {req.slide_count}\n"
    )
    raw = await _collect_llm_text(prompt)
    parsed = _extract_json_object(raw)
    if parsed:
        normalized = _normalize_schema(parsed, req)
        if normalized:
            return normalized
    return _fallback_schema(req)


async def _collect_llm_text(prompt: str) -> str:
    parts: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode="general", history=[]):
        if evt_type == "text":
            chunk = str(payload.get("content", ""))
            if chunk:
                parts.append(chunk)
    return "".join(parts).strip()


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass

    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize_schema(obj: dict[str, Any], req: GeneratePptSchemaReq) -> dict[str, Any] | None:
    slides_raw = obj.get("slides")
    if not isinstance(slides_raw, list):
        return None

    slides: list[dict[str, Any]] = []
    for i, raw in enumerate(slides_raw[: req.slide_count], start=1):
        if not isinstance(raw, dict):
            continue
        layout = str(raw.get("layout", "")).strip().lower()
        if layout not in {"cover", "bullets", "process", "summary"}:
            if i == 1:
                layout = "cover"
            elif i == req.slide_count:
                layout = "summary"
            else:
                layout = "bullets"

        title = str(raw.get("title", "")).strip() or f"第 {i} 页"
        slide_id = str(raw.get("id", "")).strip() or f"s{i}"

        slide: dict[str, Any] = {"id": slide_id, "layout": layout, "title": title}
        subtitle = str(raw.get("subtitle", "")).strip()
        if subtitle:
            slide["subtitle"] = subtitle

        if layout == "bullets":
            bullets = _normalize_steps(raw.get("bullets"), prefix=f"{slide_id}-b")
            if not bullets:
                bullets = [{"id": f"{slide_id}-b1", "text": "补充要点", "step": 1}]
            slide["bullets"] = bullets
        elif layout == "process":
            nodes = _normalize_nodes(raw.get("nodes"), prefix=f"{slide_id}-n")
            if not nodes:
                nodes = [{"id": f"{slide_id}-n1", "label": "步骤一", "step": 1}]
            slide["nodes"] = nodes
        elif layout == "summary":
            points = raw.get("summary_points")
            summary_points = [str(x).strip() for x in points if str(x).strip()] if isinstance(points, list) else []
            if not summary_points:
                summary_points = ["总结要点一", "总结要点二"]
            slide["summary_points"] = summary_points[:5]

        narration = _normalize_narration(raw.get("narration"), fallback_target=f"{slide_id}-title")
        if not narration:
            narration = [{"id": f"{slide_id}-narr-1", "text": f"下面介绍：{title}", "target": f"{slide_id}-title"}]
        slide["narration"] = narration
        slides.append(slide)

    if not slides:
        return None

    slides[0]["layout"] = "cover"
    slides[-1]["layout"] = "summary"
    if "summary_points" not in slides[-1]:
        slides[-1]["summary_points"] = ["回顾核心价值", "明确下一步行动"]

    # pad slides to requested count
    while len(slides) < req.slide_count:
        idx = len(slides) + 1
        slides.insert(
            -1,
            {
                "id": f"s{idx}",
                "layout": "bullets",
                "title": f"核心内容 {idx}",
                "bullets": [{"id": f"s{idx}-b1", "text": "补充内容", "step": 1}],
                "narration": [{"id": f"s{idx}-narr-1", "text": "补充说明。", "target": f"s{idx}-b1"}],
            },
        )

    return {
        "deck_id": f"deck_{uuid.uuid4().hex[:8]}",
        "theme": str(obj.get("theme", req.style) or req.style),
        "title": str(obj.get("title", req.topic) or req.topic),
        "slides": slides[: req.slide_count],
    }


def _normalize_steps(raw: Any, prefix: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for i, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            continue
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        out.append({"id": str(item.get("id", "")).strip() or f"{prefix}{i}", "text": text, "step": int(item.get("step", i))})
    return out[:8]


def _normalize_nodes(raw: Any, prefix: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for i, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            continue
        label = str(item.get("label", "")).strip()
        if not label:
            continue
        out.append({"id": str(item.get("id", "")).strip() or f"{prefix}{i}", "label": label, "step": int(item.get("step", i))})
    return out[:8]


def _normalize_narration(raw: Any, fallback_target: str) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for i, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            continue
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        out.append(
            {
                "id": str(item.get("id", "")).strip() or f"narr-{i}",
                "text": text,
                "target": str(item.get("target", "")).strip() or fallback_target,
            }
        )
    return out[:8]


def _fallback_schema(req: GeneratePptSchemaReq) -> dict[str, Any]:
    count = req.slide_count
    slides: list[dict[str, Any]] = [
        {
            "id": "s1",
            "layout": "cover",
            "title": req.topic,
            "subtitle": "HTML 幻灯片演示",
            "narration": [{"id": "s1-n1", "text": f"本次汇报主题是：{req.topic}", "target": "s1-title"}],
        }
    ]
    middle_count = max(1, count - 2)
    for idx in range(2, 2 + middle_count):
        slides.append(
            {
                "id": f"s{idx}",
                "layout": "bullets" if idx % 2 == 0 else "process",
                "title": f"核心内容 {idx - 1}",
                "bullets": [
                    {"id": f"s{idx}-b1", "text": "关键点一", "step": 1},
                    {"id": f"s{idx}-b2", "text": "关键点二", "step": 2},
                    {"id": f"s{idx}-b3", "text": "关键点三", "step": 3},
                ]
                if idx % 2 == 0
                else None,
                "nodes": [
                    {"id": f"s{idx}-n1", "label": "输入", "step": 1},
                    {"id": f"s{idx}-n2", "label": "处理", "step": 2},
                    {"id": f"s{idx}-n3", "label": "输出", "step": 3},
                ]
                if idx % 2 == 1
                else None,
                "narration": [{"id": f"s{idx}-na1", "text": "这一页说明核心流程。", "target": f"s{idx}-title"}],
            }
        )
    slides.append(
        {
            "id": f"s{count}",
            "layout": "summary",
            "title": "总结与下一步",
            "summary_points": ["回顾核心价值", "明确实施计划", "进入联调与演示"],
            "narration": [{"id": f"s{count}-na1", "text": "以上是本次方案总结。", "target": f"s{count}-title"}],
        }
    )

    # clear None fields
    normalized = []
    for s in slides[:count]:
        normalized.append({k: v for k, v in s.items() if v is not None})

    return {
        "deck_id": f"deck_{uuid.uuid4().hex[:8]}",
        "theme": req.style,
        "title": req.topic,
        "slides": normalized,
    }
