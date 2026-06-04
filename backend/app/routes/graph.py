"""知识图谱路由 - 以用户为中心的个性化知识图谱"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..db import execute, fetch_all, fetch_one, now_iso
from ..llm import spark_lite
from ..schemas import ok
from ..storage import append_jsonl

router = APIRouter(prefix='/api/graph', tags=['knowledge-graph'])


# ── 请求体模型 ──────────────────────────────────────────────

class GenerateGraphReq(BaseModel):
    subject: str = 'Python'


class UpdateStatusReq(BaseModel):
    mastery: float | None = None
    study_hours: float | None = None
    exercises_done: int | None = None
    exercises_correct: int | None = None


class CreateNodeReq(BaseModel):
    name: str
    category: str = ''
    description: str = ''
    difficulty: int = 1
    importance: int = 3


class CreateEdgeReq(BaseModel):
    source_id: str
    target_id: str
    relation_type: str = 'prerequisite'
    weight: float = 1.0


class DeleteEdgeReq(BaseModel):
    source_id: str
    target_id: str


# ── 数据查询辅助 ─────────────────────────────────────────────

def _get_user_id() -> str:
    return settings.single_user_id


def _fetch_graph_nodes(subject: str = 'Python') -> list[dict[str, Any]]:
    rows = fetch_all(
        'SELECT * FROM knowledge_graph_nodes WHERE subject = ? ORDER BY category, difficulty',
        (subject,),
    )
    return [dict(r) for r in rows]


def _fetch_graph_edges() -> list[dict[str, Any]]:
    rows = fetch_all('SELECT * FROM knowledge_graph_edges ORDER BY id')
    return [dict(r) for r in rows]


def _fetch_user_statuses(user_id: str) -> dict[str, dict[str, Any]]:
    rows = fetch_all(
        'SELECT * FROM user_knowledge_status WHERE user_id = ?',
        (user_id,),
    )
    return {str(r['knowledge_id']): dict(r) for r in rows}


def _fetch_profile() -> dict[str, Any]:
    profile_row = fetch_one('SELECT * FROM profiles WHERE user_id = ?', (_get_user_id(),))
    student_row = fetch_one('SELECT major FROM students WHERE user_id = ?', (_get_user_id(),))
    major = str(student_row['major']).strip() if student_row and student_row['major'] else '计算机科学'

    def _loads(v: Any) -> list[Any]:
        if not v:
            return []
        try:
            x = json.loads(v)
            return x if isinstance(x, list) else []
        except Exception:
            return []

    if not profile_row:
        return {'major': major, 'goal': [], 'weak_points': [], 'learning_preference': []}
    return {
        'major': major,
        'goal': _loads(profile_row['goal']),
        'weak_points': _loads(profile_row['weak_points']),
        'learning_preference': _loads(profile_row['learning_preference']),
        'knowledge_level': str(profile_row['knowledge_level'] or ''),
        'current_stage': str(profile_row['current_stage'] or ''),
    }


def _status_from_mastery(mastery: float) -> str:
    if mastery <= 0:
        return 'locked'
    if mastery < 40:
        return 'not_started'
    if mastery < 80:
        return 'learning'
    return 'mastered'


def _build_graph_response(nodes: list[dict], edges: list[dict], statuses: dict) -> dict[str, Any]:
    """组装完整的图谱响应数据"""
    result_nodes = []
    stats = {'total': 0, 'mastered': 0, 'learning': 0, 'not_started': 0, 'locked': 0}

    for node in nodes:
        nid = node['id']
        status_row = statuses.get(nid, {})
        mastery = float(status_row.get('mastery', 0)) if status_row else 0
        status = _status_from_mastery(mastery)

        user_status = {
            'mastery': round(mastery, 1),
            'status': status,
            'study_hours': round(float(status_row.get('study_hours', 0)), 1) if status_row else 0,
            'exercises_done': int(status_row.get('exercises_done', 0)) if status_row else 0,
            'exercises_correct': int(status_row.get('exercises_correct', 0)) if status_row else 0,
            'accuracy': round(
                (int(status_row.get('exercises_correct', 0)) / max(int(status_row.get('exercises_done', 1)), 1)) * 100, 1
            ) if status_row and int(status_row.get('exercises_done', 0)) > 0 else 0,
            'last_studied': str(status_row.get('last_studied', '')) if status_row and status_row.get('last_studied') else None,
        }

        result_nodes.append({
            'id': nid,
            'name': node['name'],
            'category': node['category'],
            'difficulty': int(node.get('difficulty', 1)),
            'importance': int(node.get('importance', 3)),
            'description': str(node.get('description', '')),
            'user_status': user_status,
        })

        stats['total'] += 1
        stats[status] += 1

    result_edges = []
    for edge in edges:
        result_edges.append({
            'source': edge['source_id'],
            'target': edge['target_id'],
            'type': edge['relation_type'],
            'weight': float(edge.get('weight', 1.0)),
        })

    return {'nodes': result_nodes, 'edges': result_edges, 'stats': stats}


# ── API 端点 ─────────────────────────────────────────────────

@router.get('/data')
async def get_graph_data(subject: str = 'Python'):
    """获取完整的知识图谱数据（节点+边+用户状态）"""
    nodes = _fetch_graph_nodes(subject)
    edges = _fetch_graph_edges()

    # 如果没有节点数据，自动生成（首次访问）
    if not nodes:
        fallback = _fallback_graph_data()
        ts = now_iso()
        user_id = _get_user_id()
        for node in fallback['nodes']:
            nid = str(node.get('id', ''))
            if not nid:
                continue
            execute(
                """INSERT OR IGNORE INTO knowledge_graph_nodes
                   (id, name, category, subject, difficulty, importance, description, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (nid, str(node.get('name', '')), str(node.get('category', '')), subject,
                 int(node.get('difficulty', 1)), int(node.get('importance', 3)),
                 str(node.get('description', '')), ts),
            )
            execute(
                """INSERT OR IGNORE INTO user_knowledge_status (user_id, knowledge_id, mastery, updated_at)
                   VALUES (?, ?, 0, ?)""",
                (user_id, nid, ts),
            )
        for edge in fallback['edges']:
            src = str(edge.get('source', ''))
            tgt = str(edge.get('target', ''))
            if src and tgt:
                execute(
                    """INSERT OR IGNORE INTO knowledge_graph_edges (source_id, target_id, relation_type, weight)
                       VALUES (?, ?, ?, ?)""",
                    (src, tgt, str(edge.get('type', 'prerequisite')), float(edge.get('weight', 1.0))),
                )
        nodes = _fetch_graph_nodes(subject)
        edges = _fetch_graph_edges()

    statuses = _fetch_user_statuses(_get_user_id())

    return ok(_build_graph_response(nodes, edges, statuses))


