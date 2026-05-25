# SparkLearn 画像采集系统、记忆系统与上下文工程设计说明（第三阶段）

- 文档日期：2026-05-25
- 适用范围：`backend/app` 当前实现
- 目标：说明系统如何采集用户数据、如何沉淀记忆、如何做上下文工程喂给模型

## 1. 总体设计概览

SparkLearn 当前的数据闭环是：

1. 用户在画像页、练习页、路径页、辅导页、资源页产生行为数据。
2. 数据分别进入 `SQLite`（结构化核心数据）与 `JSON/JSONL`（快照、事件流、业务缓存）。
3. 对话/生成前按场景组装上下文（角色设定 + 最近会话 + 页面上下文 + 用户画像 + 可选知识库片段）。
4. 模型输出后再写回行为事件，驱动后续路径推荐、评测与画像更新。

核心存储位置：

- 结构化库：`backend/data/db/sparklearn.db`（`backend/app/config.py`）
- 用户文件区：`backend/data/users/single_user/*`（`backend/app/storage.py`）

---

## 2. 画像采集系统：如何采集用户数据

### 2.1 采集入口

1. 问卷建档接口：`POST /api/profile/onboarding`
- 代码：`backend/app/routes/profile.py`
- 入参维度：`goal, level, weak, preference, time`
- 行为：调用 `_build_profile_from_onboarding` 映射为画像字段，落库并写快照

2. 对话建档接口：`POST /api/profile/initiate` + `POST /api/profile/chat`
- 代码：`backend/app/routes/profile.py`
- 机制：`_sessions[session_id]` 暂存 3 轮会话；每轮用户消息写入会话内存
- 轮次完成后：`_build_profile_from_dialog(messages)` 从用户文本抽取关键特征并写入画像

3. 手动编辑接口：`PUT /api/profile`
- 代码：`backend/app/routes/profile.py`
- 采集范围：基础信息（`students` 表）+ 学习画像字段（`profiles` 表）
- 每次更新都会 `version + 1`

### 2.2 采集字段（当前实现）

`profiles` 表主要字段（`backend/app/db.py`）：

- `goal`（JSON 数组）
- `knowledge_level`
- `weak_points`（JSON 数组）
- `learning_preference`（JSON 数组）
- `cognitive_style`
- `daily_time`
- `practical_ability`
- `current_stage`
- `version`
- `updated_at`

`students` 表补充身份字段：`name/email/major/grade`。

### 2.3 采集后的落盘

1. 数据库 upsert：`_upsert_profile()` 写 `profiles`。
2. 快照文件：`profile_snapshot.json`（`write_json`）。
3. 事件日志：`learning_events.jsonl`，事件类型包含：
- `profile_onboarding`
- `profile_dialog_completed`
- `profile_updated`

结论：画像系统是“多入口采集 + 统一画像结构 + 版本化更新 + 事件留痕”。

---

## 3. 记忆系统：如何沉淀与调用用户记忆

当前实现是“分层记忆”，不是单一向量记忆。

### 3.1 短期记忆（会话内/请求内）

1. 画像对话建档短期记忆
- `_sessions[session_id]` 存最近轮次消息
- 仅用于建档过程，完成后释放

2. LLM 最近消息窗口
- `SparkLiteAdapter._stream_events_from_ws` 中 `messages = history[-6:] + 当前问题`
- 即每次最多带最近 6 条历史，控制 token 与时延

### 3.2 中期记忆（对话历史）

1. 辅导对话持久化
- 表：`tutor_conversations` + `tutor_messages`（`backend/app/db.py`）
- 接口：`/api/tutor/chat`、`/api/tutor/history`（`backend/app/routes/tutor_eval.py`）

2. 上下文回放策略
- `tutor_chat` 每次取最近 `12` 条消息组装 `history_for_model`
- 用户/助手角色映射为 model `user/assistant`

### 3.3 长期记忆（学习行为与能力轨迹）

1. 能力记忆：`mastery_records`
- 来源：练习判题后 `_update_mastery`（`backend/app/routes/quiz.py`）
- 用途：路径建议、报告薄弱点、教师端分析

2. 行为记忆：JSON/JSONL
- `quiz_records.json`：答题记录
- `task_progress.json`：任务推进
- `path_planning_history.json`：路径规划历史
- `learning_events.jsonl`：全局事件流
- `resource_usage.jsonl`、`video_events.jsonl`：资源/视频行为

结论：记忆系统是“窗口记忆 + 会话记忆 + 能力记忆 + 行为事件流”的组合。

---

## 4. 上下文工程：如何把数据组织成可用上下文

