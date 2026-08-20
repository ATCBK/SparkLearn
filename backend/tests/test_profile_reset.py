import json
import threading

import pytest

from app import profile_reset as profile_reset_service
from app.config import settings
from app.db import execute, fetch_one, now_iso
from app.profile_reset import (
    CONFIRMATION_ACTIVE,
    CONFIRMATION_CLAIMED,
    cancel_pending_reset,
    claim_pending_reset,
    confirm_pending_reset,
    consume_pending_reset,
    profile_sessions,
    request_reset_confirmation,
    reset_learning_profile,
    restore_pending_reset,
)
from app.storage import read_json, write_json


def _user_file(user_id: str, filename: str):
    return settings.data_dir / "users" / user_id / filename


def _seed_reset_files(user_id: str) -> None:
    write_json(user_id, "profile_snapshot.json", {"version": 7, "goal": ["旧目标"]})
    write_json(user_id, "profile_ai_analysis.json", {"narrative": "旧融合画像"})
    write_json(user_id, "profile_history.json", [{"version": 6}, {"version": 7}])
    write_json(
        user_id,
        "memory_store.json",
        {
            "version": 3,
            "updated_at": "2026-08-20T00:00:00Z",
            "working": [{"content": "保留工作记忆"}],
            "episodic": [{"content": "保留历史对话"}],
            "semantic": {
                "goals": ["清除目标"],
                "preferences": ["清除偏好"],
                "constraints": ["清除约束"],
                "facts": ["保留事实"],
                "skills": ["清除技能"],
                "weak_points": ["清除薄弱点"],
                "learning_stage": "清除阶段",
            },
            "perceptual": [{"content": "保留感知资产"}],
        },
    )


@pytest.mark.asyncio
async def test_reset_learning_profile_归档后仅清画像并保留身份学习资产与非画像记忆(client):
    user_id = settings.single_user_id
    timestamp = now_iso()
    execute(
        "UPDATE students SET name = ?, email = ?, major = ?, grade = ?, updated_at = ? WHERE user_id = ?",
        ("保留姓名", "keep@example.com", "软件工程", "大三", timestamp, user_id),
    )
    execute(
        "INSERT INTO mastery_records(user_id, knowledge_point_id, knowledge_point_name, score, chapter, last_updated) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, "reset-asset", "保留掌握记录", 0.8, "测试章节", timestamp),
    )
    _seed_reset_files(user_id)
    request_reset_confirmation(user_id)
    profile_sessions.clear()
    profile_sessions["own-session"] = {"user_id": user_id, "round": 2}
    profile_sessions["other-session"] = {"user_id": "other-user", "round": 2}

    result = reset_learning_profile(user_id)

    assert result["reset"] is True
    assert result["redirect"] == "/onboarding"
    assert result["reset_at"]
    assert fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,)) is None
    student = fetch_one("SELECT name, email, major, grade FROM students WHERE user_id = ?", (user_id,))
    assert dict(student) == {
        "name": "保留姓名",
        "email": "keep@example.com",
        "major": "",
        "grade": "",
    }
    assert fetch_one(
        "SELECT knowledge_point_name FROM mastery_records WHERE user_id = ? AND knowledge_point_id = ?",
        (user_id, "reset-asset"),
    )["knowledge_point_name"] == "保留掌握记录"

    archive = read_json(user_id, "profile_reset_archive.json", [])
    assert len(archive) == 1
    assert archive[0]["profile"]["version"] == 1
    assert archive[0]["profile"]["major"] == "软件工程"
    assert archive[0]["analysis"] == {"narrative": "旧融合画像"}
    assert archive[0]["history"] == [{"version": 6}, {"version": 7}]
    assert read_json(user_id, "profile_snapshot.json", None) == {}
    assert read_json(user_id, "profile_ai_analysis.json", None) == {}
    assert read_json(user_id, "profile_history.json", None) == []

    memory = read_json(user_id, "memory_store.json", {})
    assert memory["semantic"] == {
        "goals": [],
        "preferences": [],
        "constraints": [],
        "facts": ["保留事实"],
        "skills": [],
        "weak_points": [],
        "learning_stage": "",
    }
    assert memory["working"] == [{"content": "保留工作记忆"}]
    assert memory["episodic"] == [{"content": "保留历史对话"}]
    assert memory["perceptual"] == [{"content": "保留感知资产"}]
    assert "own-session" not in profile_sessions
    assert "other-session" in profile_sessions
    assert read_json(user_id, "profile_reset_confirmation.json", None) == {}
    events = [json.loads(line) for line in _user_file(user_id, "learning_events.jsonl").read_text(encoding="utf-8").splitlines()]
    assert events[-1]["type"] == "profile_reset"
    assert events[-1]["reset_at"] == result["reset_at"]