@router.get('/node/{node_id}')
async def get_node_detail(node_id: str):
    """获取单个知识点的详情（含前置/后续关系）"""
    node = fetch_one('SELECT * FROM knowledge_graph_nodes WHERE id = ?', (node_id,))
    if not node:
        raise HTTPException(status_code=404, detail='知识点不存在')

    user_id = _get_user_id()
    status_row = fetch_one(
        'SELECT * FROM user_knowledge_status WHERE user_id = ? AND knowledge_id = ?',
        (user_id, node_id),
    )
    mastery = float(status_row['mastery']) if status_row else 0

    # 查询前置知识
    prereq_edges = fetch_all(
        'SELECT source_id FROM knowledge_graph_edges WHERE target_id = ? AND relation_type = ?',
        (node_id, 'prerequisite'),
    )
    prerequisites = []
    for edge in prereq_edges:
        prereq_node = fetch_one('SELECT id, name FROM knowledge_graph_nodes WHERE id = ?', (edge['source_id'],))
        if prereq_node:
            prereq_status = fetch_one(
                'SELECT mastery FROM user_knowledge_status WHERE user_id = ? AND knowledge_id = ?',
                (user_id, edge['source_id']),
            )
            prereq_mastery = float(prereq_status['mastery']) if prereq_status else 0
            prerequisites.append({
                'id': prereq_node['id'],
                'name': prereq_node['name'],
                'mastery': round(prereq_mastery, 1),
                'status': _status_from_mastery(prereq_mastery),
            })

    # 查询后续知识
    succ_edges = fetch_all(
        'SELECT target_id FROM knowledge_graph_edges WHERE source_id = ? AND relation_type = ?',
        (node_id, 'prerequisite'),
    )
    successors = []
    for edge in succ_edges:
        succ_node = fetch_one('SELECT id, name FROM knowledge_graph_nodes WHERE id = ?', (edge['target_id'],))
        if succ_node:
            succ_status = fetch_one(
                'SELECT mastery FROM user_knowledge_status WHERE user_id = ? AND knowledge_id = ?',
                (user_id, edge['target_id']),
            )
            succ_mastery = float(succ_status['mastery']) if succ_status else 0
            successors.append({
                'id': succ_node['id'],
                'name': succ_node['name'],
                'mastery': round(succ_mastery, 1),
                'status': _status_from_mastery(succ_mastery),
            })

    # AI 生成建议
    ai_suggestion = await _generate_node_suggestion(dict(node), mastery, prerequisites)

    return ok({
        'node': {
            'id': node['id'],
            'name': node['name'],
            'category': node['category'],
            'difficulty': int(node.get('difficulty', 1)),
            'description': str(node.get('description', '')),
            'user_status': {
                'mastery': round(mastery, 1),
                'status': _status_from_mastery(mastery),
                'study_hours': round(float(status_row['study_hours']), 1) if status_row else 0,
                'exercises_done': int(status_row['exercises_done']) if status_row else 0,
                'exercises_correct': int(status_row['exercises_correct']) if status_row else 0,
                'accuracy': round(
                    (int(status_row['exercises_correct']) / max(int(status_row['exercises_done']), 1)) * 100, 1
                ) if status_row and int(status_row.get('exercises_done', 0)) > 0 else 0,
                'last_studied': str(status_row['last_studied']) if status_row and status_row.get('last_studied') else None,
            },
        },
        'prerequisites': prerequisites,
        'successors': successors,
        'ai_suggestion': ai_suggestion,
    })


