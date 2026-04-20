from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_one
from ..llm import spark_lite
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json

router = APIRouter(prefix='/api/quiz', tags=['quiz'])


class SubmitReq(BaseModel):
    quiz_id: str
    answer: str | list[str]


_DEFAULT_QUIZ_SET = [
    {
        'id': 'q1',
        'type': 'single',
        'content': '以下哪个是 Python 的可变数据类型？',
        'options': ['tuple', 'list', 'string', 'int'],
        'correct_answer': 'list',
        'explanation': 'list 是可变类型。',
        'knowledge_point_id': '1.2',
        'knowledge_point_name': '数据类型',
    },
    {
        'id': 'q2',
        'type': 'single',
        'content': 'Python 中用于定义函数的关键字是？',
        'options': ['function', 'def', 'func', 'define'],
        'correct_answer': 'def',
        'explanation': 'Python 使用 def 定义函数。',
        'knowledge_point_id': '3.1',
        'knowledge_point_name': '函数定义',
    },
    {
        'id': 'q3',
        'type': 'multiple',
        'content': '以下哪些是 Python 内置数据类型？（多选）',
        'options': ['list', 'dict', 'array', 'set'],
        'correct_answer': ['list', 'dict', 'set'],
        'explanation': 'list、dict、set 均为 Python 内置类型。',
        'knowledge_point_id': '1.2',
        'knowledge_point_name': '数据类型',
    },
    {
        'id': 'q4',
        'type': 'fill_blank',
        'content': '在 Python 中，使用 ______ 关键字来导入模块。',
        'correct_answer': 'import',
        'explanation': 'import 用于导入模块。',
        'knowledge_point_id': '1.1',
        'knowledge_point_name': '基础语法',
    },
]


@router.get('')
async def get_quiz(chapter: str | None = None, count: int = 5):
    requested_count = max(1, min(count, 10))
    generated = await _generate_quiz_with_llm(chapter, requested_count)
    quiz_set = generated if generated else _DEFAULT_QUIZ_SET[:requested_count]

    if generated:
        write_json(settings.single_user_id, 'latest_quiz_set.json', quiz_set)
        append_jsonl(
            settings.single_user_id,
            'learning_events.jsonl',
            {'type': 'quiz_generated', 'count': len(quiz_set), 'chapter': chapter or ''},
        )

    slim = [
        {
            'id': q['id'],
            'type': q['type'],
            'content': q['content'],
            'options': q.get('options'),
            'explanation': q.get('explanation', ''),
            'knowledge_point_id': q.get('knowledge_point_id', ''),
            'knowledge_point_name': q.get('knowledge_point_name', ''),
        }
        for q in quiz_set[:requested_count]
    ]
    return ok(slim)


@router.post('/submit')
async def submit_quiz(req: SubmitReq):
    quiz_set = _latest_quiz_set()
    target = next((q for q in quiz_set if q['id'] == req.quiz_id), None) or quiz_set[0]

    rule_correct = _is_correct_rule(target, req.answer)
    llm_judge = await _judge_with_llm(target, req.answer)

    correct = rule_correct
    judge_mode = 'rule'

    # Objective questions remain rule-first for stable and testable behavior.
    # For fill_blank, allow model-based recovery if rule misses synonyms.
    if target['type'] == 'fill_blank' and not rule_correct and llm_judge is not None:
        if bool(llm_judge.get('correct', False)) and float(llm_judge.get('confidence', 0.0)) >= 0.8:
            correct = True
            judge_mode = 'llm_assist'

    explanation = str(target.get('explanation', '')).strip()
    if llm_judge and llm_judge.get('reason'):
        explanation = f"{explanation} {str(llm_judge.get('reason')).strip()}".strip()

    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    records.append(
        {
            'quiz_id': req.quiz_id,
            'answer': req.answer,
            'correct': correct,
            'correct_answer': target['correct_answer'],
            'knowledge_point_id': target['knowledge_point_id'],
            'judge_mode': judge_mode,
            'at': date.today().isoformat(),
        }
    )
    write_json(settings.single_user_id, 'quiz_records.json', records)

    append_jsonl(
        settings.single_user_id,
        'learning_events.jsonl',
        {
            'type': 'submit_quiz',
            'quiz_id': req.quiz_id,
            'correct': correct,
            'judge_mode': judge_mode,
        },
    )

    _update_mastery(target['knowledge_point_id'], 0.05 if correct else -0.03)
    mastery_row = fetch_one(
        'SELECT score FROM mastery_records WHERE user_id = ? AND knowledge_point_id = ?',
        (settings.single_user_id, target['knowledge_point_id']),
    )

    return ok(
        {
            'quiz_id': req.quiz_id,
            'correct': correct,
            'correct_answer': target['correct_answer'],
            'explanation': explanation,
            'knowledge_point_id': target['knowledge_point_id'],
            'mastery_delta': 0.05 if correct else -0.03,
            'current_mastery': mastery_row['score'] if mastery_row else 0.5,
            'judge_mode': judge_mode,
        }
    )


@router.get('/wrong')
async def get_wrong_quiz():
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    wrong = [r for r in records if not r.get('correct', False)]

    quiz_set = _latest_quiz_set()
    by_id = {q['id']: q for q in quiz_set}

    grouped: dict[str, dict[str, Any]] = {}
    for item in wrong:
        quiz_id = str(item['quiz_id'])
        q = by_id.get(quiz_id)
        grouped.setdefault(
            quiz_id,
            {
                'quiz_id': quiz_id,
                'content': q['content'] if q else '题目已失效',
                'user_answer': item.get('answer'),
                'correct_answer': item.get('correct_answer'),
                'count': 0,
                'variant_quizzes': [f'{quiz_id}_v1', f'{quiz_id}_v2'],
            },
        )
        grouped[quiz_id]['count'] += 1

    return ok(list(grouped.values()))


