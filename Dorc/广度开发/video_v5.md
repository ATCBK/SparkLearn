# video_v5 — 视频模块多风格、纯 AI 生成改造

## 改动概览

本次改动围绕「移除模板兜底 → 强制 AI 生成」「丰富风格配置 → 多套视觉风格」「提升用户体验」「动态超时适配」「现代化 PPT 渲染」五条主线，涉及后端 3 个文件、前端 2 个文件。

---

## 一、后端改动

### 1. `backend/app/config.py` — 配置层

**关闭模板兜底**
```
video_ai_fallback_enabled: bool = False   # 原为 True
```
AI 调用失败时后端不再降级到硬编码模板，而是抛出异常由前端展示错误卡片。

**新增 6 套视频风格预设** (`video_styles: dict`)

| style_id | 名称 | 视觉特点 | 适用场景 |
|---|---|---|---|
| `apple-minimal` | 苹果极简风 | 白底 + 蓝色点缀 | 系统化技术教学 |
| `dark-tech` | 暗色科技风 | 深色 + 霓虹青绿 | 进阶编程内容 |
| `warm-education` | 温暖教育风 | 柔和暖色 + 圆润卡片 | 入门教学、少儿编程 |
| `business-pro` | 商务专业风 | 深蓝基调 + 金色点缀 | 企业培训、报告 |
| `cartoon-playful` | 趣味卡通风 | 多彩渐变 + 大圆角 | 少儿编程、零基础 |
| `academic` | 学术典雅风 | 米色底色 + 衬线字体 | 大学课程、深度专题 |

每套风格包含 10 个字段：`id`, `name`, `description`, `accent_color`, `bg_gradient`, `font_family`, `code_bg`, `code_color`, `card_bg`, `tone`。所有字段在 HTML 幻灯片渲染时通过 CSS 自定义属性动态注入。

**配置安全化**
所有密钥（Spark/TTS API Key/Secret）从代码中移除，统一由 `.env` 文件管理。

### 2. `backend/app/video_ai.py` — AI 脚本生成

**动态超时与 Token 预算**

视频时长越长，脚本越复杂。超时和 max_tokens 现在根据 `duration_sec` 动态计算：

```python
dynamic_timeout = max(settings.video_ai_timeout_sec, int(duration_sec * 1.2))
dynamic_max_tokens = max(settings.video_ai_max_tokens, int(settings.video_ai_max_tokens * (duration_sec / 60)))
```

- 45 秒基础配置下，90 秒视频 → 108 秒超时，180 秒视频 → 216 秒超时
- Token 预算同步放大，避免长视频脚本被截断

**风格内容指引** (`_style_content_guidance()`)

每种风格 5 维度指引（措辞、隐喻、视觉、代码、引入），嵌入 AI system prompt，确保不同风格产出的脚本内容有本质差异。

**错误处理**
所有错误均抛出 `VideoAIScriptError`，中文消息，可直接被 SSE 流捕获并展示给前端。

### 3. `backend/app/video_generator.py` — 视频产物管线

**移除模板兜底**
约 250 行 `_lesson_templates()` 函数完全删除。`make_polished_script()` 失败时直接抛出 `VideoAIScriptError`。

**现代化 HTML 幻灯片渲染** (`_html_shell()`)

前端呈现的 PPT 预览页面全新设计，融合 2024-2025 主流设计语言：

| 设计元素 | 具体实现 |
|---|---|
| 玻璃态卡片 | `backdrop-filter: blur(12px)` + 半透明背景 |
| 网格纹理 | CSS `background-image` 网格点阵 + 径向渐变遮罩 |
| 装饰光斑 | `accent-blob` 大尺寸模糊圆形，点缀页面角落 |
| 代码块 | macOS 风格三色圆点标题栏 + JetBrains Mono 等宽字体 |
| 进度指示器 | 底部圆点进度条，当前页高亮 |
| 悬停微交互 | `translateY` / `translateX` + `box-shadow` 过渡 |
| 标签装饰 | 标题前 accent 色短线 + 字母间距 |
| CSS 自定义属性 | `:root {}` 统一管理颜色/圆角/阴影 |

**幻灯片类型标签** (`_slide_type_label()`)
每页左上角显示中文类型标签（封面/学习目标/核心概念/代码演示/避坑指南 等），替代原来的 `SparkLearn` 固定文案。

---

## 二、前端改动

### 1. `frontend/src/app/(shell)/generate/page.tsx` — 视频生成 UX

**视频专属 UI**（仅 `selectedType === 'video'` 时显示）

1. **风格选择器** — 2×3 风格卡片网格，每张含渐变预览、主色圆点、名称、描述，选中态蓝色边框 + 勾选图标
2. **难度选择器** — 三选一按钮组（入门/进阶/精通）
3. **时长滑块** — range input 15s–180s，实时显示格式化时间 + 刻度标记
4. **润色结果卡片** —「AI 已润色」徽章、预计时长、分镜数、风格名称，可折叠分镜详情（类型标签/标题/副标题/旁白预览/时长）
5. **SSE 进度消息列表** — 实时展示风格名称 + 进度阶段
6. **双错误卡片** — 润色失败（红色边框 + AlertCircle）和生成失败（SSE error message）

### 2. `frontend/src/app/(shell)/video/page.tsx` — 视频播放页

**移除冗余语音播报条**
视频播放器下方的 `<audio>` 原生控件已移除。音频下载功能保留在工具栏"音频"按钮中。

---

## 三、架构要点

1. **纯 AI 管线**：模板兜底已完全移除。AI 失败时后端返回 SSE error，前端以内联错误卡片展示。
2. **风格系统**：后端 6 套风格 → `_html_shell()` 动态 CSS 注入 → 前端风格选择器。新增风格只需在 `config.py` 的 `video_styles` 中加一条。
3. **内容多样性**：`_style_content_guidance()` 的 5 维度指引 + 8 条质量规则，确保不同风格产出明显不同的脚本。
4. **动态超时**：超时和 token 预算随视频时长线性缩放，长视频不再超时。
5. **现代化 PPT 渲染**：玻璃态 + 网格纹理 + 微交互，视觉品质对标 Notion/Linear 级别产品。
6. **配置安全**：所有密钥通过 `.env` 管理，代码中不留硬编码凭证。
