"""Learning Companion Agent - API Routes"""
from __future__ import annotations

import asyncio
import json
import re
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, field_validator

from ..config import settings
from ..db import execute, fetch_all, fetch_one, get_conn, now_iso
from ..llm import spark_lite
from ..schemas import fail, ok

router = APIRouter(prefix="/api/agent", tags=["agent"])

# --- Constants ---

AVATARS = ("fox", "owl", "robot", "cat", "dragon", "penguin", "bunny", "panda")
PERSONALITIES = ("concise", "verbose", "encouraging")
TASK_TYPES = ("search", "summarize", "compare", "recommend")

LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000]
XP_REWARDS = {"search": 10, "summarize": 20, "compare": 25, "recommend": 15}
LEVEL_ABILITIES: dict[int, list[str]] = {
    1: ["search"],
    2: ["search", "summarize"],
    3: ["search", "summarize", "compare"],
    4: ["search", "summarize", "compare", "recommend"],
    5: ["search", "summarize", "compare", "recommend"],
}

PERSONA_PROMPTS = {
    "concise": "You are a concise learning assistant. Keep replies under 80 chars, direct and to the point.",
    "verbose": "You are a detailed learning assistant. Give 150-300 char replies with explanations and examples.",
    "encouraging": "You are a warm encouraging learning assistant. Give 100-200 char replies with positive encouragement.",
}


# --- Request Models ---

class AdoptPetReq(BaseModel):
    name: str
    avatar: str = "fox"
    personality: str = "encouraging"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 10:
            raise ValueError("Name must be 1-10 characters")
        if not re.match(r"^[\u4e00-\u9fa5a-zA-Z0-9]+$", v):
            raise ValueError("Name only allows Chinese, English, numbers")
        return v

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, v: str) -> str:
        if v not in AVATARS:
            raise ValueError(f"Avatar must be one of: {', '.join(AVATARS)}")
        return v

    @field_validator("personality")
    @classmethod
    def validate_personality(cls, v: str) -> str:
        if v not in PERSONALITIES:
            raise ValueError(f"Personality must be one of: {', '.join(PERSONALITIES)}")
        return v


class UpdatePetReq(BaseModel):
    personality: str | None = None
    name: str | None = None

    @field_validator("personality")
    @classmethod
    def validate_personality(cls, v: str | None) -> str | None:
        if v is not None and v not in PERSONALITIES:
            raise ValueError(f"Personality must be one of: {', '.join(PERSONALITIES)}")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v or len(v) > 10:
                raise ValueError("Name must be 1-10 characters")
            if not re.match(r"^[\u4e00-\u9fa5a-zA-Z0-9]+$", v):
                raise ValueError("Name only allows Chinese, English, numbers")
        return v


