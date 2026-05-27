# 习题生成和判题逻辑改进总结

## 问题分析

用户反馈的问题：
1. ❌ 生成的习题基本都是一样的
2. ❌ 默认就是随机生成的题目不要一直指定一个类
3. ❌ 后面的题目没有反应也加载不出来
4. ❌ 题目的正确率没法正确检测

## 解决方案

### 1. 题目多样性问题

**原因**：LLM 提示词没有强调多样性，导致生成的题目相似

**改进**：
```python
# 计算题型分布
single_count = max(1, count // 2)
multiple_count = max(0, count // 3)
fill_blank_count = count - single_count - multiple_count

prompt = (
    '...'
    f'要求：共 {count} 题，其中单选题 {single_count} 道、多选题 {multiple_count} 道、填空题 {fill_blank_count} 道。\n'
    '约束：\n'
    '1) 题目必须多样化，不要重复相同的题干或考点；\n'
    '2) 每道题考察不同的知识点或不同的难度；\n'
    '...'
)
```

**效果**：
- 明确指定题型分布（单选、多选、填空）
- 强调题目多样性和不重复
- 要求每道题考察不同知识点

---

### 2. 题型单一问题

**原因**：默认题库中题型分布不均

**改进**：
- 在 LLM 提示词中明确指定题型数量
- 要求 LLM 生成多样化的题型
- 添加约束条件确保选项有明显区别

---

### 3. 后续题目加载失败问题

**原因**：LLM 调用超时或生成失败

**改进**：
```python
try:
    # 添加超时保护（15秒）
    text = await asyncio.wait_for(_collect_llm_text(prompt), timeout=15.0)
except asyncio.TimeoutError:
    print(f"DEBUG: LLM generation timeout")
    return None
except Exception as e:
    print(f"DEBUG: LLM generation error: {e}")
    return None
```

**效果**：
- 添加 15 秒超时保护
- 超时时自动回退到默认题库
- 更详细的错误日志

---

### 4. 判题逻辑改进

**原因**：判题逻辑太严格，无法正确识别答案

**改进**：

#### 单选题判题
```python
# 不区分大小写，但保留空格
expected_lower = expected_str.lower()
actual_lower = actual_str.lower()
result = expected_lower == actual_lower
```

#### 多选题判题
```python
# 使用集合比较，顺序无关
expected = set(str(x).strip().lower() for x in correct_answer)
actual = set(str(x).strip().lower() for x in answer)
result = expected == actual
```

#### 填空题判题
```python
# 忽略所有空格和大小写
normalize = lambda s: re.sub(r'\s+', '', s).lower()
expected_normalized = normalize(expected_str)
actual_normalized = normalize(actual_str)
result = expected_normalized == actual_normalized
```

#### LLM 辅助判题
```python
# 仅对填空题使用 LLM 辅助判题
if not rule_correct and target.get('type') == 'fill_blank':
    llm_judge = await _judge_with_llm(target, req.answer)
    if llm_judge and llm_judge['correct'] and llm_judge['confidence'] >= 0.8:
        correct = True
        judge_mode = 'llm_assist'
```

---

## 改进后的判题流程

```
用户提交答案
    ↓
第1步：规则判题
    ├─ 单选题：不区分大小写
    ├─ 多选题：集合相等（顺序无关）
    └─ 填空题：忽略空格和大小写
    ↓
    如果规则判题成功 → 返回结果
    如果规则判题失败 → 继续
    ↓
第2步：LLM 辅助判题（仅填空题）
    ├─ 调用讯飞星火 LLM
    ├─ 获取 LLM 判题结果和置信度
    └─ 如果置信度 >= 0.8 → 采用 LLM 结果
    ↓
第3步：保存答题记录
    ├─ 记录答案、判题结果、判题方式
    └─ 更新掌握度评分
    ↓
返回结果给前端
```

---

## 代码改进详情

### 文件：`backend/app/routes/quiz.py`

#### 改进 1：`_generate_quiz_with_llm()` 函数

**变化**：
- 添加题型分布计算
- 改进 LLM 提示词，强调多样性
- 添加 15 秒超时保护
- 添加详细的 DEBUG 日志

**代码位置**：第 289-340 行

#### 改进 2：`_is_correct_rule()` 函数

**变化**：
- 改进单选题判题逻辑
- 改进多选题判题逻辑（使用集合）
- 改进填空题判题逻辑（忽略空格）
- 添加详细的 DEBUG 日志

**代码位置**：第 540-590 行

#### 改进 3：`_judge_with_llm()` 函数

**变化**：
- 仅对填空题使用 LLM 辅助判题
- 添加 5 秒超时保护
- 改进错误处理
- 添加详细的 DEBUG 日志

**代码位置**：第 330-375 行

#### 改进 4：`submit_quiz()` 函数

**变化**：
- 改进判题流程注释
- 添加详细的 DEBUG 日志
- 改进错误处理

**代码位置**：第 115-180 行

---

## 测试建议

### 测试 1：题目多样性
```bash
# 请求 4 道题目，检查是否包含不同题型
curl "http://127.0.0.1:8000/api/quiz?count=4"

# 预期结果：
# - 至少 2 道单选题
# - 至少 1 道多选题
# - 至少 1 道填空题
```

### 测试 2：判题准确性
```bash
# 提交正确答案
curl -X POST "http://127.0.0.1:8000/api/quiz/submit" \
  -H "Content-Type: application/json" \
  -d '{"quiz_id": "q1", "answer": "list"}'

# 预期结果：
# "correct": true
```

### 测试 3：多选题判题
```bash
# 提交多选题答案（顺序不同）
curl -X POST "http://127.0.0.1:8000/api/quiz/submit" \
  -H "Content-Type: application/json" \
  -d '{"quiz_id": "q3", "answer": ["set", "dict", "list"]}'

# 预期结果：
# "correct": true （即使顺序不同）
```

### 测试 4：填空题判题
```bash
# 提交填空题答案（有额外空格）
curl -X POST "http://127.0.0.1:8000/api/quiz/submit" \
  -H "Content-Type: application/json" \
  -d '{"quiz_id": "q4", "answer": "  import  "}'

# 预期结果：
# "correct": true （忽略空格）
```

---

## 性能优化

### 超时保护
- LLM 生成：15 秒超时
- LLM 判题：5 秒超时
- 超时时自动回退到默认题库

### 错误处理
- 捕获所有异常
- 详细的错误日志
- 优雅的降级处理

---

## 后续改进方向

1. **题目质量**
   - 增加默认题库的题目数量
   - 添加更多知识点
   - 改进题目难度分级

2. **判题准确性**
   - 支持更多答案格式
   - 改进 LLM 判题置信度阈值
   - 添加用户反馈机制

3. **性能优化**
   - 缓存常见题目
   - 并行生成多道题目
   - 优化 LLM 调用

4. **用户体验**
   - 显示判题过程
   - 提供更详细的解析
   - 支持题目难度调整

---

## 总结

通过以上改进，习题生成和判题系统现在应该能够：

✅ 生成多样化的题目（单选、多选、填空）
✅ 准确判题（支持多种答案格式）
✅ 快速响应（添加超时保护）
✅ 优雅降级（LLM 失败时回退到默认题库）
✅ 详细日志（便于调试和监控）

