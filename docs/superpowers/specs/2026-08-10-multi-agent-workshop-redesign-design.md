# SparkLearn 多智能体研讨会重构设计

## 目标

本次重构的核心目标不是把最终回答写得更像普通聊天，而是让评委和用户明确看到 SparkLearn 的多智能体能力：多个智能体以不同职责、不同节奏、不同证据来源参与研讨，并通过可解释的协作过程形成结论。

设计优先级如下：

1. 真实协作过程可见：展示独立观察、工具调用、互相质询、观点修订、最终共识。
2. 智能体发言节奏自然：不再固定每轮每人依次发言，而是由主持调度器根据议题状态决定谁发言、谁沉默、谁调用工具。
3. 上下文管理正确：每个智能体拥有私有上下文，只把必要观点、证据和问题发布到共享白板。
4. 工具调用可解释：MCP、Web 搜索、文件检索、学习画像、资源库等工具以受控方式接入研讨流程。
5. 结果展示结构化：右侧不再只解析一段文本，而是展示共识、分歧、证据、行动项和可追问问题。

## 当前薄弱点

当前实现位于 `backend/app/routes/tutor_eval.py` 的 `workshop_enabled` 分支，以及 `frontend/src/app/tutor/workshop/page.tsx`。

### 1. 上下文是共享接龙，不是多智能体协作

后端当前用 `hub_log` 保存所有研讨发言。每个参与者生成发言时，会读取最近讨论记录、上一轮要点和禁止重复内容。这个设计能减少重复，但所有角色看到的上下文基本一致，没有区分：

- Agent 私有记忆
- Agent 自己的观察与草稿
- Agent 工具调用结果
- Agent 接收到的其他角色消息
- 共享给全体的白板内容

这导致智能体更像“不同人设依次续写同一个聊天记录”，而不是多个专家独立思考后协作。

### 2. 调度是固定串行，缺少自然节奏

当前流程是：

```text
第 1 轮：A 发言 -> B 发言 -> C 发言 -> D 发言
第 2 轮：A 发言 -> B 发言 -> C 发言 -> D 发言
...
最终综合
```

这种形式稳定，但演示效果不强。真实研讨里，有些角色会先查资料，有些角色会等待别人观点后质疑，有些角色只在发现风险时插话，有些角色可能本轮无需发言。

### 3. 研讨会没有接入已有工具能力

普通 Tutor 对话已经具备 MCP、Web 搜索、文件检索、可信回答、AGUI/A2UI 事件等能力，但研讨会内部的 agent 只调用模型生成文本。结果是“多智能体”看起来只是多段 prompt，而不是具备工具能力的 agent 群组。

### 4. 展示层无法体现协作结构

当前前端主要展示 `hubMessages` 和最终 `conclusion`。右侧结论依赖字符串解析，无法稳定表达：

- 哪个 agent 调用了什么工具
- 哪些证据支持了结论
- 哪些观点发生了变化
- 哪些分歧被保留
- 最终行动项来自哪个讨论路径

## 第一性原理拆分

多智能体研讨会的本质不是“多个模型回答同一个问题”，而是一个协作决策系统。它至少包含五个基本元素：

1. 角色：每个智能体有职责边界和可用工具。
2. 记忆：每个智能体有自己的私有上下文，并能读取受限共享上下文。
3. 通信：智能体之间不是共享全部脑内过程，而是发布结构化消息。
4. 调度：主持者根据议题进展决定下一步是发言、查证、质疑、修订还是总结。
5. 产物：最终输出不仅是答案，还包括证据链、共识、分歧和行动建议。

因此，新设计应从“聊天流”升级为“研讨协议 + 调度器 + 工具代理 + 可视化工作台”。

## 推荐方案：WorkshopProtocol v2

推荐采用“主持调度 + 私有上下文 + 共享白板 + 工具代理”的混合架构。

不建议直接引入重型 CrewAI/LangGraph 作为第一阶段核心依赖，因为当前项目已有 FastAPI SSE、MCP、AGUI/A2UI、文件检索和 Web 搜索能力。第一阶段更适合先建立轻量协议和编排层，后续再把调度器替换为 LangGraph/CrewAI。

### 架构组件

```text
用户问题
  -> WorkshopOrchestrator
      -> ContextManager
          -> 每个 Agent 的私有上下文
          -> 共享白板 SharedBoard
      -> DynamicScheduler
          -> 决定下一步动作和发言顺序
      -> ToolBroker
          -> MCP / Web Search / 文件 RAG / 画像 / 资源库
      -> AgentRuntime
          -> 各角色独立生成观察、工具请求、发言和修订
      -> SynthesizerAgent
          -> 结构化结论
  -> SSE 事件
  -> 前端研讨工作台
```

### Agent 私有上下文

每个智能体维护独立上下文：

