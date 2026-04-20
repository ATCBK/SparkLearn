import json
import uuid
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..llm import spark_lite
from ..schemas import fail, ok
from ..storage import append_jsonl
from .common import sse_wrap

router = APIRouter(prefix='/api', tags=['tutor-evaluation'])


class TutorReq(BaseModel):
    message: str
    mode: str = 'knowledge_qa'
    conversation_id: int | None = None
    role_id: int | None = None
    file_ids: list[int] = []


class EvalRefreshReq(BaseModel):
    force: bool = False


class CreateRoleReq(BaseModel):
    name: str
    persona: str = ''
    background: str = ''
    style_guide: str = ''
    rules: str = ''


class UpdateRoleReq(BaseModel):
    name: str | None = None
    persona: str | None = None
    background: str | None = None
    style_guide: str | None = None
    rules: str | None = None
    enabled: bool | None = None


class CreateConversationReq(BaseModel):
    title: str = '新对话'
    role_id: int | None = None


class UpdateConversationReq(BaseModel):
    title: str | None = None
    role_id: int | None = None


@router.get('/tutor/roles')
async def list_roles():
    rows = fetch_all(
        """
        SELECT id, name, persona, background, style_guide, rules, enabled, created_at, updated_at
        FROM tutor_roles
        WHERE user_id = ?
        ORDER BY updated_at DESC
        """,
        (settings.single_user_id,),
    )
    return ok([_role_row_to_dict(r) for r in rows])


@router.post('/tutor/roles')
async def create_role(req: CreateRoleReq):
    ts = now_iso()
    role_id = _execute_returning_id(
        """
        INSERT INTO tutor_roles(user_id, name, persona, background, style_guide, rules, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            settings.single_user_id,
            req.name.strip() or '新角色',
            req.persona,
            req.background,
            req.style_guide,
            req.rules,
            ts,
            ts,
        ),
    )
    row = fetch_one(
        "SELECT id, name, persona, background, style_guide, rules, enabled, created_at, updated_at FROM tutor_roles WHERE id = ?",
        (role_id,),
    )
    return ok(_role_row_to_dict(row))


@router.put('/tutor/roles/{role_id}')
async def update_role(role_id: int, req: UpdateRoleReq):
    row = fetch_one('SELECT * FROM tutor_roles WHERE id = ? AND user_id = ?', (role_id, settings.single_user_id))
    if not row:
        return fail('role not found')

    data = dict(row)
    data.update(req.model_dump(exclude_none=True))
    execute(
        """
        UPDATE tutor_roles
        SET name = ?, persona = ?, background = ?, style_guide = ?, rules = ?, enabled = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            data.get('name') or '新角色',
            data.get('persona') or '',
            data.get('background') or '',
            data.get('style_guide') or '',
            data.get('rules') or '',
            1 if bool(data.get('enabled', 1)) else 0,
            now_iso(),
            role_id,
            settings.single_user_id,
        ),
    )

    updated = fetch_one(
        'SELECT id, name, persona, background, style_guide, rules, enabled, created_at, updated_at FROM tutor_roles WHERE id = ?',
        (role_id,),
    )
    return ok(_role_row_to_dict(updated))


