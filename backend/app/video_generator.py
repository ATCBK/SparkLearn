import json
import math
import os
import re
import shutil
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
    style: str = "清晰、生动、适合课堂讲解",
) -> dict[str, Any]:
    clean_prompt = " ".join(prompt.strip().split()) or "Python 基础知识讲解"
    polish_id = _make_polish_id(clean_prompt, duration_sec, target_level, style)
    ai_error = ""
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
        }
    except Exception as ex:
        ai_error = str(ex)
        if settings.video_ai_enabled and not settings.video_ai_fallback_enabled:
            raise VideoAIScriptError(f"AI 视频脚本生成失败：{ai_error}") from ex

    title = _make_title(clean_prompt)
    templates = _lesson_templates(clean_prompt, target_level, style)
    if duration_sec < 60:
        selected_templates = [templates[0], templates[2], templates[3], templates[6], templates[-1]]
    elif duration_sec < 120:
        selected_templates = templates[:8] + [templates[-1]]
    else:
        selected_templates = templates

    segment_duration = max(7, int(duration_sec / len(selected_templates)))

    outline: list[dict[str, Any]] = []
    for idx, template in enumerate(selected_templates, start=1):
        narration = str(template["narration"])
        outline.append(
            {
                "segment_id": f"seg_{idx:03d}",
                "slide_type": template["slide_type"],
                "title": template["title"],
                "subtitle": template["subtitle"],
                "slide_text": template["slide_text"],
                "narration": narration,
                "visual_hint": template["visual_hint"],
                "teacher_note": template["teacher_note"],
                "interaction": template.get("interaction", ""),
                "code": template.get("code", ""),
                "mistake": template.get("mistake", ""),
                "answer": template.get("answer", ""),
                "duration_ms": segment_duration * 1000,
            }
        )

    return {
        "polish_id": polish_id,
        "title": title,
        "polished_prompt": (
            f"请生成一个约 {duration_sec} 秒的 1080p/30fps 学习讲解视频，主题为“{clean_prompt}”。"
            f"面向 {target_level} 学习者，风格为{style}。输出分镜、讲稿、字幕和时间轴。"
        ),
        "script_outline": outline,
        "estimated_duration_sec": duration_sec,
        "voice": settings.xf_tts_default_voice,
        "content_source": "local_fallback",
        "ai_provider": str(settings.video_ai_provider),
        "ai_model": str(settings.video_ai_model),
        "ai_error": ai_error,
    }


