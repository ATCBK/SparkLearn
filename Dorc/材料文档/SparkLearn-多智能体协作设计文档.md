# SparkLearn 多智能体协作设计文档

> 文档版本：v1.0
> 创建日期：2026-05-29
> 对应分支：develop-deeply-system
> 文档定位：面向开发人员和技术评审，说明 SparkLearn 多智能体协作体系的架构设计、实现细节与代码位置

---

## 1. 多智能体概述

### 1.1 为什么选择多智能体架构而非单模型调用

SparkLearn 是一个个性化学习平台，其核心业务链路涉及"画像构建--路径规划--资源生成--学习互动--练习评测--反馈报告--画像更新"七个环节。如果采用传统的单模型调用模式（即每次请求直接拼装 prompt 调用大模型），会面临以下结构性问题，这些问题在学而思 V3 技术产品方案设计阶段已被明确定位并形成共识。

单模型调用的第一个痛点是**无法展示角色分工**。在单模型模式下，系统对外表现为一个黑箱：用户发送消息，模型返回回答。评审人员或学习者本人无法感知到系统内部是否做了画像分析、是否参考了学习记忆、是否进行了证据检索。对于教育场景而言，学习者有权知道"系统为什么给出这个建议"，教师端需要看到"对学生学习状况的判断依据"，而单模型调用无法提供这种透明度。

第二个痛点是**步骤协作不可见**。SparkLearn 的学习链路天然是多步骤的：例如，辅导问答需要先理解学员意图，再读取画像和记忆，再规划教学步骤，再生成回答，最后做质量核验。单模型调用将所有这些步骤压缩到一次模型推理中，中间推理过程完全不可见，也就无法验证正确性。更重要的是，当某个环节出现问题时（例如画像信号缺失导致回答不够个性化），无法精准定位是哪个环节的缺陷。

第三个痛点是**过程不可观测、结果不可回放**。在答辩和演示场景下，需要展示"系统做了什么--为什么会这样回答--中间每一步决策是什么"的完整证据链。单模型调用无法提供这种执行级别的观测能力。

### 1.2 多智能体架构的核心优势

针对上述痛点，SparkLearn 选择了多智能体架构（Multi-Agent Architecture），其核心设计思路来自 `Dorc/第一阶段项目开发文档/学而思｜技术产品方案 V3-多智能体落地版.md` 第 3 章的系统定义：

首先，**可视化编排**是核心优势。系统新增统一的编排层 `Orchestrator`，所有智能辅导与资源生成请求必须进入编排层，不允许直接绕过编排层调用模型。编排层负责意图识别与任务拆解、Workflow 路由（辅导流 / 资源流）、Agent 与 Tools 调度、执行日志采集与回放、失败重试与降级策略。前端可以实时展示拓扑节点（可折叠）、当前执行节点高亮、节点状态（pending/running/success/failed）、耗时和中间结果摘要。

其次，**执行证据链**是多智能体区别于单模型的核心竞争力。每次请求输出完整的可视化执行证据，包括节点名称、执行状态、开始与结束时间、耗时、中间结果摘要、最终产物引用。这些证据链的数据模型在后端执行日志中以结构化形式存储，支持页面回放和答辩证据展示。

第三，**角色可插拔**的设计保证了系统的灵活演进。六个核心 Agent 各自独立，接口标准化，新增一个 Agent 角色或替换底层实现（例如从 Spark Lite 切换为其他模型）不需要改动其他 Agent。这种低耦合使得团队可以并行开发不同 Agent 的能力。

### 1.3 架构层面的关键设计决策

多智能体在 SparkLearn 中的定位不是"多个模型同时回答一个问题取其优"，而是"将学习辅导的各环节拆分为可独立执行、可观测、可替换的 Agent 角色，由编排层统一调度"。这一决策在 V3 方案的第 3.1 节被固化，并在后续第三阶段的实施中贯穿始终。

---

## 2. Agent 角色体系 ✅

SparkLearn 当前定义了 6 个核心 Agent 角色，每个角色有明确的职责边界、输入输出规格和代码位置。以下逐一说明。

### 2.1 IntentAgent -- 意图识别智能体 ✅

**职责**：识别用户意图、任务类型、约束条件。IntentAgent 是编排链路的第一个节点，负责分析用户输入的原始文本，判断用户是在提问知识、请求个性化建议、还是需要资源生成。其判断结果直接影响后续 Workflow 的路由选择。

**输入**：用户原始消息文本（`query: str`）、当前交互模式（`mode: str`，如 `knowledge_qa`、`step_hint`、`image_gen`）。

**输出**：`RoutedQuery` 对象，包含 `query_type`（`knowledge_qa` / `resource_based` / `personalized_guidance` / `open_ended`）、`risk_level`（`high` / `medium` / `low`）、以及后续环节的开关标志（`need_knowledge`、`need_profile`、`need_memory`、`need_rules`、`need_user_files`）。

**代码位置**：`backend/app/trust_router.py` 第 6--37 行，函数 `route_query(query, mode)`。该函数在 TrustAnswerController 的 `plan` 流程中作为第一步被调用。意图识别的逻辑是规则驱动的：通过关键词匹配（如"我适合"、"根据我的情况"、"这份资料"、"什么是"、"原理"等）和长度/标点特征来推断 `query_type` 和 `risk_level`。

**设计考虑**：当前意图识别采用规则引擎而非模型推理，原因是（1）降低首步延迟；（2）规则透明可解释；（3）在教育场景中用户意图类型较为集中，规则覆盖率高。后续版本可考虑引入轻量级分类模型做兜底。

### 2.2 ProfileAgent -- 画像智能体 ✅

**职责**：读取并更新学生画像信号，为其他 Agent 提供个性化的学习上下文。ProfileAgent 是 SparkLearn"因材施教"理念的技术锚点，它负责回答"这个学生是谁、处于什么阶段、偏好什么学习方式、薄弱点在哪里"。

**输入**：用户 ID（`user_id`）、当前会话上下文。

**输出**：结构化的画像快照，包含 `goal`（学习目标）、`knowledge_level`（知识水平）、`weak_points`（薄弱点）、`learning_preference`（学习偏好）、`cognitive_style`（认知风格）、`daily_time`（每日投入时间）、`practical_ability`（实践能力）、`current_stage`（当前学习阶段）。

**代码位置**：
- `backend/app/routes/profile.py` -- 画像的 CRUD 路由。`POST /api/profile/onboarding` 完成初次画像采集（第 50 行），`POST /api/profile/update` 支持画像更新（约第 100 行），`POST /api/profile/initiate` 启动画像聊天采集流程（第 59 行）。
- `backend/app/memory_engine.py` -- 记忆引擎与 ProfileAgent 联动。`build_injected_context(user_id, question, top_k=8)` 函数在回答前检索并拼装记忆上下文，其中的 `semantic` 记忆层（包含 goals、preferences、constraints、facts、skills、weak_points、learning_stage）直接对应画像信号。
- `backend/app/routes/tutor_eval.py` 第 1094--1121 行，`_load_profile_snapshot()` 和 `_profile_summary_text()` 函数在 Workshop 模式中负责加载并格式化画像数据，供研讨会的参与智能体使用。

