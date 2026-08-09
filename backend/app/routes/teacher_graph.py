from __future__ import annotations

import json
import math
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_all, fetch_one, get_conn, now_iso
from ..llm import spark_lite
from ..schemas import fail, ok
from .knowledge import _extract_text

router = APIRouter(prefix="/api/teacher/knowledge-graphs", tags=["teacher-knowledge-graphs"])


class GraphNode(BaseModel):
    id: str
    label: str
    type: str = "知识点"
    description: str = ""
    difficulty: int = 2
    x: float = 120
    y: float = 120
    color: str = "#2563eb"
    source: str = "ai"


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str = "相关"
    label: str = "相关"


class KnowledgeGraphUpdateReq(BaseModel):
    title: str
    description: str = ""
    target_classes: list[str] = []
    status: str = "draft"
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class KnowledgeGraphCreateReq(BaseModel):
    title: str
    description: str = ""
    target_classes: list[str] = []
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []


@router.get("")
async def list_teacher_knowledge_graphs():
    rows = fetch_all(
        """
        SELECT *
        FROM teacher_knowledge_graphs
        WHERE user_id = ?
        ORDER BY updated_at DESC, id DESC
        """,
        (settings.single_user_id,),
    )
    return ok([_graph_row(row, include_graph=False) for row in rows])


@router.get("/{graph_id}")
async def get_teacher_knowledge_graph(graph_id: int):
    row = _get_graph(graph_id)
    if not row:
        return fail("知识图谱不存在")
    return ok(_graph_row(row, include_graph=True))


@router.post("")
async def create_teacher_knowledge_graph(req: KnowledgeGraphCreateReq):
    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    nodes = [node.model_dump() for node in req.nodes] or _default_seed_nodes()
    edges = [_clean_edge(edge.model_dump()) for edge in req.edges]
    row = _insert_graph(
        title=title,
        description=req.description.strip(),
        target_classes=req.target_classes,
        status="draft",
        nodes=nodes,
        edges=edges,
        source_files=[],
        source_summary="手动创建的知识图谱草稿。",
    )
    return ok(_graph_row(row, include_graph=True))


@router.post("/from-files")
async def create_teacher_knowledge_graph_from_files(
    files: list[UploadFile] = File(...),
    title: str = Form(""),
    description: str = Form(""),
    target_classes: str = Form(""),
):
    if not files:
        raise HTTPException(status_code=400, detail="files are required")

    upload_dir = settings.data_dir / "users" / settings.single_user_id / "teacher" / "knowledge_graphs" / "sources"
    upload_dir.mkdir(parents=True, exist_ok=True)

    texts: list[str] = []
    source_files: list[dict[str, Any]] = []
    for file in files:
        raw = await file.read()
        if not raw:
            continue
        raw_name = (file.filename or "source").replace("\n", "").replace("\r", "").strip()
        safe_name = "".join(ch if ch not in '\\/:*?"<>|' else "_" for ch in raw_name)[:140] or "source"
        stored_path = upload_dir / f"{now_iso().replace(':', '').replace('.', '')}_{uuid.uuid4().hex[:6]}_{safe_name}"
        stored_path.write_bytes(raw)
        try:
            text = _extract_text(stored_path, file.content_type or "", safe_name)
        except Exception as ex:
            return fail(f"{safe_name} 解析失败：{ex}")
        if text.strip():
            texts.append(text.strip())
        source_files.append(
            {
                "filename": safe_name,
                "stored_path": str(stored_path),
                "mime_type": file.content_type or "application/octet-stream",
                "size_bytes": len(raw),
            }
        )

    if not texts:
        return fail("未能从上传资料中提取到有效文本")

    merged_text = "\n\n".join(texts)
    graph_title = title.strip() or _guess_title(source_files)
    generated = await _generate_graph_from_text(graph_title, merged_text)
    row = _insert_graph(
        title=graph_title,
        description=description.strip() or generated.get("description", ""),
        target_classes=_parse_classes(target_classes),
        status="draft",
        nodes=generated["nodes"],
        edges=generated["edges"],
        source_files=source_files,
        source_summary=generated.get("source_summary", ""),
    )
    return ok(_graph_row(row, include_graph=True))


