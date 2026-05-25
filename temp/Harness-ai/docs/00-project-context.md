# 项目上下文（交接摘要）

## 1. 项目定位

SparkLearn 是一个面向学习场景的 AI 平台，核心是“画像 -> 路径 -> 资源 -> 练习 -> 评估 -> 画像更新”的学习闭环。

## 2. 技术栈

- 前端: Next.js 16 + React 19 + TypeScript
- 后端: FastAPI + Pydantic
- 资源生成: Coze API
- LLM/TTS/PPT: 讯飞相关能力
- 数据存储: SQLite + JSON

## 3. 代码位置

- 前端: D:\Project_building\SparkLearn\frontend
- 后端: D:\Project_building\SparkLearn\backend
- 主要文档: D:\Project_building\SparkLearn\spec 与 D:\Project_building\SparkLearn\Dorc

## 4. 运行方式

后端：
`powershell
cd D:\Project_building\SparkLearn\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
`

前端：
`powershell
cd D:\Project_building\SparkLearn\frontend
npm run dev
`

## 5. 核心业务页面（frontend/src/app）

- 学生端: eed, profile, path, generate, knowledge, practice, eport, ideo, gent
- 教师端: (teacher)/teacher/*
- 其他: uth, onboarding, 	utor/*

## 6. 后端核心入口

- App 入口: ackend/app/main.py
- 配置入口: ackend/app/config.py
- 路由目录: ackend/app/routes

## 7. 风险点

- 根目录 .env 当前包含真实格式配置，建议迁移为 .env.local 并只共享模板。
- spark_bridge.exe 依赖 MSVC 编译环境；缺失时后端将走 WebSocket 直连 fallback。