**ProfileAgent 与 MemoryEngine 的联动**：记忆系统采用四层记忆模型（Working / Episodic / Semantic / Perceptual），其中 Semantic Memory 存储了画像的核心稳定信号。`update_memory_from_turn()` 在每次对话结束后自动将高价值信息沉淀到 Semantic 层，例如用户说"我更喜欢看代码示例"时，系统会将 `learning_preference` 更新为 `["代码实践型"]`。这种"一次写入、持续生效"的机制保证了画像随学习过程自动进化。

### 2.3 PlannerAgent -- 规划智能体 ✅

**职责**：将学习目标拆解为可执行的步骤序列。PlannerAgent 的核心价值在于将模糊的学习意图（"我想学 Python"）转化为结构化的学习步骤（"第一步：安装环境；第二步：变量与数据类型；第三步：条件分支...第七步：项目实战"）。

**输入**：用户意图（来自 IntentAgent）、画像快照（来自 ProfileAgent）、用户原始消息。

**输出**：步骤序列，每个步骤包含 `step_index`、`action`（动作类型）、`description`（描述）、预估耗时和前置依赖。在当前的 Tutor 主链路中，PlannerAgent 的角色被整合进了生成式回答的 prompt 中，通过指令要求模型"先给结论再拆步骤"，间接实现了规划职责。

**代码位置**：PlannerAgent 的逻辑分布在以下位置：
- `backend/app/routes/tutor_eval.py` 的 `POST /api/tutor/chat` 函数中，通过 `TrustAnswerController.plan()` 返回的 prompt 融合了角色设定、页面上下文、记忆上下文和证据片段，间接引导模型进行步骤拆解。
- `backend/app/routes/agent.py` 的 `_execute_task()` 函数（第 217 行）中，每个任务执行都会通过 `_add_step()` 记录步骤（`start`、`navigate`、`search`、`extract`、`done`），形成可回溯的执行步骤序列。
- `Dorc/第一阶段项目开发文档/学而思｜技术产品方案 V3-多智能体落地版.md` 第 4.2 节定义了辅导 Workflow 中 PlannerAgent 与 ProfileAgent 的并行执行关系。

**并行执行说明**：在 V3 设计的辅导 Workflow 模板 `IntentAgent -> ProfileAgent -> PlannerAgent -> TutorAgent -> ReviewerAgent` 中，`ProfileAgent` 与 `PlannerAgent` 可并行读取上下文，因为它们都依赖 IntentAgent 的输出但不互相依赖。这一设计在 `tutor_eval.py` 的 Workshop 模式中体现为：画像分析（profile_analysis 阶段）和后续多轮讨论（discussion 阶段）可以同时准备上下文。

### 2.4 TutorAgent -- 辅导智能体 ✅

**职责**：负责辅导问答文本生成，是 SparkLearn 与学习者直接交互的核心 Agent。TutorAgent 不仅生成文本回答，还集成了多模态能力（图片生成）和文件上下文检索。

**输入**：用户消息（`message`）、交互模式（`mode`）、对话 ID（`conversation_id`）、角色设定（`role_id`）、文件 ID 列表（`file_ids`）、页面上下文（`page_context`）、知识库文件 ID（`knowledge_file_ids`）、Workshop 开关（`workshop_enabled`）。

**输出**：SSE 流式事件，包括 `text`（回答文本增量）、`confidence`（置信度信息）、`citations`（引用来源）、`trust_meta`（可信元数据）、`sources`（文件来源）、`done`（完成事件含 memory 更新状态）、Workshop 模式下还有 `hub`（WorkshopHubEvent）、`workshop_meta`、`workshop_phase` 事件。

**代码位置**：
- `backend/app/routes/tutor_eval.py` 的 `POST /api/tutor/chat` 函数（第 458 行起），这是 TutorAgent 的主入口。函数内部根据 `mode`、`workshop_enabled`、`open_mode` 三个维度分为四条路径：
  1. Workshop 模式（第 539 行）：启动多角色研讨会，按 phase 推进（profile_analysis -> discussion -> synthesis）
  2. 图片生成模式（第 650 行）：调用 `xfyun_tti.generate_image_base64()` 生成图片
  3. 开放模式 / `open_mode`（第 659 行）：跳过可信回答控制器，直接调用模型
  4. 标准可信模式（第 696 行）：通过 `TrustAnswerController.plan()` 编排防幻觉流程
- `backend/app/routes/tutor_eval.py` 的 `_build_role_prompt()` 函数（第 1079 行）：将 tutor_roles 表的五字段（name、persona、background、style_guide、rules）拼装为结构化系统提示词。

**多模态能力集成**：TutorAgent 在图片生成模式下（`mode=image_gen`），调用 `backend/app/xfyun_tti.py` 的 `generate_image_base64()` 函数，使用讯飞星火的 TTI（Text-to-Image）能力生成 base64 编码的 PNG 图片，并以前端 `![AI生成图](data:image/png;base64,...)` 格式返回。文件上下文检索则通过 `_resolve_effective_file_ids()` 和 `_retrieve_tutor_file_context()` 两个函数实现，支持从上传的文件（txt/md/pdf）中检索相关片段并注入回答上下文。

**角色系统**：TutorAgent 支持用户自定义导师角色。每个角色有五个可配置字段：`name`（角色名）、`persona`（角色设定）、`background`（背景设定）、`style_guide`（风格指南）、`rules`（规则约束）。`POST /api/tutor/roles/optimize-prompt` 接口提供了 AI 一键优化提示词功能，帮助用户写出更高质量的角色 prompt。角色数据持久化在 SQLite `tutor_roles` 表中。

### 2.5 ResourceAgent -- 资源智能体 ✅

**职责**：负责资源任务的分发与汇总，是资源生成链路的调度中心。ResourceAgent 根据用户请求的资源类型（document / mindmap / quiz / reading / code / ppt / blog），将任务路由到不同的下游执行工具，并汇总返回结果。

**输入**：资源类型（`type`）、生成提示词（`prompt`）、知识库文件 ID 列表（`knowledge_file_ids`）。

**输出**：SSE 流式事件，包括 `progress`（生成进度）、`text`（文本增量）、`done`（完成事件，含 resource 对象）或 `error`（错误事件）。

