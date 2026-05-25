# LLM 生成层详细流程

## 代码位置地图

```
backend/app/routes/quiz.py

┌─────────────────────────────────────────────────────────────┐
│ 第1部分：用户上下文构建                                      │
│ 函数：_build_personalized_quiz_context()                    │
│ 位置：第 430-510 行                                          │
│ 作用：收集用户学习数据                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 第2部分：LLM 生成层                                          │
│ 函数：async def _generate_quiz_with_llm()                   │
│ 位置：第 289-325 行                                          │
│ 作用：调用 LLM 生成题目                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 第3部分：讯飞星火调用                                        │
│ 函数：async def _collect_llm_text()                         │
│ 位置：第 345-352 行                                          │
│ 作用：调用讯飞星火模型                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 详细代码流程

### 第1部分：构建用户上下文（第 430-510 行）

```python
def _build_personalized_quiz_context() -> dict[str, Any]:
    # 1. 读取用户基本信息
    profile = read_json(settings.single_user_id, 'profile_snapshot.json', {})
    # 返回：{'goal': [...], 'knowledge_level': '初级', 'learning_preference': [...]}
    
    # 2. 读取用户的答题记录
    records = read_json(settings.single_user_id, 'quiz_records.json', [])
    
    # 3. 取最近30道题
    recent = records[-30:]
    
    # 4. 计算正确率（用于自适应难度）
    total = len(recent)
    correct_num = sum(1 for r in recent if bool(r.get('correct', False)))
    accuracy = (correct_num / total) if total > 0 else 0.0
    # 例如：accuracy = 0.65（65%正确率）
    
    # 5. 识别薄弱知识点（统计错题）
    weak_counter: dict[str, int] = {}
    for r in reversed(recent):
        if bool(r.get('correct', False)):
            continue  # 跳过正确的题
        kp = str(r.get('knowledge_point_id', '')).strip() or 'general'
        weak_counter[kp] = weak_counter.get(kp, 0) + 1
    # 例如：{'3.1': 8, '3.2': 5, '1.2': 2}
    
    # 6. 排序，获取错题最多的5个知识点
    weak_kps = [k for k, _ in sorted(weak_counter.items(), 
                                     key=lambda x: x[1], 
                                     reverse=True)[:5]]
    # 例如：['3.1', '3.2', '1.2']
    
    # 7. 查询掌握度最低的知识点（从数据库）
    mastery_rows = fetch_all(
        """
        SELECT knowledge_point_id, knowledge_point_name, score
        FROM mastery_records
        WHERE user_id = ?
        ORDER BY score ASC
        LIMIT 5
        """,
        (settings.single_user_id,),
    )
    # 返回：[
    #   {'knowledge_point_id': '3.1', 'knowledge_point_name': '函数定义', 'score': 0.42},
    #   {'knowledge_point_id': '3.2', 'knowledge_point_name': '函数调用', 'score': 0.55},
    #   ...
    # ]
    
    # 8. 确定难度等级（基于正确率）
    if accuracy >= 0.85:
        difficulty = 'higher'      # 正确率高 → 提高难度
    elif accuracy <= 0.45:
        difficulty = 'easier'      # 正确率低 → 降低难度
    else:
        difficulty = 'balanced'    # 中等难度
    
    # 9. 返回完整的用户上下文
    return {
        'goal': profile.get('goal', []),                          # 学习目标
        'knowledge_level': profile.get('knowledge_level', ''),    # 知识水平
        'learning_preference': profile.get('learning_preference', []),  # 学习偏好
        'recent_accuracy': round(accuracy, 4),                    # 最近正确率
        'difficulty_band': difficulty,                            # 难度等级
        'recent_wrong_knowledge_points': weak_kps,                # 错题知识点
        'weakest_mastery_points': weakest_mastery,                # 掌握度最低的知识点
    }
