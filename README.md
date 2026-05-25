<p align="center">
  <img src="frontend/public/sparklearn-logo-official.png" alt="SparkLearn" width="96" />
</p>

<h1 align="center">SparkLearn · 个性化学习多智能体平台</h1>

<p align="center">
  <em>让每一位学习者都拥有专属 AI 学习伙伴</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Next.js_16-00C2FF?logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-2DD4BF?logo=fastapi&logoColor=0f172a" />
  <img src="https://img.shields.io/badge/AI-讯飞星火-38BDF8" />
  <img src="https://img.shields.io/badge/Agent-星辰Agent平台-A78BFA" />
  <img src="https://img.shields.io/badge/Database-SQLite-34D399" />
  <img src="https://img.shields.io/badge/个性化闭环-画像→路径→评测-22C55E" />
  <img src="https://img.shields.io/badge/多智能体协同-学习资源生成-F59E0B" />
  <img src="https://img.shields.io/badge/多模态学习-文档%2F题目%2F视频%2F播客-06B6D4" />
  <img src="https://img.shields.io/badge/语音交互-输入%2B播报-EC4899" />
  <img src="https://img.shields.io/badge/教师干预-风险识别与追踪-EF4444" />
  <img src="https://img.shields.io/badge/学习社区-论坛%2F答疑%2F共学-F97316" />
</p>

---

## 项目愿景

高等教育与职业学习正面临同一个核心问题：学习者基础、节奏、目标差异巨大，但资源供给与辅导路径往往标准化。

SparkLearn 通过 AI 多智能体协同，为学习者构建一套可持续优化的个性化学习闭环：

**画像构建 → 路径规划 → 资源生成 → 学习互动 → 练习评测 → 反馈报告 → 画像更新**

平台目标不是“单点工具”，而是形成“可持续演进的学习系统”。

---

## 核心能力

### 1) 对话式学习画像

通过自然语言互动采集学习者知识基础、认知偏好、薄弱点与学习目标，持续更新画像，降低传统问卷成本。

- 输入：首次访谈、学习行为、练习结果、资源使用偏好。
- 输出：能力分层、知识图谱掌握度、风险点、阶段目标。
- 价值：从“统一学习任务”切换为“因人而异的学习计划”。

### 2) 动态学习路径规划

基于画像、学习行为与练习反馈自动调整学习路径，确保任务难度与学习节奏匹配。

- 路径机制：目标拆解 -> 阶段任务 -> 每日行动建议。
- 调整机制：正确率、完成时长、卡点频率触发难度和节奏调整。
- 价值：减少“跟不上”或“重复刷题”导致的学习损耗。

### 3) 多智能体资源生成

围绕当前学习节点生成文档、思维导图、题目、视频、播客等内容，并支持复用与迭代。

- 生成类型：知识讲解、练习题、案例、复习卡片、音视频内容。
- 生成策略：按画像中的薄弱点与目标优先级定向生产。
- 价值：让“资源供给”从手工搜集升级为自动化、可迭代供给。

### 4) 智能辅导与多角色协同

支持不同教学风格角色切换、AI 协同研讨、知识库增强答疑与语音交互。

- 角色能力：讲解型、启发型、督学型等教学风格切换。
- 交互方式：文本对话、语音输入、语音播报、知识库检索增强。
- 价值：将“问答工具”升级为“可持续陪伴的学习伙伴”。

### 5) 过程评估与反馈闭环

将行为数据、练习结果与资源使用数据沉淀为学习报告，反哺后续学习策略。

- 评估维度：掌握度、稳定性、学习效率、阶段目标完成率。
- 反馈形式：阶段报告、错因分析、下一步学习建议。
- 价值：形成“学习-评估-优化”的持续闭环。

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
│  ├─ 论坛路由 (/api/forum)
│  ├─ 教师路由 (/api/teacher)
│  └─ 统一 API 响应
├─ Data Layer
│  ├─ SQLite
│  └─ JSON/文件存储
└─ AI Layer
   ├─ 讯飞星火
   ├─ 星辰Agent平台
   └─ 多模态生成链路
