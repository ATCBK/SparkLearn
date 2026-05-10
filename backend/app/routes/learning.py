from __future__ import annotations

import json
from datetime import date
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..llm import spark_lite
from ..schemas import ok
from ..storage import append_jsonl, read_json, write_json

router = APIRouter(prefix='/api', tags=['learning'])


class PathAdjustReq(BaseModel):
    reason: str


class TaskCompleteReq(BaseModel):
    status: str = 'completed'


class TaskCreateReq(BaseModel):
    title: str
    type: str = 'practice'
    duration: int = 15


class NodeAdviceReq(BaseModel):
    node_id: str


_GRAPH_NODES: list[dict[str, Any]] = [
    {
        'id': '1.1',
        'name': '变量与数据类型',
        'stage': '基础语法',
        'prerequisites': [],
        'learning_contents': ['变量命名规范', 'int/float/str/bool 区别', '类型转换与常见错误'],
    },
    {
        'id': '1.2',
        'name': '表达式与运算符',
        'stage': '基础语法',
        'prerequisites': ['1.1'],
        'learning_contents': ['算术/比较/逻辑运算', '运算符优先级', '短路求值'],
    },
    {
        'id': '1.3',
        'name': '条件分支 if-elif-else',
        'stage': '基础语法',
        'prerequisites': ['1.2'],
        'learning_contents': ['布尔表达式设计', '多条件分支组织', '条件嵌套重构'],
    },
    {
        'id': '1.4',
        'name': '循环与控制语句',
        'stage': '基础语法',
        'prerequisites': ['1.3'],
        'learning_contents': ['for/while 使用场景', 'break/continue', '循环边界与死循环排查'],
    },
    {
        'id': '1.5',
        'name': '列表与字典基础',
        'stage': '基础语法',
        'prerequisites': ['1.4'],
        'learning_contents': ['增删改查操作', '切片与遍历', '嵌套结构访问'],
    },
    {
        'id': '2.1',
        'name': '函数定义与调用',
        'stage': '函数与模块',
        'prerequisites': ['1.5'],
        'learning_contents': ['def 与返回值', '参数传递规则', '函数拆分策略'],
    },
    {
        'id': '2.2',
        'name': '作用域与闭包',
        'stage': '函数与模块',
        'prerequisites': ['2.1'],
        'learning_contents': ['局部/全局作用域', 'nonlocal/global', '闭包结构与用途'],
    },
    {
        'id': '2.3',
        'name': '模块与包管理',
        'stage': '函数与模块',
        'prerequisites': ['2.1'],
        'learning_contents': ['import 机制', '包结构组织', '相对导入与绝对导入'],
    },
    {
        'id': '2.4',
        'name': '常用标准库',
        'stage': '函数与模块',
        'prerequisites': ['2.3'],
        'learning_contents': ['os/pathlib', 'json/datetime', 'random/math'],
    },
    {
        'id': '3.1',
        'name': '类与对象',
        'stage': '面向对象',
        'prerequisites': ['2.4'],
        'learning_contents': ['类定义与实例化', '实例属性与方法', 'self 机制'],
    },
    {
        'id': '3.2',
        'name': '封装与属性管理',
        'stage': '面向对象',
        'prerequisites': ['3.1'],
        'learning_contents': ['私有属性约定', 'property 装饰器', '类内数据保护'],
    },
    {
        'id': '3.3',
        'name': '继承与多态',
        'stage': '面向对象',
        'prerequisites': ['3.1'],
        'learning_contents': ['继承关系设计', '方法重写', 'isinstance 与多态调用'],
    },
    {
        'id': '3.4',
        'name': '面向对象建模实战',
        'stage': '面向对象',
        'prerequisites': ['3.2', '3.3'],
        'learning_contents': ['需求到类图拆分', '对象协作', '可维护结构重构'],
    },
    {
        'id': '4.1',
        'name': '文件读写',
        'stage': '文件处理',
        'prerequisites': ['2.4'],
        'learning_contents': ['文本文件读写', 'with 上下文', '编码与路径问题'],
    },
    {
        'id': '4.2',
        'name': '异常处理',
        'stage': '文件处理',
        'prerequisites': ['4.1'],
        'learning_contents': ['try/except/finally', '异常类型识别', '自定义异常'],
    },
    {
        'id': '4.3',
        'name': 'JSON 与数据持久化',
        'stage': '文件处理',
        'prerequisites': ['4.1'],
        'learning_contents': ['json 序列化反序列化', '数据结构设计', '读写错误恢复'],
    },
    {
        'id': '4.4',
        'name': '日志与调试',
        'stage': '文件处理',
        'prerequisites': ['4.2'],
        'learning_contents': ['logging 基础', '调试断点思路', '问题排查路径'],
    },
    {
        'id': '5.1',
        'name': '装饰器',
        'stage': '高级特性',
        'prerequisites': ['2.2'],
        'learning_contents': ['函数装饰器写法', '带参数装饰器', '保留元信息'],
    },
    {
        'id': '5.2',
        'name': '生成器与迭代器',
        'stage': '高级特性',
        'prerequisites': ['1.4'],
        'learning_contents': ['iter/next 协议', 'yield 机制', '惰性计算场景'],
    },
    {
        'id': '5.3',
        'name': '列表推导式与函数式工具',
        'stage': '高级特性',
        'prerequisites': ['1.5'],
        'learning_contents': ['列表/字典推导式', 'map/filter', '可读性与性能平衡'],
    },
    {
        'id': '5.4',
        'name': '异步编程入门',
        'stage': '高级特性',
        'prerequisites': ['2.1', '4.2'],
        'learning_contents': ['async/await 基本语法', '协程执行模型', 'I/O 并发场景'],
    },
]


