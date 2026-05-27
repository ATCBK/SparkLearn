# Generated Visual Assets

## 1. 目录目的

本目录用于集中存放 SparkLearn 前端页面改造中由 AI 生成或后期整理的图片资源，包括页面背景、功能插画、AI 精灵形象、纹理素材和局部 UI 装饰图。

本目录中的图片可以被前端直接引用，引用路径以 `/assets/generated/` 开头。例如：

```tsx
<img src="/assets/generated/backgrounds/generate-sop-flow-bg-v1.png" alt="" />
```

本文档只约束图片资源的存放与命名，不约束具体页面 UI 实现。

---

## 2. 目录结构

```text
generated
├─ backgrounds
│  └─ 页面背景、模块背景、首屏氛围图
│
├─ illustrations
│  └─ 功能插画、空状态插画、流程说明图
│
├─ characters
│  └─ AI 精灵、导师角色、学习助手形象
│
├─ textures
│  └─ 轻量纹理、纸张质感、网格、噪声、光影素材
│
└─ ui
   └─ 小型 UI 装饰图、徽章、卡片局部视觉素材
```

---

## 3. 命名规则

图片文件统一使用小写英文、数字和连字符，不使用中文、空格、下划线或特殊符号。

命名格式：

```text
页面或模块-用途-主题-版本.扩展名
```

推荐示例：

```text
home-hero-learning-loop-v1.png
path-graph-knowledge-map-v1.webp
generate-sop-flow-bg-v1.png
resources-empty-library-v1.png
practice-wrongbook-remedial-v1.png
report-summary-insight-v1.png
assistant-sprite-default-v1.png
assistant-sprite-thinking-v1.png
```

命名字段说明：

```text
页面或模块
├─ home
├─ profile
├─ path
├─ generate
├─ resources
├─ practice
├─ report
└─ assistant

用途
├─ hero
├─ bg
├─ empty
├─ card
├─ preview
├─ sprite
├─ icon
└─ texture

主题
├─ learning-loop
├─ knowledge-map
├─ sop-flow
├─ resource-library
├─ wrongbook-remedial
├─ ai-tutor
└─ insight-summary

版本
└─ v1 / v2 / v3
```

---

## 4. 格式规则

优先使用以下格式：

```text
PNG
├─ 透明背景角色
├─ 插画
├─ 需要高保真边缘的 UI 图
└─ 需要保留细节的背景图

WEBP
├─ 大尺寸页面背景
├─ 首屏视觉图
├─ 可压缩的插画图
└─ 线上展示优先资源

JPG
└─ 仅用于照片类、无透明通道、无需精细边缘的图片
```

后续正式接入页面时，大尺寸图片优先压缩为 WebP，避免页面加载过慢。

---

## 5. 使用规则

前端页面引用图片时，统一使用 public 路径：

```text
/assets/generated/分类/文件名
```

示例：

```text
/assets/generated/backgrounds/generate-sop-flow-bg-v1.png
/assets/generated/characters/assistant-sprite-default-v1.png
```

页面代码中不要引用 `Dorc` 文档目录下的图片。文档目录只用于方案说明，前端实际使用的图片必须进入本目录。

---

## 6. 当前已收录资源

```text
generated
├─ backgrounds
│  ├─ auth-hero-brand-portal-v1.png
│  ├─ feed-hero-resource-recommendation-v1.png
│  ├─ generate-sop-flow-bg-v1.png
│  ├─ generate-workbench-sop-flow-v1.png
│  ├─ home-hero-learning-loop-v1.png
│  ├─ onboarding-hero-profile-setup-v1.png
│  ├─ path-hero-knowledge-map-v1.png
│  ├─ practice-hero-wrongbook-remedial-v1.png
│  ├─ profile-hero-learner-portrait-v1.png
│  ├─ report-hero-insight-summary-v1.png
│  ├─ resources-hero-library-v1.png
│  └─ video-hero-resource-preview-v1.png
│
├─ characters
│  ├─ assistant-sprite-default-chromakey-v1.png
│  └─ assistant-sprite-default-v1.png
│
└─ textures
   └─ common-subtle-learning-grid-v1.png
```

其中 `assistant-sprite-default-v1.png` 是已处理透明背景版本，适合后续用于全局 AI 精灵助手；`assistant-sprite-default-chromakey-v1.png` 为保留的绿幕源图。

`generate-sop-flow-bg-v1.png` 来源于资源生成 SOP 页面原型阶段生成的背景图，后续可作为 `/generate` 页面重构视觉素材或替换为新版资源工作台背景。
