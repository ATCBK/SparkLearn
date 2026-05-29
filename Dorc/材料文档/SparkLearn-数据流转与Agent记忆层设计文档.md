# SparkLearn 数据流转及 Agent 记忆层设计文档

- **文档状态**：正式版（基于当前代码仓库完整提取）
- **文档日期**：2026-05-29
- **适用版本**：当前 `develop-deeply-system` 分支
- **覆盖范围**：`backend/app/memory_engine.py`、`backend/app/storage.py`、`backend/app/routes/memory.py`、`backend/app/routes/tutor_eval.py`、`backend/app/trust_answer_controller.py`、`backend/app/trust_retriever.py`、`backend/app/trust_judge.py`、`backend/app/trust_router.py`、`backend/app/trust_schemas.py` 及实际数据文件

---

## 1. 设计总原则 ✅

SparkLearn 的数据流转与 Agent 记忆层设计遵循四条核心原则，这些原则贯穿系统所有模块的实现。

### 1.1 事实记录与智能理解解耦 ✅

系统将"客观事实记录"与"Agent 智能解读"严格分离。所有用户的学习行为——发送消息、提交练习、浏览资源、建档对话——首先通过统一的标准化接口进行记录，形成不可篡改的客观行为日志。当前实现中，这一职责由 `backend/app/storage.py` 的 `append_jsonl` 函数承担，它将每条行为以追加写入的方式记录到 `learning_events.jsonl` 文件中。

Agent（包括记忆引擎中的 `update_memory_from_turn`、评估模块、路径规划模块）不负责底层事实数据的采集和落盘。它们的工作起点是一份已经结构化的、可靠的事实数据集。Agent 的任务是在这些规范化事实之上完成解释（"这个学生连续三次做错函数题，说明函数是薄弱点"）、判断（"当前阶段应从基础巩固推进到进阶应用"）和决策（"推荐生成函数的图解型补强资源"）。

这一解耦设计的关键价值在于：当事实记录层稳定之后，可以独立替换或升级 Agent 的推理策略（如从规则切换到语义模型），而不影响数据采集的完整性和可靠性。同时，任何时候都可以回溯"系统为什么做出这个判断"——因为底层事实是完整的、不可变的。

### 1.2 事件驱动状态演化 ✅

SparkLearn 中的系统状态变化不是"哪里需要变就直接改哪里"，而是遵循统一的五步链路：

**行为发生 -> 事件记录 -> 状态更新 -> 评估判断 -> 页面渲染**

具体来说：用户在页面上触发操作（如提交一条消息到 `/api/tutor/chat`），后端路由首先将用户消息写入 `tutor_messages` 表（`db.py` 的 `execute`），然后将该行为记录为 `tutor_chat` 事件通过 `append_jsonl` 写入 `learning_events.jsonl`（`tutor_eval.py:775-784`）。接着，`update_memory_from_turn` 被调用，根据用户消息内容更新记忆引擎中的 Working Memory 和 Episodic Memory（`tutor_eval.py:785-790`），同时通过正则规则自动提取语义记忆（goals、preferences、constraints、facts），这一更新再次通过 `append_jsonl` 记录为 `memory_updated` 事件（`tutor_eval.py:791-800`）。之后，TrustAnswerController 根据证据检索结果判断置信度，最终模型输出通过 SSE 流式返回前端。

这条链路保证了系统在任何时间点的状态都可以通过回放事件流完全重建。它也是系统"可解释性"的基础：任何一个状态变更都可以追溯到触发它的具体事件。

### 1.3 Agent 读取的是"记忆上下文"，不是离散文件 ✅

底层虽然以 `memory_store.json`（JSON 文件）、`learning_events.jsonl`（JSONL 事件流）、SQLite 表等多种形式承载数据，但 Agent 不直接无序扫描这些文件。系统通过 `backend/app/memory_engine.py` 中统一的 `build_injected_context` 函数，将分散在多处的用户状态和学习过程数据，按当前场景组装成一段结构化的"记忆上下文提示文本"。

`build_injected_context`（`memory_engine.py:357-380`）的工作流程是：首先调用 `load_user_memory` 加载用户的四层记忆，然后调用 `search_memory` 按当前问题语义检索最相关的历史记忆条目，接着将语义记忆中的长期目标、学习偏好、约束条件、薄弱点、能力标签、当前学习阶段，以及检索到的相关记忆条目，按固定格式拼接成一段自然语言提示文本。这段文本最终作为系统提示的一部分注入到大模型调用中。

这层抽象的价值在于：底层即使从 JSON 文件升级到 PostgreSQL 或向量数据库，`build_injected_context` 的调用方式也不必改变。同时，不同场景（辅导、资源生成、报告分析）通过同一接口获取上下文，保证了数据口径的一致性。

### 1.4 动态数据服务闭环优化 ✅

SparkLearn 的动态数据不是为了堆积日志，而是为了支撑系统实现真正的闭环优化。这个闭环具体表现为四个方面：

- **画像随学随新**：用户每次完成建档对话（`profile_dialog_completed` 事件）、手动编辑档案（`profile_updated` 事件）或在辅导对话中表达新的学习目标/偏好（`update_memory_from_turn` 中的正则提取），画像数据都会即时更新。`memory_store.json` 的 `semantic` 层随时反映最新的用户特征，`version` 号递增以标记每次变更。

- **路径随评估调整**：用户在练习中连续错题（`submit_quiz` 事件中的 `correct: false`），会通过 `_update_mastery` 更新 `mastery_records` 表中的掌握度分数（`routes/quiz.py`）。路径规划接口 `/api/path-planning/generate` 每次被调用时，都会读取最新的 `profile` 和 `mastery_stats` 作为上下文输入，从而动态调整推荐的学习路径节点顺序。

- **资源随短板变化**：当 Agent 通过 `consolidate_memory`（`memory_engine.py:278-313`）识别出新的薄弱点（`weak_points`），或在评估报告中暴露短板后，资源生成接口 `/api/resources/generate` 会根据更新后的画像和薄弱点信息，生成针对性的补强资源，并可通过知识库片段（RAG）注入精准的教学内容。

- **报告随行为生成**：`/api/report/ai-summary` 和 `/api/evaluation/report` 每次被调用时，都会从 `mastery_records` 中提取当前最弱的TOP5知识点，结合周期统计数据（学习时长、正确率、完成率、连续天数），重新生成最新版的学习报告总结，而非返回缓存。

---

## 2. 数据流转全景 ✅

本章节详细描述 SparkLearn 中从用户操作到数据沉淀、再到模型消费和前端渲染的完整数据流转路径。

### 2.1 用户在前端触发行为

数据流起始于用户在前端页面上的一个操作。当前系统支持的操作类型包括：
- 在辅导对话页（Tutor Chat）发送一条消息（触发 `POST /api/tutor/chat`）
- 在练习页（Quiz）提交一道题的答案（触发 `POST /api/quiz/submit`）
- 在画像页完成问卷建档（触发 `POST /api/profile/onboarding`）或对话建档（触发 `POST /api/profile/chat`）
- 在资源页浏览、生成学习资源（触发 `POST /api/resources/generate`）
- 在路径页查看路径节点建议（触发 `path_node_advice` 事件）
- 在学习报告页刷新评估报告（触发 `POST /api/evaluation/refresh`）

前端通过 JSON 请求体将用户操作的具体内容（消息文本、答案选项、问卷字段等）发送到后端 FastAPI 路由。

### 2.2 后端路由接收请求

