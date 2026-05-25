# 填空题参考答案样式修复

## 问题描述
填空题的参考答案选项在选中时显示蓝色，导致选项看不清楚。用户希望只在提交后显示正确/错误状态。

## 解决方案
移除了参考答案选项的蓝色选中状态，现在：
- **未提交**：显示白色背景 + 灰色边框（保持可见）
- **已提交 - 正确**：显示绿色背景 + 绿色边框
- **已提交 - 错误**：显示红色背景 + 红色边框

## 代码变更

### 之前的样式
```typescript
className={`w-full rounded-[10px] border px-3 py-2 text-left text-small transition-colors ${
  selectedAnswer === option
    ? 'border-blue bg-blue-light text-blue'  // ❌ 蓝色选中状态
    : submitted && option === currentQuestion.correctAnswer
    ? 'border-green bg-green-light text-green'
    : submitted && selectedAnswer === option
    ? 'border-red bg-red-light text-red'
    : 'border-line bg-white text-ink hover:border-blue'
}`}
```

### 修复后的样式
```typescript
className={`w-full rounded-[10px] border-2 px-3 py-2 text-left text-small transition-colors ${
  submitted && option === currentQuestion.correctAnswer
    ? 'border-green bg-green-light text-green'  // ✅ 正确答案
    : submitted && selectedAnswer === option
    ? 'border-red bg-red-light text-red'        // ✅ 错误答案
    : 'border-line bg-white text-ink hover:border-line'  // ✅ 默认状态
}`}
```

## 样式对比

| 状态 | 之前 | 现在 |
|------|------|------|
| 未提交 | 白色 + 灰色边框 | 白色 + 灰色边框 ✓ |
| 选中（未提交） | 蓝色背景 + 蓝色边框 ❌ | 白色 + 灰色边框 ✓ |
| 已提交 - 正确 | 绿色背景 + 绿色边框 | 绿色背景 + 绿色边框 ✓ |
| 已提交 - 错误 | 红色背景 + 红色边框 | 红色背景 + 红色边框 ✓ |

## 用户体验改进

1. **可见性**：参考答案始终清晰可见
2. **简洁性**：未提交时不显示选中状态
3. **清晰反馈**：只在提交后显示正确/错误状态
4. **一致性**：与原型设计保持一致

## 交互流程

### 用户选择参考答案
1. 用户点击参考答案选项
2. 答案被填充到输入框
3. 参考答案选项保持白色（不变色）
4. 用户点击"提交判题"
5. 参考答案显示绿色（正确）或红色（错误）

## 修改的文件
- `frontend/src/app/(shell)/practice/page.tsx`

## 验证清单

- [x] 参考答案未提交时不显示蓝色
- [x] 参考答案始终清晰可见
- [x] 提交后显示正确/错误状态
- [x] 没有 TypeScript 编译错误
- [x] 没有运行时错误

## 视觉效果

### 未提交状态
```
参考答案：
┌─────────────────────────────────┐
│ import                          │  ← 白色背景，灰色边框
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ from                            │  ← 白色背景，灰色边框
└─────────────────────────────────┘
```

### 已提交状态（假设第一个正确，第二个错误）
```
参考答案：
┌─────────────────────────────────┐
│ import                          │  ← 绿色背景，绿色边框 ✓
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ from                            │  ← 红色背景，红色边框 ✗
└─────────────────────────────────┘
```
