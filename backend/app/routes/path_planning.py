from __future__ import annotations

import json
import random
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_one, now_iso
from ..llm import spark_lite
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json

router = APIRouter(prefix='/api', tags=['path_planning'])


class PathPlanningReq(BaseModel):
    target: str = ''  # 用户输入的目标


class NodeSuggestionsReq(BaseModel):
    node_title: str = ''       # 节点完整标题，如 "回顾函数定义"
    node_goal: str = ''        # 节点简化目标，如 "回顾函数"
    node_status: str = ''      # completed / current / next / locked
    phase_title: str = ''      # 所属阶段，如 "达标阶段"
    target: str = ''           # 整体路径目标，用于上下文


class PathPlanningResp(BaseModel):
    path_id: str
    target: str
    suggestions: list[dict[str, Any]]
    resources: list[dict[str, Any]]
    created_at: str


@router.post('/path-planning/generate')
async def generate_path_planning(req: PathPlanningReq):
    """
    基于用户画像和目标，使用讯飞大模型生成个性化学习路径规划
    """
    # 获取用户画像
    profile_row = fetch_one('SELECT * FROM profiles WHERE user_id = ?', (settings.single_user_id,))
    profile = _profile_dict(profile_row)
    
    # 获取用户掌握度数据
    mastery_rows = fetch_one(
        'SELECT COUNT(*) as total, SUM(CASE WHEN score >= 0.8 THEN 1 ELSE 0 END) as mastered FROM mastery_records WHERE user_id = ?',
        (settings.single_user_id,)
    )
    
    # 调用 AI 生成路径规划
    target = req.target.strip() or '提升编程能力'
    suggestions, resources, phases = await _generate_ai_path_planning(
        target=target,
        profile=profile,
        mastery_stats=mastery_rows
    )
    
    # 保存路径规划到文件
    path_id = f"path-{now_iso().replace(':', '').replace('-', '').replace('Z', '')}"
    planning_data = {
        'path_id': path_id,
        'target': target,
        'suggestions': suggestions,
        'resources': resources,
        'phases': phases,
        'created_at': now_iso(),
    }
    
    # 保存到用户数据目录
    planning_history = read_json(
        settings.single_user_id,
        'path_planning_history.json',
        []
    )
    planning_history.append(planning_data)
    write_json(settings.single_user_id, 'path_planning_history.json', planning_history)
    
    # 记录事件
    append_jsonl(
        settings.single_user_id,
        'learning_events.jsonl',
        {
            'type': 'path_planning_generated',
            'path_id': path_id,
            'target': target,
            'timestamp': now_iso()
        }
    )
    
    return ok(planning_data)


@router.get('/path-planning/history')
async def get_path_planning_history():
    """
    获取路径规划历史
    """
    history = read_json(
        settings.single_user_id,
        'path_planning_history.json',
        []
    )
    return ok(history)


@router.post('/path-planning/node-suggestions')
async def generate_node_suggestions(req: NodeSuggestionsReq):
    """
    针对路径图上单个节点，基于用户画像与节点目标生成建议与资源推送。
    仅返回，不落盘，供点击节点时实时调用。
    """
    profile_row = fetch_one(
        'SELECT * FROM profiles WHERE user_id = ?',
        (settings.single_user_id,),
    )
    profile = _profile_dict(profile_row)

    node_goal = (req.node_goal or req.node_title or '学习任务').strip()
    node_title = (req.node_title or node_goal).strip()
    phase_title = (req.phase_title or '当前阶段').strip()
    status_label = _status_label(req.node_status)

    suggestions, resources = await _generate_ai_node_suggestions(
        node_title=node_title,
        node_goal=node_goal,
        node_status=status_label,
        phase_title=phase_title,
        target=req.target.strip(),
        profile=profile,
    )

    append_jsonl(
        settings.single_user_id,
        'learning_events.jsonl',
        {
            'type': 'path_node_suggestions',
            'node_title': node_title,
            'node_goal': node_goal,
            'phase': phase_title,
            'timestamp': now_iso(),
        },
    )

    return ok({
        'node_title': node_title,
        'node_goal': node_goal,
        'phase_title': phase_title,
        'status': status_label,
        'suggestions': suggestions,
        'resources': resources,
    })