class CreateTaskReq(BaseModel):
    task_type: str
    input_text: str

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, v: str) -> str:
        if v not in TASK_TYPES:
            raise ValueError(f"Task type must be one of: {', '.join(TASK_TYPES)}")
        return v

    @field_validator("input_text")
    @classmethod
    def validate_input_text(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 200:
            raise ValueError("Input must be 1-200 characters")
        return v


class FeedbackReq(BaseModel):
    feedback: str

    @field_validator("feedback")
    @classmethod
    def validate_feedback(cls, v: str) -> str:
        if v not in ("useful", "not_useful"):
            raise ValueError("Feedback must be useful or not_useful")
        return v


class BookmarkReq(BaseModel):
    task_id: str
    item_index: int = 0
    title: str
    url: str = ""
    summary: str = ""


# --- Helper Functions ---

def _pet_row_to_dict(row: Any) -> dict:
    if row is None:
        return None  # type: ignore
    level = int(row["level"])
    xp = int(row["xp"])
    next_xp = LEVEL_THRESHOLDS[level] if level < 5 else None
    return {
        "id": row["id"],
        "name": row["name"],
        "avatar": row["avatar"],
        "personality": row["personality"],
        "level": level,
        "xp": xp,
        "next_level_xp": next_xp,
        "unlocked_abilities": LEVEL_ABILITIES.get(level, LEVEL_ABILITIES[1]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _task_row_to_dict(row: Any) -> dict:
    result = None
    if row["result_json"]:
        try:
            result = json.loads(row["result_json"])
        except (json.JSONDecodeError, TypeError):
            result = None
    return {
        "task_id": row["id"],
        "task_type": row["task_type"],
        "input_text": row["input_text"],
        "status": row["status"],
        "result": result,
        "error_message": row["error_message"],
        "feedback": row["feedback"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _get_pet(user_id: str) -> Any:
    return fetch_one("SELECT * FROM agent_pets WHERE user_id = ?", (user_id,))


def _compute_level(xp: int) -> int:
    level = 1
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            level = i + 1
    return min(level, 5)


def _award_xp(pet_id: str, task_type: str) -> tuple[int, int, int | None]:
    reward = XP_REWARDS.get(task_type, 10)
    row = fetch_one("SELECT xp, level FROM agent_pets WHERE id = ?", (pet_id,))
    if not row:
        return (0, 1, None)
    old_xp = int(row["xp"])
    old_level = int(row["level"])
    new_xp = old_xp + reward
    new_level = _compute_level(new_xp)
    execute(
        "UPDATE agent_pets SET xp = ?, level = ?, updated_at = ? WHERE id = ?",
        (new_xp, new_level, now_iso(), pet_id),
    )
    leveled_up = new_level if new_level > old_level else None
    return (new_xp, new_level, leveled_up)


def _add_step(task_id: str, step_index: int, action: str, description: str):
    execute(
        "INSERT INTO agent_task_steps (task_id, step_index, action, description, created_at) VALUES (?, ?, ?, ?, ?)",
        (task_id, step_index, action, description, now_iso()),
    )


# --- Task Execution (Background) ---

async def _execute_task(task_id: str, task_type: str, input_text: str, pet_id: str, personality: str):
    """Background task execution using browser + Spark Lite API"""
    try:
        execute(
            "UPDATE agent_tasks SET status = 'running', updated_at = ? WHERE id = ?",
            (now_iso(), task_id),
        )
        _add_step(task_id, 0, "start", "开始处理任务...")

        persona_prompt = PERSONA_PROMPTS.get(personality, PERSONA_PROMPTS["encouraging"])

        if task_type == "search":
            result = await _do_search(task_id, input_text, persona_prompt)
        elif task_type == "summarize":
            result = await _do_summarize(task_id, input_text, persona_prompt)
        elif task_type == "compare":
            result = await _do_compare(task_id, input_text, persona_prompt)
        elif task_type == "recommend":
            result = await _do_recommend(task_id, input_text, persona_prompt)
        else:
            result = {"error": "Unknown task type"}

        execute(
            "UPDATE agent_tasks SET status = 'completed', result_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(result, ensure_ascii=False), now_iso(), task_id),
        )
        _add_step(task_id, 99, "done", "任务完成！")
        _award_xp(pet_id, task_type)

    except asyncio.TimeoutError:
        execute(
            "UPDATE agent_tasks SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
            ("任务超时，请稍后重试", now_iso(), task_id),
        )
        _add_step(task_id, 99, "error", "任务超时")
    except Exception as ex:
        error_msg = str(ex)[:500]
        execute(
            "UPDATE agent_tasks SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?",
            (error_msg, now_iso(), task_id),
        )
        _add_step(task_id, 99, "error", f"任务失败: {error_msg[:100]}")


async def _do_search(task_id: str, query: str, persona: str) -> dict:
    """Real browser search using Playwright"""
    from ..browser_agent import _get_agent

    def on_step(idx: int, action: str, desc: str):
        _add_step(task_id, idx, action, desc)

    try:
        result = await asyncio.wait_for(
            _get_agent().search(query, on_step=on_step, max_results=5),
            timeout=40,
        )
        if result.get("items") and len(result["items"]) > 0:
            return result
        # Fallback to LLM if browser got no results
        _add_step(task_id, 9, "extract", "浏览器未获取到结果，使用 AI 补充...")
        return await _do_search_llm_fallback(task_id, query, persona)
    except (asyncio.TimeoutError, Exception):
        _add_step(task_id, 9, "extract", "浏览器搜索超时，使用 AI 补充...")
        return await _do_search_llm_fallback(task_id, query, persona)


async def _do_search_llm_fallback(task_id: str, query: str, persona: str) -> dict:
    prompt = f"""请根据以下学习需求，推荐 3-5 个优质学习资源。

学习需求：{query}

请严格按以下 JSON 格式返回（不要包含其他文字）：
{{"items": [{{"title": "资源标题", "summary": "50字以内的摘要描述", "url": "资源链接", "source": "来源网站"}}]}}

要求：
- 推荐真实存在的知名教程、文档或博客
- 优先推荐中文资源
- 摘要要精炼有用"""

    chunks: list[str] = []
    async for c in spark_lite.stream_chat(prompt, mode="general"):
        chunks.append(c)
    text = "".join(chunks).strip()
    try:
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            if "items" in result:
                return result
    except (json.JSONDecodeError, TypeError):
        pass
    return {"items": [{"title": query, "summary": text[:200], "url": "", "source": "AI"}]}


async def _do_summarize(task_id: str, input_text: str, persona: str) -> dict:
    """Real browser visit URL + LLM summarize"""
    from ..browser_agent import _get_agent

    def on_step(idx: int, action: str, desc: str):
        _add_step(task_id, idx, action, desc)

    is_url = input_text.strip().startswith("http://") or input_text.strip().startswith("https://")
    content_to_summarize = input_text

    if is_url:
        try:
            result = await asyncio.wait_for(
                _get_agent().summarize_url(input_text.strip(), on_step=on_step),
                timeout=25,
            )
            if result.get("content") and len(result["content"]) > 50:
                content_to_summarize = result["content"]
        except (asyncio.TimeoutError, Exception):
            _add_step(task_id, 6, "extract", "页面访问超时，使用输入文本...")
    else:
        _add_step(task_id, 1, "start", "正在分析文本内容...")

    _add_step(task_id, 7, "extract", "正在生成结构化摘要...")
    prompt = f"""请对以下内容生成结构化摘要。

内容：{content_to_summarize[:3000]}

请严格按以下 JSON 格式返回（不要包含其他文字）：
{{"topic": "一句话概括主题", "key_points": ["要点1", "要点2", "要点3"], "conclusion": "1-2句话总结"}}"""

    chunks: list[str] = []
    async for c in spark_lite.stream_chat(prompt, mode="general"):
        chunks.append(c)
    text = "".join(chunks).strip()
    try:
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            if "topic" in result:
                return result
    except (json.JSONDecodeError, TypeError):
        pass
    return {"topic": "Summary", "key_points": [text[:200]], "conclusion": "See above."}


async def _do_compare(task_id: str, query: str, persona: str) -> dict:
    """Real browser compare search"""
    from ..browser_agent import _get_agent

    def on_step(idx: int, action: str, desc: str):
        _add_step(task_id, idx, action, desc)

    try:
        result = await asyncio.wait_for(
            _get_agent().compare_search(query, on_step=on_step, num_sources=3),
            timeout=50,
        )
        if result.get("items") and len(result["items"]) > 0:
            # Generate comparison summary with LLM
            _add_step(task_id, 10, "extract", "正在生成对比总结...")
            sources_text = "\n".join([f"Source {i+1} ({s['source']}): {s['explanation'][:150]}" for i, s in enumerate(result["items"])])
            prompt = f"Compare these sources in 50 chars or less:\n{sources_text}"
            chunks: list[str] = []
            async for c in spark_lite.stream_chat(prompt, mode="general"):
                chunks.append(c)
            result["comparison"] = "".join(chunks).strip()[:200]
            return result
        _add_step(task_id, 10, "extract", "浏览器未获取到结果，使用 AI...")
        return await _do_compare_llm_fallback(task_id, query, persona)
    except (asyncio.TimeoutError, Exception):
        _add_step(task_id, 10, "extract", "浏览器对比超时，使用 AI...")
        return await _do_compare_llm_fallback(task_id, query, persona)


async def _do_compare_llm_fallback(task_id: str, query: str, persona: str) -> dict:
    prompt = f"""请从不同角度解释以下概念，提供 3 种不同视角的解释。

概念：{query}

请严格按以下 JSON 格式返回（不要包含其他文字）：
{{"items": [{{"source": "视角名称", "explanation": "该视角的解释（100字以内）", "url": ""}}], "comparison": "50字以内的对比总结"}}"""

    chunks: list[str] = []
    async for c in spark_lite.stream_chat(prompt, mode="general"):
        chunks.append(c)
    text = "".join(chunks).strip()
    try:
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            if "items" in result:
                return result
    except (json.JSONDecodeError, TypeError):
        pass
    return {"items": [{"source": "AI", "explanation": text[:200], "url": ""}], "comparison": ""}


async def _do_recommend(task_id: str, input_text: str, persona: str) -> dict:
    _add_step(task_id, 1, "navigate", "正在分析学习情况...")
    _add_step(task_id, 2, "search", "正在筛选推荐内容...")

    prompt = f"""请根据以下学习情况推荐 3 条学习资源。

学习情况：{input_text}

请严格按以下 JSON 格式返回（不要包含其他文字）：
{{"items": [{{"title": "资源标题", "summary": "50字以内简介", "url": "", "reason": "推荐理由"}}]}}"""

    _add_step(task_id, 3, "extract", "正在生成推荐...")
    chunks: list[str] = []
    async for c in spark_lite.stream_chat(prompt, mode="general"):
        chunks.append(c)
    text = "".join(chunks).strip()
    try:
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            if "items" in result:
                return result
    except (json.JSONDecodeError, TypeError):
        pass
    return {"items": [{"title": "Recommendation", "summary": text[:200], "url": "", "reason": "Based on learning profile"}]}


def _extract_tags(title: str, summary: str) -> list[str]:
    text = f"{title} {summary}"
    words = re.findall(r'[\u4e00-\u9fa5]{2,4}|[a-zA-Z]{3,}', text)
    seen: set[str] = set()
    tags: list[str] = []
    for w in words:
        w_lower = w.lower()
        if w_lower not in seen and len(tags) < 5:
            seen.add(w_lower)
            tags.append(w[:10])
    return tags or ["learning"]


# --- API Routes ---

@router.post("/pet")
async def adopt_pet(req: AdoptPetReq):
    user_id = settings.single_user_id
    existing = _get_pet(user_id)
    if existing:
        return fail("您已拥有学习伙伴")

    pet_id = str(uuid.uuid4())
    ts = now_iso()
    try:
        execute(
            """INSERT INTO agent_pets (id, user_id, name, avatar, personality, level, xp, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)""",
            (pet_id, user_id, req.name, req.avatar, req.personality, ts, ts),
        )
    except Exception as ex:
        return fail(f"创建失败: {ex}")

    row = fetch_one("SELECT * FROM agent_pets WHERE id = ?", (pet_id,))
    return ok(_pet_row_to_dict(row))


@router.get("/pet")
async def get_pet():
    user_id = settings.single_user_id
    row = _get_pet(user_id)
    if not row:
        return ok(None)
    return ok(_pet_row_to_dict(row))


@router.patch("/pet")
async def update_pet(req: UpdatePetReq):
    user_id = settings.single_user_id
    row = _get_pet(user_id)
    if not row:
        return fail("您还没有学习伙伴")

    updates = []
    params: list[Any] = []
    if req.personality is not None:
        updates.append("personality = ?")
        params.append(req.personality)
    if req.name is not None:
        updates.append("name = ?")
        params.append(req.name)
    if not updates:
        return ok(_pet_row_to_dict(row))

    updates.append("updated_at = ?")
    params.append(now_iso())
    params.append(row["id"])
    execute(f"UPDATE agent_pets SET {', '.join(updates)} WHERE id = ?", tuple(params))
    updated = fetch_one("SELECT * FROM agent_pets WHERE id = ?", (row["id"],))
    return ok(_pet_row_to_dict(updated))


@router.post("/task")
async def create_task(req: CreateTaskReq, background_tasks: BackgroundTasks):
    user_id = settings.single_user_id
    pet = _get_pet(user_id)
    if not pet:
        return fail("请先认养学习伙伴")

    level = int(pet["level"])
    abilities = LEVEL_ABILITIES.get(level, LEVEL_ABILITIES[1])
    if req.task_type not in abilities:
        needed_level = next(
            (lv for lv, abs_ in LEVEL_ABILITIES.items() if req.task_type in abs_), 5
        )
        return fail(f"当前等级不足，需要 Lv.{needed_level} 解锁此能力")

    running = fetch_one(
        "SELECT id FROM agent_tasks WHERE user_id = ? AND status IN ('pending', 'running')",
        (user_id,),
    )
    if running:
        return fail("当前有任务正在执行，请等待完成")

    task_id = str(uuid.uuid4())
    ts = now_iso()
    execute(
        """INSERT INTO agent_tasks (id, user_id, pet_id, task_type, input_text, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)""",
        (task_id, user_id, pet["id"], req.task_type, req.input_text, ts, ts),
    )
    execute(
        "INSERT INTO agent_messages (task_id, user_id, sender, content, created_at) VALUES (?, ?, 'user', ?, ?)",
        (task_id, user_id, req.input_text, ts),
    )

    background_tasks.add_task(
        _execute_task, task_id, req.task_type, req.input_text, pet["id"], pet["personality"]
    )

    return ok({"task_id": task_id, "task_type": req.task_type, "status": "pending", "created_at": ts})


@router.get("/task/{task_id}")
async def get_task(task_id: str):
    user_id = settings.single_user_id
    row = fetch_one("SELECT * FROM agent_tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    if not row:
        return fail("任务不存在或无权访问")

    steps = fetch_all(
        "SELECT step_index, action, description, created_at FROM agent_task_steps WHERE task_id = ? ORDER BY step_index ASC",
        (task_id,),
    )
    step_list = [{"step": int(s["step_index"]), "action": s["action"], "description": s["description"], "time": s["created_at"]} for s in steps]
    task_data = _task_row_to_dict(row)
    task_data["steps"] = step_list
    return ok(task_data)


@router.get("/tasks")
async def list_tasks(page: int = 1, page_size: int = 20):
    user_id = settings.single_user_id
    offset = (page - 1) * page_size
    total_row = fetch_one("SELECT COUNT(1) as cnt FROM agent_tasks WHERE user_id = ?", (user_id,))
    total = int(total_row["cnt"]) if total_row else 0
    rows = fetch_all(
        "SELECT * FROM agent_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (user_id, page_size, offset),
    )
    items = [_task_row_to_dict(r) for r in rows]
    return ok({"items": items, "total": total, "page": page, "page_size": page_size})


@router.post("/task/{task_id}/feedback")
async def submit_feedback(task_id: str, req: FeedbackReq):
    user_id = settings.single_user_id
    row = fetch_one("SELECT * FROM agent_tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    if not row:
        return fail("任务不存在")
    execute("UPDATE agent_tasks SET feedback = ?, updated_at = ? WHERE id = ?", (req.feedback, now_iso(), task_id))
    return ok({"task_id": task_id, "feedback": req.feedback})


@router.post("/bookmark")
async def bookmark_resource(req: BookmarkReq):
    user_id = settings.single_user_id
    if req.url:
        existing = fetch_one("SELECT id FROM knowledge_files WHERE user_id = ? AND stored_path = ?", (user_id, req.url))
        if existing:
            return fail("该资源已收藏")

    ts = now_iso()
    tags = _extract_tags(req.title, req.summary)
    execute(
        """INSERT INTO knowledge_files (user_id, filename, stored_path, mime_type, size_bytes, status, tags, summary, chunk_count, reference_count, created_at, updated_at)
           VALUES (?, ?, ?, 'text/html', 0, 'indexed', ?, ?, 0, 0, ?, ?)""",
        (user_id, req.title, req.url or "", json.dumps(tags, ensure_ascii=False), req.summary, ts, ts),
    )
    return ok({"title": req.title, "tags": tags, "url": req.url})


@router.get("/recommendations")
async def get_recommendations():
    user_id = settings.single_user_id
    pet = _get_pet(user_id)
    if not pet:
        return fail("请先认养学习伙伴")
    level = int(pet["level"])
    if level < 4:
        return fail(f"每日推荐需要 Lv.4 解锁，当前 Lv.{level}")

    profile = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    stage = profile["current_stage"] if profile else "basics"
    weak_points = profile["weak_points"] if profile else "[]"

    prompt = f"""Recommend 3 learning resources for:
Stage: {stage}, Weak points: {weak_points}
Return JSON: {{"items": [{{"title": "t", "summary": "s", "url": "", "reason": "r"}}], "date": "{now_iso()[:10]}"}}"""

    chunks: list[str] = []
    async for c in spark_lite.stream_chat(prompt, mode="general"):
        chunks.append(c)
    text = "".join(chunks).strip()
    try:
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            return ok(json.loads(json_match.group()))
    except (json.JSONDecodeError, TypeError):
        pass
    return ok({"items": [], "date": now_iso()[:10], "cached": False})
