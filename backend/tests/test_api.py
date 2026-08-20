import pytest


from io import BytesIO

from docx import Document

import json

from app.auth import create_access_token
from app.config import settings
from app.db import execute, fetch_one, now_iso
from app.routes import profile as profile_route


def _profile_analysis_payload(narrative: str, confidence: float = 0.78) -> dict:
    return {
        "overview": "当前画像概览",
        "narrative": narrative,
        "goal_gap": "当前基础与学习目标之间仍有可验证的差距。",
        "strengths": ["愿意实践"],
        "focus_areas": ["递归"],
        "learning_strategy": "结合案例练习并及时复盘。",
        "next_actions": ["完成一次递归练习"],
        "confidence": confidence,
    }


def _analysis_file(user_id: str | None = None):
    return settings.data_dir / "users" / (user_id or settings.single_user_id) / "profile_ai_analysis.json"


def _history_file(user_id: str | None = None):
    return settings.data_dir / "users" / (user_id or settings.single_user_id) / "profile_history.json"


def _snapshot_file(user_id: str | None = None):
    return settings.data_dir / "users" / (user_id or settings.single_user_id) / "profile_snapshot.json"


def _events_file(user_id: str | None = None):
    return settings.data_dir / "users" / (user_id or settings.single_user_id) / "learning_events.jsonl"


@pytest.mark.asyncio
async def test_profile_onboarding_and_get(client):
    payload = {
        "goal": ["期末提分"],
        "level": ["有一些基础"],
        "weak": ["函数"],
        "preference": ["实践型"],
        "time": ["30-60分钟"],
    }
    r = await client.post("/api/profile/onboarding", json=payload)
    assert r.status_code == 200
    assert r.json()["success"] is True

    p = await client.get("/api/profile")
    body = p.json()
    assert body["success"] is True
    assert "goal" in body["data"]


@pytest.mark.asyncio
async def test_profile_get_无画像时返回404且保留统一失败结构(client):
    execute("DELETE FROM profiles WHERE user_id = ?", (settings.single_user_id,))

    response = await client.get("/api/profile")

    assert response.status_code == 404
    assert response.json() == {"success": False, "data": None, "error": "profile not found"}


