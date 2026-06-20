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
    from app.routes import video as video_route

    before_count = len(video_route._jobs())

    response = await client.post(
        "/api/video/jobs",
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
    jobs = video_route._jobs()
    assert len(jobs) == before_count + 1
    latest = jobs[-1]
    assert latest["voice"] == {
        "provider": "cosyvoice",
        "voice": "longxiaochun",
        "speed": 1.0,
        "pitch": 1.0,
        "volume": 1.0,
    }
