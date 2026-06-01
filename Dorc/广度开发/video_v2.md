# SparkLearn 视频创作与语音播报 V2 实施文档

> 版本：v2.0 · 2026-05-07  
> 目标：根据用户提示词生成 HTML-PPT，按页生成讲解音频，再合成为 MP4 并渲染到前端  
> 当前实现：代码已完成 HTML-PPT 分页、逐页音频、SSE 任务、前端预览与下载；MP4 产出依赖 FFmpeg；真实人声优先走讯飞 TTS，未配置时降级

---

## 1. V2 目标

用户的目标链路是：

```text
用户提示词
 -> 结构化视频脚本
 -> HTML-PPT 分页渲染
 -> 每页讲稿生成语音
 -> 按 PPT 页面和语音时长合成 MP4
 -> 前端视频页播放
```

V2 已将后端生成器从“单个 scene.html + 降级音轨”升级为“HTML-PPT 分页 + 逐页音频 + 可合成 MP4”的结构。

---

## 2. 本轮新增/修改文件

| 文件 | 说明 |
|------|------|
| `backend/app/video_generator.py` | 核心生成器。生成 PPT 页、讲稿、字幕、逐页音频、截图、MP4。 |
| `backend/app/routes/video.py` | 视频任务 API，SSE 进度，资源查询与下载。 |
| `backend/app/storage.py` | `read_json` 改为 `utf-8-sig`，兼容 PowerShell 写入 BOM 的 JSON。 |
| `backend/app/config.py` | 视频与讯飞 TTS 配置项。 |
| `backend/app/main.py` | 注册 `video_router`。 |
| `frontend/src/app/(shell)/generate/page.tsx` | 资源生成页增加“讲解视频”、润色、生成、预览、音频和字幕下载。 |
| `frontend/src/app/(shell)/video/page.tsx` | 视频播放页显示 MP4 或 HTML-PPT 场景、音频控制条、下载和分享。 |
| `frontend/src/lib/api/*` | 增加视频 API 类型和 adapter。 |

---

## 3. 后端生成产物

每次任务生成目录：

```text
backend/data/artifacts/video/{resource_id}/
├── slides.html                  # 多页 HTML-PPT 总览
├── scene.html                   # 前端预览入口，当前等同 slides.html
├── slides.json                  # PPT 页面结构
├── slides/
│   ├── slide_001.html           # 单页 PPT
│   ├── slide_002.html
│   └── ...
├── audio_segments/
│   ├── seg_001.wav              # 第 1 页讲解音频
│   ├── seg_002.wav
│   └── ...
├── frames/
│   ├── slide_001.png            # Playwright 截图，安装 FFmpeg 后才需要
│   └── ...
├── video_parts/
│   ├── part_001.mp4             # 单页视频片段
│   └── ...
├── narration.wav                # 合并后的音频
├── subtitle.srt                 # 字幕
├── timeline.json                # 时间轴
├── script.json                  # 生成脚本
├── manifest.json                # 生成清单
└── output.mp4                   # 最终 MP4，安装 FFmpeg 后生成
```

---

## 4. 生成逻辑

### 4.1 HTML-PPT

`make_polished_script()` 根据用户 prompt 生成分段讲稿：

1. 引入问题
2. 核心概念
3. 代码演示
4. 总结迁移

`_build_ppt_slides()` 将每个 segment 转换为一页 PPT：

```json
{
  "slide_id": "slide_001",
  "title": "引入问题",
  "subtitle": "变量可以理解为数据的名字...",
  "bullets": ["要点 1", "要点 2"],
  "visual_hint": "画面展示学习场景、问题气泡和关键词。",
  "narration": "本页讲稿..."
}
```

`_write_slide_html_files()` 为每页写入独立 HTML，便于 Playwright 截图。

### 4.2 语音生成

语音优先级：

1. 讯飞 TTS WebSocket：需要 `.env` 配置 `XF_TTS_APP_ID`、`XF_TTS_API_KEY`、`XF_TTS_API_SECRET`。
2. Windows SAPI：Windows 本地系统语音。
3. tone fallback：生成可播放提示音轨，保证前端 audio 控件一定有资源。

当前测试环境结果：

```text
tts_provider = tone_fallback
audio_status = fallback
```

原因：测试环境未配置讯飞 TTS，且 Windows SAPI 被系统权限/组件限制拦截。

### 4.3 MP4 合成

合成需要两个依赖：

1. FFmpeg：编码 MP4。
2. Playwright Chromium：把 HTML-PPT 单页截图为 PNG。

合成流程：

```text
slide_001.html -> slide_001.png
seg_001.wav + slide_001.png -> part_001.mp4

slide_002.html -> slide_002.png
seg_002.wav + slide_002.png -> part_002.mp4

part_001.mp4 + part_002.mp4 + ... -> output.mp4
```

当前测试环境结果：

```text
has_mp4 = false
frame_status = skipped
mux_status = ffmpeg_missing
```

原因：本机未安装 FFmpeg，所以后端跳过截图和 MP4 合成，只生成 HTML-PPT、音频、字幕和 manifest。

---

## 5. API 说明

### 5.1 生成脚本

```http
POST /api/video/polish
```

请求：

```json
{
  "prompt": "用HTML PPT讲清 Python 变量",
  "duration_sec": 90
}
```

### 5.2 创建任务

```http
POST /api/video/jobs
```

返回：