_STAGE_ORDER = ['基础语法', '函数与模块', '面向对象', '文件处理', '高级特性']


@router.get('/learning-path')
async def get_learning_path():
    graph_data = _build_learning_graph()
    return ok(graph_data)


@router.post('/learning-path/node-advice')
async def get_node_advice(req: NodeAdviceReq):
    graph_data = _build_learning_graph()
    node = next((n for n in graph_data['knowledge_graph']['nodes'] if n['id'] == req.node_id), None)
    if not node:
        return ok(
            {
                'node_id': req.node_id,
                'node_name': '未知模块',
                'mastery': 0.0,
                'suggestion': '未找到对应知识点，建议刷新路径后重试。',
                'plain_explanation': '这个模块暂时无法识别。',
                'next_actions': ['返回学习路径页面刷新数据', '检查节点是否已更新'],
                'recommended_resources': ['document'],
                'learning_contents': [],
            }
        )

    profile_row = fetch_one('SELECT * FROM profiles WHERE user_id = ?', (settings.single_user_id,))
    profile = _profile_dict(profile_row)

    suggestion = await _generate_node_advice(node=node, profile=profile)
    append_jsonl(
        settings.single_user_id,
        'learning_events.jsonl',
        {'type': 'path_node_advice', 'node_id': req.node_id, 'mastery': node['mastery']},
    )
    return ok(suggestion)


@router.post('/learning-path/adjust')
async def adjust_learning_path(req: PathAdjustReq):
    execute(
        'UPDATE profiles SET current_stage = ?, updated_at = ? WHERE user_id = ?',
        ('函数与模块', now_iso(), settings.single_user_id),
    )
    append_jsonl(settings.single_user_id, 'learning_events.jsonl', {'type': 'path_adjusted', 'reason': req.reason})
    return ok({'previous_stage': '面向对象', 'current_stage': '函数与模块'})


@router.get('/tasks/today')
async def get_today_tasks():
    return ok(_read_tasks())


@router.post('/tasks')
async def create_task(req: TaskCreateReq):
    tasks = _read_tasks()
    task = {
        'id': f'task-{date.today().strftime("%Y%m%d")}-{len(tasks) + 1}',
        'title': req.title.strip() or '新的学习任务',
        'type': req.type if req.type in {'video', 'reading', 'quiz', 'practice'} else 'practice',
        'status': 'pending',
        'duration': max(1, min(int(req.duration or 15), 240)),
    }
    tasks.append(task)
    write_json(settings.single_user_id, 'task_progress.json', tasks)
    append_jsonl(settings.single_user_id, 'learning_events.jsonl', {'type': 'task_created', 'task': task})
    return ok(task)


@router.put('/tasks/{task_id}/complete')
async def complete_task(task_id: str, req: TaskCompleteReq):
    tasks = _read_tasks()
    updated: dict[str, Any] | None = None
    for task in tasks:
        if task['id'] == task_id:
            task['status'] = req.status if req.status in {'pending', 'in_progress', 'completed'} else 'completed'
            updated = task
    write_json(settings.single_user_id, 'task_progress.json', tasks)
    append_jsonl(settings.single_user_id, 'learning_events.jsonl', {'type': 'task_status_updated', 'task_id': task_id, 'status': req.status})

    today = date.today().isoformat()
    row = fetch_one('SELECT count FROM contribution_days WHERE user_id = ? AND date = ?', (settings.single_user_id, today))
    if row:
        execute(
            'UPDATE contribution_days SET count = ? WHERE user_id = ? AND date = ?',
            (int(row['count']) + 1, settings.single_user_id, today),
        )
    else:
        execute(
            'INSERT INTO contribution_days(user_id, date, count) VALUES (?, ?, ?)',
            (settings.single_user_id, today, 1),
        )
    return ok(updated or {'task_id': task_id, 'status': req.status})


