import json

import pytest

from app.profile_ai import (
    build_rule_fallback_analysis,
    extract_dialog_profile,
    generate_profile_analysis,
)


def _current_profile() -> dict:
    return {
        "major": "软件工程",
        "grade": "大二",
        "goal": ["完成 Python 项目"],
        "knowledge_level": "掌握基础语法",
        "weak_points": ["异步编程"],
        "learning_preference": ["项目实践"],
        "cognitive_style": "归纳型",
        "daily_time": 45,
        "practical_ability": "能完成小型脚本",
        "current_stage": "工程实践入门",
        "version": 2,
    }


def _analysis_payload(**overrides) -> dict:
    payload = {
        "overview": "有基础的软件工程学习者，正在转向项目实践。",
        "narrative": "学习者已掌握 Python 基础语法，希望通过项目练习提升工程能力，当前需要重点补齐异步编程。",
        "goal_gap": "距离独立完成项目还缺少异步编程与工程组织经验。",
        "strengths": ["基础语法", "小型脚本实践"],
        "focus_areas": ["异步编程", "项目组织"],
        "learning_strategy": "以小项目为主线，在每个迭代中补充一个异步编程知识点。",
        "next_actions": ["完成一个异步爬虫练习", "复盘项目目录结构"],
        "confidence": 0.82,
    }
    payload.update(overrides)
    return payload


def _streaming_response(text: str, *, with_error: bool = False):
    async def stream_events(prompt: str, mode: str, history: list):
        midpoint = len(text) // 2
        if text:
            yield ("text", {"content": text[:midpoint]})
            yield ("text", {"content": text[midpoint:]})
        if with_error:
            yield ("error", {"message": "模型调用失败"})
        yield ("done", {"produced": bool(text), "fallback": not bool(text)})

    return stream_events


def _chunked_response(chunks: list[str]):
    async def stream_events(prompt: str, mode: str, history: list):
        for chunk in chunks:
            yield ("text", {"content": chunk})
        yield ("done", {"produced": bool(chunks), "fallback": not bool(chunks)})

    return stream_events


@pytest.mark.asyncio
async def test_有效_json_生成完整的_llm_画像分析():
    result = await generate_profile_analysis(
        _current_profile(),
        history=[{"version": 1, "current_stage": "语法学习"}],
        source_type="onboarding",
        source_text="我希望通过项目掌握 Python。",
        stream_events=_streaming_response(json.dumps(_analysis_payload(), ensure_ascii=False)),
    )

    assert result["status"] == "ready"
    assert result["schema_version"] == "profile-analysis-v1"
    assert result["generated_by"] == "llm"
    assert result["profile_version"] == 2
    assert result["source_type"] == "onboarding"
    assert result["narrative"]
    assert result["confidence"] == 0.82
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["evidence"][0]["source"] == "onboarding"
    assert result["updated_at"].endswith("Z")


@pytest.mark.asyncio
async def test_流片段边界不会吞掉_json_字符串中的空格():
    model_text = json.dumps(_analysis_payload(overview="有 基础"), ensure_ascii=False)
    split_at = model_text.index("有 基础") + 2

    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=_chunked_response([model_text[:split_at], model_text[split_at:]]),
    )

    assert result["generated_by"] == "llm"
    assert result["overview"] == "有 基础"


@pytest.mark.asyncio
async def test_markdown_代码块中的_json_也能解析():
    model_text = "下面是分析：\n```json\n" + json.dumps(_analysis_payload(), ensure_ascii=False) + "\n```"

    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="dialog",
        source_text="三轮建档原文",
        stream_events=_streaming_response(model_text),
    )

    assert result["generated_by"] == "llm"
    assert result["overview"] == "有基础的软件工程学习者，正在转向项目实践。"