def _lesson_templates(topic: str, target_level: str, style: str) -> list[dict[str, Any]]:
    code_sample = _topic_code_sample(topic)
    return [
        {
            "slide_type": "cover",
            "title": _make_title(topic),
            "subtitle": f"一节面向 {target_level} 学习者的 AI 微课",
            "slide_text": ["先建立直觉", "再看关键规则", "最后用练习巩固"],
            "visual_hint": "封面使用大标题、课程路径和轻量图形背景。",
            "teacher_note": "开场要告诉学生这节课能解决什么具体困惑。",
            "interaction": "你现在听到这个主题时，最容易卡住的是哪一点？",
            "narration": (
                f"欢迎来到这节关于{topic}的微课。我们不会一上来堆定义，而是先从一个问题出发，"
                f"再用类比、图解和例子逐步拆开。学完后，你应该能说清它是什么、什么时候用，以及最容易错在哪里。"
            ),
        },
        {
            "slide_type": "goals",
            "title": "本节课你会学会什么",
            "subtitle": "把学习目标拆成三个可检查结果",
            "slide_text": [f"说清 {topic} 的核心含义", "看懂一个最小示例", "避开一个常见误区"],
            "visual_hint": "使用 checklist 和进度条表现学习目标。",
            "teacher_note": "目标要可验证，避免只写理解、掌握这类空泛词。",
            "interaction": "看完这三项目标，先选一个你最想解决的问题。",
            "narration": (
                f"这节课有三个目标。第一，你要能用自己的话解释{topic}。第二，你要能看懂一个最小示例，"
                "知道每一步发生了什么。第三，你要能识别一个常见错误，避免以后写代码或做题时反复踩坑。"
            ),
        },
        {
            "slide_type": "hook",
            "title": "先看一个真实问题",
            "subtitle": "为什么这个知识点值得学",
            "slide_text": ["如果只背定义，很快会忘", "如果知道它解决的问题，就容易迁移", "先问：它帮我们省掉了什么麻烦？"],
            "visual_hint": "画面左侧展示困惑表情，右侧展示问题气泡。",
            "teacher_note": "用问题驱动后续讲解，降低抽象感。",
            "interaction": f"你觉得{topic}主要是为了解决记忆问题、表达问题，还是复用问题？",
            "narration": (
                f"学习{topic}时，很多同学会直接背定义，但背完很难用。更好的方式是先问："
                "这个概念到底解决了什么麻烦？当我们知道它服务于哪个问题，后面的规则就不再是孤立的条文。"
            ),
        },
        {
            "slide_type": "concept",
            "title": "一句话讲清核心概念",
            "subtitle": "先抓主干，再补细节",
            "slide_text": [f"{topic} 是用来组织和表达程序含义的工具", "核心不是记名字，而是理解关系", "先分清“是什么”和“怎么用”"],
            "visual_hint": "中央概念卡片，周围三条关系箭头。",
            "teacher_note": "概念页只放最关键的定义，细节留给后续页。",
            "interaction": "请暂停 5 秒，用自己的话复述这一页的第一句话。",
            "narration": (
                f"我们先用一句话抓住{topic}：它是帮助我们组织和表达程序含义的工具。"
                "注意，这里的重点不是记住一个术语，而是看清它和数据、操作、结果之间的关系。"
            ),
        },
        {
            "slide_type": "analogy",
            "title": "用生活类比建立直觉",
            "subtitle": "把抽象概念变成可想象的画面",
            "slide_text": ["左边：生活中的标签、盒子、流程", "右边：程序里的名称、数据、执行", "类比只帮你入门，不能替代规则"],
            "visual_hint": "左右分栏：生活场景 vs 程序世界。",
            "teacher_note": "提醒学生类比有边界，避免类比误导。",
            "interaction": "你还能为这个主题想出另一个生活类比吗？",
            "narration": (
                f"可以把{topic}先类比成生活中的标签和盒子：标签让我们快速找到东西，盒子保存具体内容。"
                "在程序里，类似的结构帮助我们定位数据、组织操作。不过类比只是入口，真正写代码时还要回到语言规则。"
            ),
        },
        {
            "slide_type": "process",
            "title": "把使用过程拆成三步",
            "subtitle": "遇到题目时按步骤判断",
            "slide_text": ["第 1 步：找到对象", "第 2 步：确定关系", "第 3 步：观察结果"],
            "visual_hint": "三段式流程图，每一步有图标和箭头。",
            "teacher_note": "流程页用于建立解题路径。",
            "interaction": "下一次看到类似题目时，先别急着写答案，先按三步标注。",
            "narration": (
                f"使用{topic}时，可以拆成三步。第一步，找到正在处理的对象。第二步，确定对象之间的关系。"
                "第三步，观察执行后的结果。这个三步法能帮你把模糊的理解变成可操作的判断。"
            ),
        },
        {
            "slide_type": "code",
            "title": "看一个最小示例",
            "subtitle": "代码越短，越容易看清本质",
            "slide_text": ["先读代码，不急着运行", "关注每一行改变了什么", "把结果和概念对应起来"],
            "visual_hint": "代码编辑器样式，右侧显示运行结果。",
            "teacher_note": "代码示例只保留必要行，避免信息过载。",
            "interaction": "运行前先预测输出结果，再对照答案。",
            "code": code_sample,
            "narration": (
                "现在看一个最小示例。请先不要急着看答案，先逐行读代码：第一行创建或准备对象，"
                "第二行使用它，最后一行观察结果。短代码的价值在于让我们把概念和执行结果一一对应起来。"
            ),
        },
        {
            "slide_type": "mistake",
            "title": "常见误区：只看表面写法",
            "subtitle": "错误通常来自把概念和语法混在一起",
            "slide_text": ["误区：只记住写法", "后果：换个题目就不会", "修正：解释每一步为什么成立"],
            "visual_hint": "错误卡片与正确卡片对比。",
            "teacher_note": "这一页用于防止机械记忆。",
            "interaction": "请找出你过去是否也只记过写法，而没有解释原因。",
            "mistake": f"只背 {topic} 的固定写法，却说不清它解决的问题。",
            "answer": "先说明对象、关系和结果，再写具体语法。",
            "narration": (
                f"学习{topic}最常见的误区，是只记表面写法。这样做短期看起来快，但只要题目稍微变化，"
                "就很难迁移。更稳的方法是先解释对象、关系和结果，再把解释落到代码或题目步骤上。"
            ),
        },
        {
            "slide_type": "quiz",
            "title": "小练习：马上判断一次",
            "subtitle": "用一个问题检查是否真的理解",
            "slide_text": [f"请用一句话解释 {topic}", "写出一个最小例子", "指出一个可能的错误理解"],
            "visual_hint": "练习卡片，带倒计时和答案区域。",
            "teacher_note": "练习不追求难，追求立刻反馈。",
            "interaction": "暂停视频 20 秒，写下你的答案。",
            "answer": f"参考答案：{topic} 不是孤立写法，而是帮助我们表达对象、关系和结果的工具。",
            "narration": (
                "现在做一个小练习。请暂停视频二十秒，用一句话解释这个主题，再写一个最小例子，"
                "最后指出一个你认为容易误解的地方。能完成这三件事，说明你已经不只是听懂，而是开始会用了。"
            ),
        },
        {
            "slide_type": "summary",
            "title": "三句话带走",
            "subtitle": "把这节课压缩成可复习的结论",
            "slide_text": [f"{topic} 要先理解问题，再记规则", "用类比建立直觉，用代码验证结果", "遇到新题时按对象、关系、结果三步分析"],
            "visual_hint": "总结清单和下一步学习按钮。",
            "teacher_note": "总结页要形成可复述的闭环。",
            "interaction": "下一步：把今天的例子改一个条件，再预测结果。",
            "narration": (
                f"最后用三句话总结。第一，学习{topic}要先理解它解决的问题，再记规则。"
                "第二，用类比建立直觉，但要用代码或题目验证结果。第三，遇到新题时按对象、关系、结果三步分析。"
                f"如果你能做到这些，就已经从听懂{topic}走向会用了。"
            ),
        },
    ]


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
    generated_script: dict[str, Any] = {}
    if not isinstance(script_outline, list) or not script_outline:
        generated_script = make_polished_script(prompt)
        script_outline = generated_script.get("script_outline", [])
        title = str(generated_script.get("title") or title)
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
    (root / "slides.html").write_text(_slides_overview_html(title, slides), encoding="utf-8")
    (root / "scene.html").write_text(_slides_overview_html(title, slides), encoding="utf-8")

    slide_paths = _write_slide_html_files(root, title, slides)
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
        "note": "V4 以 AI 动态教学脚本生成 HTML-PPT，逐页生成讲解音频，安装 FFmpeg 后会自动合成 output.mp4。",
        "content_version": "v4",
        "content_source": content_source,
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