```json
{
  "agent_id": "challenger",
  "role": "质疑者",
  "private_notes": [],
  "observations": [],
  "tool_results": [],
  "received_messages": [],
  "speaking_state": {
    "urgency": 0.0,
    "confidence": 0.0,
    "has_new_evidence": false,
    "should_speak": false
  }
}
```

共享白板只保存可被其他 agent 看到的结构化内容：

```json
{
  "claims": [],
  "questions": [],
  "evidence": [],
  "risks": [],
  "decisions": [],
  "action_items": []
}
```

这样既能保留多智能体独立性，又避免上下文无限膨胀。

## 动态发言节奏

这是本次演示最重要的部分。新流程不再固定每个 agent 每轮都说话，而是引入 `DynamicScheduler`。

### 调度动作类型

每一步调度器可以选择：

- `observe`：某个 agent 独立分析，不公开发言。
- `tool_call`：某个 agent 请求工具。
- `speak`：某个 agent 公开发表观点。
- `challenge`：某个 agent 针对某条 claim 提出质疑。
- `revise`：某个 agent 基于新证据修订观点。
- `summarize_round`：主持人压缩本阶段共识。
- `synthesize`：最终综合。

### 发言决策信号

每个 agent 每一步先输出一个轻量状态，而不是直接发言：

```json
{
  "intent": "speak",
  "urgency": 0.82,
  "reason": "发现上一条学习路径缺少基础诊断",
  "needs_tool": false,
  "target_claim_id": "claim_03"
}
```

调度器根据以下规则决定下一步：

- 有高风险质疑时，优先让 `ChallengerAgent` 插话。
- 有事实不确定时，优先让 `ResearchAgent` 调用搜索或文件检索。
- 学习建议过于抽象时，让 `CoachAgent` 转成行动项。
- 多个角色观点重复时，降低重复角色的发言权重。
- 某个 agent 连续沉默太久但有新证据时，提高发言权重。
- 到达时间或步数上限时，进入综合阶段。

### 建议节奏

第一阶段采用可控的半动态调度：

1. 开场并行观察：所有 agent 并行生成私有观察，不直接展示长文本。
2. 主持人发布议题拆解：展示 3-5 个关键议题。
3. 动态研讨 6-10 步：每一步由调度器选择一个或多个 agent 行动。
4. 证据补充：需要事实时触发工具调用。
5. 共识整理：主持人把 claims、risks、evidence 合并。
6. 最终综合：SynthesizerAgent 输出结构化结论。

这样既有真实感，又不会让不可控并发把演示弄乱。

## 工具调用设计

新增 `ToolBroker`，复用项目已有能力：

- Web 搜索：`search_web`
- 文件检索：`_retrieve_tutor_file_context`
- MCP：`_iter_mcp_tool_call_events`
- 学习画像：`_load_profile_snapshot`
- 资源库：已生成资源与知识文件
- 可信回答：trust answer controller 相关事件

### 工具权限

不同 agent 拥有不同工具权限：

| Agent | 主要职责 | 工具权限 |
| --- | --- | --- |
| ModeratorAgent | 主持、调度、压缩议题 | 画像、共享白板 |
| ResearchAgent | 查证事实、补充资料 | Web 搜索、MCP、文件检索 |
| TutorAgent | 专业解释与路径设计 | 文件检索、画像 |
| ChallengerAgent | 找漏洞、边界、误导风险 | 共享白板、可信回答 |
| CoachAgent | 转化为学习行动 | 画像、资源库 |
| SynthesizerAgent | 形成最终结构化产物 | 全部共享白板，不直接调用外部工具 |

### 工具事件

工具调用必须进入 SSE 和 AGUI：

```json
{
  "type": "workshop_tool_call",
  "payload": {
    "agent_id": "researcher",
    "tool_name": "web_search",
    "status": "running",
    "args": { "query": "..." }
  }
}
```

工具结果不直接塞进全局聊天，而是写入对应 agent 的 `tool_results`，再由 agent 提炼为 evidence 发布到共享白板。

## 前端可视化设计

`/tutor/workshop` 建议升级为“研讨工作台”，不是普通聊天页。

### 页面布局

左侧：参与者与状态

- agent 名称、职责、工具权限
- 当前状态：观察中、查证中、发言中、等待中、已修订
- 发言节奏指标：本轮是否主动发言、是否调用工具、是否提出质疑

中间：研讨时间线

- 主持人议题拆解
- agent 发言气泡
- 插话、质疑、修订以不同视觉样式展示
- 工具调用作为可折叠步骤卡片
- 并行动作显示为同一时间段内的多条轨道

右侧：共享白板

- 共识 `Consensus`
- 分歧 `Open Questions`
- 证据 `Evidence`
- 风险 `Risks`
- 行动项 `Action Items`
- 最终结论卡 `Final Brief`

### 展示重点

演示时应让用户看到：

1. 多个 agent 首先各自观察，而不是马上排队发言。
2. ResearchAgent 在需要时调用工具。
3. ChallengerAgent 会对某条具体观点提出质疑。
4. TutorAgent 或 CoachAgent 会根据质疑修订建议。
5. 右侧白板实时沉淀证据、共识和行动项。

