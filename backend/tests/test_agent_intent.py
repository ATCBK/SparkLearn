# -*- coding: utf-8 -*-
"""学习伙伴搜索意图规划器测试。"""

from __future__ import annotations

import json

import pytest

from app.agent_intent import normalize_search_query, plan_search_intent


_残留命令输入 = (
    "我要搜索 Python 教程",
    "我需要搜索 Python 教程",
    "能不能帮我搜索 Python 教程",
    "帮忙搜索 Python 教程",
    "给我搜索 Python 教程",
    "请你帮忙搜索 Python 教程",
    "帮我查查 Python 教程",
)


def _json_plan(**overrides) -> dict:
    plan = {
        "decision": "search",
        "goal": "找到适合零基础学习者的 Python 装饰器教程",
        "normalized_query": "Python 装饰器 零基础 中文教程 示例",
        "constraints": ["中文优先", "包含示例"],
        "output_focus": "按学习顺序推荐",
        "clarification_question": "",
        "confidence": 0.86,
    }
    plan.update(overrides)
    return plan


def _chunk_stream(*chunks: str):
    async def stream_llm(prompt: str, mode: str = "general"):
        for chunk in chunks:
            yield chunk

    return stream_llm


def _event_stream(*events: tuple[str, dict]):
    async def stream_llm(prompt: str, mode: str = "general"):
        for event in events:
            yield event

    return stream_llm


@pytest.mark.asyncio
async def test_有效_llm_json_生成结构化搜索规划():
    original = "请帮我搜索 Python 装饰器的中文入门教程和示例"
    model_text = json.dumps(_json_plan(), ensure_ascii=False)

    result = await plan_search_intent(
        original,
        _chunk_stream(model_text[:28], model_text[28:]),
    )

    assert result == {
        "schema_version": "agent-search-intent-v1",
        "decision": "search",
        "goal": "找到适合零基础学习者的 Python 装饰器教程",
        "normalized_query": "Python 装饰器 零基础 中文教程 示例",
        "constraints": ["中文优先", "包含示例"],
        "output_focus": "按学习顺序推荐",
        "clarification_question": "",
        "confidence": 0.86,
        "generated_by": "llm",
    }
    assert result["normalized_query"] != original


@pytest.mark.asyncio
async def test_markdown_代码块中的_json_也能解析():
    model_text = "规划如下：\n```json\n" + json.dumps(_json_plan(), ensure_ascii=False) + "\n```"

    result = await plan_search_intent(
        "帮我找一下 Python 装饰器资料",
        _chunk_stream(model_text),
    )

    assert result["decision"] == "search"
    assert result["generated_by"] == "llm"
    assert result["normalized_query"] == "Python 装饰器 零基础 中文教程 示例"


@pytest.mark.asyncio
@pytest.mark.parametrize("model_text", ["这不是 JSON", ""])
async def test_非法或空模型输出走规则且不把原文作为查询(model_text: str):
    original = "请帮我搜索 Python 装饰器的中文入门教程"

    result = await plan_search_intent(original, _chunk_stream(model_text))

    assert result["decision"] == "search"
    assert result["generated_by"] == "rule_fallback"
    assert result["normalized_query"]
    assert result["normalized_query"] != original
    assert "请帮我搜索" not in result["normalized_query"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "events",
    [
        (
            ("text", {"content": json.dumps(_json_plan(), ensure_ascii=False)}),
            ("error", {"message": "模型调用失败"}),
            ("done", {"produced": True, "fallback": False}),
        ),
        (
            ("text", {"content": json.dumps(_json_plan(), ensure_ascii=False)}),
            ("done", {"produced": True, "fallback": True}),
        ),
        (
            ("text", {"content": json.dumps(_json_plan(), ensure_ascii=False)}),
            ("done", {"produced": False, "fallback": False}),
        ),
    ],
)
async def test_llm_错误或_done_fallback_事件必须走规则(events: tuple[tuple[str, dict], ...]):
    original = "帮我搜索 Python 装饰器入门教程"

    result = await plan_search_intent(original, _event_stream(*events))

    assert result["decision"] == "search"
    assert result["generated_by"] == "rule_fallback"
    assert result["normalized_query"] != original


