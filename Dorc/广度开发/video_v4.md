# SparkLearn 视频创作内容动态化 V4 文档

> 版本：v4.0 · 2026-05-09  
> 目标：在 V3 的 HTML-PPT 微课结构基础上，把“固定模板内容”升级为“AI 动态生成结构化脚本”。  
> 原则：视频渲染链路保持稳定，内容生成层接入可配置的大模型或智能体接口。

---

## 1. V4 核心变化

V3 已经把视频内容升级为微课结构：

```text
cover -> goals -> hook -> concept -> analogy -> process -> code -> mistake -> quiz -> summary
```

但 V3 的内容主要来自后端固定模板。V4 改为：

```text
用户 prompt
-> AI/智能体生成 script_outline JSON
-> 后端校验和标准化字段
-> HTML-PPT 渲染
-> TTS 逐页配音
-> timeline/subtitle/slides.json
-> FFmpeg 合成 MP4
```

也就是说，`slide_type` 仍然是页面结构协议，但每页标题、讲稿、代码、互动问题、误区和答案都由 AI 根据用户输入动态生成。

---

## 2. 本次修改文件

| 文件 | 作用 |
|------|------|
| `backend/app/config.py` | 新增视频 AI 配置项，API key、模型名、智能体地址都从这里读取环境变量。 |
| `backend/app/video_ai.py` | 新增 AI 脚本生成客户端，支持 OpenAI-compatible Chat Completions 和普通智能体 HTTP 接口。 |
| `backend/app/video_generator.py` | `make_polished_script()` 优先调用 AI 生成动态内容；音频生成后按真实 WAV 时长回写 timeline；MP4 合成写入 `faststart` 元数据，便于浏览器拖动进度条。 |
| `backend/app/routes/video.py` | 视频任务请求和资源返回增加 `content_source`、`ai_provider`、`ai_model` 字段；新增视频删除接口；MP4 下载响应显式支持 Range。 |
| `frontend/src/app/(shell)/video/page.tsx` | 视频播放页增加删除按钮；播放器预加载 metadata，支持浏览器识别时长与拖动。 |
| `frontend/src/lib/api/real.ts` | 新增 `deleteVideoResource()` 调用视频删除接口。 |
| `Dorc/video_v4.md` | 本文档。 |

---

## 3. API 配置位置

你需要把真实 API 配置写到项目根目录的 `.env` 文件中。

路径：

```text
D:\Office_File\other\SparkLearn\SparkLearn\.env
```

后端读取位置：

```text
backend/app/config.py
```

新增配置项如下：

```env
# 是否启用视频 AI 动态脚本
VIDEO_AI_ENABLED=true

# 方案一：OpenAI-compatible 大模型接口
VIDEO_AI_PROVIDER=openai_compatible
VIDEO_AI_BASE_URL=https://api.openai.com/v1
VIDEO_AI_CHAT_PATH=/chat/completions
VIDEO_AI_API_KEY=这里填写你的大模型 API Key
VIDEO_AI_MODEL=这里填写你的模型名

# 生成参数
VIDEO_AI_TIMEOUT_SEC=45
VIDEO_AI_MAX_TOKENS=4096
VIDEO_AI_TEMPERATURE=0.7

# AI 失败时是否允许本地兜底
VIDEO_AI_FALLBACK_ENABLED=true
```

如果你使用的是兼容 OpenAI Chat Completions 协议的平台，例如部分国产模型网关、聚合 API、私有模型服务，通常只需要改：

```env
VIDEO_AI_BASE_URL=你的平台 base url
VIDEO_AI_API_KEY=你的 key
VIDEO_AI_MODEL=你的模型名
```

---

## 4. 智能体接口配置

如果你不是直接调大模型，而是调自己的智能体平台，可以使用 `agent_http`。

`.env` 示例：

```env
VIDEO_AI_ENABLED=true
VIDEO_AI_PROVIDER=agent_http
VIDEO_AI_AGENT_URL=https://你的智能体服务地址
VIDEO_AI_AGENT_TOKEN=这里填写智能体 token
VIDEO_AI_TIMEOUT_SEC=45
VIDEO_AI_FALLBACK_ENABLED=true
```

后端会向 `VIDEO_AI_AGENT_URL` 发送：

```json
{
  "task": "generate_video_script_outline",
  "prompt": "用户输入的视频主题",
  "duration_sec": 90,
  "target_level": "beginner",
  "style": "清晰、生动、适合课堂讲解",
  "slide_types": ["cover", "goals", "hook", "concept", "analogy", "process", "code", "mistake", "summary"],
  "schema": {}
}
```

智能体需要返回 V4 结构化 JSON，至少包含：

