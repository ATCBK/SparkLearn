# SparkLearn Harness-AI 交接工程

本目录是 SparkLearn 的“可接手开发 Harness 工程”。目标是让新成员在最短时间内完成：
1. 本地启动
2. 任务接手
3. API 联调
4. 交付验收

## 目录结构

- docs/00-project-context.md: 项目上下文与架构摘要
- docs/01-handover-checklist.md: 交接与验收清单
- docs/02-dev-task-board.md: 当前开发任务板（可持续更新）
- docs/03-api-inventory.md: 后端 API 路由清单
- scripts/check-prerequisites.ps1: 环境检查
- scripts/start-backend.ps1: 启动后端
- scripts/start-frontend.ps1: 启动前端
- scripts/start-all.ps1: 一键启动前后端

## 快速开始

`powershell
cd D:\Project_building\SparkLearn\Harness-ai
.\scripts\check-prerequisites.ps1
.\scripts\start-all.ps1
`

启动后访问：
- 前端: http://localhost:3000
- 后端健康检查: http://127.0.0.1:8000/health
- 后端 Swagger: http://127.0.0.1:8000/docs

## 关键约定

- 代码主目录仍在 D:\Project_building\SparkLearn\frontend 与 D:\Project_building\SparkLearn\backend。
- 本 Harness 目录不替代业务代码，只承载“交接执行资产”（文档、脚本、任务板）。
- 根目录 .env 包含敏感配置；交接时只传键名模板，不传真实值。