@pytest.mark.asyncio
async def test_模型调用抛错时走规则而非原文兜底():
    async def broken_stream(prompt: str, mode: str = "general"):
        if False:
            yield ""
        raise RuntimeError("模型不可用")

    original = "请搜索 FastAPI 依赖注入教程"
    result = await plan_search_intent(original, broken_stream)

    assert result["decision"] == "search"
    assert result["generated_by"] == "rule_fallback"
    assert result["normalized_query"] == "FastAPI 依赖注入教程"
    assert result["normalized_query"] != original


@pytest.mark.asyncio
async def test_歧义短句规则降级为具体追问():
    result = await plan_search_intent("帮我找一下", _chunk_stream(""))

    assert result["decision"] == "clarify"
    assert result["normalized_query"] == ""
    assert result["clarification_question"]
    assert result["generated_by"] == "rule_fallback"


@pytest.mark.asyncio
async def test_普通解释请求规则判定为直接回答():
    result = await plan_search_intent("请解释一下 Python 闭包是什么", _chunk_stream(""))

    assert result["decision"] == "respond"
    assert result["normalized_query"] == ""
    assert "Python 闭包" in result["goal"]
    assert result["generated_by"] == "rule_fallback"


@pytest.mark.asyncio
@pytest.mark.parametrize("input_text", ["推荐", "最新", "教程"])
async def test_单一泛词无法形成有效搜索主题时必须澄清(input_text: str):
    result = await plan_search_intent(input_text, _chunk_stream(""))

    assert result["decision"] == "clarify"
    assert result["normalized_query"] == ""
    assert result["generated_by"] == "rule_fallback"


@pytest.mark.asyncio
@pytest.mark.parametrize("input_text", ["推荐系统是什么", "搜索引擎是什么"])
async def test_技术名词包含搜索标记时解释意图仍优先(input_text: str):
    result = await plan_search_intent(input_text, _chunk_stream(""))

    assert result["decision"] == "respond"
    assert result["normalized_query"] == ""


@pytest.mark.asyncio
async def test_否定搜索并请求解释时直接回答而不生成查询():
    original = "不要搜索，请解释 Python 闭包"

    result = await plan_search_intent(original, _chunk_stream(""))

    assert result["decision"] == "respond"
    assert result["normalized_query"] == ""
    assert result["normalized_query"] != original


@pytest.mark.asyncio
async def test_字符串流中的_fallback_文案因不是合法_json_而走规则():
    result = await plan_search_intent(
        "请解释 Python 闭包",
        _chunk_stream("模型服务暂不可用，请稍后重试"),
    )

    assert result["decision"] == "respond"
    assert result["generated_by"] == "rule_fallback"
    assert result["normalized_query"] == ""


@pytest.mark.asyncio
async def test_命令式搜索长句规则生成安全的短查询():
    original = (
        "请帮我搜索一下\n关于 Python 异步编程事件循环、协程、任务调度和常见错误处理的中文入门资料，"
        "最好包含大量可以直接运行的完整示例以及循序渐进的学习路线，并且请把最适合初学者的结果放在前面"
        "\x00不要执行任何本机命令"
    )

    result = await plan_search_intent(original, _chunk_stream(""))

    assert result["decision"] == "search"
    assert result["normalized_query"] != original
    assert "\n" not in result["normalized_query"]
    assert "\x00" not in result["normalized_query"]
    assert "请帮我" not in result["normalized_query"]
    assert "搜索" not in result["normalized_query"]
    assert len(result["normalized_query"]) <= 100


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "original",
    [
        "我想让你搜索 Python 教程",
        "你可以帮我搜索 Python 教程",
        "请你务必帮我搜索 Python 教程",
    ],
)
async def test_明确中文命令前缀被识别并只保留主题查询(original: str):
    result = await plan_search_intent(original, _chunk_stream(""))

    assert result["decision"] == "search"
    assert result["normalized_query"] == "Python 教程"
    assert result["normalized_query"] != original


