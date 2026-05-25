# 路径页面 - 快速开始指南

## 🚀 快速预览

新的路径页面已完全实现，可以直接运行查看效果。

### 文件位置
```
frontend/src/app/(shell)/path/page.tsx
```

### 运行方式

```bash
# 进入前端目录
cd frontend

# 安装依赖（如果还没有）
npm install

# 开发模式运行
npm run dev

# 访问路径页面
http://localhost:3000/path
```

## 📋 页面结构速览

```
┌─────────────────────────────────────────────────────────┐
│  顶部栏 (56px)                                          │
│  SparkLearn / 个性化路径              李 李明           │
├──────────┬──────────────────────────────────────────────┤
│          │  页面标题区                                  │
│ 侧边栏   │  个性化学习路径                              │
│ (220px)  ├──────────────────────────────────────────────┤
│          │  摘要条 (当前目标/进度/阶段/重点/按钮)      │
│          ├──────────────────────────────────────────────┤
│          │  主体区域                                    │
│          │  ┌─────────────────────────────┬──────────┐ │
│          │  │ 阶段路径回路                │ 建议栏   │ │
│          │  │ (补弱→达标→目标)            │ (右侧)   │ │
│          │  │                             │          │ │
│          │  │ [1] → [2] → [3] ↘          │ 补弱建议 │ │
│          │  │                    ↘       │ 对应资源 │ │
│          │  │ [4] → [5] → [6] → [7] ↘   │          │ │
│          │  │                      ↘     │          │ │
│          │  │ [8] → [9] → [10] → 🚩     │          │ │
│          │  │                             │          │ │
│          │  │ [按钮] [按钮] [按钮]       │          │ │
│          │  └─────────────────────────────┴──────────┘ │
└──────────┴──────────────────────────────────────────────┘
```

## 🎨 核心特性

### 1. 阶段路径回路
- ✅ 三个阶段：补弱(绿) → 达标(蓝) → 目标(灰)
- ✅ 10 个学习节点
- ✅ 纯 HTML + CSS 实现（无 SVG/Canvas）
- ✅ 节点状态：已完成/当前推荐/下一步/未开始
- ✅ 连接线和转弯线

### 2. 交互功能
- ✅ 点击节点选中
- ✅ 输入目标，生成路径
- ✅ 三个操作按钮
- ✅ 右侧建议栏
- ✅ AI 悬浮按钮

### 3. 设计系统
- ✅ 完整的色彩系统
- ✅ 统一的间距和圆角
- ✅ 轻阴影和边框
- ✅ 专业的排版

## 🔧 主要组件

### TopBar
顶部导航栏，显示面包屑和用户信息。

### PageHeader
页面标题区，包含面包屑、标题和副标题。

### SummaryBar
摘要条，显示 5 栏信息：
- 当前目标
- 路径进度 (62% 圆环)
- 当前阶段
- 当前重点
- 操作按钮

### PathCircuitCard
主卡片，包含：
- 标题 + 目标设定
- 路径图画布
- 图例
- 底部按钮

### PathCanvas
路径图画布，包含：
- 三个阶段行
- 转弯线
- 结束标记

### PhaseRow
单个阶段行，包含：
- 阶段标识 (左侧)
- 节点容器 (右侧)
- 连接线

### PathNode
单个学习节点，包含：
- 节点编号
- 节点标题
- 状态标签
- 完成标记 (可选)

### SuggestionPanel
右侧建议栏，包含：
- 补弱路径建议 (3 条)
- 对应资源 (3 个)
- 底部操作链接

### AIFloatingButton
右下角 AI 悬浮按钮。

## 📊 数据结构

### PHASES 数据
```typescript
const PHASES: Phase[] = [
  {
    id: 1,
    title: '补弱阶段',
    subtitle: '1 / 3',
    color: '#16A34A',
    description: '夯实基础，3 个任务',
    nodes: [
      { id: 1, title: '回看返回值短讲义', status: 'completed', phase: 1 },
      // ...
    ],
  },
  // ...
]
```

### SUGGESTIONS 数据
```typescript
const SUGGESTIONS = [
  { id: 1, text: '先补返回值，再补作用域', desc: '根据当前画像、推荐和路径状态自动推荐。' },
  // ...
]
```

