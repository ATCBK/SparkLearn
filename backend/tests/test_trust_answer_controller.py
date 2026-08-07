from __future__ import annotations

import pytest

from app.trust_answer_controller import TrustAnswerController
from app.trust_retriever import retrieve_evidence
from app.trust_schemas import RoutedQuery, TrustAnswerRequest
from app.storage import write_json


def test_trust_answer_prompt_includes_mcp_context() -> None:
    controller = TrustAnswerController()
    req = TrustAnswerRequest(
        scene='tutor',
        query='信阳天气',
        role_prompt='你是耐心导师',
        page_prompt='页面上下文',
        memory_prompt='学习记忆',
        mcp_prompt='工具: get_weather\n结果:\n晴天 28°C',
    )

    prompt = controller._build_prompt(
        req=req,
        decision=type('Decision', (), {'confidence_level': 'high', 'confidence_score': 0.9})(),
        citations=[],
    )

    assert '[MCP 工具结果]' in prompt
    assert '工具: get_weather' in prompt
    assert '晴天 28°C' in prompt
    assert '无法直接查询' in prompt


@pytest.mark.anyio
async def test_trust_retriever_reads_profile_from_request_user(client) -> None:
    write_json(
        'single_user',
        'profile_snapshot.json',
        {'major': '默认专业', 'goal': ['默认目标'], 'weak_points': ['默认用户薄弱点'], 'current_stage': '默认阶段'},
    )
    write_json(
        'student_b',
        'profile_snapshot.json',
        {'major': '真实专业', 'goal': ['真实目标'], 'weak_points': ['B 用户专属薄弱点'], 'current_stage': '真实阶段'},
    )

    req = TrustAnswerRequest(scene='tutor', query='我该怎么复习', user_id='student_b', use_profile=True)
    routed = RoutedQuery(
        query_type='study',
        risk_level='low',
        need_knowledge=False,
        need_profile=True,
        need_memory=False,
        need_rules=False,
        need_user_files=False,
    )

    bundle = await retrieve_evidence(req, routed)

    assert len(bundle.profile) == 1
    assert bundle.profile[0].source_id == 'student_b'
    assert 'B 用户专属薄弱点' in bundle.profile[0].snippet
    assert '默认用户薄弱点' not in bundle.profile[0].snippet