@pytest.mark.asyncio
async def test_前置元数据对象不会抢占后续合法分析_json():
    model_text = (
        "{}\n"
        "```json\n"
        + json.dumps(_analysis_payload(), ensure_ascii=False)
        + "\n```"
    )

    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=_streaming_response(model_text),
    )

    assert result["generated_by"] == "llm"
    assert result["overview"] == "有基础的软件工程学习者，正在转向项目实践。"


@pytest.mark.asyncio
@pytest.mark.parametrize("model_text", ["这不是 JSON", ""])
async def test_非法或空模型输出明确降级而不冒充_llm(model_text: str):
    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="manual_update",
        source_text="",
        stream_events=_streaming_response(model_text),
    )

    assert result["generated_by"] == "rule_fallback"
    assert result["model"] == "rule"
    assert result["status"] == "ready"
    assert result["fallback_reason"] == "模型输出不可用"
    assert "模型输出不可用" in result["analysis_steps"][0]["detail"]
    assert "异步编程" in result["narrative"]


@pytest.mark.asyncio
async def test_错误事件即使携带_json_文本也必须降级():
    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=_streaming_response(
            json.dumps(_analysis_payload(), ensure_ascii=False),
            with_error=True,
        ),
    )

    assert result["generated_by"] == "rule_fallback"


@pytest.mark.asyncio
async def test_空画像直接规则降级且不调用模型():
    called = False

    async def fabricated_stream(prompt: str, mode: str, history: list):
        nonlocal called
        called = True
        yield ("text", {"content": json.dumps(_analysis_payload(narrative="伪造的学习经历"), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    result = await generate_profile_analysis(
        {},
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=fabricated_stream,
    )

    assert called is False
    assert result["generated_by"] == "rule_fallback"
    assert "伪造" not in json.dumps(result, ensure_ascii=False)
    assert result["strengths"] == []
    assert result["focus_areas"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "done_payload",
    [
        {"produced": True, "fallback": True},
        {"produced": False, "fallback": False},
    ],
)
async def test_done_事件声明降级时拒绝此前的合法_json(done_payload: dict):
    async def fallback_stream(prompt: str, mode: str, history: list):
        yield ("text", {"content": json.dumps(_analysis_payload(), ensure_ascii=False)})
        yield ("done", done_payload)

    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=fallback_stream,
    )

    assert result["generated_by"] == "rule_fallback"


@pytest.mark.asyncio
@pytest.mark.parametrize(("raw_confidence", "expected"), [(3.7, 1.0), (-2, 0.0)])
async def test_置信度被钳制在合法区间(raw_confidence: float, expected: float):
    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=_streaming_response(
            json.dumps(_analysis_payload(confidence=raw_confidence), ensure_ascii=False)
        ),
    )

    assert result["generated_by"] == "llm"
    assert result["confidence"] == expected


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "raw_confidence",
    [True, False, None, "不是数字", "0.8", float("nan"), float("inf"), float("-inf")],
)
async def test_非法或非有限置信度使整个模型分析降级(raw_confidence):
    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=_streaming_response(
            json.dumps(_analysis_payload(confidence=raw_confidence), ensure_ascii=False)
        ),
    )

    assert result["generated_by"] == "rule_fallback"


@pytest.mark.asyncio
async def test_数组会清除空值去重并限制数量():
    payload = _analysis_payload(
        strengths=["基础语法", "", " 基础语法 ", None, "脚本实践", "调试能力", "阅读文档", "沟通", "第六项"],
        focus_areas=["异步编程", "异步编程", "", "项目组织"],
        next_actions=["写练习", " 写练习 ", "", "复盘"],
    )

    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=_streaming_response(json.dumps(payload, ensure_ascii=False)),
    )

    assert result["strengths"] == ["基础语法", "脚本实践", "调试能力", "阅读文档", "沟通"]
    assert result["focus_areas"] == ["异步编程", "项目组织"]
    assert result["next_actions"] == ["写练习", "复盘"]