```json
{
  "title": "视频标题",
  "polished_prompt": "增强后的生成提示词",
  "script_outline": [
    {
      "slide_type": "concept",
      "title": "页面标题",
      "subtitle": "页面副标题",
      "slide_text": ["PPT短要点1", "PPT短要点2"],
      "narration": "给 TTS 朗读的完整讲稿",
      "visual_hint": "画面布局提示",
      "teacher_note": "教师讲解提示",
      "interaction": "学习者互动问题",
      "code": "",
      "mistake": "",
      "answer": "",
      "duration_ms": 12000
    }
  ]
}
```

---

## 5. 动态内容协议

V4 仍然沿用 V3 的字段契约：

| 字段 | 说明 |
|------|------|
| `slide_type` | 页面类型，用于选择 HTML-PPT 布局。 |
| `title` | 页面主标题。 |
| `subtitle` | 页面副标题。 |
| `slide_text` | PPT 页面短文案，不应该太长。 |
| `narration` | TTS 朗读讲稿，应比 PPT 文案更完整。 |
| `visual_hint` | 画面表达建议。 |
| `teacher_note` | 教师提示，可用于审核或后续编辑。 |
| `interaction` | 学生互动问题。 |
| `code` | 代码、案例、公式或伪代码。 |
| `mistake` | 常见误区。 |
| `answer` | 参考答案。 |
| `duration_ms` | 单页预计时长。 |

页面数量仍按时长选择：

| 视频时长 | 页面结构 |
|----------|----------|
| `< 60s` | `cover`、`hook`、`concept`、`code`、`summary` |
| `60s - 119s` | `cover`、`goals`、`hook`、`concept`、`analogy`、`process`、`code`、`mistake`、`summary` |
| `>= 120s` | `cover`、`goals`、`hook`、`concept`、`analogy`、`process`、`code`、`mistake`、`quiz`、`summary` |

---

## 6. 失败兜底策略

默认配置：

```env
VIDEO_AI_FALLBACK_ENABLED=true
```

含义是：

```text
AI 可用 -> 使用 AI 动态内容
AI 未配置 / 网络失败 / 返回 JSON 不合格 -> 使用本地兜底模板，保证视频链路还能跑通
```

如果你希望开发阶段强制发现 AI 配置问题，可以改成：

```env
VIDEO_AI_FALLBACK_ENABLED=false
```

这样 AI 失败时接口会直接报错，不会静默使用兜底内容。

---

## 7. 产物变化

V4 生成目录仍沿用 V3：

```text
backend/data/artifacts/video/{resource_id}/
├── script.json
├── slides.json
├── slides.html
├── slides/slide_001.html
├── audio_segments/seg_001.wav
├── narration.wav
├── subtitle.srt
├── timeline.json
├── output.mp4
└── manifest.json
```

新增记录字段：

```json
{
  "content_version": "v4",
  "content_source": "ai",
  "ai_provider": "openai_compatible",
  "ai_model": "你配置的模型名"
}
```

如果 AI 不可用且开启兜底：

```json
{
  "content_source": "local_fallback"
}
```

---

## 8. 播放与删除能力

### 8.1 删除视频

前端视频播放页现在提供删除按钮。删除会调用：

```http
DELETE /api/video/resources/{resource_id}
```

后端会同步处理三类数据：

```text
1. 从 backend/data/users/{user_id}/video_resources.json 移除视频记录
2. 从 backend/data/users/{user_id}/video_jobs.json 移除对应任务记录
3. 删除 backend/data/artifacts/video/{resource_id}/ 产物目录
```

删除的产物包括：

```text
slides.html
slides.json
slides/
audio_segments/
narration.wav
subtitle.srt
timeline.json
output.mp4
manifest.json
```

### 8.2 进度条可拖动

进度条不能拖动的主要原因通常有两个：

```text
1. timeline 使用预计时长，但真实 TTS 音频更长或更短，导致浏览器识别到的 MP4 时长异常。
2. MP4 没有写入适合网页播放的 faststart 元数据，浏览器需要完整下载后才能可靠 seek。
```

V4 已调整：

```text
1. 先生成逐页 TTS 音频。
2. 读取每个 seg_XXX.wav 的真实时长。
3. 用真实音频时长回写 segments 的 start_ms / end_ms。
4. 再生成 timeline.json、subtitle.srt、slides.json。
5. FFmpeg 合成 MP4 时加入 -movflags +faststart。
6. MP4 下载接口返回 Accept-Ranges: bytes。
7. 前端 video 标签设置 preload="metadata"。
```

注意：旧视频已经生成好的 `output.mp4` 不会自动修复，需要重新生成视频。

---

## 9. 后续迭代建议

1. 前端增加“AI 生成大纲预览/编辑”步骤，让用户在生成 MP4 前修改每页内容。
2. 将 `teacher_note` 做成讲稿审核区，不一定展示在 PPT 画面里。
3. 给智能体增加资源上下文，例如课程章节、知识库片段、用户薄弱点。
4. 支持二次生成：只重写某一页，保留其他页面和时间轴。
5. 增加更丰富的 `slide_type`，例如 `diagram`、`case_study`、`comparison_table`、`formula`。