后端路由文件位于 `backend/app/routes/*.py`。以核心的辅导对话链路为例（`routes/tutor_eval.py:458-828`），`POST /api/tutor/chat` 路由处理函数 `tutor_chat` 接收 `TutorReq` 请求体，包含 `message`（用户消息）、`mode`（对话模式）、`conversation_id`、`role_id`、`file_ids`、`page_context`（前端页面上下文信息）、`workshop_enabled`（多智能体研讨会开关）等字段。

路由首先解析与验证参数，确定有效的会话语境（`_ensure_default_conversation`、`_resolve_effective_file_ids`），然后将用户消息写入 `tutor_messages` 表（`db.py` SQLite 写入，`tutor_eval.py:481-492`），更新会话的 `updated_at` 时间戳（`tutor_eval.py:495-498`）。如果是新会话的第一条消息，还会异步生成会话标题（`_generate_conversation_title`）。

### 2.3 统一事件记录（append_jsonl -> learning_events.jsonl）

路由在处理完核心逻辑后，调用 `backend/app/storage.py` 中的 `append_jsonl` 函数将行为记录为标准化事件。`append_jsonl` 的实现非常简洁（`storage.py:27-31`）：

```python
def append_jsonl(user_id: str, filename: str, record: dict[str, Any]) -> None:
    path = _user_dir(user_id) / filename
    line = json.dumps({"ts": now_iso(), **record}, ensure_ascii=False)
    with path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
```

该函数自动为每条记录添加 ISO 8601 格式的时间戳字段 `ts`，使用 `ensure_ascii=False` 保证中文字符不被转义，以追加模式（`"a"`）写入用户目录下的 JSONL 文件，确保不会覆盖已有数据。

以 `tutor_chat` 为例，对话完成后会先后写入两条事件（`tutor_eval.py:775-800`）：
1. `tutor_chat` 事件：包含 `conversation_id`、`role_id`、`question` 字段
2. `memory_updated` 事件：包含 `conversation_id`、`changed`（语义层变更数量）、`version`（记忆版本号）

从实际 `learning_events.jsonl` 文件可以看到，系统目前记录了以下事件类型：
- `profile_onboarding`：画像问卷建档完成
- `profile_dialog_completed`：对话式建档完成（含完整画像数据）
- `profile_updated`：画像手动修改
- `tutor_chat`：辅导对话提问
- `submit_quiz`：练习提交（含 `correct` 正误和 `judge_mode` 评判模式）
- `quiz_generated`：练习生成（含 `count` 和 `batch_id`）
- `quiz_favorite`：练习收藏
- `delete_wrong_quiz`：错题删除
- `path_node_advice`：路径节点建议（含 `mastery` 掌握度）
- `evaluation_refresh`：评估刷新
- `memory_updated`：记忆更新

### 2.4 状态更新（SQLite + JSON Snapshot）

事件记录完成的同时，系统同步更新两类状态存储：

**SQLite 结构化状态**（`backend/data/db/sparklearn.db`）：通过 `backend/app/db.py` 的 `execute` 和 `fetch_all`/`fetch_one` 函数操作。包括：
- `tutor_messages` 表：记录每条辅导对话的用户消息和助手回复
- `tutor_conversations` 表：会话元数据（标题、关联角色、时间戳）
- `tutor_roles` 表：自定义导师角色（persona、background、style_guide、rules）
- `profiles` 表：用户学习画像（goal、knowledge_level、weak_points、learning_preference、cognitive_style、daily_time、practical_ability、current_stage）
- `students` 表：用户基础信息（name、email、major、grade）
- `mastery_records` 表：知识点掌握度分数
- `knowledge_files` / `knowledge_chunks` 表：知识库文件和分块

**JSON 快照文件**（`backend/data/users/single_user/*`）：通过 `storage.py` 的 `read_json` 和 `write_json` 读写。包括：
- `memory_store.json`：四层记忆的完整状态快照（`memory_engine.py` 的 `MEMORY_FILENAME`）
- `profile_snapshot.json`：画像快照（`routes/profile.py` 中 `write_json` 写入）
- `quiz_records.json`：练习答题记录
- `task_progress.json`：任务推进状态
- `path_planning_history.json`：路径规划历史
- `learning_events.jsonl`：全局事件流
- `resource_usage.jsonl`：资源使用行为
- `video_events.jsonl`：视频学习行为

### 2.5 Agent 消费上下文（build_injected_context）

当 LLM 调用前需要用户记忆上下文时，系统调用 `build_injected_context(user_id, question, top_k=8)`（`memory_engine.py:357-380`）。该函数的工作流程在本章节仅概述，详细机制在第4章展开：

1. 加载用户四层记忆（`load_user_memory`）
2. 按当前问题语义检索相关记忆（`search_memory`，综合评分 = 语义相似度 x 0.6 + 时间近因性 x 0.2 + 重要性 x 0.15 + 置顶加成 x 0.05）
3. 从语义记忆层提取长期画像特征
4. 拼接为结构化提示文本返回

在 `tutor_chat` 中，`build_injected_context` 的结果作为 `memory_prompt`（`tutor_eval.py:521`），与 `role_prompt`（角色提示）和 `page_prompt`（页面上下文）合并为 `merged_system_prompt`（`tutor_eval.py:527`）。

### 2.6 模型输出（LLM / Chat）

上下文组装完成后，系统将合并后的系统提示 + 最近 12 条会话历史组装为 `history_for_model`（`tutor_eval.py:530-533`），通过两种方式调用大模型：

- **开启防幻觉控制（Trust Mode，默认）**：调用 `trust_answer_controller.plan()`（`tutor_eval.py:697-711`），该控制器依次执行查询路由（`route_query`）、证据检索（`retrieve_evidence`）、可回答性判定（`judge_answerability`）、引用渲染（`render_citations`），最终生成包含证据片段和建议的完整 prompt，再由 `spark_lite.stream_chat_events` 流式输出。

- **开放模式（Open Mode）**：直接将 `merged_system_prompt` + 文件上下文 + 用户消息送入模型，不做证据判定（`tutor_eval.py:659-695`）。

模型输出通过 SSE（Server-Sent Events）流式返回前端，包含 `text`（文本分块）、`confidence`（置信度渲染）、`citations`（引用来源）、`trust_meta`（信任元数据）、`done`（完成信号含完整响应数据）等事件类型。

### 2.7 写回事件（update_memory_from_turn）

模型回答完成后，系统调用 `update_memory_from_turn(user_id, user_msg, assistant_msg, page_context)` 将本轮对话写入用户记忆（`tutor_eval.py:785-790`）。该函数（`memory_engine.py:383-436`）执行以下操作：

1. 将用户当前问题写入 Working Memory（类型 `current_turn`）
2. 将"问题 + 助手回答摘要"写入 Episodic Memory（类型 `qa_event`）
3. 通过正则规则自动检测用户消息中是否包含目标（"目标/想要/希望/计划/打算"）、偏好（"我喜欢/偏好/更希望"）、约束（每天/每周 + 分钟/小时）、事实（"记住/请记住/帮我记住"），并将检测到的内容追加到 Semantic Memory 对应字段

记忆更新完成后，通过 `append_jsonl` 写入 `memory_updated` 事件到 `learning_events.jsonl`（`tutor_eval.py:791-800`）。

### 2.8 前端渲染更新

SSE 流的 `done` 事件（`tutor_eval.py:802-822`）携带了完整的响应数据，包括：
- `message`：助手消息的 ID、conversation_id、content 和 timestamp
- `memory`：记忆更新状态（`updated`、`changed`、`version`）
- `sources`：知识库文件引用来源
- `confidence`：置信度渲染数据
- `citations`：引用列表
- `trust_meta`：信任元数据（查询类型、风险等级、证据数量等）

