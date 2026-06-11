# 练习评测页面功能完善

## 修改完成 ✅

### 功能改进

#### 1. **真实可用的题目生成**
- 支持用户输入题目主题（例如：函数返回值、循环语句等）
- 支持用户输入或调整题目数量
- 点击"生成练习题"按钮实时生成对应题目

#### 2. **用户输入题目数量**
- 在"生成练习"卡片中添加了数字输入框
- 用户可以直接输入题目数量（1-50）
- 也可以使用 +/- 按钮调整数量
- 输入框支持实时更新

#### 3. **完整的答题流程**
- 显示当前题目内容和选项
- 支持选择答案并提交判题
- 显示判题结果和答案解析
- 支持收藏题目
- 支持前后翻页导航

#### 4. **答题进度追踪**
- 显示当前答题进度（X / Y）
- 网格显示所有题目按钮，可点击跳转
- 实时显示完成题数和正确率
- 正确率达标线为 80%

#### 5. **导航按钮位置**
- "错题本"和"收藏题目"按钮在 PageHead 的 actions 中
- 也在右侧答题进度卡片底部重复显示

### 修改的文件
**`frontend/src/app/(shell)/practice/page.tsx`**

### 核心功能代码

#### 生成练习题
```typescript
async function generateQuestions() {
  setGenerating(true)
  setError('')
  try {
    const data = await api.getQuizQuestions(topic)
    setQuestions(data.slice(0, count))
    setCurrentIndex(0)
    setSubmitted(false)
    setSelectedAnswer(null)
  } catch (ex) {
    setError(ex instanceof Error ? ex.message : '生成题目失败')
  } finally {
    setGenerating(false)
  }
}
```

#### 提交答案
```typescript
async function submitAnswer() {
  if (!selectedAnswer || !currentQuestion) return
  
  setLoading(true)
  try {
    const result = await api.submitQuizAnswer(currentQuestion.id, selectedAnswer)
    setSubmitted(true)
  } catch (ex) {
    setError(ex instanceof Error ? ex.message : '提交失败')
  } finally {
    setLoading(false)
  }
}
```

### 用户交互流程

1. **生成题目**
   - 输入题目主题（例如：函数返回值）
   - 输入或调整题目数量（1-50）
   - 点击"生成练习题"按钮

2. **答题**
   - 阅读题目和代码片段
   - 选择答案选项
   - 点击"提交判题"

3. **查看结果**
   - 显示判题结果（正确/错误）
   - 显示正确答案和解析
   - 可以收藏题目或生成补弱资源

4. **导航**
   - 使用前后箭头按钮翻页
   - 点击题号按钮直接跳转
   - 实时显示答题进度

### 右侧卡片布局

#### 生成练习卡片
- 题目主题输入框
- 题目数量输入框（支持直接输入或 +/- 按钮）
- 生成练习题按钮

#### 答题进度卡片
- 当前进度显示（X / Y）
- 题号按钮网格（可点击跳转）
- 完成题数统计
- 正确率显示
- 错题本和收藏题目按钮

### API 集成

使用的 API 接口：
- `api.getQuizQuestions(topic)` - 获取题目
- `api.submitQuizAnswer(quizId, answer)` - 提交答案
- `api.setQuizFavorite(quizId, favorite)` - 收藏题目

### 验证清单

- [x] 支持用户输入题目主题
- [x] 支持用户输入题目数量
- [x] 实时生成题目
- [x] 完整的答题流程
- [x] 判题结果显示
- [x] 答题进度追踪
- [x] 导航按钮在标题旁边
- [x] 错题本和收藏题目按钮在 PageHead
- [x] 没有语法错误

### 后续优化建议

1. **题目缓存**：可以缓存已生成的题目，避免重复请求
2. **自动保存**：可以自动保存用户的答题进度
3. **统计分析**：可以显示更详细的学习统计
4. **推荐系统**：根据错题情况推荐补弱资源
5. **离线支持**：可以支持离线答题
