import json
from pathlib import Path

import pytest

from app.config import settings
from app.routes import resources as resources_route


def _sse_done_resource(text: str) -> dict:
    for raw in text.splitlines():
        if not raw.startswith("data: "):
            continue
        event = json.loads(raw[6:])
        if event.get("type") == "done":
            return event["payload"]["resource"]
    raise AssertionError("missing done event")


def _valid_visual_payload() -> dict:
    return {
        "title": "函数调用栈 3D 动画",
        "teaching_goal": "用 3D 层叠方块理解函数调用与返回。",
        "concept_explanation": "每次调用会压入一层栈帧，返回时再弹出。",
        "files": [
            {
                "path": "index.html",
                "content": "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><title>函数调用栈</title></head><body><canvas id=\"scene\"></canvas><button id=\"fullscreenBtn\">全屏</button><button id=\"exitFullscreenBtn\">退出全屏</button><input id=\"timelineSlider\" type=\"range\" min=\"0\" max=\"10\" value=\"0\"><script type=\"module\" src=\"./src/main.js\"></script></body></html>",
            },
            {
                "path": "src/main.js",
                "content": "import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';\nconst scene = new THREE.Scene();\nconst camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);\ncamera.position.set(0, 2, 6);\nconst renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene') });\nrenderer.setSize(640, 360);\nconst cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x22c55e }));\nscene.add(cube);\nscene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2));\nconst timelineSlider = document.getElementById('timelineSlider');\ndocument.getElementById('fullscreenBtn').addEventListener('click', async () => document.documentElement.requestFullscreen());\ndocument.getElementById('exitFullscreenBtn').addEventListener('click', async () => document.exitFullscreen());\ndocument.addEventListener('fullscreenchange', () => timelineSlider.value = timelineSlider.value);\ntimelineSlider.addEventListener('input', () => { cube.position.x = Number(timelineSlider.value) / 5 - 1; });\nfunction animate(){ requestAnimationFrame(animate); cube.rotation.y += 0.02; renderer.render(scene, camera); }\nanimate();",
            },
        ],
        "interactions": ["暂停/播放动画", "重置栈帧"],
        "acceptance": ["canvas 非空", "动画 3 秒内开始变化"],
        "safety_notes": ["仅使用 Three.js 官方 CDN"],
    }


def test_threejs_payload_parser_accepts_first_json_when_model_appends_extra_json():
    raw = json.dumps(_valid_visual_payload(), ensure_ascii=False) + "\n{\"debug\": true}"

    data = resources_route._parse_threejs_code_visual_payload(raw)

    assert data["title"] == "函数调用栈 3D 动画"
    assert data["files"][0]["path"] == "index.html"


def test_threejs_payload_parser_rejects_placeholder_file_content():
    payload = _valid_visual_payload()
    payload["files"] = [
        {"path": "index.html", "content": "完整 HTML，包含 canvas 容器和模块脚本"},
        {"path": "src/main.js", "content": "完整 Three.js 代码"},
    ]

    with pytest.raises(ValueError, match="占位"):
        resources_route._parse_threejs_code_visual_payload(json.dumps(payload, ensure_ascii=False))


def test_threejs_payload_parser_requires_fullscreen_and_timeline_controls():
    payload = _valid_visual_payload()
    payload["files"][0]["content"] = payload["files"][0]["content"].replace(
        '<input id="timelineSlider" type="range" min="0" max="10" value="0">',
        "",
    )

    with pytest.raises(ValueError, match="timelineSlider"):
        resources_route._parse_threejs_code_visual_payload(json.dumps(payload, ensure_ascii=False))


def test_threejs_payload_parser_rejects_non_threejs_external_url():
    payload = _valid_visual_payload()
    payload["files"][1]["content"] += "\nconst bad = 'https://example.com/tracker.js';"

    with pytest.raises(ValueError, match="Three.js 官方 CDN"):
        resources_route._parse_threejs_code_visual_payload(json.dumps(payload, ensure_ascii=False))