@router.delete('/tutor/roles/{role_id}')
async def delete_role(role_id: int):
    another = fetch_one(
        """
        SELECT id FROM tutor_roles
        WHERE user_id = ? AND id <> ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (settings.single_user_id, role_id),
    )

    if another:
        fallback_role_id = int(another['id'])
    else:
        ts = now_iso()
        fallback_role_id = _execute_returning_id(
            """
            INSERT INTO tutor_roles(user_id, name, persona, background, style_guide, rules, enabled, created_at, updated_at)
            VALUES (?, '通用学习导师', '', '', '', '', 1, ?, ?)
            """,
            (settings.single_user_id, ts, ts),
        )

    execute(
        """
        UPDATE tutor_conversations
        SET role_id = ?, updated_at = ?
        WHERE user_id = ? AND role_id = ?
        """,
        (fallback_role_id, now_iso(), settings.single_user_id, role_id),
    )
    execute('DELETE FROM tutor_roles WHERE id = ? AND user_id = ?', (role_id, settings.single_user_id))
    return ok({'deleted': True})


@router.get('/tutor/conversations')
async def list_conversations():
    rows = fetch_all(
        """
        SELECT c.id, c.role_id, c.title, c.created_at, c.updated_at,
               COALESCE(m.msg_count, 0) AS message_count
        FROM tutor_conversations c
        LEFT JOIN (
          SELECT conversation_id, COUNT(1) AS msg_count
          FROM tutor_messages
          WHERE user_id = ?
          GROUP BY conversation_id
        ) m ON c.id = m.conversation_id
        WHERE c.user_id = ?
        ORDER BY c.updated_at DESC
        """,
        (settings.single_user_id, settings.single_user_id),
    )
    return ok([dict(r) for r in rows])


@router.post('/tutor/conversations')
async def create_conversation(req: CreateConversationReq):
    role_id = req.role_id or _default_role_id()
    ts = now_iso()
    conv_id = _execute_returning_id(
        """
        INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (settings.single_user_id, role_id, (req.title or '新对话')[:80], ts, ts),
    )
    row = fetch_one(
        'SELECT id, role_id, title, created_at, updated_at, 0 AS message_count FROM tutor_conversations WHERE id = ?',
        (conv_id,),
    )
    return ok(dict(row))


@router.put('/tutor/conversations/{conversation_id}')
async def update_conversation(conversation_id: int, req: UpdateConversationReq):
    row = fetch_one(
        'SELECT * FROM tutor_conversations WHERE id = ? AND user_id = ?',
        (conversation_id, settings.single_user_id),
    )
    if not row:
        return fail('conversation not found')

    data = dict(row)
    data.update(req.model_dump(exclude_none=True))
    execute(
        """
        UPDATE tutor_conversations
        SET role_id = ?, title = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            int(data.get('role_id') or _default_role_id()),
            str(data.get('title') or '新对话')[:80],
            now_iso(),
            conversation_id,
            settings.single_user_id,
        ),
    )

    updated = fetch_one(
        """
        SELECT c.id, c.role_id, c.title, c.created_at, c.updated_at,
               COALESCE(m.msg_count, 0) AS message_count
        FROM tutor_conversations c
        LEFT JOIN (
          SELECT conversation_id, COUNT(1) AS msg_count
          FROM tutor_messages
          WHERE user_id = ?
          GROUP BY conversation_id
        ) m ON c.id = m.conversation_id
        WHERE c.id = ?
        """,
        (settings.single_user_id, conversation_id),
    )
    return ok(dict(updated))


@router.delete('/tutor/conversations/{conversation_id}')
async def delete_conversation(conversation_id: int):
    execute('DELETE FROM tutor_messages WHERE conversation_id = ? AND user_id = ?', (conversation_id, settings.single_user_id))
    execute('DELETE FROM tutor_conversations WHERE id = ? AND user_id = ?', (conversation_id, settings.single_user_id))
    return ok({'deleted': True})


@router.get('/tutor/messages')
async def tutor_messages(conversation_id: int, limit: int = 100):
    rows = fetch_all(
        """
        SELECT id, conversation_id, sender_role, content, file_ids, created_at
        FROM tutor_messages
        WHERE user_id = ? AND conversation_id = ?
        ORDER BY id ASC
        LIMIT ?
        """,
        (settings.single_user_id, conversation_id, max(1, min(limit, 500))),
    )
    return ok([_message_row_to_dict(r) for r in rows])


@router.delete('/tutor/messages/{message_id}')
async def delete_tutor_message(message_id: int):
    row = fetch_one(
        'SELECT id, conversation_id FROM tutor_messages WHERE id = ? AND user_id = ?',
        (message_id, settings.single_user_id),
    )
    if not row:
        return fail('message not found')

    conversation_id = int(row['conversation_id'])
    execute('DELETE FROM tutor_messages WHERE id = ? AND user_id = ?', (message_id, settings.single_user_id))
    execute(
        'UPDATE tutor_conversations SET updated_at = ? WHERE id = ? AND user_id = ?',
        (now_iso(), conversation_id, settings.single_user_id),
    )
    return ok({'deleted': True, 'conversation_id': conversation_id})


@router.post('/tutor/files')
async def upload_tutor_file(files: list[UploadFile] = File(...)):
    saved: list[dict[str, Any]] = []
    uploads_dir = settings.data_dir / 'users' / settings.single_user_id / 'uploads'
    uploads_dir.mkdir(parents=True, exist_ok=True)

    for f in files:
        raw = await f.read()
        if len(raw) == 0:
            continue

        file_id = _execute_returning_id(
            """
            INSERT INTO tutor_files(user_id, filename, stored_path, mime_type, size_bytes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                settings.single_user_id,
                f.filename or 'file.bin',
                '',
                f.content_type or 'application/octet-stream',
                len(raw),
                now_iso(),
            ),
        )

        ext = Path(f.filename or '').suffix
        stored_name = f'{file_id}_{uuid.uuid4().hex[:8]}{ext}'
        stored_path = uploads_dir / stored_name
        stored_path.write_bytes(raw)

        execute('UPDATE tutor_files SET stored_path = ? WHERE id = ?', (str(stored_path), file_id))
        saved.append(
            {
                'id': file_id,
                'filename': f.filename or stored_name,
                'mime_type': f.content_type or 'application/octet-stream',
                'size_bytes': len(raw),
            }
        )

    return ok(saved)