async def _generate_quiz_with_llm(chapter: str | None, count: int) -> list[dict[str, Any]] | None:
    chapter_text = chapter or 'Python 基础'
    prompt = (
        '请生成一组练习题，输出严格 JSON 数组，不要任何额外文本。\n'
        f'要求：共 {count} 题，类型包含 single/multiple/fill_blank，字段必须有 '\
        'type,content,options(填空可省略),correct_answer,explanation,knowledge_point_id,knowledge_point_name。\n'
        f'主题：{chapter_text}'
    )
    text = await _collect_llm_text(prompt)
    if not text:
        return None

    raw_list = _extract_json_list(text)
    if not raw_list:
        return None

    result: list[dict[str, Any]] = []
    for i, raw in enumerate(raw_list[:count], start=1):
        normalized = _normalize_question(raw, i)
        if normalized:
            result.append(normalized)

    return result or None


async def _judge_with_llm(question: dict[str, Any], answer: str | list[str]) -> dict[str, Any] | None:
    prompt = (
        '你是判题助手。请只输出 JSON 对象，不要任何额外文本。\n'
        '字段: correct(bool), confidence(0~1), reason(string)。\n'
        f"题型: {question.get('type')}\n"
        f"题目: {question.get('content')}\n"
        f"标准答案: {json.dumps(question.get('correct_answer'), ensure_ascii=False)}\n"
        f"用户答案: {json.dumps(answer, ensure_ascii=False)}"
    )
    text = await _collect_llm_text(prompt)
    if not text:
        return None

    obj = _extract_json_object(text)
    if not isinstance(obj, dict):
        return None

    return {
        'correct': bool(obj.get('correct', False)),
        'confidence': float(obj.get('confidence', 0.0)),
        'reason': str(obj.get('reason', '')).strip(),
    }


async def _collect_llm_text(prompt: str) -> str:
    parts: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode='general', history=[]):
        if evt_type == 'text':
            chunk = str(payload.get('content', ''))
            if chunk:
                parts.append(chunk)
    return ''.join(parts).strip()


def _extract_json_list(text: str) -> list[dict[str, Any]] | None:
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
    except json.JSONDecodeError:
        pass

    m = re.search(r'\[[\s\S]*\]', text)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list):
        return None
    return [x for x in data if isinstance(x, dict)]


def _extract_json_object(text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass

    m = re.search(r'\{[\s\S]*\}', text)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize_question(raw: dict[str, Any], idx: int) -> dict[str, Any] | None:
    q_type = str(raw.get('type', 'single')).strip()
    if q_type not in {'single', 'multiple', 'fill_blank'}:
        q_type = 'single'

    content = str(raw.get('content', '')).strip()
    if not content:
        return None

    options: list[str] | None = None
    if q_type in {'single', 'multiple'}:
        raw_options = raw.get('options')
        if not isinstance(raw_options, list):
            return None
        options = [str(x).strip() for x in raw_options if str(x).strip()]
        if len(options) < 2:
            return None

    correct_answer = raw.get('correct_answer')
    if q_type == 'single':
        correct_answer = str(correct_answer or '').strip()
        if not correct_answer:
            return None
    elif q_type == 'multiple':
        if not isinstance(correct_answer, list):
            return None
        correct_answer = [str(x).strip() for x in correct_answer if str(x).strip()]
        if not correct_answer:
            return None
    else:
        correct_answer = str(correct_answer or '').strip()
        if not correct_answer:
            return None

    return {
        'id': f'gq{idx}',
        'type': q_type,
        'content': content,
        'options': options,
        'correct_answer': correct_answer,
        'explanation': str(raw.get('explanation', '')).strip() or '建议回顾相关知识点并对比标准答案。',
        'knowledge_point_id': str(raw.get('knowledge_point_id', 'general')).strip() or 'general',
        'knowledge_point_name': str(raw.get('knowledge_point_name', '通用能力')).strip() or '通用能力',
    }


def _latest_quiz_set() -> list[dict[str, Any]]:
    latest = read_json(settings.single_user_id, 'latest_quiz_set.json', [])
    if isinstance(latest, list) and latest:
        valid = [q for q in latest if isinstance(q, dict) and q.get('id')]
        if valid:
            return valid
    return _DEFAULT_QUIZ_SET


def _is_correct_rule(q: dict[str, Any], answer: str | list[str]) -> bool:
    q_type = q.get('type')
    if q_type == 'multiple':
        if not isinstance(answer, list):
            return False
        expected = sorted([str(x).strip().lower() for x in q.get('correct_answer', [])])
        actual = sorted([str(x).strip().lower() for x in answer])
        return expected == actual

    if isinstance(answer, list):
        return False

    expected_str = str(q.get('correct_answer', '')).strip().lower()
    actual_str = str(answer).strip().lower()

    if q_type == 'fill_blank':
        # basic normalization for fill blank objective checks
        normalize = lambda s: re.sub(r'\s+', '', s)
        return normalize(expected_str) == normalize(actual_str)

    return expected_str == actual_str


def _update_mastery(kp_id: str, delta: float) -> None:
    row = fetch_one(
        'SELECT score FROM mastery_records WHERE user_id = ? AND knowledge_point_id = ?',
        (settings.single_user_id, kp_id),
    )
    if not row:
        return

    score = max(0.0, min(1.0, float(row['score']) + delta))
    execute(
        "UPDATE mastery_records SET score = ?, last_updated = datetime('now') WHERE user_id = ? AND knowledge_point_id = ?",
        (score, settings.single_user_id, kp_id),
    )