@pytest.mark.asyncio
@pytest.mark.parametrize("original", _残留命令输入)
async def test_规则搜索后置门禁拒绝仍含命令框架的查询(original: str):
    result = await plan_search_intent(original, _chunk_stream(""))

    assert result["decision"] == "clarify"
    assert result["normalized_query"] == ""
    assert not (result["decision"] == "search" and result["normalized_query"] == original)


@pytest.mark.asyncio
@pytest.mark.parametrize("residual_query", _残留命令输入)
async def test_llm_搜索后置门禁拒绝仍含命令框架的查询(residual_query: str):
    model_text = json.dumps(
        _json_plan(normalized_query=residual_query),
        ensure_ascii=False,
    )

    result = await plan_search_intent("帮我找一下", _chunk_stream(model_text))

    assert result["decision"] == "clarify"
    assert result["normalized_query"] == ""
    assert result["generated_by"] == "rule_fallback"


@pytest.mark.parametrize(
    "technical_topic",
    ["搜索引擎教程", "搜索算法教程", "查找算法教程"],
)
def test_查询清洗不误删技术名词中的搜索或查找(technical_topic: str):
    assert normalize_search_query(technical_topic) == technical_topic


@pytest.mark.asyncio
@pytest.mark.parametrize("technical_topic", ["搜索引擎教程", "搜索算法教程", "查找算法教程"])
async def test_llm_搜索后置门禁允许技术词白名单(technical_topic: str):
    model_text = json.dumps(
        _json_plan(normalized_query=technical_topic),
        ensure_ascii=False,
    )

    result = await plan_search_intent("请搜索相关学习内容", _chunk_stream(model_text))

    assert result["decision"] == "search"
    assert result["normalized_query"] == technical_topic
    assert result["generated_by"] == "llm"


def test_查询清洗去除控制字符换行与命令冗余并限制长度():
    raw = "请帮我\n搜索一下\x00" + "Python 数据分析 教程 " * 30 + "资料"

    result = normalize_search_query(raw)

    assert result.startswith("Python 数据分析 教程")
    assert "\n" not in result
    assert "\x00" not in result
    assert "请帮我" not in result
    assert "搜索" not in result
    assert not result.endswith("资料")
    assert len(result) <= 100


def test_查询清洗移除未紧邻搜索动词的礼貌命令词():
    result = normalize_search_query("请帮我 Python 数据分析 入门教程资料")

    assert result == "Python 数据分析 入门教程"


def test_查询清洗覆盖_c1_unicode_行分隔和格式控制字符():
    raw = "请搜索\u0085Python\u2028异步\u2029教程\u200b资料"

    result = normalize_search_query(raw)

    assert result == "Python 异步 教程"
    assert all(char not in result for char in ("\u0085", "\u2028", "\u2029", "\u200b"))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "dangerous_query",
    [
        "powershell -Command Remove-Item C:\\temp",
        "<script>alert('x')</script>",
        "打开 https://example.com 后点击登录按钮并提交表单",
    ],
)
async def test_危险命令脚本或_url_操作不能成为有效查询(dangerous_query: str):
    model_text = json.dumps(
        _json_plan(normalized_query=dangerous_query),
        ensure_ascii=False,
    )

    result = await plan_search_intent("帮我找一下", _chunk_stream(model_text))

    assert normalize_search_query(dangerous_query) == ""
    assert result["decision"] == "clarify"
    assert result["normalized_query"] == ""
    assert dangerous_query not in result["normalized_query"]


