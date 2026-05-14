# SparkLearn 项目 Bug 与问题清单

> 审查日期：2026-05-14  
> 审查范围：前端（Next.js 16 + React 19）、后端（FastAPI）、导航系统、API 调用

---

## 一、严重 Bug（会导致功能异常）

### 1. 学习报告页 AI 摘要使用了错误的环境变量名

| 项目 | 内容 |
|------|------|
| 文件 | `frontend/src/app/(shell)/report/page.tsx` 第 112 行 |
| 问题 | 使用了 `NEXT_PUBLIC_API_BASE`（缺少 `_URL` 后缀） |
| 影响 | 部署后 AI 摘要功能会请求错误地址，导致功能失效 |
| 优先级 | **P0** |

```typescript
// ❌ 错误
const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/api/report/ai-summary`, ...)

// ✅ 正确
const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'}/api/report/ai-summary`, ...)
```

---

### 2. 后端 `get_dashboard_stats` 使用了脆弱的循环导入

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/routes/learning.py` 第 334 行 & 第 614 行 |
| 问题 | 通过文件末尾延迟导入 + `# type: ignore` 解决循环依赖 |
| 影响 | 如果 `tutor_eval.py` 加载失败，dashboard stats 接口会崩溃，错误信息不明确 |
| 优先级 | **P1** |

```python
# 第 334 行
report = await get_evaluation_report()  # type: ignore[name-defined]

# 第 614 行（文件末尾）
from .tutor_eval import get_evaluation_report  # noqa: E402
```

**建议修复**：将 `get_evaluation_report` 的核心逻辑抽取到独立模块，避免循环依赖。

---

### 3. 侧边栏宽度不响应折叠状态

| 项目 | 内容 |
|------|------|
| 文件 | `frontend/src/components/layout/Sidebar.tsx` 第 66 行 |
| 问题 | Sidebar 接收 `state` prop 但始终渲染固定宽度 `w-[220px]` |
| 影响 | 折叠模式（icons/collapsed）完全不生效，侧边栏永远占据 220px |
| 优先级 | **P1** |

```tsx
// ❌ 当前：始终 220px
<div className="fixed left-0 top-0 z-20 h-screen w-[220px] ...">

// ✅ 应该根据 state 动态设置宽度
<div className={`fixed left-0 top-0 z-20 h-screen transition-all duration-300 ${
  state === 'expanded' ? 'w-[220px]' : state === 'icons' ? 'w-[74px]' : 'w-0 overflow-hidden'
} ...`}>
```

---

## 二、导航/跳转问题

### 4. 侧边栏缺少多个已存在页面的入口

| 页面 | 路径 | 当前可达方式 | 严重程度 |
|------|------|-------------|---------|
| 复习计划 | `/loop` | **完全无法到达**（无任何链接指向它） | 🔴 严重 |
| 视频中心 | `/video` | 仅从资源生成完成后的"前往视频页面"按钮 | 🟡 中等 |
| 智能辅导 | `/tutor` | 仅从复习计划页底部按钮 + AI 助手"学习空间"按钮 | 🟡 中等 |
| 资源库 | `/resources` | 首页/画像页/练习页多处按钮，但侧边栏无入口 | 🟡 中等 |
| 答题记录 | `/practice/records` | **完全无法到达**（无任何链接指向它） | 🔴 严重 |

**建议修复**：在侧边栏 `NAV_ITEMS` 中添加缺失的导航项。

---

### 5. `/resources` 和 `/generate` 页面功能重叠且导航混乱

| 项目 | 内容 |
|------|------|
| 问题描述 | 侧边栏"资源中心"指向 `/generate`（生成+资源库合一），但首页、画像页、练习页等多处按钮链接到独立的 `/resources` 页面 |
| 用户困惑 | `/generate` 内部有"资源库"tab，`/resources` 是独立的资源库页面，功能完全重复 |
| 优先级 | **P1** |

**建议修复方案**（二选一）：
- 方案 A：删除独立的 `/resources` 页面，所有链接改为 `/generate` 并自动切换到资源库 tab
- 方案 B：在侧边栏添加 `/resources` 入口，将 `/generate` 专注于生成功能

---

### 6. 退出登录功能缺失

| 项目 | 内容 |
|------|------|
| 文件 | `frontend/src/components/layout/Sidebar.tsx` 底部用户区域 |
| 问题 | 底部用户卡片使用了 `LogOut` 图标，但实际链接到 `/profile/settings`（个人设置），不是退出登录 |
| 影响 | 用户无法退出登录，也无法从主应用进入 `/auth` 登录页 |
| 优先级 | **P1** |