@router.put('/node/{node_id}/status')
async def update_node_status(node_id: str, req: UpdateStatusReq):
    """更新用户对某个知识点的掌握状态"""
    user_id = _get_user_id()
    existing = fetch_one(
        'SELECT * FROM user_knowledge_status WHERE user_id = ? AND knowledge_id = ?',
        (user_id, node_id),
    )
    ts = now_iso()

    if existing:
        updates = []
        params = []
        if req.mastery is not None:
            updates.append('mastery = ?')
            params.append(max(0, min(100, req.mastery)))
        if req.study_hours is not None:
            updates.append('study_hours = ?')
            params.append(max(0, req.study_hours))
        if req.exercises_done is not None:
            updates.append('exercises_done = ?')
            params.append(max(0, req.exercises_done))
        if req.exercises_correct is not None:
            updates.append('exercises_correct = ?')
            params.append(max(0, req.exercises_correct))
        updates.append('updated_at = ?')
        params.append(ts)
        params.extend([user_id, node_id])
        execute(f"UPDATE user_knowledge_status SET {', '.join(updates)} WHERE user_id = ? AND knowledge_id = ?", tuple(params))
    else:
        execute(
            """INSERT INTO user_knowledge_status
               (user_id, knowledge_id, mastery, study_hours, exercises_done, exercises_correct, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user_id, node_id, max(0, min(100, req.mastery or 0)), req.study_hours or 0,
             req.exercises_done or 0, req.exercises_correct or 0, ts),
        )

    append_jsonl(user_id, 'learning_events.jsonl', {
        'type': 'graph_status_updated',
        'knowledge_id': node_id,
        'mastery': req.mastery,
    })
    return ok({'knowledge_id': node_id, 'updated': True})


@router.post('/node')
async def create_node(req: CreateNodeReq):
    """用户自定义添加知识点"""
    ts = now_iso()
    node_id = f"custom_{req.name.replace(' ', '_').lower()}_{ts.replace(':', '').replace('-', '').replace('.', '')[:8]}"

    # 检查是否已存在同名节点
    existing = fetch_one(
        "SELECT id FROM knowledge_graph_nodes WHERE name = ? AND subject = 'Python'",
        (req.name,),
    )
    if existing:
        raise HTTPException(status_code=400, detail='同名知识点已存在')

    execute(
        """INSERT INTO knowledge_graph_nodes (id, name, category, subject, difficulty, importance, description, created_at)
           VALUES (?, ?, ?, 'Python', ?, ?, ?, ?)""",
        (node_id, req.name.strip(), req.category.strip(), max(1, min(5, req.difficulty)),
         max(1, min(5, req.importance)), req.description.strip(), ts),
    )

    # 自动设置为学习中状态
    execute(
        """INSERT INTO user_knowledge_status (user_id, knowledge_id, mastery, is_custom, updated_at)
           VALUES (?, ?, 10, 1, ?)""",
        (_get_user_id(), node_id, ts),
    )

    append_jsonl(_get_user_id(), 'learning_events.jsonl', {'type': 'graph_node_created', 'node_id': node_id, 'name': req.name})
    return ok({'id': node_id, 'name': req.name, 'created': True})


@router.delete('/node/{node_id}')
async def delete_node(node_id: str):
    """删除用户自定义添加的知识点"""
    user_id = _get_user_id()

    # 只允许删除自定义节点
    status = fetch_one(
        'SELECT is_custom FROM user_knowledge_status WHERE user_id = ? AND knowledge_id = ?',
        (user_id, node_id),
    )
    if not status or not status['is_custom']:
        raise HTTPException(status_code=400, detail='只能删除自定义添加的知识点')

    # 删除关联的边
    execute('DELETE FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?', (node_id, node_id))
    # 删除用户状态
    execute('DELETE FROM user_knowledge_status WHERE user_id = ? AND knowledge_id = ?', (user_id, node_id))
    # 删除节点
    execute('DELETE FROM knowledge_graph_nodes WHERE id = ?', (node_id,))

    append_jsonl(user_id, 'learning_events.jsonl', {'type': 'graph_node_deleted', 'node_id': node_id})
    return ok({'node_id': node_id, 'deleted': True})


@router.post('/edge')
async def create_edge(req: CreateEdgeReq):
    """添加知识点之间的关系"""
    # 验证节点存在
    src = fetch_one('SELECT id FROM knowledge_graph_nodes WHERE id = ?', (req.source_id,))
    tgt = fetch_one('SELECT id FROM knowledge_graph_nodes WHERE id = ?', (req.target_id,))
    if not src or not tgt:
        raise HTTPException(status_code=404, detail='知识点不存在')

    # 检查关系是否已存在
    existing = fetch_one(
        'SELECT id FROM knowledge_graph_edges WHERE source_id = ? AND target_id = ?',
        (req.source_id, req.target_id),
    )
    if existing:
        raise HTTPException(status_code=400, detail='该关系已存在')

    # 防止自环
    if req.source_id == req.target_id:
        raise HTTPException(status_code=400, detail='不能创建自环关系')

    execute(
        """INSERT INTO knowledge_graph_edges (source_id, target_id, relation_type, weight)
           VALUES (?, ?, ?, ?)""",
        (req.source_id, req.target_id, req.relation_type, max(0, min(1, req.weight))),
    )

    append_jsonl(_get_user_id(), 'learning_events.jsonl', {
        'type': 'graph_edge_created',
        'source': req.source_id,
        'target': req.target_id,
        'relation_type': req.relation_type,
    })
    return ok({'source_id': req.source_id, 'target_id': req.target_id, 'created': True})


@router.delete('/edge')
async def delete_edge(req: DeleteEdgeReq):
    """删除知识点之间的关系"""
    execute(
        'DELETE FROM knowledge_graph_edges WHERE source_id = ? AND target_id = ?',
        (req.source_id, req.target_id),
    )
    append_jsonl(_get_user_id(), 'learning_events.jsonl', {
        'type': 'graph_edge_deleted',
        'source': req.source_id,
        'target': req.target_id,
    })
    return ok({'source_id': req.source_id, 'target_id': req.target_id, 'deleted': True})


@router.post('/generate')
async def generate_graph(req: GenerateGraphReq):
    """AI 根据用户画像生成知识图谱"""
    user_id = _get_user_id()
    profile = _fetch_profile()
    ts = now_iso()

    # 清空旧数据（仅清空当前学科）
    old_nodes = fetch_all(
        'SELECT id FROM knowledge_graph_nodes WHERE subject = ?', (req.subject,)
    )
    old_node_ids = [str(r['id']) for r in old_nodes]
    if old_node_ids:
        placeholders = ','.join(['?'] * len(old_node_ids))
        execute(f'DELETE FROM knowledge_graph_edges WHERE source_id IN ({placeholders}) OR target_id IN ({placeholders})',
                tuple(old_node_ids * 2))
        execute(f'DELETE FROM user_knowledge_status WHERE knowledge_id IN ({placeholders}) AND user_id = ?',
                tuple(old_node_ids + [user_id]))
        execute(f'DELETE FROM knowledge_graph_nodes WHERE id IN ({placeholders})', tuple(old_node_ids))

    # 调用 AI 生成
    graph_json = await _ai_generate_graph(req.subject, profile)

    if not graph_json:
        # AI 失败时使用 fallback 数据
        graph_json = _fallback_graph_data()

    # 写入数据库
    nodes_data = graph_json.get('nodes', [])
    edges_data = graph_json.get('edges', [])

    for node in nodes_data:
        nid = str(node.get('id', ''))
        if not nid:
            continue
        execute(
            """INSERT OR IGNORE INTO knowledge_graph_nodes
               (id, name, category, subject, difficulty, importance, description, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (nid, str(node.get('name', '')), str(node.get('category', '')), req.subject,
             int(node.get('difficulty', 1)), int(node.get('importance', 3)),
             str(node.get('description', '')), ts),
        )
        # 初始化用户状态（保留已有掌握度）
        existing_status = fetch_one(
            'SELECT mastery FROM user_knowledge_status WHERE user_id = ? AND knowledge_id = ?',
            (user_id, nid),
        )
        if not existing_status:
            execute(
                """INSERT INTO user_knowledge_status (user_id, knowledge_id, mastery, updated_at)
                   VALUES (?, ?, 0, ?)""",
                (user_id, nid, ts),
            )

    for edge in edges_data:
        src = str(edge.get('source', ''))
        tgt = str(edge.get('target', ''))
        if src and tgt:
            execute(
                """INSERT OR IGNORE INTO knowledge_graph_edges (source_id, target_id, relation_type, weight)
                   VALUES (?, ?, ?, ?)""",
                (src, tgt, str(edge.get('type', 'prerequisite')), float(edge.get('weight', 1.0))),
            )

    append_jsonl(user_id, 'learning_events.jsonl', {
        'type': 'graph_generated',
        'subject': req.subject,
        'node_count': len(nodes_data),
        'edge_count': len(edges_data),
    })

    # 返回生成后的完整图谱
    nodes = _fetch_graph_nodes(req.subject)
    edges = _fetch_graph_edges()
    statuses = _fetch_user_statuses(user_id)
    return ok(_build_graph_response(nodes, edges, statuses))


# ── AI 辅助函数 ──────────────────────────────────────────────

async def _ai_generate_graph(subject: str, profile: dict[str, Any]) -> dict[str, Any] | None:
    """调用 LLM 生成知识图谱数据"""
    prompt = (
        f"你是一个 {subject} 教学专家。根据以下学生画像，生成一个 {subject} 知识图谱。\n\n"
        f"学生画像:\n"
        f"- 专业: {profile.get('major', '计算机科学')}\n"
        f"- 学习目标: {json.dumps(profile.get('goal', []), ensure_ascii=False)}\n"
        f"- 薄弱环节: {json.dumps(profile.get('weak_points', []), ensure_ascii=False)}\n"
        f"- 学习偏好: {json.dumps(profile.get('learning_preference', []), ensure_ascii=False)}\n"
        f"- 知识水平: {profile.get('knowledge_level', '入门')}\n"
        f"- 当前阶段: {profile.get('current_stage', '')}\n\n"
        "要求:\n"
        "1. 生成 exactly 50 个知识点，分为 6-8 个分类(category)\n"
        "2. 每个知识点包含: id(格式如 kp_xxx_yyy), name, category, difficulty(1-5), importance(1-5), description\n"
        "3. 标注知识点之间的前置依赖关系(prerequisite)和推荐关系(recommended)\n"
        "4. 根据学生薄弱环节，给相关知识点适当调整难度\n"
        "5. 确保依赖关系形成合理的有向无环图(DAG)\n"
        "6. 仅返回 JSON，不要任何额外文本\n\n"
        "输出格式:\n"
        '{"nodes": [{"id": "kp_xxx", "name": "...", "category": "...", "difficulty": 3, "importance": 4, "description": "..."}], '
        '"edges": [{"source": "kp_aaa", "target": "kp_bbb", "type": "prerequisite", "weight": 0.8}]}'
    )

    text = await _collect_llm_text(prompt)
    if not text:
        return None

    parsed = _extract_json_object(text)
    if not isinstance(parsed, dict) or 'nodes' not in parsed:
        return None

    return parsed


async def _generate_node_suggestion(node: dict, mastery: float, prerequisites: list) -> str:
    """为单个知识点生成 AI 学习建议"""
    prereq_names = [p['name'] for p in prerequisites if p['mastery'] < 80]
    prompt = (
        f"你是学习导师。请为以下知识点给出简短的学习建议（80字以内）。\n\n"
        f"知识点: {node['name']}\n"
        f"分类: {node['category']}\n"
        f"难度: {node.get('difficulty', 1)}/5\n"
        f"当前掌握度: {mastery}%\n"
        f"未掌握的前置知识: {', '.join(prereq_names) if prereq_names else '无'}\n"
        f"描述: {node.get('description', '')}\n\n"
        "要求: 给出具体可执行的下一步建议，不要重复已知信息。"
    )

    parts: list[str] = []
    try:
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode='general', history=[]):
            if evt_type == 'text':
                chunk = str(payload.get('content', ''))
                if chunk:
                    parts.append(chunk)
    except Exception:
        pass

    text = ''.join(parts).strip()
    if text:
        return text

    # fallback 建议
    if mastery <= 0:
        return f"建议从基础文档入手，先理解『{node['name']}』的核心概念，再结合视频教程加深理解。"
    if mastery < 40:
        return f"你在『{node['name']}』刚刚起步，建议通过短练习巩固基础，每天投入15-20分钟。"
    if mastery < 80:
        return f"你在『{node['name']}』有一定基础，建议通过综合练习和项目实战来提升应用能力。"
    return f"你在『{node['name']}』掌握良好，可以尝试挑战更高难度的内容或帮助他人学习。"


