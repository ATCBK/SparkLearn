# SparkLearn 第三阶段：教师端工作台改造说明

> 文档版本：v1.0  
> 生成日期：2026-05-22  
> 适用范围：SparkLearn 教师端独立工作台（与学生端分离）

---

## 1. 改造目标

在已完成的大屏演示基础上，新增**教师端独立工作台**，与学生端完全分离，提供教师日常教学管理能力。

**核心目标：**
- 教师端独立路由 `/teacher`，有自己的登录、布局和导航
- 复用学生端设计系统（ProtoCard/Pill/ProtoButton），保持视觉一致
- 通过后端 `/api/teacher/*` API 获取班级数据
- AI 深度集成：班级日报、学生诊断、教学助手对话

**与学生端的关系：**
- 完全独立的路由组 `(teacher)`
- 独立的 layout（侧边栏 + 顶栏）
- 独立的登录入口（演示用固定账号）
- 学生端侧边栏有"教师工作台"入口可跳转

---

## 2. 页面结构

```
/teacher                    → 自动重定向到 /teacher/login 或 /teacher/dashboard
/teacher/login              → 教师登录页（演示账号 teacher/123456）
/teacher/dashboard          → 工作台首页（班级概况 + 风险预警 + AI日报）
/teacher/students           → 学生列表（卡片式，支持筛选）
/teacher/students/[id]      → 学生详情（画像 + 掌握度 + AI诊断）
/teacher/interventions      → 干预中心（风险学生 + AI建议 + 状态管理）
/teacher/ai                 → AI 教学助手（对话式，快捷问题）
/teacher/reports            → 班级学习报告（指标 + 排行 + 薄弱分析）
```

---

## 3. 文件清单

### 3.1 前端新增文件

```
frontend/src/app/(teacher)/
├── layout.tsx                          ← 路由组根 layout（透传）
└── teacher/
    ├── layout.tsx                      ← 教师端壳层（侧边栏+顶栏+鉴权）
    ├── page.tsx                        ← 入口重定向
    ├── login/page.tsx                  ← 登录页
    ├── dashboard/page.tsx              ← 工作台首页
    ├── students/page.tsx               ← 学生列表
    ├── students/[id]/page.tsx          ← 学生详情
    ├── interventions/page.tsx          ← 干预中心
    ├── ai/page.tsx                     ← AI 教学助手
    └── reports/page.tsx                ← 班级学习报告
```

### 3.2 后端文件（已完成）

```
backend/app/routes/teacher.py
├── GET  /api/teacher/dashboard         ← 班级聚合数据
├── GET  /api/teacher/students          ← 学生列表（真实+模拟）
├── GET  /api/teacher/students/{id}     ← 学生详情
├── POST /api/teacher/ai/diagnose       ← AI 学生诊断
└── POST /api/teacher/ai/daily-report   ← AI 班级日报
```

### 3.3 修改文件

```
frontend/src/components/layout/Sidebar.tsx
  → 新增"教师工具"分组，"教师工作台"入口指向 /teacher

backend/app/main.py
  → 注册 teacher_router
```

---

## 4. 各页面功能说明

### 4.1 登录页 `/teacher/login`

- 简单表单：账号 + 密码
- 演示固定账号：`teacher` / `123456`
- 登录成功后 localStorage 存 `teacher_token`
- 页面底部显示演示账号提示

### 4.2 工作台首页 `/teacher/dashboard`

| 模块 | 内容 |
|------|------|
| PageHead | 标题 + 4个核心指标 chip（在班学生/平均正确率/风险预警/今日活跃） |
| 核心指标条 | 4格横条：活跃率/正确率/人均时长/任务完成率 |
| 风险预警卡 | 列出所有风险学生，显示阶段/薄弱点/连续天数，可跳转详情 |
| AI 班级日报 | 点击"生成日报"调用 AI，显示班级状态摘要 |
| 阶段分布 | 进度条展示各阶段学生人数 |
| 快捷入口 | 4个卡片：学生管理/AI助手/干预中心/教师大屏 |

### 4.3 学生列表 `/teacher/students`

- 卡片式布局（3列网格）
- 每张卡片：头像、姓名、风险标签、阶段、正确率/连续天数/总时长、任务完成率进度条
- 筛选栏：搜索姓名 + 风险等级筛选 + 学习阶段筛选
- 点击"查看详情"进入学生详情页

### 4.4 学生详情 `/teacher/students/[id]`

- 左栏（300px）：头像卡片 + 学习画像（知识水平/每日计划/偏好/薄弱点）+ AI 诊断
- 右栏：核心指标条 + 薄弱知识点列表（<60%高亮）+ 全部知识点掌握度进度条
- AI 诊断：一键调用后端，生成1-2句教学建议

### 4.5 干预中心 `/teacher/interventions`

