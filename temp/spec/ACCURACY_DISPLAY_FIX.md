# 正确率和完成题目数显示修复

## 问题描述
1. 正确率计算错误：使用了错误的分母和分子
2. 完成题目数显示错误：显示的是当前题目索引而不是实际完成的题目数

## 修复内容

### 1. 修复正确率计算逻辑

**之前的错误代码：**
```typescript
const submittedQuestions = questions.filter((q, i) => {
  return i < currentIndex
})
const correctCount = submittedQuestions.length // 假设都正确（错误！）
const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
```

问题：
- 只计算当前题之前的题目
- 假设所有提交的题目都正确
- 用总题目数作为分母，而不是已提交题目数

**修复后的代码：**
```typescript
const totalSubmitted = answerRecords.length
const correctCount = answerRecords.filter(r => r.correct).length
const accuracy = totalSubmitted > 0 ? Math.round((correctCount / totalSubmitted) * 100) : 0
```

优点：
- 直接从 `answerRecords` 获取已提交题目数
- 正确计算正确的题目数
- 用已提交题目数作为分母

### 2. 修复完成题目数显示

**之前的错误代码：**
```typescript
<SoftCard className="flex items-center justify-between bg-white">
  <span>
    <b className="text-small text-ink">完成</b>
    <span className="block text-micro text-muted">{currentIndex} 题</span>
  </span>
  <Pill tone="green">{currentIndex} 题</Pill>
</SoftCard>
```

问题：
- `currentIndex` 是当前题目的索引（0-based），不是完成的题目数
- 例如：在第 1 题时，`currentIndex = 0`，显示为"完成 0 题"（错误）

**修复后的代码：**
```typescript
<SoftCard className="flex items-center justify-between bg-white">
  <span>
    <b className="text-small text-ink">完成</b>
    <span className="block text-micro text-muted">{totalSubmitted} 题</span>
  </span>
  <Pill tone="green">{totalSubmitted} 题</Pill>
</SoftCard>
```

优点：
- 使用 `totalSubmitted`（已提交题目数）
- 准确反映用户完成的题目数

## 修改的文件
- `frontend/src/app/(shell)/practice/page.tsx`

## 实时更新机制

现在，当用户提交答案后：
1. 答题记录被保存到 `answerRecords`
2. `totalSubmitted` 自动更新（= `answerRecords.length`）
3. `correctCount` 自动更新（= 正确的记录数）
4. `accuracy` 自动重新计算
5. UI 中的"完成"和"正确率"卡片自动刷新

## 示例场景

### 场景 1：用户做了 3 道题，全部正确
```
完成: 3 题
正确率: 100%
```

### 场景 2：用户做了 5 道题，3 道正确，2 道错误
```
完成: 5 题
正确率: 60%
```

### 场景 3：用户还没做任何题
```
完成: 0 题
正确率: 0%
```

## 验证清单

- [x] 正确率计算使用正确的分子（正确题目数）
- [x] 正确率计算使用正确的分母（已提交题目数）
- [x] 完成题目数显示实际提交的题目数
- [x] 提交答案后，统计数据实时更新
- [x] 没有 TypeScript 编译错误
- [x] 没有运行时错误

## 性能影响

- 最小化：只是改变了计算逻辑，没有添加新的状态或副作用
- 实时性：完全实时，无延迟
