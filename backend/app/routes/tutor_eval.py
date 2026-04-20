from collections.abc import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..llm import spark_lite
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json
from .common import sse_wrap


router = APIRouter(prefix="/api", tags=["tutor-evaluation"])


class TutorReq(BaseModel):
    message: str
    mode: str = "knowledge_qa"


class EvalRefreshReq(BaseModel):
    force: bool = False


@router.post("/tutor/chat")
async def tutor_chat(req: TutorReq):
    async def gen() -> AsyncGenerator[tuple[str, dict], None]:
        messages = read_json(settings.single_user_id, "tutor_history.json", [])
        user_msg = {"id": f"u-{len(messages)+1}", "role": "user", "content": req.message, "timestamp": _now_iso()}
        messages.append(user_msg)
        yield ("meta", {"mode": req.mode})
        assistant_parts: list[str] = []
        history_for_model = [{"role": m["role"], "content": m["content"]} for m in messages[-8:]]
        async for evt_type, payload in spark_lite.stream_chat_events(req.message, mode=req.mode, history=history_for_model):
            if evt_type == "text":
                chunk = str(payload.get("content", ""))
                if chunk:
                    assistant_parts.append(chunk)
                    yield ("text", {"content": chunk})
            elif evt_type == "error":
                yield ("error", payload)
        answer = "".join(assistant_parts)
        assistant_msg = {"id": f"a-{len(messages)+1}", "role": "assistant", "content": answer, "timestamp": _now_iso()}
        messages.append(assistant_msg)
        write_json(settings.single_user_id, "tutor_history.json", messages)
        append_jsonl(settings.single_user_id, "learning_events.jsonl", {"type": "tutor_chat", "question": req.message})
        yield ("done", {"message": assistant_msg})

    return StreamingResponse(sse_wrap(gen()), media_type="text/event-stream")


@router.get("/tutor/history")
async def tutor_history(limit: int = 20):
    messages = read_json(settings.single_user_id, "tutor_history.json", [])
    return ok(messages[-limit:])


@router.get("/evaluation/report")
async def get_evaluation_report():
    data = read_json(
        settings.single_user_id,
        "evaluation_snapshot.json",
        {
            "period": "本周",
            "stats": {"total_hours": 12.5, "task_completion_rate": 0.78, "quiz_accuracy": 0.85, "streak_days": 12},
            "daily_hours": [{"date": "04-10", "hours": 2.0}, {"date": "04-11", "hours": 1.5}, {"date": "04-12", "hours": 2.5}],
            "time_distribution": [
                {"category": "视频学习", "minutes": 120},
                {"category": "练习题", "minutes": 90},
                {"category": "阅读讲义", "minutes": 60},
                {"category": "代码实践", "minutes": 80},
            ],
            "weak_points": [{"name": "闭包", "score": 0.45}, {"name": "装饰器", "score": 0.38}, {"name": "类与继承", "score": 0.3}],
            "ai_summary": "本周你在基础语法上进步明显，建议继续强化函数与面向对象训练。",
        },
    )
    return ok(data)


@router.post("/evaluation/refresh")
async def refresh_evaluation(req: EvalRefreshReq):
    summary = await spark_lite.summarize("函数与面向对象")
    report_resp = await get_evaluation_report()
    report = report_resp.data
    report["ai_summary"] = summary
    write_json(settings.single_user_id, "evaluation_snapshot.json", report)
    append_jsonl(settings.single_user_id, "learning_events.jsonl", {"type": "evaluation_refresh", "force": req.force})
    return ok({"message": "评估完成"})


def _now_iso() -> str:
    from datetime import datetime

    return datetime.utcnow().isoformat() + "Z"
