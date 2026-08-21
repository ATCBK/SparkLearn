"""Learning Companion Agent - API Routes"""
from __future__ import annotations

import asyncio
import html
import json
import logging
import re
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, field_validator

from ..agent_intent import normalize_search_query, plan_search_intent
from ..config import settings
from ..auth import get_current_user
from ..db import execute, fetch_all, fetch_one, get_conn, now_iso
from ..llm import spark_lite
from ..profile_reset import (
    CONFIRMATION_ACTIVE,
    CONFIRMATION_CLAIMED,
    CONFIRMATION_EXPIRED,
    claim_pending_reset,
    consume_pending_reset,
    request_reset_confirmation,
    reset_learning_profile,
    restore_pending_reset,
)
from ..schemas import fail, ok

router = APIRouter(prefix="/api/agent", tags=["agent"])
logger = logging.getLogger("agent")

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

AGENT_LLM_MODEL = "ds-flash"
AGENT_CHAT_MEMORY_LIMIT = 6
AGENT_SEARCH_MEMORY_LIMIT = 3
AGENT_SEARCH_MEMORY_SCAN_LIMIT = 30

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
    avatar: str | None = None

    @field_validator("personality")
    @classmethod
    def validate_personality(cls, v: str | None) -> str | None:
        if v is not None and v not in PERSONALITIES:
            raise ValueError(f"Personality must be one of: {', '.join(PERSONALITIES)}")
        return v

    @field_validator("avatar")
    @classmethod
    def validate_avatar(cls, v: str | None) -> str | None:
        if v is not None and v not in AVATARS:
            raise ValueError(f"Avatar must be one of: {', '.join(AVATARS)}")
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


class PetChatReq(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 800:
            raise ValueError("Message must be 1-800 characters")
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


def _chat_memory_key(pet_id: str) -> str:
    return f"pet-chat:{pet_id}"


def _clean_memory_text(value: Any, *, limit: int = 500) -> str:
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]+", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def _load_recent_chat_memory(user_id: str, pet_id: str) -> str:
    rows = fetch_all(
        """SELECT sender, content
           FROM agent_messages
           WHERE user_id = ? AND task_id = ? AND sender IN ('user', 'agent')
           ORDER BY id DESC LIMIT ?""",
        (user_id, _chat_memory_key(pet_id), AGENT_CHAT_MEMORY_LIMIT),
    )
    lines: list[str] = []
    for row in reversed(rows):
        content = _clean_memory_text(row["content"])
        if content:
            speaker = "用户" if row["sender"] == "user" else "学习伙伴"
            lines.append(f"{speaker}：{content}")
    return "\n".join(lines)


def _recall_recent_chat_memory(user_id: str, pet_id: str) -> str:
    try:
        return _load_recent_chat_memory(user_id, pet_id)
    except Exception:
        logger.warning("学习伙伴近期对话记忆读取失败，本轮按无历史继续。", exc_info=True)
        return ""


def _save_chat_turn(user_id: str, pet_id: str, message: str, answer: str) -> None:
    memory_key = _chat_memory_key(pet_id)
    ts = now_iso()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO agent_messages (task_id, user_id, sender, content, created_at) VALUES (?, ?, 'user', ?, ?)",
            (memory_key, user_id, _clean_memory_text(message, limit=800), ts),
        )
        conn.execute(
            "INSERT INTO agent_messages (task_id, user_id, sender, content, created_at) VALUES (?, ?, 'agent', ?, ?)",
            (memory_key, user_id, _clean_memory_text(answer, limit=1200), ts),
        )


def _remember_chat_turn(user_id: str, pet_id: str, message: str, answer: str) -> None:
    try:
        _save_chat_turn(user_id, pet_id, message, answer)
    except Exception:
        logger.warning("学习伙伴近期对话记忆写入失败，本轮回答仍正常返回。", exc_info=True)


