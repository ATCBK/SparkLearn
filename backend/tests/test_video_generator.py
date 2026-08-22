import json


def test_find_ffmpeg_prefers_env_override(monkeypatch, tmp_path):
    from app import video_generator

    fake_ffmpeg = tmp_path / "ffmpeg.exe"
    fake_ffmpeg.write_bytes(b"")

    monkeypatch.setenv("FFMPEG_BINARY", str(fake_ffmpeg))
    monkeypatch.delenv("FFMPEG_PATH", raising=False)
    monkeypatch.delenv("VIDEO_FFMPEG_PATH", raising=False)
    monkeypatch.setattr(video_generator.shutil, "which", lambda *_args, **_kwargs: None)

    assert video_generator._find_ffmpeg() == str(fake_ffmpeg)


def test_find_ffmpeg_uses_where_output_on_windows(monkeypatch, tmp_path):
    from app import video_generator

    fake_ffmpeg = tmp_path / "ffmpeg.exe"
    fake_ffmpeg.write_bytes(b"")

    monkeypatch.delenv("FFMPEG_BINARY", raising=False)
    monkeypatch.delenv("FFMPEG_PATH", raising=False)
    monkeypatch.delenv("VIDEO_FFMPEG_PATH", raising=False)

    def fake_which(name: str):
        if name == "ffmpeg":
            return None
        if name in {"where", "where.exe"}:
            return r"C:\\Windows\\System32\\where.exe"
        return None

    class FakeCompleted:
        def __init__(self, stdout: str):
            self.stdout = stdout
            self.stderr = ""
            self.returncode = 0

    def fake_run(cmd, **kwargs):
        assert cmd[0].lower().endswith("where.exe")
        return FakeCompleted(stdout=f"{fake_ffmpeg}\n")

    monkeypatch.setattr(video_generator.shutil, "which", fake_which)
    monkeypatch.setattr(video_generator.subprocess, "run", fake_run)

    assert video_generator._find_ffmpeg() == str(fake_ffmpeg)


def test_build_video_artifacts_regenerates_prompt_like_outline(monkeypatch, tmp_path):
    from app import video_generator

    monkeypatch.setattr(video_generator, "VIDEO_ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(video_generator, "_write_segment_audio_files", lambda *_args, **_kwargs: {"provider": "test", "status": "completed", "message": "ok"})
    monkeypatch.setattr(video_generator, "_sync_segments_to_audio_durations", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(video_generator, "_find_ffmpeg", lambda: None)
    monkeypatch.setattr(video_generator, "_try_mux_mp4", lambda *_args, **_kwargs: {"ok": False, "status": "skipped", "message": "skip"})

    calls: list[dict[str, object]] = []

    def fake_make_polished_script(prompt: str, duration_sec: int, target_level: str, style: str, voice: str):
        calls.append({
            "prompt": prompt,
            "duration_sec": duration_sec,
            "target_level": target_level,
            "style": style,
            "voice": voice,
        })
        return {
            "title": "函数返回值真实讲解",
            "polished_prompt": "真实脚本",
            "content_source": "ai",
            "script_outline": [
                {
                    "segment_id": "seg_001",
                    "slide_type": "cover",
                    "title": "函数返回值",
                    "subtitle": "先看调用者拿到什么",
                    "slide_text": ["return 把结果交回调用处"],
                    "narration": "函数返回值不是打印在屏幕上的文字，而是函数执行结束后交回给调用者继续使用的数据。",
                    "duration_ms": 9000,
                }
            ],
        }

    monkeypatch.setattr(video_generator, "make_polished_script", fake_make_polished_script)

    manifest = video_generator.build_video_artifacts(
        "video_prompt_like_outline",
        {
            "prompt": "用视频讲解 Python 函数返回值",
            "title": "函数返回值",
            "duration_sec": 45,
            "target_level": "beginner",
            "style_id": "apple-minimal",
            "voice": {"voice": "longxiaochun"},
            "script_outline": [
                {
                    "title": "请生成视频脚本",
                    "narration": "请严格输出合法 JSON，字段包含 script_outline、slide_text、narration、duration_ms，不要输出 Markdown。",
                }
            ],
        },
    )

    timeline = json.loads((tmp_path / "video_prompt_like_outline" / "timeline.json").read_text(encoding="utf-8"))
    script = json.loads((tmp_path / "video_prompt_like_outline" / "script.json").read_text(encoding="utf-8"))

    assert calls == [{
        "prompt": "用视频讲解 Python 函数返回值",
        "duration_sec": 45,
        "target_level": "beginner",
        "style": "apple-minimal",
        "voice": "longxiaochun",
    }]
    assert manifest["title"] == "函数返回值真实讲解"
    assert "严格输出合法 JSON" not in timeline["segments"][0]["narration"]
    assert timeline["segments"][0]["narration"].startswith("函数返回值不是打印")
    assert "prompt" not in script
    assert script["script_outline"][0]["title"] == "函数返回值"
