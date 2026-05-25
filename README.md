# SparkLearn

SparkLearn 是一个面向学习场景的 AI 个性化学习平台，覆盖学生端学习闭环与教师端教学运营。

## 最近新增功能（V2）

> 本节聚焦近期版本实际落地能力（对应仓库中 `forum`、`teacher`、`practice` 等模块的新增改造）。

### 1. 学习论坛（新）

- 新增学生论坛主流程：帖子列表、发帖、帖子详情、评论互动、点赞/收藏。
- 新增论坛附件能力：支持上传与下载，适用于资料共享。
- 新增“我的论坛数据”：我的帖子、我的收藏、我的点赞、我的评论、浏览历史。
- 已接入前端导航与移动端主 Tab（论坛入口可直接访问）。

前端页面：
- `frontend/src/app/(shell)/forum/page.tsx`
- `frontend/src/app/(shell)/forum/new/page.tsx`
- `frontend/src/app/(shell)/forum/[postId]/page.tsx`

后端接口（前缀 `/api/forum`）：
- `GET /posts`、`POST /posts`、`GET /posts/{post_id}`、`DELETE /posts/{post_id}`
- `GET/POST /posts/{post_id}/comments`、`DELETE /comments/{comment_id}`
- `POST /posts/{post_id}/like`、`POST /posts/{post_id}/favorite`
- `POST /posts/{post_id}/attachments`、`GET /attachments/{attachment_id}/download`
- `GET /my/posts`、`GET /my/favorites`、`GET /my/likes`、`GET /my/comments`、`GET /my/history`

### 2. 教师端二次改造（新）

- 新增教师端独立路由与登录跳转：`/teacher` 自动分流到登录页或看板。
- 新增教师数据看板：班级活跃率、平均正确率、任务完成率、风险学生等关键指标。
- 新增学生管理：学生列表与学生详情视图。
- 新增 AI 教师助手：
  - 单学生 AI 诊断
  - 班级 AI 日报
- 新增教学通知与资料分发能力：支持上传教学资料、创建分发通知、查看历史通知。

前端页面：
- `frontend/src/app/(teacher)/teacher/dashboard/page.tsx`
- `frontend/src/app/(teacher)/teacher/students/page.tsx`
- `frontend/src/app/(teacher)/teacher/students/[id]/page.tsx`
- `frontend/src/app/(teacher)/teacher/ai/page.tsx`
- `frontend/src/app/(teacher)/teacher/broadcast/page.tsx`

后端接口（前缀 `/api/teacher`）：
- `GET /dashboard`、`GET /students`、`GET /students/{student_id}`
- `POST /ai/diagnose`、`POST /ai/daily-report`
- `POST /broadcast/materials`、`GET /broadcast/materials`、`GET /broadcast/materials/{file_id}/download`
- `POST /broadcasts`、`GET /broadcasts`

### 3. 练习评测体验升级（新）

- 练习题型完善：单选、多选、填空三类题型统一支持。
- 新增答题过程态管理：
  - 题目结果标记（对/错）
  - 答题记录回填（切题后恢复已答状态）
  - 分页题卡（大量题目可分页导航）
- 新增自动/手动主题生成模式，支持继续追加出题。
- 新增正确率与进度可视化，便于即时复盘。

核心页面：
- `frontend/src/app/(shell)/practice/page.tsx`

### 4. 学习广场结构化入口（新）

- 新增独立“学习广场”分模块入口：资料共享、学习答疑、组队共学、经验分享。
- 作为论坛与社区能力的结构化导航层，降低信息混杂。

核心页面：
- `frontend/src/app/plaza/page.tsx`

## 系统能力概览

- 学生端：学习画像、路径规划、资源生成、练习评测、学习报告、学习伙伴。
- 社区端：学习论坛 + 学习广场。
- 教师端：看板、学生管理、干预与 AI 辅助、通知分发。
- 后端：FastAPI + SQLite，统一 API 响应结构。

## 技术栈

- 前端：Next.js 16、React 19、TypeScript、Tailwind CSS
- 后端：Python 3.11、FastAPI、Pydantic、SQLite
- AI 能力：讯飞星火、Coze、多模态生成链路

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

## 项目结构

```text
SparkLearn/
├─ frontend/
│  ├─ src/app/(shell)/          # 学生端主流程
│  ├─ src/app/(teacher)/        # 教师端页面
│  └─ src/app/plaza/            # 学习广场
├─ backend/
│  ├─ app/routes/forum.py       # 论坛接口
│  ├─ app/routes/teacher.py     # 教师端接口
│  └─ app/routes/               # 其他业务接口
└─ README.md
```

## 说明

- 当前项目以 `single_user_id` 单用户模式进行体验与联调。
- 若用于多用户线上场景，建议补齐鉴权、权限与数据库迁移方案。
