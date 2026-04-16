# 学而思 SparkLearn

> AI 驱动的个性化学习平台 · 赛题项目

## 项目简介

SparkLearn 是一个基于多 Agent 协作的智能自适应学习系统，面向 Python 编程课程。系统通过 7 个 AI Agent 协同工作，为每位学习者生成个性化的学习路径、资源推荐和辅导答疑。

核心特色：
- **多 Agent 协作**：7 个专业 Agent（画像/路径/资源/推题/评估/辅导/整合）通过 CrewAI 编排
- **自适应学习路径**：基于知识图谱和学习画像，动态规划个性化学习路线
- **AI 资源生成**：自动生成讲义、PPT、思维导图、练习题、拓展阅读、代码案例
- **流式交互**：辅导答疑采用流式输出，实时响应
- **语音交互**：支持语音输入（ASR）和语音播报（TTS）

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 前端 | React + Next.js + Tailwind CSS | App Router、SSR、组件化 |
| 图标 | Lucide React | SVG 图标，风格统一 |
| 后端 | FastAPI (Python) | 流式输出、异步 I/O、Swagger |
| 大模型 | 讯飞星火 API | 赛题要求科大讯飞工具 |
| Agent | CrewAI | 角色分工、声明式编排 |
| 向量库 | ChromaDB | 本地零配置 |
| 存储 | SQLite + JSON/JSONL | 结构化 + 追加写入 |
| 语音 | 讯飞 ASR + TTS | 语音输入 + 语音播报 |
| 设计语言 | Apple Pure | DM Sans + Noto Sans SC |

## 项目结构

```
SparkLearn/
├── frontend/                # 前端（Next.js）
│   ├── src/
│   │   ├── app/             # App Router 页面
│   │   │   ├── page.tsx           # 01 首页学习总览
│   │   │   ├── path/              # 02 学习路径
│   │   │   ├── resources/         # 03 资源中心
│   │   │   ├── practice/          # 04 练习与错题
│   │   │   ├── feed/              # 05 资源推送
│   │   │   ├── generate/          # 06 资源生成与详情
│   │   │   ├── tutor/             # 07 智能辅导
│   │   │   ├── report/            # 08 学习报告
│   │   │   ├── video/             # 09 视频播放
│   │   │   ├── profile/           # 10 个人信息
│   │   │   ├── onboarding/        # 11 学习画像建档
│   │   │   └── auth/              # 12 登录/注册
│   │   ├── components/      # 通用组件
│   │   │   ├── layout/            # Sidebar、AppShell
│   │   │   ├── ui/                # 按钮、卡片、标签等
│   │   │   └── charts/            # 进度环、热力图等
│   │   ├── lib/             # 工具函数、API 封装
│   │   └── styles/          # 全局样式、CSS 变量
│   └── public/              # 静态资源
├── backend/                 # 后端（FastAPI）
│   ├── app/
│   │   ├── agents/          # CrewAI Agent 定义
│   │   ├── api/             # API 路由
│   │   ├── models/          # 数据模型
│   │   ├── services/        # 业务逻辑
│   │   └── core/            # 配置、数据库
│   └── requirements.txt
├── KnowledgeRepo/           # 课程知识库
├── UseData/                 # 数据存储
├── Dorc/                    # 项目文档
│   ├── UI-UX-Design-Spec.md
│   ├── 学而思｜技术产品方案 V2.md
│   └── ...
└── ui-prototypes/           # 设计原型
    ├── homepage-v2.html
    └── wireframes-all-pages.html
```

## 设计系统

基于 Apple Pure 设计语言，核心 Design Token：

| 类别 | Token | 值 |
|------|-------|-----|
| 主文字 | `--ink` | `#1d1d1f` |
| 次要文字 | `--ink-secondary` | `#6e6e73` |
| 主操作蓝 | `--blue` | `#0071e3` |
| 信息青 | `--teal` | `#5ac8fa` |
| 页面背景 | `--bg` | `#fbfbfd` |
| 卡片背景 | `--bg-card` | `#ffffff` |
| 字体（英文） | DM Sans | Google Fonts |
| 字体（中文） | Noto Sans SC | Google Fonts |
| 侧栏宽度 | `260px` | 固定定位 + 毛玻璃 |
| 圆角（小） | `--radius-sm` | `12px` |
| 圆角（卡片） | `--radius-lg` | `20px` |

详见 [UI-UX 设计规范](Dorc/UI-UX-Design-Spec.md)。

## 页面清单

| 编号 | 页面 | 路由 | 说明 |
|------|------|------|------|
| 01 | 首页学习总览 | `/` | Hero + 特色卡片 + 统计 + 任务列表 |
| 02 | 学习路径 | `/path` | 知识图谱 + 阶段规划 |
| 03 | 资源中心 | `/resources` | 搜索 + 分类浏览 |
| 04 | 练习与错题 | `/practice` | 刷题 + 错题本 |
| 05 | 资源推送 | `/feed` | AI 个性化推荐 |
| 06 | 资源生成与详情 | `/generate` | AI 生成 + 在线预览 + 保存 |
| 07 | 智能辅导 | `/tutor` | AI 对话式辅导 |
| 08 | 学习报告 | `/report` | 数据可视化 + 薄弱点分析 |
| 09 | 视频播放 | `/video` | 播放器 + AI 笔记 |
| 10 | 个人信息 | `/profile` | 账户设置 |
| 11 | 学习画像建档 | `/onboarding` | 首次使用偏好收集 |
| 12 | 登录/注册 | `/auth` | 用户认证 |

## 快速启动

```bash
# 前端
cd frontend
npm install
npm run dev

# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 参考文档

- [UI/UX 设计规范](Dorc/UI-UX-Design-Spec.md)
- [技术产品方案 V2](Dorc/学而思｜技术产品方案%20V2.md)
- [赛题要求](Dorc/赛题.md)
- [项目任务规划](Dorc/项目任务规划表.md)
