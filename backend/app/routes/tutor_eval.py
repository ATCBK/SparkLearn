import json
import logging
import re
import uuid
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..llm import spark_lite
from ..memory_engine import build_injected_context, update_memory_from_turn
from ..schemas import fail, ok
from ..storage import append_jsonl
from ..trust_answer_controller import TrustAnswerController
from ..trust_citation import render_confidence
from ..trust_schemas import TrustAnswerRequest
from ..xfyun_tti import generate_image_base64
from .common import sse_wrap

router = APIRouter(prefix='/api', tags=['tutor-evaluation'])
trust_answer_controller = TrustAnswerController()
logger = logging.getLogger("tutor-eval")


class TutorReq(BaseModel):
    message: str
    mode: str = 'knowledge_qa'
    conversation_id: int | None = None
    role_id: int | None = None
    file_ids: list[int] = []
    page_context: dict[str, Any] | None = None
    workshop_enabled: bool = False
    workshop_role_ids: list[int] = []
    knowledge_file_ids: list[int] = []
    open_mode: bool = False


def _is_image_mode(mode: str) -> bool:
    return (mode or '').strip().lower() == 'image_gen'


def _resolve_effective_file_ids(conversation_id: int, requested_file_ids: list[int]) -> list[int]:
    explicit = [int(x) for x in (requested_file_ids or []) if int(x) > 0]
    if explicit:
        return explicit
    row = fetch_one(
        """
        SELECT file_ids
        FROM tutor_messages
        WHERE user_id = ? AND conversation_id = ? AND sender_role = 'user' AND file_ids IS NOT NULL AND file_ids <> '[]'
        ORDER BY id DESC
        LIMIT 1
        """,
        (settings.single_user_id, conversation_id),
    )
    if row:
        ids = _parse_json_list(row['file_ids'])
        if ids:
            return ids
    # Global fallback: use latest user message with non-empty file_ids across conversations.
    row2 = fetch_one(
        """
        SELECT file_ids
        FROM tutor_messages
        WHERE user_id = ? AND sender_role = 'user' AND file_ids IS NOT NULL AND file_ids <> '[]'
        ORDER BY id DESC
        LIMIT 1
        """,
        (settings.single_user_id,),
    )
    if not row2:
        return []
    return _parse_json_list(row2['file_ids'])


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


class OptimizePromptReq(BaseModel):
    field: str  # persona, background, style_guide, rules
    content: str
    role_name: str = ''


@router.post('/tutor/roles/optimize-prompt')
async def optimize_prompt(req: OptimizePromptReq):
    """AI 一键优化提示词"""
    field_labels = {
        'persona': 'Persona（角色设定）',
        'background': '背景设定',
        'style_guide': '风格指南',
        'rules': '规则约束',
    }
    field_label = field_labels.get(req.field, req.field)

    system_prompt = f"""你是一位专业的 AI 提示词优化专家。用户正在为一个名为"{req.role_name}"的 AI 导师角色编写{field_label}。
请优化以下内容，使其更加清晰、结构化、专业。保持原意不变，但让表达更精准、更有层次感。
如果内容为空或过于简短，请根据角色名称生成一份高质量的{field_label}。

要求：
- 使用中文
- 结构清晰，适当分段
- 具体可执行，避免空泛
- 保持在 500 字以内

直接输出优化后的内容，不要加任何前缀说明。"""

    user_content = req.content if req.content.strip() else f'请为"{req.role_name}"角色生成{field_label}'

    result_text = ''
    async for evt_type, payload in spark_lite.stream_chat_events(
        user_content, mode='general', system_prompt=system_prompt
    ):
        if evt_type == 'text':
            result_text += str(payload.get('content', ''))

    return ok({'optimized': result_text.strip()})


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
        try:
            await _index_tutor_file(file_id=file_id, stored_path=stored_path, filename=f.filename or stored_name, mime_type=f.content_type or '')
        except Exception as exc:
            logger.exception("index tutor file failed: file_id=%s filename=%s err=%s", file_id, f.filename or stored_name, exc)
        saved.append(
            {
                'id': file_id,
                'filename': f.filename or stored_name,
                'mime_type': f.content_type or 'application/octet-stream',
                'size_bytes': len(raw),
            }
        )

    return ok(saved)


@router.get('/tutor/files')
async def list_tutor_files():
    """列出用户上传过的所有文件"""
    rows = fetch_all(
        'SELECT id, filename, mime_type, size_bytes, created_at FROM tutor_files WHERE user_id = ? ORDER BY created_at DESC',
        (settings.single_user_id,),
    )
    return ok([dict(r) for r in rows])


