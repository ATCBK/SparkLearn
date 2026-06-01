# SparkLearn 视频创作内容增强 V3 文档

> 版本：v3.0 · 2026-05-08  
> 目标：在 V2 的 HTML-PPT + 语音 + MP4 链路基础上，提高生成内容的教学密度、页面结构和复用能力  
> 修改原则：不破坏现有视频生成主链路，优先升级脚本结构与 HTML-PPT 模板

---

## 1. 修改前方案

V2 已经打通：

```text
prompt -> 脚本分段 -> HTML-PPT -> 逐页音频 -> FFmpeg 合成 MP4 -> 前端播放
```

但生成内容偏简洁，主要原因是：

1. 脚本只有固定 3-4 个段落。
2. 每页 PPT 只有标题、少量要点和一句视觉提示。
3. 讲稿和页面展示文字没有分层。
4. 页面模板单一，缺少封面、类比、代码、误区、练习、总结等教学场景。

V3 的核心改法：

1. 将脚本从“4 段讲解”升级为“8-10 页微课结构”。
2. 每页增加 `slide_type`，用于选择不同 HTML-PPT 布局。
3. 每页拆分 `slide_text` 与 `narration`：PPT 文字短，语音讲稿更丰富。
4. 增加教学字段：`teacher_note`、`interaction`、`code`、`mistake`、`answer`。
5. HTML 模板根据 `slide_type` 渲染不同画面。
6. 继续复用现有音频、时间轴、字幕、MP4 合成与前端播放逻辑。

---

## 2. 计划修改点

### 2.1 `make_polished_script()`

将原来的固定模板：

```text
引入问题
核心概念
代码演示
总结迁移
```

升级为微课模板：

```text
cover       封面和学习目标
goals       本节课你会学会什么
hook        问题引入
concept     核心概念
analogy     生活类比
process     步骤图解
code        代码/案例演示
mistake     常见误区
quiz        小练习
summary     总结迁移
```

### 2.2 `_build_timeline_segments()`

保留原有时间轴字段，同时透传新增教学字段：

```json
{
  "slide_type": "code",
  "slide_text": ["要点 1", "要点 2"],
  "narration": "给 TTS 朗读的完整讲稿",
  "teacher_note": "教师提示",
  "interaction": "给学生的问题",
  "code": "示例代码",
  "mistake": "常见错误",
  "answer": "参考答案"
}
```

### 2.3 `_build_ppt_slides()`

把 segment 转换为更完整的 slide 数据：

```json
{
  "slide_id": "slide_007",
  "slide_type": "code",
  "title": "用一段代码看懂变量",
  "subtitle": "先看运行结果，再回到赋值语句",
  "bullets": ["变量名保存引用", "等号表示赋值"],
  "code": "score = 95\nprint(score)",
  "narration": "完整讲稿..."
}
```

### 2.4 HTML-PPT 模板

按 `slide_type` 渲染不同布局：

| 类型 | 布局 |
|------|------|
| `cover` | 大标题 + 课程目标 |
| `goals` | 学习目标 checklist |
| `hook` | 问题卡片 |
| `concept` | 概念定义 + 关键词 |
| `analogy` | 左右对比类比 |
| `process` | 步骤流程 |
| `code` | 代码编辑器样式 |
| `mistake` | 错误写法 vs 正确理解 |
| `quiz` | 练习题 + 思考提示 |
| `summary` | 三点总结 + 下一步 |

---

## 3. 预期产物

V3 生成后仍沿用 V2 目录：

```text
backend/data/artifacts/video/{resource_id}/
├── slides.html
├── slides.json
├── slides/slide_001.html
├── audio_segments/seg_001.wav
├── subtitle.srt
├── timeline.json
├── output.mp4
└── manifest.json
```

但 `slides.json` 和 `timeline.json` 会包含更丰富的教学结构，`slides.html` 会更像一套完整微课 PPT。

---

## 4. 修改后补充区

### 4.1 实际修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/app/video_generator.py` | 升级脚本模板、时间轴字段、PPT slide 数据和 HTML 模板。 |

本次没有改前端页面。前端继续使用 V2 已接好的 `sceneUrl/audioUrl/videoUrl` 渲染逻辑。

### 4.2 新增字段

`script_outline` 每个分段新增：