---

### 7. `/auth` 和 `/onboarding` 页面无入口

| 项目 | 内容 |
|------|------|
| 问题 | 没有任何页面链接到 `/auth`（登录页），只有 auth 页面登录成功后跳转到 `/onboarding` |
| 影响 | 用户无法从主应用退出并重新登录，也无法重新进入引导流程 |
| 优先级 | **P2** |

---

## 三、代码质量问题

### 8. Path 页面混用 raw fetch 和 API 客户端

| 项目 | 内容 |
|------|------|
| 文件 | `frontend/src/app/(shell)/path/page.tsx` 第 149 行 |
| 问题 | `handleRegeneratePath` 直接使用 `fetch()` 而不是已有的 `api.generatePathPlanning()` |
| 影响 | 错误处理不一致，绕过了 API 客户端的统一错误提示逻辑 |
| 优先级 | **P2** |

```typescript
// ❌ 当前：直接 fetch
const response = await fetch(
  `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'}/api/path-planning/generate`,
  { method: 'POST', ... }
)

// ✅ 应该使用 API 客户端
const data = await api.generatePathPlanning(targetInput)
```

---

### 9. 主题切换按钮无实际效果

| 项目 | 内容 |
|------|------|
| 文件 | `frontend/src/components/ui/ThemeSwitch.tsx` |
| 问题 | 按钮可以点击，内部状态会变化，但不会实际切换页面主题（有 TODO 注释） |
| 影响 | 用户点击后无视觉反馈，以为功能坏了 |
| 优先级 | **P2** |

**建议**：要么实现完整的主题切换，要么暂时隐藏该按钮。

---

### 10. Onboarding 页面有未使用的导入

| 项目 | 内容 |
|------|------|
| 文件 | `frontend/src/app/onboarding/page.tsx` |
| 问题 | `Target` 和 `Clock` 从 lucide-react 导入但从未使用 |
| 影响 | TypeScript 警告，增加 bundle 体积 |
| 优先级 | **P3** |

---

### 11. 孤立文件 `page-new.tsx`

| 项目 | 内容 |
|------|------|
| 文件 | `frontend/src/app/(shell)/path/page-new.tsx` |
| 问题 | 未使用的替代实现文件，可能是开发过程中的遗留 |
| 影响 | 增加项目复杂度，可能造成混淆 |
| 优先级 | **P3** |

---

## 四、潜在风险

### 12. CORS 配置不一致

| 项目 | 内容 |
|------|------|
| 问题 | 后端 `config.py` 中 `cors_origin = "http://localhost:3000"`，`main.py` 额外添加了 `"http://127.0.0.1:3000"`，但前端 fallback 地址混用 `localhost` 和 `127.0.0.1` |
| 影响 | `localhost` 和 `127.0.0.1` 在浏览器中被视为不同源，部分请求可能被 CORS 拦截 |
| 优先级 | **P2** |

**涉及文件**：
- `backend/app/config.py`：`cors_origin = "http://localhost:3000"`
- `backend/app/main.py`：额外允许 `"http://127.0.0.1:3000"`
- `frontend/src/lib/api/real.ts`：fallback `http://127.0.0.1:8000`
- `frontend/src/app/(shell)/report/page.tsx`：fallback `http://localhost:8000`

---

### 13. 多个页面缺少错误处理 UI

| 页面 | 文件 | 问题 |
|------|------|------|
| 复习计划 | `(shell)/loop/page.tsx` | API 失败时静默显示空列表，无错误提示 |
| 错题本 | `(shell)/practice/mistakes/page.tsx` | 无 loading 状态，无错误提示 |
| 收藏题目 | `(shell)/practice/favorites/page.tsx` | 无 loading 状态，无错误提示 |
| 视频中心 | `(shell)/video/page.tsx` | 无错误提示 UI |

---

## 五、修复优先级总览

