 # REFACTOR_HOME.md

## 背景与目标

本次重构面向首页仪表盘 `/`，参考图为 `d:/Office_File/other/SparkLearn/image/1280X1280 (2).PNG`。目标是在不改动业务数据流、接口调用、状态管理和任务点击逻辑的前提下，优化首页背景、控件质感，并将原“学习画像”标签展示替换为 ECharts 5.x 雷达图。

## 设计决策矩阵（抠图 vs 重绘、控件微调细则）

| 决策项 | 方案 A：直接抠图复用 | 方案 B：基于色彩重绘 | 结论 |
| --- | --- | --- | --- |
| 背景来源 | 从参考图裁取右侧波纹与插画区域，规避文字 UI | 使用 SVG/canvas 重绘渐变、波纹、颗粒 | 采用方案 A |
| 色差 | 抽样平均 Delta E 0.74，最大 Delta E 1.27 | 抽样平均 Delta E 16.42 | 方案 A 满足 Delta E <= 3 |
| 纹理颗粒 | 差异 5.44% | 差异 94.97% | 方案 A 满足 10% 内 |
| 体积 | `frontend/public/home-refactor-bg.webp`：26,308 bytes | 约 3.5 kB 但感知不一致 | 方案 A 满足 <= 250 kB |
| 版权与复用 | 使用用户提供参考图局部，作为项目静态背景 | 完全重绘 | 当前项目内复用 |

控件微调：

| Token / 规则 | 值 | 落点 |
| --- | --- | --- |
| `--home-focus-blue` | `#1890FF` | `input:focus`, `textarea:focus`, `select:focus` |
| 圆角 | `6px` | 首页卡片、`Button` 基础圆角 |
| 主按钮内阴影 | `inset 0 0 8px rgba(0,0,0,0.15)` | `frontend/src/components/ui/Button.tsx` primary variant |
| 输入框焦点动画 | `border-color 200ms ease-out, box-shadow 200ms ease-out` | `frontend/src/app/globals.css` |
| 雷达网格线透明度 | `rgba(24,144,255,0.15)` | `UserRadar` ECharts option |
| 雷达动画 | `600ms cubicOut` | `animationDuration(Update)` |

## 功能零侵入保障清单（DOM、事件、测试三不变原则）

- DOM 保持：未新增或改写已有 `id`、`name`、`data-testid`。
- 事件保持：`fetchData()`、`TaskItemRow` 的 `onToggle`、侧栏状态逻辑未改名、未改参数、未改返回值。
- 数据流保持：仍通过 `api.getTodayTasks()`、`api.getDashboardStats()`、`api.getRecentResources()`、`api.getProfile()`、`api.getContributionData()`、`api.getMasteryData()` 拉取原数据。
- 状态保持：`tasks`、`stats`、`recentResources`、`profile`、`contributions`、`mastery`、`loading`、`error` 状态未重构。
- 样式层改动：新增背景静态资源、按钮视觉样式、输入 focus 样式、首页卡片圆角/阴影、雷达图展示组件。

## 雷达图实时更新机制与性能优化要点

组件：`frontend/src/components/dashboard/UserRadar.tsx`

- 技术：`echarts@^5.6.0`，按需注册 `RadarChart`、`TooltipComponent`、`GridComponent`、`CanvasRenderer`。
- 维度：活跃度、忠诚度、购买力、兴趣广度、社交影响力。
- 更新：`setInterval(..., 3000)`，满足更新间隔 <= 3s。
- 动画：`animationDuration` 与 `animationDurationUpdate` 均为 `600`。
- 日志：任一维度变化超过 5% 时，输出 `console.info('[UserRadar] dimension changed over 5%', ...)`。
- 性能：使用 `ResizeObserver` 响应容器变化，卸载时清理 interval、observer 和 ECharts 实例，避免主线程常驻压力和内存泄露。

## 可复用流程模板（Checklist、Code Review 模板、自动化脚本）

### Checklist

- [x] 背景资源 WebP <= 250 kB。
- [x] 背景抽样 Delta E <= 3。
- [x] 纹理差异 <= 10%。
- [x] 控件圆角统一到 6 px。
- [x] 主按钮具备 8 px / 0.15 内阴影。
- [x] 输入框 focus 使用 `#1890FF` 和 `200ms ease-out`。
- [x] 学习画像区域替换为 ECharts 雷达图。
- [x] 不改接口调用与任务切换逻辑。
- [x] TypeScript 检查通过。
- [x] 目标文件 ESLint 通过。
- [x] 生产构建通过。
- [ ] Lighthouse 视觉一致性评分在 CI 环境执行并归档。

