# 学习伙伴搜索意图分析与工具编排实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让学习伙伴先理解搜索意图、生成规范化查询，再决定是否调用浏览器检索工具，并向用户展示实际搜索内容。

**Architecture:** 新增纯后端 `agent_intent.py` 作为结构化规划器；现有 `/api/agent/task`、后台任务和轮询协议保持不变。搜索执行器只接收规划器的 `normalized_query`，澄清和直接回答分支均不导入或调用 BrowserAgent。

**Tech Stack:** FastAPI、Pydantic、现有 LLM 流适配、Playwright BrowserAgent、Next.js 16、React 19、TypeScript、pytest、Playwright Test。

**Spec:** `docs/superpowers/specs/2026-08-20-agent-search-intent-design.md`

## Global Constraints

- 所有文件使用 UTF-8，交互、注释、文档和测试名称使用简体中文。
- 浏览器只能接收经过校验的 `normalized_query`，不得以用户原文作为失败兜底。
- 查询最多 100 字符，去除换行、控制字符和命令式冗余。
- 规划器不暴露思维链，只输出目标、约束、关注点、查询词和置信度。
- 澄清和直接回答不得调用 BrowserAgent，也不得奖励搜索 XP。
- Chrome 扩展、MCP 自动调用和 Nanobot 不在本期范围。
- 生产代码必须由先失败的测试驱动。

---

### Task 1: 结构化搜索意图规划器

**Files:**
- Create: `backend/app/agent_intent.py`
- Create: `backend/tests/test_agent_intent.py`

**Interfaces:**
- Produces: `plan_search_intent(input_text, stream_llm) -> dict[str, Any]`
- Produces: `normalize_search_query(value) -> str`
- Produces decisions: `search | clarify | respond`

- [ ] **Step 1: 写规划器失败测试**

覆盖有效 LLM JSON、代码块 JSON、非法输出、空输出、歧义短句、普通解释、命令式长句、查询清洗、长度限制和置信度钳制。核心断言：

```python
assert plan["decision"] == "search"
assert plan["normalized_query"] != original_text
assert "\n" not in plan["normalized_query"]
assert len(plan["normalized_query"]) <= 100
```

- [ ] **Step 2: 运行测试并确认模块不存在**

Run: `python -m pytest backend/tests/test_agent_intent.py -q`

Expected: FAIL。

- [ ] **Step 3: 实现 JSON 规划和规则降级**

LLM schema 固定为 `decision/goal/normalized_query/constraints/output_focus/clarification_question/confidence`。规则降级先移除“帮我、请、找一下、搜索、资料”等命令词；有效关键词不足时返回 `clarify`，普通解释请求返回 `respond`。

- [ ] **Step 4: 运行规划器测试**

Run: `python -m pytest backend/tests/test_agent_intent.py -q`

Expected: PASS。

### Task 2: 搜索任务编排与可追溯结果

**Files:**
- Modify: `backend/app/routes/agent.py`
- Modify: `backend/tests/test_api.py`
- Modify: `backend/tests/test_agent_intent.py`

**Interfaces:**
- Consumes: Task 1 的 `plan_search_intent()`。
- Extends: Agent 搜索结果包含 `query_used` 和 `intent`。

- [ ] **Step 1: 写执行链失败测试**

用可观察的 fake BrowserAgent 断言：明确搜索时只收到 `normalized_query`；歧义和 `respond` 分支调用次数为 0；规划非法时走规则而非原文；浏览器零结果和超时带明确状态；澄清/回答不奖励 XP。

- [ ] **Step 2: 运行后端测试并确认原文仍被传给浏览器**

Run: `python -m pytest backend/tests/test_agent_intent.py backend/tests/test_api.py -k "agent" -q`

Expected: 新增断言 FAIL。

- [ ] **Step 3: 集成规划分支**

`_execute_fallback_task()` 对 `search` 先规划：

```python
plan = await plan_search_intent(input_text, _stream_agent_llm)
if plan["decision"] == "clarify":
    return {"answer": plan["clarification_question"], "intent": plan, "award_xp": False}
if plan["decision"] == "respond":
    return {"answer": await _answer_without_browser(input_text, plan), "intent": plan, "award_xp": False}
result = await _do_search(task_id, plan["normalized_query"], persona)
return {**result, "query_used": plan["normalized_query"], "intent": plan}
```

`_execute_task()` 仅当 `result.get("award_xp", True)` 为真时奖励 XP，并在保存前移除内部控制字段或将其放入 `_meta`。

- [ ] **Step 4: 运行 Agent 后端测试**

Run: `python -m pytest backend/tests/test_agent_intent.py backend/tests/test_api.py -k "agent" -q`

Expected: PASS。

### Task 3: 前端展示理解目标与实际检索词

**Files:**
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/components/agent/AgentChat.tsx`
- Modify: `frontend/test/agent-flow.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `query_used` 和 `intent`。

- [ ] **Step 1: 写前端失败测试**

Mock 完成任务结果，断言页面展示“理解目标”“实际检索词”；澄清结果作为正常学习伙伴消息展示且没有搜索结果卡片。

- [ ] **Step 2: 运行测试并确认旧 UI 缺少规划信息**

Run: `cd frontend; npx playwright test test/agent-flow.spec.ts`

Expected: FAIL。

- [ ] **Step 3: 扩展类型与结果视图**

为搜索结果增加可选 `query_used` 和 `intent`，在结果列表上方使用项目现有 `SoftCard` 展示目标、约束与实际查询词。缺少新字段的旧任务保持原样渲染。

- [ ] **Step 4: 运行前端测试与质量门禁**

Run: `cd frontend; npx playwright test test/agent-flow.spec.ts; npm run lint -- "src/components/agent/AgentChat.tsx" "src/lib/api/types.ts"`

Expected: PASS。

### Task 4: 联合回归验证

**Files:**
- Modify: `docs/系统优化需求备忘-2026-08-20.md`

- [ ] **Step 1: 运行后端目标测试**

Run: `python -m pytest backend/tests/test_profile_ai.py backend/tests/test_profile_reset.py backend/tests/test_agent_intent.py backend/tests/test_api.py backend/tests/test_persistence.py -q`

Expected: PASS。

- [ ] **Step 2: 运行前端目标测试**

Run: `cd frontend; npx playwright test test/profile-ai-fusion.spec.ts test/agent-flow.spec.ts`

Expected: PASS。

- [ ] **Step 3: 运行全量质量门禁**

Run: `python -m pytest backend/tests -q`

Run: `cd frontend; npm run lint; npm run build`

Expected: 所有命令退出码为 0；若既有无关失败存在，记录准确失败测试和基线证据，不得宣称全量通过。

- [ ] **Step 4: 更新需求备忘状态**

只在对应验收项有自动化或人工证据时标记为已实现；保留未纳入本期的 Chrome 扩展远程调用、MCP 自动编排、画像数据库迁移和旧路径重算边界。