@pytest.mark.asyncio
async def test_reset_learning_profile_归档原子追加且最多保留最近五次(client):
    user_id = settings.single_user_id
    write_json(
        user_id,
        "profile_reset_archive.json",
        [{"reset_at": f"old-{index}"} for index in range(5)],
    )
    write_json(user_id, "profile_ai_analysis.json", {"narrative": "最新分析"})

    reset_learning_profile(user_id)

    archive = read_json(user_id, "profile_reset_archive.json", [])
    assert len(archive) == 5
    assert [item["reset_at"] for item in archive[:4]] == ["old-1", "old-2", "old-3", "old-4"]
    assert archive[-1]["analysis"] == {"narrative": "最新分析"}


@pytest.mark.asyncio
async def test_reset_learning_profile_不影响其他用户的画像文件与会话(client):
    current_user = settings.single_user_id
    other_user = "profile-reset-other"
    timestamp = now_iso()
    execute(
        "INSERT INTO students(user_id, name, email, major, grade, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (other_user, "其他用户", "other@example.com", "人工智能", "大二", timestamp, timestamp),
    )
    execute(
        "INSERT INTO profiles(user_id, goal, version, updated_at) VALUES (?, ?, ?, ?)",
        (other_user, '["保留其他用户目标"]', 4, timestamp),
    )
    write_json(other_user, "profile_ai_analysis.json", {"narrative": "其他用户分析"})
    profile_sessions.clear()
    profile_sessions["other-session"] = {"user_id": other_user}

    reset_learning_profile(current_user)

    assert fetch_one("SELECT version FROM profiles WHERE user_id = ?", (other_user,))["version"] == 4
    assert read_json(other_user, "profile_ai_analysis.json", {}) == {"narrative": "其他用户分析"}
    assert profile_sessions["other-session"]["user_id"] == other_user
    assert _user_file(other_user, "profile_reset_archive.json").exists() is False


@pytest.mark.asyncio
async def test_reset_confirmation_按用户隔离且确认只能原子消费一次(client):
    first_user = settings.single_user_id
    second_user = "profile-reset-confirm-other"

    pending = request_reset_confirmation(first_user)

    assert pending["expires_at"]
    assert confirm_pending_reset(second_user) is False
    assert confirm_pending_reset(first_user) is True
    assert confirm_pending_reset(first_user) is False


@pytest.mark.asyncio
async def test_reset_confirmation_已认领状态不会被其他消费请求删除(client):
    user_id = settings.single_user_id
    request_reset_confirmation(user_id)

    assert claim_pending_reset(user_id) == CONFIRMATION_ACTIVE
    claimed = read_json(user_id, "profile_reset_confirmation.json", {})
    request_reset_confirmation(user_id)
    assert read_json(user_id, "profile_reset_confirmation.json", {}) == claimed
    assert consume_pending_reset(user_id) == CONFIRMATION_CLAIMED
    assert read_json(user_id, "profile_reset_confirmation.json", {}).get("claimed_at")

    restore_pending_reset(user_id)
    assert confirm_pending_reset(user_id) is True


@pytest.mark.asyncio
async def test_reset_confirmation_取消后不能确认且不改变画像(client):
    user_id = settings.single_user_id
    request_reset_confirmation(user_id)

    assert cancel_pending_reset(user_id) is True
    assert confirm_pending_reset(user_id) is False
    assert fetch_one("SELECT version FROM profiles WHERE user_id = ?", (user_id,)) is not None


@pytest.mark.asyncio
async def test_reset_confirmation_过期时消费状态但不重置画像(client):
    user_id = settings.single_user_id
    request_reset_confirmation(user_id)
    write_json(
        user_id,
        "profile_reset_confirmation.json",
        {
            "requested_at": "2026-08-20T00:00:00Z",
            "expires_at": "2026-08-20T00:01:00Z",
        },
    )

    assert confirm_pending_reset(user_id) is False
    assert read_json(user_id, "profile_reset_confirmation.json", None) == {}
    assert fetch_one("SELECT version FROM profiles WHERE user_id = ?", (user_id,)) is not None