def _write_slide_html_files(root: Path, title: str, slides: list[dict[str, Any]]) -> list[Path]:
    slides_dir = root / "slides"
    slides_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    total = len(slides)
    for slide in slides:
        path = slides_dir / f"{slide['slide_id']}.html"
        path.write_text(_single_slide_html(title, slide, total), encoding="utf-8")
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
        payload = {
            "common": {"app_id": settings.xf_tts_app_id},
            "business": {
                "aue": "raw",
                "auf": "audio/L16;rate=16000",
                "vcn": settings.xf_tts_default_voice,
                "tte": "utf8",
                "speed": 50,
                "volume": 60,
                "pitch": 50,
            },
            "data": {
                "status": 2,
                "text": base64.b64encode(text.encode("utf-8")).decode("ascii"),
            },
        }
        pcm = bytearray()
        with connect(auth_url, open_timeout=max(5, settings.xf_tts_timeout_ms / 1000)) as ws:
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
        _write_pcm_as_wav(path, bytes(pcm), sample_rate=16000)
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
            "-loop",
            "1",
            "-i",
            str(frame),
            "-i",
            str(audio),
            "-t",
            f"{fallback_duration:.3f}",
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(part),
        ]
        result = _run_ffmpeg(cmd)
        if not result["ok"]:
            return result
        part_paths.append(part)

    concat_file = root / "concat.txt"
    concat_file.write_text("\n".join(f"file '{p.as_posix()}'" for p in part_paths), encoding="utf-8")
    output = root / "output.mp4"
    cmd = [
        ffmpeg,
        "-y",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-f",
        "concat",
        "-c",
        "copy",
        str(output),
    ]
    # The concat demuxer requires -f before -i. Keep the readable command above
    # corrected before execution.
    cmd = [
        ffmpeg,
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        str(output),
    ]
    result = _run_ffmpeg(cmd)
    if not result["ok"]:
        return result
    return {"ok": True, "status": "completed", "message": "已按 HTML-PPT 页面和逐页语音生成 output.mp4。"}


def _run_ffmpeg(cmd: list[str]) -> dict[str, Any]:
    try:
        completed = subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=False)
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


def _slides_overview_html(title: str, slides: list[dict[str, Any]]) -> str:
    sections = "".join(_slide_markup(slide, len(slides), overview=True) for slide in slides)
    return _html_shell(title, f"<div class=\"deck\">{sections}</div>", overview=True)


def _single_slide_html(deck_title: str, slide: dict[str, Any], total: int) -> str:
    return _html_shell(deck_title, _slide_markup(slide, total, overview=False), overview=False)