前端 Next.js 应用接收这些数据后，在页面上渲染出完整的对话回答、置信度指示器、引用来源卡片，并更新本地的会话列表和消息列表。

---

## 3. 事件记录系统 ✅

### 3.1 事件记录的存储格式

SparkLearn 采用 JSONL（JSON Lines）格式记录所有学习事件，每条事件独占一行。这种格式的核心优势是：追加写入效率高（无需全量读取和重写）、可逐行流式处理、便于时间序列分析与审计回放。

文件存储于 `backend/data/users/{user_id}/learning_events.jsonl`。每条事件记录至少包含两个字段：
- `ts`：ISO 8601 格式的 UTC 时间戳（精确到微秒），由 `now_iso()` 生成（`db.py:27-28`）
- `type`：事件类型标识字符串

事件类型动态追加额外字段。例如 `tutor_chat` 事件携带 `conversation_id`、`role_id`、`question`；`submit_quiz` 事件携带 `quiz_id`、`correct`（布尔值）、`judge_mode`；`profile_onboarding` 事件携带完整的 `profile` 对象；`memory_updated` 事件携带 `changed` 和 `version`。

### 3.2 append_jsonl 函数实现

`append_jsonl` 函数定义于 `backend/app/storage.py:27-31`，核心实现如下：

1. 通过 `_user_dir(user_id)` 获取用户专属目录路径，按需创建
2. 使用 `json.dumps` 序列化，在 record 字典前自动添加 `ts` 时间戳字段
3. 设置 `ensure_ascii=False` 保证中文字符原样输出、不转为 `\uXXXX` 转义序列
4. 以追加模式 `"a"` 打开文件，使用 `utf-8` 编码（注意不带 BOM，与 `read_json` 的 `utf-8-sig` 读取配合）
5. 每行末尾追加换行符 `\n`

### 3.3 全部事件类型及触发条件

从 `backend/data/users/single_user/learning_events.jsonl` 实际数据中提取出的完整事件类型列表：

**profile_onboarding** -- 画像问卷建档完成
- 触发位置：`routes/profile.py` 的 `POST /api/profile/onboarding` 处理函数
- 携带字段：`profile`（完整画像对象，含 goal、knowledge_level、weak_points、learning_preference、cognitive_style、daily_time、practical_ability、current_stage、version）
- 示例：`{"ts":"2026-05-06T08:25:32.014239Z","type":"profile_onboarding","profile":{...}}`

**profile_dialog_completed** -- 对话式建档完成
- 触发位置：`routes/profile.py` 的 `POST /api/profile/chat` 处理函数（3轮对话后触发）
- 携带字段：`session_id`（会话ID）、`profile`（完整画像对象）
- 与 profile_onboarding 的差异：对话建档在完成前通过 `_sessions[session_id]` 暂存消息，`_build_profile_from_dialog(messages)` 从对话文本中抽取画像特征

**profile_updated** -- 画像手动修改
- 触发位置：`routes/profile.py` 的 `PUT /api/profile`
- 携带字段：`patch`（被修改的字段键值对）
- 每次更新 `version + 1`

**profile_chat** -- 对话建档过程中的单轮对话
- 触发位置：`routes/profile.py` 的 `POST /api/profile/chat`
- 携带字段：`session_id`、`question`（用户消息）、`stage`（当前轮次阶段）

**tutor_chat** -- 辅导对话提问
- 触发位置：`routes/tutor_eval.py:775-784`，`tutor_chat` 函数末尾
- 携带字段：`conversation_id`、`role_id`、`question`
- 每次用户发送辅导消息时触发

**tutor_message** -- 辅导对话完整消息
- 触发位置：`routes/tutor_eval.py` 的消息插入处
- 携带字段：`conversation_id`、`sender_role`（user/assistant）、`content`

**submit_quiz** -- 练习提交
- 触发位置：`routes/quiz.py` 的判题接口
- 携带字段：`quiz_id`（题目ID）、`correct`（布尔值，是否答对）、`judge_mode`（评判模式：`rule` 规则判定 / `llm_assist` 大模型辅助判定）
- 示例：`{"ts":"2026-04-20T07:12:08.471597Z","type":"submit_quiz","quiz_id":"gq2","correct":false,"judge_mode":"rule"}`

**quiz_generated** -- 练习批量生成
- 触发位置：`routes/quiz.py` 的练习生成接口
- 携带字段：`count`（生成数量）、`chapter`（章节名）、`batch_id`（批次标识）
- 示例：`{"ts":"2026-04-20T07:11:33.741318Z","type":"quiz_generated","count":5,"chapter":""}`

**quiz_favorite** -- 练习收藏
- 触发位置：`routes/quiz.py` 的收藏接口
- 携带字段：`quiz_id`、`favorite`（true/false）

**delete_wrong_quiz** -- 错题删除
- 触发位置：`routes/quiz.py` 的错题删除接口
- 携带字段：`quiz_id`、`removed_count`（删除数量）

**path_node_advice** -- 路径节点建议
- 触发位置：`routes/path_planning.py`
- 携带字段：`node_id`（节点标识）、`mastery`（掌握度分数，0.0~1.0）
- 示例：`{"ts":"2026-04-20T12:32:20.555448Z","type":"path_node_advice","node_id":"1.1","mastery":0.9}`

**path_update** -- 路径变更
- 触发位置：路径规划接口完成规划后的回调
- 携带字段：路径相关变更信息

**resource_view** -- 资源查看
- 触发位置：资源打开/完成的相关接口
- 记录在 `resource_usage.jsonl` 中同时写入 `learning_events.jsonl`

**report_generate** -- 报告生成
- 触发位置：`routes/report_service.py` 或 `routes/tutor_eval.py` 的报告生成相关接口

**evaluation_refresh** -- 评估刷新
- 触发位置：`routes/tutor_eval.py:885`，`POST /api/evaluation/refresh`
- 携带字段：`force`（是否强制刷新）

**memory_updated** -- 记忆更新
- 触发位置：`routes/tutor_eval.py:791-800`，`tutor_chat` 函数在 `update_memory_from_turn` 之后
- 携带字段：`conversation_id`、`changed`（语义层变更数量，0表示无新信息）、`version`（更新后的记忆版本号）
- 这是一条"元事件"，标记系统内部状态变更

---

## 4. Agent 记忆层设计（✅ 已重写适配个性化采集）✅

本章节是文档的核心，完整提取自 `backend/app/memory_engine.py` 的当前实现，说明 SparkLearn 的 Agent 记忆层如何存储、检索、注入和更新用户记忆。

### 4.1 记忆引擎架构 ✅

#### 4.1.1 文件位置与存储

记忆引擎的核心文件为 `backend/app/memory_engine.py`（共 437 行）。存储文件为 `memory_store.json`，位于每个用户的专属目录 `backend/data/users/{user_id}/memory_store.json` 下，采用 JSON 格式序列化。

文件常量定义于代码顶部（`memory_engine.py:11-14`）：
- `MEMORY_FILENAME = "memory_store.json"`
- `WORKING_LIMIT = 80`（工作记忆上限 80 条）
- `EPISODIC_LIMIT = 500`（情节记忆上限 500 条）
- `PERCEPTUAL_LIMIT = 300`（感知记忆上限 300 条）

#### 4.1.2 四层记忆模型

SparkLearn 采用分层记忆架构，每层有不同的容量限制、数据结构和设计目的：

