# SparkLearn 第三阶段：教师智能大屏集成说明

> 文档版本：v1.0  
> 生成日期：2026-05-21  
> 适用范围：SparkLearn 第三阶段教师端多端协同功能  
> 前置文档：`SparkLearn-第三阶段-移动端多端展示适配说明.md`

---

## 1. 本阶段目标

在第三阶段移动端适配基础上，新增 **教师智能大屏** 功能，实现教师视角的班级数据可视化与 AI 辅助决策。

**核心目标：**
- 将开源大屏模板（`Screen_demo`）改造为 SparkLearn 教育场景专属大屏
- 通过后端 API 注入真实学生数据（含模拟班级数据）
- 集成 Spark AI 生成班级日报与学生诊断建议
- 大屏可独立访问，也可从学生端侧边栏一键跳转

**本阶段不包含：**
- 教师账号体系与权限管理（演示阶段直接访问）
- 学生端与教师端的实时双向通信
- 教师布置作业、推送资源等写操作功能

---

## 2. 技术方案

### 2.1 大屏集成策略

大屏采用 **静态 HTML + ECharts + jQuery** 方案，原因：

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| 静态 HTML 托管于 Next.js public | 零构建成本，保留原始视觉风格 | 无 React 组件复用 | ✅ 选用 |
| 改写为 Next.js 页面 | 组件复用，类型安全 | 改造成本高，ECharts 集成复杂 | ❌ |
| iframe 嵌入 | 隔离性好 | 跨域通信复杂 | ❌ |

大屏文件放置于 `frontend/public/screen/`，Next.js 自动将 `public/` 目录下的文件作为静态资源服务，访问路径为 `/screen/index.html`。

### 2.2 数据架构

```
大屏 (HTML/JS)
    │  $.ajax GET /api/teacher/dashboard
    ▼
FastAPI 后端 (teacher.py)
    │  聚合真实用户数据 + 模拟班级数据
    ▼
SQLite (mastery_records, profiles, students, contribution_days)
    +
模拟学生数据（8人，内存生成）
```

**数据来源说明：**
- 真实数据：从 SQLite 读取 `single_user` 的掌握度、画像、贡献日历
- 模拟数据：8 名虚拟学生，覆盖不同阶段（基础语法→高级特性）、不同风险等级（正常/预警/高危）
- 合并后共 9 名学生，构成完整班级视图

### 2.3 AI 能力集成

复用现有 `spark_lite.stream_chat_events()` 接口，新增两个 AI 端点：

| 端点 | 功能 | Prompt 策略 |
|------|------|-------------|
| `POST /api/teacher/ai/daily-report` | 班级日报生成 | 注入活跃人数、正确率、风险学生名单 |
| `POST /api/teacher/ai/diagnose` | 单学生诊断 | 注入阶段、薄弱点、连续天数、风险等级 |

两个端点均有兜底逻辑：LLM 调用失败时返回基于规则的预设文案。

---

## 3. 文件变更清单

### 3.1 新增文件

```
backend/app/routes/teacher.py
    ├── GET  /api/teacher/dashboard        班级聚合数据（大屏主数据源）
    ├── GET  /api/teacher/students         学生列表
    ├── GET  /api/teacher/students/{id}    学生详情
    ├── POST /api/teacher/ai/diagnose      AI 学生诊断
    └── POST /api/teacher/ai/daily-report  AI 班级日报

frontend/public/screen/
    ├── index.html          大屏主页面（改造自 Screen_demo）
    ├── css/style.css       原始大屏样式（深蓝科技风）
    ├── css/bootstrap.css   Bootstrap 基础样式
    ├── img/                原始大屏图片资源（边框、背景等）
    └── js/
        ├── echarts.min.js  ECharts 图表库
        └── jquery.min.js   jQuery

frontend/src/app/(teacher)/teacher/page.tsx
    教师大屏入口页（跳转到 /screen/index.html）
```

### 3.2 修改文件

```
backend/app/main.py
    新增：from .routes.teacher import router as teacher_router
    新增：app.include_router(teacher_router)

frontend/src/components/layout/Sidebar.tsx
    新增导航项：教师大屏 → /teacher（图标：Monitor）
    新增导航分组：教师工具
```

---

## 4. 大屏功能模块

### 4.1 顶部导航栏
- 左侧：班级总览 / 学生详情 / 知识图谱 / 干预中心（Tab 切换，当前版本仅总览可用）
- 中间：标题 "SparkLearn · 教师智能大屏"
- 右侧：学生端入口 / 刷新数据 / AI日报 / 全屏

### 4.2 左栏：班级概况
| 模块 | 内容 |
|------|------|
| 班级核心指标 | 在班人数、今日活跃、平均正确率、平均学习时长、风险学生数 |
| AI 班级日报 | 点击"生成"调用 Spark AI，输出今日班级状态摘要 |
| 风险预警列表 | 高危（红）/ 预警（黄）学生，显示姓名、阶段、薄弱点、连续天数 |

### 4.3 中栏：图表区
| 图表 | 类型 | 数据 |
|------|------|------|
| 学习阶段分布 | 柱状图 | 各阶段学生人数 |
| 近7日活跃趋势 | 折线图+面积 | 每日活跃人数 |
| 各阶段平均掌握度 | 横向柱状图 | 全班各阶段均值，颜色区分优/中/差 |

右侧辅助指标：任务完成率、平均连续天数、今日活跃率

### 4.4 右栏：深度分析
| 模块 | 内容 |
|------|------|
| 全班薄弱知识点 TOP8 | 横向柱状图，颜色区分掌握度区间 |
| 班级掌握度雷达 | 五大阶段雷达图，展示班级整体能力分布 |
| 学生列表 | 姓名、当前阶段、答题正确率，风险学生高亮 |

