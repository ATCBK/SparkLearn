import json
import math
import os
import re
import shutil
import ssl
import subprocess
import wave
import base64
import hashlib
import hmac
from datetime import datetime
from email.utils import formatdate
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlparse

from .config import settings
from .video_ai import VideoAIScriptError, generate_video_script_with_ai


VIDEO_ARTIFACT_ROOT = settings.data_dir / "artifacts" / "video"


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def artifact_dir(resource_id: str) -> Path:
    path = VIDEO_ARTIFACT_ROOT / resource_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def make_polished_script(
    prompt: str,
    duration_sec: int = 90,
    target_level: str = "beginner",
    style: str = "apple-minimal",
) -> dict[str, Any]:
    clean_prompt = " ".join(prompt.strip().split()) or "Python 基础知识讲解"
    polish_id = _make_polish_id(clean_prompt, duration_sec, target_level, style)
    style_config = _get_style_config(style)

    try:
        ai_script = generate_video_script_with_ai(clean_prompt, duration_sec, target_level, style)
        return {
            "polish_id": polish_id,
            "title": str(ai_script.get("title") or _make_title(clean_prompt)),
            "polished_prompt": str(ai_script.get("polished_prompt") or clean_prompt),
            "script_outline": ai_script.get("script_outline") or [],
            "estimated_duration_sec": duration_sec,
            "voice": settings.xf_tts_default_voice,
            "content_source": "ai",
            "ai_provider": str(ai_script.get("ai_provider") or settings.video_ai_provider),
            "ai_model": str(ai_script.get("ai_model") or settings.video_ai_model),
            "style_id": style,
            "style_name": style_config.get("name", style),
        }
    except Exception as ex:
        raise VideoAIScriptError(f"AI 视频脚本生成失败：{ex}") from ex


def _topic_code_sample(topic: str) -> str:
    lower = topic.lower()
    if "变量" in topic or "variable" in lower:
        return 'score = 95\nname = "SparkLearn"\nprint(name, score)'
    if "函数" in topic or "function" in lower:
        return 'def greet(name):\n    return "Hello, " + name\n\nprint(greet("Ada"))'
    if "循环" in topic or "loop" in lower:
        return 'total = 0\nfor n in [1, 2, 3]:\n    total += n\nprint(total)'
    if "列表" in topic or "list" in lower:
        return 'items = ["变量", "函数", "循环"]\nitems.append("列表")\nprint(items)'
    return '# 最小示例\nidea = "先理解问题，再写规则"\nprint(idea)'