@router.get('/path-planning/{path_id}')
async def get_path_planning(path_id: str):
    """
    获取特定的路径规划
    """
    history = read_json(
        settings.single_user_id,
        'path_planning_history.json',
        []
    )
    
    for planning in history:
        if planning.get('path_id') == path_id:
            return ok(planning)
    
    return ok({'error': 'Path planning not found'})


async def _generate_ai_path_planning(
    target: str,
    profile: dict[str, Any],
    mastery_stats: Any
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """
    使用讯飞大模型生成路径规划建议、资源推荐和阶段路径节点。
    返回 (suggestions, resources, phases)
    """
    
    # 构建提示词
    prompt = f"""你是一名专业的学习路径规划师。请根据学生的画像和目标，生成个性化的学习路径规划。

学生目标: {target}
学生学习目标: {json.dumps(profile.get('goal', []), ensure_ascii=False)}
学生薄弱点: {json.dumps(profile.get('weak_points', []), ensure_ascii=False)}
学生学习偏好: {json.dumps(profile.get('learning_preference', []), ensure_ascii=False)}
学生认知风格: {profile.get('cognitive_style', '未知')}
每日学习时间: {profile.get('daily_time', 60)}分钟
学生实践能力: {profile.get('practical_ability', '未知')}

请返回一个JSON对象，包含以下字段:
{{
  "phases": [
    {{
      "id": 1,
      "title": "补弱阶段",
      "description": "夯实基础",
      "nodes": [
        {{"id": 1, "title": "节点标题(8字内)"}},
        {{"id": 2, "title": "节点标题"}},
        {{"id": 3, "title": "节点标题"}},
        {{"id": 4, "title": "阶段完成"}}
      ]
    }},
    {{
      "id": 2,
      "title": "达标阶段",
      "description": "能力达标",
      "nodes": [
        {{"id": 5, "title": "节点标题"}},
        {{"id": 6, "title": "节点标题"}},
        {{"id": 7, "title": "节点标题"}},
        {{"id": 8, "title": "节点标题"}}
      ]
    }},
    {{
      "id": 3,
      "title": "目标阶段",
      "description": "应用提升",
      "nodes": [
        {{"id": 9, "title": "节点标题"}},
        {{"id": 10, "title": "节点标题"}},
        {{"id": 11, "title": "节点标题"}},
        {{"id": 12, "title": "完成目标"}}
      ]
    }}
  ],
  "suggestions": [
    {{"id": 1, "text": "建议1(10字内)", "desc": "详细说明(20字内)"}},
    {{"id": 2, "text": "建议2", "desc": "详细说明"}},
    {{"id": 3, "text": "建议3", "desc": "详细说明"}}
  ]
}}

要求:
1. phases 必须恰好 3 个阶段，每个阶段恰好 4 个节点
2. 节点标题要具体、可执行，针对学生目标"{target}"
3. 第一阶段侧重补弱/基础，第二阶段侧重核心能力达标，第三阶段侧重应用/项目
4. 建议要具体可行，针对学生的薄弱点
5. 只返回JSON，不要任何其他文本"""

    try:
        text = await _collect_llm_text(prompt)
        parsed = _extract_json_object(text)
        
        if parsed and isinstance(parsed, dict):
            phases = parsed.get('phases', [])
            suggestions = parsed.get('suggestions', [])
            
            # 验证 phases 格式
            if isinstance(phases, list) and len(phases) == 3:
                valid_phases = True
                for p in phases:
                    if not isinstance(p, dict) or not isinstance(p.get('nodes'), list):
                        valid_phases = False
                        break
                if valid_phases:
                    # 从已有资源中选取推荐
                    resources = _pick_resources_for_node(target)
                    if isinstance(suggestions, list) and len(suggestions) >= 2:
                        return suggestions, resources, phases
                    return _get_default_suggestions(), resources, phases

            # phases 格式不对但 suggestions 可用
            if isinstance(suggestions, list) and len(suggestions) >= 2:
                resources = _pick_resources_for_node(target)
                return suggestions, resources, []
    except Exception as e:
        print(f"Error generating path planning: {e}")
    
    # 返回默认
    return _get_default_suggestions(), _get_default_resources(), []


async def _collect_llm_text(prompt: str) -> str:
    """
    从讯飞大模型收集文本响应
    """
    parts: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode='general', history=[]):
        if evt_type == 'text':
            chunk = str(payload.get('content', ''))
            if chunk:
                parts.append(chunk)
    return ''.join(parts).strip()


