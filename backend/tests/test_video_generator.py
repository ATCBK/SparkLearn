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