**Working Memory（工作记忆）** -- 容量：最近 80 条
- 作用：当前会话内的短期上下文，捕捉用户当前的问题、意图和对话状态
- 数据结构：每条记录为包含 `id`、`type`、`content`、`source`、`tags`、`importance`（0~1）、`confidence`（0~1）、`created_at`、`last_accessed_at`、`access_count`、`pinned`、`expires_at` 的标准记忆项
- 写入策略：`update_memory_from_turn` 每次对话后将用户当前问题写入（类型 `current_turn`）
- 淘汰策略：容量超出时丢弃最旧条目（`del lst[0 : len(lst) - limit]`），`consolidate_memory` 将高重要性项提升至 Episodic
- 默认类型标签：`context`（如未指定 type 的默认值）

**Episodic Memory（情节记忆）** -- 容量：最近 500 条
- 作用：记录历史学习事件和问答事件，形成用户的学习时间线
- 数据结构：与 Working Memory 相同的标准记忆项结构
- 写入策略：`update_memory_from_turn` 每次对话后将"用户问题 + 助手回答摘要"写入（类型 `qa_event`）；`consolidate_memory` 将高重要性 Working 项提升后写入（类型 `promoted_working`）
- 淘汰策略：容量超出时丢弃最旧条目；`forget_memory` 按年龄和重要性过滤删除低频旧条目
- 默认类型标签：`learning_event`

**Semantic Memory（语义记忆）** -- 无硬性容量限制（每子字段上限 30 条）
- 作用：存储从用户行为中提炼出的稳定、长期的学习画像特征，是 Agent 进行个性化决策的核心依据
- 数据结构（`memory_engine.py:22-33` 的 `_default_memory` 定义）：
  - `goals`：学习目标列表（如"期末提分"）
  - `preferences`：学习偏好列表（如"实践型"、"视觉型"）
  - `constraints`：时间或资源约束列表（如"每天45分钟"）
  - `facts`：用户明确要求记住的事实
  - `skills`：已掌握的能力标签
  - `weak_points`：薄弱点列表
  - `learning_stage`：当前学习阶段（字符串，如"函数与模块"）
- 写入策略：由 `update_memory_from_turn` 的正则规则自动提取，和 `consolidate_memory` 从高价值 Episodic 中抽取
- 合并策略：`_append_unique` 函数保证不重复追加（大小写不敏感的文本比较），去重后删除最早的重复项

**Perceptual Memory（感知记忆）** -- 容量：最近 300 条
- 作用：存储多模态资产的摘要信息（文档内容片段、图片描述等），用于跨会话的素材回忆
- 数据结构：与 Working/Episodic 相同的标准记忆项结构
- 当前状态：V1 阶段已定义结构和读写接口，但尚未全量接入多模态解析链路（V2 规划）
- 默认类型标签：`asset_summary`

#### 4.1.3 记忆初始化结构

`_default_memory()` 函数（`memory_engine.py:17-33`）定义了新用户记忆库的初始结构：

```python
def _default_memory() -> dict[str, Any]:
    return {
        "version": 1,
        "updated_at": now_iso(),
        "working": [],
        "episodic": [],
        "semantic": {
            "goals": [],
            "preferences": [],
            "constraints": [],
            "facts": [],
            "skills": [],
            "weak_points": [],
            "learning_stage": "",
        },
        "perceptual": [],
    }
```

`version` 字段用于标记记忆结构的版本，每次 `consolidate_memory` 或 `forget_memory` 操作都会 +1，作为整体变更的审计标记。`updated_at` 记录最后一次变更的 ISO 时间。

#### 4.1.4 数据清洗工具函数

记忆引擎定义了三个关键的数据清洗函数，确保存入记忆的数据质量和一致性：

**_sanitize_text**（`memory_engine.py:36-37`）：接受任意类型的值，转为字符串后去除首尾空白，截取到指定最大长度。所有记忆项的 `content`、`source`、`type` 等字段都经过此函数处理，防止模型注入异常长度或特殊字符。

**_sanitize_tags**（`memory_engine.py:40-54`）：将标签列表标准化，每个标签截取到 40 字符，去重（大小写不敏感），输出上限 8 个。标签用于记忆分类和检索时的辅助匹配。

**_tokenize**（`memory_engine.py:57-59`）：对文本进行分词处理。用正则表达式 `[^0-9a-zA-Z一-鿿]+` 匹配非字母数字和中文字符作为分隔符，转为小写后返回 token 集合。同时支持中文和英文文本的检索需求。中文场景下通过 CJK 字符范围 `一-鿿` 保留了所有汉字作为有效 token。

**_append_unique**（`memory_engine.py:62-72`）：对列表进行去重追加。将待追加文本截取到 120 字符，与列表中已有条目进行大小写不敏感的完全匹配比较，重复则跳过。追加后若超出 limit 上限，删除最早的条目（`del lst[0 : len(lst) - limit]`）。

### 4.2 记忆注入机制 ✅

#### 4.2.1 build_injected_context 函数

`build_injected_context(user_id, question, top_k=8)` 是记忆注入的核心入口，定义于 `memory_engine.py:357-380`。它的完整工作流程如下：

**步骤一：加载记忆库** -- 调用 `load_user_memory(user_id)` 加载用户的四层完整记忆。`load_user_memory`（`memory_engine.py:75-134`）从 `memory_store.json` 读取原始数据，通过 `_normalize_item` 规范化每条记忆项的字段（补全缺失字段、设置默认值），并根据容量限制（WORKING_LIMIT/EPISODIC_LIMIT/PERCEPTUAL_LIMIT）截取最新的条目。

**步骤二：语义检索** -- 调用 `search_memory(user_id, question, types=["working", "episodic", "perceptual"], top_k=top_k)`，在所有三层记忆中按当前问题进行语义相关度搜索。`search_memory`（`memory_engine.py:234-275`）的评分公式为：

```
score = (semantic_score * 0.6) + (recency_score * 0.2) + (importance * 0.15) + (pinned_boost * 0.05)
```

其中 `semantic_score` 综合了：token 交并比（Jaccard 相似度）、子串匹配加分（0.65 加权）、CJK 字符重叠兜底（针对中文无空格的情况，逐字计算 Jaccard 相似度）。`recency_score` 基于创建时间的日期近似（当天创建得 1.0，否则递减）。打分后取 top_k（最多 50）条召回结果，并更新命中条目的 `access_count` 和 `last_accessed_at`。

**步骤三：组装提示文本** -- 按固定格式拼接上下文（`memory_engine.py:362-380`）：

```python
lines.append("你必须基于以下用户记忆进行个性化回答，并优先遵循当前用户最新意图。")
# 语义记忆各字段依次注入
if sem.get("goals"):       lines.append(f"长期目标: {json.dumps(sem['goals'][:8], ensure_ascii=False)}")
if sem.get("preferences"): lines.append(f"学习偏好: {json.dumps(sem['preferences'][:8], ensure_ascii=False)}")
if sem.get("constraints"): lines.append(f"约束条件: {json.dumps(sem['constraints'][:8], ensure_ascii=False)}")
if sem.get("weak_points"): lines.append(f"薄弱点: {json.dumps(sem['weak_points'][:8], ensure_ascii=False)}")
if sem.get("skills"):      lines.append(f"能力标签: {json.dumps(sem['skills'][:8], ensure_ascii=False)}")
if sem.get("learning_stage"): lines.append(f"当前学习阶段: {sem['learning_stage']}")
# 语义检索到的相关历史记忆
if recalls: lines.append(f"相关历史记忆: {json.dumps(recall_lines, ensure_ascii=False)}")
lines.append("若历史记忆与当前问题冲突，以当前问题为准，并在回答中体现调整。")
```

关键设计点：语义记忆每个字段限制输出前 8 条；检索到的历史记忆格式化为 `[memory_bucket|type] content` 的结构化行；最后追加冲突解决指令，防止过时的历史记忆覆盖用户的当前最新意图。