```

**返回的用户上下文示例：**
```json
{
    "goal": ["掌握函数概念", "能独立编写函数"],
    "knowledge_level": "初级",
    "learning_preference": ["例子驱动", "短练习"],
    "recent_accuracy": 0.65,
    "difficulty_band": "balanced",
    "recent_wrong_knowledge_points": ["3.1", "3.2", "1.2"],
    "weakest_mastery_points": [
        {
            "knowledge_point_id": "3.1",
            "knowledge_point_name": "函数定义",
            "score": 0.42
        },
        {
            "knowledge_point_id": "3.2",
            "knowledge_point_name": "函数调用",
            "score": 0.55
        }
    ]
}
```

---

### 第2部分：LLM 生成层（第 289-325 行）

```python
async def _generate_quiz_with_llm(chapter: str | None, count: int, batch_id: str) -> list[dict[str, Any]] | None:
    # 1. 确定章节名称
    chapter_text = chapter or 'Python 基础'
    # 例如：chapter_text = '函数返回值'
    
    # 2. 构建用户上下文（调用第1部分）
    context = _build_personalized_quiz_context()
    # 返回上面的 JSON 对象
    
    # 3. 构建提示词（Prompt Engineering）
    prompt = (
        '你是个性化题库引擎。请基于用户画像和作答轨迹，实时生成一组新题。'
        '必须输出严格 JSON 数组，不要任何额外文本。\n'
        f'要求：共 {count} 题，类型包含 single/multiple/fill_blank，字段必须有 '
        'type,content,options(填空可省略),correct_answer,explanation,knowledge_point_id,knowledge_point_name。\n'
        '约束：\n'
        '1) 同一批题不要重复考点和题干；\n'
        '2) 难度要符合用户当前水平，错题相关考点优先；\n'
        '3) 题目要能直接用于自动判题，答案明确；\n'
        '4) 语言简洁，避免歧义。\n'
        f'主题：{chapter_text}\n'
        f'用户上下文：{json.dumps(context, ensure_ascii=False)}'  # ← 关键！包含用户上下文
    )
    
    # 提示词的完整内容示例：
    # """
    # 你是个性化题库引擎。请基于用户画像和作答轨迹，实时生成一组新题。
    # 必须输出严格 JSON 数组，不要任何额外文本。
    # 
    # 要求：共 4 题，类型包含 single/multiple/fill_blank，字段必须有 
    # type,content,options(填空可省略),correct_answer,explanation,knowledge_point_id,knowledge_point_name。
    # 
    # 约束：
    # 1) 同一批题不要重复考点和题干；
    # 2) 难度要符合用户当前水平，错题相关考点优先；
    # 3) 题目要能直接用于自动判题，答案明确；
    # 4) 语言简洁，避免歧义。
    # 
    # 主题：函数返回值
    # 用户上下文：{
    #     "goal": ["掌握函数概念", "能独立编写函数"],
    #     "knowledge_level": "初级",
    #     "learning_preference": ["例子驱动", "短练习"],
    #     "recent_accuracy": 0.65,
    #     "difficulty_band": "balanced",
    #     "recent_wrong_knowledge_points": ["3.1", "3.2"],
    #     "weakest_mastery_points": [...]
    # }
    # """
    
    # 4. 调用讯飞星火 LLM（第3部分）
    text = await _collect_llm_text(prompt)
    # 返回 LLM 生成的 JSON 字符串
    
    # 5. 解析 JSON
    raw_list = _extract_json_list(text)
    if not raw_list:
        return None  # 解析失败，返回 None
    
    # 6. 验证和规范化每道题
    result: list[dict[str, Any]] = []
    for i, raw in enumerate(raw_list[:count], start=1):
        normalized = _normalize_question(raw, i, batch_id)
        if normalized:
            result.append(normalized)
    
    # 7. 返回生成的题目列表
    return result or None
```

---

### 第3部分：讯飞星火调用（第 345-352 行）

```python
async def _collect_llm_text(prompt: str) -> str:
    # 1. 初始化结果列表
    parts: list[str] = []
    
    # 2. 调用讯飞星火 LLM（流式响应）
    async for evt_type, payload in spark_lite.stream_chat_events(
        prompt,                    # 发送提示词
        mode='general',             # 使用通用模式
        history=[]                  # 无历史对话
    ):
        # 3. 处理文本事件
        if evt_type == 'text':
            chunk = str(payload.get('content', ''))
            if chunk:
                parts.append(chunk)  # 收集每个文本块
    
    # 4. 合并所有文本块
    return ''.join(parts).strip()
```

**讯飞星火的调用链：**
```
_collect_llm_text(prompt)
    ↓
spark_lite.stream_chat_events(prompt, mode='general', history=[])
    ↓
backend/app/llm.py 中的 SparkLiteAdapter
    ↓
讯飞星火 WebSocket API
    ↓
LLM 生成题目 JSON
    ↓
流式返回文本块
    ↓
合并成完整的 JSON 字符串
```

---

## 完整的调用链

```
用户访问练习页面
    ↓
前端请求：GET /api/quiz?chapter=函数返回值&count=4
    ↓
后端 get_quiz() 函数
    ↓
调用 _generate_quiz_with_llm('函数返回值', 4, batch_id)
    ├─ 第1步：context = _build_personalized_quiz_context()
    │   ├─ 读取 profile_snapshot.json（用户基本信息）
    │   ├─ 读取 quiz_records.json（答题记录）
    │   ├─ 计算正确率
    │   ├─ 识别薄弱知识点
    │   └─ 返回用户上下文 JSON
    │
    ├─ 第2步：构建提示词
    │   └─ prompt = "你是个性化题库引擎..." + context
    │
    └─ 第3步：text = await _collect_llm_text(prompt)
        ├─ 调用 spark_lite.stream_chat_events()
        ├─ 讯飞星火 LLM 处理提示词
        ├─ 生成 JSON 格式的题目
        └─ 返回完整的 JSON 字符串
    
    ↓
