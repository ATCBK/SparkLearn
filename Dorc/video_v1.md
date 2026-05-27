# SparkLearn 视频创作与语音播报 V1 实施总结

> 版本：v1.0 · 2026-05-07  
> 对应设计文档：`Dorc/video.md`  
> 当前状态：已完成前后端最小闭环接入；安装 FFmpeg 后可自动生成基础 MP4，真实讯飞 TTS 人声仍需按本文步骤补齐  
> 适用对象：后续继续开发、排查“语音播放不了 / 视频没生成”、迁移到其他项目时复用

---

## 1. 本次修改目标

本轮开发基于 `Dorc/video.md`，先落地一个可联调的视频创作最小闭环：

1. 前端资源生成页新增“讲解视频”资源类型。
2. 支持输入提示词后进行视频脚本润色。
3. 支持创建视频生成任务并通过 SSE 接收进度。
4. 后端生成视频资源元数据、脚本、时间轴、字幕、场景 HTML 与降级音频。
5. 视频播放页从真实 `/api/video/resources` 读取视频资源。
6. 前端提供场景预览、语音播放、字幕下载、视频包下载与分享入口。

注意：V1 不是完整商用视频生成版本。当前没有真正调用讯飞 TTS WebSocket；如果本机没有安装 FFmpeg，则只生成场景 HTML、降级 WAV、字幕和 manifest。安装 FFmpeg 后会自动生成 `output.mp4`。

---

## 2. 修改文件清单

### 2.1 后端

| 文件 | 作用 |
|------|------|
| `backend/app/config.py` | 新增讯飞 TTS 与视频创作相关配置项。 |
| `backend/app/main.py` | 注册新增 `video_router`。 |
| `backend/app/routes/video.py` | 新增视频创作 API：润色、创建任务、SSE 进度、资源查询、时间轴、场景预览、下载。 |
| `backend/app/video_generator.py` | 新增本地视频产物生成器：脚本、时间轴、字幕、场景 HTML、降级 WAV 音频、manifest。 |

### 2.2 前端

| 文件 | 作用 |
|------|------|
| `frontend/src/lib/api/types.ts` | 扩展 `Resource`、`VideoInfo`，新增视频脚本和生成事件类型。 |
| `frontend/src/lib/api/real.ts` | 新增视频 API adapter、GET SSE 读取、视频资源下载逻辑。 |
| `frontend/src/lib/api/index.ts` | 导出视频 API。 |
| `frontend/src/lib/utils/constants.ts` | 在资源类型中新增 `video`。 |
| `frontend/src/app/(shell)/generate/page.tsx` | 资源生成页新增“讲解视频”、润色按钮、视频生成进度、场景/音频/字幕预览。 |
| `frontend/src/app/(shell)/video/page.tsx` | 视频播放页改为展示真实视频资源、场景 iframe、音频控制条、下载与分享按钮。 |

---

## 3. 后端 API 契约

### 3.1 `POST /api/video/polish`

用途：将原始提示词转换为视频脚本结构。

请求：

```json
{
  "prompt": "用动画讲清 Python 变量",
  "course_id": "python_basic",
  "user_id": "single_user",
  "target_level": "beginner",
  "duration_sec": 90,
  "style": "清晰、生动、适合课堂讲解",
  "voice": "xiaoyan"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "polish_id": "polish_1234567",
    "title": "用动画讲清 Python...",
    "polished_prompt": "请生成一个约 90 秒的 1080p/30fps 学习讲解视频...",
    "script_outline": [
      {
        "segment_id": "seg_001",
        "title": "引入问题",
        "narration": "引入问题。围绕...",
        "visual_hint": "画面展示学习场景、问题气泡和关键词。",
        "duration_ms": 22000
      }
    ],
    "estimated_duration_sec": 90,
    "voice": "xiaoyan"
  },
  "error": null
}
```

### 3.2 `POST /api/video/jobs`

用途：创建视频生成任务。

请求：

```json
{
  "polish_id": "polish_1234567",
  "prompt": "润色后的结构化提示词",
  "title": "Python 变量讲解",
  "script_outline": [],
  "video_provider": "html_ppt",
  "voice": { "vcn": "xiaoyan" },
  "output": { "resolution": "1920x1080", "fps": 30, "format": "mp4" }
}
```

响应：

```json
{
  "success": true,
  "data": {
    "job_id": "job_xxxxxxxx",
    "resource_id": "video_xxxxxxxx",
    "status": "queued",
    "events_url": "/api/video/jobs/job_xxxxxxxx/events"
  }
}
```

### 3.3 `GET /api/video/jobs/{job_id}/events`

用途：通过 SSE 获取生成进度。

事件示例：