@router.post('/tutor/chat')
async def tutor_chat(req: TutorReq):
    conversation_id = req.conversation_id or _ensure_default_conversation()
    role_id = req.role_id or _role_id_for_conversation(conversation_id) or _default_role_id()
    role = fetch_one(
        'SELECT id, name, persona, background, style_guide, rules FROM tutor_roles WHERE id = ? AND user_id = ?',
        (role_id, settings.single_user_id),
    )
    role_prompt = _build_role_prompt(dict(role) if role else None)

    async def gen() -> AsyncGenerator[tuple[str, dict], None]:
        before_count_row = fetch_one(
            """
            SELECT COUNT(1) AS cnt
            FROM tutor_messages
            WHERE user_id = ? AND conversation_id = ? AND sender_role = 'user'
            """,
            (settings.single_user_id, conversation_id),
        )
        before_user_count = int(before_count_row['cnt']) if before_count_row else 0

        user_msg_id = _execute_returning_id(
            """
            INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, created_at)
            VALUES (?, ?, 'user', ?, ?, ?)
            """,
            (
                conversation_id,
                settings.single_user_id,
                req.message,
                json.dumps(req.file_ids or [], ensure_ascii=False),
                now_iso(),
            ),
        )

        execute(
            'UPDATE tutor_conversations SET updated_at = ? WHERE id = ? AND user_id = ?',
            (now_iso(), conversation_id, settings.single_user_id),
        )

        if before_user_count == 0:
            title = await _generate_conversation_title(req.message)
            execute(
                "UPDATE tutor_conversations SET title = ? WHERE id = ? AND user_id = ? AND title = '新对话'",
                (title, conversation_id, settings.single_user_id),
            )

        yield ('meta', {'mode': req.mode, 'conversation_id': conversation_id, 'role_id': role_id, 'user_message_id': user_msg_id})

        rows = fetch_all(
            """
            SELECT sender_role, content
            FROM tutor_messages
            WHERE user_id = ? AND conversation_id = ?
            ORDER BY id DESC
            LIMIT 12
            """,
            (settings.single_user_id, conversation_id),
        )

        history_for_model = [{'role': 'system', 'content': role_prompt}] if role_prompt else []
        for row in reversed(rows):
            model_role = 'assistant' if row['sender_role'] == 'assistant' else 'user'
            history_for_model.append({'role': model_role, 'content': row['content']})

        assistant_parts: list[str] = []
        async for evt_type, payload in spark_lite.stream_chat_events(
            req.message,
            mode=req.mode,
            history=history_for_model,
        ):
            if evt_type == 'text':
                chunk = str(payload.get('content', ''))
                if chunk:
                    assistant_parts.append(chunk)
                    yield ('text', {'content': chunk})
            elif evt_type == 'error':
                yield ('error', payload)

        answer = ''.join(assistant_parts)
        assistant_id = _execute_returning_id(
            """
            INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, created_at)
            VALUES (?, ?, 'assistant', ?, '[]', ?)
            """,
            (
                conversation_id,
                settings.single_user_id,
                answer,
                now_iso(),
            ),
        )

        append_jsonl(
            settings.single_user_id,
            'learning_events.jsonl',
            {
                'type': 'tutor_chat',
                'conversation_id': conversation_id,
                'role_id': role_id,
                'question': req.message,
            },
        )

        yield (
            'done',
            {
                'message': {
                    'id': assistant_id,
                    'conversation_id': conversation_id,
                    'role': 'assistant',
                    'content': answer,
                    'timestamp': now_iso(),
                }
            },
        )

    return StreamingResponse(sse_wrap(gen()), media_type='text/event-stream')


