"""
Shared report service module.

Extracted from tutor_eval.py to avoid circular imports between
learning.py and tutor_eval.py.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from ..db import fetch_all
from ..schemas import ok
from ..storage import read_json


async def get_evaluation_report(period: str = "week", user_id: str | None = None):
    """Generate evaluation report data for the current authenticated user."""
    user_id = user_id or ""
    label = {"day": "今日", "week": "本周", "month": "本月"}.get(period, "本周")
    days = {"day": 1, "week": 7, "month": 30}.get(period, 7)
    start = date.today() - timedelta(days=days - 1)

    tasks = _safe_list(read_json(user_id, "task_progress.json", []))
    quiz_records = _safe_list(read_json(user_id, "quiz_records.json", []))
    contribution_rows = fetch_all(
        """
        SELECT date, count
        FROM contribution_days
        WHERE user_id = ? AND date >= ?
        ORDER BY date
        """,
        (user_id, start.isoformat()),
    )
    mastery_rows = fetch_all(
        """
        SELECT knowledge_point_name, score
        FROM mastery_records
        WHERE user_id = ?
        ORDER BY score ASC
        LIMIT 3
        """,
        (user_id,),
    )

    completed = sum(1 for item in tasks if str(item.get("status")) == "completed")
    task_completion_rate = completed / len(tasks) if tasks else 0
    correct = sum(1 for item in quiz_records if bool(item.get("correct")))
    quiz_accuracy = correct / len(quiz_records) if quiz_records else 0
    daily_hours = _daily_hours(contribution_rows)
    total_hours = round(sum(item["hours"] for item in daily_hours), 2)
    streak_days = _streak_days(contribution_rows)
    weak_points = [
        {"name": str(row["knowledge_point_name"]), "score": float(row["score"])}
        for row in mastery_rows
    ]

    if not tasks and not quiz_records and not contribution_rows:
        summary = f"{label}还没有学习记录。完成任务、生成资源或提交练习后，系统会在这里形成你的个人报告。"
        actions = ["完成一次画像采集", "创建第一个学习任务", "提交一组练习题"]
    else:
        summary = f"{label}完成 {completed} 个任务，练习正确率 {round(quiz_accuracy * 100)}%，累计约 {total_hours} 小时。"
        actions = _recommended_actions(tasks, weak_points)

    return ok(
        {
            "period": label,
            "stats": {
                "total_hours": total_hours,
                "task_completion_rate": round(task_completion_rate, 4),
                "quiz_accuracy": round(quiz_accuracy, 4),
                "streak_days": streak_days,
            },
            "daily_hours": daily_hours,
            "time_distribution": _time_distribution(tasks, quiz_records),
            "weak_points": weak_points,
            "ai_summary": summary,
            "recommended_actions": actions,
            "profile_update_suggestions": _profile_update_suggestions(weak_points),
            "path_adjustment_suggestions": _path_adjustment_suggestions(weak_points),
        }
    )


def _safe_list(value: Any) -> list[dict[str, Any]]:
    return value if isinstance(value, list) else []


def _daily_hours(rows: list[Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for row in rows:
        count = int(row["count"] or 0)
        result.append({"date": str(row["date"]), "hours": round(count * 0.35, 2)})
    return result


def _streak_days(rows: list[Any]) -> int:
    dates = {str(row["date"]) for row in rows if int(row["count"] or 0) > 0}
    streak = 0
    cursor = date.today()
    while cursor.isoformat() in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _time_distribution(tasks: list[dict[str, Any]], quiz_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    minutes_by_type = {"视频学习": 0, "练习题": len(quiz_records) * 4, "阅读讲义": 0, "代码实践": 0}
    for task in tasks:
        duration = int(task.get("duration") or 0)
        task_type = str(task.get("type") or "")
        if task_type == "video":
            minutes_by_type["视频学习"] += duration
        elif task_type in {"quiz", "practice"}:
            minutes_by_type["练习题"] += duration
        elif task_type == "reading":
            minutes_by_type["阅读讲义"] += duration
        else:
            minutes_by_type["代码实践"] += duration
    return [{"category": key, "minutes": value} for key, value in minutes_by_type.items()]


def _recommended_actions(tasks: list[dict[str, Any]], weak_points: list[dict[str, Any]]) -> list[str]:
    pending = [str(item.get("title")) for item in tasks if str(item.get("status")) != "completed" and item.get("title")]
    actions = pending[:2]
    if weak_points:
        actions.append(f"针对「{weak_points[0]['name']}」完成一次补弱练习")
    if not actions:
        actions.append("创建下一组学习任务")
    return actions[:3]


def _profile_update_suggestions(weak_points: list[dict[str, Any]]) -> list[str]:
    if not weak_points:
        return []
    return [f"将「{item['name']}」纳入近期薄弱点" for item in weak_points[:2]]


def _path_adjustment_suggestions(weak_points: list[dict[str, Any]]) -> list[str]:
    if not weak_points:
        return []
    return [f"优先安排「{weak_points[0]['name']}」相关节点"]
