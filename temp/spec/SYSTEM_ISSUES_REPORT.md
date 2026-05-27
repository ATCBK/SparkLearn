# 答题系统问题报告

## 测试执行情况

运行了全面的测试脚本，发现了多个关键问题。

---

## 🔴 发现的问题

### 问题 1：API 返回的题目数量不符合预期

**严重程度**：🔴 高

**现象**：
- 请求 `count=4` 时，实际返回 2 道题目
- 请求 `count=10` 时，实际返回 5 道题目

**根本原因**：
后端的 LLM 生成可能失败，回退到默认题库，但默认题库只有 4 道题目。

**代码位置**：`backend/app/routes/quiz.py` 第 75-90 行

```python
generated = await _generate_quiz_with_llm(chapter, requested_count, batch_id)
quiz_set = generated if generated else _build_default_batch(requested_count, batch_id)
```

**影响**：
- 用户期望 4 道题，但只能做 2 道
- 用户期望 10 道题，但只能做 5 道

**解决方案**：
1. 增加默认题库的题目数量（至少 50 道）
2. 改进 LLM 生成的可靠性
3. 添加更好的错误处理和日志

---

### 问题 2：题目的 `correct_answer` 字段为 undefined

**严重程度**：🔴 高

**现象**：
- API 返回的题目中，`correct_answer` 字段为 `undefined`
- 前端无法显示正确答案
- 判题时无法比对答案

**根本原因**：
后端返回的 `slim` 列表中没有包含 `correct_answer` 字段。

**代码位置**：`backend/app/routes/quiz.py` 第 100-110 行

```python
slim = [
    {
        'id': q['id'],
        'type': q['type'],
        'content': q['content'],
        'options': q.get('options'),
        'explanation': q.get('explanation', ''),
        'knowledge_point_id': q.get('knowledge_point_id', ''),
        'knowledge_point_name': q.get('knowledge_point_name', ''),
        # ❌ 缺少 'correct_answer' 字段！
    }
    for q in quiz_set[:requested_count]
]
```

**影响**：
- 前端无法显示正确答案
- 用户无法自己检查答案
- 判题逻辑无法工作

**解决方案**：
添加 `correct_answer` 字段到返回的数据中。

---

### 问题 3：题目类型不多样

**严重程度**：🟡 中

**现象**：
- 生成 10 道题目时，全部是单选题
- 没有多选题和填空题

**根本原因**：
1. LLM 生成失败，回退到默认题库
2. 默认题库中题型分布不均（4 道题中只有 1 道多选和 1 道填空）
3. 循环使用默认题库时，题型分布不变

**代码位置**：`backend/app/routes/quiz.py` 第 430-440 行

```python
def _build_default_batch(count: int, batch_id: str) -> list[dict[str, Any]]:
    src = _DEFAULT_QUIZ_SET  # 只有 4 道题
    out: list[dict[str, Any]] = []
    for i in range(count):
        base = dict(src[i % len(src)])  # 循环使用，题型不变
        base['id'] = f"dq_{batch_id}_{i+1}"
        out.append(base)
    return out
```

**影响**：
- 用户体验不好
- 无法测试多选题和填空题的判题逻辑

**解决方案**：
1. 增加默认题库的题目数量和多样性
2. 改进 LLM 生成的可靠性
3. 添加题型分布的随机化

---

### 问题 4：答案提交失败

**严重程度**：🔴 高

**现象**：
- 提交答案时返回失败
- 无法获取判题结果

**根本原因**：
因为 `correct_answer` 字段为 undefined，导致判题逻辑无法工作。

**影响**：
- 用户无法提交答案
- 无法获得判题反馈

**解决方案**：
修复问题 2（添加 `correct_answer` 字段）

---

### 问题 5：LLM 生成超时

**严重程度**：🔴 高

**现象**：
- 测试脚本在测试 6（多选题）时超时
- 可能是 LLM 调用超时

**根本原因**：
1. LLM 调用可能很慢
2. 超时保护可能不够有效
3. 没有正确的错误处理

**代码位置**：`backend/app/routes/quiz.py` 第 310-320 行

```python
try:
    text = await asyncio.wait_for(_collect_llm_text(prompt), timeout=15.0)
except asyncio.TimeoutError:
    print(f"DEBUG: LLM generation timeout")
    return None
```

**影响**：
- API 响应缓慢
- 用户体验差

**解决方案**：
1. 减少超时时间（从 15 秒改为 5 秒）
2. 改进 LLM 调用的效率
3. 添加更好的错误处理

---

### 问题 6：默认题库不足

**严重程度**：🟡 中

**现象**：
- 默认题库只有 4 道题
- 当 LLM 生成失败时，无法生成足够的题目

**根本原因**：
`_DEFAULT_QUIZ_SET` 只定义了 4 道题。

**代码位置**：`backend/app/routes/quiz.py` 第 30-70 行

**影响**：
- 用户无法获得足够的题目
- 系统可靠性差