@pytest.mark.asyncio
async def test_profile_onboarding_自动保存分析且读取保持同一版本(client, monkeypatch):
    prompts: list[str] = []
    model_payload = _profile_analysis_payload("问卷字段关联形成的综合画像。")

    async def fake_stream(prompt: str, mode: str, history: list):
        prompts.append(prompt)
        yield ("text", {"content": json.dumps(model_payload, ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    response = await client.post(
        "/api/profile/onboarding",
        json={
            "name": "来源文本专用昵称",
            "grade": "大二",
            "major": ["软件工程"],
            "goal": ["完成 Python 项目"],
            "level": ["掌握基础语法"],
            "weak": ["递归"],
            "preference": ["项目实践"],
            "time": ["30-60分钟"],
        },
    )

    assert response.status_code == 200
    saved = json.loads(_analysis_file().read_text(encoding="utf-8"))
    assert saved["generated_by"] == "llm"
    assert saved["profile_version"] == 2
    assert saved["narrative"] == "问卷字段关联形成的综合画像。"
    assert "来源文本专用昵称" not in prompts[0]
    assert "完成 Python 项目" in prompts[0]
    assert "大二" in prompts[0]

    current = await client.get("/api/profile/analysis/current")
    assert current.status_code == 200
    assert current.json()["data"] == saved

    history = json.loads(_history_file().read_text(encoding="utf-8"))
    assert history[0]["narrative"] == saved["narrative"]
    assert history[0]["analysis_source"] == "llm"
    assert history[0]["confidence"] == 0.78
    assert history[0]["grade"] == "大二"
    assert "来源文本专用昵称" not in _events_file().read_text(encoding="utf-8")
    profile = (await client.get("/api/profile")).json()["data"]
    assert profile["grade"] == "大二"


@pytest.mark.asyncio
async def test_profile_onboarding_空选项不会生成通用默认画像(client, monkeypatch):
    called = False

    async def unexpected_stream(prompt: str, mode: str, history: list):
        nonlocal called
        called = True
        yield ("text", {"content": json.dumps(_profile_analysis_payload("伪造画像"), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", unexpected_stream)
    before = (await client.get("/api/profile")).json()["data"]
    response = await client.post("/api/profile/onboarding", json={"name": "不应写入的昵称"})

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (await client.get("/api/profile")).json()["data"] == before
    assert called is False
    assert _analysis_file().exists() is False
    assert _events_file().exists() is False


@pytest.mark.asyncio
async def test_profile_onboarding_模型失败保存明确规则降级(client, monkeypatch):
    async def failed_stream(prompt: str, mode: str, history: list):
        yield ("error", {"message": "模型不可用"})
        yield ("done", {"produced": False, "fallback": True})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", failed_stream)
    await client.post(
        "/api/profile/onboarding",
        json={"major": ["数据科学"], "goal": ["完成数据分析项目"], "weak": ["统计推断"]},
    )

    saved = json.loads(_analysis_file().read_text(encoding="utf-8"))
    assert saved["generated_by"] == "rule_fallback"
    assert saved["model"] == "rule"
    history = json.loads(_history_file().read_text(encoding="utf-8"))
    assert history[0]["analysis_source"] == "rule_fallback"


@pytest.mark.asyncio
async def test_profile_analysis_文件缺失时只读返回规则结果(client, monkeypatch):
    async def valid_stream(prompt: str, mode: str, history: list):
        yield ("text", {"content": json.dumps(_profile_analysis_payload("临时分析"), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", valid_stream)
    await client.post(
        "/api/profile/onboarding",
        json={"major": ["人工智能"], "goal": ["完成课程项目"], "weak": ["模型评估"]},
    )
    _analysis_file().unlink()

    response = await client.get("/api/profile/analysis/current")

    assert response.status_code == 200
    assert response.json()["data"]["generated_by"] == "rule_fallback"
    assert response.json()["data"]["profile_version"] == 2
    assert _analysis_file().exists() is False


@pytest.mark.asyncio
async def test_profile_analysis_旧版本文件不能污染当前分析和历史(client, monkeypatch):
    async def valid_stream(prompt: str, mode: str, history: list):
        yield ("text", {"content": json.dumps(_profile_analysis_payload("版本一旧叙述", 0.93), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", valid_stream)
    await client.post(
        "/api/profile/onboarding",
        json={"major": ["人工智能"], "goal": ["完成课程项目"], "weak": ["模型评估"]},
    )
    stale_file = json.loads(_analysis_file().read_text(encoding="utf-8"))
    execute(
        "UPDATE profiles SET version = ?, goal = ?, updated_at = ? WHERE user_id = ?",
        (3, json.dumps(["更新后的学习目标"], ensure_ascii=False), now_iso(), settings.single_user_id),
    )

    current = (await client.get("/api/profile/analysis/current")).json()["data"]

    assert current["generated_by"] == "rule_fallback"
    assert current["profile_version"] == 3
    assert "版本一旧叙述" not in current["narrative"]
    assert json.loads(_analysis_file().read_text(encoding="utf-8")) == stale_file

    history_response = await client.get("/api/profile/history")
    latest = history_response.json()["data"]["items"][0]
    assert latest["version"] == 3
    assert latest["narrative"] != "版本一旧叙述"
    assert latest["analysis_source"] == "legacy_unverified"
    assert latest["confidence"] == 0.0


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_kind", ["wrong_status", "missing_required_field"])
async def test_profile_analysis_结构不完整时只读规则降级(client, monkeypatch, invalid_kind: str):
    async def valid_stream(prompt: str, mode: str, history: list):
        yield ("text", {"content": json.dumps(_profile_analysis_payload("原始模型叙述"), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", valid_stream)
    await client.post(
        "/api/profile/onboarding",
        json={"major": ["软件工程"], "goal": ["完成工程项目"]},
    )
    invalid = json.loads(_analysis_file().read_text(encoding="utf-8"))
    if invalid_kind == "wrong_status":
        invalid["status"] = "pending"
    else:
        invalid.pop("narrative")
    _analysis_file().write_text(json.dumps(invalid, ensure_ascii=False), encoding="utf-8")

    response = await client.get("/api/profile/analysis/current")

    assert response.json()["data"]["generated_by"] == "rule_fallback"
    assert response.json()["data"]["profile_version"] == 2
    assert json.loads(_analysis_file().read_text(encoding="utf-8")) == invalid


@pytest.mark.asyncio
async def test_profile_onboarding_重复建档递增版本并替换分析(client, monkeypatch):
    analyses = iter(
        [
            _profile_analysis_payload("第一次建档分析"),
            _profile_analysis_payload("第二次建档分析"),
        ]
    )

    async def fake_stream(prompt: str, mode: str, history: list):
        yield ("text", {"content": json.dumps(next(analyses), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    first = await client.post(
        "/api/profile/onboarding",
        json={"major": ["软件工程"], "goal": ["完成课程项目"]},
    )
    second = await client.post(
        "/api/profile/onboarding",
        json={"major": ["软件工程"], "goal": ["独立完成工程项目"]},
    )

    assert first.json()["data"]["version"] == 2
    assert second.json()["data"]["version"] == 3
    saved = json.loads(_analysis_file().read_text(encoding="utf-8"))
    assert saved["profile_version"] == 3
    assert saved["narrative"] == "第二次建档分析"


@pytest.mark.asyncio
async def test_profile_onboarding_快照缺失时仍按数据库版本递增(client, monkeypatch):
    prompts: list[str] = []

    async def fake_stream(prompt: str, mode: str, history: list):
        prompts.append(prompt)
        yield ("text", {"content": json.dumps(_profile_analysis_payload("建档分析"), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    first = await client.post(
        "/api/profile/onboarding",
        json={"major": ["软件工程"], "goal": ["完成课程项目"]},
    )
    _snapshot_file().unlink()

    second = await client.post(
        "/api/profile/onboarding",
        json={"goal": ["独立完成工程项目"]},
    )

    assert first.json()["data"]["version"] == 2
    assert second.json()["data"]["version"] == 3
    assert json.loads(_analysis_file().read_text(encoding="utf-8"))["profile_version"] == 3
    assert "软件工程" in prompts[-1]
    assert json.loads(_history_file().read_text(encoding="utf-8"))[0]["major"] == "软件工程"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("time_option", "expected_daily_minutes"),
    [
        ("5小时以下", 30),
        ("5-10小时", 60),
        ("10-20小时", 120),
        ("20小时以上", 180),
        ("30-60分钟", 45),
        ("1-2小时", 90),
        ("2小时以上", 150),
    ],
)
async def test_profile_onboarding_学习时间选项映射为每日分钟(
    client,
    monkeypatch,
    time_option: str,
    expected_daily_minutes: int,
):
    async def failed_stream(prompt: str, mode: str, history: list):
        yield ("error", {"message": "模型不可用"})
        yield ("done", {"produced": False, "fallback": True})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", failed_stream)
    response = await client.post(
        "/api/profile/onboarding",
        json={"goal": ["完成学习计划"], "time": [time_option]},
    )

    assert response.json()["success"] is True
    profile = (await client.get("/api/profile")).json()["data"]
    assert profile["daily_time"] == expected_daily_minutes


@pytest.mark.asyncio
async def test_profile_manual_update_版本加一并刷新分析和历史(client, monkeypatch):
    analyses = iter(
        [
            _profile_analysis_payload("初始综合画像。", 0.61),
            _profile_analysis_payload("更新后的综合画像。", 0.86),
        ]
    )

    async def fake_stream(prompt: str, mode: str, history: list):
        yield ("text", {"content": json.dumps(next(analyses), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    await client.post(
        "/api/profile/onboarding",
        json={"major": ["软件工程"], "goal": ["完成课程项目"], "weak": ["递归"]},
    )
    response = await client.put(
        "/api/profile",
        json={"goal": ["独立完成工程项目"], "weak_points": ["并发编程"]},
    )

    assert response.json()["data"]["version"] == 3
    current = (await client.get("/api/profile/analysis/current")).json()["data"]
    assert current["profile_version"] == 3
    assert current["narrative"] == "更新后的综合画像。"
    history = json.loads(_history_file().read_text(encoding="utf-8"))
    assert history[0]["version"] == 3
    assert history[0]["narrative"] == "更新后的综合画像。"
    assert history[0]["analysis_source"] == "llm"
    assert history[0]["confidence"] == 0.86


@pytest.mark.asyncio
async def test_profile_manual_update_模型提示与事件排除昵称邮箱(client, monkeypatch):
    prompts: list[str] = []

    async def fake_stream(prompt: str, mode: str, history: list):
        prompts.append(prompt)
        yield ("text", {"content": json.dumps(_profile_analysis_payload("已刷新画像"), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    await client.post(
        "/api/profile/onboarding",
        json={"major": ["软件工程"], "goal": ["完成课程项目"]},
    )
    prompts.clear()

    response = await client.put(
        "/api/profile",
        json={
            "name": "隐私昵称不外发",
            "email": "private-profile@example.com",
            "grade": "大三",
            "goal": ["掌握分布式系统"],
        },
    )

    assert response.json()["success"] is True
    assert len(prompts) == 1
    assert "隐私昵称不外发" not in prompts[0]
    assert "private-profile@example.com" not in prompts[0]
    assert "掌握分布式系统" in prompts[0]
    assert "大三" in prompts[0]
    events_text = _events_file().read_text(encoding="utf-8")
    assert "隐私昵称不外发" not in events_text
    assert "private-profile@example.com" not in events_text
    assert "掌握分布式系统" in events_text


@pytest.mark.asyncio
async def test_profile_history_analyze_返回新结构并保留旧字段(client, monkeypatch):
    analyses = iter(
        [
            _profile_analysis_payload("建档分析。", 0.71),
            _profile_analysis_payload("重新分析后的叙述。", 0.9),
        ]
    )
    prompts: list[str] = []

    async def fake_stream(prompt: str, mode: str, history: list):
        prompts.append(prompt)
        yield ("text", {"content": json.dumps(next(analyses), ensure_ascii=False)})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    await client.post(
        "/api/profile/onboarding",
        json={"major": ["计算机科学"], "goal": ["掌握算法"], "weak": ["动态规划"]},
    )
    execute(
        "UPDATE students SET name = ?, email = ?, updated_at = ? WHERE user_id = ?",
        ("历史分析隐私昵称", "history-private@example.com", now_iso(), settings.single_user_id),
    )
    prompts.clear()

    response = await client.post("/api/profile/history/analyze")
    data = response.json()["data"]

    assert data["schema_version"] == "profile-analysis-v1"
    assert data["generated_by"] == "llm"
    assert data["narrative"] == "重新分析后的叙述。"
    assert data["analysis"] == data["narrative"]
    assert isinstance(data["analysis_steps"], list)
    assert data["updated_at"]
    saved = json.loads(_analysis_file().read_text(encoding="utf-8"))
    assert saved["narrative"] == "重新分析后的叙述。"
    assert saved["profile_version"] == 2
    assert "历史分析隐私昵称" not in prompts[0]
    assert "history-private@example.com" not in prompts[0]
    assert "掌握算法" in prompts[0]


@pytest.mark.asyncio
async def test_profile_dialog_使用模型提取事实并保存原始对话(client, monkeypatch):
    dialog_profile = {
        "major": "人工智能",
        "grade": "大三",
        "goal": ["完成机器学习项目"],
        "knowledge_level": "掌握 Python 基础",
        "weak_points": ["模型评估"],
        "learning_preference": ["案例实践"],
        "cognitive_style": "归纳型",
        "daily_time": 60,
        "practical_ability": "完成过数据分析作业",
        "current_stage": "机器学习入门",
    }
    raw_messages = ["我是人工智能专业", "想完成机器学习项目", "更喜欢案例实践"]
    prompts: list[str] = []
    regular_round = 0

    async def fake_stream(prompt: str, mode: str, history: list):
        nonlocal regular_round
        prompts.append(prompt)
        if "从对话中提取学习画像事实" in prompt:
            content = json.dumps(dialog_profile, ensure_ascii=False)
        elif "学习画像融合分析器" in prompt:
            content = json.dumps(_profile_analysis_payload("对话融合画像。"), ensure_ascii=False)
        else:
            regular_round += 1
            content = f"助理上下文关键词第{regular_round}轮"
        yield ("text", {"content": content})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    initiated = await client.post("/api/profile/initiate", json={})
    session_id = initiated.json()["data"]["session_id"]
    for message in raw_messages:
        response = await client.post("/api/profile/chat", json={"session_id": session_id, "message": message})
        assert response.status_code == 200

    profile = (await client.get("/api/profile")).json()["data"]
    assert profile["major"] == "人工智能"
    assert profile["grade"] == "大三"
    assert profile["goal"] == ["完成机器学习项目"]
    assert profile["weak_points"] == ["模型评估"]
    assert profile["learning_preference"] == ["案例实践"]
    assert "函数" not in json.dumps(profile, ensure_ascii=False)
    assert "面向对象" not in json.dumps(profile, ensure_ascii=False)
    extraction_prompt = next(prompt for prompt in prompts if "从对话中提取学习画像事实" in prompt)
    assert all(message in extraction_prompt for message in raw_messages)
    assert "助理上下文关键词第1轮" in extraction_prompt
    events = [json.loads(line) for line in _events_file().read_text(encoding="utf-8").splitlines()]
    dialog_event = next(event for event in events if event["type"] == "profile_dialog_completed")
    assert all(message in json.dumps(dialog_event, ensure_ascii=False) for message in raw_messages)
    assert any(message["role"] == "assistant" for message in dialog_event["source_messages"])
    assert "source_text" not in dialog_event
    analysis = json.loads(_analysis_file().read_text(encoding="utf-8"))
    assert analysis["source_type"] == "dialog"
    history = json.loads(_history_file().read_text(encoding="utf-8"))
    assert history[0]["grade"] == "大三"


@pytest.mark.asyncio
async def test_profile_dialog_重复建档递增版本并保留未提及的专业年级(client, monkeypatch):
    dialog_profile = {
        "major": "",
        "grade": "",
        "goal": ["深化工程实践"],
        "knowledge_level": "掌握基础语法",
        "weak_points": ["并发编程"],
        "learning_preference": ["案例实践"],
        "cognitive_style": "归纳型",
        "daily_time": 60,
        "practical_ability": "完成过课程作业",
        "current_stage": "工程实践阶段",
    }
    prompts: list[str] = []

    async def fake_stream(prompt: str, mode: str, history: list):
        prompts.append(prompt)
        if "从对话中提取学习画像事实" in prompt:
            content = json.dumps(dialog_profile, ensure_ascii=False)
        elif "学习画像融合分析器" in prompt:
            content = json.dumps(_profile_analysis_payload("对话后分析"), ensure_ascii=False)
        else:
            content = "请继续说明你的学习目标。"
        yield ("text", {"content": content})
        yield ("done", {"produced": True, "fallback": False})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", fake_stream)
    onboarding = await client.post(
        "/api/profile/onboarding",
        json={"major": ["软件工程"], "grade": "大四", "goal": ["完成课程项目"]},
    )
    assert onboarding.json()["data"]["version"] == 2
    prompts.clear()

    async def complete_dialog(messages: list[str]) -> None:
        initiated = await client.post("/api/profile/initiate", json={})
        session_id = initiated.json()["data"]["session_id"]
        for message in messages:
            response = await client.post(
                "/api/profile/chat",
                json={"session_id": session_id, "message": message},
            )
            assert response.status_code == 200

    await complete_dialog(["继续之前的方向", "想深化工程实践", "偏好案例练习"])
    first_profile = (await client.get("/api/profile")).json()["data"]
    await complete_dialog(["继续学习", "想加强并发编程", "每天可以学习一小时"])
    second_profile = (await client.get("/api/profile")).json()["data"]

    assert first_profile["version"] == 3
    assert second_profile["version"] == 4
    assert second_profile["major"] == "软件工程"
    assert second_profile["grade"] == "大四"
    fusion_prompts = [prompt for prompt in prompts if "学习画像融合分析器" in prompt]
    assert len(fusion_prompts) == 2
    assert all("软件工程" in prompt and "大四" in prompt for prompt in fusion_prompts)
    history = json.loads(_history_file().read_text(encoding="utf-8"))
    assert history[0]["version"] == 4
    assert history[0]["major"] == "软件工程"
    assert history[0]["grade"] == "大四"


@pytest.mark.asyncio
async def test_profile_dialog_模型失败时不写入固定默认画像(client, monkeypatch):
    async def failed_stream(prompt: str, mode: str, history: list):
        yield ("error", {"message": "模型不可用"})
        yield ("done", {"produced": False, "fallback": True})

    monkeypatch.setattr(profile_route.spark_lite, "stream_chat_events", failed_stream)
    initiated = await client.post("/api/profile/initiate", json={})
    session_id = initiated.json()["data"]["session_id"]
    for message in ["我是数据科学专业", "还没确定目标", "暂未说明薄弱点"]:
        await client.post("/api/profile/chat", json={"session_id": session_id, "message": message})

    profile = (await client.get("/api/profile")).json()["data"]
    assert profile["major"] == "数据科学"
    assert profile["goal"] == []
    assert profile["weak_points"] == []
    assert profile["learning_preference"] == []
    assert profile["knowledge_level"] == ""
    assert "期末提分" not in json.dumps(profile, ensure_ascii=False)
    assert "函数" not in json.dumps(profile, ensure_ascii=False)


@pytest.mark.asyncio
async def test_profile_chat_拒绝其他用户会话和错误会话(client):
    timestamp = now_iso()
    for user_id, phone in (("profile_user_a", "13800000001"), ("profile_user_b", "13800000002")):
        execute(
            "INSERT INTO students(user_id, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, user_id, phone, timestamp, timestamp),
        )
    headers_a = {"Authorization": f"Bearer {create_access_token('profile_user_a')}"}
    headers_b = {"Authorization": f"Bearer {create_access_token('profile_user_b')}"}
    initiated = await client.post("/api/profile/initiate", json={}, headers=headers_a)
    session_id = initiated.json()["data"]["session_id"]

    cross_user = await client.post(
        "/api/profile/chat",
        json={"session_id": session_id, "message": "尝试访问他人会话"},
        headers=headers_b,
    )
    missing = await client.post(
        "/api/profile/chat",
        json={"session_id": "sess_missing", "message": "错误会话"},
        headers=headers_a,
    )

    assert cross_user.headers["content-type"].startswith("application/json")
    assert cross_user.json()["success"] is False
    assert "无权访问" in cross_user.json()["error"]
    assert missing.json()["success"] is False


@pytest.mark.asyncio
async def test_profile_analysis_无画像行时查询与重分析均不创建用户目录(client):
    user_id = "profile_without_row"
    timestamp = now_iso()
    execute(
        "INSERT INTO students(user_id, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, "无画像用户", "13800000003", timestamp, timestamp),
    )
    headers = {"Authorization": f"Bearer {create_access_token(user_id)}"}
    user_dir = settings.data_dir / "users" / user_id
    assert user_dir.exists() is False

    current = await client.get("/api/profile/analysis/current", headers=headers)
    regenerated = await client.post("/api/profile/history/analyze", headers=headers)

    assert current.json()["success"] is False
    assert regenerated.json()["success"] is False
    assert "profile" in (current.json()["error"] or "").lower()
    assert "profile" in (regenerated.json()["error"] or "").lower()
    assert user_dir.exists() is False


@pytest.mark.asyncio
async def test_profile_delete_仅重置当前认证用户且重复调用保持成功(client):
    other_user = "profile-delete-other"
    timestamp = now_iso()
    execute(
        "INSERT INTO students(user_id, name, email, major, grade, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (other_user, "其他用户", "other-delete@example.com", "人工智能", "大一", timestamp, timestamp),
    )
    execute(
        "INSERT INTO profiles(user_id, goal, version, updated_at) VALUES (?, ?, ?, ?)",
        (other_user, '["其他用户目标"]', 8, timestamp),
    )

    first = await client.delete(f"/api/profile?user_id={other_user}")
    second = await client.delete(f"/api/profile?user_id={other_user}")

    assert first.status_code == 200
    assert first.json()["data"]["reset"] is True
    assert first.json()["data"]["redirect"] == "/onboarding"
    assert second.json()["data"]["reset"] is True
    assert fetch_one("SELECT version FROM profiles WHERE user_id = ?", (settings.single_user_id,)) is None
    assert fetch_one("SELECT version FROM profiles WHERE user_id = ?", (other_user,))["version"] == 8
    archive = json.loads(
        (settings.data_dir / "users" / settings.single_user_id / "profile_reset_archive.json").read_text(
            encoding="utf-8"
        )
    )
    assert len(archive) == 1


@pytest.mark.asyncio
async def test_profile_delete_重置异常返回结构化失败且不泄露内部错误(client, monkeypatch):
    def failed_reset(user_id: str):
        raise OSError("D:/private/profile_snapshot.json 磁盘故障")

    monkeypatch.setattr(profile_route, "reset_learning_profile", failed_reset)

    response = await client.delete("/api/profile")

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "data": None,
        "error": "学习画像重置失败，请稍后重试",
    }
    assert "private" not in response.text


async def _adopt_reset_test_pet(client) -> None:
    response = await client.post(
        "/api/agent/pet",
        json={"name": "重置测试伙伴", "avatar": "fox", "personality": "concise"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_agent_chat_画像重置首次只创建确认且不调用模型(client, monkeypatch):
    from app.db import fetch_one
    from app.routes import agent as agent_route

    called = False

    async def forbidden_stream(*args, **kwargs):
        nonlocal called
        called = True
        yield "不应调用"

    monkeypatch.setattr(agent_route, "_stream_agent_llm", forbidden_stream)
    await _adopt_reset_test_pet(client)
    before = fetch_one("SELECT version FROM profiles WHERE user_id = ?", (settings.single_user_id,))["version"]

    response = await client.post("/api/agent/chat", json={"message": "请帮我重置学习画像可以吗？"})

    assert response.json()["data"]["action"] == {"type": "confirm_profile_reset"}
    assert "确认重置" in response.json()["data"]["answer"]
    assert fetch_one("SELECT version FROM profiles WHERE user_id = ?", (settings.single_user_id,))["version"] == before
    assert called is False


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["确认", "确认重置", "不用了", "取消"])
async def test_agent_chat_无待确认状态的确认取消话术继续普通聊天(client, monkeypatch, message: str):
    from app.routes import agent as agent_route

    await _adopt_reset_test_pet(client)

    async def fake_stream(prompt: str, mode: str = "general"):
        yield f"普通聊天已处理：{message}"

    monkeypatch.setattr(agent_route, "_stream_agent_llm", fake_stream)

    response = await client.post("/api/agent/chat", json={"message": message})

    assert response.json()["data"]["answer"] == f"普通聊天已处理：{message}"
    assert "action" not in response.json()["data"]


@pytest.mark.asyncio
async def test_agent_chat_确认被消费后再次确认回到普通模型分支(client, monkeypatch):
    from app.routes import agent as agent_route

    await _adopt_reset_test_pet(client)

    async def fake_stream(prompt: str, mode: str = "general"):
        yield "重复确认已按普通聊天处理"

    monkeypatch.setattr(agent_route, "_stream_agent_llm", fake_stream)
    await client.post("/api/agent/chat", json={"message": "我现在要重新建档"})
    confirmed = await client.post("/api/agent/chat", json={"message": "确认重置"})

    repeated = await client.post("/api/agent/chat", json={"message": "确认重置"})

    assert confirmed.json()["data"]["reset"] is True
    assert repeated.json()["data"]["answer"] == "重复确认已按普通聊天处理"


@pytest.mark.asyncio
async def test_agent_chat_未认养伙伴时不能创建确认或重置(client):
    confirmation_file = _analysis_file().parent / "profile_reset_confirmation.json"

    requested = await client.post("/api/agent/chat", json={"message": "请帮我重置学习画像"})
    confirmed = await client.post("/api/agent/chat", json={"message": "确认重置"})

    assert requested.json()["success"] is False
    assert confirmed.json()["success"] is False
    assert "请先认养" in requested.json()["error"]
    assert "请先认养" in confirmed.json()["error"]
    assert confirmation_file.exists() is False
    assert fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,)) is not None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message",
    [
        "不要重置学习画像",
        "别清空画像",
        "无需重置学习画像",
        "重置画像是什么意思",
        "如何重置画像",
        "怎么重置画像",
        "请问重置学习画像后会怎样",
        "我想知道如何重置学习画像",
        "请帮我解释重置画像是什么意思",
        "我不想重置画像",
        "请勿重置学习画像",
        "为什么要重置画像",
        "重置画像的流程是什么",
        "重置画像安全吗",
    ],
)
async def test_agent_chat_否定或信息问句不会创建重置确认(client, monkeypatch, message: str):
    from app.routes import agent as agent_route

    await _adopt_reset_test_pet(client)

    async def fake_stream(prompt: str, mode: str = "general"):
        yield "这是普通说明回答"

    monkeypatch.setattr(agent_route, "_stream_agent_llm", fake_stream)

    response = await client.post("/api/agent/chat", json={"message": message})

    assert response.json()["data"]["answer"] == "这是普通说明回答"
    assert "action" not in response.json()["data"]
    assert _analysis_file().parent.joinpath("profile_reset_confirmation.json").exists() is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message",
    [
        "我只是说说重置画像",
        "有人说重置画像",
        "我们讨论一下重置画像",
        "我只是提到重置画像",
        "别人让我重置画像",
        "如果重置学习画像会发生什么",
        "假设重新建档会怎么样",
        "请帮我重置画像只是别人说的，不是我的决定",
        "我想重置画像是导师提出的假设，不代表我要操作",
    ],
)
async def test_agent_chat_讨论转述假设语境不会创建重置确认(client, monkeypatch, message: str):
    from app.routes import agent as agent_route

    await _adopt_reset_test_pet(client)

    async def fake_stream(prompt: str, mode: str = "general"):
        yield "这是普通语境讨论"

    monkeypatch.setattr(agent_route, "_stream_agent_llm", fake_stream)

    response = await client.post("/api/agent/chat", json={"message": message})

    assert response.json()["data"]["answer"] == "这是普通语境讨论"
    assert "action" not in response.json()["data"]
    assert _analysis_file().parent.joinpath("profile_reset_confirmation.json").exists() is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message",
    [
        "重置学习画像",
        "请帮我重置学习画像",
        "我决定重新建档",
        "麻烦你帮我重置学习画像",
        "能帮我重置学习画像吗",
        "可以帮我清空画像吗",
        "现在帮我重置学习画像",
        "请现在帮我重新建档",
    ],
)
async def test_agent_chat_明确重置请求仍创建确认且不调用模型(client, monkeypatch, message: str):
    from app.routes import agent as agent_route

    called = False

    async def forbidden_stream(*args, **kwargs):
        nonlocal called
        called = True
        yield "不应调用"

    monkeypatch.setattr(agent_route, "_stream_agent_llm", forbidden_stream)
    await _adopt_reset_test_pet(client)

    response = await client.post("/api/agent/chat", json={"message": message})

    assert response.json()["data"]["action"] == {"type": "confirm_profile_reset"}
    assert called is False


@pytest.mark.asyncio
async def test_agent_chat_确认重置后清理画像并返回建档导航(client, monkeypatch):
    from app.db import fetch_one
    from app.routes import agent as agent_route

    async def forbidden_stream(*args, **kwargs):
        raise AssertionError("确认重置不得调用模型")
        yield ""

    monkeypatch.setattr(agent_route, "_stream_agent_llm", forbidden_stream)
    await _adopt_reset_test_pet(client)
    await client.post("/api/agent/chat", json={"message": "重新建档"})

    response = await client.post("/api/agent/chat", json={"message": "确认重置"})

    data = response.json()["data"]
    assert data["reset"] is True
    assert data["action"] == {"type": "navigate", "label": "重新开始建档", "href": "/onboarding"}
    assert fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,)) is None


@pytest.mark.asyncio
async def test_agent_chat_取消重置不改画像且不调用模型(client, monkeypatch):
    from app.db import fetch_one
    from app.routes import agent as agent_route

    async def forbidden_stream(*args, **kwargs):
        raise AssertionError("取消重置不得调用模型")
        yield ""

    monkeypatch.setattr(agent_route, "_stream_agent_llm", forbidden_stream)
    await _adopt_reset_test_pet(client)
    await client.post("/api/agent/chat", json={"message": "清空画像"})

    response = await client.post("/api/agent/chat", json={"message": "取消重置"})

    assert "已取消" in response.json()["data"]["answer"]
    assert fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,)) is not None


@pytest.mark.asyncio
async def test_agent_chat_确认已过期时不改画像且不调用模型(client, monkeypatch):
    from app.db import fetch_one
    from app.routes import agent as agent_route
    from app.storage import write_json

    async def forbidden_stream(*args, **kwargs):
        raise AssertionError("过期确认不得调用模型")
        yield ""

    monkeypatch.setattr(agent_route, "_stream_agent_llm", forbidden_stream)
    await _adopt_reset_test_pet(client)
    await client.post("/api/agent/chat", json={"message": "重新建立学习画像"})
    write_json(
        settings.single_user_id,
        "profile_reset_confirmation.json",
        {"requested_at": "2026-08-20T00:00:00Z", "expires_at": "2026-08-20T00:01:00Z"},
    )

    response = await client.post("/api/agent/chat", json={"message": "确认重置"})

    assert "已过期" in response.json()["data"]["answer"]
    assert fetch_one("SELECT * FROM profiles WHERE user_id = ?", (settings.single_user_id,)) is not None


@pytest.mark.asyncio
async def test_agent_chat_确认后重置失败会保留确认并允许重试(client, monkeypatch):
    from app import profile_reset as profile_reset_service

    await _adopt_reset_test_pet(client)
    await client.post("/api/agent/chat", json={"message": "请帮我重置学习画像"})
    real_write_json = profile_reset_service.write_json
    failed = False

    def fail_first_snapshot_write(target_user: str, filename: str, payload):
        nonlocal failed
        if filename == "profile_snapshot.json" and not failed:
            failed = True
            raise OSError("模拟确认后的重置失败")
        return real_write_json(target_user, filename, payload)

    monkeypatch.setattr(profile_reset_service, "write_json", fail_first_snapshot_write)

    failed_response = await client.post("/api/agent/chat", json={"message": "确认重置"})
    retry_response = await client.post("/api/agent/chat", json={"message": "确认重置"})

    assert failed_response.json()["success"] is False
    assert "可重试" in failed_response.json()["error"]
    assert retry_response.json()["data"]["reset"] is True


@pytest.mark.asyncio
async def test_agent_chat_重置和确认恢复都失败时不承诺确认仍有效(client, monkeypatch):
    from app.routes import agent as agent_route

    await _adopt_reset_test_pet(client)
    await client.post("/api/agent/chat", json={"message": "请帮我重置学习画像"})

    def failed_reset(user_id: str):
        raise OSError("D:/secret-reset-state")

    def failed_restore(user_id: str):
        raise OSError("D:/secret-confirmation-state")

    monkeypatch.setattr(agent_route, "reset_learning_profile", failed_reset)
    monkeypatch.setattr(agent_route, "restore_pending_reset", failed_restore)

    response = await client.post("/api/agent/chat", json={"message": "确认重置"})

    assert response.json()["success"] is False
    assert "确认可能仍在处理中" in response.json()["error"]
    assert "稍后" in response.json()["error"]
    assert "确认已过期" in response.json()["error"]
    assert "重新发起" in response.json()["error"]
    assert "仍然有效" not in response.json()["error"]
    assert "立即重新发起" not in response.json()["error"]
    assert "secret" not in response.json()["error"]


@pytest.mark.asyncio
async def test_agent_chat_普通对话仍走原有模型链路(client, monkeypatch):
    from app.routes import agent as agent_route

    await _adopt_reset_test_pet(client)

    async def fake_stream(prompt: str, mode: str = "general"):
        yield "这是普通学习问题的回答"

    monkeypatch.setattr(agent_route, "_stream_agent_llm", fake_stream)

    response = await client.post("/api/agent/chat", json={"message": "学习画像是如何帮助规划课程的？"})

    data = response.json()["data"]
    assert data["answer"] == "这是普通学习问题的回答"
    assert "action" not in data


@pytest.mark.asyncio
async def test_tutor_stream_and_history(client):
    r = await client.post("/api/tutor/chat", json={"message": "什么是闭包", "mode": "knowledge_qa"})
    assert r.status_code == 200
    text = r.text
    assert '"type": "text"' in text
    assert '"type": "done"' in text

    h = await client.get("/api/tutor/history")
    assert h.status_code == 200
    assert h.json()["success"] is True
    assert len(h.json()["data"]) >= 2


def _extract_conversation_id_from_stream(text: str) -> int:
    marker = '"conversation_id": '
    return int(text.split(marker, 1)[1].split(",", 1)[0])


@pytest.mark.asyncio
async def test_tutor_chat_without_conversation_id_creates_new_conversation_each_time(client):
    first = await client.post("/api/tutor/chat", json={"message": "第一问", "mode": "knowledge_qa"})
    second = await client.post("/api/tutor/chat", json={"message": "第二问", "mode": "knowledge_qa"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert '"type": "done"' in first.text
    assert '"type": "done"' in second.text

    first_conv_id = _extract_conversation_id_from_stream(first.text)
    second_conv_id = _extract_conversation_id_from_stream(second.text)
    assert first_conv_id != second_conv_id


@pytest.mark.asyncio
async def test_tutor_chat_stores_raw_user_message_verbatim(client):
    created = await client.post("/api/tutor/conversations", json={"title": "原文校验"})
    assert created.status_code == 200
    conv_id = int(created.json()["data"]["id"])
    raw_message = "帮我查一下信阳明天的天气"

    resp = await client.post(
        "/api/tutor/chat",
        json={
            "message": raw_message,
            "conversation_id": conv_id,
            "mode": "knowledge_qa",
        },
    )

    assert resp.status_code == 200

    history = await client.get(f"/api/tutor/history?conversation_id={conv_id}&limit=20")
    assert history.status_code == 200
    user_messages = [m for m in history.json()["data"] if m["role"] == "user"]
    assert user_messages[-1]["content"] == raw_message
    assert "用户已生成资源库上下文" not in user_messages[-1]["content"]


@pytest.mark.asyncio
async def test_tutor_chat_does_not_reuse_previous_file_ids_when_request_omits_them(client):
    created = await client.post("/api/tutor/conversations", json={"title": "文件隔离"})
    assert created.status_code == 200
    conv_id = int(created.json()["data"]["id"])

    upload = await client.post(
        "/api/tutor/files",
        files=[("files", ("sample.txt", b"hello workspace", "text/plain"))],
    )
    assert upload.status_code == 200
    file_id = int(upload.json()["data"][0]["id"])

    first = await client.post(
        "/api/tutor/chat",
        json={
            "message": "第一问",
            "conversation_id": conv_id,
            "file_ids": [file_id],
            "mode": "knowledge_qa",
        },
    )
    second = await client.post(
        "/api/tutor/chat",
        json={
            "message": "第二问",
            "conversation_id": conv_id,
            "mode": "knowledge_qa",
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200

    history = await client.get(f"/api/tutor/history?conversation_id={conv_id}&limit=20")
    assert history.status_code == 200
    data = history.json()["data"]
    user_messages = [m for m in data if m["role"] == "user"]
    assert "sample.txt" in user_messages[0]["file_names"]
    assert user_messages[1]["file_names"] == []


@pytest.mark.asyncio
async def test_quiz_submit(client):
    q = await client.get("/api/quiz")
    assert q.status_code == 200
    first = q.json()["data"][0]

    s = await client.post("/api/quiz/submit", json={"quiz_id": first["id"], "answer": "list"})
    assert s.status_code == 200
    assert s.json()["success"] is True
    assert "correct" in s.json()["data"]


@pytest.mark.asyncio
async def test_generate_stream(client):
    r = await client.post("/api/resources/generate", json={"type": "document", "prompt": "Python 变量"})
    assert r.status_code == 200
    assert '"type": "progress"' in r.text
    assert '"type": "done"' in r.text


@pytest.mark.asyncio
async def test_tutor_workspace_closed_loop(client):
    roles = await client.get("/api/tutor/roles")
    assert roles.status_code == 200
    assert roles.json()["success"] is True

    created_role = await client.post(
        "/api/tutor/roles",
        json={"name": "测试角色", "persona": "你是测试导师"},
    )
    assert created_role.status_code == 200
    role_id = int(created_role.json()["data"]["id"])

    created_conv = await client.post(
        "/api/tutor/conversations",
        json={"title": "闭环测试会话", "role_id": role_id},
    )
    assert created_conv.status_code == 200
    conv_id = int(created_conv.json()["data"]["id"])

    upload = await client.post(
        "/api/tutor/files",
        files=[("files", ("sample.txt", b"hello workspace", "text/plain"))],
    )
    assert upload.status_code == 200
    file_id = int(upload.json()["data"][0]["id"])

    stream = await client.post(
        "/api/tutor/chat",
        json={
            "message": "请解释闭包",
            "conversation_id": conv_id,
            "role_id": role_id,
            "file_ids": [file_id],
            "mode": "knowledge_qa",
        },
    )
    assert stream.status_code == 200
    assert '"type": "text"' in stream.text
    assert '"type": "done"' in stream.text

    history = await client.get(f"/api/tutor/history?conversation_id={conv_id}&limit=50")
    assert history.status_code == 200
    assert history.json()["success"] is True
    msgs = history.json()["data"]
    assert len(msgs) >= 2
    user_messages = [m for m in msgs if m["role"] == "user"]
    assert user_messages
    assert "sample.txt" in user_messages[-1]["file_names"]

    convs_before = await client.get("/api/tutor/conversations")
    assert convs_before.status_code == 200
    before = next((c for c in convs_before.json()["data"] if int(c["id"]) == conv_id), None)
    assert before is not None
    before_count = int(before["message_count"])
    assert before_count >= 2

    delete_msg = await client.delete(f"/api/tutor/messages/{user_messages[-1]['id']}")
    assert delete_msg.status_code == 200
    assert delete_msg.json()["success"] is True

    convs_after = await client.get("/api/tutor/conversations")
    after = next((c for c in convs_after.json()["data"] if int(c["id"]) == conv_id), None)
    assert after is not None
    assert int(after["message_count"]) == before_count - 1


@pytest.mark.asyncio
async def test_tutor_docx_upload_is_indexed(client):
    from app.auth import create_access_token
    from app.config import settings

    doc = Document()
    doc.add_heading("Tutor DOCX 解析测试", level=1)
    doc.add_paragraph("闭包可以保存外层函数变量，并在内部函数中继续访问。")
    doc.add_paragraph("这个句子必须进入 tutor_file_chunks，供 Tutor 检索引用。")
    buffer = BytesIO()
    doc.save(buffer)
    payload = buffer.getvalue()

    upload = await client.post(
        "/api/tutor/files",
        headers={"Authorization": f"Bearer {create_access_token(settings.single_user_id)}"},
        files=[
            (
                "files",
                (
                    "closure-note.docx",
                    payload,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ),
            )
        ],
    )

    assert upload.status_code == 200
    file_id = int(upload.json()["data"][0]["id"])

    from app.db import fetch_all

    chunks = fetch_all(
        "SELECT content FROM tutor_file_chunks WHERE file_id = ? ORDER BY chunk_index ASC",
        (file_id,),
    )
    joined = "\n".join(str(row["content"]) for row in chunks)
    assert "闭包可以保存外层函数变量" in joined
    assert "供 Tutor 检索引用" in joined


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("input_text", "expected_decision"),
    [
        ("帮我找一下", "clarify"),
        ("请解释 Python 闭包是什么", "respond"),
    ],
)
async def test_agent_search_澄清和直接回答任务不调用浏览器不加经验且不保存控制字段(
    client,
    monkeypatch,
    input_text: str,
    expected_decision: str,
):
    from app import browser_agent
    from app.routes import agent as agent_route

    monkeypatch.setattr(settings, "auth_dev_bypass", True)
    browser_calls = 0

    async def fake_planner_events(prompt: str, mode: str, history: list, model: str):
        yield ("done", {"produced": False, "fallback": True})

    async def fake_text_stream(prompt: str, mode: str = "general"):
        yield "闭包会保留其定义环境中的变量。"

    def forbidden_browser():
        nonlocal browser_calls
        browser_calls += 1
        raise AssertionError("澄清和直接回答不得实例化浏览器")

    monkeypatch.setattr(agent_route.spark_lite, "stream_chat_events", fake_planner_events)
    monkeypatch.setattr(agent_route, "_stream_agent_llm", fake_text_stream)
    monkeypatch.setattr(browser_agent, "_get_agent", forbidden_browser)

    adopted = await client.post(
        "/api/agent/pet",
        json={"name": "小星", "avatar": "fox", "personality": "encouraging"},
    )
    assert adopted.status_code == 200
    assert adopted.json()["success"] is True
    initial_xp = adopted.json()["data"]["xp"]

    created = await client.post(
        "/api/agent/task",
        json={"task_type": "search", "input_text": input_text},
    )
    assert created.status_code == 200
    task_id = created.json()["data"]["task_id"]

    task_data = None
    for _ in range(10):
        response = await client.get(f"/api/agent/task/{task_id}")
        task_data = response.json()["data"]
        if task_data["status"] not in {"pending", "running"}:
            break

    assert task_data is not None
    assert task_data["status"] == "completed"
    assert browser_calls == 0
    assert task_data["result"]["intent"]["decision"] == expected_decision
    assert task_data["result"]["query_used"] == ""
    assert task_data["result"]["_meta"]["planner"]["decision"] == expected_decision
    assert "award_xp" not in task_data["result"]

    current_pet = await client.get("/api/agent/pet")
    assert current_pet.json()["data"]["xp"] == initial_xp


@pytest.mark.asyncio
async def test_agent_task_uses_learning_companion_backend(client, monkeypatch):
    from app.config import settings
    from app.routes import agent as agent_route

    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    async def fake_execute_fallback_task(task_id: str, task_type: str, input_text: str, persona_prompt: str):
        assert task_id
        assert task_type == "search"
        assert input_text == "Python 闭包"
        assert "encouraging" in persona_prompt.lower()
        return {
            "items": [
                {
                    "title": "闭包入门",
                    "summary": "解释闭包概念与使用场景",
                    "url": "https://example.com/closure",
                    "source": "example.com",
                }
            ]
        }

    monkeypatch.setattr(agent_route, "_execute_fallback_task", fake_execute_fallback_task)

    pet_resp = await client.post(
        "/api/agent/pet",
        json={"name": "小星", "avatar": "fox", "personality": "encouraging"},
    )
    assert pet_resp.status_code == 200
    if pet_resp.json()["success"] is False:
        current_pet = await client.get("/api/agent/pet")
        assert current_pet.status_code == 200
        assert current_pet.json()["success"] is True
    else:
        assert pet_resp.json()["success"] is True

    update_pet = await client.patch(
        "/api/agent/pet",
        json={"avatar": "panda", "personality": "encouraging"},
    )
    assert update_pet.status_code == 200
    assert update_pet.json()["success"] is True
    assert update_pet.json()["data"]["avatar"] == "panda"

    current_pet = await client.get("/api/agent/pet")
    assert current_pet.status_code == 200
    assert current_pet.json()["data"]["avatar"] == "panda"

    create = await client.post(
        "/api/agent/task",
        json={"task_type": "search", "input_text": "Python 闭包"},
    )
    assert create.status_code == 200
    task_id = create.json()["data"]["task_id"]

    task_resp = None
    for _ in range(10):
        task_resp = await client.get(f"/api/agent/task/{task_id}")
        assert task_resp.status_code == 200
        if task_resp.json()["data"]["status"] == "completed":
            break

    assert task_resp is not None
    data = task_resp.json()["data"]
    assert data["status"] == "completed"
    assert data["result"]["items"][0]["title"] == "闭包入门"
    assert any(step["action"] == "start" for step in data["steps"])


@pytest.mark.asyncio
async def test_agent_pet_can_be_reset_and_adopted_again(client, monkeypatch):
    from app.config import settings
    from app.db import execute, fetch_one

    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    created = await client.post(
        "/api/agent/pet",
        json={"name": "小星", "avatar": "fox", "personality": "encouraging"},
    )
    assert created.status_code == 200
    assert created.json()["success"] is True
    pet_id = created.json()["data"]["id"]

    execute(
        """INSERT INTO agent_tasks (id, user_id, pet_id, task_type, input_text, status, created_at, updated_at)
           VALUES ('task-reset', ?, ?, 'search', 'Python 闭包', 'completed', '2026-05-30T00:00:00Z', '2026-05-30T00:00:00Z')""",
        (settings.single_user_id, pet_id),
    )
    execute(
        "INSERT INTO agent_messages (task_id, user_id, sender, content, created_at) VALUES ('task-reset', ?, 'user', 'Python 闭包', '2026-05-30T00:00:00Z')",
        (settings.single_user_id,),
    )
    execute(
        "INSERT INTO agent_task_steps (task_id, step_index, action, description, created_at) VALUES ('task-reset', 0, 'start', '开始处理任务', '2026-05-30T00:00:00Z')"
    )

    reset = await client.delete("/api/agent/pet")
    assert reset.status_code == 200
    assert reset.json()["success"] is True

    current = await client.get("/api/agent/pet")
    assert current.status_code == 200
    assert current.json()["data"] is None
    assert fetch_one("SELECT id FROM agent_tasks WHERE id = 'task-reset'") is None
    assert fetch_one("SELECT id FROM agent_messages WHERE task_id = 'task-reset'") is None
    assert fetch_one("SELECT id FROM agent_task_steps WHERE task_id = 'task-reset'") is None

    adopted_again = await client.post(
        "/api/agent/pet",
        json={"name": "新星", "avatar": "panda", "personality": "concise"},
    )
    assert adopted_again.status_code == 200
    assert adopted_again.json()["success"] is True
    assert adopted_again.json()["data"]["name"] == "新星"


@pytest.mark.asyncio
async def test_agent_chat_returns_local_fallback_when_llm_unavailable(client, monkeypatch):
    from app.config import settings
    from app.routes import agent as agent_route

    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    async def broken_stream(*args, **kwargs):
        raise RuntimeError("model unavailable")
        yield ""

    monkeypatch.setattr(agent_route, "_stream_agent_llm", broken_stream)

    pet_resp = await client.post(
        "/api/agent/pet",
        json={"name": "小星", "avatar": "fox", "personality": "encouraging"},
    )
    assert pet_resp.status_code == 200

    chat_resp = await client.post("/api/agent/chat", json={"message": "Python 闭包怎么理解？"})

    assert chat_resp.status_code == 200
    body = chat_resp.json()
    assert body["success"] is True
    assert "answer" in body["data"]
    assert "Python 闭包" in body["data"]["answer"]