- 按风险等级分组：高风险（红色左边框）/ 预警（橙色左边框）
- 每个学生一张干预卡：基本信息 + AI 干预建议 + 操作按钮
- AI 建议：点击"生成建议"调用后端诊断接口
- 状态管理：待处理 → 已处理 / 已忽略，可重置

### 4.6 AI 教学助手 `/teacher/ai`

- 左栏（240px）：6个快捷问题按钮 + 使用提示
- 右栏：对话界面（气泡消息 + 输入框）
- 快捷问题：班级概况/薄弱分析/出题助手/教学计划/家长沟通/补弱策略
- 对话调用后端 `/api/tutor/chat`，注入教师角色 system context
- 支持流式输出（SSE）

### 4.7 班级学习报告 `/teacher/reports`

- 核心指标条：活跃率/正确率/任务完成率/平均连续天数
- 各阶段平均掌握度：进度条 + 颜色区分（绿>80%/蓝>50%/红<50%）
- 全班薄弱知识点 TOP8：排名 + 进度条
- 学生正确率排行：全班排名列表

---

## 5. 壳层设计

### 5.1 侧边栏导航

```
教师工作台 Logo（GraduationCap 图标）
─────────────────
工作台        /teacher/dashboard
学生管理      /teacher/students
干预中心      /teacher/interventions
AI 助手       /teacher/ai
学习报告      /teacher/reports
─────────────────
打开大屏      → /screen/index.html（新标签）
学生端        → /（新标签）
退出登录      → 清除 token，跳转 /teacher/login
```

### 5.2 顶栏

- 左侧：当前页面名称
- 右侧：教师头像 + "教师账号"文字

### 5.3 鉴权逻辑

- 简单 localStorage 检查 `teacher_token`
- 无 token 时自动重定向到 `/teacher/login`
- 登录页不显示壳层

---

## 6. 样式规范

完全复用学生端设计系统：

| 元素 | 规范 |
|------|------|
| 卡片 | ProtoCard（rounded-12px, border-line, bg-white, shadow-md） |
| 标签 | Pill（blue/green/orange/red/purple） |
| 按钮 | ProtoButton（primary/secondary/tertiary/ghost） |
| 页头 | PageHead（eyebrow + title + description + chips） |
| 主色 | #2563eb（蓝）|
| 背景 | #f6f8fb + gongzuotai-bg.png |
| 字体 | DM Sans + Noto Sans SC |
| 风险色 | 高危 #dc2626 / 预警 #f59e0b / 正常 #2563eb |

---

## 7. 数据流

```
教师端页面
    │ fetch /api/teacher/*
    ▼
FastAPI teacher.py
    │ 聚合 SQLite 真实数据 + 内存模拟数据
    ▼
返回 JSON → 前端渲染

AI 功能
    │ POST /api/teacher/ai/diagnose 或 /daily-report
    ▼
teacher.py → spark_lite.stream_chat_events()
    │ 注入学生数据作为 prompt context
    ▼
返回 AI 文本 → 前端展示
```

---

## 8. 访问方式

```bash
# 启动后端
cd D:\Project_building\SparkLearn\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 启动前端
cd D:\Project_building\SparkLearn\frontend
npm run dev

# 访问教师端
http://localhost:3000/teacher
# 演示账号：teacher / 123456

# 访问大屏（演示投影用）
http://localhost:3000/screen/index.html

# 访问学生端
http://localhost:3000
```

---

## 9. 验收标准

### 功能验收
- [ ] `/teacher/login` 可正常登录，错误密码有提示
- [ ] `/teacher/dashboard` 显示班级核心指标和风险学生
- [ ] AI 日报可正常生成（后端启动时）
- [ ] `/teacher/students` 显示9名学生卡片，筛选功能正常
- [ ] `/teacher/students/[id]` 显示学生详情和掌握度
- [ ] AI 诊断可正常生成建议
- [ ] `/teacher/interventions` 显示风险学生，状态可切换
- [ ] `/teacher/ai` 对话功能正常，快捷问题可点击
- [ ] `/teacher/reports` 显示班级报告数据
- [ ] 侧边栏导航全部可跳转，active 状态正确
- [ ] 退出登录后跳转到登录页

### 样式验收
- [ ] 与学生端视觉风格一致（白色卡片、蓝色主色、圆角阴影）
- [ ] 响应式：1360px 以下内容不溢出
- [ ] 风险学生颜色区分正确（红/橙/绿）

### 隔离验收
- [ ] 教师端和学生端路由完全独立
- [ ] 教师端有自己的侧边栏，不显示学生端导航
- [ ] 学生端侧边栏有"教师工作台"入口

---

## 10. 后续规划

- 教师端真实账号体系（数据库存储，JWT 鉴权）
- 干预操作写入数据库（发送提醒、推送资源）
- 教师端与大屏数据联动（大屏实时展示教师操作结果）
- 多班级管理
- 教师端移动端适配