**解决方案**：
增加默认题库到至少 50 道题，包含各种题型和知识点。

---

### 问题 7：没有正确的错误日志

**严重程度**：🟡 中

**现象**：
- 无法看到 LLM 生成失败的原因
- 无法调试系统问题

**根本原因**：
虽然添加了 DEBUG 日志，但没有被正确输出到控制台。

**影响**：
- 难以调试问题
- 难以监控系统状态

**解决方案**：
改进日志系统，使用 Python 的 logging 模块。

---

## 📊 测试结果统计

| 测试项 | 结果 | 问题 |
|--------|------|------|
| 初始加载 | ❌ 部分失败 | 返回题目数不符、缺少 correct_answer |
| 题目类型多样性 | ❌ 失败 | 全是单选题 |
| 题目内容质量 | ✅ 通过 | 无重复 |
| 答案提交 | ❌ 失败 | correct_answer 为 undefined |
| 错误答案判题 | ✅ 通过 | 能正确判为错误 |
| 多选题判题 | ⏱️ 超时 | LLM 调用超时 |
| 填空题判题 | ⏱️ 未测试 | - |
| 响应时间 | ⏱️ 未测试 | - |
| 错误处理 | ⏱️ 未测试 | - |
| 数据一致性 | ⏱️ 未测试 | - |

---

## 🔧 优先级修复清单

### 🔴 高优先级（必须修复）

1. **添加 `correct_answer` 字段到 API 返回**
   - 文件：`backend/app/routes/quiz.py`
   - 行数：100-110
   - 预计时间：5 分钟

2. **增加默认题库**
   - 文件：`backend/app/routes/quiz.py`
   - 行数：30-70
   - 预计时间：30 分钟

3. **改进 LLM 生成的可靠性**
   - 文件：`backend/app/routes/quiz.py`
   - 行数：289-340
   - 预计时间：1 小时

### 🟡 中优先级（应该修复）

4. **改进错误日志**
   - 文件：`backend/app/routes/quiz.py`
   - 预计时间：30 分钟

5. **减少 LLM 超时时间**
   - 文件：`backend/app/routes/quiz.py`
   - 行数：310-320
   - 预计时间：5 分钟

6. **改进题型分布**
   - 文件：`backend/app/routes/quiz.py`
   - 行数：289-340
   - 预计时间：30 分钟

---

## 📝 详细修复方案

### 修复 1：添加 `correct_answer` 字段

**当前代码**：
```python
slim = [
    {
        'id': q['id'],
        'type': q['type'],
        'content': q['content'],
        'options': q.get('options'),
        'explanation': q.get('explanation', ''),
        'knowledge_point_id': q.get('knowledge_point_id', ''),
        'knowledge_point_name': q.get('knowledge_point_name', ''),
    }
    for q in quiz_set[:requested_count]
]
```

**修复后**：
```python
slim = [
    {
        'id': q['id'],
        'type': q['type'],
        'content': q['content'],
        'options': q.get('options'),
        'correct_answer': q.get('correct_answer'),  # ← 添加这行
        'explanation': q.get('explanation', ''),
        'knowledge_point_id': q.get('knowledge_point_id', ''),
        'knowledge_point_name': q.get('knowledge_point_name', ''),
    }
    for q in quiz_set[:requested_count]
]
```

---

### 修复 2：增加默认题库

**当前**：4 道题

**目标**：50 道题，包含：
- 25 道单选题
- 15 道多选题
- 10 道填空题

**涵盖知识点**：
- 数据类型
- 函数定义和调用
- 循环语句
- 条件判断
- 列表操作
- 字典操作
- 字符串处理
- 模块导入
- 异常处理
- 文件操作

---

### 修复 3：改进 LLM 生成

**当前问题**：
- LLM 生成失败率高
- 超时时间太长（15 秒）
- 没有重试机制

**改进方案**：
```python
async def _generate_quiz_with_llm(chapter, count, batch_id):
    # 1. 改进提示词，确保 LLM 理解要求
    # 2. 添加重试机制（最多 3 次）
    # 3. 减少超时时间到 5 秒
    # 4. 改进错误处理和日志
    pass
```

---

## 🎯 建议

1. **立即修复**：添加 `correct_answer` 字段（5 分钟）
2. **立即修复**：增加默认题库（30 分钟）
3. **今天修复**：改进 LLM 生成（1 小时）
4. **本周修复**：改进错误日志和监控

---

## 📌 总结

当前答题系统存在 **7 个主要问题**，其中 **3 个是高优先级**。

**最严重的问题**：
1. API 返回的题目缺少 `correct_answer` 字段
2. 默认题库不足，导致题目数量不符
3. LLM 生成不可靠，导致系统经常回退到默认题库

**建议**：
- 先修复 API 返回字段问题（5 分钟）
- 再增加默认题库（30 分钟）
- 最后改进 LLM 生成（1 小时）

这样可以在 **1.5 小时内** 解决所有高优先级问题。