@pytest.mark.asyncio
async def test_reset_confirmation_损坏文件按空状态安全修复(client):
    user_id = settings.single_user_id
    confirmation_file = _user_file(user_id, "profile_reset_confirmation.json")
    confirmation_file.parent.mkdir(parents=True, exist_ok=True)

    confirmation_file.write_text("{损坏", encoding="utf-8")
    pending = request_reset_confirmation(user_id)
    assert pending["requested_at"]
    assert read_json(user_id, "profile_reset_confirmation.json", {}) == pending

    confirmation_file.write_text("{再次损坏", encoding="utf-8")
    assert confirm_pending_reset(user_id) is False
    assert read_json(user_id, "profile_reset_confirmation.json", None) == {}

    confirmation_file.write_text("{第三次损坏", encoding="utf-8")
    assert cancel_pending_reset(user_id) is False
    assert read_json(user_id, "profile_reset_confirmation.json", None) == {}


@pytest.mark.asyncio
async def test_reset_learning_profile_损坏画像文件按空值修复而不返回服务器错误(client):
    user_id = settings.single_user_id
    for filename in (
        "profile_snapshot.json",
        "profile_ai_analysis.json",
        "profile_history.json",
        "profile_reset_archive.json",
        "memory_store.json",
        "profile_reset_confirmation.json",
    ):
        path = _user_file(user_id, filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{不是合法JSON", encoding="utf-8")

    response = await client.delete("/api/profile")

    assert response.status_code == 200
    assert response.json()["data"]["reset"] is True
    archive = read_json(user_id, "profile_reset_archive.json", [])
    assert len(archive) == 1
    assert archive[0]["analysis"] == {}
    assert archive[0]["history"] == []
    assert read_json(user_id, "profile_snapshot.json", None) == {}
    assert read_json(user_id, "profile_ai_analysis.json", None) == {}
    assert read_json(user_id, "profile_history.json", None) == []
    memory = read_json(user_id, "memory_store.json", {})
    assert set(memory) == {"version", "updated_at", "working", "episodic", "semantic", "perceptual"}
    assert memory["version"] == 1
    assert memory["working"] == []
    assert memory["episodic"] == []
    assert memory["semantic"] == {
        "goals": [],
        "preferences": [],
        "constraints": [],
        "facts": [],
        "skills": [],
        "weak_points": [],
        "learning_stage": "",
    }
    assert memory["perceptual"] == []
    assert read_json(user_id, "profile_reset_confirmation.json", None) == {}


@pytest.mark.asyncio
async def test_reset_learning_profile_无记忆文件时创建完整空记忆结构(client):
    user_id = settings.single_user_id
    memory_file = _user_file(user_id, "memory_store.json")
    assert memory_file.exists() is False

    reset_learning_profile(user_id)

    memory = read_json(user_id, "memory_store.json", {})
    assert set(memory) == {"version", "updated_at", "working", "episodic", "semantic", "perceptual"}
    assert memory["version"] == 1
    assert memory["working"] == []
    assert memory["episodic"] == []
    assert memory["perceptual"] == []
    assert memory["semantic"] == {
        "goals": [],
        "preferences": [],
        "constraints": [],
        "facts": [],
        "skills": [],
        "weak_points": [],
        "learning_stage": "",
    }


@pytest.mark.asyncio
async def test_reset_learning_profile_文件清理失败时恢复文件并回滚数据库且保留会话(client, monkeypatch):
    user_id = settings.single_user_id
    timestamp = now_iso()
    execute(
        "UPDATE students SET major = ?, grade = ?, updated_at = ? WHERE user_id = ?",
        ("软件工程", "大三", timestamp, user_id),
    )
    _seed_reset_files(user_id)
    write_json(user_id, "profile_reset_archive.json", [{"reset_at": "旧归档"}])
    request_reset_confirmation(user_id)
    profile_sessions.clear()
    profile_sessions["rollback-session"] = {"user_id": user_id, "round": 2}
    filenames = (
        "profile_snapshot.json",
        "profile_ai_analysis.json",
        "profile_history.json",
        "profile_reset_archive.json",
        "memory_store.json",
        "profile_reset_confirmation.json",
    )
    before_files = {filename: read_json(user_id, filename, None) for filename in filenames}
    real_write_json = profile_reset_service.write_json
    failed = False

    def fail_first_snapshot_write(target_user: str, filename: str, payload):
        nonlocal failed
        if filename == "profile_snapshot.json" and not failed:
            failed = True
            raise OSError("模拟画像快照写入失败")
        return real_write_json(target_user, filename, payload)

    monkeypatch.setattr(profile_reset_service, "write_json", fail_first_snapshot_write)

    with pytest.raises(OSError, match="模拟画像快照写入失败"):
        reset_learning_profile(user_id)

    assert fetch_one("SELECT version FROM profiles WHERE user_id = ?", (user_id,)) is not None
    student = fetch_one("SELECT major, grade FROM students WHERE user_id = ?", (user_id,))
    assert dict(student) == {"major": "软件工程", "grade": "大三"}
    assert {filename: read_json(user_id, filename, None) for filename in filenames} == before_files
    assert confirm_pending_reset(user_id) is True
    assert profile_sessions["rollback-session"]["user_id"] == user_id
    events_file = _user_file(user_id, "learning_events.jsonl")
    if events_file.exists():
        assert '"type": "profile_reset"' not in events_file.read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_reset_learning_profile_事件写入失败不撤销重置并明确审计状态(client, monkeypatch):
    user_id = settings.single_user_id
    profile_sessions.clear()
    profile_sessions["audit-session"] = {"user_id": user_id, "round": 2}

    def fail_event(*args, **kwargs):
        raise OSError("模拟审计事件写入失败")

    monkeypatch.setattr(profile_reset_service, "append_jsonl", fail_event)

    result = reset_learning_profile(user_id)

    assert result["reset"] is True
    assert result["audit_logged"] is False
    assert fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,)) is None
    assert "audit-session" not in profile_sessions
    assert read_json(user_id, "profile_snapshot.json", None) == {}