```json
{
  "job_id": "job_xxxxxxxx",
  "resource_id": "video_xxxxxxxx",
  "events_url": "/api/video/jobs/job_xxxxxxxx/events"
}
```

### 5.3 SSE 进度

```http
GET /api/video/jobs/{job_id}/events
```

阶段：

```text
scripting
video_rendering
tts_synthesizing
muxing
completed
```

### 5.4 视频资源

| 接口 | 用途 |
|------|------|
| `GET /api/video/resources` | 视频列表 |
| `GET /api/video/resources/{id}` | 视频详情 |
| `GET /api/video/resources/{id}/scene` | HTML-PPT 预览 |
| `GET /api/video/resources/{id}/download/audio` | 下载合并音频 |
| `GET /api/video/resources/{id}/download/srt` | 下载字幕 |
| `GET /api/video/resources/{id}/download/mp4` | 有 MP4 返回 MP4；没有 MP4 返回 manifest |

---

## 6. 前端行为

### 6.1 `/generate`

1. 选择“讲解视频”。
2. 输入 prompt。
3. 点击“润色提示词”。
4. 点击“生成视频”。
5. 右侧展示：
   - 有 MP4：`<video>` 播放。
   - 无 MP4：`iframe` 展示 HTML-PPT。
   - 有音频：`<audio>` 播放讲解音频。
6. 下载：
   - 有 MP4：按钮显示“下载MP4”。
   - 无 MP4：按钮显示“下载生成清单”。
   - 音频和字幕可单独下载。

### 6.2 `/video`

1. 优先读取 `/api/video/resources`。
2. `has_mp4=true` 时播放 MP4。
3. `has_mp4=false` 时显示 HTML-PPT 场景预览。
4. 音频控制条独立展示。
5. 显示 `mux_message`，告诉用户缺少 FFmpeg 或其他依赖。

---

## 7. 如何让它真正生成 MP4

### 7.1 安装 FFmpeg

Windows 推荐：

```bash
winget install Gyan.FFmpeg
```

检查：

```bash
ffmpeg -version
```

如果命令不可用，把 FFmpeg 的 `bin` 目录加入系统 PATH，然后重启终端和后端服务。

### 7.2 安装 Playwright Chromium

```bash
cd backend
python -m playwright install chromium
```

### 7.3 重启后端

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### 7.4 重新生成视频

旧资源不会自动补 MP4。必须重新在 `/generate` 生成一次。

成功后资源详情应出现：

```json
{
  "has_mp4": true,
  "frame_status": "completed",
  "mux_status": "completed"
}
```

---

## 8. 如何接入讯飞真实语音

### 8.1 配置 `.env`

根目录 `.env` 增加：

```env
XF_TTS_APP_ID=你的APPID
XF_TTS_API_KEY=你的APIKey
XF_TTS_API_SECRET=你的APISecret
XF_TTS_BASE_URL=wss://tts-api.xfyun.cn/v2/tts
XF_TTS_DEFAULT_VOICE=xiaoyan
```

### 8.2 重启后端

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### 8.3 重新生成视频

生成后资源详情应出现：

```json
{
  "tts_provider": "xunfei_tts",
  "audio_status": "completed"
}
```

如果讯飞调用失败，系统会自动降级到 Windows SAPI 或 tone fallback，并在 `audio_message` 中返回原因。

---

## 9. 本轮验证结果

已执行：

```bash
python -m compileall backend\app
cd frontend
npx tsc --noEmit --pretty false
```

结果：通过。

接口烟测：

```text
POST /api/video/polish -> 200
POST /api/video/jobs -> 200
GET /api/video/jobs/{job_id}/events -> done
GET /api/video/resources/{id}/scene -> 200 text/html
GET /api/video/resources/{id}/download/audio -> 200 audio/wav
GET /api/video/resources/{id}/download/mp4 -> 当前返回 manifest.json
```

当前环境缺失：

```text
FFmpeg: 未安装
讯飞 TTS: 未配置
Windows SAPI: 当前环境不可用
```

因此当前能看到 HTML-PPT，能播放降级音频，但不会生成真实 MP4 和真实人声。

---

## 10. 故障排查

### 10.1 前端看不到视频资源

检查：

```text
http://127.0.0.1:8000/api/video/resources
```

如果为空，说明还没生成新视频，去 `/generate` 选择“讲解视频”重新生成。

### 10.2 音频不能播放

检查：

```text
http://127.0.0.1:8000/api/video/resources/{resource_id}/download/audio
```

应返回：

```text
Content-Type: audio/wav
```

如果 404，说明产物目录缺少 `narration.wav`，需要重新生成。

### 10.3 MP4 还是没有

检查资源详情：

```text
GET /api/video/resources/{resource_id}
```

看这三个字段：

```json
{
  "has_mp4": false,
  "frame_status": "skipped",
  "mux_status": "ffmpeg_missing"
}
```

解决：

1. 安装 FFmpeg。
2. 安装 Playwright Chromium。
3. 重启后端。
4. 重新生成视频。

---

## 11. 下一步开发建议

1. 把讯飞 TTS 配置写入 `.env`，生成真实人声。
2. 安装 FFmpeg 与 Playwright Chromium，生成真实 MP4。
3. 将 HTML-PPT 视觉模板继续美化为课堂风格。
4. 给 `/video` 页增加字幕时间轴面板。
5. 增加 E2E 测试：prompt -> PPT -> audio -> MP4 -> 前端播放。