def build_video_artifacts(resource_id: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = str(job.get("prompt") or "")
    title = str(job.get("title") or _make_title(prompt))
    script_outline = job.get("script_outline")
    style_id = str(job.get("style_id") or job.get("styleId") or "apple-minimal")
    style_config = _get_style_config(style_id)
    style_name = style_config.get("name", style_id)
    generated_script: dict[str, Any] = {}
    if not isinstance(script_outline, list) or not script_outline:
        generated_script = make_polished_script(prompt, style=style_id)
        script_outline = generated_script.get("script_outline", [])
        title = str(generated_script.get("title") or title)
        style_id = str(generated_script.get("style_id") or style_id)
    content_source = str(job.get("content_source") or generated_script.get("content_source") or "provided")

    root = artifact_dir(resource_id)
    segments = _build_timeline_segments(script_outline)
    script = {
        "title": title,
        "prompt": prompt,
        "provider": str(job.get("video_provider") or settings.video_default_provider),
        "content_source": content_source,
        "ai_provider": str(job.get("ai_provider") or generated_script.get("ai_provider") or settings.video_ai_provider),
        "ai_model": str(job.get("ai_model") or generated_script.get("ai_model") or settings.video_ai_model),
        "style_id": style_id,
        "style_name": style_name,
        "script_outline": script_outline,
    }

    (root / "script.json").write_text(json.dumps(script, ensure_ascii=False, indent=2), encoding="utf-8")
    audio_result = _write_segment_audio_files(root, segments)
    _sync_segments_to_audio_durations(root, segments)
    duration_ms = segments[-1]["end_ms"] if segments else 0

    timeline = {
        "version": "1.0.0",
        "resource_id": resource_id,
        "title": title,
        "duration_ms": duration_ms,
        "segments": segments,
    }
    slides = _build_ppt_slides(title, segments)
    (root / "slides.json").write_text(json.dumps({"title": title, "slides": slides}, ensure_ascii=False, indent=2), encoding="utf-8")
    (root / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")
    (root / "subtitle.srt").write_text(_to_srt(segments), encoding="utf-8")
    (root / "slides.html").write_text(_slides_overview_html(title, slides, style_id), encoding="utf-8")
    (root / "scene.html").write_text(_slides_overview_html(title, slides, style_id), encoding="utf-8")

    slide_paths = _write_slide_html_files(root, title, slides, style_id)
    frame_result = (
        _render_slide_frames(root, slide_paths)
        if _find_ffmpeg()
        else {"status": "skipped", "message": "未找到 FFmpeg，跳过 PPT 截图渲染；安装 FFmpeg 后会自动截图并合成 MP4。", "frames": []}
    )
    mux_result = _try_mux_mp4(root, segments, frame_result.get("frames", []))

    manifest = {
        "resource_id": resource_id,
        "provider": str(job.get("video_provider") or settings.video_default_provider),
        "tts_provider": audio_result["provider"],
        "title": title,
        "duration_ms": duration_ms,
        "resolution": "1920x1080",
        "fps": 30,
        "files": {
            "scene": "slides.html",
            "slides": "slides.json",
            "audio": "narration.wav",
            "subtitle": "subtitle.srt",
            "timeline": "timeline.json",
        },
        "slides": len(slides),
        "audio_status": audio_result["status"],
        "audio_message": audio_result["message"],
        "frame_status": frame_result["status"],
        "frame_message": frame_result["message"],
        "has_mp4": mux_result["ok"],
        "mux_status": mux_result["status"],
        "mux_message": mux_result["message"],
        "created_at": now_iso(),
        "note": f"V5 纯 AI 管线 + 多风格渲染（{style_name}），逐页生成讲解音频，安装 FFmpeg 后自动合成 output.mp4。",
        "content_version": "v5",
        "content_source": content_source,
        "style_id": style_id,
        "style_name": style_name,
    }
    if mux_result["ok"]:
        manifest["files"]["mp4"] = "output.mp4"
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def _build_ppt_slides(title: str, segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    slides: list[dict[str, Any]] = []
    for idx, seg in enumerate(segments, start=1):
        narration = str(seg.get("narration") or "")
        sentences = [x for x in re.split(r"[。！？!?；;]", narration) if x.strip()]
        slide_text = seg.get("slide_text")
        bullets = [str(x) for x in slide_text if str(x).strip()] if isinstance(slide_text, list) else []
        if not bullets:
            bullets = sentences[:3] or [str(seg.get("subtitle") or seg.get("title") or "讲解要点")]
        slides.append(
            {
                "slide_id": f"slide_{idx:03d}",
                "index": idx,
                "deck_title": title,
                "slide_type": str(seg.get("slide_type") or "concept"),
                "title": str(seg.get("title") or f"第 {idx} 页"),
                "subtitle": str(seg.get("subtitle") or ""),
                "bullets": bullets,
                "visual_hint": str(seg.get("visual_hint") or ""),
                "teacher_note": str(seg.get("teacher_note") or ""),
                "interaction": str(seg.get("interaction") or ""),
                "code": str(seg.get("code") or ""),
                "mistake": str(seg.get("mistake") or ""),
                "answer": str(seg.get("answer") or ""),
                "narration": narration,
                "start_ms": int(seg.get("start_ms") or 0),
                "end_ms": int(seg.get("end_ms") or 0),
                "segment_id": str(seg.get("segment_id") or f"seg_{idx:03d}"),
            }
        )
    return slides


def _write_slide_html_files(root: Path, title: str, slides: list[dict[str, Any]], style_id: str = "apple-minimal") -> list[Path]:
    slides_dir = root / "slides"
    slides_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    total = len(slides)
    for slide in slides:
        path = slides_dir / f"{slide['slide_id']}.html"
        path.write_text(_single_slide_html(title, slide, total, style_id), encoding="utf-8")
        paths.append(path)
    return paths


def _write_segment_audio_files(root: Path, segments: list[dict[str, Any]]) -> dict[str, str]:
    audio_dir = root / "audio_segments"
    audio_dir.mkdir(parents=True, exist_ok=True)
    used_provider = "xunfei_tts" if _has_xfyun_tts_config() else "windows_sapi"
    messages: list[str] = []
    segment_paths: list[Path] = []
    for idx, seg in enumerate(segments, start=1):
        wav_path = audio_dir / f"seg_{idx:03d}.wav"
        text = str(seg.get("narration") or seg.get("subtitle") or seg.get("title") or "")
        ok = False
        message = ""
        if _has_xfyun_tts_config():
            ok, message = _try_xfyun_tts_wav(wav_path, text)
        if not ok:
            sapi_ok, sapi_message = _try_windows_sapi_tts(wav_path, text)
            ok = sapi_ok
            message = message or sapi_message
            if sapi_ok and used_provider != "xunfei_tts":
                used_provider = "windows_sapi"
        if not ok:
            used_provider = "tone_fallback"
            _write_tone_wav(wav_path, int(seg.get("end_ms", 0)) - int(seg.get("start_ms", 0)))
            messages.append(_brief_error(message))
        segment_paths.append(wav_path)

    _write_concat_wav(root / "narration.wav", segment_paths)
    if used_provider == "xunfei_tts":
        return {"provider": "xunfei_tts", "status": "completed", "message": "已用讯飞 TTS 生成逐页讲解 WAV。"}
    if used_provider == "windows_sapi":
        return {"provider": "windows_sapi", "status": "completed", "message": "已用 Windows SAPI 生成逐页讲解 WAV。"}
    return {
        "provider": "tone_fallback",
        "status": "fallback",
        "message": "讯飞/系统语音不可用，已生成可播放提示音轨。 " + "；".join(messages[:2]),
    }


def _has_xfyun_tts_config() -> bool:
    return bool(settings.xf_tts_app_id and settings.xf_tts_api_key and settings.xf_tts_api_secret)


def _try_xfyun_tts_wav(path: Path, text: str) -> tuple[bool, str]:
    if not text.strip():
        return False, "讲稿为空。"
    try:
        from websockets.sync.client import connect
    except Exception as ex:
        return False, f"websockets sync client 不可用：{ex}"

    try:
        auth_url = _build_xfyun_tts_url()
        sample_rate = settings.xf_tts_sample_rate
        auf = f"audio/L16;rate={sample_rate}"
        payload = {
            "common": {"app_id": settings.xf_tts_app_id},
            "business": {
                "aue": "raw",
                "auf": auf,
                "vcn": settings.xf_tts_default_voice,
                "tte": "utf8",
                "speed": settings.xf_tts_speed,
                "volume": settings.xf_tts_volume,
                "pitch": settings.xf_tts_pitch,
            },
            "data": {
                "status": 2,
                "text": base64.b64encode(text.encode("utf-8")).decode("ascii"),
            },
        }
        pcm = bytearray()
        _ssl_ctx = ssl.create_default_context()
        _ssl_ctx.check_hostname = False
        _ssl_ctx.verify_mode = ssl.CERT_NONE
        with connect(auth_url, open_timeout=max(5, settings.xf_tts_timeout_ms / 1000), ssl=_ssl_ctx) as ws:
            ws.send(json.dumps(payload, ensure_ascii=False))
            while True:
                raw = ws.recv(timeout=max(5, settings.xf_tts_timeout_ms / 1000))
                data = json.loads(raw)
                header = data.get("header", {})
                code = int(header.get("code", 0))
                if code != 0:
                    return False, f"讯飞 TTS 错误 {code}: {header.get('message', '')}"
                audio_b64 = data.get("data", {}).get("audio", "")
                if audio_b64:
                    pcm.extend(base64.b64decode(audio_b64))
                if int(data.get("data", {}).get("status", 0)) == 2:
                    break
        if not pcm:
            return False, "讯飞 TTS 未返回音频数据。"
        _write_pcm_as_wav(path, bytes(pcm), sample_rate=sample_rate)
        return True, "ok"
    except Exception as ex:
        return False, f"讯飞 TTS 调用失败：{ex}"


def _build_xfyun_tts_url() -> str:
    parsed = urlparse(settings.xf_tts_base_url)
    host = parsed.netloc
    path = parsed.path or "/v2/tts"
    date = formatdate(timeval=None, localtime=False, usegmt=True)
    signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
    digest = hmac.new(settings.xf_tts_api_secret.encode("utf-8"), signature_origin.encode("utf-8"), hashlib.sha256).digest()
    signature = base64.b64encode(digest).decode("ascii")
    authorization_origin = (
        f'api_key="{settings.xf_tts_api_key}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature}"'
    )
    query = urlencode(
        {
            "authorization": base64.b64encode(authorization_origin.encode("utf-8")).decode("ascii"),
            "date": date,
            "host": host,
        }
    )
    return f"{settings.xf_tts_base_url}?{query}"


def _write_pcm_as_wav(path: Path, pcm: bytes, sample_rate: int) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)


def _brief_error(message: str) -> str:
    line = (message or "").strip().splitlines()
    if not line:
        return "未知错误"
    first = line[0]
    return first[:160] + ("..." if len(first) > 160 else "")


def _try_windows_sapi_tts(path: Path, text: str) -> tuple[bool, str]:
    if os.name != "nt" or not text.strip():
        return False, "当前系统不是 Windows 或讲稿为空。"
    powershell = shutil.which("powershell") or shutil.which("powershell.exe")
    if not powershell:
        return False, "未找到 PowerShell，无法调用 Windows SAPI。"
    script_path = path.parent / "_sapi_tts.ps1"
    script_path.write_text(
        "\n".join(
            [
                "param([string]$OutputPath, [string]$Text)",
                "Add-Type -AssemblyName System.Speech",
                "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
                "$s.Rate = 0",
                "$s.Volume = 100",
                "$s.SetOutputToWaveFile($OutputPath)",
                "$s.Speak($Text)",
                "$s.Dispose()",
            ]
        ),
        encoding="utf-8",
    )
    try:
        completed = subprocess.run(
            [powershell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script_path), str(path), text],
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
    except Exception as ex:
        return False, f"Windows SAPI 调用异常：{ex}"
    if completed.returncode != 0 or not path.exists() or path.stat().st_size < 1024:
        err = (completed.stderr or completed.stdout or "未知错误").strip()
        return False, f"Windows SAPI 生成失败：{err}"
    return True, "ok"


def _write_concat_wav(output: Path, segment_paths: list[Path]) -> None:
    if not segment_paths:
        _write_tone_wav(output, 1000)
        return
    params = None
    frames: list[bytes] = []
    for path in segment_paths:
        with wave.open(str(path), "rb") as wav:
            current = wav.getparams()
            data = wav.readframes(wav.getnframes())
            if params is None:
                params = current
            if current[:3] != params[:3]:
                continue
            frames.append(data)
    if params is None:
        _write_tone_wav(output, 1000)
        return
    with wave.open(str(output), "wb") as out:
        out.setparams(params)
        for data in frames:
            out.writeframes(data)


def _sync_segments_to_audio_durations(root: Path, segments: list[dict[str, Any]]) -> None:
    audio_dir = root / "audio_segments"
    start = 0
    for idx, seg in enumerate(segments, start=1):
        planned_ms = max(1000, int(seg.get("end_ms", 0)) - int(seg.get("start_ms", 0)))
        audio_ms = _wav_duration_ms(audio_dir / f"seg_{idx:03d}.wav")
        duration_ms = max(planned_ms, audio_ms)
        seg["start_ms"] = start
        seg["end_ms"] = start + duration_ms
        start = seg["end_ms"]


def _wav_duration_ms(path: Path) -> int:
    if not path.exists():
        return 0
    try:
        with wave.open(str(path), "rb") as wav:
            if wav.getframerate() <= 0:
                return 0
            return int((wav.getnframes() / wav.getframerate()) * 1000)
    except Exception:
        return 0


def _render_slide_frames(root: Path, slide_paths: list[Path]) -> dict[str, Any]:
    frames_dir = root / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    try:
        from playwright.sync_api import sync_playwright
    except Exception as ex:
        return {"status": "playwright_missing", "message": f"Playwright 不可用：{ex}", "frames": []}

    frames: list[Path] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            for idx, slide_path in enumerate(slide_paths, start=1):
                frame_path = frames_dir / f"slide_{idx:03d}.png"
                page.goto(slide_path.resolve().as_uri(), wait_until="networkidle")
                page.screenshot(path=str(frame_path), full_page=False)
                frames.append(frame_path)
            browser.close()
    except Exception as ex:
        return {
            "status": "render_failed",
            "message": f"Playwright 截图失败：{ex}。请执行 python -m playwright install chromium。",
            "frames": [],
        }

    return {"status": "completed", "message": f"已渲染 {len(frames)} 页 PPT 画面。", "frames": frames}


def _make_title(prompt: str) -> str:
    text = re.sub(r"\s+", " ", prompt).strip(" ，。,.") or "AI 讲解视频"
    if len(text) <= 18:
        return text
    return text[:18] + "..."


def _get_style_config(style_id: str) -> dict[str, Any]:
    styles = settings.video_styles
    if isinstance(styles, dict) and style_id in styles:
        return styles[style_id]
    # fallback to apple-minimal
    fallback = styles.get("apple-minimal", {}) if isinstance(styles, dict) else {}
    return fallback if fallback else {
        "id": "apple-minimal", "name": "苹果极简风",
        "accent_color": "#0071e3",
        "bg_gradient": "linear-gradient(135deg, #ffffff 0%, #e8f7ff 48%, #f7f3ff 100%)",
        "font_family": '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
        "code_bg": "#1d1d1f", "code_color": "#f5f5f7",
        "card_bg": "rgba(255,255,255,.74)",
    }


def _make_polish_id(prompt: str, duration_sec: int, target_level: str, style: str) -> str:
    raw = f"{prompt}|{duration_sec}|{target_level}|{style}".encode("utf-8")
    digest = hashlib.sha1(raw).hexdigest()[:8]
    return f"polish_{digest}"


def _build_timeline_segments(script_outline: list[Any]) -> list[dict[str, Any]]:
    start = 0
    segments: list[dict[str, Any]] = []
    for idx, item in enumerate(script_outline, start=1):
        if not isinstance(item, dict):
            continue
        duration_ms = int(item.get("duration_ms") or 18000)
        duration_ms = max(6000, min(duration_ms, 45000))
        narration = str(item.get("narration") or item.get("subtitle") or item.get("title") or "")
        subtitle = str(item.get("subtitle") or _compact_subtitle(narration))
        end = start + duration_ms
        segments.append(
            {
                "segment_id": str(item.get("segment_id") or f"seg_{idx:03d}"),
                "slide_type": str(item.get("slide_type") or "concept"),
                "title": str(item.get("title") or f"第 {idx} 段"),
                "start_ms": start,
                "end_ms": end,
                "narration": narration,
                "subtitle": subtitle,
                "slide_text": item.get("slide_text") if isinstance(item.get("slide_text"), list) else [],
                "visual_hint": str(item.get("visual_hint") or ""),
                "teacher_note": str(item.get("teacher_note") or ""),
                "interaction": str(item.get("interaction") or ""),
                "code": str(item.get("code") or ""),
                "mistake": str(item.get("mistake") or ""),
                "answer": str(item.get("answer") or ""),
            }
        )
        start = end
    return segments


def _compact_subtitle(text: str) -> str:
    text = re.sub(r"\s+", "", text)
    return text[:42] + ("..." if len(text) > 42 else "")


def _to_srt(segments: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for idx, seg in enumerate(segments, start=1):
        blocks.append(
            "\n".join(
                [
                    str(idx),
                    f"{_fmt_srt(seg['start_ms'])} --> {_fmt_srt(seg['end_ms'])}",
                    str(seg.get("subtitle") or seg.get("title") or ""),
                ]
            )
        )
    return "\n\n".join(blocks) + "\n"


def _fmt_srt(ms: int) -> str:
    h = ms // 3_600_000
    ms %= 3_600_000
    m = ms // 60_000
    ms %= 60_000
    s = ms // 1000
    milli = ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{milli:03d}"


def _write_tone_wav(path: Path, duration_ms: int) -> None:
    # Local preview fallback: short, low-volume tone bed. Real TTS provider can
    # replace this file without changing the API contract.
    sample_rate = 16000
    duration_sec = max(1.0, min(duration_ms / 1000, 180.0))
    frames = int(sample_rate * duration_sec)
    amplitude = 1200
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(frames):
            envelope = 0.25 + 0.75 * math.sin(math.pi * min(i / sample_rate, duration_sec) / duration_sec) ** 2
            value = int(amplitude * envelope * math.sin(2 * math.pi * 220 * i / sample_rate))
            wav.writeframesraw(value.to_bytes(2, byteorder="little", signed=True))


def _find_ffmpeg() -> str | None:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg
    try:
        import imageio_ffmpeg

        return str(imageio_ffmpeg.get_ffmpeg_exe())
    except Exception:
        return None


def _try_mux_mp4(root: Path, segments: list[dict[str, Any]], frames: list[Path]) -> dict[str, Any]:
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        return {
            "ok": False,
            "status": "ffmpeg_missing",
            "message": "未找到 FFmpeg，已生成 HTML-PPT、音频和字幕；安装 FFmpeg 或 imageio-ffmpeg 后可生成 output.mp4。",
        }
    if not frames:
        return {
            "ok": False,
            "status": "frames_missing",
            "message": "PPT 页面截图未生成，无法合成 MP4。请确认 Playwright Chromium 已安装。",
        }

    audio_dir = root / "audio_segments"
    parts_dir = root / "video_parts"
    parts_dir.mkdir(parents=True, exist_ok=True)
    part_paths: list[Path] = []
    for idx, frame in enumerate(frames, start=1):
        seg = segments[idx - 1] if idx - 1 < len(segments) else {}
        fallback_duration = max(1.0, (int(seg.get("end_ms", 0)) - int(seg.get("start_ms", 0))) / 1000)
        audio = audio_dir / f"seg_{idx:03d}.wav"
        part = parts_dir / f"part_{idx:03d}.mp4"
        cmd = [
            ffmpeg,
            "-y",
            "-loop", "1",
            "-framerate", "30",
            "-i", str(frame),
            "-i", str(audio),
            "-t", f"{fallback_duration:.3f}",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-shortest",
            str(part),
        ]
        # timeout scales with segment duration (min 120s, max 600s)
        seg_timeout = max(120, int(fallback_duration * 4))
        result = _run_ffmpeg(cmd, timeout=seg_timeout)
        if not result["ok"]:
            return result
        part_paths.append(part)

    concat_file = root / "concat.txt"
    concat_file.write_text("\n".join(f"file '{p.as_posix()}'" for p in part_paths), encoding="utf-8")
    output = root / "output.mp4"
    cmd = [
        ffmpeg,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),
        "-c", "copy",
        "-movflags", "+faststart",
        str(output),
    ]
    result = _run_ffmpeg(cmd)
    if not result["ok"]:
        return result
    return {"ok": True, "status": "completed", "message": "已按 HTML-PPT 页面和逐页语音生成 output.mp4。"}


def _run_ffmpeg(cmd: list[str], timeout: int = 120) -> dict[str, Any]:
    try:
        completed = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return {"ok": False, "status": "mux_failed", "message": f"FFmpeg 执行超时（{timeout} 秒），可尝试缩短视频时长或升级 CPU。"}
    except Exception as ex:
        return {"ok": False, "status": "mux_failed", "message": f"FFmpeg 调用失败：{ex}"}

    output = Path(cmd[-1])
    if completed.returncode != 0 or not output.exists():
        detail = (completed.stderr or completed.stdout or "").strip().splitlines()
        tail = detail[-1] if detail else "未知错误"
        return {"ok": False, "status": "mux_failed", "message": f"FFmpeg 合成失败：{tail}"}

    return {"ok": True, "status": "completed", "message": "FFmpeg 命令执行成功。"}


def _scene_html(title: str, segments: list[dict[str, Any]]) -> str:
    cards = []
    for seg in segments:
        cards.append(
            f"""
            <section class="segment">
              <div class="time">{escape(_fmt_clock(seg['start_ms']))}</div>
              <h2>{escape(str(seg.get('title') or ''))}</h2>
              <p>{escape(str(seg.get('subtitle') or ''))}</p>
              <small>{escape(str(seg.get('visual_hint') or ''))}</small>
            </section>
            """
        )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fb; color: #1d1d1f; }}
    main {{ width: min(1080px, calc(100vw - 48px)); margin: 40px auto; }}
    .hero {{ border-radius: 24px; padding: 36px; background: linear-gradient(135deg, #ffffff, #eaf6ff); border: 1px solid rgba(0,0,0,.06); }}
    h1 {{ margin: 0; font-size: 40px; line-height: 1.15; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 20px; }}
    .segment {{ min-height: 180px; border-radius: 18px; padding: 20px; background: #fff; border: 1px solid rgba(0,0,0,.06); box-shadow: 0 10px 30px rgba(27,39,70,.08); }}
    .time {{ color: #0071e3; font-weight: 700; font-size: 13px; }}
    h2 {{ margin: 16px 0 8px; }}
    p {{ color: #424245; line-height: 1.7; }}
    small {{ color: #6e6e73; }}
  </style>
</head>
<body>
  <main>
    <div class="hero">
      <h1>{escape(title)}</h1>
      <p>由 SparkLearn 视频创作链路生成的可预览教学场景。</p>
    </div>
    <div class="grid">{''.join(cards)}</div>
  </main>
</body>
</html>"""


def _slides_overview_html(title: str, slides: list[dict[str, Any]], style_id: str = "apple-minimal") -> str:
    sections = "".join(_slide_markup(slide, len(slides), overview=True) for slide in slides)
    return _html_shell(title, f"<div class=\"deck\">{sections}</div>", overview=True, style_id=style_id)


def _single_slide_html(deck_title: str, slide: dict[str, Any], total: int, style_id: str = "apple-minimal") -> str:
    return _html_shell(deck_title, _slide_markup(slide, total, overview=False), overview=False, style_id=style_id)


def _html_shell(title: str, body: str, overview: bool, style_id: str = "apple-minimal") -> str:
    sc = _get_style_config(style_id)
    accent = sc.get("accent_color", "#0071e3")
    bg_gradient = sc.get("bg_gradient", "linear-gradient(135deg, #ffffff 0%, #e8f7ff 48%, #f7f3ff 100%)")
    font_family = sc.get("font_family", '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif')
    code_bg = sc.get("code_bg", "#1d1d1f")
    code_color = sc.get("code_color", "#f5f5f7")
    card_bg = sc.get("card_bg", "rgba(255,255,255,.74)")
    wrapper_width = "min(1280px, calc(100vw - 56px))" if overview else "100vw"
    wrapper_margin = "40px auto" if overview else "0"
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <style>
    :root {{
      --accent: {accent};
      --accent-soft: {accent}18;
      --bg-gradient: {bg_gradient};
      --font: {font_family};
      --code-bg: {code_bg};
      --code-color: {code_color};
      --card-bg: {card_bg};
      --card-border: rgba(128,128,128,.12);
      --text-primary: #1a1a2e;
      --text-secondary: #52525b;
      --text-muted: #8e8e93;
      --shadow-sm: 0 1px 3px rgba(0,0,0,.04);
      --shadow-md: 0 8px 30px rgba(0,0,0,.06);
      --shadow-lg: 0 24px 80px rgba(0,0,0,.10);
      --radius-sm: 14px;
      --radius-md: 20px;
      --radius-lg: 28px;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: var(--font);
      background: #f0f2f5;
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }}
    .deck {{
      width: {wrapper_width};
      margin: {wrapper_margin};
      display: grid;
      gap: 28px;
      padding: {("40px 0" if overview else "0")};
    }}

    /* ── Slide Shell ───────────────────────────────────────── */
    .slide {{
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: #fafbfc;
      border-radius: {("var(--radius-lg)" if overview else "0")};
      border: {("1px solid var(--card-border)" if overview else "none")};
      box-shadow: {("var(--shadow-lg)" if overview else "none")};
      transition: transform .2s ease, box-shadow .2s ease;
    }}
    .slide:hover {{ transform: {"translateY(-4px)" if overview else "none"}; box-shadow: {("0 32px 100px rgba(0,0,0,.14)" if overview else "none")}; }}
    .slide.single {{ width: 100vw; height: 100vh; aspect-ratio: auto; border: 0; border-radius: 0; box-shadow: none; }}
    .slide.single:hover {{ transform: none; box-shadow: none; }}

    /* ── Background Layers ──────────────────────────────────── */
    .band {{
      position: absolute; inset: 0;
      background: var(--bg-gradient);
    }}
    .mesh {{
      position: absolute; inset: 0;
      background-image:
        radial-gradient(circle at 15% 25%, var(--accent-soft) 0%, transparent 50%),
        radial-gradient(circle at 78% 70%, var(--accent-soft) 0%, transparent 42%),
        radial-gradient(circle at 50% 50%, rgba(200,210,220,.14) 0%, transparent 60%);
    }}
    .grid-overlay {{
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(128,128,128,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(128,128,128,.04) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    }}
    .accent-blob {{
      position: absolute;
      border-radius: 999px;
      background: var(--accent);
      opacity: .09;
      filter: blur(80px);
    }}
    .accent-blob.top {{ right: -140px; top: -120px; width: 480px; height: 480px; }}
    .accent-blob.bottom {{ left: -100px; bottom: -100px; width: 360px; height: 360px; }}

    /* ── Content Layout ─────────────────────────────────────── */
    .content {{
      position: relative; z-index: 1;
      height: 100%; padding: 64px 76px;
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: 48px; align-items: center;
    }}
    .content.full {{ grid-template-columns: 1fr; align-content: center; max-width: 900px; margin: 0 auto; }}

    /* ── Typography ─────────────────────────────────────────── */
    .eyebrow {{
      display: inline-flex; align-items: center; gap: 10px;
      color: var(--accent); font-size: 20px; font-weight: 700;
      letter-spacing: .06em; text-transform: uppercase;
      margin-bottom: 28px;
    }}
    .eyebrow::before {{
      content: ""; display: block;
      width: 32px; height: 3px; border-radius: 2px;
      background: var(--accent);
    }}
    h1 {{
      font-size: 68px; line-height: 1.08; letter-spacing: -.02em;
      font-weight: 800; color: var(--text-primary);
    }}
    .subtitle {{
      margin-top: 20px; color: var(--text-secondary);
      font-size: 30px; line-height: 1.5; font-weight: 400;
      max-width: 32em;
    }}

    /* ── Bullet List ────────────────────────────────────────── */
    ul {{
      margin: 0; padding: 0; list-style: none;
      display: grid; gap: 16px;
    }}
    li {{
      position: relative;
      padding: 18px 20px 18px 48px;
      border-radius: var(--radius-sm);
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      font-size: 26px; line-height: 1.5; color: var(--text-primary);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: transform .15s ease, box-shadow .15s ease;
    }}
    li:hover {{ transform: translateX(4px); box-shadow: var(--shadow-md); }}
    li::before {{
      content: "";
      position: absolute; left: 18px; top: 28px;
      width: 7px; height: 7px;
      border-radius: 999px;
      background: var(--accent);
      opacity: .7;
    }}
    .hint {{
      margin-top: 22px; color: var(--text-muted);
      font-size: 20px; line-height: 1.6; font-style: italic;
    }}

    /* ── Panel / Card ───────────────────────────────────────── */
    .panel {{
      border-radius: var(--radius-md);
      padding: 28px 30px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }}
    .label {{
      color: var(--accent); font-size: 19px; font-weight: 800;
      letter-spacing: .04em; margin-bottom: 18px;
      display: flex; align-items: center; gap: 10px;
    }}
    .label::after {{
      content: "";
      display: block; flex: 1; height: 1px;
      background: linear-gradient(to right, var(--accent-soft), transparent);
    }}

    /* ── Code Block ─────────────────────────────────────────── */
    .code-block {{
      position: relative;
      margin: 0;
      border-radius: var(--radius-md);
      background: var(--code-bg);
      overflow: hidden;
      box-shadow: var(--shadow-md);
    }}
    .code-block::before {{
      content: "";
      display: flex; gap: 8px;
      padding: 14px 18px;
      background: rgba(255,255,255,.05);
      border-bottom: 1px solid rgba(255,255,255,.06);
    }}
    .code-header {{
      display: flex; align-items: center; gap: 8px;
      padding: 12px 18px;
      background: rgba(255,255,255,.04);
      border-bottom: 1px solid rgba(255,255,255,.06);
    }}
    .dot {{ width: 10px; height: 10px; border-radius: 999px; }}
    .dot.r {{ background: #ff5f57; }} .dot.y {{ background: #febc2e; }} .dot.g {{ background: #30d158; }}
    .code {{
      margin: 0; padding: 22px 24px;
      white-space: pre-wrap;
      font-family: "JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace;
      font-size: 26px; line-height: 1.6;
      color: var(--code-color);
    }}

    /* ── Compare (Mistake / Analogy) ────────────────────────── */
    .compare {{
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    }}
    .box {{
      border-radius: var(--radius-md);
      padding: 26px 28px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: transform .15s ease;
    }}
    .box:hover {{ transform: translateY(-2px); }}
    .box strong {{
      display: block; font-size: 22px; margin-bottom: 16px;
      color: var(--accent); letter-spacing: .02em;
    }}
    .box p {{
      margin: 0; color: var(--text-secondary);
      font-size: 26px; line-height: 1.55;
    }}

    /* ── Steps (Process) ────────────────────────────────────── */
    .steps {{ counter-reset: step; display: grid; gap: 14px; }}
    .step {{
      counter-increment: step;
      display: flex; align-items: center; gap: 20px;
      padding: 18px 22px; border-radius: var(--radius-sm);
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      font-size: 26px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: transform .15s ease;
    }}
    .step:hover {{ transform: translateX(6px); }}
    .step::before {{
      content: "0" counter(step);
      display: grid; place-items: center;
      min-width: 44px; height: 44px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff; font-weight: 800; font-size: 18px;
    }}

    /* ── Quiz / Question ────────────────────────────────────── */
    .question {{
      font-size: 34px; line-height: 1.4; font-weight: 700;
      color: var(--text-primary);
    }}
    .answer {{
      margin-top: 18px; color: var(--text-muted);
      font-size: 24px; line-height: 1.6;
    }}

    /* ── Teacher Note ───────────────────────────────────────── */
    .note {{
      margin-top: 20px; padding: 16px 20px;
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
      border-left: 3px solid var(--accent);
      color: var(--text-secondary);
      font-size: 19px; line-height: 1.6;
    }}

    /* ── Footer ─────────────────────────────────────────────── */
    .footer {{
      position: absolute; left: 76px; right: 76px; bottom: 36px;
      display: flex; justify-content: space-between; align-items: center;
      color: var(--text-muted); font-size: 17px;
      z-index: 1;
    }}
    .progress-dots {{
      display: flex; gap: 8px; align-items: center;
    }}
    .progress-dot {{
      width: 8px; height: 8px; border-radius: 999px;
      background: rgba(128,128,128,.25);
      transition: all .3s ease;
    }}
    .progress-dot.active {{
      width: 24px; border-radius: 4px;
      background: var(--accent);
    }}
  </style>
</head>
<body>{body}</body>
</html>"""


def _slide_markup(slide: dict[str, Any], total: int, overview: bool) -> str:
    bullets = "".join(f"<li>{escape(str(item))}</li>" for item in slide.get("bullets", []))
    cls = "slide" if overview else "slide single"
    slide_type = str(slide.get("slide_type") or "concept")
    visual = _slide_visual_markup(slide_type, slide, bullets)
    content_class = "content full" if slide_type in {"cover", "goals", "summary"} else "content"
    idx = int(slide.get("index") or 1)
    progress = "".join(
        f'<span class="progress-dot{" active" if i == idx else ""}"></span>'
        for i in range(1, total + 1)
    ) if overview else ""
    return f"""
    <section class="{cls}">
      <div class="band"></div>
      <div class="mesh"></div>
      <div class="grid-overlay"></div>
      <div class="accent-blob top"></div>
      <div class="accent-blob bottom"></div>
      <div class="{content_class}">
        <div>
          <div class="eyebrow">{escape(_slide_type_label(slide_type))} · {idx:02d}/{total:02d}</div>
          <h1>{escape(str(slide.get('title') or ''))}</h1>
          <p class="subtitle">{escape(str(slide.get('subtitle') or ''))}</p>
          <p class="hint">{escape(str(slide.get('visual_hint') or ''))}</p>
          {_teacher_note_markup(slide)}
        </div>
        {visual}
      </div>
      <div class="footer">
        <span>{escape(str(slide.get('deck_title') or ''))}</span>
        <div class="progress-dots">{progress}</div>
        <span>{escape(str(slide.get('segment_id') or ''))}</span>
      </div>
    </section>
    """


def _teacher_note_markup(slide: dict[str, Any]) -> str:
    note = str(slide.get("teacher_note") or "").strip()
    if not note:
        return ""
    return f'<div class="note">{escape(note)}</div>'


def _slide_type_label(slide_type: str) -> str:
    labels = {
        "cover": "封面", "goals": "学习目标", "hook": "问题引入",
        "concept": "核心概念", "analogy": "类比理解", "process": "步骤拆解",
        "code": "代码演示", "mistake": "避坑指南", "quiz": "小练习", "summary": "课堂总结",
    }
    return labels.get(slide_type, slide_type)

def _slide_visual_markup(slide_type: str, slide: dict[str, Any], bullets: str) -> str:
    code = str(slide.get("code") or "").strip()
    interaction = str(slide.get("interaction") or "").strip()
    mistake = str(slide.get("mistake") or "").strip()
    answer = str(slide.get("answer") or "").strip()

    if slide_type == "cover":
        return f'<ul>{bullets}</ul>'
    if slide_type == "goals":
        return f'<div class="panel"><div class="label">学习目标 Checklist</div><ul>{bullets}</ul></div>'
    if slide_type == "hook":
        return f'<div class="panel"><div class="label">先思考</div><div class="question">{escape(interaction)}</div></div>'
    if slide_type == "analogy":
        return (
            '<div class="compare">'
            '<div class="box"><strong>生活场景</strong><p>标签、盒子、流程帮助我们快速定位信息。</p></div>'
            '<div class="box"><strong>程序世界</strong><p>名称、数据、执行结果帮助我们表达逻辑。</p></div>'
            "</div>"
        )
    if slide_type == "process":
        steps = "".join(f'<div class="step">{escape(str(item))}</div>' for item in slide.get("bullets", []))
        return f'<div class="steps">{steps}</div>'
    if slide_type == "code":
        return (
            '<div class="code-block">'
            '<div class="code-header">'
            '<span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>'
            "</div>"
            f'<pre class="code">{escape(code or "# 暂无代码示例")}</pre>'
            "</div>"
        )
    if slide_type == "mistake":
        return (
            '<div class="compare">'
            f'<div class="box"><strong>常见误区</strong><p>{escape(mistake or "只记写法，不解释原因。")}</p></div>'
            f'<div class="box"><strong>正确理解</strong><p>{escape(answer or "先理解对象、关系和结果。")}</p></div>'
            "</div>"
        )
    if slide_type == "quiz":
        return f'<div class="panel"><div class="label">小练习</div><div class="question">{escape(interaction)}</div><div class="answer">{escape(answer)}</div></div>'
    if slide_type == "summary":
        return f'<div class="panel"><div class="label">复习卡片</div><ul>{bullets}</ul></div>'
    return f'<ul>{bullets}</ul>'


def _fmt_clock(ms: int) -> str:
    sec = ms // 1000
    return f"{sec // 60:02d}:{sec % 60:02d}"