**代码位置**：
- `backend/app/routes/resources.py` 的 `POST /api/resources/generate` 函数（第 56 行起），函数内部按资源类型分为三条通路：
  1. **PPT 生成**（第 63 行）：调用 `xfyun_ppt_client.create_ppt()` 创建 PPT，通过 `wait_progress()` 轮询构建进度，最终获取 `pptUrl` 进行预览。
  2. **播客生成**（第 107 行）：直接调用星火大模型 `spark_lite.stream_chat_events()` 生成播客脚本，不走星辰平台，流式输出文本。
  3. **通用资源生成**（第 146 行）：通过 `coze_adapter.stream_resource_text()` 调用星辰 Agent 开发平台的对应 Bot，按资源类型路由到不同 Bot ID，流式接收文本输出。
- `backend/app/coze.py` -- `CozeAdapter` 类（第 21 行起），`resolve_resource_bot_id()` 方法（第 22 行）维护了资源类型到 Bot ID 的映射表：

| 资源类型 | Bot ID 配置键 |
|----------|--------------|
| document | `coze_bot_id_resource_document` |
| mindmap  | `coze_bot_id_resource_mindmap` |
| quiz     | `coze_bot_id_resource_quiz` |
| reading  | `coze_bot_id_resource_reading` |
| code     | `coze_bot_id_resource_code` |

**固定模板体系**：资源生成使用统一的 `_build_resource_prompt()` 函数（第 360 行），为每种资源类型定义了固定的 prompt 模板。例如，document 类型要求"包含学习目标、关键概念、示例、常见错误、练习建议"；quiz 类型要求"包含题目、答案与解析，覆盖简单/中等/困难"；blog 类型要求"口语化、亲切自然、5-8 分钟音频播放时长"。这种模板化策略保证了生成内容的结构一致性，同时降低了 prompt 工程的维护成本。

### 2.6 ReviewerAgent -- 审核智能体 ✅

**职责**：统一做内容校验、格式标准化与风险提示。ReviewerAgent 确保最终输出给用户的内容满足质量标准，并在证据不足时附加保守声明。

**输入**：生成内容、置信度判定（来自 TrustAnswerController）、引用来源列表。

**输出**：校验后的内容、置信度标签、风险提示和建议用户操作。

**代码位置**：ReviewerAgent 的职责通过 TrustAnswerController 的完整编排流程间接实现，分布在以下文件中：
- `backend/app/trust_judge.py` 的 `judge_answerability()` 函数（第 7 行）：根据检索到的证据质量和数量，判定当前请求的"可回答性"，输出 `confidence_score`（0~1）、`confidence_level`（high/medium/low）、`response_mode`（grounded/grounded_cautious/low_confidence）、缺失项列表和用户建议操作。判分算法综合了证据数量、Top1 检索分数、Top3 平均分数和查询类型的最小证据要求。
- `backend/app/trust_rules.py`：定义了置信度阈值（high >= 0.80, medium >= 0.55）、三色映射（green/yellow/red）、对应的中文标签（高/中/低置信）和提示消息。
- `backend/app/trust_answer_controller.py` 的 `_build_prompt()` 方法（第 52 行）：根据置信度级别在 prompt 中注入不同的回答风格指令。`high` 时要求"给出清晰结论并保持可验证表达"；`medium` 时要求"明确证据边界并提示用户继续核对"；`low` 时要求"使用保守语气，避免强确定性措辞，末尾给出补充信息建议"。

**前端展示**：ReviewerAgent 的校验结果通过 SSE 事件中的 `confidence` payload 推送给前端，前端渲染为三色置信度圆圈（绿色 = 高置信 / 黄色 = 中置信 / 红色 = 低置信），配合 `citations` payload 展示可点击的证据溯源链接。

---

## 3. 编排机制 ✅

### 3.1 Orchestrator 编排层设计理念

Orchestrator 是 SparkLearn 多智能体系统的"调度大脑"。根据 V3 技术产品方案第 3.1 节的定义，编排层的核心设计原则是：**所有智能辅导与资源生成请求必须进入编排层，不允许直接绕过编排层调用模型**。这意味着任何一个来自前端的请求，都必须经过编排层的意图识别、Workflow 路由、Agent 调度和结果收口，确保系统行为可追踪、可审计、可回放。

编排层负责以下五项职责：

1. **意图识别与任务拆解**：由 IntentAgent（`trust_router.py` 的 `route_query()`）将原始请求分类为 `knowledge_qa`、`resource_based`、`personalized_guidance` 或 `open_ended`，并判定风险等级。
2. **Workflow 路由**：根据意图类型选择执行路径 -- 辅导请求走辅导 Workflow，资源生成请求走资源 Workflow。
3. **Agent 与 Tools 调度**：决定哪些 Agent 串行执行、哪些可以并行执行，并为 ResourceAgent 分配合适的下游工具（Bot ID）。
4. **执行日志采集与回放**：每次请求输出的执行证据链包含节点名、状态、耗时和结果摘要。
5. **失败重试与降级策略**：当某个环节失败时（例如浏览器搜索超时），自动回退到 LLM fallback 方案。

### 3.2 辅导主 Workflow ✅

辅导链路的编排模板为：**IntentAgent -> ProfileAgent + PlannerAgent（并行）-> TutorAgent -> ReviewerAgent（串行收口）**，定义于 V3 方案第 4.2 节。

在实际代码实现中，这个 Workflow 通过 `POST /api/tutor/chat`（`tutor_eval.py` 第 458 行）的 TrustAnswerController 编排流程落地：

1. **IntentAgent**（`trust_router.py:route_query()`）：识别查询类型和风险等级，决定是否需要知识检索、画像、记忆和规则。
2. **ProfileAgent + PlannerAgent 并行**（`trust_retriever.py:retrieve_evidence()`）：并行检索（1）知识库证据（knowledge 向量检索）、（2）画像快照（profile 读取）、（3）记忆上下文（通过 `build_injected_context()` 提前注入到 `memory_prompt`）、（4）用户文件片段（files 检索）。证据集合为 `EvidenceBundle`，包含四个来源的 `EvidenceItem` 列表。
3. **TutorAgent**（`trust_answer_controller.py:_build_prompt()` + `spark_lite.stream_chat_events()`）：将角色设定、页面上下文、记忆上下文和证据片段合并为结构化 system prompt，调用星火大模型流式生成回答。
4. **ReviewerAgent**（`trust_judge.py:judge_answerability()`）：根据证据质量和数量生成置信度评分和级别，拼装 `confidence`、`citations`、`trust_meta` payload，与文本回答一同返回前端。

辅助链路的并行与串行判断依据如下：
- **可并行**：ProfileAgent 和 PlannerAgent 都依赖 IntentAgent 的输出（`routed.query_type`），但彼此之间不互相依赖。ProfileAgent 检索画像数据（同步读取 SQLite），PlannerAgent 准备教学步骤上下文（提前融入 prompt），两者可以同时进行。
- **必须串行**：ReviewerAgent 必须在 TutorAgent 生成回答之后才能执行，因为它需要对输出内容做后验校验。TutorAgent 依赖前面所有 Agent 的输出汇总。