def test_无画像字段的规则降级不会编造事实():
    result = build_rule_fallback_analysis({}, source_type="onboarding", reason="模型服务不可用")

    assert result["generated_by"] == "rule_fallback"
    assert result["profile_version"] == 1
    assert result["strengths"] == []
    assert result["focus_areas"] == []
    assert result["next_actions"] == []
    assert "尚未采集" in result["overview"]
    assert "期末提分" not in json.dumps(result, ensure_ascii=False)
    assert "函数" not in json.dumps(result, ensure_ascii=False)


@pytest.mark.asyncio
async def test_对话画像从模型_json_提取并清理字段():
    extracted = {
        "major": "软件工程",
        "goal": ["参加算法竞赛", "参加算法竞赛", ""],
        "knowledge_level": "掌握 Python 语法",
        "weak_points": ["动态规划", ""],
        "learning_preference": ["图示讲解"],
        "cognitive_style": "演绎型",
        "daily_time": "90",
        "practical_ability": "完成过课程项目",
        "current_stage": "竞赛入门",
    }
    messages = [{"role": "user", "content": "我是软件工程专业，想参加算法竞赛。"}]

    result = await extract_dialog_profile(
        messages,
        fallback_profile={"major": "软件工程", "version": 1},
        stream_events=_streaming_response(json.dumps(extracted, ensure_ascii=False)),
    )

    assert result["major"] == "软件工程"
    assert result["goal"] == ["参加算法竞赛"]
    assert result["weak_points"] == ["动态规划"]
    assert result["daily_time"] == 90
    assert result["version"] == 1
    assert result["updated_at"].endswith("Z")


@pytest.mark.asyncio
async def test_对话提取跳过元数据并选择符合画像结构的候选():
    extracted = {
        "major": "人工智能",
        "goal": ["完成机器学习项目"],
        "knowledge_level": "掌握 Python 基础",
        "weak_points": ["模型评估"],
        "learning_preference": ["案例实践"],
        "cognitive_style": "归纳型",
        "daily_time": 60,
        "practical_ability": "完成过数据分析作业",
        "current_stage": "机器学习入门",
    }
    model_text = (
        '{"major": "错误的单字段候选"}\n'
        "```json\n"
        + json.dumps(extracted, ensure_ascii=False)
        + "\n```"
    )

    result = await extract_dialog_profile(
        [{"role": "user", "content": "我是人工智能专业。"}],
        fallback_profile={"major": "", "version": 1},
        stream_events=_streaming_response(model_text),
    )

    assert result["major"] == "人工智能"
    assert result["goal"] == ["完成机器学习项目"]
    assert result["weak_points"] == ["模型评估"]


@pytest.mark.asyncio
async def test_对话提取失败仅保留已有事实不填固定默认值():
    fallback = {"major": "数据科学", "goal": [], "weak_points": [], "version": 3}

    result = await extract_dialog_profile(
        [{"role": "user", "content": "我还没想好目标。"}],
        fallback_profile=fallback,
        stream_events=_streaming_response("无法提取"),
    )

    assert result["major"] == "数据科学"
    assert result["goal"] == []
    assert result["weak_points"] == []
    assert result["learning_preference"] == []
    assert result["knowledge_level"] == ""
    assert "期末提分" not in json.dumps(result, ensure_ascii=False)
    assert "函数" not in json.dumps(result, ensure_ascii=False)


@pytest.mark.asyncio
async def test_总模型文本超过上限后不再接受尾部分析_json():
    payload_text = json.dumps(_analysis_payload(), ensure_ascii=False)

    async def oversized_stream(prompt: str, mode: str, history: list):
        yield ("text", {"content": "x" * 12_000})
        yield ("text", {"content": "y" * 12_000})
        yield ("text", {"content": payload_text})
        yield ("done", {"produced": True, "fallback": False})

    result = await generate_profile_analysis(
        _current_profile(),
        history=[],
        source_type="onboarding",
        source_text="",
        stream_events=oversized_stream,
    )

    assert result["generated_by"] == "rule_fallback"
