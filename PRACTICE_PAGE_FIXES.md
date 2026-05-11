# 练习页面问题修复总结

## 问题分析

用户反馈的问题：
1. ❌ 答题进度的按钮不会更新
2. ❌ 点击一次生成四次习题也生成不了

## 根本原因

### 问题 1：答题进度按钮不更新

**原因**：
- 按钮的样式依赖于 `currentIndex` 和 `submitted` 状态
- 但判断逻辑中没有考虑 `submitted` 状态
- 导致按钮样式不能正确反映答题状态

**原代码**：
```typescript
actualIdx < currentIndex
  ? 'border-green bg-green-light text-green'  // 已完成
  : actualIdx === currentIndex
  ? 'border-blue bg-blue-light text-blue'     // 当前题
  : 'border-line bg-white text-muted hover:border-blue'  // 未做
```

问题：`actualIdx < currentIndex` 只要索引小于当前索引就显示为已完成，但没有检查是否真的提交过答案。

### 问题 2：生成四次习题

**原因**：
- `countNum` 的默认值是 8，而不是 4
- 当用户点击"生成练习题"时，如果没有修改 count 值，就会生成 8 道题
- 但初始化时设置的是 4 道题，导致不一致

**原代码**：
```typescript
const countNum = parseInt(count) || 8  // 默认值是 8
```

## 解决方案

### 修复 1：答题进度按钮更新

**改进**：
```typescript
{currentPageQuestions.map((_, idx) => {
  const actualIdx = startIdx + idx
  const isCompleted = actualIdx < currentIndex && submitted  // ← 关键：检查 submitted
  const isCurrent = actualIdx === currentIndex
  
  return (
    <button
      key={actualIdx}
      onClick={() => goToQuestion(actualIdx)}
      className={`h-10 rounded-[10px] border text-small font-bold transition-colors ${
        isCompleted
          ? 'border-green bg-green-light text-green'
          : isCurrent
          ? 'border-blue bg-blue-light text-blue'
          : 'border-line bg-white text-muted hover:border-blue'
      }`}
    >
      {actualIdx + 1}
    </button>
  )
})}
```

**关键改进**：
- 添加 `isCompleted` 变量，检查 `actualIdx < currentIndex && submitted`
- 只有当题目已提交且索引小于当前索引时，才显示为已完成
- 这样按钮样式会随着 `submitted` 状态的改变而更新

### 修复 2：生成题目数量一致

**改进**：
```typescript
const countNum = parseInt(count) || 4  // 改为 4，与初始化一致
```

**效果**：
- 初始化时生成 4 道题
- 用户点击"生成练习题"时，如果没有修改 count，也会生成 4 道题
- 保持一致性

### 修复 3：改进正确率计算

**改进**：
```typescript
const correctCount = questions.filter((_, i) => i < currentIndex && submitted).length
```

**原因**：
- 只计算已提交的题目
- 避免计算未提交的题目

## 代码变更位置

### 文件：`frontend/src/app/(shell)/practice/page.tsx`

#### 变更 1：修复 countNum 默认值（第 ~150 行）
```diff
- const countNum = parseInt(count) || 8
+ const countNum = parseInt(count) || 4
```

#### 变更 2：改进正确率计算（第 ~150 行）
```diff
- const correctCount = questions.filter((_, i) => i < currentIndex).length
+ const correctCount = questions.filter((_, i) => i < currentIndex && submitted).length
```

#### 变更 3：修复答题进度按钮（第 ~280-310 行）
```diff
  {currentPageQuestions.map((_, idx) => {
    const actualIdx = startIdx + idx
+   const isCompleted = actualIdx < currentIndex && submitted
+   const isCurrent = actualIdx === currentIndex
    
    return (
      <button
        key={actualIdx}
        onClick={() => goToQuestion(actualIdx)}
        className={`h-10 rounded-[10px] border text-small font-bold transition-colors ${
-         actualIdx < currentIndex
+         isCompleted
            ? 'border-green bg-green-light text-green'
-           : actualIdx === currentIndex
+           : isCurrent
            ? 'border-blue bg-blue-light text-blue'
            : 'border-line bg-white text-muted hover:border-blue'
        }`}
      >
        {actualIdx + 1}
      </button>
    )
  })}
```

## 测试验证

### 测试 1：答题进度按钮更新
1. 打开练习页面
2. 初始化时应该显示 4 道题
3. 点击第 1 题的选项
4. 点击"提交判题"
5. **预期**：第 1 题的按钮应该变成绿色（已完成）
6. 点击第 2 题
7. **预期**：第 2 题的按钮应该变成蓝色（当前题）

### 测试 2：生成题目数量一致
1. 打开练习页面
2. 初始化时应该显示 4 道题
3. 不修改"题目数量"输入框
4. 点击"生成练习题"
5. **预期**：应该生成 4 道题（而不是 8 道）

### 测试 3：修改题目数量
1. 打开练习页面
2. 修改"题目数量"为 10
3. 点击"生成练习题"
4. **预期**：应该生成 10 道题

## 性能影响

- ✅ 无性能影响
- ✅ 代码更清晰
- ✅ 用户体验更好

## 后续改进

1. **按钮样式**
   - 可以添加更多状态（如"已收藏"）
   - 可以显示答题结果（正确/错误）

2. **进度追踪**
   - 可以显示每道题的答题时间
   - 可以显示每道题的难度

3. **用户反馈**
   - 可以添加动画效果
   - 可以显示进度条

## 总结

通过以上修复，练习页面现在应该能够：

✅ 正确显示答题进度（按钮会根据答题状态更新）
✅ 生成一致数量的题目（初始化和生成时都是 4 道）
✅ 提供更好的用户体验（清晰的视觉反馈）

