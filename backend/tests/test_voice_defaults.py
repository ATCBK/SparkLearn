import sys
import threading
import time
import types

import pytest


@pytest.mark.asyncio
async def test_voice_tts_endpoint_uses_cosyvoice_default_voice(client, monkeypatch):
    from app.routes import voice_admin

    calls: dict[str, object] = {}

    class FakeCosyClient:
        def synthesize(self, text: str, voice: str = "", speech_rate: float = 0.0, pitch_rate: float = 0.0, volume: float = 0.0):
            calls["text"] = text
            calls["voice"] = voice
            calls["speech_rate"] = speech_rate
            calls["pitch_rate"] = pitch_rate
            calls["volume"] = volume
            return True, b"fake-wav", "ok"

        def is_configured(self) -> bool:
            return True

    monkeypatch.setattr(voice_admin, "cosyvoice_tts_client", FakeCosyClient())

    response = await client.post(
        "/api/voice/tts",
        json={"text": "你好", "voice": "xiaoyan", "speed": 77, "volume": 88, "pitch": 66},
    )

    assert response.status_code == 200
    assert response.content == b"fake-wav"
    assert calls == {
        "text": "你好",
        "voice": "",
        "speech_rate": 0.0,
        "pitch_rate": 0.0,
        "volume": 0.0,
    }
    assert response.headers["X-TTS-Provider"] == "xunfei_tts"


@pytest.mark.asyncio
async def test_voice_tts_status_keeps_xunfei_label_but_reports_single_default(client, monkeypatch):
    from app.routes import voice_admin

    class FakeCosyClient:
        def is_configured(self) -> bool:
            return True

    monkeypatch.setattr(voice_admin, "cosyvoice_tts_client", FakeCosyClient())

    response = await client.get("/api/voice/tts/status")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["provider"] == "xunfei_tts"
    assert body["data"]["configured"] is True
    assert body["data"]["default_voice"] == "longxiaochun"


@pytest.mark.asyncio
async def test_video_job_forces_single_default_voice(client):
    from app.auth import create_access_token
    from app.routes import video as video_route
    from app.config import settings

    before_count = len(video_route._jobs(settings.single_user_id))
    headers = {"Authorization": f"Bearer {create_access_token(settings.single_user_id)}"}

    response = await client.post(
        "/api/video/jobs",
        headers=headers,
        json={
            "prompt": "讲解函数返回值",
            "voice": {
                "provider": "xfyun",
                "voice": "xiaoyan",
                "speed": 88,
                "pitch": 77,
                "volume": 66,
            },
        },
    )

    assert response.status_code == 200
    jobs = video_route._jobs(settings.single_user_id)
    assert len(jobs) == before_count + 1
    latest = jobs[-1]
    assert latest["voice"] == {
        "provider": "cosyvoice",
        "voice": "longxiaochun",
        "speed": 1.0,
        "pitch": 1.0,
        "volume": 1.0,
    }


def test_cosyvoice_semaphore_covers_synthesis_call(monkeypatch):
    from app.config import settings
    from app.clients.cosyvoice_tts_client import CosyVoiceTTSClient

    monkeypatch.setattr(settings, "cosyvoice_api_key", "test-key")
    monkeypatch.setattr(settings, "cosyvoice_max_concurrency", 1)
    monkeypatch.setattr(settings, "cosyvoice_timeout_sec", 0.05)

    entered_call = threading.Event()
    release_call = threading.Event()
    first_result: dict[str, object] = {}

    dashscope_module = types.ModuleType("dashscope")
    audio_module = types.ModuleType("dashscope.audio")
    tts_module = types.ModuleType("dashscope.audio.tts_v2")

    class FakeAudioFormat:
        WAV_24000HZ_MONO_16BIT = "wav"

    class FakeSpeechSynthesizer:
        call_count = 0

        def __init__(self, **_: object):
            pass

        def call(self, text: str):
            type(self).call_count += 1
            if type(self).call_count == 1:
                entered_call.set()
                assert release_call.wait(timeout=2)
                return b"first-audio"
            return b"second-audio"

    tts_module.AudioFormat = FakeAudioFormat
    tts_module.SpeechSynthesizer = FakeSpeechSynthesizer
    monkeypatch.setitem(sys.modules, "dashscope", dashscope_module)
    monkeypatch.setitem(sys.modules, "dashscope.audio", audio_module)
    monkeypatch.setitem(sys.modules, "dashscope.audio.tts_v2", tts_module)

    client = CosyVoiceTTSClient()

    def run_first_call():
        first_result["value"] = client.synthesize("第一个请求")

    thread = threading.Thread(target=run_first_call)
    thread.start()
    assert entered_call.wait(timeout=2)

    second = client.synthesize("第二个请求")
    release_call.set()
    thread.join(timeout=2)

    assert second == (False, None, "CosyVoice 并发超限，请稍后重试")
    assert first_result["value"] == (True, b"first-audio", "ok")


@pytest.mark.asyncio
async def test_video_job_events_builds_same_job_once_for_concurrent_listeners(client, monkeypatch):
    import asyncio

    from app.auth import create_access_token
    from app.config import settings
    from app.routes import video as video_route

    calls: list[str] = []

    def fake_build_video_artifacts(resource_id: str, job: dict[str, object]) -> dict[str, object]:
        calls.append(resource_id)
        time.sleep(0.05)
        return {
            "title": job.get("title") or "并发讲解视频",
            "duration_ms": 90000,
            "created_at": "2026-08-08T00:00:00",
            "resolution": "1920x1080",
            "fps": 30,
            "provider": "html_ppt",
            "tts_provider": "local_fallback",
            "voice": {"provider": "cosyvoice", "voice": "longxiaochun"},
            "has_mp4": False,
            "slides": 3,
        }

    monkeypatch.setattr(video_route, "build_video_artifacts", fake_build_video_artifacts)
    headers = {"Authorization": f"Bearer {create_access_token(settings.single_user_id)}"}
    created = await client.post(
        "/api/video/jobs",
        headers=headers,
        json={"prompt": "讲解并发控制", "title": "并发控制"},
    )
    job_id = created.json()["data"]["job_id"]

    first, second = await asyncio.gather(
        client.get(f"/api/video/jobs/{job_id}/events", headers=headers),
        client.get(f"/api/video/jobs/{job_id}/events", headers=headers),
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert '"type": "done"' in first.text
    assert '"type": "done"' in second.text
    assert calls == [created.json()["data"]["resource_id"]]