验证和规范化题目
    ├─ _extract_json_list(text)
    ├─ _normalize_question(raw, i, batch_id)
    └─ 返回 4 道题目
    
    ↓
保存题目集合
    ├─ write_json(latest_quiz_set.json)
    └─ append_jsonl(learning_events.jsonl)
    
    ↓
返回前端
    └─ [题目1, 题目2, 题目3, 题目4]
```

---

## 关键代码片段总结

| 部分 | 函数 | 位置 | 作用 |
|------|------|------|------|
| 用户上下文 | `_build_personalized_quiz_context()` | 第 430-510 行 | 收集用户学习数据 |
| LLM 生成 | `_generate_quiz_with_llm()` | 第 289-325 行 | 调用 LLM 生成题目 |
| 讯飞星火调用 | `_collect_llm_text()` | 第 345-352 行 | 调用讯飞星火模型 |
| LLM 适配器 | `SparkLiteAdapter` | `backend/app/llm.py` | 讯飞星火 WebSocket 连接 |

---

## 数据流向

```
用户基本信息 (profile_snapshot.json)
    ↓
┌─────────────────────────────────┐
│ _build_personalized_quiz_context │
└─────────────────────────────────┘
    ↓
用户上下文 (JSON)
    ↓
┌─────────────────────────────────┐
│ 构建提示词                        │
│ prompt = "..." + context         │
└─────────────────────────────────┘
    ↓
提示词 (String)
    ↓
┌─────────────────────────────────┐
│ _collect_llm_text(prompt)       │
│ → spark_lite.stream_chat_events │
│ → 讯飞星火 LLM                   │
└─────────────────────────────────┘
    ↓
LLM 生成的 JSON 字符串
    ↓
┌─────────────────────────────────┐
│ _extract_json_list()            │
│ _normalize_question()           │
└─────────────────────────────────┘
    ↓
验证后的题目列表
    ↓
返回前端
```

---

## 实际执行示例

### 输入
```
chapter = '函数返回值'
count = 4
```

### 第1步：构建用户上下文
```json
{
    "goal": ["掌握函数概念"],
    "knowledge_level": "初级",
    "learning_preference": ["例子驱动"],
    "recent_accuracy": 0.65,
    "difficulty_band": "balanced",
    "recent_wrong_knowledge_points": ["3.1", "3.2"],
    "weakest_mastery_points": [
        {"knowledge_point_id": "3.1", "knowledge_point_name": "函数定义", "score": 0.42}
    ]
}
```

### 第2步：构建提示词
```
你是个性化题库引擎。请基于用户画像和作答轨迹，实时生成一组新题。
必须输出严格 JSON 数组，不要任何额外文本。

要求：共 4 题，类型包含 single/multiple/fill_blank，字段必须有 
type,content,options(填空可省略),correct_answer,explanation,knowledge_point_id,knowledge_point_name。

约束：
1) 同一批题不要重复考点和题干；
2) 难度要符合用户当前水平，错题相关考点优先；
3) 题目要能直接用于自动判题，答案明确；
4) 语言简洁，避免歧义。

主题：函数返回值
用户上下文：{"goal": ["掌握函数概念"], ...}
```

### 第3步：讯飞星火生成
```json
[
    {
        "type": "single",
        "content": "以下哪个函数会返回 None？",
        "options": ["print('hello')", "len([1,2,3])", "max([1,2,3])", "sorted([3,1,2])"],
        "correct_answer": "print('hello')",
        "explanation": "print() 函数没有返回值，默认返回 None。",
        "knowledge_point_id": "3.1",
        "knowledge_point_name": "函数返回值"
    },
    ...
]
```

### 输出
```
4 道验证后的题目返回给前端
```

---

## 总结

**LLM 生成层的三个关键部分：**

1. **用户上下文构建** (`_build_personalized_quiz_context`)
   - 收集用户学习数据
   - 计算正确率、识别薄弱点
   - 返回 JSON 格式的上下文

2. **提示词构建** (`_generate_quiz_with_llm`)
   - 将用户上下文嵌入提示词
   - 指定题目要求和约束
   - 发送给 LLM

3. **讯飞星火调用** (`_collect_llm_text`)
   - 通过 WebSocket 连接讯飞星火
   - 流式接收 LLM 生成的题目
   - 返回完整的 JSON 字符串

这三个部分形成了一个**完整的个性化题目生成系统**！
