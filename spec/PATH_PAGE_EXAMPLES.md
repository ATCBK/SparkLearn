# 路径页面 - 代码示例与常见用法

## 📚 目录

1. [基础用法](#基础用法)
2. [数据修改](#数据修改)
3. [交互处理](#交互处理)
4. [样式自定义](#样式自定义)
5. [API 集成](#api-集成)
6. [常见问题解决](#常见问题解决)

---

## 基础用法

### 1. 导入和使用页面

```typescript
// 在 Next.js 中，路径页面会自动作为路由
// 访问: http://localhost:3000/path

// 如果需要在其他地方导入:
import PathPage from '@/app/(shell)/path/page'

export default function SomeComponent() {
  return <PathPage />
}
```

### 2. 查看页面结构

```typescript
// 页面主要包含以下部分:
// 1. TopBar - 顶部栏
// 2. PageHeader - 页面标题
// 3. SummaryBar - 摘要条
// 4. PathCircuitCard - 主卡片 (包含路径图)
// 5. SuggestionPanel - 右侧建议栏
// 6. AIFloatingButton - AI 按钮
```

---

## 数据修改

### 1. 修改阶段数据

```typescript
// 在 page.tsx 中修改 PHASES 常量

// 添加新阶段
const PHASES: Phase[] = [
  {
    id: 1,
    title: '补弱阶段',
    subtitle: '1 / 3',
    color: '#16A34A',
    description: '夯实基础，3 个任务',
    nodes: [
      { id: 1, title: '回看返回值短讲义', status: 'completed', phase: 1 },
      { id: 2, title: '补清作用域混淆', status: 'completed', phase: 1 },
      { id: 3, title: '做 5 题补弱练习', status: 'completed', phase: 1 },
    ],
  },
  // ... 其他阶段
]
```

### 2. 修改节点状态

```typescript
// 修改节点的 status 属性

// 已完成
{ id: 1, title: '...', status: 'completed', phase: 1 }

// 当前推荐
{ id: 4, title: '...', status: 'current', phase: 2 }

// 下一步
{ id: 5, title: '...', status: 'next', phase: 2 }

// 未开始
{ id: 8, title: '...', status: 'locked', phase: 3 }
```

### 3. 修改建议数据

```typescript
// 在 page.tsx 中修改 SUGGESTIONS 常量

const SUGGESTIONS = [
  { 
    id: 1, 
    text: '先补返回值，再补作用域', 
    desc: '根据当前画像、推荐和路径状态自动推荐。' 
  },
  { 
    id: 2, 
    text: '资源 10 分钟 + 练习 5 题', 
    desc: '根据当前画像、推荐和路径状态自动推荐。' 
  },
  // ... 更多建议
]
```

### 4. 修改资源数据

```typescript
// 在 page.tsx 中修改 RESOURCES 常量

const RESOURCES = [
  { id: 1, title: '函数返回值项目讲义', tag: '优先学习' },
  { id: 2, title: '函数作用域精讲讲义', tag: '待复习' },
  { id: 3, title: '返回值补弱题练', tag: '5 题' },
]
```

---

## 交互处理

### 1. 处理节点点击

```typescript
// 在 PathNode 组件中
function PathNode({ node, isSelected, onClick }: PathNodeProps) {
  return (
    <button
      onClick={onClick}
      // ... 其他属性
    >
      {/* 节点内容 */}
    </button>
  )
}

// 在 PathPage 中
const [selectedNodeId, setSelectedNodeId] = useState<number | null>(4)

function handleNodeClick(nodeId: number) {
  setSelectedNodeId(nodeId)
  // 可以在这里加载节点详情
  console.log(`选中节点: ${nodeId}`)
}
```

### 2. 处理目标输入

```typescript
// 在 PathPage 中
const [targetInput, setTargetInput] = useState('我想自己写一个成绩统计程序')

function handleTargetChange(e: React.ChangeEvent<HTMLInputElement>) {
  setTargetInput(e.target.value)
}

// 在 JSX 中
<input
  type="text"
  value={targetInput}
  onChange={handleTargetChange}
  placeholder="输入目标，AI 会重排路径…"
/>
```

### 3. 处理生成路径

```typescript
// 添加生成路径的处理函数
async function handleGeneratePath() {
  try {
    // 调用 API 生成新路径
    const newPhases = await api.generatePath(targetInput)
    
    // 更新路径数据
    // setPhases(newPhases)
    
    console.log('路径已生成')
  } catch (error) {
    console.error('生成路径失败:', error)
  }
}

// 在按钮中
<button onClick={handleGeneratePath}>
  生成路径
</button>
```

### 4. 处理操作按钮

```typescript
import { useRouter } from 'next/navigation'

export default function PathPage() {
  const router = useRouter()

  function handleLearnResource() {
    router.push('/resources')
  }

  function handlePractice() {
    router.push('/practice')
  }

  function handleGenerateResource() {
    router.push('/generate')
  }

  return (
    // ...
    <button onClick={handleLearnResource}>
      学习当前节点资源
    </button>
    <button onClick={handlePractice}>
      进入当前节点练习
    </button>
    <button onClick={handleGenerateResource}>
      生成补弱资源
    </button>
  )
}
```

---

## 样式自定义

### 1. 修改颜色

```typescript
// 修改阶段颜色
const PHASES: Phase[] = [
  {
    id: 1,
    title: '补弱阶段',
    color: '#16A34A',  // 修改这里
    // ...
  },
]

// 修改节点样式
function PathNode({ node, isSelected, onClick }: PathNodeProps) {
  const getNodeStyle = () => {
    switch (node.status) {
      case 'completed':
        return {
          border: '1px solid #86EFAC',  // 修改边框
          background: '#F0FDF4',         // 修改背景
          statusBg: '#DCFCE7',           // 修改状态背景
          statusColor: '#16A34A',        // 修改状态文字颜色
          statusText: '已完成',
        }
      // ...
    }
  }
}
```

### 2. 修改尺寸

```typescript
// 修改节点尺寸
<button
  className="relative w-[150px] rounded-[12px] p-3 text-left transition-all hover:shadow-md"
  style={{
    minHeight: '72px',  // 修改这里
  }}
>
  {/* 节点内容 */}
</button>

// 修改阶段间距
<PhaseRow
  phase={PHASES[0]}
  top={48}  // 修改这里
  // ...
/>
```

### 3. 修改圆角

```typescript
// 修改卡片圆角
<div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm">
  {/* 内容 */}
</div>

// 修改节点圆角
<button className="relative w-[150px] rounded-[12px] p-3">
  {/* 内容 */}
</button>
```

### 4. 修改阴影

```typescript
// 修改卡片阴影
<div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm">
  {/* 内容 */}
</div>

// 修改节点阴影
style={{
  boxShadow: isSelected ? '0 8px 20px rgba(37, 99, 235, 0.12)' : 'none',
}}
```

---

## API 集成

### 1. 从后端获取路径数据

```typescript
import { useEffect, useState } from 'react'

export default function PathPage() {
  const [phases, setPhases] = useState<Phase[]>(PHASES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPathData() {
      setLoading(true)
      try {
        const response = await fetch('/api/path/data')
        const data = await response.json()
        setPhases(data.phases)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadPathData()
  }, [])

  if (loading) return <div>加载中...</div>
  if (error) return <div>错误: {error}</div>

  return (
    // ... 使用 phases 数据
  )
}
```

### 2. 实现路径生成

```typescript
async function handleGeneratePath() {
  try {
    const response = await fetch('/api/path/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: targetInput }),
    })
    
    const data = await response.json()
    
    if (data.success) {
      // 更新路径数据
      setPhases(data.phases)
      console.log('路径已生成')
    } else {
      console.error('生成失败:', data.error)
    }
  } catch (error) {
    console.error('请求失败:', error)
  }
}
```

### 3. 获取节点详情

```typescript
async function handleNodeClick(nodeId: number) {
  setSelectedNodeId(nodeId)
  
  try {
    const response = await fetch(`/api/path/nodes/${nodeId}`)
    const data = await response.json()
    
    // 使用节点详情更新右侧面板
    console.log('节点详情:', data)
  } catch (error) {
    console.error('获取详情失败:', error)
  }
}
```

### 4. 更新节点状态

```typescript
async function updateNodeStatus(nodeId: number, status: string) {
  try {
    const response = await fetch(`/api/path/nodes/${nodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    
    const data = await response.json()
    
    if (data.success) {
      console.log('节点状态已更新')
      // 重新加载路径数据
    }
  } catch (error) {
    console.error('更新失败:', error)
  }
}
```

---

## 常见问题解决

### 问题 1: 路径图显示不正确

**症状**: 节点位置错乱，连接线不对齐

**解决方案**:
```typescript
// 检查 PhaseRow 的 top 值
<PhaseRow
  phase={PHASES[0]}
  top={48}   // 确保这个值正确
  // ...
/>

// 检查 TurnLine 的坐标
<TurnLine 
  top={48 + 72 + 24}  // 144px
  left={130 + 150 * 3 + 20}  // 620px
  color="#16A34A" 
/>

// 在浏览器开发者工具中检查元素的实际位置
// 右键 → 检查元素 → 查看 Computed 样式
```

### 问题 2: 节点样式不对

**症状**: 节点颜色、边框或背景不正确

**解决方案**:
```typescript
// 检查 getNodeStyle() 函数中的颜色值
const getNodeStyle = () => {
  switch (node.status) {
    case 'completed':
      return {
        border: '1px solid #86EFAC',  // 检查这些值
        background: '#F0FDF4',
        statusBg: '#DCFCE7',
        statusColor: '#16A34A',
        statusText: '已完成',
      }
    // ...
  }
}

// 在浏览器中查看计算后的样式
// DevTools → Computed 标签
```

### 问题 3: 网格背景显示不出来

**症状**: 路径图背景是纯色，没有网格

**解决方案**:
```typescript
// 检查 PathCanvas 的 style 属性
<div
  className="relative rounded-[12px] border border-[#E5EAF2] bg-[#FAFCFF] p-6"
  style={{
    backgroundImage:
      'linear-gradient(#EEF2F7 1px, transparent 1px), linear-gradient(90deg, #EEF2F7 1px, transparent 1px)',
    backgroundSize: '24px 24px',  // 确保这个值正确
    minHeight: '430px',
  }}
>
  {/* 内容 */}
</div>

// 如果还是不显示，检查是否被其他背景覆盖
// 在 DevTools 中查看 background 属性
```

### 问题 4: 转弯线位置不对

**症状**: 转弯线不在正确的位置，或者角度不对

**解决方案**:
```typescript
// 检查 TurnLine 的坐标计算
// 第一到第二阶段:
// top = 第一阶段 top + 节点高度 + 间距
//     = 48 + 72 + 24 = 144px
// left = 阶段标识宽度 + 节点宽度 * 节点数 + 间距
//      = 130 + 150 * 3 + 20 = 620px

// 检查 border-radius 是否正确
<div
  style={{
    border: `3px solid ${color}`,
    borderLeft: 'none',  // 重要: 左边框必须是 none
    borderRadius: '0 32px 32px 0',  // 右上、右下圆角
  }}
/>
```

### 问题 5: 节点点击不响应

**症状**: 点击节点没有反应，节点不高亮

**解决方案**:
```typescript
// 检查 onClick 处理函数
<button
  onClick={onClick}  // 确保这个函数被传入
  // ...
>
  {/* 内容 */}
</button>

// 检查 isSelected 状态是否正确更新
const [selectedNodeId, setSelectedNodeId] = useState<number | null>(4)

function handleNodeClick(nodeId: number) {
  setSelectedNodeId(nodeId)  // 确保这个被调用
}

// 检查 isSelected 的计算
const isSelected = selectedNodeId === node.id  // 确保这个逻辑正确
```

### 问题 6: 输入框不能输入

**症状**: 输入框显示但不能输入文字

**解决方案**:
```typescript
// 检查 onChange 处理函数
<input
  type="text"
  value={targetInput}
  onChange={(e) => setTargetInput(e.target.value)}  // 确保这个函数正确
  placeholder="输入目标，AI 会重排路径…"
/>

// 检查输入框是否被禁用
// 不应该有 disabled 属性

// 检查 z-index 是否被其他元素遮挡
// 在 DevTools 中查看元素的 z-index
```

### 问题 7: 按钮点击没有导航

**症状**: 点击按钮没有跳转到其他页面

**解决方案**:
```typescript
import { useRouter } from 'next/navigation'

export default function PathPage() {
  const router = useRouter()

  function handleLearnResource() {
    router.push('/resources')  // 确保路由正确
  }

  return (
    <button onClick={handleLearnResource}>
      学习当前节点资源
    </button>
  )
}

// 检查路由是否存在
// 确保 /resources 页面存在
```

### 问题 8: 样式不应用

**症状**: 修改了 Tailwind 类名但样式没有变化

**解决方案**:
```typescript
// 确保使用了正确的 Tailwind 类名
<div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm">
  {/* 内容 */}
</div>

// 如果使用了自定义颜色，确保在 tailwind.config.ts 中定义
// 或者使用 style 属性直接设置

// 重新编译 Tailwind CSS
npm run build

// 清除浏览器缓存
// Ctrl + Shift + Delete (Windows)
// Cmd + Shift + Delete (Mac)
```

### 问题 9: 性能问题

**症状**: 页面加载缓慢，交互卡顿

**解决方案**:
```typescript
// 使用 React.memo 优化节点组件
const PathNode = React.memo(function PathNode({ 
  node, 
  isSelected, 
  onClick 
}: PathNodeProps) {
  // 组件内容
})

// 使用 useCallback 缓存事件处理
const handleNodeClick = useCallback((nodeId: number) => {
  setSelectedNodeId(nodeId)
}, [])

// 使用 useMemo 缓存计算结果
const filteredPhases = useMemo(() => {
  return PHASES.filter(phase => phase.id <= 3)
}, [])
```

### 问题 10: TypeScript 类型错误

**症状**: 编译时出现类型错误

**解决方案**:
```typescript
// 确保所有类型定义正确
interface PathNode {
  id: number
  title: string
  status: 'completed' | 'current' | 'next' | 'locked'
  phase: 1 | 2 | 3
}

interface Phase {
  id: number
  title: string
  subtitle: string
  color: string
  description: string
  nodes: PathNode[]
}

// 确保函数参数类型正确
function handleNodeClick(nodeId: number): void {
  setSelectedNodeId(nodeId)
}

// 运行类型检查
npm run type-check
```

---

## 🎓 最佳实践

### 1. 代码组织
```typescript
// ✅ 好的做法
// 1. 类型定义在顶部
// 2. 常量定义在类型下面
// 3. 主组件在最后
// 4. 子组件在主组件下面

// ❌ 不好的做法
// 1. 混乱的代码顺序
// 2. 类型定义分散
// 3. 常量定义在组件内部
```

### 2. 状态管理
```typescript
// ✅ 好的做法
const [selectedNodeId, setSelectedNodeId] = useState<number | null>(4)
const [targetInput, setTargetInput] = useState('...')

// ❌ 不好的做法
const [state, setState] = useState({
  selectedNodeId: 4,
  targetInput: '...',
  // 太多状态混在一起
})
```

### 3. 事件处理
```typescript
// ✅ 好的做法
function handleNodeClick(nodeId: number) {
  setSelectedNodeId(nodeId)
}

// ❌ 不好的做法
onClick={() => setSelectedNodeId(node.id)}  // 每次都创建新函数
```

### 4. 样式管理
```typescript
// ✅ 好的做法
className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm"

// ❌ 不好的做法
style={{
  borderRadius: '14px',
  border: '1px solid #E5EAF2',
  background: 'white',
  padding: '24px',
  boxShadow: '...',
}}
```

---

**文档版本**: 1.0.0
**最后更新**: 2026-05-11
**状态**: ✅ 完成