### 3.3 资源生成 Workflow ✅

资源生成链路为：**IntentAgent -> ResourceAgent -> 星辰 Agent 开发平台 Bot**，定义于 V3 方案第 5.3 节。

实际代码路径（`resources.py` 第 56 行）：
1. **IntentAgent**：通过 `POST /api/resources/generate` 的参数 `type`（document/mindmap/quiz/reading/code/ppt/blog）直接指定资源类型，意图识别简化为参数路由。
2. **ResourceAgent**（`resources.py` 第 63--206 行）：按资源类型分流到三个处理通路（PPT 走讯飞智文、Blog 走星火大模型、其他走星辰平台 Bot）。
3. **星辰 Agent 开发平台 Bot**（`coze.py:CozeAdapter.stream_resource_text()`）：通过 SSE 流式连接对应 Bot ID，接收增量文本，解析后推送给前端。

并行上限默认为 3，防止资源争抢导致整体超时（V3 方案第 5.3 节定义）。

### 3.4 执行证据链输出格式

编排层每次请求输出结构化证据链，前端用于拓扑图渲染和执行日志抽屉。证据链的字段模型定义于 V3 方案第 9.1 节：

```json
{
  "request_id": "uuid",
  "workflow_id": "辅导Workflow/资源Workflow",
  "nodes": [
    {
      "node_id": "IntentAgent",
      "node_type": "agent",
      "status": "success",
      "started_at": "2026-05-29T10:00:00Z",
      "ended_at": "2026-05-29T10:00:01Z",
      "cost_ms": 1200,
      "input_summary": "用户提问：Python闭包是什么",
      "output_summary": "query_type=knowledge_qa, risk_level=medium"
    }
  ]
}
```

代码中对应实现：
- Agent 任务步骤存储在 `agent_task_steps` 表（`agent.py` 第 208 行 `_add_step()`），字段为 `task_id`、`step_index`、`action`、`description`、`created_at`。
- Workshop 模式的 `hub` 事件包含 `phase`、`round`、`agent_id`、`agent_name`、`agent_kind`、`content`、`timestamp` 字段，形成多角色研讨的执行证据（`tutor_eval.py` 第 1229 行 `_hub_message()`）。
- 前端通过 SSE `hub` 事件的 `delta` 字段实现增量更新（`tutor_eval.py` 第 608 行），避免重复渲染。

---

## 4. 学习宠物 Agent（Nanobot）✅

SparkLearn 的学习宠物是一个独立的智能体子系统，具备可视化外观、等级成长、能力树解锁、人格切换和本机托管运行时的完整闭环。代码完整实现在 `backend/app/routes/agent.py` 中（共 637 行），并由 `backend/app/pet_nanobot.py` 和 `backend/app/nanobot_runtime.py` 提供 Nanobot 内核接入能力。

### 4.1 Agent 属性

每个学习宠物具有以下核心属性（`agent.py` 第 20--40 行）：

**avatar（外观，8 种）**：`fox`（狐狸）、`owl`（猫头鹰）、`robot`（机器人）、`cat`（猫咪）、`dragon`（龙）、`penguin`（企鹅）、`bunny`（兔子）、`panda`（熊猫）。用户通过 `POST /api/agent/pet` 的 `AdoptPetReq` 模型（第 45 行）指定 `avatar` 字段，`@field_validator` 校验其必须在 `AVATARS` 集合内。

**personality（人格，3 种）**：`concise`（简洁型，回复控制在 80 字以内，直接到点）、`verbose`（详细型，150-300 字，附解释和示例）、`encouraging`（鼓励型，100-200 字，附带正向激励）。人格 prompt 定义在 `PERSONA_PROMPTS` 字典（第 36 行），在任务执行时通过 `_execute_task()` 函数注入模型调用（`agent.py` 第 226 行）。

**name（名称）**：用户自定义，1-10 个字符，只允许中文、英文和数字（第 52 行正则校验 `^[一-龥a-zA-Z0-9]+$`）。

### 4.2 等级与经验值系统

学习宠物的成长通过等级和经验值系统驱动（`agent.py` 第 26--34 行）：

```python
LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000]  # 各级所需经验值
XP_REWARDS = {
    "search": 10,     # 搜索任务奖励 10 XP
    "summarize": 20,  # 摘要任务奖励 20 XP
    "compare": 25,    # 对比任务奖励 25 XP
    "recommend": 15,  # 推荐任务奖励 15 XP
}
```

等级系统为从 1 到 5 的五级成长模型。`_compute_level()` 函数（第 183 行）使用累计阈值法：遍历 `LEVEL_THRESHOLDS`，找到经验值能达到的最大等级。升级逻辑在 `_award_xp()` 函数（第 191 行）中完成：读取当前经验值和等级，计算新经验值和新等级，更新数据库，返回新经验值、新等级和 `leveled_up` 标志（如果升级则返回新等级，否则为 None）。

### 4.3 解锁能力树

学习宠物的能力按等级逐步解锁（`agent.py` 第 28--34 行）：

| 等级 | 解锁能力 |
|------|----------|
| Level 1 | search（搜索） |
| Level 2 | search + summarize（总结） |
| Level 3 | search + summarize + compare（对比） |
| Level 4 | search + summarize + compare + recommend（推荐） |
| Level 5 | 全能力（同 Level 4） |

能力树在前端 API 中通过 `_pet_row_to_dict()` 函数（第 139 行）的 `unlocked_abilities` 字段暴露。创建任务时，`POST /api/agent/task` 会校验当前等级是否解锁对应任务类型（第 516 行），未解锁时返回提示当前等级不足的最早解锁等级。

### 4.4 人格 Prompt 体系

三种人格的 prompt 定义在 `agent.py` 第 36--40 行：

```python
PERSONA_PROMPTS = {
    "concise": "You are a concise learning assistant. Keep replies under 80 chars, direct and to the point.",
    "verbose": "You are a detailed learning assistant. Give 150-300 char replies with explanations and examples.",
    "encouraging": "You are a warm encouraging learning assistant. Give 100-200 char replies with positive encouragement.",
}
```

不同人格在实际任务中体现差异：简洁型强调精炼、直接；详细型提供更多背景和示例；鼓励型注重正向激励和情绪支持。用户可随时通过 `PATCH /api/agent/pet` 切换人格（`agent.py` 第 482 行）。

### 4.5 Nanobot 本机进程管理

SparkLearn 的学习宠物已接入开源轻量 Agent 内核 Nanobot，采用 Sidecar 方案部署（详见 `Dorc/第三阶段开发文档/SparkLearn-第三阶段-学习宠物嵌入开源轻量Agent内核开发文档.md` 第 4 章）。关键实现文件：