| 字段 | 说明 |
|------|------|
| `slide_type` | PPT 页面类型，如 `cover`、`code`、`quiz`。 |
| `subtitle` | 页面副标题。 |
| `slide_text` | PPT 页面展示的短文本要点。 |
| `teacher_note` | 教师讲解提示，不直接作为主要标题。 |
| `interaction` | 给学习者的互动问题。 |
| `code` | 代码页使用的最小代码示例。 |
| `mistake` | 误区页展示的错误理解。 |
| `answer` | 练习或误区页的参考答案。 |

`slides.json` 会保留这些字段，后续可以用于：

1. 前端做可编辑 PPT。
2. 生成字幕和讲稿审核。
3. 后续接入更强的视频模板或 Remotion 渲染器。

### 4.3 生成模板

V3 根据视频时长选择页面数量：

| 时长 | 页面结构 |
|------|----------|
| `< 60s` | 5 页压缩版：封面、引入、概念、代码、总结。 |
| `60s - 119s` | 9 页标准版：覆盖大部分微课结构。 |
| `>= 120s` | 10 页完整版：封面、目标、引入、概念、类比、流程、代码、误区、练习、总结。 |

完整版页面：

```text
cover
goals
hook
concept
analogy
process
code
mistake
quiz
summary
```

### 4.4 HTML-PPT 模板增强

`_slide_markup()` 现在会按 `slide_type` 选择布局：

| 类型 | 视觉表现 |
|------|----------|
| `cover` | 大标题 + 课程路径要点。 |
| `goals` | checklist 面板。 |
| `hook` | 问题卡片。 |
| `concept` | 概念标题 + 要点列表。 |
| `analogy` | 生活场景 / 程序世界左右对比。 |
| `process` | 三步流程图。 |
| `code` | 深色代码编辑器样式。 |
| `mistake` | 常见误区 vs 正确理解。 |
| `quiz` | 小练习 + 参考答案。 |
| `summary` | 复习卡片。 |

### 4.5 验证结果

已执行：

```bash
python -m compileall backend\app\video_generator.py
cd frontend
npx tsc --noEmit --pretty false
```

结果：通过。

接口烟测结果：

```text
POST /api/video/polish -> 200
duration_sec=120 -> 生成 10 个 segment
slide_type -> cover,goals,hook,concept,analogy,process,code,mistake,quiz,summary
POST /api/video/jobs -> 200
GET /api/video/jobs/{job_id}/events -> done
slides.json -> 10 页
code slide -> 存在 code 字段
```

当前测试环境仍未安装 FFmpeg，因此：

```text
has_mp4 = false
mux_status = ffmpeg_missing
```

安装 FFmpeg 和 Playwright Chromium 后，V2/V3 同一链路会继续尝试生成 `output.mp4`。

### 4.6 可复用方法

如果要把 V3 内容增强迁移到其他项目，只需要复用三层：

1. **教学脚本层**：`_lesson_templates()`  
   把 prompt 转换为微课页结构。

2. **结构转换层**：`_build_timeline_segments()` + `_build_ppt_slides()`  
   把教学字段透传到 timeline 和 slides。

3. **模板渲染层**：`_html_shell()` + `_slide_markup()` + `_slide_visual_markup()`  
   根据 `slide_type` 渲染不同 HTML-PPT 页面。

复用时保持以下契约即可：

```json
{
  "slide_type": "code",
  "title": "看一个最小示例",
  "subtitle": "代码越短，越容易看清本质",
  "slide_text": ["先读代码", "关注每一行改变了什么"],
  "narration": "给 TTS 朗读的完整讲稿",
  "visual_hint": "代码编辑器样式",
  "code": "score = 95\nprint(score)"
}
```

---

## 5. 后续建议

1. 把 `_lesson_templates()` 替换为真实大模型 JSON 输出，保留同样字段契约。
2. 前端增加“编辑 PPT 大纲”面板，让用户在生成 MP4 前修改每页内容。
3. 给 `slide_type` 增加更多模板，如 `diagram`、`case_study`、`comparison_table`。
4. 为每页增加 `estimated_speech_sec`，按真实 TTS 时长反推页面停留时间。
5. 将 `teacher_note` 用于字幕或讲稿审核，不一定显示在 PPT 页面。