```text
data: {"type":"progress","payload":{"stage":"scripting","progress":18,"message":"正在整理分镜与讲稿"}}

data: {"type":"progress","payload":{"stage":"tts_synthesizing","progress":68,"message":"正在生成语音播报降级音轨"}}

data: {"type":"done","payload":{"resource_id":"video_xxxxxxxx","resource":{...}}}
```

### 3.4 资源接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/video/resources` | 查询视频资源列表。 |
| `GET` | `/api/video/resources/{id}` | 查询单个视频资源与 timeline。 |
| `GET` | `/api/video/resources/{id}/timeline` | 查询时间轴 JSON。 |
| `GET` | `/api/video/resources/{id}/scene` | 打开可预览场景 HTML。 |
| `GET` | `/api/video/resources/{id}/download/audio` | 下载降级 WAV 音频。 |
| `GET` | `/api/video/resources/{id}/download/srt` | 下载字幕。 |
| `GET` | `/api/video/resources/{id}/download/mp4` | 若 `output.mp4` 存在则下载 MP4，否则下载 `manifest.json` 作为降级包说明。 |
| `POST` | `/api/video/resources/{id}/share` | 创建分享链接。 |

---

## 4. 当前产物目录

生成任务完成后，后端会写入：

```text
backend/data/artifacts/video/{resource_id}/
├── scene.html
├── script.json
├── timeline.json
├── subtitle.srt
├── narration.wav
└── manifest.json
```

未安装 FFmpeg 时不会自动生成：

```text
output.mp4
```

原因：当前环境未安装 FFmpeg 或未接入商用视频生成 Provider。修复后，后端会自动检测 `ffmpeg`：检测到则生成 `output.mp4`，检测不到则返回明确的 `mux_status=ffmpeg_missing` 和 `mux_message`。

---

## 5. 为什么“语音播放不了 / 视频没生成出来”

### 5.1 语音播放不了的常见原因

1. 后端生成任务没有真正完成，`narration.wav` 未写入。
2. 前端拿到的 `audio_url` 是相对路径，但没有拼接 `API_BASE`。
3. 浏览器请求 `/api/video/resources/{id}/download/audio` 返回 404。
4. 后端服务没有重启，新增 `video_router` 没注册生效。
5. 当前 V1 只是本地降级 WAV，不是真实讯飞 TTS；如果你期待真实人声，需要继续接入讯飞 WebSocket TTS Provider。

排查命令：

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

然后访问：

```text
http://127.0.0.1:8000/api/video/resources
http://127.0.0.1:8000/api/video/resources/{resource_id}/download/audio
```

如果第二个地址不能下载 `.wav`，说明后端产物没生成或资源 ID 不对。

### 5.2 视频没生成出来的原因

当前 V1 的 MP4 合成依赖本机 FFmpeg。`/download/mp4` 的行为是：

1. 如果存在 `output.mp4`，返回 MP4。
2. 如果不存在 `output.mp4`，返回 `manifest.json`。

所以你看到“视频没生成出来”通常是因为本机没有 FFmpeg。要生成真正 MP4，需要接入下面任一方案：

1. 本地 FFmpeg 合成。
2. Remotion 渲染。
3. 商用视频生成 API。
4. 后端已有 HTML-PPT + Playwright 截帧，再由 FFmpeg 合成。

---

## 6. 本地完整跑通步骤

### 6.1 启动后端

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

检查：

```text
http://127.0.0.1:8000/health
```

### 6.2 启动前端

```bash
cd frontend
npm run dev
```

访问：

```text
http://localhost:3000/generate
```

### 6.3 页面操作

1. 选择“讲解视频”。
2. 输入：`用动画讲清 Python 变量`。
3. 点击“润色提示词”。
4. 点击“生成视频”。
5. 在右侧预览区查看场景 HTML。
6. 播放“语音播报”音频。
7. 到 `/video` 查看生成的视频资源列表。

---

## 7. 接入真实讯飞 TTS 的步骤

### 7.1 密钥配置

不要把 `APPID`、`APIKey`、`APISecret` 写死在 `config.py`。建议写入根目录 `.env`：

```env
XF_TTS_APP_ID=你的_APPID
XF_TTS_API_KEY=你的_APIKey
XF_TTS_API_SECRET=你的_APISecret
XF_TTS_BASE_URL=wss://tts-api.xfyun.cn/v2/tts
XF_TTS_DEFAULT_VOICE=xiaoyan
```

`config.py` 中只保留空默认值：

```python
xf_tts_app_id: str = ""
xf_tts_api_key: str = ""
xf_tts_api_secret: str = ""
```

### 7.2 Provider 实现位置

建议新增：

```text
backend/app/providers/xunfei_tts.py
```

职责：

1. 构建讯飞 TTS WebSocket 鉴权 URL。
2. 按文本分段发送合成请求。
3. 接收音频帧并写入 `audio_segments/seg_001.mp3`。
4. 合并为 `narration.mp3` 或交给 FFmpeg 合成。
5. 出错时返回可观测错误码。