def _html_shell(title: str, body: str, overview: bool) -> str:
    wrapper_width = "min(1180px, calc(100vw - 48px))" if overview else "100vw"
    wrapper_margin = "32px auto" if overview else "0"
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; background: #eef3f8; color: #1d1d1f; }}
    .deck {{ width: {wrapper_width}; margin: {wrapper_margin}; display: grid; gap: 22px; }}
    .slide {{ position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: #fbfbfd; border: 1px solid rgba(0,0,0,.06); box-shadow: 0 22px 70px rgba(24,38,63,.14); }}
    .slide.single {{ width: 100vw; height: 100vh; aspect-ratio: auto; border: 0; box-shadow: none; }}
    .band {{ position: absolute; inset: 0; background: linear-gradient(135deg, #ffffff 0%, #e8f7ff 48%, #f7f3ff 100%); }}
    .accent {{ position: absolute; right: -180px; top: -160px; width: 520px; height: 520px; border-radius: 999px; background: rgba(0,113,227,.12); }}
    .content {{ position: relative; z-index: 1; height: 100%; padding: 70px 82px; display: grid; grid-template-columns: 1.05fr .95fr; gap: 42px; align-items: center; }}
    .content.full {{ grid-template-columns: 1fr; align-content: center; }}
    .eyebrow {{ color: #0071e3; font-size: 24px; font-weight: 700; margin-bottom: 20px; }}
    h1 {{ margin: 0; font-size: 70px; line-height: 1.05; letter-spacing: 0; }}
    .subtitle {{ margin-top: 24px; color: #424245; font-size: 32px; line-height: 1.45; }}
    ul {{ margin: 0; padding: 0; list-style: none; display: grid; gap: 22px; }}
    li {{ padding: 22px 24px; border-radius: 18px; background: rgba(255,255,255,.74); border: 1px solid rgba(0,0,0,.06); font-size: 27px; line-height: 1.45; color: #1d1d1f; }}
    .hint {{ margin-top: 26px; color: #6e6e73; font-size: 22px; line-height: 1.5; }}
    .panel {{ border-radius: 28px; padding: 28px; background: rgba(255,255,255,.72); border: 1px solid rgba(0,0,0,.07); box-shadow: 0 18px 48px rgba(24,38,63,.10); }}
    .label {{ color: #0071e3; font-size: 20px; font-weight: 800; margin-bottom: 14px; }}
    .code {{ margin: 0; white-space: pre-wrap; font-family: "Cascadia Code", Consolas, monospace; font-size: 28px; line-height: 1.55; color: #f5f5f7; background: #1d1d1f; border-radius: 22px; padding: 30px; }}
    .compare {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
    .box {{ min-height: 180px; border-radius: 22px; padding: 24px; background: rgba(255,255,255,.78); border: 1px solid rgba(0,0,0,.06); }}
    .box strong {{ display: block; font-size: 24px; margin-bottom: 14px; }}
    .box p {{ margin: 0; color: #424245; font-size: 28px; line-height: 1.45; }}
    .steps {{ counter-reset: step; display: grid; gap: 18px; }}
    .step {{ counter-increment: step; display: flex; align-items: center; gap: 18px; padding: 20px 22px; border-radius: 18px; background: rgba(255,255,255,.78); font-size: 28px; }}
    .step::before {{ content: counter(step); display: grid; place-items: center; width: 42px; height: 42px; border-radius: 999px; background: #0071e3; color: white; font-weight: 800; font-size: 20px; }}
    .question {{ font-size: 36px; line-height: 1.35; font-weight: 700; color: #1d1d1f; }}
    .answer {{ margin-top: 22px; color: #6e6e73; font-size: 24px; line-height: 1.5; }}
    .note {{ margin-top: 20px; padding: 18px 20px; border-radius: 16px; background: rgba(0,113,227,.08); color: #245; font-size: 21px; line-height: 1.5; }}
    .footer {{ position: absolute; left: 88px; right: 88px; bottom: 42px; display: flex; justify-content: space-between; color: #86868b; font-size: 18px; }}
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
    return f"""
    <section class="{cls}">
      <div class="band"></div>
      <div class="accent"></div>
      <div class="{content_class}">
        <div>
          <div class="eyebrow">SparkLearn · {int(slide.get('index') or 1):02d}/{total:02d}</div>
          <h1>{escape(str(slide.get('title') or ''))}</h1>
          <p class="subtitle">{escape(str(slide.get('subtitle') or ''))}</p>
          <p class="hint">{escape(str(slide.get('visual_hint') or ''))}</p>
          {_teacher_note_markup(slide)}
        </div>
        {visual}
      </div>
      <div class="footer">
        <span>{escape(str(slide.get('deck_title') or ''))}</span>
        <span>{escape(str(slide.get('segment_id') or ''))}</span>
      </div>
    </section>
    """


def _teacher_note_markup(slide: dict[str, Any]) -> str:
    note = str(slide.get("teacher_note") or "").strip()
    if not note:
        return ""
    return f'<div class="note">{escape(note)}</div>'


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
        return f'<pre class="code">{escape(code or "# 暂无代码示例")}</pre>'
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