@router.put("/{graph_id}")
async def update_teacher_knowledge_graph(graph_id: int, req: KnowledgeGraphUpdateReq):
    row = _get_graph(graph_id)
    if not row:
        return fail("知识图谱不存在")
    status = req.status if req.status in {"draft", "published"} else "draft"
    ts = now_iso()
    execute(
        """
        UPDATE teacher_knowledge_graphs
        SET title = ?, description = ?, target_classes = ?, status = ?,
            nodes_json = ?, edges_json = ?, updated_at = ?,
            published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END
        WHERE id = ? AND user_id = ?
        """,
        (
            req.title.strip() or "未命名知识图谱",
            req.description.strip(),
            json.dumps(_clean_classes(req.target_classes), ensure_ascii=False),
            status,
            json.dumps([node.model_dump() for node in req.nodes], ensure_ascii=False),
            json.dumps([_clean_edge(edge.model_dump()) for edge in req.edges], ensure_ascii=False),
            ts,
            status,
            ts,
            graph_id,
            settings.single_user_id,
        ),
    )
    updated = _get_graph(graph_id)
    return ok(_graph_row(updated, include_graph=True))


@router.post("/{graph_id}/publish")
async def publish_teacher_knowledge_graph(graph_id: int):
    row = _get_graph(graph_id)
    if not row:
        return fail("知识图谱不存在")
    ts = now_iso()
    execute(
        """
        UPDATE teacher_knowledge_graphs
        SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (ts, ts, graph_id, settings.single_user_id),
    )
    updated = _get_graph(graph_id)
    return ok(_graph_row(updated, include_graph=True))


@router.delete("/{graph_id}")
async def delete_teacher_knowledge_graph(graph_id: int):
    row = _get_graph(graph_id)
    if not row:
        return fail("知识图谱不存在")
    execute("DELETE FROM teacher_knowledge_graphs WHERE id = ? AND user_id = ?", (graph_id, settings.single_user_id))
    return ok({"deleted": True, "id": graph_id})


def _get_graph(graph_id: int):
    return fetch_one(
        "SELECT * FROM teacher_knowledge_graphs WHERE id = ? AND user_id = ?",
        (graph_id, settings.single_user_id),
    )


def _insert_graph(
    *,
    title: str,
    description: str,
    target_classes: list[str],
    status: str,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    source_files: list[dict[str, Any]],
    source_summary: str,
):
    ts = now_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO teacher_knowledge_graphs(
              user_id, title, description, status, target_classes,
              source_files, source_summary, nodes_json, edges_json,
              created_at, updated_at, published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')
            """,
            (
                settings.single_user_id,
                title,
                description,
                status,
                json.dumps(_clean_classes(target_classes), ensure_ascii=False),
                json.dumps(source_files, ensure_ascii=False),
                source_summary,
                json.dumps(nodes, ensure_ascii=False),
                json.dumps(edges, ensure_ascii=False),
                ts,
                ts,
            ),
        )
        return conn.execute("SELECT * FROM teacher_knowledge_graphs WHERE id = last_insert_rowid()").fetchone()


def _graph_row(row: Any, include_graph: bool) -> dict[str, Any]:
    nodes = _safe_json_list(row["nodes_json"])
    edges = _safe_json_list(row["edges_json"])
    result = {
        "id": int(row["id"]),
        "title": str(row["title"] or ""),
        "description": str(row["description"] or ""),
        "status": str(row["status"] or "draft"),
        "target_classes": _safe_string_list(row["target_classes"]),
        "source_files": _safe_json_list(row["source_files"]),
        "source_summary": str(row["source_summary"] or ""),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "created_at": str(row["created_at"] or ""),
        "updated_at": str(row["updated_at"] or ""),
        "published_at": str(row["published_at"] or ""),
    }
    if include_graph:
        result["nodes"] = nodes
        result["edges"] = edges
    return result


async def _generate_graph_from_text(title: str, text: str) -> dict[str, Any]:
    sample = text[:6000]
    prompt = (
        "你是教师端知识图谱构建助手。请从资料中抽取 8 到 16 个知识点节点和它们之间的关系。"
        "只输出 JSON，不要 Markdown。JSON 结构："
        '{"description":"一句话概括","nodes":[{"label":"知识点","type":"概念|方法|公式|案例|能力",'
        '"description":"不超过40字","difficulty":1}],"edges":[{"source":"节点名","target":"节点名",'
        '"type":"前驱|后继|相关"}]}。关系类型只能从“前驱、后继、相关”中选择。'
        f"\n图谱标题：{title}\n资料内容：\n{sample}"
    )
    try:
        parts: list[str] = []
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode="general", history=[]):
            if evt_type == "text":
                parts.append(str(payload.get("content", "")))
        parsed = _parse_llm_graph("".join(parts))
        if parsed["nodes"]:
            return _normalize_generated_graph(parsed, text)
    except Exception:
        pass
    return _heuristic_graph(title, text)


