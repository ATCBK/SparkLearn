# SparkLearn 习题生成策略详解

## 整体架构

```
用户请求 → 后端API → LLM生成 → 数据验证 → 返回前端 → 用户做题 → 判题 → 更新画像
```

---

## 1. 习题生成的三层逻辑

### 第一层：用户画像分析（个性化上下文）

在生成习题前，系统会收集用户的学习数据：

```python
def _build_personalized_quiz_context():
    # 1. 读取用户基本信息
    profile = read_json(user_id, 'profile_snapshot.json')
    # 包含：学习目标、知识水平、学习偏好等
    
    # 2. 分析最近30道题的作答记录
    records = read_json(user_id, 'quiz_records.json')[-30:]
    
    # 3. 计算正确率（难度自适应的基础）
    accuracy = correct_count / total_count
    
    # 4. 识别薄弱知识点（错题相关考点）
    weak_kps = 统计错题中出现最多的知识点
    
    # 5. 查询掌握度最低的知识点
    weakest_mastery = 从数据库查询掌握度最低的5个知识点
    
    # 6. 确定难度等级
    if accuracy >= 0.85:
        difficulty = 'higher'  # 正确率高 → 提高难度
    elif accuracy <= 0.45:
        difficulty = 'easier'  # 正确率低 → 降低难度
    else:
        difficulty = 'balanced'  # 中等难度
```

**关键数据点：**
- 最近正确率：用于自适应难度
- 错题知识点：优先考察用户的薄弱点
- 掌握度评分：从0-1，反映用户对知识点的掌握程度
- 学习偏好：用户喜欢的学习方式（例子驱动、理论优先等）

---

### 第二层：LLM提示词设计（Prompt Engineering）

系统向讯飞星火模型发送精心设计的提示词：

```python
prompt = """
你是个性化题库引擎。请基于用户画像和作答轨迹，实时生成一组新题。
必须输出严格 JSON 数组，不要任何额外文本。

要求：
- 共 {count} 题
- 类型包含 single/multiple/fill_blank（单选、多选、填空）
- 字段必须有：type, content, options, correct_answer, explanation, 
  knowledge_point_id, knowledge_point_name

约束：
1) 同一批题不要重复考点和题干
2) 难度要符合用户当前水平，错题相关考点优先
3) 题目要能直接用于自动判题，答案明确
4) 语言简洁，避免歧义

主题：{chapter_text}
用户上下文：{
    'goal': ['掌握函数概念', '能独立编写函数'],
    'knowledge_level': '初级',
    'learning_preference': ['例子驱动', '短练习'],
    'recent_accuracy': 0.65,
    'difficulty_band': 'balanced',
    'recent_wrong_knowledge_points': ['函数返回值', '参数传递'],
    'weakest_mastery_points': [
        {'knowledge_point_id': '3.1', 'knowledge_point_name': '函数定义', 'score': 0.42},
        {'knowledge_point_id': '3.2', 'knowledge_point_name': '函数调用', 'score': 0.55}
    ]
}
"""
```

**提示词的关键要素：**

1. **角色定义**：告诉LLM它是"个性化题库引擎"
2. **输出格式**：明确要求JSON格式，便于解析
3. **题目类型**：指定支持的题型（单选、多选、填空）
4. **必需字段**：确保生成的题目包含所有必要信息
5. **约束条件**：
   - 不重复：避免同一批题目考察相同知识点
   - 自适应难度：根据用户正确率调整
   - 优先薄弱点：错题相关知识点优先出现
   - 答案明确：便于自动判题
6. **用户上下文**：提供用户的学习数据，让LLM做出个性化决策

---

### 第三层：数据验证与规范化

LLM生成的题目需要经过严格验证：