#### 4.2.2 按场景组装上下文的具体配方

**辅导场景（Tutor Chat，`routes/tutor_eval.py:520-529`）** 的完整上下文组装：

```
merged_system_prompt = role_prompt + page_prompt + memory_prompt
```

- **角色设定（role_prompt）**：`_build_role_prompt(role)` 从 `tutor_roles` 表中读取 persona、background、style_guide、rules 字段，拼接为角色描述文本
- **页面上下文（page_prompt）**：`_build_page_context_prompt(req.page_context)` 将前端传入的当前页面信息（如处于画像页/路径页）格式化为上下文指令
- **记忆上下文（memory_prompt）**：`build_injected_context(user_id, req.message, top_k=8)` 加载语义记忆 + 检索相关历史
- **文件上下文（file_prompt）**：`_retrieve_tutor_file_context(effective_file_ids, req.message)` 检索上传文件的相关片段（max_chars=3500, top_k=8）
- **会话历史**：最近 12 条 `tutor_messages`，按 `sender_role` 映射为 model 的 `user/assistant` 角色

**资源生成场景** 的上下文配方（`routes/resources.py`）：

- 用户画像偏好（`learning_preference`）+ 当前学习阶段 + 薄弱点（`weak_points`）
- 知识库片段（`load_knowledge_context(file_ids)`），按 `file_id + chunk_index` 顺序拼接，max_chars 默认 5000
- 章节上下文和目标知识点描述
- 资源生成指令（指定生成形式、难度、风格）

**报告场景（`/api/report/ai-summary`，`tutor_eval.py:893-929`）** 的上下文配方：

- 画像快照数据（`profiles` 表中的 goal、knowledge_level、weak_points、learning_preference、learning_stage）
- 掌握度最弱 TOP5（`mastery_records` 按 score ASC 排序取前 5）
- 周期统计指标（学习时长 `total_hours`、任务完成率 `task_completion_rate`、练习正确率 `quiz_accuracy`、连续学习天数 `streak_days`）
- 全量学习事件摘要（从 `learning_events.jsonl` 中统计不同类型事件频次）
- 生成指令（语气、字数、结构要求）

#### 4.2.3 memory_prompt 字符串拼接策略

`build_injected_context` 返回的是一段完整的自然语言提示文本，而非 JSON 结构。这样设计的考虑是：

1. **直接可注入**：返回字符串可以直接拼接到 system prompt 中，无需中间解析步骤
2. **LLM 友好**：自然语言指令比结构化 JSON 更容易被大模型理解和遵循
3. **故障降级**：即使记忆库为空或检索无结果，也只影响提示文本中"相关历史记忆"和语义特征段的内容，不影响其他上下文（角色设定、页面上下文）的正常注入

#### 4.2.4 与 RAG 系统（✅ 已重新设计）的上下文融合

记忆系统与 RAG 系统的职责边界明确，运行时采用分层融合策略：

- **Memory（记忆系统）**回答"这个学生是谁、怎么教"：提供用户画像、偏好、约束、薄弱点、学习阶段、历史交互记录
- **RAG（检索增强生成）**回答"这道题/这个知识点是什么"：提供教材文档片段、知识点讲解、题库内容

在 `tutor_chat` 的非 Trust 模式（Open Mode）中，记忆和 RAG 分别注入：
```
merged_system_prompt = role_prompt + page_prompt + memory_prompt
if file_context:
    merged_system_prompt += file_prompt  # RAG 片段
```

在 Trust 模式下，记忆和 RAG 通过 `TrustAnswerController._build_prompt` 统一融合（`trust_answer_controller.py:52-76`）：
```
[角色设定]
[页面上下文]
[学习记忆]        <-- memory_prompt
[证据片段]        <-- RAG 知识库 + 用户文件
[用户问题]
```

优先级：证据片段（RAG） > 学习记忆 > 角色设定。证据片段被标注为"优先依据"，记忆提供个性化视角，角色设定定义交互风格。

### 4.3 记忆更新机制 ✅

#### 4.3.1 update_memory_from_turn 函数

`update_memory_from_turn(user_id, user_message, assistant_message, page_context)` 是每轮对话完成后记忆回写的入口，定义于 `memory_engine.py:383-436`。其完整执行流程如下：

**步骤一：清洗输入** -- 用户消息截取到 500 字符（`_sanitize_text`）；从 `page_context` 字典中提取 `page` 和 `module` 字段作为标签。

**步骤二：追加 Working Memory** -- 调用 `add_memory_item`，以 `memory_type="working"` 写入用户当前问题，标签附加 `"current_turn"`，来源标记为 `"tutor_chat"`，重要性 0.6，置信度 0.9（`memory_engine.py:397-406`）。

**步骤三：追加 Episodic Memory** -- 调用 `add_memory_item`，以 `memory_type="episodic"` 写入"用户问题 + 助手回答摘要"的组合记录（助手回答截取到 200 字符），标签附加 `"qa_event"`，来源标记为 `"tutor_chat"`，重要性 0.65，置信度 0.8（`memory_engine.py:407-416`）。

**步骤四：LLM 辅助语义提取（基于正则规则）** -- 通过 `re.search` 在用户消息文本中进行模式匹配，自动识别并提取以下语义信息（`memory_engine.py:418-429`）：

- **目标提取**：`r"(?:目标|想要|希望|计划|打算)(?:是|为|:)?(.{2,50})"` -- 匹配"目标是…"、"想要…"等表达，提取 2~50 字符的目标描述，追加到 `semantic.goals`
- **偏好提取**：`r"(?:我喜欢|偏好|更希望)(.{2,50})"` -- 匹配"我喜欢…"、"偏好…"等表达，提取偏好描述，追加到 `semantic.preferences`
- **约束提取**：`r"(?:每天|每周).{0,12}(?:分钟|小时)"` -- 匹配"每天XX分钟"、"每周XX小时"等时间约束表达，追加到 `semantic.constraints`
- **记住事实**：`r"(?:记住|请记住|帮我记住)(.{2,80})"` -- 匹配用户明确的"记住"指令，将内容追加到 `semantic.facts`

对于每个语义字段的追加，都使用 `_append_unique` 函数确保去重。

**步骤五：持久化变更** -- 重新加载记忆库以获取最新状态，将更新后的 `semantic` 写回，`changed` 计数器累加被修改的字段数，`version + 1`（如有变更），最后通过 `write_json` 持久化（`memory_engine.py:431-435`）。

#### 4.3.2 add_memory_item 函数的写入策略

`add_memory_item`（`memory_engine.py:154-195`）根据 `memory_type` 参数决定写入的目标记忆层：

- `working`、`context`、`task_state` -> 写入 Working Memory，容量上限 `WORKING_LIMIT`（80）
- `perceptual`、`asset`、`document` -> 写入 Perceptual Memory，容量上限 `PERCEPTUAL_LIMIT`（300）
- 其他所有类型 -> 写入 Episodic Memory，容量上限 `EPISODIC_LIMIT`（500）

超出容量上限时，通过 Python 列表切片实现 FIFO 淘汰：`mem["working"] = mem["working"][-WORKING_LIMIT:]`。

#### 4.3.3 consolidate_memory 整合策略

`consolidate_memory`（`memory_engine.py:278-313`）负责将短期记忆中的高价值信息沉淀为长期语义记忆：