@router.delete('/tasks/{task_id}')
async def delete_task(task_id: str):
    tasks = _read_tasks()
    next_tasks = [task for task in tasks if str(task.get('id')) != task_id]
    write_json(settings.single_user_id, 'task_progress.json', next_tasks)
    append_jsonl(settings.single_user_id, 'learning_events.jsonl', {'type': 'task_deleted', 'task_id': task_id})
    return ok({'task_id': task_id, 'removed': len(tasks) - len(next_tasks)})


@router.get('/contribution')
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
    return ok([{'date': row['date'], 'count': row['count']} for row in rows])


@router.get('/mastery')
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
                'knowledge_point_id': r['knowledge_point_id'],
                'knowledge_point_name': r['knowledge_point_name'],
                'score': r['score'],
                'chapter': r['chapter'],
            }
            for r in rows
        ]
    )


@router.get('/dashboard/stats')
async def get_dashboard_stats():
    report = await get_evaluation_report()  # type: ignore[name-defined]
    stats = report.data['stats']
    return ok(stats)


@router.get('/daily-quote')
async def get_daily_quote():
    return ok({'quote': '学而不思则罔，思而不学则殆。'})


@router.get('/videos')
async def get_videos():
    return ok(
        [
            {'id': 'v1', 'title': '变量与数据类型', 'url': '/demo-video.mp4', 'duration': 750, 'created_at': '2026-04-15'},
            {'id': 'v2', 'title': '函数定义与调用详解', 'url': '/demo-video.mp4', 'duration': 920, 'created_at': '2026-04-14'},
        ]
    )


def _build_learning_graph() -> dict[str, Any]:
    mastery_rows = fetch_all(
        """
        SELECT knowledge_point_id, knowledge_point_name, score, chapter
        FROM mastery_records
        WHERE user_id = ?
        """,
        (settings.single_user_id,),
    )
    score_map = {str(r['knowledge_point_id']): float(r['score']) for r in mastery_rows}

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []

    for node_def in _GRAPH_NODES:
        node_id = node_def['id']
        score = score_map.get(node_id, 0.0)
        score = round(max(0.0, min(1.0, score)), 2)

        status = _status_from_score(score)
        nodes.append(
            {
                'id': node_id,
                'name': node_def['name'],
                'stage': node_def['stage'],
                'mastery': score,
                'status': status,
                'prerequisites': list(node_def['prerequisites']),
                'learning_contents': list(node_def.get('learning_contents', [])),
                'recommended_resource_types': _resource_types_for_score(score),
            }
        )
        for pre in node_def['prerequisites']:
            edges.append({'source': pre, 'target': node_id})

    # 统一口径：状态只看掌握度；依赖关系仅用于路径连线和建议提示。
    current_stage = next((n['stage'] for n in nodes if n['status'] == 'current'), _STAGE_ORDER[0])

    stages: list[dict[str, str]] = []
    for stage in _STAGE_ORDER:
        stage_nodes = [n for n in nodes if n['stage'] == stage]
        if not stage_nodes:
            continue
        if all(n['status'] == 'completed' for n in stage_nodes):
            stage_status = 'completed'
        else:
            stage_status = 'pending'
        stages.append({'name': stage, 'status': stage_status})

    # 阶段栏保持单一“当前阶段”：
    # 1) 优先选择最靠前且存在 learning(current) 节点的阶段；
    # 2) 若没有学习中节点，选择最靠前 pending 阶段；
    # 3) 若全部已完成，保持 completed。
    current_stage = ''
    for stage in _STAGE_ORDER:
        stage_nodes = [n for n in nodes if n['stage'] == stage]
        if stage_nodes and any(n['status'] == 'current' for n in stage_nodes):
            current_stage = stage
            break
    if not current_stage:
        for s in stages:
            if s['status'] == 'pending':
                current_stage = s['name']
                break
    if not current_stage and stages:
        current_stage = stages[-1]['name']

    for s in stages:
        if s['status'] != 'completed':
            s['status'] = 'current' if s['name'] == current_stage else 'pending'

    knowledge_tree = _build_tree(nodes)

    return {
        'current_stage': current_stage,
        'stages': stages,
        'knowledge_tree': knowledge_tree,
        'knowledge_graph': {'nodes': nodes, 'edges': edges},
    }


def _read_tasks() -> list[dict[str, Any]]:
    tasks = read_json(
        settings.single_user_id,
        'task_progress.json',
        [
            {'id': '1', 'title': '回顾函数返回值讲义', 'type': 'reading', 'status': 'pending', 'duration': 12},
            {'id': '2', 'title': '完成 8 道返回值短练', 'type': 'quiz', 'status': 'pending', 'duration': 8},
            {'id': '3', 'title': '确认下一路径节点', 'type': 'practice', 'status': 'pending', 'duration': 4},
        ],
    )
    return tasks if isinstance(tasks, list) else []


