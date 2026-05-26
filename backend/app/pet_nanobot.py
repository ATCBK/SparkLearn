from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .config import settings


PERSONA_INSTRUCTIONS = {
    "concise": "回答简洁直接，优先给结论和3条以内要点。",
    "verbose": "回答详细清晰，适当补充解释和例子。",
    "encouraging": "回答温和积极，先给清晰帮助，再适度鼓励。",
}


class NanobotPetError(RuntimeError):
    pass


class NanobotPetClient:
    def __init__(self) -> None:
        self._base_url = settings.nanobot_api_base_url.rstrip("/")
        self._chat_url = f"{self._base_url}{settings.nanobot_api_chat_path}"
        self._timeout = settings.nanobot_api_timeout_sec
        self._model = settings.nanobot_api_model
        self._session_prefix = settings.nanobot_pet_session_prefix

    async def run_task(
        self,
        *,
        task_type: str,
        input_text: str,
        user_id: str,
        personality: str,
    ) -> dict[str, Any]:
        prompt = self._build_prompt(task_type=task_type, input_text=input_text, personality=personality)
        session_id = f"{self._session_prefix}-{user_id}-{task_type}"
        payload = {
            "model": self._model,
            "session_id": session_id,
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(self._chat_url, json=payload)
                response.raise_for_status()
        except Exception as ex:
            raise NanobotPetError(f"nanobot request failed: {ex}") from ex

        try:
            data = response.json()
            content = str(data["choices"][0]["message"]["content"]).strip()
        except Exception as ex:
            raise NanobotPetError(f"invalid nanobot response: {ex}") from ex

        return self._parse_task_result(task_type=task_type, content=content)

    def _build_prompt(self, *, task_type: str, input_text: str, personality: str) -> str:
        persona = PERSONA_INSTRUCTIONS.get(personality, PERSONA_INSTRUCTIONS["encouraging"])
        base = [
            "你是 SparkLearn 学习宠物的任务执行内核。",
            persona,
            "你必须只返回 JSON，不要返回 Markdown，不要返回解释性前缀。",
        ]
        if task_type == "search":
            base.extend([
                "任务：根据学习需求推荐 3-5 个学习资源。",
                '返回格式：{"items":[{"title":"", "summary":"", "url":"", "source":""}]}',
            ])
        elif task_type == "summarize":
            base.extend([
                "任务：总结用户输入或网页内容。",
                '返回格式：{"topic":"", "key_points":["", ""], "conclusion":""}',
            ])
        elif task_type == "compare":
            base.extend([
                "任务：从 3 个不同视角对比解释同一概念。",
                '返回格式：{"items":[{"source":"", "explanation":"", "url":""}], "comparison":""}',
            ])
        elif task_type == "recommend":
            base.extend([
                "任务：给出 3 条个性化学习建议或资源推荐。",
                '返回格式：{"items":[{"title":"", "summary":"", "url":"", "reason":""}]}',
            ])
        else:
            raise NanobotPetError(f"unsupported task type: {task_type}")

        base.append(f"用户输入：{input_text}")
        return "\n".join(base)

    def _parse_task_result(self, *, task_type: str, content: str) -> dict[str, Any]:
        parsed = self._extract_json_object(content)
        if parsed is not None:
            return parsed

        if task_type == "summarize":
            return {
                "topic": "学习内容总结",
                "key_points": [content[:200]] if content else [],
                "conclusion": content[:200] if content else "已完成总结。",
            }
        if task_type in {"search", "recommend"}:
            key = "reason" if task_type == "recommend" else "source"
            extra = "根据学习目标生成" if task_type == "recommend" else "nanobot"
            return {"items": [{"title": "学习建议", "summary": content[:200], "url": "", key: extra}]}
        if task_type == "compare":
            return {
                "items": [{"source": "nanobot", "explanation": content[:200], "url": ""}],
                "comparison": "",
            }
        return {}

    @staticmethod
    def _extract_json_object(content: str) -> dict[str, Any] | None:
        match = re.search(r"\{[\s\S]*\}", content)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None


nanobot_pet_client = NanobotPetClient()
