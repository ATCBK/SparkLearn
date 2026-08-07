from __future__ import annotations

import json
import threading
from typing import Any

import httpx


def _ai_script_payload() -> dict[str, Any]:
    slide_types = ["cover", "hook", "concept", "code", "summary"]
    return {
        "title": "并发控制",
        "polished_prompt": "讲解并发控制",
        "script_outline": [
            {
                "slide_type": slide_type,
                "title": f"第 {idx} 页",
                "slide_text": [f"要点 {idx}"],
                "narration": f"这是第 {idx} 页的完整讲稿，用于生成语音。",
                "duration_ms": 7000,
            }
            for idx, slide_type in enumerate(slide_types, start=1)
        ],
    }


def _chat_response(status_code: int, content: str) -> httpx.Response:
    return httpx.Response(
        status_code,
        json={"choices": [{"message": {"content": content}}]},
        request=httpx.Request("POST", "https://example.test/chat/completions"),
    )


def test_video_ai_retries_transient_gateway_error_without_dropping_response_format(monkeypatch):
    from app.config import settings
    from app import video_ai

    calls: list[dict[str, Any]] = []

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def post(self, url: str, *, headers: dict[str, str], json: dict[str, Any]) -> httpx.Response:
            calls.append(dict(json))
            if len(calls) == 1:
                return _chat_response(503, "{}")
            return _chat_response(200, json_module.dumps(_ai_script_payload(), ensure_ascii=False))

    json_module = json
    monkeypatch.setattr(settings, "video_ai_api_key", "test-key")
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    monkeypatch.setattr(settings, "video_ai_model", "deepseek-test")
    monkeypatch.setattr(settings, "video_ai_max_retries", 2, raising=False)
    monkeypatch.setattr(settings, "video_ai_retry_backoff_sec", 0, raising=False)
    monkeypatch.setattr(video_ai.httpx, "Client", FakeClient)

    result = video_ai.generate_video_script_with_ai("并发控制", 15, "beginner", "apple-minimal")

    assert result["title"] == "并发控制"
    assert len(calls) == 2
    assert all("response_format" in call for call in calls)


def test_video_ai_limits_concurrent_upstream_calls(monkeypatch):
    from app.config import settings
    from app import video_ai

    active = 0
    max_active = 0
    entered_first = threading.Event()
    release_first = threading.Event()
    guard = threading.Lock()

    class FakeClient:
        def __init__(self, *args: object, **kwargs: object):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def post(self, url: str, *, headers: dict[str, str], json: dict[str, Any]) -> httpx.Response:
            nonlocal active, max_active
            with guard:
                active += 1
                max_active = max(max_active, active)
                is_first = max_active == 1
            if is_first:
                entered_first.set()
                assert release_first.wait(timeout=2)
            with guard:
                active -= 1
            return _chat_response(200, json_module.dumps(_ai_script_payload(), ensure_ascii=False))

    json_module = json
    monkeypatch.setattr(settings, "video_ai_api_key", "test-key")
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    monkeypatch.setattr(settings, "video_ai_model", "deepseek-test")
    monkeypatch.setattr(settings, "video_ai_max_concurrency", 1, raising=False)
    monkeypatch.setattr(settings, "video_ai_max_retries", 1, raising=False)
    monkeypatch.setattr(video_ai.httpx, "Client", FakeClient)
    monkeypatch.setattr(video_ai, "_video_ai_semaphore", None)
    monkeypatch.setattr(video_ai, "_video_ai_semaphore_limit", None)

    results: list[dict[str, Any]] = []

    def call_ai() -> None:
        results.append(video_ai.generate_video_script_with_ai("并发控制", 15, "beginner", "apple-minimal"))

    first = threading.Thread(target=call_ai)
    second = threading.Thread(target=call_ai)
    first.start()
    assert entered_first.wait(timeout=2)
    second.start()
    release_first.set()
    first.join(timeout=2)
    second.join(timeout=2)

    assert len(results) == 2
    assert max_active == 1