- **`backend/app/nanobot_runtime.py`**：Nanobot 本机进程生命周期管理。后端启动时通过 `subprocess.Popen` 自动拉起本地 Nanobot 进程（使用独立虚拟环境 `.venv-nanobot` 的 Python 解释器），后端退出时回收自己启动的进程。
- **`backend/app/pet_nanobot.py`**：Nanobot API 客户端，封装了对 Nanobot OpenAI-compatible API 的调用（`POST http://127.0.0.1:8900/v1/chat/completions`）。
- **`backend/app/routes/agent.py`**：在开启 `NANOBOT_PET_ENABLED=true` 时优先调用 Nanobot 处理任务，失败时自动回退到旧链路（星火 Lite 浏览器 + LLM fallback）。

Nanobot 通过 OpenAI-compatible API 对外暴露，模型通过 SiliconFlow 提供的 `deepseek-ai/DeepSeek-V3` 运行。SparkLearn 保留现有 UI 和任务展示，后端启动时自动拉起本地 Nanobot，工具层保留 MCP 接入扩展点。

---

## 5. 可信回答控制器（防幻觉系统）✅

SparkLearn 的防幻觉系统由 7 个核心文件组成，形成完整的"检索-判定-生成-验证-引用"闭环。该系统不是简单的 prompt 指令"不要编造"，而是一个有状态、可量化、前端可展示的完整可靠性控制层。

### 5.1 TrustAnswerController 完整编排流程

`backend/app/trust_answer_controller.py` 的 `TrustAnswerController` 类（第 14 行）是防幻觉系统的顶层编排器。它的 `plan()` 方法（第 15 行）编排了 6 步核心流程：

**第一步：QueryRouter（查询路由）** -- 由 `trust_router.py` 的 `route_query(query, mode)` 实现。分析用户查询文本，识别 `query_type`（knowledge_qa / resource_based / personalized_guidance / open_ended）和 `risk_level`（high / medium / low）。高风险判定条件包括：出现"必须"、"一定"、"唯一"等绝对化词汇时标记为 `high`；长度超过 120 字符或包含问号时为 `medium`；其余为 `low`。

**第二步：EvidenceRetriever（证据检索）** -- 由 `trust_retriever.py` 的 `retrieve_evidence(req, routed)` 函数实现。根据路由结果开关式检索四类证据：
1. `knowledge`：通过 `retrieve_knowledge_context_async()` 对 `knowledge_file_ids` 中的知识库文件做向量相似度检索（`backend/app/routes/knowledge.py`），返回 top-8 相关片段及分数。
2. `profile`：读取 `profile_snapshot.json` 中的学习画像快照。
3. `rules`：注入可信回答基线规则（"先检索再回答；证据不足时降级表达；避免强确定性结论"）。
4. `files`：复用 `tutor_eval.py` 中已检索的用户上传文件片段。

**第三步：AnswerabilityJudge（可回答性判定）** -- 由 `trust_judge.py` 的 `judge_answerability(routed, evidence)` 函数实现。核心判分逻辑：基础分 0.35，加上证据数量系数（`evidence_count / (min_evidence + 1) * 0.25`）和检索质量系数（`top1 * 0.15 + top3_avg * 0.1`）。特殊限制规则：无证据时分数上限封顶 0.54；画像缺失时上限封顶 0.70。最终分数与 `CONFIDENCE_THRESHOLDS["high"]`（0.80）和 `["medium"]`（0.55）比较。

**第四步：GroundedGenerator（基于证据生成）** -- 由 `trust_answer_controller.py` 的 `_build_prompt()` 方法实现。将角色设定、页面上下文、记忆上下文、证据片段（最多 6 条，带编号和标签）合并为一个结构化 system prompt，发送给 `spark_lite.stream_chat_events()` 生成回答。不同置信度级别对应的 prompt 风格指令不同：`high` 要求"清晰结论 + 可验证表达"；`medium` 要求"明确证据边界 + 提示继续核对"；`low` 要求"保守语气 + 补充信息建议"。

**第五步：ClaimVerifier（声明验证）** -- 在当前版本中，声明验证通过在 prompt 中禁止模型编造（"优先依据证据回答，不要编造未在证据中出现的事实"）和 ReviewerAgent 的后验校验（`trust_judge.py` 的 `reason_codes` 和 `missing_requirements`）间接实现。

**第六步：CitationRenderer（引用渲染）** -- 由 `trust_citation.py` 的 `render_citations()` 函数实现。将 `EvidenceBundle` 中的四条来源（knowledge、files、profile）的证据项格式化为前端可用的 citation 数组，每条包含 `id`、`label`、`source_type`、`snippet`、`score`。

### 5.2 置信度分级策略

`trust_rules.py`（第 1--29 行）定义了完整的三级置信度映射：

| 级别 | 阈值 | 颜色 | 中文标签 | 提示消息 |
|------|------|------|----------|----------|
| high | >= 0.80 | green | 高置信 | 已基于课程资料和学习记录回答 |
| medium | >= 0.55 | yellow | 中置信 | 已结合部分资料回答，建议继续核对 |
| low | < 0.55 | red | 低置信 | 当前证据不足，以下回答仅供参考 |

不同查询类型的最小证据要求（`MIN_EVIDENCE_BY_TYPE`）：
- `knowledge_qa`：至少 2 条证据
- `personalized_guidance`：至少 2 条证据
- `resource_based`：至少 2 条证据
- `open_ended`：无最小证据要求（开放性问题允许自由回答）

### 5.3 前端的置信度圆圈 UI

前端通过 `trust_citation.py` 的 `render_confidence()` 函数（第 22 行）获取置信度渲染数据，包含 `score`（精确分数到三位小数）、`level`（high/medium/low）、`color`（green/yellow/red）、`label`（高/中/低置信）、`reason_codes`（原因代码列表，如 `NO_EVIDENCE` / `LOW_RETRIEVAL_SCORE` / `PROFILE_REQUIRED_BUT_MISSING`）和 `message`（提示文本）。前端渲染为三色圆形指示器，鼠标悬停展示详细信息。

### 5.4 证据溯源

citation 数组（`trust_citation.py` 第 7 行 `render_citations()`）中的每条记录包含：
- `id`：唯一标识符，格式为 `{source_type}:{source_id}:{index}`，如 `knowledge:Python教程:3`、`file:讲义.pdf:1`
- `label`：人类可读标签，如 `Python教程 · 第3片段`
- `sourceType`：来源类型，枚举值 `knowledge` / `file` / `profile`
- `snippet`：证据片段文本摘要（约 260 字符）
- `score`：检索分数（0~1），供前端排序和筛选

前端在 tutor 对话界面中将 citation 渲染为可点击的引用标签，用户点击后展开显示对应证据片段原文。