```python
def _normalize_question(raw, idx, batch_id):
    # 1. 验证题型
    q_type = raw.get('type')
    if q_type not in {'single', 'multiple', 'fill_blank'}:
        return None  # 无效题型，丢弃
    
    # 2. 验证题目内容
    content = raw.get('content', '').strip()
    if not content:
        return None  # 空题目，丢弃
    
    # 3. 验证选项（单选/多选必须有）
    if q_type in {'single', 'multiple'}:
        options = raw.get('options', [])
        if len(options) < 2:
            return None  # 选项不足，丢弃
    
    # 4. 验证答案
    correct_answer = raw.get('correct_answer')
    if not correct_answer:
        return None  # 无答案，丢弃
    
    # 5. 规范化并返回
    return {
        'id': f'gq_{batch_id}_{idx}',  # 生成的题目ID
        'type': q_type,
        'content': content,
        'options': options,
        'correct_answer': correct_answer,
        'explanation': raw.get('explanation', '建议回顾相关知识点'),
        'knowledge_point_id': raw.get('knowledge_point_id', 'general'),
        'knowledge_point_name': raw.get('knowledge_point_name', '通用能力'),
    }
```

**验证的目的：**
- 确保数据完整性
- 防止无效题目进入系统
- 标准化题目格式
- 为自动判题做准备

---

## 2. 生成流程详解

### 流程图

```
用户访问练习页面
    ↓
前端请求 /api/quiz?chapter=函数返回值&count=4
    ↓
后端接收请求
    ↓
构建用户画像上下文
    ├─ 读取用户基本信息
    ├─ 分析最近30道题
    ├─ 计算正确率
    ├─ 识别薄弱知识点
    └─ 确定难度等级
    ↓
调用讯飞星火LLM
    ├─ 发送精心设计的提示词
    ├─ 包含用户上下文
    └─ 等待LLM响应
    ↓
LLM生成JSON格式的题目
    ↓
验证和规范化题目
    ├─ 检查题型有效性
    ├─ 验证题目内容
    ├─ 验证选项和答案
    └─ 标准化格式
    ↓
保存题目集合
    ├─ 写入 latest_quiz_set.json
    └─ 记录学习事件
    ↓
返回前端（4道题目）
    ↓
前端显示题目
    ├─ 第1题：单选题
    ├─ 第2题：多选题
    ├─ 第3题：填空题
    └─ 第4题：单选题
    ↓
用户做题 → 提交答案
    ↓
后端判题
    ├─ 规则判题（精确匹配）
    ├─ LLM辅助判题（填空题）
    └─ 更新掌握度
    ↓
更新用户画像
    ├─ 记录答题结果
    ├─ 更新掌握度评分
    └─ 更新错题本
```

---

## 3. 自适应难度机制

### 难度调整策略

```
用户正确率 → 难度等级 → LLM生成策略

正确率 >= 85%  →  higher   →  生成更难的题目
45% < 正确率 < 85%  →  balanced  →  生成中等难度题目
正确率 <= 45%  →  easier   →  生成更简单的题目
```

### 例子

**场景1：用户正确率很高（85%+）**
- LLM会生成更复杂的题目
- 考察更深层的知识点
- 增加多选题和填空题的比例

**场景2：用户正确率很低（45%-）**
- LLM会生成更基础的题目
- 重点考察基本概念
- 增加单选题的比例

**场景3：用户正确率中等（45%-85%）**
- LLM会生成平衡的题目
- 混合各种题型
- 优先考察错题相关知识点

---

## 4. 薄弱知识点优先策略

### 识别薄弱点

```python
# 统计最近30道题中的错题
weak_counter = {}
for record in recent_records:
    if not record['correct']:  # 错题
        kp_id = record['knowledge_point_id']
        weak_counter[kp_id] += 1

# 排序，获取错题最多的5个知识点
weak_kps = sorted(weak_counter.items(), 
                  key=lambda x: x[1], 
                  reverse=True)[:5]
```

### 优先级

```
错题最多的知识点 > 掌握度最低的知识点 > 其他知识点

例如：
- 函数返回值：错了8次 → 优先级最高
- 参数传递：错了5次 → 优先级次高
- 循环语句：错了2次 → 优先级较低
```

---

## 5. 回退机制

如果LLM生成失败，系统会自动回退到默认题库：

```python
generated = await _generate_quiz_with_llm(chapter, count, batch_id)
quiz_set = generated if generated else _build_default_batch(count, batch_id)
```

**回退条件：**
- LLM超时
- LLM返回错误
- 生成的题目无法解析
- 生成的题目验证失败

