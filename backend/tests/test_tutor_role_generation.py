import json

import pytest

from app.routes import tutor_eval


@pytest.mark.asyncio
async def test_generate_role_from_question_uses_profile_and_persists(monkeypatch):
    captured = {}

    def fake_execute_returning_id(query, params):
        captured["query"] = query
        captured["params"] = params
        return 77

    def fake_fetch_one(*args, **kwargs):
        return {
            "id": 77,
            "name": "函数提分导师",
            "persona": "角色身份：函数领域提分型导师\n服务场景：高中阶段函数题目讲解",
            "background": "专属工作流：先拆题再示范",
            "style_guide": "输出格式：先结论后步骤",
            "rules": "禁止事项：不直接给答案\n\n示例对话（2-3 轮短示例）：\n用户：我不会函数\n导师：先看定义",
            "enabled": 1,
            "created_at": "2026-06-19T00:00:00Z",
            "updated_at": "2026-06-19T00:00:00Z",
        }

    async def fake_generate_role_from_question(question):
        assert question == "我想快速补函数"
        return {
            "name": "函数提分导师",
            "persona": "角色身份：函数领域提分型导师\n服务场景：高中阶段函数题目讲解",
            "background": "专属工作流：先拆题再示范",
            "style_guide": "输出格式：先结论后步骤",
            "rules": "禁止事项：不直接给答案\n\n示例对话（2-3 轮短示例）：\n用户：我不会函数\n导师：先看定义",
        }

    monkeypatch.setattr(tutor_eval, "_generate_role_from_question", fake_generate_role_from_question)
    monkeypatch.setattr(tutor_eval, "_execute_returning_id", fake_execute_returning_id)
    monkeypatch.setattr(tutor_eval, "fetch_one", fake_fetch_one)

    result = await tutor_eval.generate_role_from_question(tutor_eval.GenerateRoleReq(question="我想快速补函数"))

    assert result.success is True
    assert result.data["name"] == "函数提分导师"
    assert "INSERT INTO tutor_roles" in captured["query"]
    assert "角色身份" in captured["params"][2]
    assert "示例对话" in captured["params"][5]


@pytest.mark.asyncio
async def test_generate_role_from_question_uses_ai_analysis_and_generation(monkeypatch):
    prompts = []

    async def fake_collect_llm_text(prompt, mode='general', model=''):
        prompts.append(prompt)
        if "结构化画像" in prompt:
            return json.dumps(
                {
                    "subject_label": "函数",
                    "intent_label": "提分强化",
                    "archetype": "提分型",
                    "stage_hint": "高中阶段",
                    "goals_hint": "函数提分",
                    "weak_points_hint": "函数定义、函数图像",
                    "preference_hint": "先例题后总结",
                },
                ensure_ascii=False,
            )
        return json.dumps(
            {
                "name": "函数提分导师",
                "role_identity": "你是函数领域的提分型导师，核心任务是围绕提分强化展开。",
                "service_scenarios": "适配高中阶段的函数讲解与复盘场景。",
                "workflow": "1. 先判断场景；2. 再拆步骤。",
                "output_format": "先结论后步骤。",
                "prohibitions": "不要直接给答案。",
                "sample_dialogue": "用户：我不会函数。\n导师：先看定义。",
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr(tutor_eval, "_collect_llm_text", fake_collect_llm_text)
    monkeypatch.setattr(
        tutor_eval,
        "_load_profile_snapshot",
        lambda: {
            "goal": ["函数提分"],
            "weak_points": ["函数定义", "函数图像"],
            "learning_preference": ["先例题后总结"],
            "current_stage": "高中阶段",
        },
    )

    result = await tutor_eval._generate_role_from_question("我想快速补函数")

    assert result["name"] == "函数提分导师"
    assert "我想快速补函数" not in result["persona"]
    assert "我想快速补函数" not in result["background"]
    assert "角色身份" in result["persona"]
    assert "专属工作流" in result["background"]
    assert "输出格式" in result["style_guide"]
    assert "示例对话" in result["rules"]
    assert len(prompts) == 2
    assert "结构化画像" in prompts[0]
    assert "结构化分析" in prompts[1]
    assert "我想快速补函数" in prompts[0]
    assert "我想快速补函数" not in prompts[1]


def test_analyze_role_request_prefers_structured_signals():
    profile = {
        "goal": ["函数提分"],
        "weak_points": ["函数定义", "函数图像"],
        "learning_preference": ["先例题后总结"],
        "current_stage": "高中阶段",
    }

    analysis = tutor_eval._analyze_role_request("我想快速补函数", profile)

    assert analysis["subject_label"] == "函数"
    assert analysis["intent_label"] == "提分强化"
    assert analysis["archetype"] == "提分型"
    assert analysis["goals"] == "函数提分"
    assert analysis["weak_points"] == "函数定义、函数图像"
    assert analysis["preference"] == "先例题后总结"