def _parse_llm_graph(raw: str) -> dict[str, Any]:
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]
    data = json.loads(text)
    return {
        "description": str(data.get("description") or ""),
        "nodes": data.get("nodes") if isinstance(data.get("nodes"), list) else [],
        "edges": data.get("edges") if isinstance(data.get("edges"), list) else [],
    }


def _normalize_generated_graph(data: dict[str, Any], source_text: str) -> dict[str, Any]:
    labels: list[str] = []
    nodes: list[dict[str, Any]] = []
    for idx, item in enumerate(data.get("nodes", [])[:18]):
        label = str(item.get("label") or item.get("name") or "").strip()
        if not label or label in labels:
            continue
        labels.append(label)
        x, y = _layout_position(len(labels) - 1, min(16, max(8, len(data.get("nodes", [])))))
        nodes.append(
            {
                "id": f"node-{uuid.uuid4().hex[:8]}",
                "label": label[:32],
                "type": _safe_node_type(str(item.get("type") or "知识点")),
                "description": str(item.get("description") or _snippet_for_label(source_text, label))[:120],
                "difficulty": _safe_difficulty(item.get("difficulty")),
                "x": x,
                "y": y,
                "color": _color_for_type(str(item.get("type") or "")),
                "source": "ai",
            }
        )
    by_label = {node["label"]: node["id"] for node in nodes}
    edges: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for item in data.get("edges", [])[:32]:
        source_label = str(item.get("source") or "").strip()
        target_label = str(item.get("target") or "").strip()
        source = by_label.get(source_label)
        target = by_label.get(target_label)
        edge_type = _safe_edge_type(str(item.get("type") or "相关"))
        key = (source or "", target or "", edge_type)
        if not source or not target or source == target or key in seen:
            continue
        seen.add(key)
        edges.append({"id": f"edge-{uuid.uuid4().hex[:8]}", "source": source, "target": target, "type": edge_type, "label": edge_type})
    if len(nodes) > 1 and not edges:
        edges = _sequential_edges(nodes)
    return {
        "description": str(data.get("description") or "根据上传资料生成的知识图谱草稿。")[:180],
        "source_summary": _summary_from_text(source_text),
        "nodes": nodes,
        "edges": edges,
    }