def _load_recent_search_context(task_id: str) -> list[str]:
    current = fetch_one("SELECT user_id FROM agent_tasks WHERE id = ?", (task_id,))
    if not current:
        return []
    rows = fetch_all(
        """SELECT result_json
           FROM agent_tasks
           WHERE user_id = ? AND task_type = 'search' AND status = 'completed' AND id <> ?
           ORDER BY updated_at DESC, id DESC LIMIT ?""",
        (current["user_id"], task_id, AGENT_SEARCH_MEMORY_SCAN_LIMIT),
    )
    queries: list[str] = []
    for row in rows:
        try:
            result = json.loads(row["result_json"] or "{}")
        except (json.JSONDecodeError, TypeError):
            continue
        query = normalize_search_query(result.get("query_used")) if isinstance(result, dict) else ""
        if query and query not in queries:
            queries.append(query)
            if len(queries) >= AGENT_SEARCH_MEMORY_LIMIT:
                break
    return queries


def _recall_recent_search_context(task_id: str) -> list[str]:
    try:
        return _load_recent_search_context(task_id)
    except Exception:
        logger.warning("学习伙伴近期检索记忆读取失败，本轮仅使用当前输入。", exc_info=True)
        return []


def _load_agent_profile_context(user_id: str) -> str:
    profile = fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
    if not profile:
        return "用户还没有完整学习画像。"

    def field(name: str, default: str = "") -> Any:
        return profile[name] if name in profile.keys() else default

    def parse_json_list(value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item) for item in value if str(item).strip()]
        try:
            parsed = json.loads(value or "[]")
            return [str(item) for item in parsed if str(item).strip()] if isinstance(parsed, list) else []
        except Exception:
            return []
    goals = "、".join(parse_json_list(profile["goal"])) or "暂无"
    weak = "、".join(parse_json_list(profile["weak_points"])) or "暂无"
    preference = "、".join(parse_json_list(profile["learning_preference"])) or "暂无"
    return (
        f"姓名：{field('name') or '未填写'}；专业：{field('major') or '未填写'}；"
        f"年级：{field('grade') or '未填写'}；目标：{goals}；薄弱点：{weak}；"
        f"偏好：{preference}；阶段：{field('current_stage') or '暂无'}。"
    )


def _local_agent_chat_fallback(message: str, pet_name: str, personality: str) -> str:
    topic = message.strip()
    prefix = f"我是{pet_name}，"
    if personality == "concise":
        return f"{prefix}现在模型服务暂时不可用，但我可以先帮你拆一下：{topic}。你可以先写下定义、关键特征和一个例子，再继续追问。"
    if personality == "verbose":
        return (
            f"{prefix}模型服务暂时没有连上，我先用本地思路陪你过一遍：{topic}。"
            "建议先分三步处理：先明确它的定义，再找一个最小例子，最后总结它适合解决什么问题。"
            "等模型服务恢复后，我可以继续帮你展开讲解或生成练习。"
        )
    return (
        f"{prefix}模型服务暂时没连上，不过我们可以先往前走。关于「{topic}」，"
        "先抓住定义、例子、常见误区这三块就很好。你可以把你卡住的点发我，我继续帮你拆。"
    )


def _normalized_reset_reply(message: str) -> str:
    return re.sub(r"[\s，。！？、,.!?]+", "", message.strip())