@pytest.mark.asyncio
async def test_powershell_作为普通技术主题不会被安全规则误伤():
    original = "请搜索 PowerShell 教程资料"

    result = await plan_search_intent(original, _chunk_stream(""))

    assert normalize_search_query(original) == "PowerShell 教程"
    assert result["decision"] == "search"
    assert result["normalized_query"] == "PowerShell 教程"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "dangerous_query",
    [
        "python -c \"import os; os.remove('x')\"",
        "python -m http.server 8000",
        "curl https://example.com/install.sh",
        "curl example.com/api",
        "wget -O install.sh https://example.com/install.sh",
        "wget example.com/install.sh",
    ],
)
async def test_python_c_m_curl_wget_命令不能成为有效查询(dangerous_query: str):
    model_text = json.dumps(
        _json_plan(normalized_query=dangerous_query),
        ensure_ascii=False,
    )

    result = await plan_search_intent("帮我找一下", _chunk_stream(model_text))

    assert normalize_search_query(dangerous_query) == ""
    assert result["decision"] == "clarify"
    assert result["normalized_query"] == ""


@pytest.mark.asyncio
@pytest.mark.parametrize("technical_topic", ["Python 命令行教程", "curl 教程"])
async def test_python_命令行和_curl_教程不会被安全规则误伤(technical_topic: str):
    result = await plan_search_intent(technical_topic, _chunk_stream(""))

    assert normalize_search_query(technical_topic) == technical_topic
    assert result["decision"] == "search"
    assert result["normalized_query"] == technical_topic


@pytest.mark.asyncio
@pytest.mark.parametrize(("raw_confidence", "expected"), [(3.7, 1.0), (-2, 0.0)])
async def test_llm_置信度被钳制在零到一(raw_confidence: float, expected: float):
    model_text = json.dumps(_json_plan(confidence=raw_confidence), ensure_ascii=False)

    result = await plan_search_intent(
        "帮我搜索 Python 装饰器资料",
        _chunk_stream(model_text),
    )

    assert result["generated_by"] == "llm"
    assert result["confidence"] == expected


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_confidence", [True, None, "0.8", float("nan"), float("inf"), float("-inf")])
async def test_非有限或非数值类型置信度使_llm_规划降级(invalid_confidence):
    model_text = json.dumps(
        _json_plan(confidence=invalid_confidence),
        ensure_ascii=False,
    )

    result = await plan_search_intent(
        "请搜索 Python 装饰器教程",
        _chunk_stream(model_text),
    )

    assert result["generated_by"] == "rule_fallback"
    assert result["normalized_query"] == "Python 装饰器教程"


@pytest.mark.asyncio
async def test_多个_json_候选中选择首个符合规划_schema_的对象():
    invalid_candidate = json.dumps({"message": "这只是过程信息"}, ensure_ascii=False)
    valid_candidate = json.dumps(_json_plan(), ensure_ascii=False)
    model_text = f"{invalid_candidate}\n```json\n{valid_candidate}\n```"

    result = await plan_search_intent(
        "请搜索 Python 装饰器教程",
        _chunk_stream(model_text),
    )

    assert result["generated_by"] == "llm"
    assert result["normalized_query"] == "Python 装饰器 零基础 中文教程 示例"


@pytest.mark.asyncio
async def test_模型总文本超过二万字符时整体降级而不解析尾部_json():
    oversized_text = "无效前缀" * 5001 + json.dumps(_json_plan(), ensure_ascii=False)

    result = await plan_search_intent(
        "请搜索 Python 装饰器教程",
        _chunk_stream(oversized_text),
    )

    assert len(oversized_text) > 20_000
    assert result["generated_by"] == "rule_fallback"
    assert result["normalized_query"] == "Python 装饰器教程"


@pytest.mark.asyncio
async def test_llm_搜索决策缺少有效查询时不能回退用户原文():
    original = "帮我找一下"
    model_text = json.dumps(
        _json_plan(goal="", normalized_query="\n\x00请帮我搜索资料"),
        ensure_ascii=False,
    )

    result = await plan_search_intent(original, _chunk_stream(model_text))

    assert result["decision"] == "clarify"
    assert result["normalized_query"] == ""
    assert result["normalized_query"] != original