### 5.5 防幻觉注入的三个入口

防幻觉系统在以下三个关键 API 入口被注入：

1. **`POST /api/tutor/chat`**（`tutor_eval.py` 第 696 行）：在标准可信模式下，通过 `trust_answer_controller.plan(TrustAnswerRequest(...))` 编排完整 6 步流程，SSE 返回 `confidence`、`citations`、`trust_meta` 事件。代码段：
   ```python
   trust_plan = await trust_answer_controller.plan(
       TrustAnswerRequest(scene='tutor', query=req.message, mode=req.mode, ...)
   )
   ```

2. **`POST /api/resources/generate`**（`resources.py` 第 56 行）：资源生成的 prompt 模板（`_build_resource_prompt()`，第 360 行）内置防幻觉指令，要求生成结构化内容并标注来源（`SOURCE_URL` 机制）。

3. **`POST /api/report/ai-summary`**（`tutor_eval.py` 第 893 行）：AI 学习报告总结在生成 prompt 中注入了学习数据和画像信号作为证据依据，要求"分析学习情况、指出进步和不足、给出具体可执行的建议"，确保报告内容有数据支撑。

---

## 6. 星辰 Agent 开发平台在协作中的角色 ✅

### 6.1 定位：ResourceAgent 的下游工具执行引擎

星辰 Agent 开发平台（原 Coze）在 SparkLearn 多智能体体系中定位为 ResourceAgent 的下游执行引擎，负责按资源类型执行具体的生成任务。这不是简单的 API 调用，而是一个"Agent 调用 Agent"的级联协作模式：SparkLearn 的 ResourceAgent 负责任务分发和结果汇总，星辰平台的 Bot 负责执行具体的内容生成。

### 6.2 Bot ID 按资源类型路由

`backend/app/coze.py` 第 22 行的 `resolve_resource_bot_id()` 方法实现了资源类型到 Bot ID 的映射路由：

| 资源类型 | 配置键 | 实际用途 |
|----------|--------|----------|
| document | `coze_bot_id_resource_document` | 生成结构化学习文档（Markdown） |
| mindmap  | `coze_bot_id_resource_mindmap` | 生成思维导图（Markmap/Mermaid） |
| quiz     | `coze_bot_id_resource_quiz` | 生成练习题与判题辅助信息 |
| reading  | `coze_bot_id_resource_reading` | 生成拓展阅读材料 |
| code     | `coze_bot_id_resource_code` | 生成代码学习案例 |

每种资源类型对应星辰平台上的一个独立 Bot，Bot 内部可以配置不同的知识库、工具集和输出格式。当 `resolve_resource_bot_id()` 找不到匹配项时，回退到 `coze_bot_id_resource_default`。

### 6.3 流式 SSE 对接与结果回传

星辰平台的调用链路（`coze.py` 第 32 行 `stream_resource_text()`）采用标准 SSE（Server-Sent Events）协议：

1. **请求构建**：构造 `POST https://api.coze.cn/v3/chat` 请求，body 包含 `bot_id`、`user_id`、`stream=true`、`additional_messages` 等字段（第 59--73 行）。
2. **SSE 帧解析**：通过 `_iter_sse_frames()` 方法（第 122 行）逐帧解析 SSE 事件流，分离 `event:` 和 `data:` 行，组装事件名称和 JSON payload。
3. **Payload 递归解包**：星辰平台返回的 JSON 可能多层嵌套（如 `{"data": "{...json...}"}`），`_inflate()` 方法（第 149 行）递归展开嵌套 JSON 串，提取实际内容。
4. **增量文本提取**：`_extract_text()` 方法（第 181 行）从 payload 中提取文本内容字段（`content.text`、`answer`、`text`），过滤掉 role=user、type=function_call、msg_type=finish 等控制帧。
5. **增量推送**：`_to_delta_text()` 方法（第 216 行）维护累积文本状态 `_StreamState`，通过比较当前完整文本和历史文本计算增量部分，避免重复推送。
6. **结果回传给 ReviewerAgent**：ResourceAgent 汇总星辰平台的返回内容后，加入防幻觉 prompt 模板，生成结构化资源卡片，写入 `resources_index.json` 持久化。

---

## 7. 工坊模式（Workshop）✅

工坊模式是 SparkLearn 多智能体协作中最具特色的交互形式，它将传统的"用户-模型"单轮对话升级为"多角色研讨会"的动态协作过程。

### 7.1 多角色研讨会流程

Workshop 的执行流程分为三个相位（phase），完整实现在 `tutor_eval.py` 第 539--648 行：

**相位 1 - profile_analysis（画像分析）**：读取学习画像快照，生成画像分析文本。例如"学习者当前基础为'有一定基础'，薄弱点集中在：闭包、装饰器。建议采用'实践型'风格讲解，先给结论再拆步骤，并提供 1 个可执行练习任务。"（`_build_profile_analysis()`，第 1124 行）。

**相位 2 - discussion（多轮讨论）**：根据问题复杂度（`_estimate_question_complexity()`，第 1138 行）决定讨论轮数：简单问题 2 轮、中等 3 轮、困难 5 轮（`_rounds_for_complexity()`，第 1161 行）。每轮每个参与角色依次发言，流式推送到前端。参与角色包括：
- **clarifier（提问优化师）**：重构问题，补充目标、约束、上下文缺口。
- **subject-tutor（学科导师）**：给出专业解释与解题路径，强调准确性与步骤。
- **challenger（质疑者）**：专门发现漏洞、边界条件、易错点，提出修正建议。
- **coach（行动教练）**：将讨论转化为可执行学习动作，输出可量化下一步。
- **自定义角色**：用户配置的 tutor_roles 中的角色如果提供了 `workshop_role_ids`，也会被动态加入参与列表（`_build_workshop_participants()`，第 1166 行）。

每轮讨论中各角色的发言通过 `_workshop_agent_reply_stream()` 函数（第 1249 行）生成，采用分块增量推送策略（第 599 行 `delta=True`），实现"打字机"效果的实时流式展示。

**相位 3 - synthesis（综合结论）**：由 `FinalAnswerAgent`（`_workshop_synthesize_answer()`，第 1287 行）汇总所有轮次的讨论摘要，生成一份面向用户的最终回答。如果生成的内容疑似对话记录（检测到多个"用户:"和角色前缀），会自动触发重写（`_rewrite_to_single_user_answer()`，第 1401 行）。最终回答末尾附带 3 条"可追问问题"帮助用户继续学习。

### 7.2 WorkshopHubEvent SSE 格式

Workshop 的 SSE 事件格式定义在 `tutor_eval.py` 的 `_hub_message()` 函数（第 1229 行）：