def _extract_json_object(text: str) -> dict[str, Any] | None:
    """
    从文本中提取 JSON 对象
    """
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass

    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        obj = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None


def _get_default_suggestions() -> list[dict[str, Any]]:
    """
    返回默认的学习建议
    """
    return [
        {
            'id': 1,
            'text': '先补返回值，再补作用域',
            'desc': '根据当前画像、推荐和路径状态自动推荐。'
        },
        {
            'id': 2,
            'text': '资源 10 分钟 + 练习 5 题',
            'desc': '根据当前画像、推荐和路径状态自动推荐。'
        },
        {
            'id': 3,
            'text': '卡住就换一种讲法',
            'desc': '根据当前画像、推荐和路径状态自动推荐。'
        }
    ]


def _get_default_resources() -> list[dict[str, Any]]:
    """
    返回默认的资源推荐
    """
    return [
        {
            'id': 1,
            'title': '函数返回值项目讲义',
            'tag': '优先学习',
            'link': '/resources?type=lecture&id=1'
        },
        {
            'id': 2,
            'title': '函数作用域精讲讲义',
            'tag': '待复习',
            'link': '/resources?type=lecture&id=2'
        },
        {
            'id': 3,
            'title': '返回值补弱题练',
            'tag': '5 题',
            'link': '/practice?topic=返回值'
        }
    ]


def _profile_dict(row) -> dict[str, Any]:
    """
    将数据库行转换为字典
    """
    if not row:
        return {
            'goal': ['提升编程能力'],
            'weak_points': ['函数与模块'],
            'learning_preference': ['实战练习'],
            'cognitive_style': '归纳型',
            'daily_time': 60,
            'practical_ability': '能独立完成小项目'
        }

    def _loads(v: Any) -> list[Any]:
        if not v:
            return []
        try:
            x = json.loads(v)
            return x if isinstance(x, list) else []
        except Exception:
            return []

    return {
        'goal': _loads(row['goal']),
        'weak_points': _loads(row['weak_points']),
        'learning_preference': _loads(row['learning_preference']),
        'cognitive_style': row['cognitive_style'] or '归纳型',
        'daily_time': row['daily_time'] or 60,
        'practical_ability': row['practical_ability'] or '能独立完成小项目'
    }


# ============ 节点建议相关 ============


def _status_label(status: str) -> str:
    """将前端节点 status 转为中文标签"""
    mapping = {
        'completed': '已完成',
        'current': '当前推荐',
        'next': '下一步',
        'locked': '未开始',
    }
    return mapping.get((status or '').strip().lower(), '学习中')


def _pick_resources_for_node(node_goal: str, count: int = 3) -> list[dict[str, Any]]:
    """
    从用户已有资源库中选取与节点目标相关的资源。
    优先匹配标题/内容包含 node_goal 关键词的资源；不足时随机补齐。
    返回格式: [{"id": ..., "title": ..., "tag": ..., "link": ...}]
    """
    all_resources = read_json(
        settings.single_user_id,
        'resources_index.json',
        [],
    )
    # 只保留 status=completed 的有效资源
    valid = [r for r in all_resources if r.get('status') == 'completed']
    if not valid:
        return []

    # 关键词匹配：标题或内容包含 node_goal 中的关键字
    keywords = [w for w in node_goal.replace('/', ' ').split() if len(w) >= 2]
    matched: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []

    for res in valid:
        title = str(res.get('title', ''))
        content = str(res.get('content', ''))[:200]  # 只看前 200 字
        hit = any(kw in title or kw in content for kw in keywords) if keywords else False
        if hit:
            matched.append(res)
        else:
            unmatched.append(res)

    # 优先取匹配的，不足随机补
    selected = matched[:count]
    if len(selected) < count:
        remaining = count - len(selected)
        pool = unmatched if unmatched else valid
        extras = random.sample(pool, min(remaining, len(pool)))
        selected.extend(extras)

    # 格式化输出
    type_tag_map = {
        'document': '文档',
        'ppt': 'PPT',
        'mindmap': '思维导图',
        'quiz': '练习题',
        'reading': '阅读',
        'code': '代码案例',
        'video': '视频',
    }
    result: list[dict[str, Any]] = []
    for idx, res in enumerate(selected[:count]):
        res_id = str(res.get('id', ''))
        tag = type_tag_map.get(str(res.get('type', '')), '资源')
        result.append({
            'id': idx + 1,
            'title': str(res.get('title', '学习资源'))[:30],
            'tag': tag,
            'link': f'/resources/{res_id}' if res_id else '/resources',
            'resource_id': res_id,
        })
    return result