def _is_profile_reset_intent(message: str) -> bool:
    text = _normalized_reset_reply(message)
    actions = ("重置", "清空", "重新建立", "重新建档")
    objects = ("学习画像", "画像", "建档")
    if not (any(action in text for action in actions) and any(target in text for target in objects)):
        return False

    action_pattern = r"(?:重置|清空|重新建立|重新建档)"
    denial_patterns = (
        r"(?:不要|不想|不希望|无需|不需要|不必|不用|请勿|勿|禁止|拒绝|别(?!人))",
        r"(?:不是|并非)(?:我|本人)(?:的决定|要|想|会|准备|打算|决定)",
        r"不代表(?:我|本人)(?:要|想|会|准备|打算|决定)",
    )
    if any(re.search(pattern, text) for pattern in denial_patterns):
        return False
    explanation_markers = (
        "是什么意思",
        "为什么",
        "为何",
        "如何",
        "怎么",
        "流程",
        "步骤",
        "安全吗",
        "安全么",
        "会怎样",
        "会怎么样",
        "有什么影响",
        "有什么风险",
    )
    if any(marker in text for marker in explanation_markers):
        return False

    non_request_patterns = (
        r"(?:只是|仅仅|单纯)(?:说说|提到|谈到|讨论)",
        r"(?:讨论|聊聊|谈谈|说说)(?:一下|下)?",
        r"(?:有人|别人|他人)(?:说|提到|谈到|建议|让我|叫我)",
        r"(?:只是|不过是)?(?:别人|有人|他人|导师|老师|同学)(?:说|提到|谈到|提出|建议)(?:的)?",
        rf"(?:如果|假如|假设|倘若|要是|比如|例如).{{0,16}}{action_pattern}",
        r"(?:假设|设想|引用|转述)",
    )
    if any(re.search(pattern, text) for pattern in non_request_patterns):
        return False

    request_text = re.sub(
        r"^(?:(?:请|麻烦|劳驾|拜托|能不能|能否|能|可以|可否|立即|马上|现在)|你)+",
        "",
        text,
    )
    explicit_request_patterns = (
        rf"^(?:帮我|替我|为我|给我)?{action_pattern}",
        rf"^我(?:已经)?(?:决定|现在要|要|想要|想|希望|准备|打算)(?:请你)?(?:帮我)?(?:立即|马上|现在)?{action_pattern}",
    )
    return any(re.search(pattern, request_text) for pattern in explicit_request_patterns)


def _is_profile_reset_confirmation(message: str) -> bool:
    return _normalized_reset_reply(message) in {"确认", "确认重置", "确定重置", "是的重置"}


def _is_profile_reset_cancellation(message: str) -> bool:
    return _normalized_reset_reply(message) in {"取消", "取消重置", "暂不重置", "不用了"}


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


async def _stream_agent_llm(prompt: str, mode: str = "general"):
    async for chunk in spark_lite.stream_chat(prompt, mode=mode, model=AGENT_LLM_MODEL):
        yield chunk


async def _stream_agent_llm_events(prompt: str, mode: str = "general"):
    """为结构化规划保留模型 error/done 事件，不改变旧字符串流契约。"""

    async for event in spark_lite.stream_chat_events(
        prompt,
        mode=mode,
        history=[],
        model=AGENT_LLM_MODEL,
    ):
        yield event


def _extract_first_url(text: str) -> str:
    match = re.search(r"https?://[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+", text.strip())
    if not match:
        return ""
    return match.group(0).rstrip(".,;:!?)]}。！？；，、")


def _html_to_readable_text(raw_html: str) -> str:
    cleaned = re.sub(r"(?is)<(script|style|noscript|svg|canvas).*?>.*?</\1>", " ", raw_html)
    cleaned = re.sub(r"(?is)</(p|div|section|article|main|header|footer|li|h[1-6]|tr)>", "\n", cleaned)
    cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = re.sub(r"[ \t\r\f\v]+", " ", cleaned)
    lines = [line.strip() for line in cleaned.split("\n") if len(line.strip()) > 2]
    seen: set[str] = set()
    readable: list[str] = []
    for line in lines:
        if line in seen:
            continue
        seen.add(line)
        readable.append(line)
        if len("\n".join(readable)) > 6000:
            break
    return "\n".join(readable)