async def _collect_llm_text(prompt: str) -> str:
    """收集 LLM 流式输出的完整文本"""
    parts: list[str] = []
    try:
        async for evt_type, payload in spark_lite.stream_chat_events(prompt, mode='general', history=[]):
            if evt_type == 'text':
                chunk = str(payload.get('content', ''))
                if chunk:
                    parts.append(chunk)
    except Exception:
        pass
    return ''.join(parts).strip()


def _extract_json_object(text: str) -> dict[str, Any] | None:
    """从 LLM 输出中提取 JSON 对象"""
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
        obj = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None


def _fallback_graph_data() -> dict[str, Any]:
    """当 AI 生成失败时的 fallback 数据"""
    categories = [
        ('Python 基础', [
            ('kp_python_basics', 'Python 简介与环境搭建', 1, 5, 'Python 语言特点、安装配置、IDE 选择'),
            ('kp_variables', '变量与数据类型', 1, 5, '变量命名、int/float/str/bool、类型转换'),
            ('kp_operators', '运算符与表达式', 1, 4, '算术/比较/逻辑运算、优先级'),
            ('kp_strings', '字符串操作', 2, 4, '格式化、切片、常用方法'),
            ('kp_io', '输入输出', 1, 4, 'print/input、格式化输出'),
        ]),
        ('控制流', [
            ('kp_conditionals', '条件语句', 2, 5, 'if/elif/else、嵌套条件'),
            ('kp_loops', '循环语句', 2, 5, 'for/while、break/continue'),
            ('kp_loop_patterns', '循环模式', 3, 4, '嵌套循环、遍历技巧'),
            ('kp_comprehensions', '推导式', 3, 4, '列表/字典/集合推导式'),
            ('kp_exception', '异常处理', 3, 4, 'try/except/finally、自定义异常'),
        ]),
        ('函数', [
            ('kp_functions', '函数定义与调用', 2, 5, 'def、参数、返回值'),
            ('kp_arguments', '参数类型', 3, 4, '位置/关键字/默认/可变参数'),
            ('kp_scope', '作用域与闭包', 4, 4, 'LEGB 规则、nonlocal'),
            ('kp_decorators', '装饰器', 4, 4, '函数装饰器、带参装饰器'),
            ('kp_generators', '生成器', 4, 3, 'yield、生成器表达式'),
            ('kp_lambda', 'Lambda 与函数式工具', 3, 3, 'lambda/map/filter/reduce'),
        ]),
        ('数据结构', [
            ('kp_lists', '列表', 2, 5, '创建、索引、切片、方法'),
            ('kp_tuples', '元组', 2, 3, '不可变性、命名元组'),
            ('kp_dicts', '字典', 2, 5, '键值操作、遍历、嵌套'),
            ('kp_sets', '集合', 2, 3, '集合运算、去重'),
            ('kp_collections', 'collections 模块', 4, 3, 'Counter/defaultdict/deque'),
            ('kp_sorting', '排序算法', 3, 4, 'sort/sorted、key 函数'),
        ]),
        ('面向对象', [
            ('kp_classes', '类与对象', 3, 5, '类定义、实例化、self'),
            ('kp_attributes', '属性与方法', 3, 4, '实例/类属性、静态方法'),
            ('kp_inheritance', '继承与多态', 4, 5, '继承、方法重写、super'),
            ('kp_encapsulation', '封装', 3, 4, '私有属性、property'),
            ('kp_magic_methods', '魔术方法', 4, 3, '__str__/__repr__/__len__'),
            ('kp_abc', '抽象类与接口', 4, 3, 'ABC、抽象方法'),
        ]),
        ('模块与包', [
            ('kp_modules', '模块系统', 2, 4, 'import、包结构'),
            ('kp_stdlib', '标准库', 3, 4, 'os/sys/json/datetime'),
            ('kp_file_io', '文件操作', 3, 5, '读写文件、with 语句'),
            ('kp_pathlib', 'pathlib 路径处理', 3, 3, 'Path 对象、文件系统操作'),
            ('kp_virtualenv', '虚拟环境', 2, 3, 'venv/pip/依赖管理'),
        ]),
        ('进阶特性', [
            ('kp_iterators', '迭代器协议', 4, 3, 'iter/next、自定义迭代器'),
            ('kp_context_managers', '上下文管理器', 4, 3, '__enter__/__exit__、contextlib'),
            ('kp_type_hints', '类型注解', 3, 3, 'typing 模块、泛型'),
            ('kp_testing', '单元测试', 3, 4, 'unittest/pytest、断言'),
            ('kp_debugging', '调试技巧', 3, 3, 'pdb、logging'),
        ]),
        ('实战应用', [
            ('kp_regex', '正则表达式', 4, 3, 're 模块、模式匹配'),
            ('kp_json_data', 'JSON 数据处理', 3, 4, '序列化、API 数据解析'),
            ('kp_csv_excel', 'CSV/Excel 处理', 3, 3, 'csv/openpyxl'),
            ('kp_requests', 'HTTP 请求', 3, 4, 'requests 库、API 调用'),
            ('kp_data_analysis', '数据分析入门', 4, 4, 'pandas 基础操作'),
            ('kp_project', '综合项目实战', 5, 5, '项目结构、代码组织'),
        ]),
    ]

    nodes = []
    for cat_name, items in categories:
        for nid, name, diff, imp, desc in items:
            nodes.append({
                'id': nid, 'name': name, 'category': cat_name,
                'difficulty': diff, 'importance': imp, 'description': desc,
            })

    # 定义前置依赖关系
    prereq_edges = [
        ('kp_python_basics', 'kp_variables'), ('kp_python_basics', 'kp_io'),
        ('kp_variables', 'kp_operators'), ('kp_variables', 'kp_strings'),
        ('kp_variables', 'kp_conditionals'), ('kp_operators', 'kp_conditionals'),
        ('kp_conditionals', 'kp_loops'), ('kp_loops', 'kp_loop_patterns'),
        ('kp_loops', 'kp_comprehensions'), ('kp_strings', 'kp_functions'),
        ('kp_variables', 'kp_functions'), ('kp_functions', 'kp_arguments'),
        ('kp_functions', 'kp_scope'), ('kp_scope', 'kp_decorators'),
        ('kp_functions', 'kp_generators'), ('kp_functions', 'kp_lambda'),
        ('kp_variables', 'kp_lists'), ('kp_lists', 'kp_tuples'),
        ('kp_lists', 'kp_dicts'), ('kp_dicts', 'kp_sets'),
        ('kp_dicts', 'kp_collections'), ('kp_lists', 'kp_sorting'),
        ('kp_functions', 'kp_classes'), ('kp_classes', 'kp_attributes'),
        ('kp_classes', 'kp_inheritance'), ('kp_classes', 'kp_encapsulation'),
        ('kp_inheritance', 'kp_magic_methods'), ('kp_inheritance', 'kp_abc'),
        ('kp_functions', 'kp_modules'), ('kp_modules', 'kp_stdlib'),
        ('kp_functions', 'kp_file_io'), ('kp_file_io', 'kp_pathlib'),
        ('kp_modules', 'kp_virtualenv'), ('kp_generators', 'kp_iterators'),
        ('kp_scope', 'kp_context_managers'), ('kp_functions', 'kp_type_hints'),
        ('kp_functions', 'kp_testing'), ('kp_testing', 'kp_debugging'),
        ('kp_strings', 'kp_regex'), ('kp_dicts', 'kp_json_data'),
        ('kp_file_io', 'kp_csv_excel'), ('kp_json_data', 'kp_requests'),
        ('kp_dicts', 'kp_data_analysis'), ('kp_classes', 'kp_project'),
        ('kp_file_io', 'kp_project'), ('kp_testing', 'kp_project'),
    ]

    edges = [{'source': s, 'target': t, 'type': 'prerequisite', 'weight': 0.9} for s, t in prereq_edges]

    # 添加一些推荐关系
    rec_edges = [
        ('kp_comprehensions', 'kp_generators'), ('kp_sets', 'kp_collections'),
        ('kp_decorators', 'kp_context_managers'), ('kp_lambda', 'kp_comprehensions'),
        ('kp_sorting', 'kp_data_analysis'), ('kp_regex', 'kp_csv_excel'),
    ]
    edges.extend([{'source': s, 'target': t, 'type': 'recommended', 'weight': 0.5} for s, t in rec_edges])

    return {'nodes': nodes, 'edges': edges}