@router.delete('/tutor/files/{file_id}')
async def delete_tutor_file(file_id: int):
    """删除一个上传的文件"""
    row = fetch_one('SELECT id, stored_path FROM tutor_files WHERE id = ? AND user_id = ?', (file_id, settings.single_user_id))
    if not row:
        raise HTTPException(status_code=404, detail='文件不存在')
    stored = Path(row['stored_path'])
    if stored.exists():
        stored.unlink()
    execute('DELETE FROM tutor_file_chunks WHERE file_id = ?', (file_id,))
    execute('DELETE FROM tutor_files WHERE id = ?', (file_id,))
    return ok({'deleted': True})


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

        effective_file_ids = _resolve_effective_file_ids(conversation_id, req.file_ids or [])

        user_msg_id = _execute_returning_id(
            """
            INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, created_at)
            VALUES (?, ?, 'user', ?, ?, ?)
            """,
            (
                conversation_id,
                settings.single_user_id,
                req.message,
                json.dumps(effective_file_ids, ensure_ascii=False),
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

        page_prompt = _build_page_context_prompt(req.page_context)
        memory_prompt = build_injected_context(settings.single_user_id, req.message, top_k=8)
        file_context, file_sources = await _retrieve_tutor_file_context(effective_file_ids, req.message)
        file_prompt = ''
        if file_context:
            file_prompt = f"以下是用户上传文件检索到的相关片段，请优先基于这些证据回答：\n{file_context}"
            yield ('sources', {'items': file_sources})
        merged_system_prompt = "\n\n".join(p for p in [role_prompt, page_prompt, memory_prompt] if p)
        if file_prompt:
            merged_system_prompt = "\n\n".join(p for p in [merged_system_prompt, file_prompt] if p)
        history_for_model = [{'role': 'system', 'content': merged_system_prompt}] if merged_system_prompt else []
        for row in reversed(rows):
            model_role = 'assistant' if row['sender_role'] == 'assistant' else 'user'
            history_for_model.append({'role': model_role, 'content': row['content']})

        confidence_payload: dict[str, Any] = {}
        citations_payload: list[dict[str, Any]] = []
        trust_meta_payload: dict[str, Any] = {}

        if req.workshop_enabled:
            profile = _load_profile_snapshot()
            profile_summary = _profile_summary_text(profile)
            complexity = _estimate_question_complexity(req.message)
            rounds = _rounds_for_complexity(complexity)
            participants = _build_workshop_participants(req, role)

            yield (
                'workshop_meta',
                {
                    'enabled': True,
                    'complexity': complexity,
                    'rounds': rounds,
                    'participants': [
                        {'id': p['id'], 'name': p['name'], 'kind': p['kind']}
                        for p in participants
                    ],
                },
            )
            yield ('workshop_phase', {'phase': 'profile_analysis', 'status': 'running'})

            profile_analysis = _build_profile_analysis(profile)
            yield (
                'hub',
                _hub_message(
                    phase='profile_analysis',
                    round_no=0,
                    agent_id='profile-agent',
                    agent_name='画像分析师',
                    agent_kind='system',
                    content=profile_analysis,
                ),
            )
            yield ('workshop_phase', {'phase': 'profile_analysis', 'status': 'done'})

            hub_log: list[dict[str, Any]] = []
            hub_log.append(
                _hub_message(
                    phase='profile_analysis',
                    round_no=0,
                    agent_id='profile-agent',
                    agent_name='画像分析师',
                    agent_kind='system',
                    content=profile_analysis,
                )
            )

            for round_no in range(1, rounds + 1):
                yield ('workshop_phase', {'phase': 'discussion', 'round': round_no, 'status': 'running'})
                for participant in participants:
                    partial_text = ''
                    async for chunk in _workshop_agent_reply_stream(
                        question=req.message,
                        profile_summary=profile_summary,
                        participant=participant,
                        round_no=round_no,
                        total_rounds=rounds,
                        hub_log=hub_log,
                        mode=req.mode,
                    ):
                        partial_text += chunk
                        delta_msg = _hub_message(
                            phase='discussion',
                            round_no=round_no,
                            agent_id=participant['id'],
                            agent_name=participant['name'],
                            agent_kind=participant['kind'],
                            content=partial_text,
                        )
                        delta_msg['delta'] = True
                        yield ('hub', delta_msg)

                    participant_reply = partial_text.strip()
                    if not participant_reply:
                        participant_reply = _fallback_agent_reply(participant, round_no)
                    msg = _hub_message(
                        phase='discussion',
                        round_no=round_no,
                        agent_id=participant['id'],
                        agent_name=participant['name'],
                        agent_kind=participant['kind'],
                        content=participant_reply,
                    )
                    hub_log.append(msg)
                    msg['delta'] = False
                    yield ('hub', msg)
                yield ('workshop_phase', {'phase': 'discussion', 'round': round_no, 'status': 'done'})

            yield ('workshop_phase', {'phase': 'synthesis', 'status': 'running'})
            answer, final_brief = await _workshop_synthesize_answer(
                question=req.message,
                profile_summary=profile_summary,
                hub_log=hub_log,
                mode=req.mode,
                role_prompt=role_prompt,
            )
            yield (
                'hub',
                _hub_message(
                    phase='synthesis',
                    round_no=rounds,
                    agent_id='final-answer-agent',
                    agent_name='最终回答智能体',
                    agent_kind='system',
                    content=final_brief,
                ),
            )
            for chunk in _chunk_text(answer, 120):
                yield ('text', {'content': chunk})
            yield ('workshop_phase', {'phase': 'synthesis', 'status': 'done'})
        else:
            if _is_image_mode(req.mode):
                image_b64 = await generate_image_base64(
                    prompt=req.message,
                    width=512,
                    height=512,
                    uid=settings.single_user_id,
                )
                answer = f"![AI生成图](data:image/png;base64,{image_b64})"
                yield ('text', {'content': answer})
            elif req.open_mode:
                if file_context and re.search(r'(文件|文档|上传|总结|要点|讲了什么|内容)', req.message):
                    answer = _fallback_answer_from_file_context(req.message, file_context, file_sources)
                    yield ('text', {'content': answer})
                    assistant_parts = [answer]
                    # skip model call for file-summary style questions
                    # to avoid model fallback like "无法访问文件"
                    pass
                else:
                    direct_prompt = req.message
                    if file_context:
                        direct_prompt = (
                            "你可以直接读取下面的文件片段并基于其内容回答。"
                            "不要说你无法访问文件。\n\n"
                            f"{file_context}\n\n"
                            f"用户问题：{req.message}"
                        )
                    assistant_parts: list[str] = []
                    async for evt_type, payload in spark_lite.stream_chat_events(
                        direct_prompt,
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
                    answer = ''.join(assistant_parts).strip()
                    if file_context and any(x in answer for x in ['无法直接访问', '无法访问文件', '未提供文件', '提供文件的详细信息']):
                        answer = _fallback_answer_from_file_context(req.message, file_context, file_sources)
                        yield ('text', {'content': '\n\n' + answer})
                    if not answer:
                        answer = '我先给你一个直觉性回答：可以补充更多上下文让我继续细化。'
                        yield ('text', {'content': answer})
            else:
                trust_plan = await trust_answer_controller.plan(
                    TrustAnswerRequest(
                        scene='tutor',
                        query=req.message,
                        mode=req.mode,
                        role_prompt=role_prompt,
                        page_prompt=page_prompt,
                        memory_prompt=memory_prompt,
                        conversation_id=conversation_id,
                        file_ids=effective_file_ids,
                        knowledge_file_ids=req.knowledge_file_ids or [],
                        user_file_sources=file_sources,
                        use_profile=True,
                    )
                )
                confidence_payload = render_confidence(
                    float(trust_plan['confidence_score']),
                    str(trust_plan['confidence_level']),
                    list(dict(trust_plan['trust_meta']).get('reason_codes', [])),
                )
                citations_payload = list(trust_plan['citations'])
                trust_meta_payload = dict(trust_plan['trust_meta'])
                yield ('confidence', confidence_payload)
                yield ('trust_meta', trust_meta_payload)
                yield ('citations', {'items': citations_payload})
                mcp_calls = trust_meta_payload.get('mcp_calls')
                if isinstance(mcp_calls, list):
                    for item in mcp_calls:
                        if not isinstance(item, dict):
                            continue
                        yield (
                            'mcp_call',
                            {
                                'service_id': str(item.get('service_id', '')),
                                'service_name': str(item.get('service_name', '')),
                                'tool_name': str(item.get('tool_name', '')),
                            },
                        )
                answer_parts: list[str] = []
                async for evt_type, payload in spark_lite.stream_chat_events(str(trust_plan['prompt']), mode=req.mode, history=[]):
                    if evt_type == 'text':
                        chunk = str(payload.get('content', ''))
                        if chunk:
                            answer_parts.append(chunk)
                            if len(chunk) <= 64:
                                yield ('text', {'content': chunk})
                            else:
                                for sub in _chunk_text(chunk, 64):
                                    yield ('text', {'content': sub})
                    elif evt_type == 'error':
                        yield ('error', payload)
                answer = ''.join(answer_parts).strip()
                if not answer:
                    answer = '当前证据不足，我先给出一个方向性建议：请补充题目或课程资料后我再给你更准确的结论。'
                    yield ('text', {'content': answer})
        assistant_id = _execute_returning_id(
            """
            INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, meta_json, created_at)
            VALUES (?, ?, 'assistant', ?, '[]', ?, ?)
            """,
            (
                conversation_id,
                settings.single_user_id,
                answer,
                json.dumps(
                    {
                        'confidence': confidence_payload,
                        'citations': citations_payload,
                        'trust_meta': trust_meta_payload,
                        'open_mode': bool(req.open_mode),
                        'mode': req.mode,
                    },
                    ensure_ascii=False,
                ),
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
        memory_update = update_memory_from_turn(
            user_id=settings.single_user_id,
            user_message=req.message,
            assistant_message=answer,
            page_context=req.page_context,
        )
        append_jsonl(
            settings.single_user_id,
            'learning_events.jsonl',
            {
                'type': 'memory_updated',
                'conversation_id': conversation_id,
                'changed': memory_update.get('changed', 0),
                'version': memory_update.get('version', 0),
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
                },
                'memory': {
                    'updated': True,
                    'changed': memory_update.get('changed', 0),
                    'version': memory_update.get('version', 0),
                },
                'sources': file_sources,
                'confidence': confidence_payload,
                'citations': citations_payload,
                'trust_meta': trust_meta_payload,
            },
        )

    return StreamingResponse(
        sse_wrap(gen()),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


@router.get('/tutor/history')
async def tutor_history(limit: int = 20, conversation_id: int | None = None):
    if conversation_id is None:
        conversation_id = _ensure_default_conversation()

    rows = fetch_all(
        """
        SELECT id, sender_role, content, created_at, conversation_id, file_ids, meta_json
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
        meta = _parse_json_dict(row['meta_json']) if 'meta_json' in row.keys() else {}
        data.append(
            {
                'id': row['id'],
                'role': 'assistant' if row['sender_role'] == 'assistant' else 'user',
                'content': row['content'],
                'timestamp': row['created_at'],
                'conversation_id': row['conversation_id'],
                'file_names': files,
                'confidence': meta.get('confidence') if isinstance(meta.get('confidence'), dict) else None,
                'citations': meta.get('citations') if isinstance(meta.get('citations'), list) else [],
                'trust_meta': meta.get('trust_meta') if isinstance(meta.get('trust_meta'), dict) else {},
                'open_mode': bool(meta.get('open_mode', False)),
            }
        )

    return ok(data)


@router.get('/evaluation/report')
async def get_evaluation_report(period: str = 'week'):
    from .report_service import get_evaluation_report as _get_report

    return await _get_report(period)


@router.post('/evaluation/refresh')
async def refresh_evaluation(req: EvalRefreshReq):
    from .report_service import get_evaluation_report as _get_report

    summary = await spark_lite.summarize('函数与面向对象')
    report_resp = await _get_report()
    report = report_resp.data
    report['ai_summary'] = summary

    append_jsonl(settings.single_user_id, 'learning_events.jsonl', {'type': 'evaluation_refresh', 'force': req.force})
    return ok({'message': '评估完成', 'report': report})


class AiSummaryReq(BaseModel):
    period: str = 'week'


@router.post('/report/ai-summary')
async def generate_report_ai_summary(req: AiSummaryReq):
    """Stream an AI-generated learning report summary via SSE."""
    period = req.period if req.period in {'day', 'week', 'month'} else 'week'

    # Gather context data for the AI
    profile_row = fetch_one('SELECT * FROM profiles WHERE user_id = ?', (settings.single_user_id,))
    mastery_rows = fetch_all(
        'SELECT knowledge_point_name, score, chapter FROM mastery_records WHERE user_id = ? ORDER BY score ASC LIMIT 5',
        (settings.single_user_id,),
    )
    weak_points = [{'name': r['knowledge_point_name'], 'score': round(float(r['score']), 2)} for r in mastery_rows]

    period_labels = {'day': '今日', 'week': '本周', 'month': '本月'}
    period_label = period_labels.get(period, '本周')

    # Build stats context
    report_resp = await get_evaluation_report(period)
    stats = report_resp.data['stats']

    prompt = (
        f"你是一个学习分析助手。请根据以下学习数据，为学生生成一份{period_label}学习报告总结。\n"
        f"要求：分析学习情况、指出进步和不足、给出具体可执行的建议。语气亲切专业，200字左右。\n\n"
        f"【{period_label}学习数据】\n"
        f"- 学习时长: {stats['total_hours']}小时\n"
        f"- 任务完成率: {int(stats['task_completion_rate'] * 100)}%\n"
        f"- 练习正确率: {int(stats['quiz_accuracy'] * 100)}%\n"
        f"- 连续学习天数: {stats['streak_days']}天\n"
        f"- 薄弱知识点: {json.dumps([wp['name'] for wp in weak_points], ensure_ascii=False)}\n"
    )

    if profile_row:
        goal = profile_row['goal'] or '[]'
        prefs = profile_row['learning_preference'] or '[]'
        prompt += f"- 学习目标: {goal}\n- 学习偏好: {prefs}\n"

    prompt += f"\n请生成{period_label}学习报告总结："

    async def _stream() -> AsyncGenerator[tuple[str, dict], None]:
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode='general', history=[]):
            if evt_type == 'text':
                yield ('text', payload)
            elif evt_type == 'done':
                yield ('done', payload)
                break
            elif evt_type == 'error':
                yield ('error', payload)
                break

    return StreamingResponse(
        sse_wrap(_stream()),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


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


def _build_page_context_prompt(page_context: dict[str, Any] | None) -> str:
    if not page_context:
        return ''
    safe = {str(k): str(v)[:200] for k, v in page_context.items() if v is not None}
    if not safe:
        return ''
    return (
        "你正在作为 SparkLearn 页面级 AI 精灵助手回答。请结合当前页面上下文，"
        "优先给出可执行学习建议，不要泛泛聊天。\n"
        f"页面上下文: {json.dumps(safe, ensure_ascii=False)}"
    )


def _message_row_to_dict(row) -> dict[str, Any]:
    file_ids = _parse_json_list(row['file_ids'])
    meta = _parse_json_dict(row['meta_json']) if 'meta_json' in row.keys() else {}
    return {
        'id': row['id'],
        'conversation_id': row['conversation_id'],
        'sender_role': row['sender_role'],
        'content': row['content'],
        'file_ids': file_ids,
        'file_names': _resolve_file_names(file_ids),
        'confidence': meta.get('confidence') if isinstance(meta.get('confidence'), dict) else None,
        'citations': meta.get('citations') if isinstance(meta.get('citations'), list) else [],
        'trust_meta': meta.get('trust_meta') if isinstance(meta.get('trust_meta'), dict) else {},
        'open_mode': bool(meta.get('open_mode', False)),
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


def _load_profile_snapshot() -> dict[str, Any]:
    row = fetch_one('SELECT * FROM profiles WHERE user_id = ?', (settings.single_user_id,))
    if not row:
        return {}
    return {
        'goal': _safe_json_loads(row['goal'], []),
        'knowledge_level': row['knowledge_level'] or '',
        'weak_points': _safe_json_loads(row['weak_points'], []),
        'learning_preference': _safe_json_loads(row['learning_preference'], []),
        'cognitive_style': row['cognitive_style'] or '',
        'daily_time': int(row['daily_time'] or 0),
        'practical_ability': row['practical_ability'] or '',
        'current_stage': row['current_stage'] or '',
    }


def _profile_summary_text(profile: dict[str, Any]) -> str:
    if not profile:
        return '暂无画像数据，请采用循序渐进解释。'
    return (
        f"目标: {json.dumps(profile.get('goal', []), ensure_ascii=False)}; "
        f"基础: {profile.get('knowledge_level', '')}; "
        f"薄弱点: {json.dumps(profile.get('weak_points', []), ensure_ascii=False)}; "
        f"偏好: {json.dumps(profile.get('learning_preference', []), ensure_ascii=False)}; "
        f"认知风格: {profile.get('cognitive_style', '')}; "
        f"每天可投入: {profile.get('daily_time', 0)}分钟; "
        f"实践能力: {profile.get('practical_ability', '')}。"
    )


def _build_profile_analysis(profile: dict[str, Any]) -> str:
    if not profile:
        return '未读取到完整画像，建议先采用中等难度解释并在回答末尾补充可选进阶路径。'

    weak_points = ', '.join(profile.get('weak_points', [])[:3]) or '暂无'
    prefs = ', '.join(profile.get('learning_preference', [])[:3]) or '暂无'
    return (
        f"学习者当前基础为“{profile.get('knowledge_level', '未知')}”，"
        f"薄弱点集中在：{weak_points}。"
        f"建议采用“{prefs}”风格讲解，先给结论再拆步骤，"
        f"并提供1个可执行练习任务。"
    )


def _estimate_question_complexity(question: str) -> str:
    text = (question or '').strip()
    if not text:
        return 'simple'

    score = 0
    if len(text) >= 120:
        score += 2
    elif len(text) >= 60:
        score += 1

    advanced_signals = ['对比', '优缺点', '为什么', '原理', '设计', '架构', '证明', '推导', '优化', '权衡']
    score += sum(1 for s in advanced_signals if s in text)
    if any(sym in text for sym in ['\n', '；', ';', '，并', '同时', '另外']):
        score += 1

    if score >= 4:
        return 'hard'
    if score >= 2:
        return 'medium'
    return 'simple'


def _rounds_for_complexity(complexity: str) -> int:
    mapping = {'simple': 2, 'medium': 3, 'hard': 5}
    return min(5, max(1, mapping.get(complexity, 3)))


def _build_workshop_participants(req: TutorReq, active_role: Any) -> list[dict[str, str]]:
    participants: list[dict[str, str]] = [
        {
            'id': 'clarifier',
            'name': '提问优化师',
            'kind': 'system',
            'prompt': '你擅长把问题重构得更清晰，要求给出目标、约束、上下文缺口。',
        },
        {
            'id': 'subject-tutor',
            'name': '学科导师',
            'kind': 'system',
            'prompt': '你负责给出专业解释与解题路径，强调准确性与步骤。',
        },
        {
            'id': 'challenger',
            'name': '质疑者',
            'kind': 'system',
            'prompt': '你专门发现漏洞、边界条件、易错点，并提出修正建议。',
        },
        {
            'id': 'coach',
            'name': '行动教练',
            'kind': 'system',
            'prompt': '你负责把讨论转化为可执行学习动作，输出可量化下一步。',
        },
    ]

    custom_ids = [int(x) for x in req.workshop_role_ids if int(x) > 0]
    if req.role_id and req.role_id not in custom_ids:
        custom_ids.append(int(req.role_id))
    if active_role and req.role_id is None:
        try:
            active_id = int(active_role['id'])
            if active_id not in custom_ids:
                custom_ids.append(active_id)
        except (TypeError, ValueError, KeyError):
            pass

    if custom_ids:
        placeholders = ','.join('?' for _ in custom_ids)
        rows = fetch_all(
            f"""
            SELECT id, name, persona, background, style_guide, rules
            FROM tutor_roles
            WHERE user_id = ? AND id IN ({placeholders})
            ORDER BY updated_at DESC
            """,
            (settings.single_user_id, *custom_ids),
        )
        for row in rows:
            participants.append(
                {
                    'id': f"custom-{row['id']}",
                    'name': str(row['name'] or f"自定义导师{row['id']}"),
                    'kind': 'custom',
                    'prompt': _build_role_prompt(dict(row)) or '你是用户自定义导师，请结合你的角色设定参与讨论。',
                }
            )

    return participants


def _hub_message(
    *,
    phase: str,
    round_no: int,
    agent_id: str,
    agent_name: str,
    agent_kind: str,
    content: str,
) -> dict[str, Any]:
    return {
        'phase': phase,
        'round': round_no,
        'agent_id': agent_id,
        'agent_name': agent_name,
        'agent_kind': agent_kind,
        'content': content,
        'timestamp': now_iso(),
    }


async def _workshop_agent_reply_stream(
    *,
    question: str,
    profile_summary: str,
    participant: dict[str, str],
    round_no: int,
    total_rounds: int,
    hub_log: list[dict[str, Any]],
    mode: str,
) -> AsyncGenerator[str, None]:
    recent_log = hub_log[-10:]
    recent_text = '\n'.join([_hub_line(x) for x in recent_log])
    last_round_points = _last_round_points(hub_log, round_no - 1)
    banned = '\n'.join([f"- {x}" for x in _recent_unique_contents(hub_log, limit=8)])
    prompt = (
        "你正在参与一场教育问答研讨讨论，请自然发言。\n"
        f"当前轮次: {round_no}/{total_rounds}\n"
        f"发言者: {participant.get('name', '导师')}\n"
        f"你的角色设定: {participant.get('prompt', '')}\n"
        f"用户画像摘要: {profile_summary}\n"
        f"用户问题: {question}\n"
        f"上一轮各角色要点: {last_round_points}\n"
        f"最近讨论记录:\n{recent_text}\n"
        f"禁止重复内容:\n{banned}\n"
        "请给出自然、直接的短发言，补充你认为最有价值的观点。"
    )
    parts: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode=mode, history=[]):
        if evt_type == 'text':
            chunk = str(payload.get('content', ''))
            if chunk:
                parts.append(chunk)
                yield chunk
    text = ''.join(parts).strip()
    if not text:
        yield _fallback_agent_reply(participant, round_no)


async def _workshop_synthesize_answer(
    *,
    question: str,
    profile_summary: str,
    hub_log: list[dict[str, Any]],
    mode: str,
    role_prompt: str,
) -> tuple[str, str]:
    hub_text = '\n'.join([_to_synthesis_line(x) for x in hub_log[-24:]])
    round_digest = _build_round_digest(hub_log)
    system_hint = role_prompt.strip() if role_prompt else '你是严谨、耐心的学习导师。'
    prompt = (
        f"{system_hint}\n"
        "你是 FinalAnswerAgent，请结合每一轮讨论结论，产出面向用户的最终答案。\n"
        "请基于讨论结果，直接给用户一段完整、自然、可执行的最终答复。\n"
        "不要使用固定模板标题，不要机械分段，不要暴露内部讨论指令。\n"
        "只回答当前这一次用户问题，不要回放历史轮次问答，不要写“用户:”“导师名:”这类前缀。\n"
        "最终只输出一份答案，不要输出多个回答版本。\n"
        "在结尾追加3条“可追问问题”，帮助用户继续提问。\n"
        f"用户画像摘要: {profile_summary}\n"
        f"用户原问题: {question}\n"
        f"每轮讨论摘要:\n{round_digest}\n"
        f"讨论摘录:\n{hub_text}"
    )
    answer = await _model_complete(prompt=prompt, mode=mode, history=[])
    final_answer = (answer or '暂时无法生成完整总结，请重试。').strip()
    if _looks_like_dialogue_transcript(final_answer):
        final_answer = await _rewrite_to_single_user_answer(
            question=question,
            answer_text=final_answer,
            mode=mode,
        )
    brief = await _model_complete(
        prompt=(
            "你是 FinalAnswerAgent。请将你刚生成的最终答案提炼成一句20-40字摘要，"
            "用于在研讨会消息流展示，不要包含固定标题。\n"
            f"最终答案:\n{final_answer}"
        ),
        mode=mode,
        history=[],
    )
    final_brief = (brief or 'FinalAnswerAgent 已完成各轮观点整合并输出最终答复。').strip()
    return final_answer, final_brief


async def _model_complete(prompt: str, mode: str, history: list[dict[str, str]]) -> str:
    parts: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode=mode, history=history):
        if evt_type == 'text':
            chunk = str(payload.get('content', ''))
            if chunk:
                parts.append(chunk)
    return ''.join(parts).strip()


def _chunk_text(text: str, size: int) -> list[str]:
    if not text:
        return []
    return [text[i:i + size] for i in range(0, len(text), size)]


def _safe_json_loads(raw: Any, fallback: Any) -> Any:
    if raw is None:
        return fallback
    if isinstance(raw, (list, dict)):
        return raw
    try:
        value = json.loads(str(raw))
        return value
    except (TypeError, ValueError, json.JSONDecodeError):
        return fallback


def _to_synthesis_line(item: dict[str, Any]) -> str:
    role = str(item.get('agent_name', 'Agent'))
    content = str(item.get('content', '')).strip()
    content = re.sub(r'回应对象\s*[:：]\s*[^；;。\n]+[；;]?', '', content)
    content = re.sub(r'新增点\s*[:：]\s*', '', content)
    content = re.sub(r'行动建议\s*[:：]\s*', '', content)
    content = re.sub(r'从你的角色补充差异化视角[^。；;\n]*', '', content)
    content = re.sub(r'\s+', ' ', content).strip(' ;；')
    return f'{role}: {content}'


def _build_round_digest(hub_log: list[dict[str, Any]]) -> str:
    rounds: dict[int, list[str]] = {}
    for item in hub_log:
        if str(item.get('phase', '')) != 'discussion':
            continue
        round_no = int(item.get('round', 0) or 0)
        if round_no <= 0:
            continue
        rounds.setdefault(round_no, []).append(
            f"{item.get('agent_name', 'agent')}: {str(item.get('content', '')).strip()}"
        )

    if not rounds:
        return '暂无有效讨论摘要。'

    lines: list[str] = []
    for r in sorted(rounds.keys()):
        merged = ' | '.join(rounds[r][:8])
        lines.append(f"第{r}轮: {merged}")
    return '\n'.join(lines)


def _looks_like_dialogue_transcript(text: str) -> bool:
    if not text:
        return False
    user_hits = len(re.findall(r'(^|\n)\s*用户\s*[:：]', text))
    role_hits = len(re.findall(r'(^|\n)\s*[^:\n：]{1,16}\s*[:：]', text))
    return user_hits >= 1 and role_hits >= 3


async def _rewrite_to_single_user_answer(*, question: str, answer_text: str, mode: str) -> str:
    prompt = (
        "请将下面内容改写成直接给用户的一份最终答案。\n"
        "要求：\n"
        "1) 只保留一个最终答案；\n"
        "2) 不要使用“用户:”“某导师:”前缀；\n"
        "3) 不要回放历史问答；\n"
        "4) 在结尾保留3条可追问问题。\n"
        f"当前问题: {question}\n"
        f"原始内容:\n{answer_text}"
    )
    rewritten = (await _model_complete(prompt=prompt, mode=mode, history=[])).strip()
    return rewritten or answer_text


def _agent_responsibility(participant: dict[str, str]) -> str:
    agent_id = participant.get('id', '')
    if agent_id == 'clarifier':
        return '只做问题重构，补充目标、约束、缺失信息，不给完整教学答案。'
    if agent_id == 'subject-tutor':
        return '只给关键原理和最短解题路径，避免泛泛建议。'
    if agent_id == 'challenger':
        return '专门找漏洞、边界条件和可能误导点。'
    if agent_id == 'coach':
        return '把观点转成可执行训练动作，强调时间和产出。'
    return '基于你的自定义角色设定提出独特观点，避免复述他人。'


def _hub_line(item: dict[str, Any]) -> str:
    return f"[R{item.get('round', 0)}]{item.get('agent_name', 'agent')}: {item.get('content', '')}"


def _last_round_points(hub_log: list[dict[str, Any]], round_no: int) -> str:
    if round_no <= 0:
        return '首轮无历史。'
    rows = [x for x in hub_log if int(x.get('round', 0) or 0) == round_no]
    if not rows:
        return '上一轮无有效记录。'
    compact = [f"{x.get('agent_name', 'agent')}:{str(x.get('content', ''))[:36]}" for x in rows[:8]]
    return '；'.join(compact)


def _recent_unique_contents(hub_log: list[dict[str, Any]], limit: int = 6) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in reversed(hub_log):
        raw = str(item.get('content', '')).strip()
        norm = _normalize_for_similarity(raw)
        if not raw or not norm or norm in seen:
            continue
        seen.add(norm)
        out.append(raw[:60])
        if len(out) >= limit:
            break
    return list(reversed(out))


def _normalize_for_similarity(text: str) -> str:
    return re.sub(r'[^0-9A-Za-z\u4e00-\u9fff]+', '', (text or '').lower())


def _similarity_score(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    sa = set(a)
    sb = set(b)
    if not sa or not sb:
        return 0.0
    inter = len(sa & sb)
    union = len(sa | sb)
    if union == 0:
        return 0.0
    return inter / union


def _is_redundant_reply(text: str, hub_log: list[dict[str, Any]]) -> bool:
    current = _normalize_for_similarity(text)
    if len(current) < 12:
        return False
    for item in hub_log[-12:]:
        prev = _normalize_for_similarity(str(item.get('content', '')))
        if not prev:
            continue
        if _similarity_score(current, prev) >= 0.72:
            return True
    return False


def _fallback_agent_reply(participant: dict[str, str], round_no: int) -> str:
    name = participant.get('name', '导师')
    return f"{name}补充：建议从一个最小可执行练习切入，并用结果验证本轮观点。"


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


def _extract_text_for_tutor(path: Path, mime_type: str, filename: str) -> str:
    suffix = path.suffix.lower() or Path(filename).suffix.lower()
    if suffix == '.pdf' or 'pdf' in mime_type:
        import fitz

        doc = fitz.open(path)
        try:
            return '\n'.join(page.get_text('text') for page in doc).strip()
        finally:
            doc.close()
    if suffix in {'.txt', '.md'} or mime_type.startswith('text/'):
        return path.read_text(encoding='utf-8', errors='ignore').strip()
    raise RuntimeError(f'unsupported format: {suffix or mime_type}')


def _chunk_text_for_tutor(text: str, size: int = 700, overlap: int = 120) -> list[str]:
    cleaned = text.replace('\r\n', '\n').replace('\r', '\n').strip()
    if not cleaned:
        return []
    paras = [p.strip() for p in re.split(r'\n{2,}', cleaned) if p.strip()]
    out: list[str] = []
    buf = ''
    for p in paras:
        p = re.sub(r'\s+', ' ', p).strip()
        if len(buf) + len(p) + 2 <= size:
            buf = f'{buf}\n\n{p}'.strip()
        else:
            if buf:
                out.append(buf)
            head = buf[-overlap:] if buf else ''
            buf = f'{head}\n\n{p}'.strip()
    if buf:
        out.append(buf)
    return out


def _parse_json_dict(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


async def _index_tutor_file(*, file_id: int, stored_path: Path, filename: str, mime_type: str) -> None:
    text = _extract_text_for_tutor(stored_path, mime_type, filename)
    chunks = _chunk_text_for_tutor(text, size=700, overlap=120)
    execute('DELETE FROM tutor_file_chunks WHERE file_id = ?', (file_id,))
    ts = now_iso()
    for idx, chunk in enumerate(chunks):
        execute(
            'INSERT INTO tutor_file_chunks(file_id, chunk_index, content, embedding_json, created_at) VALUES (?, ?, ?, ?, ?)',
            (file_id, idx, chunk, '', ts),
        )


async def _retrieve_tutor_file_context(file_ids: list[int], query: str, max_chars: int = 3500, top_k: int = 8) -> tuple[str, list[dict[str, Any]]]:
    ids = [int(x) for x in file_ids if int(x) > 0]
    if not ids:
        return ('', [])
    placeholders = ','.join('?' for _ in ids)
    rows = fetch_all(
        f"""
        SELECT c.chunk_index, c.content, f.filename
        FROM tutor_file_chunks c
        JOIN tutor_files f ON f.id = c.file_id
        WHERE f.user_id = ? AND c.file_id IN ({placeholders})
        ORDER BY c.file_id ASC, c.chunk_index ASC
        """,
        (settings.single_user_id, *ids),
    )
    if not rows:
        # Fallback: if chunk table is empty, read original uploaded files directly.
        file_rows = fetch_all(
            f"""
            SELECT id, filename, stored_path, mime_type
            FROM tutor_files
            WHERE user_id = ? AND id IN ({placeholders})
            ORDER BY id ASC
            """,
            (settings.single_user_id, *ids),
        )
        selected: list[str] = []
        sources: list[dict[str, Any]] = []
        total = 0
        count = 0
        for fr in file_rows:
            filename = str(fr['filename'] or '')
            stored_path = Path(str(fr['stored_path'] or ''))
            mime_type = str(fr['mime_type'] or '')
            if not stored_path.exists():
                continue
            text = _extract_text_for_tutor(stored_path, mime_type, filename).strip()
            if not text:
                continue
            chunks = _chunk_text_for_tutor(text, size=700, overlap=120)
            for chunk_index, content in enumerate(chunks):
                piece = f'[{filename}#{chunk_index + 1}] {content}'
                if total + len(piece) > max_chars:
                    break
                selected.append(piece)
                sources.append(
                    {
                        'filename': filename,
                        'chunk_index': chunk_index,
                        'score': None,
                        'snippet': piece[:260],
                    }
                )
                total += len(piece)
                count += 1
                if count >= top_k:
                    break
            if count >= top_k or total >= max_chars:
                break
        return ('\n\n'.join(selected), sources)
    selected: list[str] = []
    sources: list[dict[str, Any]] = []
    total = 0
    count = 0
    for r in rows:
        content = str(r['content'] or '').strip()
        if not content:
            continue
        filename = str(r['filename'] or '')
        chunk_index = int(r['chunk_index'] or 0)
        piece = f'[{filename}#{chunk_index + 1}] {content}'
        if total + len(piece) > max_chars:
            break
        selected.append(piece)
        sources.append(
            {
                'filename': filename,
                'chunk_index': chunk_index,
                'score': None,
                'snippet': piece[:260],
            }
        )
        total += len(piece)
        count += 1
        if count >= top_k:
            break
    return ('\n\n'.join(selected), sources)


def _fallback_answer_from_file_context(question: str, file_context: str, file_sources: list[dict[str, Any]]) -> str:
    lines = [x.strip() for x in file_context.splitlines() if x.strip()]
    points: list[str] = []
    for line in lines:
        cleaned = re.sub(r'^\[[^\]]+\]\s*', '', line).strip()
        if not cleaned:
            continue
        points.append(cleaned[:120])
        if len(points) >= 3:
            break
    if not points:
        return '我已读取到文件，但未提取到可用文本内容。请确认文件是可解析文本（如 txt/md/pdf）。'
    refs = []
    for s in file_sources[:3]:
        refs.append(f"{s.get('filename', '')}#{int(s.get('chunk_index', 0)) + 1}")
    ref_text = '，'.join([r for r in refs if r]) or '上传文件片段'
    out = ['我已读取上传文件内容，基于文件片段给出要点：']
    for i, p in enumerate(points, 1):
        out.append(f'{i}. {p}')
    out.append(f'引用片段：{ref_text}')
    return '\n'.join(out)


def _execute_returning_id(query: str, params: tuple[Any, ...]) -> int:
    from ..db import get_conn

    with get_conn() as conn:
        cur = conn.execute(query, params)
        return int(cur.lastrowid)