| 优先级 | 问题编号 | 描述 |
|--------|---------|------|
| **P0** | #1 | 环境变量名错误导致 AI 摘要失效 |
| **P0** | #4 (部分) | `/loop` 和 `/practice/records` 完全无法到达 |
| **P1** | #2 | 后端循环导入风险 |
| **P1** | #3 | 侧边栏折叠不生效 |
| **P1** | #4 (部分) | 多个页面缺少侧边栏入口 |
| **P1** | #5 | 资源页面功能重叠 |
| **P1** | #6 | 退出登录功能缺失 |
| **P2** | #7 | auth/onboarding 无入口 |
| **P2** | #8 | API 调用不一致 |
| **P2** | #9 | 主题切换无效果 |
| **P2** | #12 | CORS 配置不一致 |
| **P2** | #13 | 缺少错误处理 UI |
| **P3** | #10 | 未使用的导入 |
| **P3** | #11 | 孤立文件 |

---

## 六、UX/UI 一致性与交互问题（验收标准视角）

> 以下问题基于端到端验收标准发现：遵循用户流程逐步交互，检查文字挤压、表述不一致、信息密度、圆角阴影样式不一致、无用信息等。

### 14. 跨页面圆角（border-radius）不一致

| 页面/组件 | 使用的圆角值 | 设计系统定义 |
|-----------|-------------|-------------|
| ProtoCard | `rounded-[12px]` | ✅ 符合 `--radius-lg: 12px` |
| SoftCard | `rounded-[10px]` | ✅ 符合 `--radius-md: 10px` |
| ProtoButton | `rounded-[8px]` | ✅ 符合 `--radius-sm: 8px` |
| **Path 页面卡片** | `rounded-[14px]` | ⚠️ 使用了 `--radius-xl` 但其他页面卡片都是 12px |
| **Auth 登录卡** | `border-radius: 34px` | ❌ 完全脱离设计系统 |
| **Auth 特性卡** | `border-radius: 24px` | ❌ 不在设计系统中 |
| **Auth 输入框** | `border-radius: 14px` | ⚠️ 与其他页面输入框 10px 不一致 |
| **Auth 提交按钮** | `border-radius: 17px` | ❌ 不在设计系统中 |
| **Onboarding 主卡** | `rounded-2xl`（16px） | ⚠️ 不在设计系统中 |

**影响**：用户在不同页面间切换时，视觉语言不统一，降低品牌一致性。

---

### 15. 跨页面阴影（shadow）不一致

| 页面 | 阴影值 | 问题 |
|------|--------|------|
| ProtoCard（设计系统） | `shadow-md`（`0 4px 16px rgba(15,23,42,.04)`） | ✅ 基准 |
| Path 页面 | `shadow-sm` | ⚠️ 比其他页面卡片浅 |
| Auth 登录卡 | `0 28px 85px rgba(28,86,145,.16)` | ❌ 完全不同的阴影体系 |
| Onboarding | `shadow-lg shadow-black/[0.03]` | ⚠️ 混合使用 |

---

### 16. 主色调不一致（跨页面）

| 位置 | 使用的蓝色 | 设计系统 |
|------|-----------|---------|
| 全局设计系统 | `#2563eb` | ✅ 基准 |
| Auth 页面 | `#0b74ff` | ❌ 不同的蓝色 |
| Auth 按钮渐变 | `#075ff0 → #5aa2ff` | ❌ 不同的蓝色 |
| Onboarding 完成步骤 | `#34c759`（iOS 绿） | ⚠️ 与设计系统 `#16a34a` 不同 |

**影响**：Auth 页面和主应用看起来像两个不同的产品。

---

### 17. 排版体系不一致（跨页面）

| 页面 | 使用的字号体系 | 问题 |
|------|--------------|------|
| Shell 页面（首页、画像等） | `text-h1`/`text-h2`/`text-small`/`text-micro` | ✅ 设计系统 |
| **Path 页面** | `text-3xl`/`text-lg`/`text-sm`/`text-xs`（Tailwind 默认） | ❌ 完全不同的字号体系 |
| **Auth 页面** | `66px`/`28px`/`15px`/`13px`（CSS 像素值） | ❌ 第三套字号体系 |
| **Video 页面** | `text-h1`/`text-body`/`text-caption` | ⚠️ 混用设计系统和 UI 库 |

---

### 18. 术语/表述不一致（跨页面）

| 概念 | 页面 A 的表述 | 页面 B 的表述 | 问题 |
|------|-------------|-------------|------|
| 资源管理 | "资源中心"（侧边栏/generate 页） | "资源库"（resources 页） | 用户不知道哪个是哪个 |
| 练习 | "练习评测"（practice 页标题） | "练习题"（generate 页类型选择） | 同一功能两种叫法 |
| 导航分类 | "分析与反馈"（loop 页 eyebrow） | "分析与反馈"（侧边栏只有"学习报告"） | loop 页属于此分类但侧边栏没有 |
| AI 助手 | "小星同学"（AI 悬浮窗） | "AI 导师"（tutor 页） | 同一个 AI 两种称呼 |
| 薄弱点 | "函数返回值"（全站硬编码） | 动态数据 | 多处硬编码同一个薄弱点，不随用户变化 |

