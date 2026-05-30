# CLAUDE.md - SparkLearn 项目配置

## 交互规则

1. **语言要求**：所有交互和回答必须使用中文（简体中文）。包括但不限于：代码注释、commit 信息、文档、对话回复。
2. **编码规则**：所有文件编码必须使用 UTF-8。读取和写入文件时确保编码正确，不得出现乱码字符。涉及中文内容时特别注意编码处理。

## 项目概述

SparkLearn —— 个性化学习多智能体平台。为学习者构建 AI 驱动的个性化学习闭环：画像构建 → 路径规划 → 资源生成 → 学习互动 → 练习评测 → 反馈报告 → 画像更新。

## 技术栈

- **前端**: Next.js 16 (App Router)，路径 `frontend/`
- **后端**: FastAPI (Python)，路径 `backend/`
- **AI 引擎**: 讯飞星火大模型
- **Agent 平台**: 星辰 Agent 平台
- **数据库**: SQLite（文件位于 `backend/data/db/sparklearn.db`）
- **RAG**: 向量化 Embedding 检索 + 知识库
- **其他**: MCP 插件系统、记忆系统、防幻觉控制器

## 项目结构

```
SparkLearn/
├── frontend/          # Next.js 16 前端
│   └── src/app/       # App Router 页面
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── routes/    # API 路由
│   │   └── db.py      # 数据库操作
│   └── data/          # 数据库和用户数据
├── KnowledgeRepo/     # 知识库
├── Dorc/              # DORC 相关模块
├── temp/              # 临时文件
└── docs/              # 文档
```

## 编码规范

- Python 代码使用 UTF-8 编码，文件头如有 `# -*- coding: utf-8 -*-` 声明
- TypeScript/JavaScript 代码使用 UTF-8 编码
- 所有文本文件（.md, .json, .txt 等）使用 UTF-8 编码
- Bash 命令中使用 `chcp 65001` 确保 Windows 控制台编码正确（如需要）
