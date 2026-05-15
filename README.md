<p align="center">
  <img src="frontend/public/sparklearn-logo-official.png" alt="SparkLearn Logo" width="80" />
</p>

<h1 align="center">学而思 SparkLearn</h1>

<p align="center">
  <strong>AI 驱动的个性化学习闭环平台</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Next.js_16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/AI-讯飞星火_&_Coze-blue" alt="AI" />
  <img src="https://img.shields.io/badge/TTS-讯飞语音合成-orange" alt="TTS" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## ✨ 项目简介

SparkLearn 是一个面向学生的 **AI 个性化学习平台**，通过学习画像、智能路径规划、多模态资源生成和实时辅导，构建完整的学习闭环。

> 🎯 核心理念：**画像驱动 → 路径规划 → 资源生成 → 练习评测 → 报告反馈 → 持续优化**

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ 画像 │ │ 路径 │ │ 资源 │ │ 练习 │ │ 报告 │ │ 辅导 │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
├─────────────────────────────────────────────────────────┤
│                    Backend (FastAPI)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ 讯飞星火 │ │ Coze Bot │ │ 讯飞 TTS │ │ 讯飞智文PPT│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 功能模块

| 模块 | 功能 | 状态 |
|------|------|------|
| 📊 **学习画像** | AI 分析学习偏好、薄弱点、阶段目标 | ✅ |
| 🗺️ **路径规划** | 智能生成个性化学习路径，支持动态调整 | ✅ |
| 📚 **资源中心** | 多类型资源生成（文档/PPT/视频/播客/题目/代码） | ✅ |
| 🎙️ **播客电台** | AI 生成播客风格科普文案 + 讯飞 TTS 语音合成 | ✅ |
| 📝 **练习评测** | 智能出题、自动判题、错题本、收藏 | ✅ |
| 📈 **学习报告** | 热力图 + AI 周报/日报/月报 | ✅ |
| 💬 **智能辅导** | 多角色 AI 对话、研讨会、知识库 RAG | ✅ |
| 🔊 **语音交互** | TTS 语音播报 + 语音输入识别 | ✅ |
| 🐾 **AI 精灵** | 学习伙伴宠物，搜索/摘要/对比能力 | ✅ |
| 🎬 **教学视频** | AI 脚本 + HTML 演示 + TTS 配音 | ✅ |
| 📋 **知识库** | 文件上传、分片索引、RAG 检索 | ✅ |

---

## 🎙️ 语音功能

本项目集成了 **讯飞在线语音合成（TTS）** 和 **浏览器 Web Speech API**：

- **语音播报**：AI 回复一键朗读，支持播放/暂停
- **语音输入**：麦克风按钮，实时中文语音识别转文字
- **播客电台**：资源中心生成播客风格科普内容，自动分段连播

覆盖页面：小星同学浮窗 · 学习空间 · AI 精灵 · 资源中心

---

## 🛠️ 技术栈

**前端**
- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS + styled-components
- Lucide Icons

**后端**
- Python 3.11 + FastAPI
- 讯飞星火大模型 (Spark Lite)
- Coze Bot 平台 (资源生成)
- 讯飞在线语音合成 (WebSocket TTS)
- 讯飞智文 (PPT 生成)
- SQLite (本地数据存储)
- Playwright (PDF 渲染 / 视频生成)

---

## 📦 快速开始

### 环境要求

- Node.js 18+
- Python 3.11+
- Chrome 浏览器（语音识别需要）

### 1. 克隆项目

```bash
git clone https://github.com/ATCBK/SparkLearn.git
cd SparkLearn
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件，填入以下配置：

```env
# 讯飞星火
SPARK_APP_ID=your_app_id
SPARK_API_SECRET=your_secret
SPARK_API_KEY=your_key

# Coze 资源生成
COZE_API_TOKEN=your_token
COZE_BOT_ID_RESOURCE_DEFAULT=your_bot_id

# 讯飞 TTS 语音合成
XF_TTS_APP_ID=your_tts_app_id
XF_TTS_API_KEY=your_tts_key
XF_TTS_API_SECRET=your_tts_secret
```

### 3. 启动后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000 开始使用。

---

## 📁 项目结构

```
SparkLearn/
├── frontend/                # Next.js 前端
│   ├── src/app/            # 页面路由
│   │   ├── (shell)/        # 主布局页面（画像/路径/资源/练习/报告）
│   │   ├── tutor/          # 学习空间（智能辅导）
│   │   └── onboarding/     # 新用户引导
│   ├── src/components/     # 组件库
│   │   ├── ui/             # 通用 UI（AudioRadio 播客播放器等）
│   │   ├── agent/          # AI 精灵组件
│   │   └── layout/         # 布局组件（AIAssistant 浮窗）
│   └── src/lib/api/        # API 层
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── routes/         # API 路由
│   │   ├── config.py       # 配置管理
│   │   ├── coze.py         # Coze 适配器
│   │   └── video_generator.py  # 视频生成
│   └── data/               # 本地数据存储
├── Dorc/                    # 项目文档
└── .env                     # 环境变量（不提交）
```

---

## 👥 团队

学而思 SparkLearn 开发团队

---

## 📄 License

MIT License