@pytest.mark.asyncio
async def test_reset_learning_profile_同用户并发成功与失败不会让旧画像文件复活(client, monkeypatch):
    user_id = settings.single_user_id
    _seed_reset_files(user_id)
    write_json(user_id, "profile_reset_archive.json", [])
    failure_captured = threading.Event()
    release_failure = threading.Event()
    success_done = threading.Event()
    outcomes: list[str] = []
    real_safe_read = profile_reset_service._safe_read_json
    real_write_json = profile_reset_service.write_json

    def coordinated_read(target_user: str, filename: str, default):
        value = real_safe_read(target_user, filename, default)
        if threading.current_thread().name == "reset-failure" and filename == "profile_reset_confirmation.json":
            failure_captured.set()
            assert release_failure.wait(5)
        return value

    def fail_one_snapshot(target_user: str, filename: str, payload):
        if threading.current_thread().name == "reset-failure" and filename == "profile_snapshot.json":
            raise OSError("并发故障注入")
        return real_write_json(target_user, filename, payload)

    def run_failure() -> None:
        try:
            reset_learning_profile(user_id)
        except OSError:
            outcomes.append("failed")

    def run_success() -> None:
        try:
            reset_learning_profile(user_id)
            outcomes.append("succeeded")
        finally:
            success_done.set()

    monkeypatch.setattr(profile_reset_service, "_safe_read_json", coordinated_read)
    monkeypatch.setattr(profile_reset_service, "write_json", fail_one_snapshot)
    failure_thread = threading.Thread(target=run_failure, name="reset-failure")
    success_thread = threading.Thread(target=run_success, name="reset-success")
    failure_thread.start()
    assert failure_captured.wait(5)
    success_thread.start()
    success_done.wait(1)
    release_failure.set()
    failure_thread.join(5)
    success_thread.join(5)

    assert failure_thread.is_alive() is False
    assert success_thread.is_alive() is False
    assert sorted(outcomes) == ["failed", "succeeded"]
    assert fetch_one("SELECT * FROM profiles WHERE user_id = ?", (user_id,)) is None
    assert read_json(user_id, "profile_snapshot.json", None) == {}
    assert read_json(user_id, "profile_ai_analysis.json", None) == {}
    assert read_json(user_id, "profile_history.json", None) == []
    archive = read_json(user_id, "profile_reset_archive.json", [])
    assert len(archive) == 1
    assert archive[0]["profile"]["version"] == 1