---

### 19. 死按钮/无响应交互（点击无反应）

| 页面 | 元素 | 问题 |
|------|------|------|
| Path 页面 | "开始今日路径"按钮 | 无 `onClick` 也无 `href`，点击无反应 |
| Path 页面 | "调整目标"按钮 | 无 `onClick` 也无 `href`，点击无反应 |
| Path 页面 | "学习当前节点资源"按钮 | 无 `onClick` 也无 `href`，点击无反应 |
| Path 页面 | "进入当前节点练习"按钮 | 无 `onClick` 也无 `href`，点击无反应 |
| Path 页面 | "生成补弱资源"按钮 | 无 `onClick` 也无 `href`，点击无反应 |
| Profile 页面 | "告诉 AI 你想怎么学"对话框的"发送"按钮 | 无 `onClick`，点击无反应 |
| Resources 页面 | "让 AI 讲解"按钮 | 无 `onClick` 也无 `href`，点击无反应 |
| Auth 页面 | "忘记密码？"链接 | 只弹 toast 说"暂未接入"，无实际功能 |
| Auth 页面 | 《用户协议》《隐私政策》链接 | `href="#"` + `preventDefault()`，无实际内容 |

---

### 20. 信息密度与排版问题

| 页面 | 问题 | 严重程度 |
|------|------|---------|
| Path 页面 SummaryBar | 5 列信息挤在一行，小屏幕无响应式处理（无 `max-[...]` 断点） | 🟡 中等 |
| Path 页面节点 | 节点卡片固定 168×72px，长标题会被 `line-clamp-2` 截断，用户无法看到完整内容 | 🟡 中等 |
| Practice 页面右侧栏 | 320px 宽度内塞了生成控件+进度网格+统计卡片，信息密度过高 | 🟡 中等 |
| Report 页面月视图 | 30 行×24 列热力图，每个格子仅 8px 宽，几乎无法点击或辨认 | 🟡 中等 |
| Homepage 统计条 | 4 列统计在 `max-[760px]` 变为 2 列，但每列内文字仍然挤压（`text-[20px]` + `text-micro` 双行） | 🟠 轻微 |

---

### 21. 硬编码内容/噪音信息

| 位置 | 问题 |
|------|------|
| 所有资源卡片 | "关联薄弱点：函数返回值" 硬编码，不随实际薄弱点变化 |
| 所有资源卡片 | "学习进度 42%" 硬编码（`selected.progress ?? 42`），不是真实数据 |
| Profile 页面 | "李明 · 项目实践准备期" 硬编码用户名 |
| Sidebar 底部 | "李" 头像字母硬编码 |
| Homepage | "12 天" 连续学习天数硬编码，不从 API 获取 |
| Report 页面 | 热力图数据完全随机生成（`Math.random()`），每次刷新都变 |
| Report 页面 | "高效时段 20:00-22:00" 硬编码 |
| Loop 页面 | 三天计划内容完全硬编码，不从 API 获取 |

---

### 22. 组件库分裂（两套 UI 系统并存）

| 页面 | 使用的组件库 | 问题 |
|------|-------------|------|
| Shell 页面（首页、画像、练习等） | `@/components/proto`（ProtoCard, SoftCard, Pill, ProtoButton） | ✅ 主设计系统 |
| **Video 页面** | `@/components/ui`（Card, Button, Badge, Skeleton, ErrorState, EmptyState） | ❌ 完全不同的组件库 |
| **Tutor 页面** | 无组件库，全部内联样式 | ❌ 第三种风格 |
| **Path 页面** | 无组件库，全部内联样式 + 硬编码颜色 | ❌ 第四种风格 |

**影响**：同一个应用内存在 4 种不同的视觉风格，用户在页面间切换时体验割裂。

---

### 23. 移动端适配问题

