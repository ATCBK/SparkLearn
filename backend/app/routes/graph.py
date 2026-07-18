from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..db import fetch_all
from ..schemas import fail, ok
from .learning import _GRAPH_NODES


router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/data")
async def graph_data(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    data = _build_graph_data(user_id)
    return ok(data)


@router.get("/node/{node_id}")
async def graph_node(node_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    data = _build_graph_data(user_id)
    node = next((item for item in data["nodes"] if item["id"] == node_id), None)
    if not node:
        return fail("知识点不存在")

    node_map = {item["id"]: item for item in data["nodes"]}
    prerequisites = []
    successors = []
    for edge in data["edges"]:
        if edge["type"] != "prerequisite":
            continue
        if edge["target"] == node_id and edge["source"] in node_map:
            prerequisites.append(_relation(node_map[edge["source"]]))
        if edge["source"] == node_id and edge["target"] in node_map:
            successors.append(_relation(node_map[edge["target"]]))

    return ok(
        {
            "node": node,
            "prerequisites": prerequisites,
            "successors": successors,
            "ai_suggestion": _suggestion(node),
        }
    )


@router.post("/generate")
async def generate_graph(current_user: dict = Depends(get_current_user)):
    return await graph_data(current_user)


def _build_graph_data(user_id: str) -> dict[str, Any]:
    mastery_rows = fetch_all(
        """
        SELECT knowledge_point_id, knowledge_point_name, score, chapter, last_updated
        FROM mastery_records
        WHERE user_id = ?
        """,
        (user_id,),
    )
    score_map = {str(row["knowledge_point_id"]): row for row in mastery_rows}

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    for item in _GRAPH_NODES:
        node_id = str(item["id"])
        row = score_map.get(node_id)
        score = float(row["score"]) if row else 0.0
        mastery = round(max(0.0, min(1.0, score)) * 100)
        nodes.append(
            {
                "id": node_id,
                "name": str(item["name"]),
                "category": str(item["stage"]),
                "difficulty": _difficulty(str(item["stage"])),
                "description": "、".join(str(x) for x in item.get("learning_contents", [])[:3]),
                "user_status": {
                    "mastery": mastery,
                    "status": _status(mastery, item.get("prerequisites", []), score_map),
                    "study_hours": 0,
                    "exercises_done": 0,
                    "exercises_correct": 0,
                    "accuracy": mastery,
                    "last_studied": str(row["last_updated"]) if row and row["last_updated"] else None,
                },
            }
        )
        for pre in item.get("prerequisites", []):
            edges.append({"source": str(pre), "target": node_id, "type": "prerequisite", "weight": 1})

    return {"nodes": nodes, "edges": edges, "stats": _stats(nodes)}


def _status(mastery: int, prerequisites: list[str], score_map: dict[str, Any]) -> str:
    if mastery >= 80:
        return "mastered"
    if mastery > 0:
        return "learning"
    if prerequisites and any(_score_for(score_map, str(pre)) < 0.6 for pre in prerequisites):
        return "locked"
    return "not_started"


def _score_for(score_map: dict[str, Any], node_id: str) -> float:
    row = score_map.get(node_id)
    return float(row["score"]) if row else 0.0


def _difficulty(stage: str) -> int:
    return {"基础语法": 1, "函数与模块": 2, "面向对象": 3, "文件处理": 2, "高级特性": 4}.get(stage, 2)


def _stats(nodes: list[dict[str, Any]]) -> dict[str, int]:
    result = {"total": len(nodes), "mastered": 0, "learning": 0, "not_started": 0, "locked": 0}
    for node in nodes:
        status = str(node["user_status"]["status"])
        if status in result:
            result[status] += 1
    return result


def _relation(node: dict[str, Any]) -> dict[str, Any]:
    status = node["user_status"]
    return {"id": node["id"], "name": node["name"], "mastery": status["mastery"], "status": status["status"]}


def _suggestion(node: dict[str, Any]) -> str:
    name = node["name"]
    mastery = int(node["user_status"]["mastery"])
    status = node["user_status"]["status"]
    if status == "mastered":
        return f"「{name}」掌握较好，可以尝试综合项目或更高难度练习。"
    if status == "learning":
        return f"「{name}」正在学习中，建议结合讲义和练习把掌握度提升到 80% 以上。"
    if status == "locked":
        return f"「{name}」建议先完成前置知识点，再进入本节点。"
    return f"「{name}」尚未开始，完成画像采集和第一组练习后，系统会更新你的掌握状态。"
