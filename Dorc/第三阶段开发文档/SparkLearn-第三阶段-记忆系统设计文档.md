# SparkLearn 记忆系统设计文档（V1 落地版）

- 日期：2026-05-25
- 阶段：第三阶段
- 目标：让多智能体真正“记住并使用”用户个性化信息，而非仅保存聊天记录

## 1. 设计目标

本次记忆系统改造目标：

1. 可存储：支持结构化写入用户长期与短期记忆。
2. 可检索：回答前按相关度召回用户记忆。
3. 可整合：把高价值短期记忆沉淀为长期语义记忆。
4. 可遗忘：清理低价值与过期记忆，控制噪声。
5. 可注入：将召回记忆拼装为上下文注入到 Agent 推理链路。

## 2. 系统架构

### 2.1 分层

1. 接入层
- 对话输入、学习行为、资源/文件行为。

2. 记忆类型层
- Working Memory：会话内短期上下文。
- Episodic Memory：学习事件、问答事件。
- Semantic Memory：稳定画像、偏好、约束、能力标签。
- Perceptual Memory：文档/图片等多模态资产摘要（V1 预留）。

3. 存储层（V1）
- `backend/data/users/<user_id>/memory_store.json`
- 采用统一 JSON 结构，便于快速落地与后续迁移。

4. 检索与注入层
- 多路召回 + 加权排序。
- 生成注入上下文文本，参与 `tutor_chat` 系统提示拼装。

## 3. 数据模型

文件：`backend/app/memory_engine.py`

### 3.1 顶层结构

```json
{
  "version": 1,
  "updated_at": "...",
  "working": [],
  "episodic": [],
  "semantic": {
    "goals": [],
    "preferences": [],
    "constraints": [],
    "facts": [],
    "skills": [],
    "weak_points": [],
    "learning_stage": ""
  },
  "perceptual": []
}
```

### 3.2 通用记忆项字段

- `id`
- `type`
- `content`
- `source`
- `tags`
- `importance`（0~1）
- `confidence`（0~1）
- `created_at`
- `last_accessed_at`
- `access_count`
- `pinned`
- `expires_at`

## 4. 核心流程

### 4.1 回答前注入（Retrieval + Injection）

在 `POST /api/tutor/chat` 中：

1. 读取角色提示词（role prompt）
2. 读取页面上下文（page context）
3. 调用 `build_injected_context(user_id, question)` 召回记忆并构造记忆提示
4. 将三者合并为系统提示：
- `role_prompt + page_prompt + memory_prompt`
5. 再拼接最近对话历史送入模型

接入位置：`backend/app/routes/tutor_eval.py`

### 4.2 回答后回写（Write-back）

`/api/tutor/chat` 完成回答后：

1. 调用 `update_memory_from_turn(...)`
- 写入当前回合 Working/Episodic
- 识别用户显式“记住/目标/偏好/约束”并更新 Semantic
2. 记录 `memory_updated` 事件到 `learning_events.jsonl`
3. SSE `done` 中返回 memory 更新状态

### 4.3 整合（Consolidate）

`consolidate_memory` 逻辑：

1. 把高重要性的 Working 项提升到 Episodic。
2. 从高价值 Episodic 提取稳定模式，更新 Semantic：
- goals / preferences / constraints / weak_points / skills

### 4.4 遗忘（Forget）

`forget_memory` 逻辑：

1. 删除低重要性且非 pinned 的旧 Episodic。
2. 删除低重要性且非 pinned 的 Perceptual。
3. 可选清空 Working。

## 5. 检索排序策略

函数：`search_memory(...)`

综合评分：

- 语义相关度：0.6
- 时间近因性：0.2
- 重要性：0.15
- 固定加成：pinned +0.05

说明：
- 中文场景增加了子串/字符重叠兜底，降低“中文无空格导致召回失败”的概率。
- 命中后更新 `access_count` 与 `last_accessed_at`。

## 6. 对外 API（MemoryService）

新增路由：`backend/app/routes/memory.py`

前缀：`/api/memory`

1. `GET /api/memory`
- 获取完整记忆库。

2. `GET /api/memory/profile/{user_id}`
- 获取语义记忆（画像层）。

3. `POST /api/memory/add`
- 手动新增记忆项。

4. `POST /api/memory/search`
- 按 query 检索记忆。

5. `POST /api/memory/inject-context`
- 生成可直接注入 Prompt 的记忆上下文。

6. `POST /api/memory/consolidate`
- 执行记忆整合。

7. `POST /api/memory/forget`
- 执行记忆遗忘清理。

8. `PUT /api/memory/profile`
- 手动修订语义记忆。

## 7. 已完成代码改造清单

1. 新增记忆引擎
- `backend/app/memory_engine.py`

2. 新增记忆路由
- `backend/app/routes/memory.py`

3. 注入主应用
- `backend/app/main.py` 增加 `memory_router`

4. 接入 Tutor 主链路
- `backend/app/routes/tutor_eval.py`
  - 回答前注入记忆上下文
  - 回答后更新记忆并写事件

## 8. 与 RAG 的职责边界

- Memory：用户个性化历史、偏好、能力与学习事件。
- RAG：外部知识资料（教材、文档、题库）。

运行时策略：
- 先用 Memory 回答“这个学生是谁、怎么教”。
- 再用 RAG 回答“这道题/这个知识点是什么”。

## 9. V1 限制与 V2 规划

### 9.1 V1 限制

1. 存储后端为 JSON 文件，适合单用户/原型环境。
2. 未接入向量数据库，语义检索仍是轻量策略。
3. Perceptual 仅定义结构与接口，尚未全量接入多模态解析链路。

### 9.2 V2 演进建议

1. 存储升级
- Working -> Redis
- Episodic/Semantic -> PostgreSQL
- 向量检索 -> Qdrant/Milvus

2. 记忆抽取升级
- 用结构化抽取模型替代正则规则。

3. 冲突与版本
- 增加语义记忆冲突策略（新值覆盖 + 审计链）。

4. 多 Agent 共享
- 规划 Agent、讲题 Agent、资源 Agent 统一走 `/api/memory/*`。

## 10. 验收标准（本次）

1. 用户表达偏好后，后续对话可感知并应用。
2. 用户明确“请记住”后，系统可在注入上下文中召回。
3. 对话问答结束后，记忆文件持续增长且结构合法。
4. 具备手动修订、整合、遗忘接口，支持可控运营。