```json
{
  "phase": "discussion",
  "round": 2,
  "agent_id": "subject-tutor",
  "agent_name": "学科导师",
  "agent_kind": "system",
  "content": "闭包的核心是函数内部定义的函数可以访问外部函数的变量...",
  "timestamp": "2026-05-29T10:05:30Z",
  "delta": true
}
```

关键设计点：
- `delta: true` 表示该消息是增量更新，前端应按 `agentId + round` 做覆盖合并而非追加（`tutor_eval.py` 第 608 行 `delta_msg['delta'] = True`）。
- `delta: false` 表示该消息是该角色在当前轮的最终发言（第 623 行 `msg['delta'] = False`），前端应标记为完成态。
- `workshop_phase` 事件（如 `{"phase": "discussion", "round": 2, "status": "running"}` 和 `"done"`）用于控制前端相位进度条。

### 7.3 前端三栏渲染

Workshop 模式下的前端布局采用三栏结构：

1. **左侧 - 角色列表**：展示所有参与角色的名称、类型标签（system / custom）、当前发言状态。
2. **中间 - 对话流**：按讨论轮次和角色排列的实时对话流，支持 `delta` 增量渲染，同角色同轮内容覆盖更新而非追加。
3. **右侧 - Workshop 事件面板**：展示当前相位进度（profile_analysis / discussion / synthesis）、轮次编号、讨论摘要和最终结论。

前端代码在 `frontend/src/app/tutor/workshop/page.tsx`（独立 Workshop 页）和 `frontend/src/app/tutor/page.tsx`（Tutor 页内嵌 Workshop）中实现，`frontend/src/lib/api/real.ts` 中 `hub` 事件已透传 `delta` 字段，这是修复"无限刷新"问题的关键。

---

## 8. 工具扩展系统 ✅

### 8.1 工具注册与调用机制 ✅

SparkLearn 的工具扩展系统经历了从"硬编码函数调用"到"统一注册与调用"的重构。当前工具系统由以下层次组成：

1. **浏览器工具层**（`backend/app/browser_agent.py`）：`BrowserAgentService` 类（第 22 行）提供基于 Playwright 的真实浏览器自动化能力，包括：
   - `search()`（第 28 行）：在 Bing 上执行搜索，逐步展示"启动浏览器 -> 导航 -> 输入关键词 -> 点击搜索 -> 滚动结果 -> 点击链接 -> 阅读页面"的全过程。
   - `summarize_url()`（第 32 行）：访问指定 URL 并提取页面文本用于后续 AI 摘要。
   - `compare_search()`（第 36 行）：搜索同一查询的多个来源，收集不同视角的解释。

2. **大模型工具层**（`backend/app/llm.py` 的 `spark_lite`）：通过 STAR（Spark Tool-Augmented Response）协议提供的 function-call 能力，支持结构化工具调用。

3. **知识检索工具层**（`backend/app/routes/knowledge.py`）：`retrieve_knowledge_context_async()` 函数提供基于讯飞 embedding 的向量相似度检索，支持知识库文件的语义搜索。

4. **资源生成工具层**（`backend/app/coze.py` 和 `resources.py`）：通过 `ResourceAgent` 调度星辰平台 Bot 和讯飞智文 API，提供文档、PPT、思维导图、题目、阅读材料、代码案例、播客等 7 种资源生成工具。

### 8.2 MCP 协议工具接入 ✅

SparkLearn 已实现 MCP（Model Context Protocol）插件商店系统，支持两种 transport 模式。详见 `Dorc/第三阶段开发文档/SparkLearn-第三阶段-学习空间MCP插件商店开发文档（演示版）.md`。

**数据模型**：`mcp_services` 表存储 MCP 服务配置，字段包括 `id`（UUID）、`owner_id`（用户隔离）、`name`、`description`、`source`（system / user）、`transport`（stdio / http）、`endpoint`（HTTP 地址）、`command`（stdio 启动命令）、`args_json`、`env_json`、`enabled`、`last_status`（unknown / online / offline）、`last_error`、`last_tested_at`。

**HTTP transport**：用户配置 `endpoint` 字段（如 `http://127.0.0.1:9001/mcp`），系统通过标准 MCP HTTP 协议建立连接，执行 `tools/list` 获取工具清单。

**stdio transport**：用户配置 `command`、`args`、`env` 字段。系统通过子进程启动对应命令，通过标准输入输出流进行 MCP JSON-RPC 通信。启用命令白名单机制，禁止任意系统命令。

**API 接口**（前缀 `/api/mcp`）：
- `GET /api/mcp/services`：获取服务列表（支持 scope 过滤）
- `POST /api/mcp/services`：新增服务配置
- `PUT /api/mcp/services/{id}`：更新服务
- `DELETE /api/mcp/services/{id}`：删除服务
- `POST /api/mcp/services/{id}/test`：测试连接（执行 tools/list）
- `POST /api/mcp/services/{id}/toggle`：启停服务
- `GET /api/mcp/services/{id}/tools`：获取工具列表

**安全约束**：API 全量按 `owner_id` 过滤、stdio 命令白名单拒绝、env_json 敏感键加密存储、测试超时 15 秒、单用户并发限制 3。

### 8.3 Browse-use 插件（多功能实现）✅

Browse-use 插件是学习宠物 Agent 的浏览器控制能力模块，通过 `backend/app/browser_agent.py` 的 `BrowserAgentService` 类实现四种功能：

1. **search**（`agent.py` 第 261 行 `_do_search()`）：通过 Playwright 打开 Bing 搜索引擎，输入查询关键词，逐个点击搜索结果链接，提取页面文本内容。有 40 秒超时保护，失败时自动回退到 `_do_search_llm_fallback()`（第 283 行），由星火 Lite 直接推荐 3-5 个学习资源。

2. **summarize**（`agent.py` 第 311 行 `_do_summarize()`）：如果输入是 URL，通过浏览器访问页面提取文本；然后调用星火 Lite 生成结构化摘要（topic + key_points + conclusion）。25 秒超时保护。

3. **compare**（`agent.py` 第 357 行 `_do_compare()`）：在浏览器中搜索同一话题的多个来源（默认 3 个），获取不同视角的解释，再由 AI 生成 50 字以内的对比总结。

4. **recommend**（`agent.py` 第 409 行 `_do_recommend()`）：根据用户学习情况（输入文本），调用星火 Lite 直接生成 3 条推荐资源（title + summary + reason）。

所有浏览器操作在独立线程池中运行（`concurrent.futures.ThreadPoolExecutor`，最大 2 个 worker），避免 Windows 事件循环冲突。

---

## 9. 教师端 Agent 协作 ✅

### 9.1 AI 自动总结学生学情

教师端通过 `POST /api/report/ai-summary` 接口（`tutor_eval.py` 第 893 行）实现 AI 驱动的学生学情自动总结。该接口支持按天/周/月三个时间维度生成学习报告。