**默认题库：**
```python
_DEFAULT_QUIZ_SET = [
    {
        'id': 'q1',
        'type': 'single',
        'content': '以下哪个是 Python 的可变数据类型？',
        'options': ['tuple', 'list', 'string', 'int'],
        'correct_answer': 'list',
        'explanation': 'list 是可变类型。',
        'knowledge_point_id': '1.2',
        'knowledge_point_name': '数据类型',
    },
    # ... 更多题目
]
```

---

## 6. 判题逻辑

### 规则判题（Rule-based）

```python
def _is_correct_rule(question, answer):
    q_type = question['type']
    
    if q_type == 'multiple':
        # 多选题：答案集合完全匹配
        expected = sorted([str(x).strip().lower() for x in question['correct_answer']])
        actual = sorted([str(x).strip().lower() for x in answer])
        return expected == actual
    
    elif q_type == 'fill_blank':
        # 填空题：忽略空格，不区分大小写
        expected = re.sub(r'\s+', '', question['correct_answer']).lower()
        actual = re.sub(r'\s+', '', answer).lower()
        return expected == actual
    
    else:  # single
        # 单选题：精确匹配
        return str(question['correct_answer']).strip().lower() == str(answer).strip().lower()
```

### LLM辅助判题（仅用于填空题）

```python
# 如果规则判题失败，对填空题进行LLM辅助判题
if q_type == 'fill_blank' and not rule_correct:
    llm_judge = await _judge_with_llm(question, answer)
    if llm_judge['correct'] and llm_judge['confidence'] >= 0.8:
        correct = True  # LLM认为正确且置信度高
        judge_mode = 'llm_assist'
```

---

## 7. 数据流向

### 写入的数据

```
quiz_records.json
├─ quiz_id: 题目ID
├─ answer: 用户答案
├─ correct: 是否正确
├─ correct_answer: 标准答案
├─ knowledge_point_id: 知识点ID
├─ judge_mode: 判题方式（rule/llm_assist）
└─ at: 答题日期

latest_quiz_set.json
├─ 当前题目集合（用于判题时查询）

learning_events.jsonl
├─ type: 事件类型（quiz_generated/submit_quiz）
├─ quiz_id: 题目ID
├─ correct: 是否正确
└─ timestamp: 时间戳

mastery_records (数据库)
├─ knowledge_point_id: 知识点ID
├─ score: 掌握度（0-1）
└─ last_updated: 更新时间
```

### 掌握度更新

```python
# 答题正确：掌握度 +0.05
# 答题错误：掌握度 -0.03
# 掌握度范围：0.0 - 1.0

score = max(0.0, min(1.0, current_score + delta))
```

---

## 8. 关键设计原则

### 1. **个性化**
- 基于用户画像生成题目
- 自适应难度
- 优先薄弱知识点

### 2. **可靠性**
- 严格的数据验证
- 完善的回退机制
- 错误处理和日志

### 3. **可扩展性**
- 支持多种题型
- 支持自定义知识点
- 支持不同的LLM模型

### 4. **用户体验**
- 快速响应（4道题目秒级生成）
- 清晰的反馈（正确/错误/解析）
- 进度追踪（完成题数、正确率）

---

## 9. 性能优化

### 缓存策略
```python
# 保存最新的题目集合，避免重复生成
latest_quiz_set.json
```

### 异步处理
```python
# 使用异步LLM调用，不阻塞主线程
async def _generate_quiz_with_llm(...)
```

### 超时保护
```python
# 如果LLM超时，自动回退到默认题库
try:
    generated = await asyncio.wait_for(
        _generate_quiz_with_llm(...), 
        timeout=5.0
    )
except asyncio.TimeoutError:
    generated = None
```

---

## 10. 总结

SparkLearn的习题生成系统是一个**多层次、自适应、个性化**的系统：

1. **数据层**：收集用户学习数据（正确率、错题、掌握度）
2. **AI层**：使用讯飞星火LLM生成个性化题目
3. **验证层**：严格验证生成的题目
4. **判题层**：规则判题 + LLM辅助判题
5. **反馈层**：更新用户画像，为下一轮生成提供数据

这样形成了一个**闭环**：
```
做题 → 判题 → 更新画像 → 生成更好的题目 → 做题 → ...
```

每一轮都会让系统更了解用户，生成的题目也会越来越符合用户的学习需求。