def test_safe_threejs_template_uses_bfs_scene_for_bfs_topic():
    payload = resources_route._build_safe_threejs_template_payload("BFS 广度优先搜索 3D 教学可视化")
    html = next(item["content"] for item in payload["files"] if item["path"] == "index.html")
    main_js = next(item["content"] for item in payload["files"] if item["path"] == "src/main.js")

    assert "BFS" in payload["title"]
    assert "队列" in payload["concept_explanation"]
    assert "冒泡排序" not in payload["title"]
    assert "bubbleData" not in main_js
    assert "gridSize" in main_js
    assert "queue" in main_js
    assert "requestAnimationFrame" in main_js
    assert "fullscreenBtn" in html
    assert "exitFullscreenBtn" in html
    assert "timelineSlider" in html
    assert "requestFullscreen" in main_js
    assert "exitFullscreen" in main_js
    assert "fullscreenchange" in main_js
    assert "timelineSlider" in main_js


def test_safe_threejs_templates_include_required_controls_for_all_fallbacks():
    for topic in ["冒泡排序 3D 可视化", "Python 函数参数和返回值"]:
        payload = resources_route._build_safe_threejs_template_payload(topic)
        html = next(item["content"] for item in payload["files"] if item["path"] == "index.html")
        main_js = next(item["content"] for item in payload["files"] if item["path"] == "src/main.js")

        assert "fullscreenBtn" in html
        assert "exitFullscreenBtn" in html
        assert "timelineSlider" in html
        assert "requestFullscreen" in main_js
        assert "exitFullscreen" in main_js
        assert "fullscreenchange" in main_js
        assert "timelineSlider.addEventListener" in main_js



