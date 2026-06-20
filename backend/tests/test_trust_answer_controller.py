from __future__ import annotations

from app.trust_answer_controller import TrustAnswerController
from app.trust_schemas import TrustAnswerRequest


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
