import json
from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json


router = APIRouter(prefix="/api", tags=["learning"])


class PathAdjustReq(BaseModel):
    reason: str


class TaskCompleteReq(BaseModel):
    status: str = "completed"


@router.get("/learning-path")
async def get_learning_path():
    profile = fetch_one("SELECT current_stage FROM profiles WHERE user_id = ?", (settings.single_user_id,))
    current_stage = profile["current_stage"] if profile else "函数与模块"
    data = {
        "current_stage": current_stage,
        "stages": [
            {"name": "基础语法", "status": "completed"},
            {"name": "函数与模块", "status": "current"},
            {"name": "面向对象", "status": "pending"},
            {"name": "文件处理", "status": "pending"},
            {"name": "高级特性", "status": "pending"},
        ],
        "knowledge_tree": [
            {
                "id": "ch1",
                "name": "基础语法",
                "status": "completed",
                "children": [{"id": "1.1", "name": "变量", "status": "completed"}],
            },
            {
                "id": "ch2",
                "name": "函数",
                "status": "current",
                "children": [{"id": "2.1", "name": "参数传递", "status": "current"}],
            },
        ],
    }
    return ok(data)


@router.post("/learning-path/adjust")
async def adjust_learning_path(req: PathAdjustReq):
    execute(
        "UPDATE profiles SET current_stage = ?, updated_at = ? WHERE user_id = ?",
        ("函数与模块", now_iso(), settings.single_user_id),
    )
    append_jsonl(settings.single_user_id, "learning_events.jsonl", {"type": "path_adjusted", "reason": req.reason})
    return ok({"previous_stage": "面向对象", "current_stage": "函数与模块"})


@router.get("/tasks/today")
async def get_today_tasks():
    tasks = read_json(
        settings.single_user_id,
        "task_progress.json",
        [
            {"id": "1", "title": "Python 变量与数据类型", "type": "video", "status": "pending", "duration": 25},
            {"id": "2", "title": "函数定义与调用练习", "type": "quiz", "status": "in_progress", "duration": 15},
            {"id": "3", "title": "条件语句与循环讲义", "type": "reading", "status": "pending", "duration": 20},
            {"id": "4", "title": "列表推导式代码实践", "type": "practice", "status": "completed", "duration": 30},
        ],
    )
    return ok(tasks)


@router.put("/tasks/{task_id}/complete")
async def complete_task(task_id: str, req: TaskCompleteReq):
    tasks = read_json(settings.single_user_id, "task_progress.json", [])
    for task in tasks:
        if task["id"] == task_id:
            task["status"] = req.status
    write_json(settings.single_user_id, "task_progress.json", tasks)
    append_jsonl(settings.single_user_id, "learning_events.jsonl", {"type": "task_completed", "task_id": task_id})

    today = date.today().isoformat()
    row = fetch_one(
        "SELECT count FROM contribution_days WHERE user_id = ? AND date = ?",
        (settings.single_user_id, today),
    )
    if row:
        execute(
            "UPDATE contribution_days SET count = ? WHERE user_id = ? AND date = ?",
            (int(row["count"]) + 1, settings.single_user_id, today),
        )
    else:
        execute(
            "INSERT INTO contribution_days(user_id, date, count) VALUES (?, ?, ?)",
            (settings.single_user_id, today, 1),
        )
    return ok({"task_id": task_id, "status": req.status})


@router.get("/contribution")
async def get_contribution(year: int | None = None):
    if not year:
        year = date.today().year
    rows = fetch_all(
        """
        SELECT date, count FROM contribution_days
        WHERE user_id = ? AND substr(date, 1, 4) = ?
        ORDER BY date
        """,
        (settings.single_user_id, str(year)),
    )
    return ok([{"date": row["date"], "count": row["count"]} for row in rows])


@router.get("/mastery")
async def get_mastery():
    rows = fetch_all(
        """
        SELECT knowledge_point_id, knowledge_point_name, score, chapter
        FROM mastery_records WHERE user_id = ?
        ORDER BY score DESC
        """,
        (settings.single_user_id,),
    )
    return ok(
        [
            {
                "knowledge_point_id": r["knowledge_point_id"],
                "knowledge_point_name": r["knowledge_point_name"],
                "score": r["score"],
                "chapter": r["chapter"],
            }
            for r in rows
        ]
    )


@router.get("/dashboard/stats")
async def get_dashboard_stats():
    report = await get_evaluation_report()  # type: ignore[name-defined]
    stats = report.data["stats"]
    return ok(stats)


@router.get("/daily-quote")
async def get_daily_quote():
    return ok({"quote": "学而不思则罔，思而不学则殆。"})


@router.get("/videos")
async def get_videos():
    return ok(
        [
            {"id": "v1", "title": "Python 变量与数据类型", "url": "/demo-video.mp4", "duration": 750, "created_at": "2026-04-15"},
            {"id": "v2", "title": "函数定义与调用详解", "url": "/demo-video.mp4", "duration": 920, "created_at": "2026-04-14"},
        ]
    )


# lazy import to avoid circular reference
from .tutor_eval import get_evaluation_report  # noqa: E402

