<p align="center">
  <img src="frontend/public/sparklearn-logo-official.png" alt="SparkLearn" width="96" />
</p>

<h1 align="center">SparkLearn · 个性化学习多智能体平台</h1>

<p align="center">
  <em>学生学习闭环 + 社区协同学习 + 教师教学运营的一体化 AI 平台</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Next.js_16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi" />
  <img src="https://img.shields.io/badge/AI-讯飞星火-1a73e8" />
  <img src="https://img.shields.io/badge/Agent-星辰Agent平台-7c3aed" />
  <img src="https://img.shields.io/badge/Database-SQLite-0f766e" />
</p>

---

## 项目简介

SparkLearn 是面向学习场景的 AI 产品，围绕“学什么、怎么学、学得怎么样”构建完整学习闭环：

- 学生端：画像、路径、资源、练习、报告、学习伙伴
- 社区端：学习论坛 + 学习广场
- 教师端：看板、学生管理、干预、通知分发、AI 辅助教学

---

## 产品能力全景

### 1) 学生端能力

| 模块 | 功能说明 |
|---|---|
| 学习工作台 | 聚合学习状态、任务入口与关键提醒 |
| 学习画像 | 基于行为与结果动态更新个性化画像 |
| 个性化路径 | 按阶段目标规划学习路线与下一步建议 |
| 资源中心 | 按主题生成学习资源并支持后续复用 |
| 练习评测 | 单选/多选/填空，过程反馈、正确率统计、答题复盘 |
| 错题与收藏 | 沉淀薄弱点与高价值题目，支持反复训练 |
| 学习报告 | 展示阶段结果、趋势分析与反馈建议 |
| 学习伙伴 Agent | 提供对话式学习支持与过程陪伴 |
| 知识库 | 支持知识沉淀、检索与学习问答 |
| 视频资源 | 支持视频化学习内容消费 |

学生端主路由示例：
- `/`、`/profile`、`/path`、`/generate`、`/practice`、`/report`、`/agent`、`/knowledge`、`/video`

### 2) 社区端能力

| 模块 | 功能说明 |
|---|---|
| 学习论坛 | 发帖、浏览、详情、评论、点赞、收藏 |
| 论坛附件 | 资料上传、下载与共享 |
| 个人论坛数据 | 我的帖子、收藏、点赞、评论、浏览历史 |
| 学习广场 | 资料共享、学习答疑、组队共学、经验分享 |

社区端主路由示例：
- `/forum`、`/forum/new`、`/forum/[postId]`
- `/plaza`、`/plaza/resource-share`、`/plaza/qa`、`/plaza/team-study`、`/plaza/experience-share`

### 3) 教师端能力

| 模块 | 功能说明 |
|---|---|
| 教师看板 | 班级活跃、正确率、完成率、风险学生等核心指标 |
| 学生管理 | 学生列表与学生详情画像 |
| AI 教学助手 | 单学生 AI 诊断、班级 AI 日报 |
| 干预中心 | 风险识别与教学干预入口 |
| 通知分发 | 面向班级/指定学生下发通知 |
| 教学资料管理 | 资料上传、管理、下载复用 |

教师端主路由示例：
- `/teacher/dashboard`、`/teacher/students`、`/teacher/students/[id]`
- `/teacher/ai`、`/teacher/interventions`、`/teacher/broadcast`、`/teacher/reports`

---

## 后端 API 概览

### Forum API（`/api/forum`）

- 帖子：`GET /posts`、`POST /posts`、`GET /posts/{post_id}`、`DELETE /posts/{post_id}`
- 评论：`GET/POST /posts/{post_id}/comments`、`DELETE /comments/{comment_id}`
- 互动：`POST /posts/{post_id}/like`、`POST /posts/{post_id}/favorite`
- 附件：`POST /posts/{post_id}/attachments`、`GET /attachments/{attachment_id}/download`
- 个人数据：`GET /my/posts`、`GET /my/favorites`、`GET /my/likes`、`GET /my/comments`、`GET /my/history`

### Teacher API（`/api/teacher`）

- 看板与学生：`GET /dashboard`、`GET /students`、`GET /students/{student_id}`
- AI 辅助：`POST /ai/diagnose`、`POST /ai/daily-report`
- 教学资料：`POST /broadcast/materials`、`GET /broadcast/materials`、`GET /broadcast/materials/{file_id}/download`
- 通知分发：`POST /broadcasts`、`GET /broadcasts`

---

## 技术架构

```text
SparkLearn
├─ Frontend (Next.js 16 + React 19 + TypeScript)
│  ├─ 学生端 (shell)
│  ├─ 教师端 (teacher)
│  └─ 社区端 (forum/plaza)
├─ Backend (FastAPI + Pydantic)
│  ├─ 学习业务路由
│  ├─ 论坛路由
│  ├─ 教师路由
│  └─ 统一 API 响应
├─ Data Layer
│  ├─ SQLite
│  └─ JSON/文件存储
└─ AI Layer
   ├─ 讯飞星火
   ├─ 星辰Agent平台
   └─ 多模态生成链路
```

---

## 技术栈

| 层级 | 技术选型 |
|---|---|
| 前端 | Next.js 16、React 19、TypeScript、Tailwind CSS |
| 后端 | Python 3.11、FastAPI、Pydantic |
| 数据 | SQLite + 文件存储 |
| AI 能力 | 讯飞星火、星辰Agent平台、多模态生成链路 |

---

## 快速启动

### 环境要求

- Node.js 18+
- Python 3.11+

### 启动后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问：`http://localhost:3000`

---

## 项目结构

```text
SparkLearn/
├─ frontend/
│  ├─ src/app/(shell)/
│  ├─ src/app/(teacher)/
│  └─ src/app/plaza/
├─ backend/
│  ├─ app/routes/forum.py
│  ├─ app/routes/teacher.py
│  └─ app/routes/
└─ README.md
```

---

## 说明

- 当前默认以 `single_user_id` 模式进行本地体验与联调。
- 面向多用户线上部署时，建议补齐鉴权、权限、审计与数据库迁移方案。
