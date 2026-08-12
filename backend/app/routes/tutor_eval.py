import json
import logging
import re
import uuid
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings
from ..auth import get_current_user
from ..db import execute, fetch_all, fetch_one, now_iso
from ..llm import spark_lite
from ..memory_engine import build_injected_context, update_memory_from_turn
from ..schemas import fail, ok
from ..storage import append_jsonl
from ..tavily_search import format_search_results, search_web
from ..trust_answer_controller import TrustAnswerController
from ..trust_citation import render_confidence
from ..trust_schemas import TrustAnswerRequest
from ..xfyun_tti import generate_image_base64
from .common import sse_wrap
from .mcp import _ensure_builtin_mcp_services, _mcp_request

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
    web_search: bool = False
    mcp_enabled: bool = False
    model: str = ""


class WebCaptureReq(BaseModel):
    title: str = ""
    url: str = ""
    text: str
    excerpt: str = ""


def _page_context_modes(page_context: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(page_context, dict):
        return {}
    modes = page_context.get('modes')
    return modes if isinstance(modes, dict) else {}


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def _effective_mode(req: TutorReq) -> str:
    raw_mode = (req.mode or '').strip()
    if raw_mode and raw_mode != 'knowledge_qa':
        return raw_mode
    modes = _page_context_modes(req.page_context)
    if _coerce_bool(modes.get('image_mode')):
        return 'image_gen'
    return raw_mode or 'knowledge_qa'


def _effective_web_search(req: TutorReq) -> bool:
    if req.web_search:
        return True
    modes = _page_context_modes(req.page_context)
    return _coerce_bool(modes.get('web_search'))


def _effective_model(req: TutorReq) -> str:
    raw_model = (req.model or '').strip()
    if raw_model:
        return raw_model
    modes = _page_context_modes(req.page_context)
    model = modes.get('model')
    return str(model).strip() if model is not None else ""


def _should_emit_a2ui_task_cards(message: str, mode: str) -> bool:
    if mode and mode != 'knowledge_qa':
        return False
    normalized = (message or '').strip().lower()
    if not normalized:
        return False
    intent_terms = ['任务卡', '学习任务', '学习计划', '安排', '计划', '本周', '今日', 'todo', 'task']
    return any(term in normalized for term in intent_terms)


def _should_use_a2ui_ui_only(req: TutorReq, mode: str) -> bool:
    if mode and mode != 'knowledge_qa':
        return False
    if _should_emit_a2ui_task_cards(req.message, mode):
        return True
    modes = _page_context_modes(req.page_context)
    return _coerce_bool(modes.get('a2ui_panel'))


def _build_agui_process_events(
    conversation_id: int,
    *,
    user_id: str = "",
    profile: dict[str, Any] | None = None,
    include_a2ui_sync: bool = False,
    include_run_finished: bool = True,
) -> list[dict[str, Any]]:
    run_id = f"sparklearn-tutor-run-{conversation_id}"
    user_id = user_id or settings.single_user_id
    weak_point = _first_text(_profile_value(profile, 'weak_points', []), '当前主题实践')
    preference = _first_text(_profile_value(profile, 'learning_preference', []), '直观讲解')
    current_stage = str(_profile_value(profile, 'current_stage', '') or _profile_value(profile, 'knowledge_level', '') or '学习推进中')
    daily_time = int(_profile_value(profile, 'daily_time', 25) or 25)
    events: list[dict[str, Any]] = [
        {
            'type': 'RunStarted',
            'runId': run_id,
            'threadId': f'tutor-conversation-{conversation_id}',
            'timestamp': now_iso(),
            'title': '生成个性化学习响应',
        },
        {
            'type': 'StepStarted',
            'runId': run_id,
            'stepId': 'profile',
            'title': '加载学习画像',
            'summary': '读取阶段、薄弱点、学习偏好和每日可用时间',
            'timestamp': now_iso(),
        },
        {
            'type': 'ToolCallStart',
            'runId': run_id,
            'stepId': 'profile',
            'toolCallId': f'{run_id}-profile',
            'toolName': 'load_student_profile',
            'label': '加载学习画像',
            'timestamp': now_iso(),
        },
        {
            'type': 'ToolCallArgs',
            'runId': run_id,
            'stepId': 'profile',
            'toolCallId': f'{run_id}-profile',
            'args': {'userId': user_id, 'fields': ['stage', 'weak_points', 'preference', 'daily_time']},
            'timestamp': now_iso(),
        },
        {
            'type': 'ToolCallResult',
            'runId': run_id,
            'stepId': 'profile',
            'toolCallId': f'{run_id}-profile',
            'status': 'done',
            'summary': '已读取阶段、薄弱点、偏好和每日可用时间',
            'data': {
                'stage': current_stage,
                'weakPoint': weak_point,
                'preference': preference,
                'dailyTime': daily_time,
            },
            'timestamp': now_iso(),
        },
        {
            'type': 'StepFinished',
            'runId': run_id,
            'stepId': 'profile',
            'status': 'done',
            'summary': f'画像加载完成：{current_stage} · {weak_point}',
            'timestamp': now_iso(),
        },
        {
            'type': 'StepStarted',
            'runId': run_id,
            'stepId': 'intent',
            'title': '分析本轮学习意图',
            'summary': '基于请求参数判断模式、输出形态和可用上下文',
            'timestamp': now_iso(),
        },
        {
            'type': 'StateDelta',
            'runId': run_id,
            'stepId': 'intent',
            'delta': {'profileContextLoaded': True},
            'summary': '已完成本轮请求上下文整理',
            'timestamp': now_iso(),
        },
        {
            'type': 'StepFinished',
            'runId': run_id,
            'stepId': 'intent',
            'status': 'done',
            'summary': '学习意图分析完成',
            'timestamp': now_iso(),
        },
    ]
    if include_a2ui_sync:
        events.extend(
            [
                {
                    'type': 'StepStarted',
                    'runId': run_id,
                    'stepId': 'a2ui_sync',
                    'title': '同步 A2UI 个性化面板',
                    'summary': '将个性化任务、媒体入口和下一步动作渲染成可交互 UI',
                    'timestamp': now_iso(),
                },
                {
                    'type': 'StepFinished',
                    'runId': run_id,
                    'stepId': 'a2ui_sync',
                    'status': 'done',
                    'summary': 'A2UI 面板已生成',
                    'timestamp': now_iso(),
                },
            ],
        )
    if include_run_finished:
        events.append(
            {
                'type': 'RunFinished',
                'runId': run_id,
                'status': 'done',
                'summary': '个性化调用过程完成',
                'timestamp': now_iso(),
            },
        )
    return events


def _build_agui_a2ui_sync_events(conversation_id: int) -> list[dict[str, Any]]:
    run_id = f"sparklearn-tutor-run-{conversation_id}"
    return [
        {
            'type': 'StepStarted',
            'runId': run_id,
            'stepId': 'a2ui_sync',
            'title': '同步 A2UI 个性化面板',
            'summary': '将真实工具结果和个性化任务渲染成可交互 UI',
            'timestamp': now_iso(),
        },
        {
            'type': 'StepFinished',
            'runId': run_id,
            'stepId': 'a2ui_sync',
            'status': 'done',
            'summary': 'A2UI 面板已生成',
            'timestamp': now_iso(),
        },
    ]


def _build_agui_run_finished_event(conversation_id: int) -> dict[str, Any]:
    return {
        'type': 'RunFinished',
        'runId': f"sparklearn-tutor-run-{conversation_id}",
        'status': 'done',
        'summary': '个性化调用过程完成',
        'timestamp': now_iso(),
    }


def _build_agui_tool_step_events(
    conversation_id: int,
    *,
    step_id: str,
    title: str,
    tool_name: str,
    args: dict[str, Any] | None = None,
    data: dict[str, Any] | None = None,
    summary: str = '',
    status: str = 'done',
) -> list[dict[str, Any]]:
    run_id = f"sparklearn-tutor-run-{conversation_id}"
    tool_call_id = f"{run_id}-{step_id}"
    normalized_status = 'error' if status == 'error' else 'done'
    events: list[dict[str, Any]] = [
        {
            'type': 'StepStarted',
            'runId': run_id,
            'stepId': step_id,
            'title': title,
            'summary': summary or '开始执行',
            'timestamp': now_iso(),
        },
        {
            'type': 'ToolCallStart',
            'runId': run_id,
            'stepId': step_id,
            'toolCallId': tool_call_id,
            'toolName': tool_name,
            'label': title,
            'timestamp': now_iso(),
        },
    ]
    if args is not None:
        events.append(
            {
                'type': 'ToolCallArgs',
                'runId': run_id,
                'stepId': step_id,
                'toolCallId': tool_call_id,
                'args': args,
                'timestamp': now_iso(),
            },
        )
    events.extend(
        [
            {
                'type': 'ToolCallResult',
                'runId': run_id,
                'stepId': step_id,
                'toolCallId': tool_call_id,
                'toolName': tool_name,
                'status': normalized_status,
                'summary': summary or ('执行失败' if normalized_status == 'error' else '执行完成'),
                'data': data or {},
                'timestamp': now_iso(),
            },
            {
                'type': 'StepFinished',
                'runId': run_id,
                'stepId': step_id,
                'status': normalized_status,
                'summary': summary or ('执行失败' if normalized_status == 'error' else '执行完成'),
                'timestamp': now_iso(),
            },
        ],
    )
    return events


def _build_agui_search_events(conversation_id: int, query: str, results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return _build_agui_tool_step_events(
        conversation_id,
        step_id='web_search',
        title='联网搜索',
        tool_name='tavily_search',
        args={'query': query},
        data={
            'result_count': len(results),
            'items': [
                {
                    'title': str(item.get('title', '')),
                    'url': str(item.get('url', '')),
                    'score': item.get('score'),
                }
                for item in results[:5]
            ],
        },
        summary=f'已获取 {len(results)} 条联网搜索结果',
    )


def _build_agui_file_context_events(conversation_id: int, file_sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return _build_agui_tool_step_events(
        conversation_id,
        step_id='file_context',
        title='检索上传资料',
        tool_name='retrieve_tutor_files',
        args={'topK': len(file_sources)},
        data={
            'source_count': len(file_sources),
            'sources': [
                {
                    'file_id': item.get('file_id'),
                    'filename': str(item.get('filename') or item.get('name') or ''),
                    'score': item.get('score'),
                }
                for item in file_sources[:5]
            ],
        },
        summary=f'已命中 {len(file_sources)} 个上传资料片段',
    )


def _build_agui_trust_events(
    conversation_id: int,
    *,
    confidence: dict[str, Any],
    citations: list[dict[str, Any]],
    trust_meta: dict[str, Any],
) -> list[dict[str, Any]]:
    return _build_agui_tool_step_events(
        conversation_id,
        step_id='trust_answer',
        title='可信回答评估',
        tool_name='trust_answer_controller',
        args={'scene': 'tutor'},
        data={
            'confidence': confidence,
            'citation_count': len(citations),
            'reason_codes': trust_meta.get('reason_codes', []),
        },
        summary=f"可信度 {confidence.get('level', 'unknown')} · 引用 {len(citations)} 条",
    )


def _build_agui_workshop_events(
    conversation_id: int,
    *,
    phase: str,
    status: str,
    round_no: int | None = None,
    summary: str = '',
) -> list[dict[str, Any]]:
    suffix = f"_{round_no}" if round_no is not None else ''
    phase_label = '画像分析' if phase == 'profile_analysis' else '综合总结' if phase == 'synthesis' else f'第 {round_no} 轮'
    return _build_agui_tool_step_events(
        conversation_id,
        step_id=f'workshop_{phase}{suffix}',
        title=f'多智能体研讨：{phase_label}',
        tool_name='workshop_agents',
        args={'phase': phase, 'round': round_no},
        data={'phase': phase, 'round': round_no, 'status': status},
        summary=summary or phase_label,
        status=status,
    )


def _build_agui_image_generation_events(
    conversation_id: int,
    *,
    prompt: str,
    width: int,
    height: int,
    status: str = 'done',
) -> list[dict[str, Any]]:
    return _build_agui_tool_step_events(
        conversation_id,
        step_id='image_generation',
        title='图片生成',
        tool_name='xfyun_tti',
        args={'prompt': prompt, 'width': width, 'height': height},
        data={'width': width, 'height': height},
        summary='图片生成失败' if status == 'error' else '图片生成完成',
        status=status,
    )


def _build_agui_answer_generation_events(
    conversation_id: int,
    *,
    mode: str,
    model: str,
    answer: str,
) -> list[dict[str, Any]]:
    run_id = f"sparklearn-tutor-run-{conversation_id}"
    return [
        {
            'type': 'StepStarted',
            'runId': run_id,
            'stepId': 'answer_generation',
            'title': '生成回答',
            'summary': '开始接收模型输出',
            'timestamp': now_iso(),
        },
        {
            'type': 'StateDelta',
            'runId': run_id,
            'stepId': 'answer_generation',
            'delta': {'mode': mode, 'model': model, 'answer_length': len(answer or '')},
            'summary': '模型输出已汇总',
            'timestamp': now_iso(),
        },
        {
            'type': 'StepFinished',
            'runId': run_id,
            'stepId': 'answer_generation',
            'status': 'done',
            'summary': '回答生成完成',
            'timestamp': now_iso(),
        },
    ]


def _extract_task_card_topic(message: str) -> str:
    topic = re.sub(r'(帮我|请|安排|生成|做成|制作|一个|一份|本周|今日|学习计划|学习任务卡|任务卡|多张|多胞胎)', '', message or '')
    topic = re.sub(r'[,，。.!！?？、\s]+', ' ', topic).strip()
    return topic[:24] or '当前主题'


def _profile_value(profile: dict[str, Any] | None, key: str, default: Any) -> Any:
    if not isinstance(profile, dict):
        return default
    return profile.get(key, default)


def _first_text(values: Any, default: str) -> str:
    if isinstance(values, list):
        for item in values:
            text = str(item or '').strip()
            if text:
                return text
    text = str(values or '').strip()
    return text or default


def _build_a2ui_task_card_events(
    message: str,
    answer: str,
    conversation_id: int,
    *,
    ui_only: bool = False,
    profile: dict[str, Any] | None = None,
    generated_resources: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    topic = _extract_task_card_topic(message)
    surface_id = f"sparklearn-task-cards-{conversation_id}"
    learner_name = str(_profile_value(profile, 'name', '学习者') or '学习者')
    weak_point = _first_text(_profile_value(profile, 'weak_points', []), '当前主题实践')
    preference = _first_text(_profile_value(profile, 'learning_preference', []), '直观讲解')
    current_stage = str(_profile_value(profile, 'current_stage', '') or _profile_value(profile, 'knowledge_level', '') or '学习推进中')
    daily_time = int(_profile_value(profile, 'daily_time', 25) or 25)
    resource_items = [item for item in (generated_resources or []) if isinstance(item, dict)]
    resource_tasks = []
    for index, item in enumerate(resource_items[:3]):
        resource_type = str(item.get('type') or 'resource')
        resource_title = str(item.get('title') or f'{topic} 资源')
        resource_href = str(item.get('href') or item.get('source_url') or '/generate')
        resource_tasks.append(
            {
                'id': f'{surface_id}-resource-{index + 1}',
                'title': f'学习真实资源：{resource_title}',
                'description': str(item.get('excerpt') or f'基于资源库中已存在的“{resource_title}”继续学习。')[:180],
                'durationMinutes': min(max(daily_time, 15), 45),
                'difficulty': '推荐',
                'media': {
                    'type': resource_type,
                    'title': resource_title,
                    'description': '来自本轮真实资源上下文。',
                    'label': str(item.get('type_label') or '资源'),
                    'href': resource_href,
                },
                'resources': ['真实资源库', resource_title],
                'actions': [
                    {'name': 'open_media', 'label': '打开资源'},
                    {'name': 'add_to_path', 'label': '加入学习路径'},
                    {'name': 'complete_task', 'label': '标记完成'},
                ],
            },
        )
    tasks = resource_tasks or [
        {
            'id': f'{surface_id}-concept',
            'title': '夯实核心概念',
            'description': f'围绕“{topic}”梳理关键概念、术语和常见误区。这是系统根据本轮问题生成的建议任务，不代表已有资源。',
            'durationMinutes': 25,
            'difficulty': '入门',
            'media': {
                'type': 'document',
                'title': f'{topic} 学习建议',
                'description': '建议创建笔记沉淀概念、例子和易错点。',
                'label': '建议',
                'href': '/knowledge',
            },
            'resources': ['建议任务', '本轮对话'],
            'actions': [
                {'name': 'complete_task', 'label': '标记完成'},
                {'name': 'open_media', 'label': '打开资料'},
                {'name': 'add_to_path', 'label': '加入学习路径'},
            ],
        },
        {
            'id': f'{surface_id}-practice',
            'title': '完成针对练习',
            'description': f'基于“{topic}”做 5 道小题或 1 个小实验。这是建议动作，需进入练习中心后生成或选择真实题目。',
            'durationMinutes': 35,
            'difficulty': '进阶',
            'media': {
                'type': 'quiz',
                'title': f'{topic} 练习建议',
                'description': '进入练习中心后生成或选择真实题目。',
                'label': '建议',
                'href': '/practice',
            },
            'resources': ['建议任务', '练习中心'],
            'actions': [
                {'name': 'complete_task', 'label': '标记完成'},
                {'name': 'open_media', 'label': '开始练习'},
                {'name': 'add_to_path', 'label': '加入学习路径'},
            ],
        },
        {
            'id': f'{surface_id}-review',
            'title': '复盘并形成下一步',
            'description': '用三句话总结今天的收获、卡点和下一次学习动作，让学习画像能持续更新。',
            'durationMinutes': 15,
            'difficulty': '巩固',
            'media': {
                'type': 'video',
                'title': f'{topic} 复盘建议',
                'description': '可在视频模块生成真实复盘视频。',
                'label': '建议',
                'href': '/video',
            },
            'resources': ['建议任务', '学习报告', '本轮对话'],
            'actions': [
                {'name': 'complete_task', 'label': '标记完成'},
                {'name': 'open_media', 'label': '打开视频'},
                {'name': 'add_to_path', 'label': '加入学习路径'},
            ],
        },
    ]
    return [
        {
            'createSurface': {
                'protocol': 'a2ui',
                'version': '0.9.1',
                'surfaceId': surface_id,
                'catalogId': 'sparklearn.task_cards.v1',
                'title': f'{topic} 个性化学习行动面板' if ui_only else f'{topic} 学习任务卡',
            },
        },
        {
            'updateDataModel': {
                'surfaceId': surface_id,
                'path': '/',
                'value': {
                    'uiOnly': bool(ui_only),
                    'sourceKind': 'generated_resources' if resource_tasks else 'suggested_tasks',
                    'learner': {
                        'name': learner_name,
                        'stage': current_stage,
                        'weakPoint': weak_point,
                        'preference': preference,
                        'dailyTime': daily_time,
                    },
                    'nextAction': {
                        'title': '先完成最适合你的下一步',
                        'description': f'根据你的薄弱点“{weak_point}”和偏好“{preference}”，建议先用 {min(daily_time, 25)} 分钟完成一个可验证动作。',
                        'media': {
                            'type': 'video' if '视频' in preference else 'document',
                            'title': f'{topic} 个性化讲解',
                            'description': '先用你偏好的方式理解，再进入练习。',
                            'label': '推荐',
                            'href': '/video' if '视频' in preference else '/knowledge',
                        },
                    },
                    'summary': (answer or '').strip()[:180],
                    'tasks': tasks,
                },
            },
        },
        {
            'updateComponents': {
                'surfaceId': surface_id,
                'components': [
                    {
                        'id': 'task-cards',
                        'component': 'PersonalizedLearningPanel' if ui_only else 'SparkTaskCards',
                        'dataPath': '/',
                    },
                ],
            },
        },
    ]


def _build_mcp_tools_prompt(user_id: str) -> str:
    """查询已启用的 MCP 服务，构建工具描述文本用于注入 system prompt。"""
    rows = _get_available_mcp_services(user_id)
    if not rows:
        return ""

    lines = ["<mcp_available_tools>", "以下 MCP 工具可供调用："]
    for row in rows:
        name = row["name"] or "未命名服务"
        desc = row["description"] or ""
        transport = row["transport"] or "stdio"
        tool_desc = f"- 服务「{name}」({transport})"
        if desc:
            tool_desc += f"：{desc}"
        lines.append(tool_desc)
    lines.append("当需要调用以上工具时，请在思考中使用它们的功能辅助回答。</mcp_available_tools>")
    return "\n".join(lines)


async def _maybe_call_mcp_tools(user_id: str, question: str) -> tuple[str, list[dict[str, Any]]]:
    """Run enabled MCP tools that can be selected deterministically from the user question."""
    context_blocks: list[str] = []
    calls: list[dict[str, Any]] = []
    async for event in _iter_mcp_tool_call_events(user_id, question):
        call = dict(event)
        result_context = str(call.pop("result_context", "") or "")
        if result_context:
            context_blocks.append(result_context)
        if call.get("status") in {"done", "error"}:
            calls.append(call)
    return ("\n\n".join(context_blocks), calls)


async def _iter_mcp_tool_call_events(user_id: str, question: str) -> AsyncGenerator[dict[str, Any], None]:
    """Yield MCP call progress events and final result context for this question."""
    if not question.strip():
        return

    services = _get_available_mcp_services(user_id)
    if not services:
        return

    for service in services:
        discover_event = {
            "service_id": str(service["id"]),
            "service_name": str(service["name"] or ""),
            "tool_name": "tools/list",
            "args": {},
            "status": "discovering",
            "ok": False,
            "error": "",
        }
        yield discover_event
        try:
            tools_result = await _mcp_request(service, "tools/list", {})
            tools = tools_result.get("tools", [])
        except Exception as exc:
            yield {**discover_event, "status": "error", "error": str(exc)}
            continue
        yield {**discover_event, "status": "done", "ok": True}

        for tool in tools if isinstance(tools, list) else []:
            if not isinstance(tool, dict):
                continue
            tool_name = str(tool.get("name") or "")
            tool_desc = str(tool.get("description") or "")
            args = _infer_mcp_tool_args(question, tool_name, tool_desc)
            if args is None:
                continue

            call_info = {
                "service_id": str(service["id"]),
                "service_name": str(service["name"] or ""),
                "tool_name": tool_name,
                "args": args,
                "ok": False,
                "status": "running",
                "error": "",
            }
            yield call_info
            try:
                result = await _mcp_request(
                    service,
                    "tools/call",
                    {"name": tool_name, "arguments": args},
                )
                call_info["ok"] = True
                call_info["status"] = "done"
                call_info["result_preview"] = _compact_mcp_result(result)[:500]
                call_info["result_context"] = (
                    f"工具: {service['name']} / {tool_name}\n"
                    f"参数: {json.dumps(args, ensure_ascii=False)}\n"
                    f"结果:\n{_compact_mcp_result(result)}"
                )
            except Exception as exc:
                call_info["status"] = "error"
                call_info["error"] = str(exc)
            yield call_info

            # 当前一轮只自动调用一个确定匹配的工具，避免重复/误调用。
            return


def _get_available_mcp_services(user_id: str):
    """返回当前用户可用的 MCP 服务；系统内置 MCP 对所有正式用户全局可见。"""
    _ensure_builtin_mcp_services()
    return fetch_all(
        """
        SELECT *
        FROM mcp_services
        WHERE enabled = 1
          AND last_status = 'online'
          AND (owner_id = ? OR source = 'system')
        ORDER BY
          CASE WHEN source = 'system' THEN 0 ELSE 1 END,
          updated_at DESC
        """,
        (user_id,),
    )


def _infer_mcp_tool_args(question: str, tool_name: str, tool_desc: str) -> dict[str, Any] | None:
    text = question.strip()
    haystack = f"{tool_name}\n{tool_desc}".lower()
    is_weather_tool = "weather" in haystack or "天气" in tool_desc or tool_name == "get_weather"
    asks_weather = any(x in text.lower() for x in ["天气", "气温", "温度", "下雨", "预报", "weather"])
    asks_lookup = any(x in text for x in ["查", "查询", "查找", "搜索", "找一下", "看看", "看一下", "帮我"])
    if is_weather_tool and asks_weather:
        city = _extract_weather_city(text)
        return {"city": city} if city else {}
    if tool_name == "get_weather" and asks_lookup:
        city = _extract_weather_city(text)
        return {"city": city} if city else {}
    return None


def _extract_weather_city(question: str) -> str:
    text = str(question or "")
    for marker in [
        "用户已生成资源库上下文",
        "资源库上下文",
        "资源推荐或学习建议时优先引用",
        "只引用下列真实存在",
        "<mcp_available_tools>",
    ]:
        idx = text.find(marker)
        if idx >= 0:
            text = text[:idx]
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[，。！？,.!?；;：:\n\r\t]", " ", text)
    for token in [
        "get_weather", "weather_query",
        "帮我", "请", "查询", "查找", "查一下", "查", "看一下", "看看", "告诉我", "一下",
        "今天", "明天", "后天", "现在", "当前", "实时", "的", "天气", "气温", "温度", "预报",
        "weather", "forecast", " in ", " for ",
    ]:
        text = text.replace(token, " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:40]


def _compact_mcp_result(result: Any) -> str:
    if isinstance(result, dict):
        content = result.get("content")
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    parts.append(str(item.get("text") or item.get("content") or ""))
            text = "\n".join(x for x in parts if x.strip())
            if text:
                return _strip_ansi(text).strip()
        if "result" in result:
            return _strip_ansi(str(result.get("result", ""))).strip()
    return _strip_ansi(json.dumps(result, ensure_ascii=False, default=str)).strip()


def _strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", text or "")


def _is_image_mode(mode: str) -> bool:
    return (mode or '').strip().lower() == 'image_gen'


def _resolve_effective_file_ids(conversation_id: int, requested_file_ids: list[int]) -> list[int]:
    return [int(x) for x in (requested_file_ids or []) if int(x) > 0]


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
async def list_roles(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    rows = fetch_all(
        """
        SELECT id, name, persona, background, style_guide, rules, enabled, created_at, updated_at
        FROM tutor_roles
        WHERE user_id = ?
        ORDER BY updated_at DESC
        """,
        (user_id,),
    )
    return ok([_role_row_to_dict(r) for r in rows])


@router.post('/tutor/roles')
async def create_role(req: CreateRoleReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    ts = now_iso()
    role_id = _execute_returning_id(
        """
        INSERT INTO tutor_roles(user_id, name, persona, background, style_guide, rules, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            user_id,
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
async def update_role(role_id: int, req: UpdateRoleReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = fetch_one('SELECT * FROM tutor_roles WHERE id = ? AND user_id = ?', (role_id, user_id))
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
            user_id,
        ),
    )

    updated = fetch_one(
        'SELECT id, name, persona, background, style_guide, rules, enabled, created_at, updated_at FROM tutor_roles WHERE id = ?',
        (role_id,),
    )
    return ok(_role_row_to_dict(updated))


@router.delete('/tutor/roles/{role_id}')
async def delete_role(role_id: int, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    another = fetch_one(
        """
        SELECT id FROM tutor_roles
        WHERE user_id = ? AND id <> ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (user_id, role_id),
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
            (user_id, ts, ts),
        )

    execute(
        """
        UPDATE tutor_conversations
        SET role_id = ?, updated_at = ?
        WHERE user_id = ? AND role_id = ?
        """,
        (fallback_role_id, now_iso(), user_id, role_id),
    )
    execute('DELETE FROM tutor_roles WHERE id = ? AND user_id = ?', (role_id, user_id))
    return ok({'deleted': True})


class OptimizePromptReq(BaseModel):
    field: str  # persona, background, style_guide, rules
    content: str
    role_name: str = ''


class GenerateRoleReq(BaseModel):
    question: str


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


async def _collect_llm_text(prompt: str, mode: str = 'general', model: str = '') -> str:
    result_text = ''
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode=mode, history=[], model=model):
        if evt_type == 'text':
            result_text += str(payload.get('content', ''))
    return result_text.strip()


def _json_from_text(text: str) -> dict[str, Any]:
    raw = (text or '').strip()
    if not raw:
        return {}
    fenced = re.search(r'```(?:json)?\s*(.*?)```', raw, flags=re.S)
    if fenced:
        raw = fenced.group(1).strip()
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except Exception:
        match = re.search(r'\{.*\}', raw, flags=re.S)
        if not match:
            return {}
        try:
            value = json.loads(match.group(0))
            return value if isinstance(value, dict) else {}
        except Exception:
            return {}


def _join_profile_list(value: Any, default: str = '') -> str:
    if isinstance(value, list):
        text = '、'.join(str(item).strip() for item in value if str(item).strip())
        return text or default
    text = str(value or '').strip()
    return text or default


def _analyze_role_request(question: str, profile: dict[str, Any] | None) -> dict[str, str]:
    profile = profile or {}
    subject = '通用学习'
    if '函数' in question:
        subject = '函数'
    elif 'Python' in question or 'python' in question.lower():
        subject = 'Python'
    intent = '个性化辅导'
    archetype = '陪伴型'
    if any(term in question for term in ['提分', '快速补', '补']):
        intent = '提分强化'
        archetype = '提分型'
    elif any(term in question for term in ['入门', '基础', '零基础']):
        intent = '基础入门'
        archetype = '讲解型'
    return {
        'subject_label': subject,
        'intent_label': intent,
        'archetype': archetype,
        'stage': str(profile.get('current_stage') or profile.get('knowledge_level') or '当前阶段'),
        'goals': _join_profile_list(profile.get('goal'), '当前学习目标'),
        'weak_points': _join_profile_list(profile.get('weak_points'), '待定位薄弱点'),
        'preference': _join_profile_list(profile.get('learning_preference'), '循序渐进讲解'),
    }


def _load_profile_snapshot_for_role_generation(user_id: str) -> dict[str, Any]:
    try:
        return _load_profile_snapshot(user_id)
    except TypeError:
        return _load_profile_snapshot()  # type: ignore[call-arg]


async def _generate_role_from_question(user_id: str, question: str | None = None) -> dict[str, str]:
    if question is None:
        question = user_id
        user_id = settings.single_user_id
    clean_question = ' '.join((question or '').split())[:200] or '创建一个学习导师'
    profile = _load_profile_snapshot_for_role_generation(user_id)
    analysis_prompt = (
        "请根据用户需求和学习画像输出结构化画像 JSON，不要输出解释。\n"
        f"用户需求：{clean_question}\n"
        f"学习画像：{json.dumps(profile, ensure_ascii=False)}\n"
        "字段：subject_label,intent_label,archetype,stage_hint,goals_hint,weak_points_hint,preference_hint"
    )
    ai_analysis = _json_from_text(await _collect_llm_text(analysis_prompt))
    fallback = _analyze_role_request(clean_question, profile)
    analysis = {
        'subject_label': str(ai_analysis.get('subject_label') or fallback['subject_label']),
        'intent_label': str(ai_analysis.get('intent_label') or fallback['intent_label']),
        'archetype': str(ai_analysis.get('archetype') or fallback['archetype']),
        'stage': str(ai_analysis.get('stage_hint') or fallback['stage']),
        'goals': str(ai_analysis.get('goals_hint') or fallback['goals']),
        'weak_points': str(ai_analysis.get('weak_points_hint') or fallback['weak_points']),
        'preference': str(ai_analysis.get('preference_hint') or fallback['preference']),
    }
    generation_prompt = (
        "请基于以下结构化分析生成 AI 学习导师角色 JSON，不要复述原始用户问题。\n"
        f"结构化分析：{json.dumps(analysis, ensure_ascii=False)}\n"
        "字段：name,role_identity,service_scenarios,workflow,output_format,prohibitions,sample_dialogue"
    )
    generated = _json_from_text(await _collect_llm_text(generation_prompt))
    name = str(generated.get('name') or f"{analysis['subject_label']}{analysis['archetype']}导师")
    role_identity = str(generated.get('role_identity') or f"你是{analysis['subject_label']}领域的{analysis['archetype']}导师，负责{analysis['intent_label']}。")
    service_scenarios = str(generated.get('service_scenarios') or f"适配{analysis['stage']}，围绕{analysis['goals']}展开。")
    workflow = str(generated.get('workflow') or f"1. 先定位薄弱点：{analysis['weak_points']}；2. 再按偏好：{analysis['preference']} 讲解；3. 最后给出练习。")
    output_format = str(generated.get('output_format') or '先结论，后步骤，再给一个可执行练习。')
    prohibitions = str(generated.get('prohibitions') or '不要直接跳过推理过程，不要给出与学习阶段无关的任务。')
    sample_dialogue = str(generated.get('sample_dialogue') or f"用户：我不会{analysis['subject_label']}。\n导师：先看一个最小例子，再总结规律。")
    return {
        'name': name[:40] or '个性化学习导师',
        'persona': f"角色身份：{role_identity}\n服务场景：{service_scenarios}",
        'background': f"专属工作流：{workflow}",
        'style_guide': f"输出格式：{output_format}",
        'rules': f"禁止事项：{prohibitions}\n\n示例对话（2-3 轮短示例）：\n{sample_dialogue}",
    }


@router.post('/tutor/roles/generate-from-question')
async def generate_role_from_question(req: GenerateRoleReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"] if isinstance(current_user, dict) else settings.single_user_id
    try:
        role = await _generate_role_from_question(user_id, req.question)
    except TypeError:
        role = await _generate_role_from_question(req.question)  # type: ignore[call-arg]
    ts = now_iso()
    role_id = _execute_returning_id(
        """
        INSERT INTO tutor_roles(user_id, name, persona, background, style_guide, rules, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            user_id,
            role.get('name') or '个性化学习导师',
            role.get('persona') or '',
            role.get('background') or '',
            role.get('style_guide') or '',
            role.get('rules') or '',
            ts,
            ts,
        ),
    )
    row = fetch_one(
        'SELECT id, name, persona, background, style_guide, rules, enabled, created_at, updated_at FROM tutor_roles WHERE id = ?',
        (role_id,),
    )
    return ok(_role_row_to_dict(row))


@router.get('/tutor/conversations')
async def list_conversations(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
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
        (user_id, user_id),
    )
    return ok([dict(r) for r in rows])


@router.post('/tutor/conversations')
async def create_conversation(req: CreateConversationReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    role_id = req.role_id or _default_role_id(user_id)
    ts = now_iso()
    conv_id = _execute_returning_id(
        """
        INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, role_id, (req.title or '新对话')[:80], ts, ts),
    )
    row = fetch_one(
        'SELECT id, role_id, title, created_at, updated_at, 0 AS message_count FROM tutor_conversations WHERE id = ?',
        (conv_id,),
    )
    return ok(dict(row))


@router.put('/tutor/conversations/{conversation_id}')
async def update_conversation(conversation_id: int, req: UpdateConversationReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = fetch_one(
        'SELECT * FROM tutor_conversations WHERE id = ? AND user_id = ?',
        (conversation_id, user_id),
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
            int(data.get('role_id') or _default_role_id(user_id)),
            str(data.get('title') or '新对话')[:80],
            now_iso(),
            conversation_id,
            user_id,
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
        (user_id, conversation_id),
    )
    return ok(dict(updated))


@router.delete('/tutor/conversations/{conversation_id}')
async def delete_conversation(conversation_id: int, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    execute('DELETE FROM tutor_messages WHERE conversation_id = ? AND user_id = ?', (conversation_id, user_id))
    execute('DELETE FROM tutor_conversations WHERE id = ? AND user_id = ?', (conversation_id, user_id))
    return ok({'deleted': True})


@router.get('/tutor/messages')
async def tutor_messages(conversation_id: int, limit: int = 100, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    rows = fetch_all(
        """
        SELECT id, conversation_id, sender_role, content, file_ids, created_at
        FROM tutor_messages
        WHERE user_id = ? AND conversation_id = ?
        ORDER BY id ASC
        LIMIT ?
        """,
        (user_id, conversation_id, max(1, min(limit, 500))),
    )
    return ok([_message_row_to_dict(r, user_id) for r in rows])


@router.delete('/tutor/messages/{message_id}')
async def delete_tutor_message(message_id: int, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    row = fetch_one(
        'SELECT id, conversation_id FROM tutor_messages WHERE id = ? AND user_id = ?',
        (message_id, user_id),
    )
    if not row:
        return fail('message not found')

    conversation_id = int(row['conversation_id'])
    execute('DELETE FROM tutor_messages WHERE id = ? AND user_id = ?', (message_id, user_id))
    execute(
        'UPDATE tutor_conversations SET updated_at = ? WHERE id = ? AND user_id = ?',
        (now_iso(), conversation_id, user_id),
    )
    return ok({'deleted': True, 'conversation_id': conversation_id})


@router.post('/tutor/files')
async def upload_tutor_file(files: list[UploadFile] = File(...), current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    saved: list[dict[str, Any]] = []
    uploads_dir = settings.data_dir / 'users' / user_id / 'uploads'
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
                user_id,
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


@router.post('/tutor/files/web-capture')
async def import_web_capture(req: WebCaptureReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    text = _clean_web_material_text(req.text or req.excerpt)
    if not text:
        return fail('网页正文为空，无法保存到我的资料')

    title = _clean_web_material_title(req.title, req.url)
    uploads_dir = settings.data_dir / 'users' / user_id / 'uploads'
    uploads_dir.mkdir(parents=True, exist_ok=True)
    ts = now_iso()
    raw = text.encode('utf-8')
    analysis = await _analyze_web_material(title, req.url, text)

    file_id = _execute_returning_id(
        """
        INSERT INTO tutor_files(
          user_id, filename, stored_path, mime_type, size_bytes,
          source_type, source_url, status, analysis_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            title,
            '',
            'text/plain; charset=utf-8',
            len(raw),
            'web_capture',
            req.url.strip(),
            'ready',
            json.dumps(analysis, ensure_ascii=False),
            ts,
            ts,
        ),
    )

    stored_path = uploads_dir / f'{file_id}_{uuid.uuid4().hex[:8]}_web.txt'
    stored_path.write_text(text, encoding='utf-8')
    execute('UPDATE tutor_files SET stored_path = ? WHERE id = ?', (str(stored_path), file_id))
    await _index_tutor_file(file_id=file_id, stored_path=stored_path, filename=title + '.txt', mime_type='text/plain')
    row = fetch_one('SELECT * FROM tutor_files WHERE id = ? AND user_id = ?', (file_id, user_id))
    append_jsonl(user_id, 'web_material_imports.jsonl', {'file_id': file_id, 'title': title, 'url': req.url.strip(), 'created_at': ts})
    return ok(_tutor_file_row_to_dict(row, include_content=True))


@router.get('/tutor/files')
async def list_tutor_files(current_user: dict = Depends(get_current_user)):
    """列出用户上传过的所有文件"""
    rows = fetch_all(
        "SELECT * FROM tutor_files WHERE user_id = ? AND COALESCE(source_type, 'upload') != 'web_capture' ORDER BY created_at DESC",
        (current_user["user_id"],),
    )
    return ok([_tutor_file_row_to_dict(r) for r in rows])


@router.get('/tutor/files/{file_id}')
async def get_tutor_file(file_id: int, current_user: dict = Depends(get_current_user)):
    row = fetch_one('SELECT * FROM tutor_files WHERE id = ? AND user_id = ?', (file_id, current_user["user_id"]))
    if not row:
        raise HTTPException(status_code=404, detail='文件不存在')
    return ok(_tutor_file_row_to_dict(row, include_content=True))


@router.delete('/tutor/files/{file_id}')
async def delete_tutor_file(file_id: int, current_user: dict = Depends(get_current_user)):
    """删除一个上传的文件"""
    user_id = current_user["user_id"]
    row = fetch_one('SELECT id, stored_path FROM tutor_files WHERE id = ? AND user_id = ?', (file_id, user_id))
    if not row:
        raise HTTPException(status_code=404, detail='文件不存在')
    stored = Path(row['stored_path'])
    if stored.exists():
        stored.unlink()
    execute('DELETE FROM tutor_file_chunks WHERE file_id = ?', (file_id,))
    execute('DELETE FROM tutor_files WHERE id = ? AND user_id = ?', (file_id, user_id))
    return ok({'deleted': True})


@router.post('/tutor/chat')
async def tutor_chat(req: TutorReq, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    conversation_id = req.conversation_id or _create_tutor_conversation(user_id, role_id=req.role_id)
    role_id = req.role_id or _role_id_for_conversation(user_id, conversation_id) or _default_role_id(user_id)
    role = fetch_one(
        'SELECT id, name, persona, background, style_guide, rules FROM tutor_roles WHERE id = ? AND user_id = ?',
        (role_id, user_id),
    )
    role_prompt = _build_role_prompt(dict(role) if role else None)

    async def gen() -> AsyncGenerator[tuple[str, dict], None]:
        before_count_row = fetch_one(
            """
            SELECT COUNT(1) AS cnt
            FROM tutor_messages
            WHERE user_id = ? AND conversation_id = ? AND sender_role = 'user'
            """,
            (user_id, conversation_id),
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
                user_id,
                req.message,
                json.dumps(effective_file_ids, ensure_ascii=False),
                now_iso(),
            ),
        )

        execute(
            'UPDATE tutor_conversations SET updated_at = ? WHERE id = ? AND user_id = ?',
            (now_iso(), conversation_id, user_id),
        )

        if before_user_count == 0:
            title = await _generate_conversation_title(req.message)
            execute(
                "UPDATE tutor_conversations SET title = ? WHERE id = ? AND user_id = ? AND title = '新对话'",
                (title, conversation_id, user_id),
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
            (user_id, conversation_id),
        )

        page_prompt = _build_page_context_prompt(req.page_context)
        memory_prompt = build_injected_context(user_id, req.message, top_k=8)
        file_context, file_sources = await _retrieve_tutor_file_context(user_id, effective_file_ids, req.message)
        file_prompt = ''
        if file_context:
            file_prompt = f"以下是用户上传文件检索到的相关片段，请优先基于这些证据回答：\n{file_context}"
            yield ('sources', {'items': file_sources})
        mcp_prompt = _build_mcp_tools_prompt(user_id) if req.mcp_enabled else ""
        merged_system_prompt = "\n\n".join(p for p in [role_prompt, page_prompt, memory_prompt] if p)
        if file_prompt:
            merged_system_prompt = "\n\n".join(p for p in [merged_system_prompt, file_prompt] if p)
        if mcp_prompt:
            merged_system_prompt = "\n\n".join(p for p in [merged_system_prompt, mcp_prompt] if p)
        history_for_model = [{'role': 'system', 'content': merged_system_prompt}] if merged_system_prompt else []
        for row in reversed(rows):
            model_role = 'assistant' if row['sender_role'] == 'assistant' else 'user'
            history_for_model.append({'role': model_role, 'content': row['content']})

        # 联网搜索：在调用 LLM 之前执行 Tavily 搜索并将结果注入 system prompt
        # 知识逆构模式自行处理多角度搜索，此处跳过避免重复
        search_results: list[dict[str, Any]] = []
        effective_mode = _effective_mode(req)
        effective_web_search = _effective_web_search(req)
        effective_model = _effective_model(req)
        a2ui_events = []
        a2ui_ui_only = _should_use_a2ui_ui_only(req, effective_mode)
        profile_for_a2ui = req.page_context.get('student_profile') if isinstance(req.page_context, dict) and isinstance(req.page_context.get('student_profile'), dict) else None
        resources_for_a2ui = req.page_context.get('generated_resources') if isinstance(req.page_context, dict) and isinstance(req.page_context.get('generated_resources'), list) else []
        profile_for_process = profile_for_a2ui or _load_profile_snapshot(user_id)
        should_emit_a2ui = a2ui_ui_only or _should_emit_a2ui_task_cards(req.message, effective_mode)
        agui_events = _build_agui_process_events(
            conversation_id,
            user_id=user_id,
            profile=profile_for_process,
            include_run_finished=False,
        ) if effective_mode == 'knowledge_qa' else []
        for event in agui_events:
            yield ('agui', event)

        if file_sources:
            file_agui_events = _build_agui_file_context_events(conversation_id, file_sources)
            agui_events.extend(file_agui_events)
            for event in file_agui_events:
                yield ('agui', event)

        if effective_web_search and req.message.strip() and effective_mode != 'knowledge_reverse':
            search_results = search_web(req.message.strip())
        if search_results:
            yield ('search_results', {'items': search_results})
            search_agui_events = _build_agui_search_events(conversation_id, req.message.strip(), search_results)
            agui_events.extend(search_agui_events)
            for event in search_agui_events:
                yield ('agui', event)
            search_prompt = format_search_results(search_results)
            if history_for_model and history_for_model[0]['role'] == 'system':
                history_for_model[0]['content'] = search_prompt + "\n\n" + history_for_model[0]['content']
            else:
                history_for_model.insert(0, {'role': 'system', 'content': search_prompt})

        mcp_context = ""
        mcp_calls_payload: list[dict[str, Any]] = []
        if req.mcp_enabled and req.message.strip():
            mcp_context_blocks: list[str] = []
            async for item in _iter_mcp_tool_call_events(user_id, req.message):
                result_context = str(item.get('result_context') or '')
                if result_context:
                    mcp_context_blocks.append(result_context)
                if item.get('status') in {'done', 'error'} and item.get('tool_name') != 'tools/list':
                    mcp_calls_payload.append(dict(item))
                yield (
                    'mcp_call',
                    {
                        'service_id': str(item.get('service_id', '')),
                        'service_name': str(item.get('service_name', '')),
                        'tool_name': str(item.get('tool_name', '')),
                        'args': item.get('args') if isinstance(item.get('args'), dict) else {},
                        'ok': bool(item.get('ok', False)),
                        'status': str(item.get('status', 'running')),
                        'error': str(item.get('error', '')),
                        'result_preview': str(item.get('result_preview', '')),
                        'result_context': str(item.get('result_context', '')),
                    },
                )
            mcp_context = "\n\n".join(mcp_context_blocks)
            if mcp_context:
                mcp_result_prompt = (
                    "以下是本轮已实际调用 MCP 工具得到的结果。回答用户时必须优先基于这些结果，"
                    "不要声称没有调用工具，也不要再要求用户手动查询。\n"
                    f"{mcp_context}"
                )
                if history_for_model and history_for_model[0]['role'] == 'system':
                    history_for_model[0]['content'] = mcp_result_prompt + "\n\n" + history_for_model[0]['content']
                else:
                    history_for_model.insert(0, {'role': 'system', 'content': mcp_result_prompt})

        if should_emit_a2ui:
            sync_events = _build_agui_a2ui_sync_events(conversation_id) if effective_mode == 'knowledge_qa' else []
            agui_events.extend(sync_events)
            for event in sync_events:
                yield ('agui', event)
            a2ui_events = _build_a2ui_task_card_events(
                req.message,
                mcp_context,
                conversation_id,
                ui_only=a2ui_ui_only,
                profile=profile_for_process,
                generated_resources=resources_for_a2ui,
            )
            for envelope in a2ui_events:
                yield ('a2ui', envelope)

        if a2ui_ui_only:
            if agui_events:
                run_finished_event = _build_agui_run_finished_event(conversation_id)
                agui_events.append(run_finished_event)
                yield ('agui', run_finished_event)
            answer = ''
            assistant_id = _execute_returning_id(
                """
                INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, meta_json, created_at)
                VALUES (?, ?, 'assistant', ?, '[]', ?, ?)
                """,
                (
                    conversation_id,
                    user_id,
                    answer,
                    json.dumps(
                        {
                            'mode': effective_mode,
                            'a2ui_events': a2ui_events,
                            'a2ui_ui_only': True,
                            'agui_events': agui_events,
                            'mcp_enabled': bool(req.mcp_enabled),
                            'mcp_calls': mcp_calls_payload,
                            'open_mode': bool(req.open_mode),
                            'web_search': bool(effective_web_search),
                        },
                        ensure_ascii=False,
                    ),
                    now_iso(),
                ),
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
                        'a2ui_ui_only': True,
                    },
                    'a2ui_events': a2ui_events,
                    'a2ui_ui_only': True,
                    'agui_events': agui_events,
                },
            )
            return

        confidence_payload: dict[str, Any] = {}
        citations_payload: list[dict[str, Any]] = []
        trust_meta_payload: dict[str, Any] = {'mcp_calls': mcp_calls_payload} if mcp_calls_payload else {}

        if req.workshop_enabled:
            profile = _load_profile_snapshot(user_id)
            profile_summary = _profile_summary_text(profile)
            complexity = _estimate_question_complexity(req.message)
            rounds = _rounds_for_complexity(complexity)
            participants = _build_workshop_participants(user_id, req, role)

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
            profile_workshop_events = _build_agui_workshop_events(
                conversation_id,
                phase='profile_analysis',
                status='done',
                summary='画像分析完成',
            )
            agui_events.extend(profile_workshop_events)
            for event in profile_workshop_events:
                yield ('agui', event)

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
                discussion_events = _build_agui_workshop_events(
                    conversation_id,
                    phase='discussion',
                    status='done',
                    round_no=round_no,
                    summary=f'第 {round_no} 轮研讨完成',
                )
                agui_events.extend(discussion_events)
                for event in discussion_events:
                    yield ('agui', event)

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
            synthesis_events = _build_agui_workshop_events(
                conversation_id,
                phase='synthesis',
                status='done',
                summary='研讨结论综合完成',
            )
            agui_events.extend(synthesis_events)
            for event in synthesis_events:
                yield ('agui', event)
        else:
            if req.mode == 'knowledge_reverse':
                # 知识逆构模式：根据用户目标搜索内容 → 反推实现过程 → 配对真实资源
                yield ('meta', {'mode': 'knowledge_reverse', 'phase': 'searching'})
                search_queries = [
                    f"{req.message} 学习路线图 从入门到精通",
                    f"{req.message} 推荐学习资源 教程 书籍 课程",
                    f"{req.message} 实战项目 练习 案例分析",
                ]
                all_web_results: list[dict[str, Any]] = []
                for q in search_queries:
                    results = search_web(q, max_results=3)
                    all_web_results.extend(results)
                seen = set()
                deduped: list[dict[str, Any]] = []
                for r in all_web_results:
                    if r['url'] not in seen:
                        seen.add(r['url'])
                        deduped.append(r)
                deduped = deduped[:8]
                yield ('search_results', {'items': deduped})
                reverse_search_events = _build_agui_search_events(conversation_id, req.message.strip(), deduped)
                agui_events.extend(reverse_search_events)
                for event in reverse_search_events:
                    yield ('agui', event)
                reverse_prompt = _build_reverse_engineering_prompt(req.message, deduped, role_prompt)
                assistant_parts = []
                async for evt_type, payload in spark_lite.stream_chat_events(reverse_prompt, mode='knowledge_qa', history=[], model=effective_model):
                    if evt_type == 'text':
                        chunk = str(payload.get('content', ''))
                        if chunk:
                            assistant_parts.append(chunk)
                            yield ('text', {'content': chunk})
                    elif evt_type == 'error':
                        yield ('error', payload)
                answer = ''.join(assistant_parts).strip()
                if not answer:
                    answer = '知识逆构分析未能生成结果，请尝试更具体地描述你的学习目标。'
                    yield ('text', {'content': answer})
            elif _is_image_mode(effective_mode):
                image_b64 = await generate_image_base64(
                    prompt=req.message,
                    width=512,
                    height=512,
                    uid=user_id,
                )
                answer = f"![AI生成图](data:image/png;base64,{image_b64})"
                yield ('text', {'content': answer})
                image_events = _build_agui_image_generation_events(
                    conversation_id,
                    prompt=req.message,
                    width=512,
                    height=512,
                    status='done',
                )
                agui_events.extend(image_events)
                for event in image_events:
                    yield ('agui', event)
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
                        model=req.model,
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
                        user_id=user_id,
                        mode=effective_mode,
                        role_prompt=role_prompt,
                        page_prompt=page_prompt,
                        memory_prompt=memory_prompt,
                        mcp_prompt=mcp_context,
                        conversation_id=conversation_id,
                        file_ids=effective_file_ids,
                        knowledge_file_ids=_resolve_subject_knowledge_file_ids_for_tutor(user_id, req.knowledge_file_ids or []),
                        user_file_sources=file_sources,
                        web_search_results=search_results,
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
                if mcp_calls_payload:
                    trust_meta_payload['mcp_calls'] = mcp_calls_payload
                yield ('confidence', confidence_payload)
                yield ('trust_meta', trust_meta_payload)
                yield ('citations', {'items': citations_payload})
                trust_events = _build_agui_trust_events(
                    conversation_id,
                    confidence=confidence_payload,
                    citations=citations_payload,
                    trust_meta=trust_meta_payload,
                )
                agui_events.extend(trust_events)
                for event in trust_events:
                    yield ('agui', event)
                mcp_calls = trust_meta_payload.get('mcp_calls')
                if isinstance(mcp_calls, list) and not mcp_calls_payload:
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
                async for evt_type, payload in spark_lite.stream_chat_events(str(trust_plan['prompt']), mode=effective_mode, history=[], model=effective_model):
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
        if answer and not _is_image_mode(effective_mode):
            answer_agui_events = _build_agui_answer_generation_events(
                conversation_id,
                mode=effective_mode,
                model=effective_model,
                answer=answer,
            )
            agui_events.extend(answer_agui_events)
            for event in answer_agui_events:
                yield ('agui', event)
        if agui_events:
            run_finished_event = _build_agui_run_finished_event(conversation_id)
            agui_events.append(run_finished_event)
            yield ('agui', run_finished_event)
        assistant_id = _execute_returning_id(
            """
            INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, meta_json, created_at)
            VALUES (?, ?, 'assistant', ?, '[]', ?, ?)
            """,
            (
                conversation_id,
                user_id,
                answer,
                json.dumps(
                    {
                        'confidence': confidence_payload,
                        'citations': citations_payload,
                        'trust_meta': trust_meta_payload,
                        'open_mode': bool(req.open_mode),
                        'web_search': bool(effective_web_search),
                        'mcp_enabled': bool(req.mcp_enabled),
                        'mcp_calls': mcp_calls_payload,
                        'search_results': search_results,
                        'mode': effective_mode,
                        'a2ui_events': a2ui_events,
                        'agui_events': agui_events,
                    },
                    ensure_ascii=False,
                ),
                now_iso(),
            ),
        )

        append_jsonl(
            user_id,
            'learning_events.jsonl',
            {
                'type': 'tutor_chat',
                'conversation_id': conversation_id,
                'role_id': role_id,
                'question': req.message,
            },
        )
        memory_update = update_memory_from_turn(
            user_id=user_id,
            user_message=req.message,
            assistant_message=answer,
            page_context=req.page_context,
        )
        append_jsonl(
            user_id,
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
                'search_results': search_results,
                'confidence': confidence_payload,
                'citations': citations_payload,
                'trust_meta': trust_meta_payload,
                'a2ui_events': a2ui_events,
                'agui_events': agui_events,
            },
        )

    return StreamingResponse(
        sse_wrap(gen()),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


@router.get('/tutor/history')
async def tutor_history(limit: int = 20, conversation_id: int | None = None, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    if conversation_id is None:
        conversation_id = _ensure_default_conversation(user_id)

    rows = fetch_all(
        """
        SELECT id, sender_role, content, created_at, conversation_id, file_ids, meta_json
        FROM tutor_messages
        WHERE user_id = ? AND conversation_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (user_id, conversation_id, max(1, min(limit, 500))),
    )

    data = []
    for row in reversed(rows):
        files = _resolve_file_names(user_id, _parse_json_list(row['file_ids']))
        meta = _parse_json_dict(row['meta_json']) if 'meta_json' in row.keys() else {}
        trust_meta = meta.get('trust_meta') if isinstance(meta.get('trust_meta'), dict) else {}
        mcp_calls = meta.get('mcp_calls') if isinstance(meta.get('mcp_calls'), list) else trust_meta.get('mcp_calls')
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
                'trust_meta': trust_meta,
                'mcp_enabled': bool(meta.get('mcp_enabled', False)),
                'mcp_calls': mcp_calls if isinstance(mcp_calls, list) else [],
                'search_results': meta.get('search_results') if isinstance(meta.get('search_results'), list) else [],
                'a2ui_events': meta.get('a2ui_events') if isinstance(meta.get('a2ui_events'), list) else [],
                'a2ui_ui_only': bool(meta.get('a2ui_ui_only', False)),
                'agui_events': meta.get('agui_events') if isinstance(meta.get('agui_events'), list) else [],
                'open_mode': bool(meta.get('open_mode', False)),
            }
        )

    return ok(data)


@router.get('/evaluation/report')
async def get_evaluation_report(period: str = 'week', current_user: dict = Depends(get_current_user)):
    from .report_service import get_evaluation_report as _get_report

    return await _get_report(period, user_id=current_user["user_id"])


@router.post('/evaluation/refresh')
async def refresh_evaluation(req: EvalRefreshReq, current_user: dict = Depends(get_current_user)):
    from .report_service import get_evaluation_report as _get_report
    user_id = current_user["user_id"]

    summary = await spark_lite.summarize('函数与面向对象')
    report_resp = await _get_report(user_id=user_id)
    report = report_resp.data
    report['ai_summary'] = summary

    append_jsonl(user_id, 'learning_events.jsonl', {'type': 'evaluation_refresh', 'force': req.force})
    return ok({'message': '评估完成', 'report': report})


class AiSummaryReq(BaseModel):
    period: str = 'week'


@router.post('/report/ai-summary')
async def generate_report_ai_summary(req: AiSummaryReq, current_user: dict = Depends(get_current_user)):
    """Stream an AI-generated learning report summary via SSE."""
    period = req.period if req.period in {'day', 'week', 'month'} else 'week'
    user_id = current_user["user_id"]

    # Gather context data for the AI
    profile_row = fetch_one('SELECT * FROM profiles WHERE user_id = ?', (user_id,))
    mastery_rows = fetch_all(
        'SELECT knowledge_point_name, score, chapter FROM mastery_records WHERE user_id = ? ORDER BY score ASC LIMIT 5',
        (user_id,),
    )
    weak_points = [{'name': r['knowledge_point_name'], 'score': round(float(r['score']), 2)} for r in mastery_rows]

    period_labels = {'day': '今日', 'week': '本周', 'month': '本月'}
    period_label = period_labels.get(period, '本周')

    # Build stats context
    report_resp = await get_evaluation_report(period, current_user)
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


def _message_row_to_dict(row, user_id: str) -> dict[str, Any]:
    file_ids = _parse_json_list(row['file_ids'])
    meta = _parse_json_dict(row['meta_json']) if 'meta_json' in row.keys() else {}
    trust_meta = meta.get('trust_meta') if isinstance(meta.get('trust_meta'), dict) else {}
    mcp_calls = meta.get('mcp_calls') if isinstance(meta.get('mcp_calls'), list) else trust_meta.get('mcp_calls')
    return {
        'id': row['id'],
        'conversation_id': row['conversation_id'],
        'sender_role': row['sender_role'],
        'content': row['content'],
        'file_ids': file_ids,
        'file_names': _resolve_file_names(user_id, file_ids),
        'confidence': meta.get('confidence') if isinstance(meta.get('confidence'), dict) else None,
        'citations': meta.get('citations') if isinstance(meta.get('citations'), list) else [],
        'trust_meta': trust_meta,
        'mcp_enabled': bool(meta.get('mcp_enabled', False)),
        'mcp_calls': mcp_calls if isinstance(mcp_calls, list) else [],
        'search_results': meta.get('search_results') if isinstance(meta.get('search_results'), list) else [],
        'a2ui_events': meta.get('a2ui_events') if isinstance(meta.get('a2ui_events'), list) else [],
        'a2ui_ui_only': bool(meta.get('a2ui_ui_only', False)),
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


def _resolve_file_names(user_id: str, file_ids: list[int]) -> list[str]:
    if not file_ids:
        return []

    placeholders = ','.join('?' for _ in file_ids)
    rows = fetch_all(
        f'SELECT id, filename FROM tutor_files WHERE user_id = ? AND id IN ({placeholders})',
        (user_id, *file_ids),
    )
    mapping = {int(r['id']): str(r['filename']) for r in rows}
    return [mapping[i] for i in file_ids if i in mapping]


def _default_role_id(user_id: str) -> int:
    row = fetch_one(
        'SELECT id FROM tutor_roles WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
        (user_id,),
    )
    if row:
        return int(row['id'])

    ts = now_iso()
    return _execute_returning_id(
        """
        INSERT INTO tutor_roles(user_id, name, persona, background, style_guide, rules, enabled, created_at, updated_at)
        VALUES (?, '通用学习导师', '', '', '', '', 1, ?, ?)
        """,
        (user_id, ts, ts),
    )


def _ensure_default_conversation(user_id: str) -> int:
    row = fetch_one(
        """
        SELECT id
        FROM tutor_conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (user_id,),
    )
    if row:
        return int(row['id'])

    ts = now_iso()
    return _execute_returning_id(
        """
        INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
        VALUES (?, ?, '新对话', ?, ?)
        """,
        (user_id, _default_role_id(user_id), ts, ts),
    )


def _create_tutor_conversation(user_id: str, title: str = '新对话', role_id: int | None = None) -> int:
    ts = now_iso()
    return _execute_returning_id(
        """
        INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, role_id or _default_role_id(user_id), title, ts, ts),
    )


def _role_id_for_conversation(user_id: str, conversation_id: int) -> int | None:
    row = fetch_one(
        'SELECT role_id FROM tutor_conversations WHERE id = ? AND user_id = ?',
        (conversation_id, user_id),
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


def _load_profile_snapshot(user_id: str) -> dict[str, Any]:
    row = fetch_one('SELECT * FROM profiles WHERE user_id = ?', (user_id,))
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


def _resolve_subject_knowledge_file_ids_for_tutor(user_id: str | list[int], explicit_ids: list[int] | None = None) -> list[int]:
    if explicit_ids is None:
        explicit_ids = user_id if isinstance(user_id, list) else []
        user_id = settings.single_user_id
    ids = [int(x) for x in explicit_ids if int(x) > 0]
    if ids:
        return ids

    student = fetch_one('SELECT major FROM students WHERE user_id = ?', (user_id,))
    subject_name = str(student['major']).strip() if student and student['major'] else ''
    if not subject_name:
        return []
    rows = fetch_all(
        """
        SELECT id
        FROM knowledge_files
        WHERE user_id = ? AND status = 'indexed' AND subject_name = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 8
        """,
        (user_id, subject_name),
    )
    return [int(row['id']) for row in rows]


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


def _build_reverse_engineering_prompt(goal: str, search_results: list[dict[str, Any]], role_prompt: str) -> str:
    """构建知识逆构模式的 prompt：从学习目标反推实现过程并配对资源。"""
    resources_block = ""
    if search_results:
        lines = ["以下是联网搜索到的真实学习资源："]
        for i, r in enumerate(search_results, 1):
            lines.append(f"\n[来源{i}] {r['title']}\n  URL: {r['url']}\n  内容摘要: {r['content']}")
        resources_block = "\n".join(lines)

    role_section = f"[角色设定]\n{role_prompt}\n\n" if role_prompt else ""

    return (
        "你是 SparkLearn 的学习路径规划专家。用户有一个学习目标，请基于联网搜索到的真实资源，"
        "反推构建从零到实现该目标的结构化学习路径。\n\n"
        f"{role_section}"
        f"[用户学习目标]\n{goal}\n\n"
        f"{resources_block}\n\n"
        "请按以下格式输出（使用 Markdown）：\n\n"
        "## 学习目标分析\n"
        "简要分析达成此目标需要掌握的核心能力和知识领域。\n\n"
        "## 分阶段学习路径\n"
        "### 阶段一：基础入门\n"
        "- **学习内容**：具体要学什么\n"
        "- **推荐资源**：优先从搜索结果中匹配，标注 [来源N]\n"
        "- **预计时长**：X 周/天\n\n"
        "### 阶段二：进阶提升\n"
        "- **学习内容**：...\n"
        "- **推荐资源**：...\n"
        "- **预计时长**：...\n\n"
        "（继续 3-5 个阶段）\n\n"
        "## 实战建议\n"
        "推荐 2-3 个具体项目或练习，优先使用搜索结果中的实战资源。\n\n"
        "## 注意事项\n"
        "常见误区、学习技巧和避坑建议。\n\n"
        "## 资源清单\n"
        "列出所有引用的资源名称和链接。\n\n"
        "要求：\n"
        "1. 每个阶段的推荐资源必须优先从搜索结果中选取，并标注来源编号\n"
        "2. 如果搜索结果中缺乏某阶段的资源，可以推荐公认的优质资源并说明\n"
        "3. 学习路径要具体可执行，避免抽象空泛\n"
        "4. 使用中文输出，内容详实有条理"
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


def _build_workshop_participants(user_id: str, req: TutorReq, active_role: Any) -> list[dict[str, str]]:
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
            (user_id, *custom_ids),
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
    if suffix == '.docx' or 'wordprocessingml.document' in mime_type:
        return _extract_docx_text_for_tutor(path)
    raise RuntimeError(f'unsupported format: {suffix or mime_type}')


def _extract_docx_text_for_tutor(path: Path) -> str:
    try:
        from docx import Document
    except Exception as ex:
        raise RuntimeError('python-docx is required for DOCX parsing') from ex

    try:
        doc = Document(str(path))
    except Exception as ex:
        raise RuntimeError('failed to parse DOCX file') from ex

    parts: list[str] = []
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if text:
            parts.append(text)

    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(' | '.join(cells))

    return '\n'.join(parts).strip()


def _clean_web_material_text(text: str) -> str:
    cleaned = (text or '').replace('\r\n', '\n').replace('\r', '\n')
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned).strip()
    if len(cleaned) < 20:
        return ''
    return cleaned[:60000]


def _clean_web_material_title(title: str, url: str) -> str:
    candidate = re.sub(r'\s+', ' ', (title or '').strip())
    if not candidate:
        candidate = re.sub(r'^https?://', '', (url or '').strip()).strip('/') or '网页资料'
    candidate = re.sub(r'[\\/:*?"<>|]+', '_', candidate)
    return candidate[:80] or '网页资料'


def _safe_analysis_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()][:8]
    if isinstance(value, str):
        return [item.strip() for item in re.split(r'[；;\n]+', value) if item.strip()][:8]
    return []


def _normalize_web_material_analysis(data: dict[str, Any], title: str, text: str) -> dict[str, Any]:
    summary = str(data.get('summary') or '').strip() or f'{title} 已保存为网页资料，可用于后续讲解和复习。'
    key_points = _safe_analysis_list(data.get('key_points')) or _fallback_key_points(text)
    audience = str(data.get('audience') or '').strip() or '适合正在围绕该主题学习、需要快速理解文章要点的学习者。'
    learning_method = str(data.get('learning_method') or '').strip() or '建议先阅读 AI 讲解稿建立主线，再按关键知识点回看原文细节，最后用自己的话复述一遍。'
    lecture_script = str(data.get('lecture_script') or '').strip() or _fallback_lecture_script(title, summary, key_points)
    return {
        'summary': summary[:600],
        'key_points': key_points,
        'audience': audience[:260],
        'learning_method': learning_method[:360],
        'lecture_script': lecture_script[:8000],
    }


def _fallback_key_points(text: str) -> list[str]:
    sentences = [s.strip() for s in re.split(r'(?<=[。！？.!?])\s*', text) if len(s.strip()) > 8]
    return sentences[:4] or ['已提取网页正文，可在资料详情中继续阅读。']


def _fallback_lecture_script(title: str, summary: str, key_points: list[str]) -> str:
    points = '\n'.join(f'{idx + 1}. {point}' for idx, point in enumerate(key_points[:5]))
    return (
        f'我们先把《{title}》当成一节小课来理解。\n\n'
        f'这份资料的主线是：{summary}\n\n'
        f'你可以重点抓住这几个内容：\n{points}\n\n'
        '学习时不要一上来就背细节。先弄清楚作者想解决什么问题，再看每个关键点分别承担什么作用。'
        '如果遇到抽象概念，可以尝试自己举一个生活例子或代码例子，把它变成能复述的话。'
        '最后回到原文检查：哪些句子是在下定义，哪些句子是在举例，哪些句子是在提醒常见误区。'
    )


async def _analyze_web_material(title: str, url: str, text: str) -> dict[str, Any]:
    sample = text[:9000]
    prompt = (
        '你是 SparkLearn 的资料讲解老师。用户从网页采集了一份学习资料，你的重点不是简单摘要，而是把它讲成一份学生能直接阅读的中文讲解内容。\n'
        '只输出 JSON，不要输出 Markdown，不要输出额外说明。JSON 字段必须是：'
        '{"summary":"摘要","key_points":["关键点1"],"audience":"适合人群","learning_method":"推荐学习方式","lecture_script":"讲解稿"}。\n\n'
        '字段要求：\n'
        '1. summary 用 1-2 句话说明资料主题，不要过长。\n'
        '2. key_points 提取 3-6 个真正适合学习的知识点。\n'
        '3. learning_method 要围绕“先读讲解稿，再回看原文，再复述/练习”。\n'
        '4. lecture_script 是最重要字段，要写成完整讲解稿，包含：开场导入、核心概念解释、关键点分层讲解、必要例子、学习提醒。'
        '语言要像老师讲课，避免只列提纲；长度建议 600-1200 字。\n\n'
        f'网页标题：{title}\n'
        f'网页地址：{url or "未提供"}\n'
        f'网页正文：\n{sample}'
    )
    raw_parts: list[str] = []
    try:
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode='general', history=[]):
            if evt_type == 'text':
                chunk = str(payload.get('content', ''))
                if chunk:
                    raw_parts.append(chunk)
        raw = ''.join(raw_parts).strip()
        parsed = _parse_json_dict(_extract_first_json_object(raw))
        return _normalize_web_material_analysis(parsed, title, text)
    except Exception:
        return _normalize_web_material_analysis({}, title, text)


def _extract_first_json_object(text: str) -> str:
    fenced = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text or '', flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1)
    start = (text or '').find('{')
    end = (text or '').rfind('}')
    if start >= 0 and end > start:
        return text[start:end + 1]
    return '{}'


def _tutor_file_row_to_dict(row, include_content: bool = False) -> dict[str, Any]:
    data = {
        'id': int(row['id']),
        'filename': str(row['filename'] or ''),
        'mime_type': str(row['mime_type'] or 'application/octet-stream'),
        'size_bytes': int(row['size_bytes'] or 0),
        'source_type': str(row['source_type'] or 'upload') if 'source_type' in row.keys() else 'upload',
        'source_url': str(row['source_url'] or '') if 'source_url' in row.keys() else '',
        'status': str(row['status'] or 'ready') if 'status' in row.keys() else 'ready',
        'analysis': _parse_json_dict(row['analysis_json'] if 'analysis_json' in row.keys() else '{}'),
        'created_at': str(row['created_at'] or ''),
        'updated_at': str(row['updated_at'] or row['created_at'] or '') if 'updated_at' in row.keys() else str(row['created_at'] or ''),
    }
    if include_content:
        path = Path(str(row['stored_path'] or ''))
        data['content'] = path.read_text(encoding='utf-8', errors='ignore') if path.exists() and path.is_file() else ''
    return data


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


async def _retrieve_tutor_file_context(user_id: str, file_ids: list[int], query: str, max_chars: int = 3500, top_k: int = 8) -> tuple[str, list[dict[str, Any]]]:
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
        (user_id, *ids),
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
            (user_id, *ids),
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




