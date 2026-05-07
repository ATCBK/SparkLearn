# 学而思 SparkLearn

> 基于大模型的个性化资源生成与学习多智能体系统开发 · 中国软件杯 A3 赛题项目

## 项目简介

SparkLearn 面向高校编程学习场景，围绕“画像驱动的个性化学习闭环”构建学习智能体系统。项目当前已进入第二阶段：前端从静态原型推进到 Next.js 应用，后端从接口草案推进到 FastAPI + SQLite/JSON 持久化骨架，并已开始围绕赛题主链路重构功能层级。

目标主闭环：

```text
对话建档
-> 生成学习画像
-> 基于画像规划学习路径
-> 基于路径节点推荐或生成资源
-> 学习资源并完成练习
-> 评估学习效果
-> 更新掌握度与画像
-> 调整路径和资源推荐
```

当前第二阶段产品层级以以下能力为主：

```text
学习工作台
学习画像
学习路径
资源生成
练习评估
学习报告
```

`智能辅导` 后续定位为全局页面精灵助手；`资源推送` 下沉到首页工作台和推荐详情页；`资源库` 独立承担已保存资源管理与预览；`视频/动画` 作为资源生成体系中的多模态资源类型。

## 当前能力

- **学习画像**：支持问卷式建档，已具备对话式画像建档接口基础。
- **学习路径**：提供阶段路径、知识图谱、节点掌握度和节点建议。
- **资源生成**：支持文档、PPT、思维导图、练习题、拓展阅读、代码案例等资源生成与预览下载基础。
- **资源推荐**：已有推荐列表接口，第二阶段将下沉到首页工作台、路径节点、错题补弱和报告建议中。
- **练习评估**：支持服务端判题、错题记录、收藏题和掌握度回写基础。
- **智能辅导**：支持流式聊天、导师角色、会话历史、文件上传和多智能体 workshop 事件基础。
- **学习报告**：基于学习事件、练习记录、资源使用记录和掌握度数据生成报告。
- **持久化**：当前采用单用户模式，使用 SQLite + JSON/JSONL 保存画像、资源、练习、事件和 Tutor 数据。

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 前端 | Next.js 16、React 19、TypeScript、Tailwind CSS 4 | App Router、组件化页面、真实 API 适配层 |
| 前端组件 | lucide-react、react-markdown、remark-gfm | 图标、Markdown 预览和资源内容展示 |
| 后端 | FastAPI、Pydantic、Uvicorn | REST API、SSE 流式输出、异步 I/O |
| 数据 | SQLite、JSON、JSONL | 结构化数据 + 单用户事件日志 |
| 生成与外部能力 | Coze、讯飞智文 PPT、讯飞星火相关能力 | 资源生成、PPT 生成、LLM/Tutor 流式能力 |
| 测试 | pytest、Playwright | 后端 API 测试和前端页面 smoke test 基础 |

## 项目结构

```text
SparkLearn/
├── frontend/                         # Next.js 前端工程
│   ├── src/
│   │   ├── app/
│   │   │   ├── (shell)/              # 主应用 Shell 页面
│   │   │   │   ├── page.tsx          # 学习工作台 / 首页
│   │   │   │   ├── path/             # 学习路径
│   │   │   │   ├── generate/         # 资源生成
│   │   │   │   ├── resources/        # 资源库
│   │   │   │   ├── feed/             # 推荐资源详情页
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
├── Dorc/                             # 项目文档
│   ├── 学而思｜第一阶段项目开发文档/
│   └── 第二阶段项目开发文档/
├── KnowledgeRepo/                    # 课程知识库资料
├── UseData/                          # 素材和历史数据
└── ui-prototypes/                    # UI 原型和参考设计
```

## 页面职责

| 页面 | 路由 | 当前定位 |
|---|---|---|
| 学习工作台 | `/` | 主闭环入口，承接当前任务、路径节点、资源推送和学习反馈 |
| 学习画像 | `/onboarding`、`/profile` | 建档、画像查看和画像编辑 |
| 学习路径 | `/path` | 路径主控台，承接资源、练习、辅导和报告入口 |
| 资源生成 | `/generate` | 第二阶段目标为 SOP 生成流程：上下文、类型、需求、生成与预览 |
| 资源库 | `/resources` | 保存资源、管理资源、点击预览、下载和继续学习 |
| 推荐资源详情 | `/feed` | 从首页、路径节点、错题补弱或报告建议进入 |
| 练习评估 | `/practice` | 个性化练习、服务端判题、错题沉淀和掌握度回写 |
| 助手会话中心 | `/tutor` | Tutor 历史、文件、会话和多智能体过程查看；后续全局精灵助手承接主交互 |
| 学习报告 | `/report` | 学习行为、资源使用、练习结果和掌握度变化的评估入口 |
| 视频预览 | `/video` | 多模态资源预览页，不作为一级主功能 |

## 快速启动

### 1. 后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

后端默认服务地址：

```text
http://127.0.0.1:8000
```

### 2. 前端

```powershell
cd frontend
npm install
npm run dev
```

前端默认访问地址：

```text
http://localhost:3000
```

如需指定后端地址，在 `frontend/.env.local` 中配置：

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

不要提交 `.env` 或 `.env.local`。

## 测试

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

## 文档入口

第二阶段核心文档位于：

```text
Dorc/第二阶段项目开发文档/
```

建议优先阅读：

- `学而思｜赛题.md`：赛题原始要求，最高业务依据。
- `学而思｜AI辅助开发规范.md`：编码、文档、功能层级和协作规范。
- `学而思｜当前功能层级现状梳理.md`：当前已有页面和能力盘点。
- `学而思｜功能层级与闭环问题总览.md`：当前层级和闭环问题总览。
- `学而思｜第二阶段功能层级与学习闭环改造方案.md`：第二阶段整体改造目标。
- `学而思｜资源生成与资源库页面更新设计.md`：资源生成、资源库、推荐资源和视频预览页面设计。

所有第二阶段 Markdown 文档开头均应包含 `## 1. 文档目的`，说明文档用途、当前状态和未实现/待处理内容。

## 当前注意事项

1. 当前仍以 `single_user` 单用户模式为主，暂不引入复杂多用户权限体系。
2. 资源生成相关能力已有基础，但 `/generate` SOP 化、资源库预览抽屉、首页资源推送下沉仍属于待实现或待验证内容。
3. `视频/动画` 当前应定位为资源类型，现阶段可先承接脚本、分镜、字幕和动画讲解方案，不应提前写成已完成真实 MP4 自动生成。
4. 外部 API Key、Secret、Token、Cookie、私有服务地址不得写入 Git。
5. Windows PowerShell 读取中文 Markdown 时必须显式使用 `-Encoding UTF8`。

## Git 分支

当前第二阶段主开发分支 `part2_v1` 已合并到 `main`。后续如继续开发，建议从 `main` 拉出新的主题分支。