流程如下：
1. 读取学习画像（`profiles` 表）获取学习目标、知识水平、薄弱点、学习偏好、认知风格、每日学习时间等信号。
2. 读取掌握度记录（`mastery_records` 表）获取各知识点的得分、章节归属，按分数升序排列取 Top 5 薄弱知识点。
3. 调用 `/api/evaluation/report`（`report_service.py` 第 11 行 `get_evaluation_report()`）获取目标时间段的统计数据：总学习时长、任务完成率、练习正确率、连续学习天数。
4. 将上述所有数据拼装为结构化 prompt，通过星火大模型生成约 200 字的总结，语气亲切专业，包含学习情况分析、进步和不足、具体可执行的建议。

教师端大屏（`backend/app/routes/teacher.py`）还提供了班级维度的数据聚合 API：
- `GET /api/teacher/class-overview`：班级整体概况（学生数、平均正确率、平均时长、风险学生数）
- `GET /api/teacher/students`：学生列表（含当前阶段、薄弱点、风险等级）
- `GET /api/teacher/mastery-matrix`：班级知识点掌握度矩阵
- `GET /api/teacher/risk-alerts`：风险学生预警列表

### 9.2 广播内容生成

教师端支持向全班学生发送广播内容。广播内容包括学习提醒、阶段性总结通知和建议学习动作。广播内容利用星火大模型基于班级整体学情数据生成，确保内容针对性强、具有可执行的指导意义。广播数据存储后，学生端可以在学习空间中查看到教师推送的消息。

---

## 10. 待实现规划

### 10.1 🔲 飞书接入智能体

将学习宠物 Agent（Nanobot）接入飞书渠道，实现在飞书中直接与 SparkLearn 学习宠物对话的能力。架构方案已在 `Dorc/第三阶段开发文档/SparkLearn-第三阶段-学习宠物嵌入开源轻量Agent内核开发文档.md` 第 10 章完成设计：

1. **接收飞书消息**：飞书 Webhook 接收单聊文本消息，验签与事件去重。
2. **Nanobot 意图识别**：通过 Nanobot 的 Channel 层接收飞书事件，进行意图识别。
3. **业务能力调用**：若需要 SparkLearn 业务能力（画像、路径、资源、测验、报告），通过 Tool Adapter 请求后端 API。
4. **结果回发飞书**：Nanobot 汇总结果后回发飞书。
5. **用户映射**：首次发言时自动创建飞书用户与 SparkLearn 用户的映射关系。

对应的数据模型 `external_identities` 表（provider + open_id 唯一索引）已在设计阶段预留。当前阻塞点在于上游模型账户余额问题，接入架构代码本身已验证通过。

### 10.2 🔲 知识图谱关联个性化路径

将当前基于"阶段线性推进"的学习路径升级为知识图谱驱动的动态路径推荐。方案设计见 V3 技术产品方案第 7 章：

1. **图谱模型**：节点 = 知识点，边 = 前置依赖关系，状态 = 未学/学习中/已掌握，信号 = 掌握度 + 错题频次 + 学习偏好。
2. **动态推荐**：根据图谱状态自动计算（1）当前最优下一跳节点，（2）回补路径（从薄弱点反推前置知识），（3）每节点推荐资源（文档、题目、代码）。
3. **页面要求**：学习路径页支持图谱可视化，节点颜色反映掌握度（绿 = 已掌握、黄 = 学习中、灰 = 未学、红 = 高风险），点击节点展示推荐资源与学习动作。

当前教师端已具备知识点元数据（`teacher.py` 第 32--50 行的 `_KP_NAMES` 和 `_STAGE_KPS` 定义了 5 个阶段 21 个知识点），以及模拟的班级掌握度数据，为后续图谱化改造提供了数据基础。

---

## 附录 A：核心源文件索引

| 文件路径 | 模块职责 |
|----------|----------|
| `backend/app/routes/agent.py` | 学习宠物 Agent CRUD、任务执行、等级系统 |
| `backend/app/routes/tutor_eval.py` | Tutor 辅导对话、Workshop 工坊模式、AI 报告总结 |
| `backend/app/routes/resources.py` | 资源生成（document/mindmap/quiz/reading/code/ppt/blog） |
| `backend/app/routes/profile.py` | 学习画像采集与更新 |
| `backend/app/routes/teacher.py` | 教师端大屏数据 API |
| `backend/app/routes/report_service.py` | 学习报告数据服务 |
| `backend/app/trust_answer_controller.py` | 可信回答控制器编排层 |
| `backend/app/trust_router.py` | 查询意图识别与路由 |
| `backend/app/trust_retriever.py` | 多源证据检索器 |
| `backend/app/trust_judge.py` | 可回答性判定引擎 |
| `backend/app/trust_citation.py` | 引用渲染与置信度 UI 数据 |
| `backend/app/trust_rules.py` | 置信度阈值、颜色映射、标签映射 |
| `backend/app/trust_schemas.py` | 防幻觉系统 Pydantic 数据模型 |
| `backend/app/coze.py` | 星辰 Agent 开发平台适配器 |
| `backend/app/browser_agent.py` | Playwright 浏览器自动化服务 |
| `backend/app/memory_engine.py` | 四层记忆引擎 |
| `backend/app/pet_nanobot.py` | Nanobot 内核 API 客户端 |
| `backend/app/nanobot_runtime.py` | Nanobot 本机进程生命周期管理 |
| `backend/app/routes/memory.py` | 记忆系统 REST API |

## 附录 B：参考文档索引

| 文档路径 | 主要内容 |
|----------|----------|
| `Dorc/第一阶段项目开发文档/学而思｜技术产品方案 V3-多智能体落地版.md` | 多智能体架构总设计、Orchestrator 定义、Agent 角色定义 |
| `Dorc/第三阶段开发文档/SparkLearn-RAG与研讨会-交接文档-2026-05-26.md` | RAG 检索落地、Workshop SSE 协议修复 |
| `Dorc/第三阶段开发文档/SparkLearn-第三阶段-学习宠物Nanobot接入-交接文档-2026-05-26.md` | Nanobot Sidecar 接入实施 |
| `Dorc/第三阶段开发文档/SparkLearn-第三阶段-学习宠物嵌入开源轻量Agent内核开发文档.md` | Nanobot 嵌入架构设计、飞书接入方案 |
| `Dorc/第三阶段开发文档/SparkLearn-第三阶段-学习空间MCP插件商店开发文档（演示版）.md` | MCP 插件商店 API 设计、数据模型 |
| `Dorc/第三阶段开发文档/SparkLearn-第三阶段-记忆系统设计文档.md` | 记忆系统四层模型、检索排序策略 |
| `Dorc/第三阶段开发文档/SparkLearn-第三阶段-可信回答控制器与防幻觉机制开发文档.md` | 防幻觉 6 步流程详细说明 |