1. **工作到情节提升**：遍历 Working Memory 中所有条目，将 `importance >= threshold`（默认 0.7）的条目复制到 Episodic Memory（类型标记为 `promoted_working`），然后从 Working 中移除这些高重要性条目
2. **情节到语义抽取**：将 Episodic Memory 按 `importance` + `confidence` 降序排列，取前 30 条，根据内容和标签的关键词匹配，自动归类到语义记忆的对应字段：
   - 内容含"目标/计划/打算" 或 标签含"goal" -> `semantic.goals`
   - 内容含"喜欢/偏好/希望" 或 标签含"preference" -> `semantic.preferences`
   - 内容含"时间/约束/限制" 或 标签含"constraint" -> `semantic.constraints`
   - 内容含"薄弱/错题/不会" 或 标签含"weak_point" -> `semantic.weak_points`
   - 内容含"掌握/能力" 或 标签含"skill" -> `semantic.skills`
3. **版本递增**：完成整合后 `version + 1`，作为语义记忆变更的审计标记

#### 4.3.4 forget_memory 遗忘策略

`forget_memory`（`memory_engine.py:316-354`）负责清理低价值和过期记忆：

1. **Episodic 清理**：保留置顶项（`pinned=True`）、重要性 >= `importance_below`（默认 0.35）的条目、以及当月创建的条目（`created_at[:7] == now_iso()[:7]` 作为时间代理）。其余删除。
2. **Perceptual 清理**：保留置顶项和重要性 >= `importance_below` 的条目，其余删除。
3. **Working 清空**：如果 `clear_working=True`，清空全部工作记忆。
4. **容量控制**：清理后通过切片 `[-EPISODIC_LIMIT:]` 和 `[-PERCEPTUAL_LIMIT:]` 再次应用容量上限。

---

## 5. 上下文工程 ✅

本章节详细说明 SparkLearn 如何将分散在不同存储和模块中的用户数据，组装成不同场景下可直接注入大模型的上下文文本。

### 5.1 不同场景的上下文组装差异对比表

| 维度 | 辅导场景（Tutor） | 资源生成场景 | 报告场景 |
|------|------------------|-------------|---------|
| **入口函数** | `tutor_chat` in `tutor_eval.py:458` | `POST /api/resources/generate` | `POST /api/report/ai-summary` |
| **角色设定** | tutor_roles 完整 4 字段（persona/background/style_guide/rules） | 不注入 | 不注入 |
| **页面上下文** | `page_context` 前端传入（当前页面/模块） | 不注入 | 不注入 |
| **记忆上下文** | `build_injected_context(top_k=8)` 语义记忆 + 检索历史 | 仅偏好/学习阶段字段（非全量记忆注入） | 掌握度 TOP5 + 画像字段 |
| **会话历史** | 最近 12 条 tutor_messages | 不注入 | 不注入 |
| **知识库片段** | Trust 模式：evidence（知识库 + 用户文件），max_chars=5000；Open 模式：上传文件检索片段，max_chars=3500 | `load_knowledge_context(file_ids)`，max_chars=5000 | 不注入 RAG 片段 |
| **防幻觉证据** | Trust 模式下注入（evidence_block + confidence管控） | 无独立防幻觉层 | 无独立防幻觉层 |
| **统计指标** | 不注入 | 不注入 | total_hours / task_completion_rate / quiz_accuracy / streak_days |
| **输出方式** | SSE 流式（text/confidence/citations/trust_meta/done） | 直接文本生成 | SSE 流式（text/done） |

### 5.2 Token 预算管理策略

当前 V1 阶段 SparkLearn 通过以下机制控制上下文长度，防止超出模型的 Token 上限：

1. **会话历史截断**：`tutor_chat` 每次取最近 12 条消息（`tutor_eval.py:513-518`，`LIMIT 12`）。在 LLM adapter 层（`llm.py` 的 `SparkLiteAdapter`），进一步取最近 6 条历史（`history[-6:] + 当前问题`），在 WS 层做二次截断。

2. **记忆检索限流**：`build_injected_context` 的 `top_k` 默认 8 条记忆条目。语义记忆每字段取前 8 条（`sem['goals'][:8]`）。每条记忆项的 `content` 经过 `_sanitize_text` 截取到 500 字符。

3. **知识库片段限长**：资源生成的 RAG 上下文 `max_chars` 默认 5000。辅导场景用户文件检索 `max_chars` 默认 3500，`top_k=8` 片段。超出时停止追加（`tutor_eval.py:1640-1654`）。

4. **截断优先级（隐式）**：系统未显式定义 token 预算阈值，但通过上述限流形成隐式优先级——角色设定 + 页面上下文（固定长度，不被截断）> 近期会话（固定 12/6 条）> 记忆语义层（前8条/字段）> 检索记忆（top_k=8）> 知识库片段（max_chars 限制）。

5. **方向性建议**：第三阶段设计文档明确指出，后续可优化为显式的 Token 预算分配表，在不同场景下设定 `role:memory:history:rag` 的百分比分配和硬截断规则。

### 5.3 知识库片段（RAG）注入时机和数量控制

知识库片段在以下场景被注入上下文：

**辅导对话场景**：
- 用户上传文件后提问 -> `_retrieve_tutor_file_context(effective_file_ids, query)` 检索文件中的相关分块，注入 `file_prompt`（`tutor_eval.py:522-526`）
- 系统知识库 -> Trust 模式下通过 `retrieve_evidence` -> `retrieve_knowledge_context_async(knowledge_ids, query, max_chars=5000, top_k=8)` 检索知识库分块（`trust_retriever.py:17-18`）
- 数量控制：用户文件 `top_k=8` 片段、max_chars=3500；知识库 `top_k=8` 片段、max_chars=5000

**资源生成场景**：
- `load_knowledge_context(file_ids)` 加载已 `indexed` 的 `knowledge_chunks`，按 `file_id + chunk_index` 顺序拼接
- `max_chars` 默认 5000，截断超出的部分

**文件分块策略**：上传文件通过 `_extract_text_for_tutor`（`tutor_eval.py:1511-1523`）提取文本，支持 PDF（PyMuPDF fitz）、TXT、MD 格式。通过 `_chunk_text_for_tutor`（`tutor_eval.py:1526-1544`）按段落分块，每块 700 字符、重叠 120 字符，存入 `tutor_file_chunks` 表。检索时按顺序返回分块，不做语义排序（当前 V1 实现），达到 `max_chars` 或 `top_k` 上限即停止。

### 5.4 防幻觉证据注入（TrustAnswerController 的 evidence 注入流程）

防幻觉系统的证据注入遵循一个完整的五步流程：

**步骤一：查询路由（`trust_router.py:6-37`）** -- `route_query(query, mode)` 分析用户问题的类型和风险等级：

- 问题类型（`query_type`）：`knowledge_qa`（知识问答）、`resource_based`（基于资料）、`personalized_guidance`（个性化指导）、`open_ended`（开放问题）
- 风险等级（`risk_level`）：`high`（含"必须/一定/唯一"等绝对化表述）、`medium`（长问题/含问号）、`low`（简短问题）
- 返回 `RoutedQuery` 对象，包含 `need_knowledge`、`need_profile`、`need_memory`、`need_rules`、`need_user_files` 等布尔标识

**步骤二：证据检索（`trust_retriever.py:13-78`）** -- `retrieve_evidence(req, routed)` 根据路由结果并行检索多源证据：

- 知识库证据（`need_knowledge`）：从 `knowledge_chunks` 表检索相关分块，每个证据项包含 `id`、`source_type="knowledge"`、`title`、`snippet`、`score`
- 画像证据（`need_profile`）：从 `profile_snapshot.json` 读取画像摘要，`score=0.72`
- 规则证据（`need_rules`）：注入可信回答基线规则，`score=1.0`
- 用户文件证据（`need_user_files`）：从请求附带的 `user_file_sources` 列表导入