### 7.3 替换点

当前降级音频生成在：

```text
backend/app/video_generator.py
```

函数：

```python
_write_narration_wav(root / "narration.wav", duration_ms)
```

真实接入后替换为：

```python
await xunfei_tts_provider.synthesize_segments(segments, root / "audio_segments")
await merge_audio_segments(...)
```

---

## 8. 接入 FFmpeg 生成 MP4 的步骤

### 8.1 安装 FFmpeg

Windows 可使用：

```bash
winget install Gyan.FFmpeg
```

安装后检查：

```bash
ffmpeg -version
```

### 8.2 合成策略

最小可行方案：

1. 用 `scene.html` 或分段 HTML 通过 Playwright 截图。
2. 每个 segment 生成一张 PNG。
3. 每张 PNG 按 segment 时长生成视频片段。
4. 拼接片段。
5. 加入 `narration.wav/mp3`。
6. 加入 `subtitle.srt`。
7. 输出 `output.mp4`。

命令思路：

```bash
ffmpeg -loop 1 -t 8 -i seg_001.png -r 30 -pix_fmt yuv420p seg_001.mp4
ffmpeg -f concat -safe 0 -i concat.txt -i narration.wav -vf subtitles=subtitle.srt -c:v libx264 -c:a aac output.mp4
```

### 8.3 后端替换点

在 `build_video_artifacts()` 末尾新增：

```python
if ffmpeg_available():
    render_scene_frames(...)
    mux_output_mp4(...)
    manifest["files"]["mp4"] = "output.mp4"
```

一旦生成 `output.mp4`，现有接口：

```text
GET /api/video/resources/{id}/download/mp4
```

会自动返回真正的 MP4。

---

## 9. 前端行为说明

### 9.1 `/generate`

新增能力：

1. 资源类型选择区增加“讲解视频”。
2. 视频模式下输入框 placeholder 变成视频创作提示。
3. 提供“润色提示词”按钮。
4. 展示润色后的标题、时长、分段数、声线。
5. 点击“生成视频”后订阅 SSE 进度。
6. 生成完成后展示：
   - `sceneUrl` iframe
   - `audioUrl` audio 控制条
   - 下载视频包
   - 下载音频
   - 下载字幕
   - 打开链接

### 9.2 `/video`

新增能力：

1. 优先读取 `/api/video/resources`。
2. 若新接口不可用，回退到旧 `/api/videos`。
3. 支持场景 iframe 预览。
4. 支持独立音频控制条。
5. 支持下载视频包、音频、字幕。
6. 支持复制分享链接。

---

## 10. 验证记录

已执行：

```bash
python -m compileall backend\app
```

结果：通过。

已执行接口烟测：

```text
POST /api/video/polish -> 200
POST /api/video/jobs -> 200
GET /api/video/jobs/{job_id}/events -> 返回 progress 和 done
GET /api/video/resources -> 返回生成资源列表
```

前端 TypeScript 检查：

```bash
cd frontend
npx tsc --noEmit --pretty false
```

结果：通过。

前端 lint：

```bash
cd frontend
npm run lint
```

结果：未完全通过。主要原因是仓库已有 `no-explicit-any` 与 React 19 `set-state-in-effect` 规则问题，并非全部来自视频改动。后续需要单独清理 lint 基线。

---

## 11. 复用 Checklist

迁移到其他项目时按顺序做：

1. 复制后端 `routes/video.py`。
2. 复制后端 `video_generator.py`。
3. 在后端入口注册 `video_router`。
4. 添加配置项：讯飞 TTS、视频 Provider、产物目录。
5. 添加前端类型：`Resource.type = video`、`VideoInfo`、`VideoPolishResult`。
6. 添加 API adapter：`polishVideoPrompt`、`generateVideoResource`、`getVideos`、`downloadVideoArtifact`。
7. 在资源生成页增加 `video` 类型入口。
8. 在播放页展示 `sceneUrl`、`audioUrl`、`subtitleUrl`。
9. 配置真实讯飞 TTS Provider。
10. 配置 FFmpeg 或商用视频 Provider。
11. 完成 E2E：输入 prompt -> 润色 -> 生成 -> 播放 -> 下载。

---

## 12. 下一步建议

优先级从高到低：

1. 把 `config.py` 中的讯飞密钥迁移到 `.env`，避免凭证进入 Git。
2. 实现 `backend/app/providers/xunfei_tts.py`，输出真实人声 MP3。
3. 安装 FFmpeg，并在 `video_generator.py` 中生成 `output.mp4`。
4. 将 `/generate` 中的视频预览升级为统一播放器组件。
5. 增加 Playwright E2E 用例覆盖完整视频创作流程。
6. 清理现有 lint 基线，让 `npm run lint` 重新成为可用质量门禁。