## 数据与协议

建议新增统一事件类型，保持兼容旧 `hub` 事件：

```json
{
  "type": "workshop_event",
  "payload": {
    "event_id": "evt_001",
    "run_id": "workshop_12",
    "phase": "debate",
    "step": 4,
    "agent_id": "challenger",
    "agent_name": "质疑者",
    "action": "challenge",
    "visibility": "public",
    "content": "这个学习路径缺少前置诊断，可能直接进入练习导致挫败。",
    "target_id": "claim_03",
    "created_at": "..."
  }
}
```

共享白板事件：

```json
{
  "type": "workshop_board_delta",
  "payload": {
    "op": "add",
    "section": "risks",
    "item": {
      "id": "risk_01",
      "text": "当前建议可能忽略基础薄弱点",
      "source_agent_id": "challenger",
      "linked_claim_ids": ["claim_03"]
    }
  }
}
```

最终结论：

```json
{
  "type": "workshop_final",
  "payload": {
    "summary": "",
    "consensus": [],
    "disagreements": [],
    "evidence": [],
    "actions": [],
    "follow_up_questions": []
  }
}
```

## 并行与串行策略

建议采用“并行输入，串行决策，局部并发工具”的策略。

并行适合：

- 首轮独立观察
- 多个 agent 生成私有状态
- 不同工具查询互不依赖时并发执行

串行适合：

- 公开发言进入共享白板
- 对某个 claim 的挑战与修订
- 最终综合

这样可以兼顾演示效果、稳定性和成本控制。

## 分阶段落地

### 第一阶段：协议与展示升级

- 新增 WorkshopProtocol v2 事件结构。
- 保留旧 `hub` 事件兼容。
- 前端新增研讨时间线和共享白板。
- 后端仍可使用现有模型调用，但把输出拆为结构化事件。

### 第二阶段：私有上下文与动态调度

- 引入 `AgentContext`。
- 引入 `SharedBoard`。
- 实现半动态调度器。
- 首轮并行观察，后续按 urgency 和 role policy 决定发言。

### 第三阶段：工具代理接入

- 引入 `ToolBroker`。
- 为 ResearchAgent 接入 Web/MCP/文件检索。
- 为 CoachAgent 接入画像和资源库。
- 工具结果进入私有上下文，再发布 evidence。

### 第四阶段：质量与演示打磨

- 优化右侧结论卡。
- 增加“观点变化轨迹”。
- 增加导出研讨纪要。
- 为赛题演示准备预设高质量样例。

## 验收标准

技术验收：

- 每个 agent 具备独立上下文对象。
- 共享白板不直接等于完整聊天历史。
- 至少一种工具能在研讨会内部由 agent 调用。
- SSE 能输出 `workshop_event`、`workshop_board_delta`、`workshop_tool_call`、`workshop_final`。
- 前端能实时渲染时间线、工具调用、白板和最终结构化结论。

产品验收：

- 研讨过程看起来不是固定轮流讲话。
- 至少出现一次“质疑 -> 查证 -> 修订”的协作链。
- 右侧白板能解释最终结论来自哪些证据和观点。
- 用户能明确看出不同 agent 的职责差异。

演示验收：

- 2 分钟内能完整跑完一次研讨。
- 即使工具失败，也能展示降级事件和继续研讨。
- 最终结果可以直接用于学习建议或后续追问。

## 风险与控制

### 成本和延迟

并行 agent 和工具调用会增加成本。第一阶段建议限制：

- 每次研讨最多 5 个核心 agent。
- 动态研讨最多 10 步。
- 工具调用最多 3 次。
- 单个工具超时后降级，不阻塞最终综合。

### 输出不可控

所有 agent 输出先走结构化解析。解析失败时降级为普通发言，但仍保留 agent、action、phase 等元数据。

### 上下文膨胀

每个 agent 私有上下文只保留：

- 最近 3 条自己的公开发言
- 最近 5 条收到的关键消息
- 最近 3 条工具结果
- 共享白板摘要

长内容进入文件或 evidence 摘要，不直接塞进 prompt。

## 推荐结论

本项目应优先做轻量自研的 `WorkshopProtocol v2`，而不是马上引入重型多智能体框架。原因是 SparkLearn 已经有 Tutor、MCP、AGUI/A2UI、Web 搜索、文件检索和学习画像能力，当前真正缺的是“把这些能力组织成可解释多智能体研讨”的协议和调度层。

最终要呈现的不是“几个导师轮流说几段话”，而是：

```text
多个智能体独立观察
  -> 主持人动态调度
  -> 工具代理查证
  -> 质疑者挑战观点
  -> 导师修订方案
  -> 教练转成行动
  -> 综合智能体输出可追溯结论
```

这条链路最能体现 SparkLearn 在赛题中的多智能体创新点。