**步骤三：可回答性判定（`trust_judge.py:7-56`）** -- `judge_answerability(routed, evidence)` 根据检索到的证据质量和数量，计算置信度分数并确定响应级别：

- 置信度计算：`base(0.35) + evidence_ratio_bonus(0~0.25) + retrieval_score_bonus(0~0.25)`
- 分级阈值（`trust_rules.py`）：`>= 0.75` 为 High（grounded 模式，可给出清晰结论）、`0.55~0.75` 为 Medium（grounded_cautious 模式，需注明证据边界）、`< 0.55` 为 Low（low_confidence 模式，需降级表达）
- 无证据时分数封顶 0.54，缺画像时分数封顶 0.70

**步骤四：提示构建（`trust_answer_controller.py:52-76`）** -- `_build_prompt(req, decision, citations)` 将所有证据和上下文组装为最终 prompt：

```
[角色设定] {role_prompt}
[页面上下文] {page_prompt}
[学习记忆] {memory_prompt}
[证据片段] 1. [label] snippet ... (最多 6 条)
[用户问题] {query}
+ 置信度级别对应的回答风格指令
```

证据片段最多注入 6 条（`citations[:6]`），按编号排列。不同置信度级别注入不同的风格指令：High 级别要求"保持可验证表达"，Medium 要求"明确证据边界并提示核对"，Low 要求"使用保守语气、避免强确定性措辞"。

**步骤五：流式输出** -- `spark_lite.stream_chat_events` 将组装好的 prompt 发送给大模型，通过 SSE 流式返回文本块。同时在 SSE 流中发送 `confidence`（置信度信息）、`citations`（引用列表）、`trust_meta`（信任元数据）事件，前端可据此渲染置信度指示器和引用来源卡片。

---

## 6. 数据文件存储规范 ✅

本章节说明 SparkLearn 中所有持久化数据文件的存储约定，确保数据的一致性和可维护性。

### 6.1 文件路径约定

所有用户专属数据统一存放在 `backend/data/users/{user_id}/` 目录下。当前系统使用 `settings.single_user_id` 配置的单用户模式（`backend/app/config.py`），用户目录路径由 `storage.py` 的 `_user_dir` 函数确定（`storage.py:9-12`）：

```python
def _user_dir(user_id: str) -> Path:
    base = settings.data_dir / "users" / user_id
    base.mkdir(parents=True, exist_ok=True)
    return base
```

该目录下的主要文件：
- `memory_store.json`：用户四层记忆主文件
- `learning_events.jsonl`：全局学习事件流水
- `profile_snapshot.json`：画像快照
- `quiz_records.json`：练习答题记录
- `task_progress.json`：任务推进状态
- `path_planning_history.json`：路径规划历史
- `resource_usage.jsonl`：资源使用行为流水
- `video_events.jsonl`：视频学习行为流水
- `uploads/`：用户上传文件目录

全局共享数据：
- `backend/data/db/sparklearn.db`：SQLite 结构化数据库（`settings.db_path`）
- `KnowledgeRepo/`：知识库原始文件目录

### 6.2 JSON（read_json/write_json）vs JSONL（append_jsonl）的选择原则

SparkLearn 根据数据的使用模式选择存储格式：

**JSON 格式（完整读写）** -- 适用于需要频繁全量读取和整体替换的场景：
- `read_json`（`storage.py:15-19`）：读取整个 JSON 文件，使用 `utf-8-sig` 编码（兼容 BOM 头，`utf-8-sig` 会在读取时自动跳过 BOM）
- `write_json`（`storage.py:22-24`）：全量写入 JSON 文件，使用 `utf-8` 编码（不带 BOM），`ensure_ascii=False` 保证中文原样输出，`indent=2` 保证可读性
- 适用文件：`memory_store.json`、`profile_snapshot.json`、`quiz_records.json`、`task_progress.json` -- 这些文件通常作为"状态快照"，每次更新都需要完整覆盖

**JSONL 格式（追加写入）** -- 适用于事件流和行为日志场景：
- `append_jsonl`（`storage.py:27-31`）：追加一行 JSON 到文件末尾，每条记录独立，不修改已有内容
- 适用文件：`learning_events.jsonl`、`resource_usage.jsonl`、`video_events.jsonl` -- 这些文件是"只追加不修改"的流水记录，JSONL 格式避免了每次写入都全量读取和重写的开销

选择原则的边界清晰：**如果数据需要"当前完整快照"（如记忆库、画像、答题状态），使用 JSON；如果数据是"连续事件流"（如学习行为、资源使用），使用 JSONL**。

### 6.3 UTF-8 编码与 BOM 处理

SparkLearn 的编码策略兼顾写入和读取的不同需求：

- **写入**（`write_json` 和 `append_jsonl`）：统一使用 `encoding="utf-8"`，不添加 BOM（Byte Order Mark）。`ensure_ascii=False` 确保中文字符直接以 UTF-8 编码写入，不被转义为 `\uXXXX` 形式。

- **读取**（`read_json`）：使用 `encoding="utf-8-sig"`。`utf-8-sig` 是 Python 的一个特殊编码别名，它在 UTF-8 的基础上自动跳过开头的 BOM 标记（`\xef\xbb\xbf`）。这意味着无论文件是否包含 BOM 头，`read_json` 都能正确读取。

这种"写 UTF-8 不带 BOM，读 UTF-8-SIG 兼容 BOM"的策略，保证了系统在以下场景都能正常工作：手动编辑文件后保存（某些编辑器会自动加 BOM）、从外部来源导入文件、不同操作系统间的文件传输。

### 6.4 ensure_ascii=False 中文不转义

系统中所有 JSON 序列化调用都设置了 `ensure_ascii=False`，包括：

- `storage.py:24` 的 `write_json`：`json.dumps(payload, ensure_ascii=False, indent=2)`
- `storage.py:29` 的 `append_jsonl`：`json.dumps({"ts": now_iso(), **record}, ensure_ascii=False)`
- `memory_engine.py` 的 `build_injected_context` 中 `json.dumps(sem['goals'][:8], ensure_ascii=False)` 等多处

如果设置 `ensure_ascii=True`（Python 默认值），中文会被转义为 `期末提分`。在 `ensure_ascii=False` 下，中文直接以可读字符形式输出，两者语义等价但可读性和调试便利性相差巨大。

### 6.5 文件版本管理

`memory_store.json` 中的 `version` 字段是一个自增整数，在以下操作时递增：
- `consolidate_memory`：记忆整合完成时 +1
- `forget_memory`：遗忘清理完成时 +1
- `update_memory_from_turn`：语义记忆有变更时 +1
- `save_user_memory`：整体保存时保持现有版本（不做额外递增）

`profile_snapshot.json` 中的 `version` 字段在每次画像更新（`PUT /api/profile`、画像建档完成、对话建档完成）时 +1。

这些版本号的作用：可作为审计链的标记点，用于追踪"在哪个操作后系统状态发生了变更"；为后续冲突检测和增量同步提供基础。

---

## 7. 产品深度：已实现与规划 ✅/🔲

本章节以 ✅ 标记已完成实现，以 🔲 标记规划中但尚未完成的功能，说明 SparkLearn 当前的产品深度和演进方向。

### 7.1 ✅ RAG 系统重新设计

SparkLearn 的 RAG 系统在第三阶段完成了重新设计，实现了完整的知识库管理到上下文注入的闭环：

