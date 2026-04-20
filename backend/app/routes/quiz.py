from datetime import date
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_one
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json


router = APIRouter(prefix="/api/quiz", tags=["quiz"])


class SubmitReq(BaseModel):
    quiz_id: str
    answer: str | list[str]


_QUIZ_SET = [
    {
        "id": "q1",
        "type": "single",
        "content": "以下哪个是 Python 的可变数据类型？",
        "options": ["tuple", "list", "string", "int"],
        "correct_answer": "list",
        "explanation": "list 是可变类型。",
        "knowledge_point_id": "1.2",
        "knowledge_point_name": "数据类型",
    },
    {
        "id": "q2",
        "type": "single",
        "content": "Python 中用于定义函数的关键字是？",
        "options": ["function", "def", "func", "define"],
        "correct_answer": "def",
        "explanation": "Python 使用 def 定义函数。",
        "knowledge_point_id": "3.1",
        "knowledge_point_name": "函数定义",
    },
    {
        "id": "q3",
        "type": "multiple",
        "content": "以下哪些是 Python 内置数据类型？（多选）",
        "options": ["list", "dict", "array", "set"],
        "correct_answer": ["list", "dict", "set"],
        "explanation": "list、dict、set 均为内置类型。",
        "knowledge_point_id": "1.2",
        "knowledge_point_name": "数据类型",
    },
    {
        "id": "q4",
        "type": "fill_blank",
        "content": "在 Python 中，使用 ______ 关键字来导入模块。",
        "correct_answer": "import",
        "explanation": "import 用于导入模块。",
        "knowledge_point_id": "1.1",
        "knowledge_point_name": "变量",
    },
]


@router.get("")
async def get_quiz(chapter: str | None = None, count: int = 5):
    del chapter
    slim = [
        {
            "id": q["id"],
            "type": q["type"],
            "content": q["content"],
            "options": q.get("options"),
            "knowledge_point_id": q["knowledge_point_id"],
            "knowledge_point_name": q["knowledge_point_name"],
        }
        for q in _QUIZ_SET[:count]
    ]
    return ok(slim)


@router.post("/submit")
async def submit_quiz(req: SubmitReq):
    target = next((q for q in _QUIZ_SET if q["id"] == req.quiz_id), _QUIZ_SET[0])
    correct = _is_correct(target, req.answer)
    records = read_json(settings.single_user_id, "quiz_records.json", [])
    records.append(
        {
            "quiz_id": req.quiz_id,
            "answer": req.answer,
            "correct": correct,
            "correct_answer": target["correct_answer"],
            "knowledge_point_id": target["knowledge_point_id"],
            "at": date.today().isoformat(),
        }
    )
    write_json(settings.single_user_id, "quiz_records.json", records)
    append_jsonl(settings.single_user_id, "learning_events.jsonl", {"type": "submit_quiz", "quiz_id": req.quiz_id, "correct": correct})
    _update_mastery(target["knowledge_point_id"], 0.05 if correct else -0.03)
    mastery_row = fetch_one(
        "SELECT score FROM mastery_records WHERE user_id = ? AND knowledge_point_id = ?",
        (settings.single_user_id, target["knowledge_point_id"]),
    )
    return ok(
        {
            "quiz_id": req.quiz_id,
            "correct": correct,
            "correct_answer": target["correct_answer"],
            "explanation": target["explanation"],
            "knowledge_point_id": target["knowledge_point_id"],
            "mastery_delta": 0.05 if correct else -0.03,
            "current_mastery": mastery_row["score"] if mastery_row else 0.5,
        }
    )


@router.get("/wrong")
async def get_wrong_quiz():
    records = read_json(settings.single_user_id, "quiz_records.json", [])
    wrong = [r for r in records if not r["correct"]]
    grouped: dict[str, dict[str, Any]] = {}
    for item in wrong:
        quiz_id = item["quiz_id"]
        grouped.setdefault(
            quiz_id,
            {
                "quiz_id": quiz_id,
                "content": next(q["content"] for q in _QUIZ_SET if q["id"] == quiz_id),
                "user_answer": item["answer"],
                "correct_answer": item["correct_answer"],
                "count": 0,
                "variant_quizzes": [f"{quiz_id}_v1", f"{quiz_id}_v2"],
            },
        )
        grouped[quiz_id]["count"] += 1
    return ok(list(grouped.values()))


def _is_correct(q: dict[str, Any], answer: str | list[str]) -> bool:
    if q["type"] == "multiple":
        if not isinstance(answer, list):
            return False
        return sorted(answer) == sorted(q["correct_answer"])
    if isinstance(answer, list):
        return False
    return str(answer).strip() == str(q["correct_answer"]).strip()


def _update_mastery(kp_id: str, delta: float) -> None:
    row = fetch_one(
        "SELECT score FROM mastery_records WHERE user_id = ? AND knowledge_point_id = ?",
        (settings.single_user_id, kp_id),
    )
    if not row:
        return
    score = max(0.0, min(1.0, float(row["score"]) + delta))
    execute(
        "UPDATE mastery_records SET score = ?, last_updated = datetime('now') WHERE user_id = ? AND knowledge_point_id = ?",
        (score, settings.single_user_id, kp_id),
    )