async def _generate_ai_node_suggestions(
    *,
    node_title: str,
    node_goal: str,
    node_status: str,
    phase_title: str,
    target: str,
    profile: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    针对单个路径节点，调用 AI 生成学习建议，并从已有资源库中推荐资源。
    """
    # 先从资源库选取资源
    resources = _pick_resources_for_node(node_goal)

    # 构建资源列表描述供 AI 参考
    resource_titles = [r['title'] for r in resources] if resources else ['暂无已有资源']

    prompt = f"""你是一名学习路径导师。学生点击了路径图上的一个节点，请针对该节点给出 3 条简短、可执行的学习建议。

节点标题: {node_title}
节点目标: {node_goal}
节点状态: {node_status}
所属阶段: {phase_title}
整体路径目标: {target or '提升编程能力'}
学生薄弱点: {json.dumps(profile.get('weak_points', []), ensure_ascii=False)}
学生学习偏好: {json.dumps(profile.get('learning_preference', []), ensure_ascii=False)}
已有可用资源: {json.dumps(resource_titles, ensure_ascii=False)}

请仅返回 JSON，格式如下:
{{
  "suggestions": [
    {{"id": 1, "text": "建议标题(10字内)", "desc": "一句话说明(20字内)"}},
    {{"id": 2, "text": "建议标题", "desc": "一句话说明"}},
    {{"id": 3, "text": "建议标题", "desc": "一句话说明"}}
  ]
}}

要求:
1. 建议要针对节点目标和学生薄弱点
2. 考虑节点状态（已完成的给巩固建议，未开始的给预习建议）
3. 只返回 JSON，不要任何其他文本"""

    suggestions = _get_default_node_suggestions(node_goal, node_status)

    try:
        text = await _collect_llm_text(prompt)
        parsed = _extract_json_object(text)
        if parsed and isinstance(parsed, dict):
            ai_suggestions = parsed.get('suggestions', [])
            if isinstance(ai_suggestions, list) and len(ai_suggestions) >= 2:
                suggestions = ai_suggestions
    except Exception as e:
        print(f"Error generating node suggestions: {e}")

    return suggestions, resources


def _get_default_node_suggestions(node_goal: str, node_status: str) -> list[dict[str, Any]]:
    """节点建议的兜底默认值"""
    if '已完成' in node_status:
        return [
            {'id': 1, 'text': f'复习 {node_goal}', 'desc': '巩固已学内容，防止遗忘。'},
            {'id': 2, 'text': '做变式练习', 'desc': '用不同题型检验掌握程度。'},
            {'id': 3, 'text': '整理笔记', 'desc': '把要点写成自己的话。'},
        ]
    if '未开始' in node_status:
        return [
            {'id': 1, 'text': f'预习 {node_goal}', 'desc': '先浏览大纲建立整体印象。'},
            {'id': 2, 'text': '完成前置节点', 'desc': '确保先修知识已掌握。'},
            {'id': 3, 'text': '设定小目标', 'desc': '把大任务拆成可完成的步骤。'},
        ]
    return [
        {'id': 1, 'text': f'学习 {node_goal}', 'desc': '从核心概念开始理解。'},
        {'id': 2, 'text': '完成对应练习', 'desc': '做 3-5 题巩固理解。'},
        {'id': 3, 'text': '记录疑问', 'desc': '遇到不懂的先标记，稍后问 AI。'},
    ]
