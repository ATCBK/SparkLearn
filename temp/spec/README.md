# SparkLearn 学而思

<p align="center">
  <strong>基于大模型的个性化资源生成与学习多智能体系统</strong>
</p>

<p align="center">
  <span>中国软件杯 A3 赛题项目</span>
  ·
  <span>Next.js + FastAPI</span>
  ·
  <span>画像驱动学习闭环</span>
</p>

<p align="center">
  <img alt="Phase" src="https://img.shields.io/badge/Phase-Second%20Stage-2563eb?style=flat-square" />
  <img alt="Frontend" src="https://img.shields.io/badge/Frontend-Next.js%2016-111827?style=flat-square" />
  <img alt="Backend" src="https://img.shields.io/badge/Backend-FastAPI-059669?style=flat-square" />
  <img alt="Data" src="https://img.shields.io/badge/Data-SQLite%20%2B%20JSONL-d97706?style=flat-square" />
</p>

---

## 1. 项目定位

SparkLearn 是面向高校编程学习场景的个性化学习智能体系统。项目围绕赛题要求，将“学习画像、学习路径、资源生成、练习评估、学习报告”组织成一条可演示、可追踪、可回流的学习闭环。

当前项目已从第一阶段的原型和方案设计，推进到第二阶段的可运行工程骨架：

- 前端：`Next.js` 主应用、学习路径、资源生成、练习评估、Tutor、报告等页面已具备基础。
- 后端：`FastAPI` 服务、画像、路径、资源、练习、Tutor、报告等接口已注册。
- 数据：采用 `SQLite + JSON/JSONL` 保存单用户画像、资源、练习、学习事件和 Tutor 会话。
- 文档：第二阶段已补齐功能层级、闭环改造、资源页面更新设计和 AI 辅助开发规范。

> 当前重点不是继续堆页面，而是把已有能力重组为赛题可证明的个性化学习闭环。

---

## 2. 学习闭环

```text
对话建档
   ↓
生成学习画像
   ↓
基于画像规划学习路径
   ↓
基于路径节点推荐或生成资源
   ↓
学习资源并完成练习
   ↓
评估学习效果
   ↓
更新掌握度与画像
   ↓
调整路径和资源推荐
```

第二阶段目标一级能力：

| 一级能力 | 职责 |
|---|---|
| 学习工作台 | 聚合当前任务、路径节点、资源推送、错题补弱和学习反馈 |
| 学习画像 | 对话式建档、画像查看、画像编辑、画像更新 |
| 学习路径 | 阶段路径、知识图谱、节点建议、下一步学习动作 |
| 资源生成 | 基于上下文生成文档、PPT、题库、代码案例、多模态资源等 |
| 练习评估 | 服务端判题、错题沉淀、掌握度回写、补弱推荐 |
| 学习报告 | 汇总学习行为、资源使用、练习结果和后续调整建议 |

辅助能力定位：

| 能力 | 第二阶段定位 |
|---|---|
| 智能辅导 | 后续改为全局 AI 精灵助手，`/tutor` 保留为会话中心和过程查看页 |
| 资源推送 | 下沉到学习工作台、路径节点、错题补弱和报告建议 |
| 资源库 | 独立页面，负责已保存资源管理、预览、下载和继续学习 |
| 视频/动画 | 作为资源生成体系中的多模态资源类型，不作为一级导航 |

---

## 3. 当前能力概览

| 模块 | 已具备基础 | 第二阶段待强化 |
|---|---|---|
| 学习画像 | 问卷建档、画像读取、画像编辑、对话建档接口基础 | 对话式建档主链路、画像随学随新 |
| 学习路径 | 阶段路径、知识图谱、节点掌握度、节点建议 | 与资源、练习、报告形成显性闭环 |
| 资源生成 | 文档、PPT、思维导图、练习题、拓展阅读、代码案例 | SOP 流程页、视频/动画资源类型、生成过程证据 |
| 资源库 | 已生成资源列表、下载、删除基础 | 点击预览、来源字段、关联知识点、继续学习 |
| 练习评估 | 服务端判题、错题、收藏、练习记录 | 错题触发补弱资源推荐 |
| 智能辅导 | 流式聊天、导师角色、会话、文件上传、多智能体 workshop | 全局精灵助手和页面上下文接入 |
| 学习报告 | 学习统计、薄弱点、AI 总结、报告刷新 | 报告结果回流画像、路径和推荐 |

---

## 4. 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 前端框架 | Next.js 16、React 19、TypeScript | App Router、组件化页面、真实接口适配 |
| 样式与 UI | Tailwind CSS 4、lucide-react | 轻量组件、图标、响应式布局 |
| 内容渲染 | react-markdown、remark-gfm | Markdown 资源预览 |
| 后端框架 | FastAPI、Pydantic、Uvicorn | REST API、异步 I/O、SSE |
| 数据存储 | SQLite、JSON、JSONL | 单用户数据、资源索引、学习事件 |
| 外部能力 | Coze、讯飞智文 PPT、讯飞星火相关能力 | 资源生成、PPT 生成、Tutor/LLM 流式能力 |
| 测试 | pytest、Playwright | 后端 API 测试、前端页面 smoke test |

---

## 5. 项目结构