- **知识库管理**：`routes/knowledge.py` 提供文件上传、索引生成接口。上传文件（PDF/TXT/MD）后通过分块器将文本切割为固定大小的 chunks，存入 `knowledge_chunks` 表。
- **上下文检索**：`retrieve_knowledge_context_async` 函数按查询问题检索相关的知识分块，支持 max_chars 和 top_k 参数控制上下文大小。
- **与记忆系统的融合**：RAG 片段作为"证据"注入 TrustAnswerController 的 evidence_block，与 Memory 提供的个性化上下文分层互补——RAG 回答"这个知识点是什么"，Memory 回答"这个学生需要什么"。
- **文件级 RAG**：辅导对话中支持用户上传文件后提问，系统自动检索文件中的相关分块（`_retrieve_tutor_file_context`），并将检索结果作为上下文注入。

### 7.2 ✅ 多智能体记忆层重写适配个性化采集

第三阶段完成了记忆引擎的全面重写（`memory_engine.py`），从第一阶段设计文档的"初始记忆"概念落地为完整的四层记忆模型：

- **从概念到实现**：第一阶段文档定义了"初始记忆"的七层结构（user_identity、learning_profile、mastery_summary、task_context、recent_activity、resource_context、evaluation_context），第三阶段在代码中实现了 Working / Episodic / Semantic / Perceptual 的四层模型，并在 Semantic 层内融合了用户画像、掌握度摘要、任务上下文等子结构。
- **从静态读取到动态更新**：第一阶段设计中记忆是"被读取"的静态上下文，第三阶段实现了 `update_memory_from_turn`（对话后自动更新）、`consolidate_memory`（定期整合沉淀）、`forget_memory`（定期清理），使记忆成为持续演化的动态实体。
- **从单 Agent 到多 Agent 共享**：通过 `/api/memory/*` 统一 API 接口，画像 Agent、辅导 Agent、资源 Agent、评估 Agent 共享同一套记忆库，保证了数据口径的一致性。
- **个性化采集闭环**：用户通过画像问卷、对话建档、辅导对话中的自然表达、显式"记住"指令等多种渠道表达个性化特征，系统自动提取并沉淀到 Semantic Memory 中，后续所有 Agent 均能感知和应用这些特征。

### 7.3 ✅ 防幻觉系统完整实现

SparkLearn 的防幻觉系统（TrustAnswerController）在第三阶段完成了从路由到输出的全链路实现：

- **查询路由**（`trust_router.py`）：自动识别问题类型（知识问答/基于资料/个性化指导/开放问题）和风险等级（高/中/低）
- **证据检索**（`trust_retriever.py`）：从知识库、用户画像、业务规则、用户文件四个来源并行检索相关证据
- **可回答性判定**（`trust_judge.py`）：基于证据数量和质量计算置信度分数，输出 High/Medium/Low 三级
- **置信度渲染**（`trust_citation.py`）：将置信度结果渲染为可视化的前端显示信息（颜色、图标、提示文字）
- **MCP 工具调用**：Trust 模式下支持 MCP 插件系统，在证据不足时主动调用外部服务获取补充信息
- **降级回答策略**：低置信度时注入"保守语气、避免强确定性措辞"的风格指令，高置信度时"可给出清晰结论、保持可验证表达"
- **引用追踪**：每条证据片段附带 `source_type`、`source_id`、`title`、`snippet` 信息，前端可渲染引用来源卡片

### 7.4 🔲 逆构个性化系统（随手拍信息 -> 大模型逆构教学规划）

这是规划中的下一阶段功能，尚未实现。其核心思路是：

- **输入渠道扩展**：用户通过随手拍照（如教材页面、手写笔记、试卷题目）上传内容，系统自动通过多模态模型（OCR + 视觉理解）提取结构化信息。
- **逆构教学规划**：大模型根据提取到的信息（如用户手写笔记中的思维导图、错题本中的错误模式、教材页面的标注重点），反向构建用户的知识体系画像，"逆推"出用户的当前水平、知识盲区和学习偏好。
- **与现有系统的融合点**：逆构结果直接写入 Semantic Memory（weak_points、skills、learning_stage），驱动路径规划和资源推荐。
- **技术难点**：多模态识别的准确性、信息提取的结构化程度、逆推画像的可信度验证、与现有问卷建档和对话建档画像的冲突解决策略。

### 7.5 🔲 后续演进方向

从当前实现和 V1 限制出发，以下方向在后续版本中可推进：

1. **存储升级**：Working Memory 迁移到 Redis（高性能会话缓存），Episodic/Semantic 迁移到 PostgreSQL（支持更复杂的查询和事务），向量检索接入 Qdrant 或 Milvus（提升语义检索精度）。
2. **语义抽取升级**：将 `update_memory_from_turn` 中基于正则规则的关键词提取，升级为结构化抽取模型（JSON Schema + 置信度输出），提升语义记忆的信息提取准确率和覆盖率。
3. **显式 Token 预算管理**：为每个场景（辅导/资源/报告）定义显式 Token 分配比例（如 role:15%、memory:25%、history:30%、rag:30%），并建立硬截断规则和降级优先级。
4. **多 Agent 统一共享增强**：画像 Agent、讲题 Agent、资源 Agent、评估 Agent、推荐 Agent 全部统一走 `/api/memory/*` 接口，通过场景参数（scene）差异化裁剪上下文。
5. **审计与观测**：给关键链路增加 `trace_id`，将一次生成过程中的输入来源、截断策略、输出结果关联起来，便于调试和评审展示。
6. **逆构个性化系统**：实现随手拍 -> 多模态识别 -> 画像逆推 -> 教学规划联动的完整链路。

---

## 附录：关键代码定位清单

| 模块 | 文件路径 | 核心功能 |
|------|---------|---------|
| 记忆引擎 | `backend/app/memory_engine.py` | 四层记忆模型、检索、注入、更新、整合、遗忘 |
| 存储层 | `backend/app/storage.py` | JSON/JSONL 读写、用户目录管理 |
| 记忆路由 | `backend/app/routes/memory.py` | `/api/memory/*` REST API |
| 辅导对话 | `backend/app/routes/tutor_eval.py` | Tutor Chat 主链路、上下文组装、记忆注入与回写 |
| 画像路由 | `backend/app/routes/profile.py` | 问卷建档、对话建档、画像编辑 |
| 练习路由 | `backend/app/routes/quiz.py` | 练习生成、提交、判题、掌握度更新 |
| 路径规划 | `backend/app/routes/path_planning.py` | 路径生成、节点建议 |
| 资源生成 | `backend/app/routes/resources.py` | 个性化资源生成、知识库注入 |
| 知识库 | `backend/app/routes/knowledge.py` | 知识库管理、分块检索 |
| 报告服务 | `backend/app/routes/report_service.py` | 学习评估报告 |
| LLM 适配 | `backend/app/llm.py` | 讯飞星火 WS 连接、流式输出、历史窗口策略 |
| 防幻觉控制器 | `backend/app/trust_answer_controller.py` | TrustAnswerController 主控流程 |
| 查询路由 | `backend/app/trust_router.py` | 问题类型/风险等级分类 |
| 证据检索 | `backend/app/trust_retriever.py` | 多源证据并行检索 |
| 可回答性判定 | `backend/app/trust_judge.py` | 置信度计算与分级 |
| 信任数据模型 | `backend/app/trust_schemas.py` | TrustAnswerRequest/RoutedQuery/EvidenceBundle 等模型 |
| 数据库 | `backend/app/db.py` | SQLite 操作、`now_iso` 时间工具 |
| 配置 | `backend/app/config.py` | settings 全局配置 |
| 事件数据 | `backend/data/users/single_user/learning_events.jsonl` | 实际事件流水数据 |