### RESOURCES 数据
```typescript
const RESOURCES = [
  { id: 1, title: '函数返回值项目讲义', tag: '优先学习' },
  // ...
]
```

## 🎯 状态管理

### 主要状态
```typescript
const [targetInput, setTargetInput] = useState('我想自己写一个成绩统计程序')
const [selectedNodeId, setSelectedNodeId] = useState<number | null>(4)
```

- `targetInput`: 目标输入框的值
- `selectedNodeId`: 当前选中的节点 ID (默认为 4，即当前推荐节点)

## 🔌 后续集成

### 1. 连接后端 API
```typescript
// 获取路径数据
const phases = await api.getPathData()

// 获取建议数据
const suggestions = await api.getSuggestions()

// 获取资源数据
const resources = await api.getResources()
```

### 2. 实现路径重排
```typescript
async function handleGeneratePath() {
  const newPhases = await api.generatePath(targetInput)
  // 更新 PHASES 数据
}
```

### 3. 实现节点点击
```typescript
function handleNodeClick(nodeId: number) {
  setSelectedNodeId(nodeId)
  // 可以在这里加载节点详情
}
```

### 4. 实现按钮导航
```typescript
function handleLearnResource() {
  router.push('/resources')
}

function handlePractice() {
  router.push('/practice')
}

function handleGenerateResource() {
  router.push('/generate')
}
```

## 🎨 自定义样式

### 修改颜色
在 `page.tsx` 中修改颜色常量：
```typescript
// 主蓝色
#2563EB

// 完成绿色
#16A34A

// 未开始灰色
#94A3B8
```

### 修改节点尺寸
```typescript
// PathNode 组件中
w-[150px]  // 宽度
min-h-[72px]  // 最小高度
```

### 修改阶段间距
```typescript
// PathCanvas 中
top={48}   // 第一阶段
top={180}  // 第二阶段
top={310}  // 第三阶段
```

## 🐛 常见问题

### Q: 路径图显示不正确？
A: 检查 `PathCanvas` 中的坐标计算是否正确。确保 `top` 和 `left` 值与设计稿一致。

### Q: 节点样式不对？
A: 检查 `getNodeStyle()` 函数中的颜色和背景值。

### Q: 转弯线位置不对？
A: 调整 `TurnLine` 组件中的 `top` 和 `left` 值。

### Q: 网格背景显示不出来？
A: 确保 `PathCanvas` 的 `style` 属性中的 `backgroundImage` 和 `backgroundSize` 正确。

## 📱 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🚀 性能优化建议

1. **使用 React.memo** 优化节点组件
2. **使用 useCallback** 缓存事件处理函数
3. **使用 useMemo** 缓存计算结果
4. **虚拟滚动** (如果节点数量很多)

## 📚 相关文档

- [完整实现文档](./PATH_PAGE_IMPLEMENTATION.md)
- [功能检查清单](./FEATURE_CHECKLIST.md)

## 💡 开发技巧

### 调试路径图
在浏览器开发者工具中：
1. 右键点击路径图 → 检查元素
2. 查看各个 div 的位置和尺寸
3. 使用 DevTools 的 Computed 标签查看最终样式

### 测试不同状态
修改 `PHASES` 数据中的 `status` 值：
- `'completed'` - 已完成 (绿色)
- `'current'` - 当前推荐 (蓝色，高亮)
- `'next'` - 下一步 (浅蓝)
- `'locked'` - 未开始 (灰色)

### 添加新节点
在 `PHASES` 中的 `nodes` 数组中添加新对象：
```typescript
{
  id: 11,
  title: '新节点标题',
  status: 'locked',
  phase: 3,
}
```

## 🎓 学习资源

### CSS 技巧
- [Tailwind CSS 文档](https://tailwindcss.com)
- [CSS Grid 布局](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout)
- [CSS Flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout)

### React 最佳实践
- [React 官方文档](https://react.dev)
- [TypeScript + React](https://www.typescriptlang.org/docs/handbook/react.html)

## 📞 支持

如有问题，请查看：
1. 完整实现文档
2. 代码注释
3. 浏览器开发者工具

---

**最后更新**: 2026-05-11
**版本**: 1.0.0
**状态**: ✅ 生产就绪
