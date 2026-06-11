# Onboarding 页面视觉重构说明文档

本页面已按照参考设计图进行了完整的视觉重构，保持了原有的交互逻辑与功能，同时采用了项目现有的技术栈（React 19 + Next.js 16 + Tailwind CSS v4）。

## 1. 颜色变量映射 (Colors)

所有颜色均使用 `globals.css` 中定义的 CSS 变量，并通过 Tailwind CSS 引用：

| 变量名 | 颜色值 | 用途 |
| :--- | :--- | :--- |
| `--color-blue` | `#0071e3` | 主品牌色、主要按钮、进度指示器 |
| `--color-purple` | `#af52de` | 辅助色、AI 气泡渐变 |
| `--color-success` | `#34c759` | 成功状态、特定选项卡片背景 |
| `--color-warning` | `#ff9500` | 警告状态、特定选项卡片背景 |
| `--color-ink` | `#1d1d1f` | 正文标题、强调文本 |
| `--color-ink-secondary` | `#6e6e73` | 次级文本、描述文字 |
| `--color-bg-card` | `#ffffff` | 卡片背景色 |
| `--color-bg-hover` | `#f5f5f7` | 悬停状态背景 |

## 2. 字体规格 (Typography)

采用系统默认字体族，配合 Tailwind 的字号定义：

- **标题 (H1)**: `text-[32px]` (Desktop) / `text-[28px]` (Mobile), `font-bold`, `tracking-tight`
- **副标题**: `text-body` (15px), `text-ink-secondary`
- **卡片标题**: `text-base` (16px), `font-semibold`
- **正文**: `text-body` (15px)
- **标签/页脚**: `text-xs` (12px), `font-medium`

## 3. 断点规则 (Breakpoints)

响应式布局遵循以下断点规则：

- **Mobile (Default)**: 单列布局，水平边距 `px-6`，卡片网格 `grid-cols-1`。
- **Desktop (md: 768px+)**: 
  - 容器最大宽度 `max-w-[1000px]`。
  - 选项卡片切换为双列布局 `grid-cols-2`。
  - 显示 AI 助手引导区域（左侧）。
  - 显示页脚提示信息。

## 4. 视觉层次与组件

- **StepIndicator**: 采用胶囊型背景，动态计算宽度与位置，配合缩放动画。
- **OptionCard**: 增加了图标背景圆角、右侧箭头指示、以及选中状态的描边与阴影效果。
- **Animations**: 使用 `animate-fade-in-up` 实现组件入场动画，增加视觉流畅度。

## 6. 视觉细节优化 (2026-04-25 更新)

### 靶心图标一致性 (Target Icon)
- **实现方式**: 将原本仅在第一步显示的 `Target` 插画组件改为全步骤固定展示。
- **定位逻辑**: 放置在 `flex justify-between` 布局的右侧，确保在所有 5 个页面中位置、尺寸（48x48 容器，80px 图标）完全一致，增强品牌视觉锚点。

### 选项背景色优化 (Option Card Backgrounds)
- **配色策略**: 弃用单一白色/灰色背景，引入低饱和度（<30%）的浅色系配色方案。
- **色彩变量映射**:
  - **Blue**: `bg-blue/[0.03]` (默认) / `bg-blue/5` (选中)
  - **Purple**: `bg-purple/[0.03]` (默认) / `bg-purple/5` (选中)
  - **Green**: `bg-success/[0.03]` (默认) / `bg-success/5` (选中)
  - **Orange**: `bg-warning/[0.03]` (默认) / `bg-warning/5` (选中)
- **实现逻辑**: 通过 `getColorClasses` 函数统一管理 `icon` 和 `card` 的样式组合，确保选中态与非选中态的平滑过渡。

## 7. 可访问性说明 (Accessibility)

- **对比度**: 按钮文字与背景对比度均 ≥ 4.5:1（蓝底白字、白底黑字）。
- **语义化**: 使用 `h1`, `p`, `button`, `span` 等语义化标签。
- **焦点状态**: 使用 `focus-visible:ring` 确保键盘导航可见性。
- **响应式**: 适配 1920×1080、1440×900 及 375×812 (iPhone X) 视口。