```

### 技术栈

| 层级 | 技术选型 |
|---|---|
| 前端 | Next.js 16、React 19、TypeScript、Tailwind CSS |
| 后端 | Python 3.11、FastAPI、Pydantic |
| 数据 | SQLite + 文件存储 |
| AI 能力 | 讯飞星火、星辰Agent平台、多模态生成链路 |

### 项目结构

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

## 产品亮点

### 产品优势

| 优势点 | 传统方案痛点 | SparkLearn 的改进 |
|---|---|---|
| 学习闭环一体化 | 画像、内容、练习、评估分散在多个系统 | 在一个平台内完成“诊断-学习-评测-反馈-优化”全流程 |
| 真正个性化 | 多数平台只做资源推荐，不做路径动态调整 | 按学习行为和结果实时调整学习任务、难度和节奏 |
| 多模态内容供给 | 教师和学生手工找资料，效率低、更新慢 | AI 自动生成文档/题目/视频/播客等并支持迭代 |
| 教学干预可执行 | 风险学生识别后缺少落地动作 | 教师端提供干预入口、通知分发和跟踪反馈 |
| 学习社群协同 | 学习过程割裂，缺少互助和共学机制 | 社区端打通论坛、答疑、组队共学与经验共享 |

### 学生端功能详解

| 功能模块 | 具体能力 | 用户价值 |
|---|---|---|
| 学习工作台 | 聚合今日任务、进度、提醒与快捷入口 | 快速进入学习状态，减少切换成本 |
| 学习画像 | 展示当前能力分层、薄弱点、偏好与目标 | 明确“我现在在哪、下一步做什么” |
| 个性化路径 | 阶段路线、节点任务、动态难度调节 | 学习节奏与个人能力匹配，降低挫败感 |
| 资源中心 | 生成并管理文档、题目、思维导图、音视频资源 | 资源按需供给，避免信息过载 |
| 练习评测 | 单选/多选/填空练习，过程反馈与正确率统计 | 及时发现问题，边练边纠偏 |
| 错题与收藏 | 错题归档、标签管理、针对性复训 | 薄弱点可追踪、可反复强化 |
| 学习报告 | 阶段成绩、趋势分析、策略建议 | 看得见成长轨迹和下一步方向 |
| 学习伙伴 Agent | 对话辅导、解题引导、学习陪伴 | 获得持续、低门槛、高频的学习支持 |
| 知识库与视频资源 | 主题检索、关联问答、视频化学习 | 支持不同学习风格与场景 |

学生端主路由示例：
- `/`、`/profile`、`/path`、`/generate`、`/practice`、`/report`、`/agent`、`/knowledge`、`/video`

### 教师端功能详解

| 功能模块 | 具体能力 | 教学价值 |
|---|---|---|
| 教师看板 | 班级活跃度、完成率、正确率、风险分布 | 快速掌握班级整体学习健康度 |
| 学生管理 | 学生列表、个体画像、历史学习轨迹 | 精准定位个体问题，支持分层教学 |
| AI 教学助手 | 单学生 AI 诊断、班级 AI 日报生成 | 减少重复分析工作，提升教学效率 |
| 干预中心 | 风险识别、干预建议、动作执行入口 | 从“发现问题”走向“落地解决” |
| 通知分发 | 面向班级/指定学生推送教学通知 | 教学动作触达更及时、更精准 |
| 教学资料管理 | 资料上传、管理、下载复用 | 形成可沉淀、可复用的教学资产 |

教师端主路由示例：
- `/teacher/dashboard`、`/teacher/students`、`/teacher/students/[id]`
- `/teacher/ai`、`/teacher/interventions`、`/teacher/broadcast`、`/teacher/reports`

### 社区端功能详解

| 功能模块 | 具体能力 | 社群价值 |
|---|---|---|
| 学习论坛 | 发帖、浏览、详情、评论、点赞、收藏 | 构建公开学习交流空间 |
| 论坛附件 | 学习资料上传、下载与共享 | 优质内容可传播、可复用 |
| 个人论坛数据 | 我的帖子、收藏、点赞、评论、浏览历史 | 形成可追踪的个人学习参与记录 |
| 学习广场 | 资料共享、学习答疑、组队共学、经验分享 | 提升学习互动密度，增强持续性 |

社区端主路由示例：
- `/forum`、`/forum/new`、`/forum/[postId]`
- `/plaza`、`/plaza/resource-share`、`/plaza/qa`、`/plaza/team-study`、`/plaza/experience-share`

### API 概览

- Forum API（`/api/forum`）：帖子、评论、点赞收藏、附件上传下载、个人论坛数据。
- Teacher API（`/api/teacher`）：看板与学生、AI 诊断与日报、教学资料管理、通知分发。

---

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.11+

### 1) 启动后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2) 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问：`http://localhost:3000`

### 3) 说明

- 当前默认以 `single_user_id` 模式进行本地体验与联调。
- 面向多用户线上部署时，建议补齐鉴权、权限、审计与数据库迁移方案。

---

<p align="center">
  <sub>学而思 SparkLearn 团队</sub>
</p>