def _heuristic_graph(title: str, text: str) -> dict[str, Any]:
    labels = _extract_candidate_labels(text)
    if not labels:
        labels = [title, "核心概念", "基础知识", "关键方法", "应用练习"]
    nodes: list[dict[str, Any]] = []
    total = max(6, min(14, len(labels)))
    for idx, label in enumerate(labels[:total]):
        x, y = _layout_position(idx, total)
        node_type = _infer_node_type(label)
        nodes.append(
            {
                "id": f"node-{uuid.uuid4().hex[:8]}",
                "label": label[:32],
                "type": node_type,
                "description": _snippet_for_label(text, label),
                "difficulty": min(5, 1 + idx // 3),
                "x": x,
                "y": y,
                "color": _color_for_type(node_type),
                "source": "ai",
            }
        )
    return {
        "description": f"根据《{title}》资料自动抽取的知识结构草稿。",
        "source_summary": _summary_from_text(text),
        "nodes": nodes,
        "edges": _sequential_edges(nodes),
    }


def _extract_candidate_labels(text: str) -> list[str]:
    candidates: list[str] = []
    for line in text.splitlines():
        clean = re.sub(r"^[#\-\*\s\d.、（）()]+", "", line.strip())
        clean = re.sub(r"\s+", " ", clean)
        if 2 <= len(clean) <= 24 and not clean.endswith(("。", "，", ",")):
            candidates.append(clean)
    keyword_pattern = re.compile(r"[\u4e00-\u9fffA-Za-z0-9_+#/]{2,18}")
    stop = {"以及", "或者", "可以", "进行", "通过", "一个", "我们", "你们", "他们", "使用", "学习", "知识", "内容"}
    freq: dict[str, int] = {}
    for token in keyword_pattern.findall(text):
        if token in stop or token.isdigit():
            continue
        freq[token] = freq.get(token, 0) + 1
    ranked = [item for item, _count in sorted(freq.items(), key=lambda pair: (-pair[1], len(pair[0])))]
    merged: list[str] = []
    for label in candidates + ranked:
        value = label.strip(" ：:；;，,。")
        if len(value) < 2 or value in merged:
            continue
        if any(value in existing or existing in value for existing in merged):
            continue
        merged.append(value)
        if len(merged) >= 14:
            break
    return merged


def _layout_position(index: int, total: int) -> tuple[float, float]:
    center_x, center_y = 430, 270
    radius_x, radius_y = 270, 170
    if index == 0:
        return center_x, center_y
    angle = -1.2 + (index - 1) * (6.28 / max(1, total - 1))
    return round(center_x + radius_x * math.cos(angle), 1), round(center_y + radius_y * math.sin(angle), 1)


def _sequential_edges(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    for idx in range(max(0, len(nodes) - 1)):
        edge_type = "前驱" if idx < max(2, len(nodes) // 2) else "相关"
        edges.append(
            {
                "id": f"edge-{uuid.uuid4().hex[:8]}",
                "source": nodes[idx]["id"],
                "target": nodes[idx + 1]["id"],
                "type": edge_type,
                "label": edge_type,
            }
        )
    return edges


def _snippet_for_label(text: str, label: str) -> str:
    idx = text.find(label)
    if idx >= 0:
        return re.sub(r"\s+", " ", text[idx : idx + 90]).strip()
    return "来自上传资料的知识点，可由教师继续补充说明。"


def _summary_from_text(text: str) -> str:
    sample = re.sub(r"\s+", " ", text).strip()
    return sample[:180] + ("..." if len(sample) > 180 else "")


def _guess_title(files: list[dict[str, Any]]) -> str:
    if not files:
        return "未命名知识图谱"
    first = Path(str(files[0].get("filename") or "资料")).stem
    return f"{first} 知识图谱"


def _parse_classes(raw: str) -> list[str]:
    return _clean_classes(re.split(r"[,，\n]", raw or ""))


def _clean_classes(values: list[str]) -> list[str]:
    result: list[str] = []
    for item in values:
        value = str(item or "").strip()
        if value and value not in result:
            result.append(value[:30])
    return result


def _safe_string_list(raw: Any) -> list[str]:
    values = _safe_json_list(raw)
    return [str(item) for item in values if str(item).strip()]


def _safe_json_list(raw: Any) -> list[Any]:
    try:
        value = json.loads(raw or "[]")
        return value if isinstance(value, list) else []
    except Exception:
        return []


def _safe_difficulty(value: Any) -> int:
    try:
        return max(1, min(5, int(value)))
    except Exception:
        return 2


def _safe_node_type(value: str) -> str:
    normalized = value.strip()
    return normalized if normalized in {"知识点", "概念", "方法", "公式", "案例", "能力"} else "知识点"


def _safe_edge_type(value: str) -> str:
    normalized = value.strip()
    if normalized == "前置知识":
        return "前驱"
    return normalized if normalized in {"前驱", "后继", "相关"} else "相关"


def _clean_edge(edge: dict[str, Any]) -> dict[str, Any]:
    edge_type = _safe_edge_type(str(edge.get("type") or edge.get("label") or "相关"))
    return {
        **edge,
        "type": edge_type,
        "label": edge_type,
    }


def _infer_node_type(label: str) -> str:
    if any(key in label for key in ["公式", "定理", "法则"]):
        return "公式"
    if any(key in label for key in ["方法", "步骤", "策略", "算法"]):
        return "方法"
    if any(key in label for key in ["案例", "例题", "实践", "项目"]):
        return "案例"
    if any(key in label for key in ["能力", "目标", "素养"]):
        return "能力"
    return "知识点"


def _color_for_type(node_type: str) -> str:
    return {
        "概念": "#2563eb",
        "知识点": "#2563eb",
        "方法": "#0f766e",
        "公式": "#7c3aed",
        "案例": "#d97706",
        "能力": "#dc2626",
    }.get(node_type, "#2563eb")


def _default_seed_nodes() -> list[dict[str, Any]]:
    return [
        {
            "id": f"node-{uuid.uuid4().hex[:8]}",
            "label": "核心知识点",
            "type": "知识点",
            "description": "双击或在右侧面板中编辑节点内容。",
            "difficulty": 2,
            "x": 430,
            "y": 270,
            "color": "#2563eb",
            "source": "custom",
        }
    ]