| 页面 | 问题 |
|------|------|
| Path 页面 SummaryBar | 无任何响应式断点，5 列布局在移动端会严重挤压 |
| Path 页面 PathCircuitCard | 节点行使用 `overflow-x-auto`，但无滚动提示，用户不知道可以横滑 |
| Auth 页面 | 在 `max-width: 560px` 下表单可用，但左侧介绍区域仍然很拥挤 |
| Tutor 页面 | 三栏布局（200px + 280px + 主区域），在 1200px 以下右侧面板隐藏，但中间对话列表仍占 280px |
| Practice 页面 | `grid-cols-[1fr_320px]` 在 `max-[980px]` 变为单列，但右侧栏内容过多导致页面很长 |

---

### 24. 后端 AI 接口边界情况

| 接口 | 边界情况 | 问题 |
|------|---------|------|
| `/api/quiz`（题目生成） | LLM 超时设为 3 秒 | 如果网络慢，3 秒可能不够，会静默回退到预设题库，用户无感知 |
| `/api/quiz/submit`（判题） | 填空题 LLM 辅助判题超时 5 秒 | 超时后直接判错，可能误判正确答案 |
| `/api/path-planning/generate` | LLM 返回格式不对 | 静默回退到空 phases，前端不会更新路径图，用户以为没反应 |
| `/api/tutor/chat`（研讨会模式） | 多轮讨论无总轮次上限 | `_rounds_for_complexity` 最多 5 轮，但每轮有多个 agent，总 LLM 调用可能 20+ 次 |
| `/api/report/ai-summary` | 无输入长度限制 | profile 数据可能很长，prompt 可能超出模型 token 限制 |

---

### 25. 无用/冗余代码

| 文件 | 问题 |
|------|------|
| `path/page.tsx` | `TopBar` 组件定义了但从未渲染（Shell Layout 已有 Topbar） |
| `path/page.tsx` | `AIFloatingButton` 组件定义了但从未渲染（Shell Layout 已有 AIAssistant） |
| `path/page.tsx` | `TurnLine` 组件定义了但从未使用 |
| `practice/page.tsx` | 导入了 `Target` 和 `TrendingUp` 但 chips 区域使用了不同的渲染方式（非 PageHead） |
| `report/page.tsx` | `formatDate` 函数定义了但从未调用 |
| `report/page.tsx` | `reportLoading` state 定义了但从未使用 |

---

## 七、修复优先级总览（更新版）

| 优先级 | 问题编号 | 描述 |
|--------|---------|------|
| **P0** | #1 | 环境变量名错误导致 AI 摘要失效 |
| **P0** | #4 (部分) | `/loop` 和 `/practice/records` 完全无法到达 |
| **P0** | #19 | Path 页面 5 个按钮点击无反应 |
| **P1** | #2 | 后端循环导入风险 |
| **P1** | #3 | 侧边栏折叠不生效 |
| **P1** | #4 (部分) | 多个页面缺少侧边栏入口 |
| **P1** | #5 | 资源页面功能重叠 |
| **P1** | #6 | 退出登录功能缺失 |
| **P1** | #18 | 术语表述不一致 |
| **P1** | #22 | 组件库分裂（4 种风格并存） |
| **P2** | #7 | auth/onboarding 无入口 |
| **P2** | #8 | API 调用不一致 |
| **P2** | #9 | 主题切换无效果 |
| **P2** | #12 | CORS 配置不一致 |
| **P2** | #13 | 缺少错误处理 UI |
| **P2** | #14 | 圆角不一致 |
| **P2** | #15 | 阴影不一致 |
| **P2** | #16 | 主色调不一致 |
| **P2** | #17 | 排版体系不一致 |
| **P2** | #20 | 信息密度问题 |
| **P2** | #21 | 硬编码内容 |
| **P2** | #23 | 移动端适配 |
| **P2** | #24 | AI 接口边界情况 |
| **P3** | #10 | 未使用的导入 |
| **P3** | #11 | 孤立文件 |
| **P3** | #25 | 冗余代码 |

---

## 八、快速修复清单（可立即执行）

- [ ] 修复 `report/page.tsx` 中的环境变量名：`NEXT_PUBLIC_API_BASE` → `NEXT_PUBLIC_API_BASE_URL`
- [ ] 在侧边栏 `NAV_ITEMS` 中添加"复习计划"（`/loop`）入口
- [ ] 在练习页头部添加"答题记录"按钮链接到 `/practice/records`
- [ ] 删除 `onboarding/page.tsx` 中未使用的 `Target` 和 `Clock` 导入
- [ ] 删除或归档 `path/page-new.tsx`
- [ ] 将 `path/page.tsx` 中的 raw fetch 替换为 `api.generatePathPlanning()`