### 4.1 Tutor 场景上下文拼装（核心）

入口：`POST /api/tutor/chat`（`backend/app/routes/tutor_eval.py`）

拼装顺序：

1. 角色上下文：`_build_role_prompt(role)`
- 来源：`tutor_roles.persona/background/style_guide/rules`

2. 页面上下文：`_build_page_context_prompt(req.page_context)`
- 来源：前端传入当前页面信息（例如处于画像页/路径页）

3. 对话上下文：最近 12 条 `tutor_messages`

4. 合并策略：
- `merged_system_prompt = role_prompt + page_prompt`
- `history_for_model = [system] + 最近消息`
- 再调用 `spark_lite.stream_chat_events(req.message, history=history_for_model)`

这就是“角色化 + 场景化 + 历史化”的上下文工程主链路。

### 4.2 资源生成场景上下文拼装

入口：`POST /api/resources/generate`（`backend/app/routes/resources.py`）

机制：

1. 读取知识库上下文：`load_knowledge_context(file_ids)`（`backend/app/routes/knowledge.py`）
2. 将知识片段拼入用户 prompt（带“优先参考”指令）
3. 再交给 Spark/Coze 生成

知识库注入策略：

- 仅加载已 `indexed` 的 `knowledge_chunks`
- 按 `file_id + chunk_index` 顺序拼接
- `max_chars` 默认 5000，避免上下文无限增长

### 4.3 路径规划与报告场景上下文

1. 路径规划：`/api/path-planning/generate`
- 上下文来源：`profile + mastery_stats + target`
- 通过 prompt 要求模型返回结构化 JSON（phases/suggestions）

2. 报告摘要：`/api/report/ai-summary`
- 上下文来源：`profile + mastery weakest top5 + 周期统计`
- 生成学习分析总结

---

## 5. 数据采集到上下文消费的闭环示例

示例：用户在练习页刷题

1. 用户提交答案 -> `/api/quiz/submit`
2. 系统写 `quiz_records.json`、`learning_events.jsonl`
3. 同时更新 `mastery_records.score`
4. 后续在路径规划 `/api/path-planning/generate` 中读取 `mastery_records` 作为上下文
5. 在报告 `/api/report/ai-summary` 中读取薄弱点形成分析
6. 用户进入 tutor 提问时，再通过会话历史 + 页面上下文获得更精准答复

这就是“采集 -> 记忆 -> 上下文注入 -> 再采集”的循环。

---

## 6. 当前实现特点与边界

### 6.1 特点

1. 工程上实现了多源数据采集（画像、练习、路径、资源、会话）。
2. 具备可追溯事件流（JSONL）和可查询结构化核心数据（SQLite）。
3. 上下文工程已具备分场景拼装策略，不是单一 prompt。

### 6.2 当前边界

1. 对话建档画像抽取规则仍偏模板化（`_build_profile_from_dialog` 规则较简单）。
2. 记忆召回以“最近窗口 + 显式拼接”为主，尚未做语义检索型长期记忆召回。
3. 部分上下文字段存在字符编码历史问题（部分中文常量出现乱码），建议统一 UTF-8 源码与文案清洗。

---

## 7. 第三阶段可直接推进的优化方向

1. 画像抽取升级
- 将 `_build_profile_from_dialog` 从关键词规则升级为结构化抽取（JSON Schema + 置信度）。

2. 记忆检索升级
- 在 `learning_events.jsonl + tutor_messages + mastery_records` 之上增加“主题索引 + 语义召回”层，再注入上下文。

3. 上下文预算控制
- 为 Tutor/资源/报告分别设置 token 预算与截断优先级（角色 > 近期消息 > 历史摘要 > 长文知识片段）。

4. 画像-路径联动增强
- 由事件触发画像微更新（如连续错题自动追加 weak_points 候选），并写入待确认状态。

5. 观测与审计
- 给关键链路增加 `trace_id`，把一次生成过程中的输入来源、截断策略、输出结果关联起来，便于调试与评审展示。

---

## 8. 关键代码定位清单

- 画像采集：`backend/app/routes/profile.py`
- 辅导上下文工程：`backend/app/routes/tutor_eval.py`
- 路径规划上下文：`backend/app/routes/path_planning.py`
- 练习与掌握度记忆：`backend/app/routes/quiz.py`
- 资源生成与知识库注入：`backend/app/routes/resources.py`、`backend/app/routes/knowledge.py`
- LLM 历史窗口策略：`backend/app/llm.py`
- 存储层（JSON/JSONL）：`backend/app/storage.py`
- 数据库模型：`backend/app/db.py`
- 路径配置：`backend/app/config.py`
