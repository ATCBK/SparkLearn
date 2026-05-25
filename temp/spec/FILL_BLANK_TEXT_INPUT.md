# 填空题文本输入框实现

## 问题描述
填空题之前没有实际的输入框，用户无法输入答案。

## 解决方案
为填空题添加了一个真实的文本输入框，让用户可以直接输入答案。

## 实现细节

### UI 结构

```
┌─────────────────────────────────────┐
│ 请输入答案：                        │
│ ┌─────────────────────────────────┐ │
│ │ 输入你的答案...                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

参考答案：
┌─────────────────────────────────────┐
│ 答案选项 1                          │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 答案选项 2                          │
└─────────────────────────────────────┘
```

### 代码实现

```typescript
{currentQuestion.type === 'fill_blank' ? (
  // 填空题：显示文本输入框
  <div className="space-y-3">
    {/* 主输入框 */}
    <div className="rounded-[12px] border-2 border-line bg-white p-4">
      <p className="text-small text-muted mb-3">请输入答案：</p>
      <input
        type="text"
        value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
        onChange={(e) => !submitted && setSelectedAnswer(e.target.value)}
        disabled={submitted}
        placeholder="输入你的答案..."
        className="w-full rounded-[8px] border-2 border-line px-3 py-2 text-small outline-none focus:border-blue disabled:bg-gray-100"
      />
    </div>
    
    {/* 参考答案 */}
    {currentQuestion.options && currentQuestion.options.length > 0 && (
      <div className="mt-4">
        <p className="text-micro text-muted mb-2">参考答案：</p>
        <div className="space-y-2">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => !submitted && setSelectedAnswer(option)}
              disabled={submitted}
              className={/* 样式 */}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
) : /* 其他题型 */}
```

## 功能特性

### 1. 文本输入框
- **类型**：文本输入（type="text"）
- **占位符**："输入你的答案..."
- **实时更新**：用户输入时立即更新 `selectedAnswer` 状态
- **提交后禁用**：提交答案后，输入框被禁用

### 2. 参考答案
- **显示条件**：当题目有 `options` 时显示
- **标签**："参考答案："
- **交互**：用户可以点击参考答案快速填充输入框
- **样式**：与单选题相同的按钮样式

### 3. 状态管理
- **未提交**：输入框可编辑，参考答案可点击
- **已提交**：输入框禁用，参考答案显示正确/错误状态

## 交互流程

### 用户输入答案
1. 用户在输入框中输入答案
2. `selectedAnswer` 状态实时更新
3. 提交按钮变为可用状态

### 用户选择参考答案
1. 用户点击参考答案按钮
2. 该答案被填充到输入框
3. `selectedAnswer` 状态更新

### 提交答案
1. 用户点击"提交判题"按钮
2. 输入框被禁用
3. 参考答案显示正确/错误状态
4. 显示判题结果和解析

## 颜色状态

| 状态 | 颜色 | 说明 |
|------|------|------|
| 未提交 | 白色 + 灰色边框 | 输入框可编辑 |
| 已提交 - 正确 | 绿色背景 + 绿色边框 | 参考答案显示 |
| 已提交 - 错误 | 红色背景 + 红色边框 | 参考答案显示 |

## 修改的文件
- `frontend/src/app/(shell)/practice/page.tsx`

## 验证清单

- [x] 填空题显示文本输入框
- [x] 用户可以在输入框中输入答案
- [x] 参考答案显示为可点击的按钮
- [x] 点击参考答案可以填充输入框
- [x] 提交后输入框被禁用
- [x] 提交后参考答案显示正确/错误状态
- [x] 没有 TypeScript 编译错误
- [x] 没有运行时错误

## 用户体验改进

1. **直观输入**：用户可以直接输入答案，而不是从列表中选择
2. **参考答案**：提供参考答案帮助用户快速填充
3. **实时反馈**：输入框实时更新状态
4. **清晰提示**：标签和占位符清晰指导用户操作

## 示例场景

### 场景 1：用户手动输入答案
1. 用户在输入框中输入 "import"
2. 点击"提交判题"
3. 系统判题并显示结果

### 场景 2：用户选择参考答案
1. 用户点击参考答案 "import"
2. 答案被填充到输入框
3. 点击"提交判题"
4. 系统判题并显示结果

### 场景 3：用户修改答案
1. 用户输入 "import"
2. 点击参考答案 "from"
3. 输入框内容被替换为 "from"
4. 点击"提交判题"
5. 系统判题并显示结果