@pytest.mark.asyncio
async def test_visual3d_generation_saves_independent_threejs_resource(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    visual_payload = _valid_visual_payload()

    async def fake_stream_chat_events(prompt: str, mode: str, history: list, model: str = ""):
        assert "Three.js 教学动画资源" in prompt
        assert "函数调用栈" in prompt
        assert model == "ds-pro"
        yield ("text", {"content": json.dumps(visual_payload, ensure_ascii=False)})

    monkeypatch.setattr(resources_route.spark_lite, "stream_chat_events", fake_stream_chat_events)

    resp = await client.post(
        "/api/resources/generate",
        json={
            "type": "visual3d",
            "prompt": "请用 3D 动画解释 Python 函数调用栈",
            "code_level": "beginner",
        },
    )

    assert resp.status_code == 200
    resource = _sse_done_resource(resp.text)
    assert resource["type"] == "visual3d"
    assert resource["status"] == "completed"
    assert resource["source_url"] == f"sparklearn-artifact://visual3d/{resource['id']}/index.html"
    assert resource["artifact_kind"] == "threejs"

    artifact_root = settings.data_dir / "artifacts" / "visual3d" / resource["id"]
    assert (artifact_root / "index.html").read_text(encoding="utf-8").startswith("<!doctype html>")
    assert "THREE" in (artifact_root / "src" / "main.js").read_text(encoding="utf-8")
    manifest = json.loads((artifact_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["title"] == "函数调用栈 3D 动画"
    assert manifest["resource_type"] == "visual3d"
    assert manifest["files"] == ["index.html", "src/main.js"]
    assert manifest["generation_mode"] == "ai"
    assert manifest["provider"] == "deepseek"
    assert manifest["model"] == "ds-pro"

    preview = await client.get(f"/api/resources/{resource['id']}/preview/html")
    assert preview.status_code == 200
    assert "函数调用栈" in preview.text
    assert "./src/main.js" in preview.text
    csp = preview.headers.get("content-security-policy", "")
    assert "frame-ancestors 'self' http://127.0.0.1:3000 http://localhost:3000" in csp
    assert "base-uri 'self'" in csp


@pytest.mark.asyncio
async def test_visual3d_generation_uses_runnable_template_when_model_returns_placeholders(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    placeholder_payload = _valid_visual_payload()
    placeholder_payload["files"] = [
        {"path": "index.html", "content": "完整 HTML，包含 canvas 容器和模块脚本"},
        {"path": "src/main.js", "content": "完整 Three.js 代码"},
    ]

    async def fake_stream_chat_events(prompt: str, mode: str, history: list, model: str = ""):
        yield ("text", {"content": json.dumps(placeholder_payload, ensure_ascii=False)})

    monkeypatch.setattr(resources_route.spark_lite, "stream_chat_events", fake_stream_chat_events)

    resp = await client.post(
        "/api/resources/generate",
        json={
            "type": "visual3d",
            "prompt": "生成一个冒泡排序的 3D 教学动画资源",
            "code_level": "beginner",
        },
    )

    assert resp.status_code == 200
    resource = _sse_done_resource(resp.text)
    assert resource["type"] == "visual3d"
    assert resource["source_url"] == f"sparklearn-artifact://visual3d/{resource['id']}/index.html"
    assert resource["artifact_kind"] == "threejs"
    assert "安全模板兜底" in resource["content"]
    assert resource["generation_mode"] == "fallback_template"
    assert resource["provider"] == "deepseek"
    assert resource["fallback_reason"]

    artifact_root = settings.data_dir / "artifacts" / "visual3d" / resource["id"]
    assert "<canvas" in (artifact_root / "index.html").read_text(encoding="utf-8")
    main_js = (artifact_root / "src" / "main.js").read_text(encoding="utf-8")
    assert "bubbleData" in main_js
    assert "requestAnimationFrame" in main_js
    manifest = json.loads((artifact_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["generation_mode"] == "fallback_template"
    assert manifest["fallback_reason"]


@pytest.mark.asyncio
async def test_code_visual_generation_saves_threejs_artifact_and_previews_html(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    visual_payload = _valid_visual_payload()

    async def fake_stream_chat_events(prompt: str, mode: str, history: list, model: str = ""):
        assert "Three.js 教学动画资源" in prompt
        assert "函数调用栈" in prompt
        assert model == "ds-pro"
        yield ("text", {"content": json.dumps(visual_payload, ensure_ascii=False)})

    monkeypatch.setattr(resources_route.spark_lite, "stream_chat_events", fake_stream_chat_events)

    resp = await client.post(
        "/api/resources/generate",
        json={
            "type": "code",
            "prompt": "请用 3D 动画解释 Python 函数调用栈",
            "visual_mode": "threejs",
            "code_level": "beginner",
        },
    )

    assert resp.status_code == 200
    resource = _sse_done_resource(resp.text)
    assert resource["type"] == "code"
    assert resource["status"] == "completed"
    assert resource["source_url"] == f"sparklearn-artifact://code/{resource['id']}/index.html"
    assert resource["artifact_kind"] == "threejs"

    artifact_root = settings.data_dir / "artifacts" / "code" / resource["id"]
    assert (artifact_root / "index.html").read_text(encoding="utf-8").startswith("<!doctype html>")
    assert "THREE" in (artifact_root / "src" / "main.js").read_text(encoding="utf-8")
    manifest = json.loads((artifact_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["title"] == "函数调用栈 3D 动画"
    assert manifest["files"] == ["index.html", "src/main.js"]

    preview = await client.get(f"/api/resources/{resource['id']}/preview/html")
    assert preview.status_code == 200
    assert "函数调用栈" in preview.text
    assert "./src/main.js" in preview.text


@pytest.mark.asyncio
async def test_code_visual_generation_falls_back_to_markdown_when_payload_is_invalid(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_dev_bypass", True)

    async def fake_stream_chat_events(prompt: str, mode: str, history: list, model: str = ""):
        yield ("text", {"content": "{\"title\":\"坏数据\",\"files\":[]}"})

    monkeypatch.setattr(resources_route.spark_lite, "stream_chat_events", fake_stream_chat_events)

    resp = await client.post(
        "/api/resources/generate",
        json={
            "type": "code",
            "prompt": "请用 3D 动画解释循环",
            "visual_mode": "threejs",
        },
    )

    assert resp.status_code == 200
    resource = _sse_done_resource(resp.text)
    assert resource["type"] == "code"
    assert resource["status"] == "completed"
    assert resource["source_url"] is None
    assert "可视化资源生成失败" in resource["content"]
    assert not (settings.data_dir / "artifacts" / "code" / resource["id"]).exists()
