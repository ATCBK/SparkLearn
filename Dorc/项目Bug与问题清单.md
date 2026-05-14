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

## 六、快速修复清单（可立即执行）

- [ ] 修复 `report/page.tsx` 中的环境变量名：`NEXT_PUBLIC_API_BASE` → `NEXT_PUBLIC_API_BASE_URL`
- [ ] 在侧边栏 `NAV_ITEMS` 中添加"复习计划"（`/loop`）入口
- [ ] 在练习页头部添加"答题记录"按钮链接到 `/practice/records`
- [ ] 删除 `onboarding/page.tsx` 中未使用的 `Target` 和 `Clock` 导入
- [ ] 删除或归档 `path/page-new.tsx`
- [ ] 将 `path/page.tsx` 中的 raw fetch 替换为 `api.generatePathPlanning()`