```text
SparkLearn/
├── frontend/                         # Next.js 前端工程
│   ├── src/
│   │   ├── app/
│   │   │   ├── (shell)/              # 主应用 Shell
│   │   │   │   ├── page.tsx          # 学习工作台
│   │   │   │   ├── path/             # 学习路径
│   │   │   │   ├── generate/         # 资源生成
│   │   │   │   ├── resources/        # 资源库
│   │   │   │   ├── feed/             # 推荐资源详情
│   │   │   │   ├── practice/         # 练习评估
│   │   │   │   ├── tutor/            # 助手会话中心
│   │   │   │   ├── report/           # 学习报告
│   │   │   │   ├── video/            # 多模态视频预览
│   │   │   │   └── profile/          # 学习画像 / 个人资料
│   │   │   ├── onboarding/           # 首次建档
│   │   │   └── auth/                 # 登录注册
│   │   ├── components/               # UI、布局、品牌组件
│   │   └── lib/api/                  # API 类型、真实接口适配、mock 数据
│   └── package.json
│
├── backend/                          # FastAPI 后端工程
│   ├── app/
│   │   ├── main.py                   # 后端入口
│   │   ├── routes/                   # profile、learning、resources、quiz、tutor_eval 等路由
│   │   ├── db.py                     # SQLite 初始化与访问
│   │   ├── storage.py                # JSON/JSONL 存储工具
│   │   └── coze.py / xfyun_ppt.py    # 外部生成能力适配
│   ├── data/                         # 单用户数据库和业务数据
│   ├── tests/                        # 后端测试
│   └── requirements.txt
│
├── Dorc/                             # 项目文档
│   ├── 学而思｜第一阶段项目开发文档/
│   └── 第二阶段项目开发文档/
├── KnowledgeRepo/                    # 课程知识库资料
├── UseData/                          # 素材和历史数据
└── ui-prototypes/                    # UI 原型和参考设计
```

---

## 6. 页面职责

| 页面 | 路由 | 当前定位 |
|---|---|---|
| 学习工作台 | `/` | 主闭环入口，承接当前任务、路径节点、资源推送和学习反馈 |
| 学习画像 | `/onboarding`、`/profile` | 建档、画像查看和画像编辑 |
| 学习路径 | `/path` | 路径主控台，承接资源、练习、辅导和报告入口 |
| 资源生成 | `/generate` | 第二阶段目标为 SOP 生成流程：上下文、类型、需求、生成与预览 |
| 资源库 | `/resources` | 保存资源、管理资源、点击预览、下载和继续学习 |
| 推荐资源详情 | `/feed` | 从首页、路径节点、错题补弱或报告建议进入 |
| 练习评估 | `/practice` | 个性化练习、服务端判题、错题沉淀和掌握度回写 |
| 助手会话中心 | `/tutor` | Tutor 历史、文件、会话和多智能体过程查看 |
| 学习报告 | `/report` | 学习行为、资源使用、练习结果和掌握度变化的评估入口 |
| 视频预览 | `/video` | 多模态资源预览页，不作为一级主功能 |

---

## 7. 快速启动

### 后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

默认地址：

```text
http://127.0.0.1:8000
```

### 前端

```powershell
cd frontend
npm install
npm run dev
```

默认地址：

```text
http://localhost:3000
```

如需指定后端地址，在 `frontend/.env.local` 中配置：

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

不要提交 `.env` 或 `.env.local`。

---

## 8. 测试

后端 API 测试：

```powershell
cd backend
pytest
```

前端页面 smoke test：

```powershell
cd frontend
npx playwright test
```

---

## 9. 文档索引

第二阶段核心文档位于：

```text
Dorc/第二阶段项目开发文档/
```

建议阅读顺序：

| 顺序 | 文档 | 用途 |
|---|---|---|
| 1 | `学而思｜赛题.md` | 赛题原始要求，最高业务依据 |
| 2 | `学而思｜AI辅助开发规范.md` | 编码、文档、功能层级和协作规范 |
| 3 | `学而思｜当前功能层级现状梳理.md` | 当前已有页面和能力盘点 |
| 4 | `学而思｜功能层级与闭环问题总览.md` | 当前层级和闭环问题总览 |
| 5 | `学而思｜第二阶段功能层级与学习闭环改造方案.md` | 第二阶段整体改造目标 |
| 6 | `学而思｜资源生成与资源库页面更新设计.md` | 资源生成、资源库、推荐资源和视频预览页面设计 |

所有第二阶段 Markdown 文档开头均应包含：

```markdown
## 1. 文档目的
```

该章节必须说明文档用途、当前状态和未实现/待处理内容。

---

## 10. 当前注意事项

- 当前仍以 `single_user` 单用户模式为主，暂不引入复杂多用户权限体系。
- `/generate` SOP 化、资源库预览抽屉、首页资源推送下沉仍属于待实现或待验证内容。
- `视频/动画` 当前应定位为资源类型，可先承接脚本、分镜、字幕和动画讲解方案，不应提前写成已完成真实 MP4 自动生成。
- 外部 API Key、Secret、Token、Cookie、私有服务地址不得写入 Git。
- Windows PowerShell 读取中文 Markdown 时必须显式使用 `-Encoding UTF8`。

---

## 11. 分支状态

当前第二阶段主开发分支 `part2_v1` 已合并到 `main`。

后续开发建议从 `main` 拉出新的主题分支：

```powershell
git checkout main
git pull
git checkout -b feature/<name>
```
