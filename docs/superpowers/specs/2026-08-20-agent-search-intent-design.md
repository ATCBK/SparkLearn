# 学习伙伴搜索意图分析与工具编排设计

## 1. 现状与目标

当前任务模式由用户手动选择 `search`、`summarize` 或 `compare`，后端 `search` 和 `compare` 会把 `input_text` 原文直接传给 `backend/app/browser_agent.py`。只有包含 URL 的摘要任务会先用大模型生成搜索词。

本期目标是在搜索任务与浏览器执行器之间加入结构化的大模型意图规划器：判断是否需要联网、是否信息不足、用户真正要找什么，并生成唯一允许传给浏览器的规范化查询词。用户原文只作为规划输入和审计记录，不再作为浏览器查询的默认参数。

仓库中的 `browser-extension/` 是用户主动采集当前网页的扩展，不能被学习伙伴远程调用。本设计中的“浏览器插件调用”实际落到当前可运行的 `BrowserAgentService`（Playwright）；界面和日志统一称为“浏览器检索工具”，避免错误宣称已调用 Chrome 扩展。

## 2. 兼容方案

保留以下接口和轮询行为：

- `POST /api/agent/task`
- `GET /api/agent/task/{task_id}`
- `POST /api/agent/chat`

不新增全新的会话协议。搜索任务进入后台后先做意图规划；规划结果为“澄清”或“直接回答”时，任务以 `completed` 结束并返回 `answer`，前端沿用现有消息渲染。只有规划结果为 `search` 时才加载并调用 `BrowserAgentService`。

## 3. 意图规划结构

新增独立模块输出：

```json
{
  "schema_version": "agent-search-intent-v1",
  "decision": "search",
  "goal": "找到适合零基础学习者的 Python 装饰器入门资料",
  "normalized_query": "Python 装饰器 零基础 入门 教程 示例",
  "constraints": ["中文优先", "包含示例"],
  "output_focus": "按学习顺序说明先看哪一项",
  "clarification_question": "",
  "confidence": 0.86,
  "generated_by": "llm"
}
```

`decision` 只能是：

- `search`：调用浏览器检索工具。
- `clarify`：信息不足，向用户提出一个具体问题，不调用浏览器。
- `respond`：属于普通解释或已有上下文回答，不需要浏览器。

规划器必须校验 JSON、限制查询长度、去除控制字符和命令式冗余。模型不可用时使用确定性规则生成 `rule_fallback` 结果；规则无法形成明确查询时返回 `clarify`，不得回退为把原文直接传给浏览器。

## 4. 执行链路

```text
用户输入原文
  → 保存原文任务记录
  → 大模型意图规划
  ├─ clarify → 返回澄清问题，不调用 BrowserAgent，不奖励 XP
  ├─ respond → 大模型直接回答，不调用 BrowserAgent，不奖励搜索 XP
  └─ search → 将 normalized_query 传给 BrowserAgent
                → 提取真实搜索结果
                → 结合 goal、constraints、output_focus 生成结果说明
                → 返回实际查询词和规划摘要
```

搜索结果新增兼容字段：

```json
{
  "items": [],
  "query_used": "Python 装饰器 零基础 入门 教程 示例",
  "intent": {
    "goal": "……",
    "constraints": ["……"],
    "output_focus": "……",
    "confidence": 0.86,
    "generated_by": "llm"
  }
}
```

`items` 保持原结构，旧前端不受影响。任务步骤至少包含“分析用户意图”“生成检索词”“调用浏览器检索”“整理结果”。前端在搜索结果上方展示“理解目标”和“实际检索词”，使用户能够核对系统是否理解正确。

## 5. 错误处理

- 规划模型超时、空输出或非法 JSON：走规则规划；规则仍不明确则追问。
- 浏览器超时：返回明确的工具失败状态；可提供无外部来源的通用建议，但不得伪造链接或声称已完成联网搜索。
- 浏览器返回零结果：展示实际查询词并建议用户补充条件或更换关键词。
- 结果整理模型失败：保留真实浏览器结果和规划信息，不丢弃来源。
- 正在执行任务时继续沿用现有单任务互斥规则。

现有 `except (asyncio.TimeoutError, Exception)` 会吞掉全部异常并伪装成 AI 推荐，本期至少要把“浏览器失败”和“模型补充”清楚标记在结果与步骤中。

## 6. 安全边界

- 浏览器只能接收 `normalized_query`，不得接收模型生成的脚本、URL 操作序列或本机命令。
- 查询长度限制为 100 字符，去除换行和控制字符。
- 用户原文保留在任务记录中，但不展示为“实际搜索词”。
- 规划结果不暴露模型思维链，只展示目标、约束、查询词和低敏感度的决策摘要。
- 本期不新增 Chrome 扩展远程控制、MCP 自动调用或 Nanobot 接入；这些能力需单独设计权限和通信协议。

## 7. 验收标准

- 搜索任务调用浏览器前必定产生结构化规划结果。
- 浏览器收到的是 `normalized_query`，不是原始 `input_text`。
- 歧义任务返回具体追问，测试能证明 BrowserAgent 未被调用。
- 不需要搜索的任务直接回答，测试能证明 BrowserAgent 未被调用。
- 模型不可用时有确定性降级，且不会把原文直接传给浏览器。
- 搜索结果展示系统理解的目标和实际查询词。
- 旧的任务创建、轮询、收藏和反馈流程继续工作。
