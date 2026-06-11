# 练习评测页面改进总结

## 修改完成 ✅

### 问题修复

#### 1. **自动生成 vs 手动输入切换**
- 添加了两个切换按钮：自动生成 / 手动输入
- 自动生成模式：下拉菜单选择预设主题
  - 函数返回值
  - 循环语句
  - 条件判断
  - 列表操作
  - 字典操作
  - 字符串处理
- 手动输入模式：输入框自由输入主题

#### 2. **题目加载问题修复**
- 改进了数据验证逻辑
- 检查 API 返回的数据是否有效
- 如果数据为空，显示清晰的错误提示
- 添加了 null/undefined 检查

#### 3. **题目数量约束改进**
- 将 count 改为字符串类型，便于输入框处理
- 添加了严格的数量验证（1-50）
- 输入框支持直接输入，自动约束范围
- +/- 按钮也受到 1-50 的约束
- 失焦时如果为空，自动填充默认值 8

#### 4. **错误处理增强**
- 生成前检查主题是否为空
- 生成前检查数量是否在有效范围
- 显示具体的错误提示信息
- 题目加载失败时不会显示空白页面

### 修改的文件
**`frontend/src/app/(shell)/practice/page.tsx`**

### 核心改进代码

#### 切换模式
```typescript
const [autoMode, setAutoMode] = useState(true) // true: 自动生成, false: 手动输入

{/* 切换按钮 */}
<div className="mt-4 flex gap-2 rounded-[10px] border border-line p-1 bg-[#f9fafb]">
  <button
    onClick={() => setAutoMode(true)}
    className={`flex-1 h-8 rounded-[8px] text-micro font-bold transition-colors ${
      autoMode
        ? 'bg-white text-blue border border-blue'
        : 'text-muted hover:text-ink'
    }`}
  >
    <Zap className="h-3 w-3 inline mr-1" />
    自动生成
  </button>
  <button
    onClick={() => setAutoMode(false)}
    className={`flex-1 h-8 rounded-[8px] text-micro font-bold transition-colors ${
      !autoMode
        ? 'bg-white text-blue border border-blue'
        : 'text-muted hover:text-ink'
    }`}
  >
    手动输入
  </button>
</div>
```

#### 数量约束
```typescript
const [count, setCount] = useState('8')

<input
  type="number"
  min="1"
  max="50"
  value={count}
  onChange={(e) => {
    const val = e.target.value
    if (val === '') {
      setCount('')
    } else {
      const num = parseInt(val)
      if (!isNaN(num)) {
        setCount(Math.min(50, Math.max(1, num)).toString())
      }
    }
  }}
  onBlur={() => {
    if (count === '' || isNaN(parseInt(count))) {
      setCount('8')
    }
  }}
/>
```

#### 生成验证
```typescript
async function generateQuestions() {
  if (!topic.trim()) {
    setError('请输入题目主题')
    return
  }

  const countNum = parseInt(count)
  if (isNaN(countNum) || countNum < 1 || countNum > 50) {
    setError('题目数量必须在 1-50 之间')
    return
  }

  // ... 生成逻辑
}
```

### 用户交互流程

1. **选择模式**
   - 点击"自动生成"或"手动输入"切换
   
2. **选择/输入主题**
   - 自动生成：从下拉菜单选择
   - 手动输入：在输入框输入自定义主题

3. **设置数量**
   - 直接输入（1-50）
   - 或使用 +/- 按钮调整

4. **生成题目**
   - 点击"生成练习题"按钮
   - 系统验证输入后生成

### 验证清单

- [x] 添加自动生成/手动输入切换
- [x] 自动生成模式使用下拉菜单
- [x] 手动输入模式使用输入框
- [x] 修复题目加载问题
- [x] 改进数量约束准确度
- [x] 添加输入验证
- [x] 显示清晰的错误提示
- [x] 失焦时自动填充默认值
- [x] 没有语法错误

### 后续优化建议

1. **主题管理**：可以从后端动态获取主题列表
2. **历史记录**：记录用户最近使用的主题
3. **快速生成**：添加"快速生成"按钮，使用默认设置
4. **批量操作**：支持一次生成多个不同主题的题目
5. **题目预览**：生成前显示题目预览