@router.get('/tutor/history')
async def tutor_history(limit: int = 20, conversation_id: int | None = None):
    if conversation_id is None:
        conversation_id = _ensure_default_conversation()

    rows = fetch_all(
        """
        SELECT id, sender_role, content, created_at, conversation_id, file_ids
        FROM tutor_messages
        WHERE user_id = ? AND conversation_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (settings.single_user_id, conversation_id, max(1, min(limit, 500))),
    )

    data = []
    for row in reversed(rows):
        files = _resolve_file_names(_parse_json_list(row['file_ids']))
        data.append(
            {
                'id': row['id'],
                'role': 'assistant' if row['sender_role'] == 'assistant' else 'user',
                'content': row['content'],
                'timestamp': row['created_at'],
                'conversation_id': row['conversation_id'],
                'file_names': files,
            }
        )

    return ok(data)


@router.get('/evaluation/report')
async def get_evaluation_report():
    return ok(
        {
            'period': '本周',
            'stats': {'total_hours': 12.5, 'task_completion_rate': 0.78, 'quiz_accuracy': 0.85, 'streak_days': 12},
            'daily_hours': [{'date': '04-10', 'hours': 2.0}, {'date': '04-11', 'hours': 1.5}, {'date': '04-12', 'hours': 2.5}],
            'time_distribution': [
                {'category': '视频学习', 'minutes': 120},
                {'category': '练习题', 'minutes': 90},
                {'category': '阅读讲义', 'minutes': 60},
                {'category': '代码实践', 'minutes': 80},
            ],
            'weak_points': [{'name': '闭包', 'score': 0.45}, {'name': '装饰器', 'score': 0.38}, {'name': '类与继承', 'score': 0.30}],
            'ai_summary': '本周你在基础语法上进步明显，建议继续强化函数与面向对象训练。',
        }
    )


@router.post('/evaluation/refresh')
async def refresh_evaluation(req: EvalRefreshReq):
    summary = await spark_lite.summarize('函数与面向对象')
    report_resp = await get_evaluation_report()
    report = report_resp.data
    report['ai_summary'] = summary

    append_jsonl(settings.single_user_id, 'learning_events.jsonl', {'type': 'evaluation_refresh', 'force': req.force})
    return ok({'message': '评估完成', 'report': report})


def _role_row_to_dict(row) -> dict[str, Any]:
    return {
        'id': row['id'],
        'name': row['name'],
        'persona': row['persona'],
        'background': row['background'],
        'style_guide': row['style_guide'],
        'rules': row['rules'],
        'enabled': bool(row['enabled']),
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


def _message_row_to_dict(row) -> dict[str, Any]:
    file_ids = _parse_json_list(row['file_ids'])
    return {
        'id': row['id'],
        'conversation_id': row['conversation_id'],
        'sender_role': row['sender_role'],
        'content': row['content'],
        'file_ids': file_ids,
        'file_names': _resolve_file_names(file_ids),
        'created_at': row['created_at'],
    }


def _parse_json_list(raw: str | None) -> list[int]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []

    out: list[int] = []
    for item in data:
        try:
            out.append(int(item))
        except (TypeError, ValueError):
            continue
    return out


def _resolve_file_names(file_ids: list[int]) -> list[str]:
    if not file_ids:
        return []

    placeholders = ','.join('?' for _ in file_ids)
    rows = fetch_all(
        f'SELECT id, filename FROM tutor_files WHERE user_id = ? AND id IN ({placeholders})',
        (settings.single_user_id, *file_ids),
    )
    mapping = {int(r['id']): str(r['filename']) for r in rows}
    return [mapping[i] for i in file_ids if i in mapping]


def _default_role_id() -> int:
    row = fetch_one(
        'SELECT id FROM tutor_roles WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
        (settings.single_user_id,),
    )
    if row:
        return int(row['id'])

    ts = now_iso()
    return _execute_returning_id(
        """
        INSERT INTO tutor_roles(user_id, name, persona, background, style_guide, rules, enabled, created_at, updated_at)
        VALUES (?, '通用学习导师', '', '', '', '', 1, ?, ?)
        """,
        (settings.single_user_id, ts, ts),
    )


def _ensure_default_conversation() -> int:
    row = fetch_one(
        """
        SELECT id
        FROM tutor_conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (settings.single_user_id,),
    )
    if row:
        return int(row['id'])

    ts = now_iso()
    return _execute_returning_id(
        """
        INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
        VALUES (?, ?, '新对话', ?, ?)
        """,
        (settings.single_user_id, _default_role_id(), ts, ts),
    )