def _build_tree(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tree: list[dict[str, Any]] = []
    for stage in _STAGE_ORDER:
        stage_nodes = [n for n in nodes if n['stage'] == stage]
        if not stage_nodes:
            continue
        stage_status = 'pending'
        if all(n['status'] == 'completed' for n in stage_nodes):
            stage_status = 'completed'
        elif any(n['status'] == 'current' for n in stage_nodes):
            stage_status = 'current'
        tree.append(
            {
                'id': f'stage-{stage}',
                'name': stage,
                'status': stage_status,
                'children': [
                    {
                        'id': n['id'],
                        'name': n['name'],
                        'status': n['status'],
                    }
                    for n in stage_nodes
                ],
            }
        )
    return tree


def _resource_types_for_score(score: float) -> list[str]:
    if score < 0.45:
        return ['document', 'quiz', 'video']
    if score < 0.7:
        return ['quiz', 'code', 'reading']
    return ['practice', 'project', 'reading']


def _status_from_score(score: float) -> str:
    # 统一约束：
    # 0% -> 待学习
    # 1%~79% -> 学习中
    # 80%~100% -> 已掌握
    if score <= 0:
        return 'pending'
    if score < 0.8:
        return 'current'
    return 'completed'


async def _generate_node_advice(node: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    default = _fallback_advice(node, profile)
    prompt = (
        '你是学习路径导师。请针对一个知识点给出个性化建议。仅返回 JSON，不要任何额外文本。\\n'
        'JSON字段: suggestion(string), plain_explanation(string), next_actions(string array, 3项).\\n'
        f"知识点: {node['name']}\\n"
        f"掌握度: {node['mastery']}\\n"
        f"阶段: {node['stage']}\\n"
        f"先修: {','.join(node['prerequisites']) or '无'}\\n"
        f"该模块学习内容: {json.dumps(node.get('learning_contents', []), ensure_ascii=False)}\\n"
        f"学习目标: {json.dumps(profile.get('goal', []), ensure_ascii=False)}\\n"
        f"薄弱点: {json.dumps(profile.get('weak_points', []), ensure_ascii=False)}\\n"
        f"偏好: {json.dumps(profile.get('learning_preference', []), ensure_ascii=False)}"
    )
    text = await _collect_llm_text(prompt)
    if not text:
        return default

    parsed = _extract_json_object(text)
    if not isinstance(parsed, dict):
        return default

    actions = parsed.get('next_actions')
    next_actions = [str(x).strip() for x in actions if str(x).strip()] if isinstance(actions, list) else default['next_actions']
    if len(next_actions) < 3:
        next_actions = default['next_actions']

    return {
        'node_id': node['id'],
        'node_name': node['name'],
        'mastery': node['mastery'],
        'suggestion': str(parsed.get('suggestion', default['suggestion'])).strip() or default['suggestion'],
        'plain_explanation': str(parsed.get('plain_explanation', default['plain_explanation'])).strip() or default['plain_explanation'],
        'next_actions': next_actions[:3],
        'recommended_resources': node['recommended_resource_types'],
        'learning_contents': node.get('learning_contents', []),
    }


async def _collect_llm_text(prompt: str) -> str:
    parts: list[str] = []
    async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode='general', history=[]):
        if evt_type == 'text':
            chunk = str(payload.get('content', ''))
            if chunk:
                parts.append(chunk)
    return ''.join(parts).strip()


def _extract_json_object(text: str) -> dict[str, Any] | None:
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


def _fallback_advice(node: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    mastery = float(node['mastery'])
    if mastery < 0.45:
        suggestion = f"你在『{node['name']}』基础还不稳，建议先用文档+视频建立理解，再做针对练习。"
    elif mastery < 0.7:
        suggestion = f"你在『{node['name']}』有一定基础，建议通过题目和代码案例强化迁移能力。"
    else:
        suggestion = f"你在『{node['name']}』掌握较好，建议进入综合实战或挑战题巩固。"

    return {
        'node_id': node['id'],
        'node_name': node['name'],
        'mastery': node['mastery'],
        'suggestion': suggestion,
        'plain_explanation': f"这个模块主要帮助你建立『{node['name']}』的核心概念与实际用法。",
        'next_actions': [
            '先完成该模块的1个核心任务',
            '再做2-3道对应练习题',
            '最后复盘错题并记录要点',
        ],
        'recommended_resources': node['recommended_resource_types'],
        'learning_contents': node.get('learning_contents', []),
    }


def _profile_dict(row) -> dict[str, Any]:
    if not row:
        return {
            'goal': ['提升编程能力'],
            'weak_points': ['函数与模块'],
            'learning_preference': ['实战练习'],
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
    }


# lazy import to avoid circular reference
from .tutor_eval import get_evaluation_report  # noqa: E402