async def _fetch_url_text(url: str) -> dict[str, str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
    }
    timeout = httpx.Timeout(15.0, connect=8.0, read=15.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        body = resp.text
    title_match = re.search(r"(?is)<title[^>]*>(.*?)</title>", body)
    title = html.unescape(re.sub(r"\s+", " ", title_match.group(1)).strip()) if title_match else ""
    text = _html_to_readable_text(body) if "html" in content_type.lower() or "<html" in body[:500].lower() else body.strip()
    return {"title": title, "content": text[:6000], "url": url}


async def _plan_browser_search_query(task_id: str, input_text: str, url: str, user_instruction: str) -> str:
    _add_step(task_id, 1, "plan", "讯飞星火正在分析用户意图，生成浏览器搜索词...")
    prompt = f"""请把用户任务改写成适合在搜索引擎中输入的短查询词。

要求：
- 不要照抄用户原话；
- 如果有 URL，保留域名或页面标识，加入用户真正想了解的主题；
- 只输出一行搜索词，不要解释，不要 JSON；
- 8 到 40 个中文/英文字符左右。

用户任务：{input_text}
URL：{url or "无"}
用户意图：{user_instruction or "无"}"""
    chunks: list[str] = []
    async for c in _stream_agent_llm(prompt, mode="general"):
        chunks.append(c)
    query = re.sub(r"[\r\n\"'`]+", " ", "".join(chunks)).strip()
    query = re.sub(r"\s+", " ", query).strip(" ：:，,。")
    if not query or len(query) > 80:
        domain = re.sub(r"^www\.", "", re.sub(r"^https?://", "", url).split("/")[0]) if url else ""
        query = " ".join(part for part in [domain, user_instruction or input_text.replace(url, "").strip()] if part).strip()
    _add_step(task_id, 2, "plan", f"讯飞星火生成搜索词：{query[:80]}")
    return query[:100]


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

        result = await _execute_fallback_task(task_id, task_type, input_text, persona_prompt)
        award_xp = bool(result.pop("award_xp", True))

        execute(
            "UPDATE agent_tasks SET status = 'completed', result_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(result, ensure_ascii=False), now_iso(), task_id),
        )
        _add_step(task_id, 99, "done", "任务完成！")
        if award_xp:
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


async def _execute_fallback_task(task_id: str, task_type: str, input_text: str, persona_prompt: str) -> dict:
    if task_type == "search":
        _add_step(task_id, 1, "plan", "正在分析用户意图...")
        recent_context = _recall_recent_search_context(task_id)
        plan = await plan_search_intent(input_text, _stream_agent_llm_events, recent_context)
        if plan["decision"] == "search":
            planned_query = plan.get("normalized_query", "")
            validated_query = normalize_search_query(planned_query)
            if not validated_query or validated_query != planned_query:
                plan = {
                    **plan,
                    "decision": "clarify",
                    "normalized_query": "",
                    "clarification_question": "检索词未通过安全校验，请换一种方式说明要查找的学习主题。",
                }
        planner_meta = {
            "schema_version": plan["schema_version"],
            "generated_by": plan["generated_by"],
            "decision": plan["decision"],
        }
        shared_result = {
            "query_used": "",
            "intent": plan,
            "_meta": {"planner": planner_meta},
        }

        if plan["decision"] == "clarify":
            _add_step(task_id, 2, "plan", "当前信息不足，需要补充检索主题。")
            return {
                **shared_result,
                "answer": plan["clarification_question"],
                "tool_status": "not_called",
                "award_xp": False,
            }

        if plan["decision"] == "respond":
            _add_step(task_id, 2, "plan", "该问题无需联网检索，正在直接回答。")
            answer = await _answer_without_browser(input_text, plan, persona_prompt)
            return {
                **shared_result,
                "answer": answer,
                "tool_status": "not_called",
                "award_xp": False,
            }

        query = plan["normalized_query"]
        _add_step(task_id, 2, "plan", f"已生成规范化检索词：{query}")
        _add_step(task_id, 3, "browser", "正在调用浏览器检索工具...")
        result = await _do_search(task_id, query, persona_prompt)
        _add_step(task_id, 50, "organize", "正在整理浏览器检索结果。")
        return {
            **result,
            "query_used": query,
            "intent": plan,
            "_meta": {"planner": planner_meta},
        }
    if task_type == "summarize":
        return await _do_summarize(task_id, input_text, persona_prompt)
    if task_type == "compare":
        return await _do_compare(task_id, input_text, persona_prompt)
    if task_type == "recommend":
        return await _do_recommend(task_id, input_text, persona_prompt)
    return {"error": "Unknown task type"}


async def _answer_without_browser(input_text: str, plan: dict[str, Any], persona: str) -> str:
    prompt = f"""你是 SparkLearn 学习伙伴。请直接回答用户问题，不要调用或声称调用浏览器工具。

性格要求：{persona}
回答目标：{plan.get("goal", "")}
关注重点：{plan.get("output_focus", "")}
用户问题：{input_text}

请用中文清晰回答；不要伪造外部来源或链接。"""
    chunks: list[str] = []
    try:
        async for chunk in _stream_agent_llm(prompt, mode="general"):
            chunks.append(chunk)
    except Exception:
        pass
    answer = "".join(chunks).strip()
    if answer:
        return answer
    return "这个问题不需要联网检索，但当前模型没有返回可展示的回答，请稍后重试。"


async def _do_search(task_id: str, query: str, persona: str) -> dict:
    """Real browser search using Playwright"""
    from ..browser_agent import _get_agent

    def on_step(idx: int, action: str, desc: str):
        _add_step(task_id, idx + 10, action, desc)

    try:
        result = await asyncio.wait_for(
            _get_agent().search(query, on_step=on_step, max_results=5),
            timeout=40,
        )
        if isinstance(result, dict) and result.get("error"):
            _add_step(task_id, 45, "error", "浏览器检索工具调用失败。")
            return {
                "items": [],
                "tool_status": "error",
                "message": "浏览器检索工具调用失败，请稍后重试。",
            }
        items = result.get("items") if isinstance(result, dict) else None
        if isinstance(items, list) and items:
            return {
                **result,
                "items": items,
                "tool_status": "success",
                "message": result.get("message") or "浏览器检索工具已返回结果。",
            }
        _add_step(task_id, 45, "extract", "浏览器检索工具未找到结果。")
        return {
            "items": [],
            "tool_status": "no_results",
            "message": "浏览器检索工具未找到结果，请补充条件或更换关键词。",
        }
    except asyncio.TimeoutError:
        _add_step(task_id, 45, "error", "浏览器检索工具调用超时。")
        return {
            "items": [],
            "tool_status": "timeout",
            "message": "浏览器检索工具调用超时，请稍后重试。",
        }
    except Exception:
        _add_step(task_id, 45, "error", "浏览器检索工具调用失败。")
        return {
            "items": [],
            "tool_status": "error",
            "message": "浏览器检索工具调用失败，请稍后重试。",
        }


async def _do_summarize(task_id: str, input_text: str, persona: str) -> dict:
    """Fetch URL/text content and summarize it with the agent LLM."""

    url = _extract_first_url(input_text)
    is_url = bool(url)
    content_to_summarize = input_text
    source_title = ""

    if is_url:
        user_instruction = input_text.replace(url, "").strip()
        search_query = await _plan_browser_search_query(task_id, input_text, url, user_instruction)
        _add_step(task_id, 3, "browser", "正在启动可见浏览器，通过搜索首页查找页面...")
        try:
            from ..browser_agent import _get_agent

            result = await asyncio.wait_for(
                _get_agent().summarize_from_homepage_search(
                    search_query,
                    target_url=url,
                    on_step=lambda idx, action, desc: _add_step(task_id, idx + 1, action, desc),
                ),
                timeout=75,
            )
            if result.get("content") and len(result["content"]) > 80:
                content_to_summarize = result["content"]
                source_title = result.get("title", "")
                _add_step(task_id, 30, "extract", f"浏览器正文读取完成，共 {len(content_to_summarize)} 字")
        except Exception as ex:
            _add_step(task_id, 30, "fetch", f"浏览器读取失败，切换后端直连: {str(ex)[:80]}")

        if content_to_summarize == input_text:
            try:
                fetched = await _fetch_url_text(url)
                if fetched.get("content") and len(fetched["content"]) > 80:
                    content_to_summarize = fetched["content"]
                    source_title = fetched.get("title", "")
                    _add_step(task_id, 31, "extract", f"后端正文读取完成，共 {len(content_to_summarize)} 字")
            except Exception as ex:
                _add_step(task_id, 31, "fetch", f"网页正文读取失败，改用输入文本: {str(ex)[:80]}")

        if content_to_summarize == input_text:
            content_to_summarize = f"用户问题：{input_text}\n\n注意：未能读取链接正文，只能基于用户提供的文字进行说明。"
    else:
        _add_step(task_id, 1, "start", "正在分析文本内容...")

    user_instruction = input_text.replace(url, "").strip() if url else input_text.strip()
    if not user_instruction:
        user_instruction = "请总结这段内容讲了什么。"

    _add_step(task_id, 40, "extract", "讯飞星火正在基于浏览器读取内容生成回答...")
    prompt = f"""请根据用户问题，对内容进行正常回答，不要强制输出 JSON，不要套模板。

用户问题：{user_instruction}
来源标题：{source_title or "无"}
来源链接：{url or "无"}

内容：
{content_to_summarize[:4500]}

请直接用中文回答。根据内容类型组织答案：如果是网页/赛题/通知，说明它讲了什么、核心要求、关键信息和下一步建议；如果是普通文本，就按用户问题自然总结。"""

    chunks: list[str] = []
    async for c in _stream_agent_llm(prompt, mode="general"):
        chunks.append(c)
    text = "".join(chunks).strip()
    return {
        "answer": text or "已读取内容，但模型没有返回可展示的回答。",
        "source_title": source_title,
        "source_url": url,
    }


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
            async for c in _stream_agent_llm(prompt, mode="general"):
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
    async for c in _stream_agent_llm(prompt, mode="general"):
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
    async for c in _stream_agent_llm(prompt, mode="general"):
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
async def adopt_pet(req: AdoptPetReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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
async def get_pet(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = _get_pet(user_id)
    if not row:
        return ok(None)
    return ok(_pet_row_to_dict(row))


@router.patch("/pet")
async def update_pet(req: UpdatePetReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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
    if req.avatar is not None:
        updates.append("avatar = ?")
        params.append(req.avatar)
    if not updates:
        return ok(_pet_row_to_dict(row))

    updates.append("updated_at = ?")
    params.append(now_iso())
    params.append(row["id"])
    execute(f"UPDATE agent_pets SET {', '.join(updates)} WHERE id = ?", tuple(params))
    updated = fetch_one("SELECT * FROM agent_pets WHERE id = ?", (row["id"],))
    return ok(_pet_row_to_dict(updated))


@router.post("/task")
async def create_task(req: CreateTaskReq, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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


@router.post("/chat")
async def chat_with_pet(req: PetChatReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    pet = _get_pet(user_id)
    if not pet:
        return fail("请先认养学习伙伴")

    if _is_profile_reset_confirmation(req.message):
        confirmation_state = claim_pending_reset(user_id)
        if confirmation_state == CONFIRMATION_ACTIVE:
            try:
                result = reset_learning_profile(user_id)
            except Exception:
                restored = False
                try:
                    restore_pending_reset(user_id)
                    restored = True
                except Exception:
                    pass
                if restored:
                    return fail("学习画像重置失败，确认仍然有效且可重试，请再次回复确认重置")
                return fail(
                    "学习画像重置失败，当前确认可能仍在处理中，请稍后查看处理状态；"
                    "若确认已过期，请重新发起画像重置"
                )
            return ok(
                {
                    **result,
                    "answer": "学习画像已重置，可以重新开始建档。",
                    "action": {"type": "navigate", "label": "重新开始建档", "href": "/onboarding"},
                    "created_at": result["reset_at"],
                }
            )
        if confirmation_state == CONFIRMATION_EXPIRED:
            return ok({"answer": "重置确认已过期或不存在，学习画像未改变。", "created_at": now_iso()})
        if confirmation_state == CONFIRMATION_CLAIMED:
            return ok({"answer": "学习画像正在重置，请稍候。", "created_at": now_iso()})
    if _is_profile_reset_cancellation(req.message):
        confirmation_state = consume_pending_reset(user_id)
        if confirmation_state == CONFIRMATION_ACTIVE:
            return ok({"answer": "已取消学习画像重置，当前画像保持不变。", "created_at": now_iso()})
        if confirmation_state == CONFIRMATION_EXPIRED:
            return ok({"answer": "重置确认已过期，当前画像保持不变。", "created_at": now_iso()})
        if confirmation_state == CONFIRMATION_CLAIMED:
            return ok({"answer": "学习画像正在重置，暂时无法取消。", "created_at": now_iso()})
    if _is_profile_reset_intent(req.message):
        request_reset_confirmation(user_id)
        return ok(
            {
                "answer": "重置会清除当前学习画像、专业年级和画像语义记忆，但保留账号与学习记录。请回复“确认重置”继续。",
                "action": {"type": "confirm_profile_reset"},
                "created_at": now_iso(),
            }
        )
    persona_prompt = PERSONA_PROMPTS.get(pet["personality"], PERSONA_PROMPTS["encouraging"])
    profile_context = _load_agent_profile_context(user_id)
    recent_memory = _recall_recent_chat_memory(user_id, pet["id"])
    memory_context = recent_memory or "暂无可用的近期对话。"
    prompt = f"""你是 SparkLearn 的学习伙伴「{pet['name']}」。
性格要求：{persona_prompt}
用户画像：{profile_context}
最近对话记忆（最多 6 条，仅用于承接本轮上下文）：
{memory_context}

回答要求：
- 用中文直接回答用户问题；
- 保持对话式，不要输出 JSON；
- 不要声称网页端可以控制用户本地浏览器；
- 如果用户问浏览器控制，说明只有安装本地桌面端后才能控制本地浏览器，线上 Web 版只支持对话、任务建议和学习资源处理；
- 如果模型、额度或工具不可用，明确建议联系项目负责人处理。

用户：{req.message}
学习伙伴："""

    chunks: list[str] = []
    try:
        async for c in _stream_agent_llm(prompt, mode="general"):
            chunks.append(c)
    except Exception as ex:
        answer = _local_agent_chat_fallback(req.message, pet["name"], pet["personality"])
        _remember_chat_turn(user_id, pet["id"], req.message, answer)
        return ok({"answer": answer, "created_at": now_iso(), "fallback": True, "error": str(ex)[:160]})
    answer = "".join(chunks).strip() or _local_agent_chat_fallback(req.message, pet["name"], pet["personality"])
    _remember_chat_turn(user_id, pet["id"], req.message, answer)
    return ok({"answer": answer, "created_at": now_iso()})


@router.get("/task/{task_id}")
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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
async def list_tasks(page: int = 1, page_size: int = 20, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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
async def submit_feedback(task_id: str, req: FeedbackReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = fetch_one("SELECT * FROM agent_tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    if not row:
        return fail("任务不存在")
    execute("UPDATE agent_tasks SET feedback = ?, updated_at = ? WHERE id = ?", (req.feedback, now_iso(), task_id))
    return ok({"task_id": task_id, "feedback": req.feedback})


@router.post("/bookmark")
async def bookmark_resource(req: BookmarkReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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
async def get_recommendations(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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
    async for c in _stream_agent_llm(prompt, mode="general"):
        chunks.append(c)
    text = "".join(chunks).strip()
    try:
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            return ok(json.loads(json_match.group()))
    except (json.JSONDecodeError, TypeError):
        pass
    return ok({"items": [], "date": now_iso()[:10], "cached": False})