### 4.5 交互功能
- **AI 日报**：点击顶部"AI日报"或左栏"生成"按钮，调用后端 AI 接口
- **刷新数据**：手动触发重新拉取所有图表数据
- **全屏模式**：调用浏览器 Fullscreen API
- **自动刷新**：每 5 分钟自动重新加载数据
- **离线兜底**：后端未启动时自动加载演示数据，大屏仍可正常展示

---

## 5. 模拟班级数据设计

8 名模拟学生覆盖以下场景：

| 学生 | 阶段 | 风险 | 特征 |
|------|------|------|------|
| 张明远 | 函数与模块 | 正常 | 中等水平，闭包薄弱 |
| 李晓雨 | 面向对象 | 正常 | 优秀学生，进度领先 |
| 王浩然 | 基础语法 | 预警 | 零基础，进度偏慢 |
| 陈思琪 | 高级特性 | 正常 | 班级最优，全面掌握 |
| 刘子轩 | 文件处理 | 正常 | 稳定进步，异常处理薄弱 |
| 赵雅婷 | 函数与模块 | **高危** | 5天未登录，断签 |
| 孙博文 | 基础语法 | **高危** | 4天未登录，基础极弱 |
| 周欣怡 | 面向对象 | 正常 | 良好，OOP建模薄弱 |

加上真实用户（`single_user`），共 9 人构成完整班级。

---

## 6. API 接口说明

### GET /api/teacher/dashboard

返回大屏所需的全部聚合数据，单次请求获取所有图表数据。

**响应结构：**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_students": 9,
      "active_today": 6,
      "active_rate": 0.667,
      "avg_quiz_accuracy": 0.742,
      "avg_total_hours": 26.3,
      "avg_task_completion": 0.706,
      "avg_streak_days": 10.4,
      "risk_count": 3
    },
    "stage_distribution": [
      {"stage": "基础语法", "count": 3},
      {"stage": "函数与模块", "count": 3},
      ...
    ],
    "stage_mastery": [
      {"stage": "基础语法", "avg_mastery": 0.78, "student_count": 3},
      ...
    ],
    "kp_mastery": {"1.1": 0.82, "1.2": 0.76, ...},
    "weak_kps": [
      {"id": "5.4", "name": "异步编程入门", "avg_mastery": 0.28},
      ...
    ],
    "activity_trend": [
      {"date": "2026-05-15", "active_count": 5},
      ...
    ],
    "risk_students": [...],
    "students": [...]
  }
}
```

### POST /api/teacher/ai/daily-report

无请求体，返回 AI 生成的班级日报文本。

### POST /api/teacher/ai/diagnose

```json
{"student_id": "stu_001"}
```

返回针对该学生的 AI 一句话诊断建议。

---

## 7. 访问方式

### 方式一：从学生端跳转
1. 启动前后端服务
2. 访问 `http://localhost:3000`
3. 侧边栏底部 → **教师工具** → **教师大屏**
4. 自动在新标签页打开大屏

### 方式二：直接访问
```
http://localhost:3000/screen/index.html
```

### 方式三：独立访问（不依赖 Next.js）
直接用浏览器打开文件：
```
D:\Project_building\SparkLearn\frontend\public\screen\index.html
```
> 注意：直接打开文件时，API 请求会因跨域失败，自动降级为演示数据模式。

---

## 8. 运行命令

```bash
# 后端（必须启动，否则大屏使用演示数据）
cd D:\Project_building\SparkLearn\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 前端
cd D:\Project_building\SparkLearn\frontend
npm run dev

# 访问大屏
http://localhost:3000/screen/index.html
```

---

## 9. 验收标准

### 9.1 大屏展示
- [ ] 大屏可通过 `/screen/index.html` 正常访问
- [ ] 六个图表（阶段分布、活跃趋势、阶段掌握度、薄弱知识点、雷达图、学生列表）全部正常渲染
- [ ] 班级核心指标（9项数字）正确显示
- [ ] 风险预警列表正确显示高危/预警学生，颜色区分
- [ ] 后端未启动时自动降级为演示数据，大屏不白屏

### 9.2 AI 功能
- [ ] 点击"AI日报"按钮，显示加载状态，返回 AI 生成文本
- [ ] AI 调用失败时显示兜底文案，不报错

### 9.3 交互
- [ ] 刷新数据按钮重新拉取 API
- [ ] 全屏按钮触发浏览器全屏
- [ ] 每5分钟自动刷新
- [ ] 窗口 resize 时图表自适应

### 9.4 集成
- [ ] 学生端侧边栏显示"教师大屏"入口
- [ ] 点击后在新标签页打开大屏
- [ ] 后端 `/api/teacher/dashboard` 接口返回正确数据结构

---

## 10. 已知限制与后续规划

### 当前限制
1. **单向数据流**：大屏只读，教师无法通过大屏操作学生数据
2. **无实时推送**：数据每5分钟轮询，非 WebSocket 实时
3. **模拟数据**：8名学生为内存生成，重启后数据不变
4. **无权限控制**：任何人访问 `/screen/index.html` 都能看到数据

### 后续规划（第四阶段）
- 教师账号体系（独立登录，角色隔离）
- WebSocket 实时数据推送
- 教师干预操作（发送提醒、推送资源）
- 多班级管理
- 大屏数据导出（PDF/截图）

---

## 11. 变更记录

| 日期 | 修改人 | 变更内容 |
|------|--------|---------|
| 2026-05-21 | AI 辅助 | 新增教师智能大屏集成，后端 teacher.py，大屏 HTML，侧边栏入口 |