### Code Review 模板

```md
## UI Refactor Review
- Scope: 样式/模板层 / 数据流是否零侵入
- Background: WebP 体积、Delta E、纹理差异
- Controls: 圆角、阴影、focus、过渡动画
- Radar: ECharts 版本、5 维指标、3s 更新、600ms 动画、>5% 日志
- Compatibility: Chrome >= 90 / Safari >= 13 / Edge >= 90 / Firefox >= 88
- Performance: FCP / LCP / CLS / 新增 CSS gzip
```

### CLI 命令

```bash
cd frontend
npm install echarts@^5
npx tsc --noEmit --pretty false
npx eslint "src/app/(shell)/page.tsx" src/components/dashboard/UserRadar.tsx src/components/ui/Button.tsx
npm run build
```

背景指标复核脚本（需本地临时可用 `sharp`）：

```bash
cd frontend
npm install --no-save sharp
node scripts/check-home-bg.js
```

### CI 自动走查脚本

```yaml
name: ui-refactor-check
on: [pull_request]
jobs:
  visual-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd frontend && npm ci
      - run: cd frontend && npx tsc --noEmit --pretty false
      - run: cd frontend && npx eslint "src/app/(shell)/page.tsx" src/components/dashboard/UserRadar.tsx src/components/ui/Button.tsx
      - run: cd frontend && npm run build
      - run: cd frontend && npx lighthouse http://localhost:3000 --preset=desktop --only-categories=performance,best-practices --output=json --output-path=../artifacts/lighthouse-home.json
```

### Sketch/Figma 样式变量表

| Name | Value |
| --- | --- |
| `home/bg/start` | `#F8FBFF` |
| `home/bg/mid` | `#EEF5FF` |
| `home/bg/end` | `#E1ECFF` |
| `control/focus` | `#1890FF` |
| `control/radius` | `6px` |
| `control/primaryInnerShadow` | `inset 0 0 8px rgba(0,0,0,0.15)` |
| `radar/gridLine` | `rgba(24,144,255,0.15)` |
| `radar/fill` | `rgba(24,144,255,0.22)` |
| `radar/stroke` | `#1890FF` |

## 视觉走查报告

参考图：`d:/Office_File/other/SparkLearn/image/1280X1280 (2).PNG`

本次资源：`frontend/public/home-refactor-bg.webp`

| 检查项 | 结果 |
| --- | --- |
| 页面 `/` HTTP 状态 | 200 |
| 背景 `/home-refactor-bg.webp` HTTP 状态 | 200 `image/webp` |
| 背景体积 | 26,308 bytes |
| 抽样平均 Delta E | 0.74 |
| 抽样最大 Delta E | 1.27 |
| 纹理颗粒差异 | 5.44% |
| TypeScript | `npx tsc --noEmit --pretty false` 通过 |
| ESLint | 目标文件通过 |
| Build | `npm run build` 通过（提升权限后联网拉取 Google Fonts） |
| 全量 ESLint | 未通过，阻塞项来自既有文件：`src/lib/api/real.ts` 的 `any`、`src/app/(shell)/generate/page.tsx` 与 `src/lib/hooks/useMediaQuery.ts` 的 `set-state-in-effect` 等 |
| Lighthouse | 当前本地未安装 Lighthouse；已提供 CI 命令，建议在 PR 流水线归档 JSON 报告 |
| FCP / LCP / CLS | 当前环境未完成 Lighthouse 采集；验收以 CI 报告为准 |

## 变更文件

- `frontend/src/app/(shell)/page.tsx`：首页背景接入、卡片圆角/阴影微调、学习画像区域接入雷达图。
- `frontend/src/components/dashboard/UserRadar.tsx`：新增 ECharts 雷达图组件。
- `frontend/src/components/ui/Button.tsx`：圆角与主按钮内阴影调整。
- `frontend/src/app/globals.css`：输入控件 focus 样式。
- `frontend/public/home-refactor-bg.webp`：参考图局部复用背景。
- `frontend/package.json` / `frontend/package-lock.json`：新增 `echarts@^5.6.0`。

## 验收记录

- 作者：Codex
- 评审人：TBD
- MR 编号：TBD
- 日期：2026-04-29