def _role_id_for_conversation(conversation_id: int) -> int | None:
    row = fetch_one(
        'SELECT role_id FROM tutor_conversations WHERE id = ? AND user_id = ?',
        (conversation_id, settings.single_user_id),
    )
    if not row:
        return None
    value = row['role_id']
    return int(value) if value is not None else None


def _build_role_prompt(role: dict[str, Any] | None) -> str:
    if not role:
        return ''

    parts = [
        f"角色名称: {role.get('name', '')}".strip(),
        f"Persona: {role.get('persona', '')}".strip(),
        f"Background: {role.get('background', '')}".strip(),
        f"Style Guide: {role.get('style_guide', '')}".strip(),
        f"Rules: {role.get('rules', '')}".strip(),
    ]
    merged = '\n'.join(p for p in parts if p and not p.endswith(':'))
    return merged


async def _generate_conversation_title(message: str) -> str:
    cleaned = (message or '').strip()
    fallback = (cleaned[:24] if cleaned else '新对话')
    try:
        title = await spark_lite.summarize(
            f'将下面用户问题提炼成8到14个字的中文会话标题，不要标点，不要引号，只输出标题：{cleaned}'
        )
        title = ' '.join(title.split())
        title = title.replace('\n', ' ').replace('：', '').replace(':', '').replace('“', '').replace('”', '')
        title = title.strip(' \t\r\n-·,.，。;；!?！？')
        if not title:
            return fallback
        return title[:30]
    except Exception:
        return fallback


def _execute_returning_id(query: str, params: tuple[Any, ...]) -> int:
    from ..db import get_conn

    with get_conn() as conn:
        cur = conn.execute(query, params)
        return int(cur.lastrowid)
