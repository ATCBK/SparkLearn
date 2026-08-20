# 学习画像重置与 AI 融合展示实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自动生成可追溯的融合学习画像，把 AI 结论作为画像页主体，并提供页面和对话内的安全重置与重新建档流程。

**Architecture:** 保留现有 `profiles` 表作为结构化事实源，新增 `profile_ai.py` 负责 LLM JSON 分析和显式规则降级，分析结果继续存储在用户 JSON 文件中。新增共享重置服务供画像 API 和学习伙伴聊天复用；前端使用已有设置页管理字段，画像首页只展示 AI 综合结论和按需依据。

**Tech Stack:** FastAPI、Pydantic、SQLite/PostgreSQL 兼容 SQL、讯飞/DeepSeek 统一 LLM 适配层、Next.js 16 App Router、React 19、TypeScript、pytest、Playwright。

**Spec:** `docs/superpowers/specs/2026-08-20-profile-reset-fusion-design.md`

## Global Constraints

- 所有交互、注释、文档和测试名称使用简体中文，文件编码为 UTF-8。
- 结构化字段是用户可编辑事实，AI 不得静默覆盖。
- 模型失败必须标记 `generated_by=rule_fallback`，不能伪装成 AI 结论。
- 重置保留姓名、邮箱、账号、学习记录、资源、练习、任务和学习路径；清除当前画像、专业/年级、当前分析、当前画像历史和画像语义记忆。
- 重置前归档最近状态，归档最多保留 5 条。
- 所有读写严格使用认证用户 `user_id`，不得接受客户端传入的目标用户 ID。
- 生产代码必须由先失败的测试驱动。

---

### Task 1: 画像融合分析核心

**Files:**
- Create: `backend/app/profile_ai.py`
- Create: `backend/tests/test_profile_ai.py`

**Interfaces:**
- Produces: `generate_profile_analysis(profile, history, source_type, source_text, stream_events) -> dict[str, Any]`
- Produces: `extract_dialog_profile(messages, fallback_profile, stream_events) -> dict[str, Any]`
- Produces: `build_rule_fallback_analysis(profile, source_type, reason) -> dict[str, Any]`

- [ ] **Step 1: 写画像分析失败测试**

覆盖有效 JSON、Markdown 代码块 JSON、非法 JSON、空输出、置信度钳制、数组去重和无数据不编造。断言有效结果包含：

```python
assert result["schema_version"] == "profile-analysis-v1"
assert result["generated_by"] == "llm"
assert result["profile_version"] == 2
assert result["narrative"]
assert 0.0 <= result["confidence"] <= 1.0
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `python -m pytest backend/tests/test_profile_ai.py -q`

Expected: FAIL，提示 `app.profile_ai` 不存在。

- [ ] **Step 3: 实现最小画像分析模块**

模型提示词必须要求返回 JSON，输出字段固定为 `overview/narrative/goal_gap/strengths/focus_areas/learning_strategy/next_actions/confidence`。解析失败调用：

```python
return build_rule_fallback_analysis(
    profile,
    source_type=source_type,
    reason="模型输出不可用",
)
```

规则降级只能使用传入字段，空字段写“尚未采集”或返回空数组。

- [ ] **Step 4: 运行画像分析测试并通过**

Run: `python -m pytest backend/tests/test_profile_ai.py -q`

Expected: PASS。

### Task 2: 自动分析、历史版本与读取接口

**Files:**
- Modify: `backend/app/routes/profile.py`
- Modify: `backend/tests/test_api.py`
- Modify: `backend/tests/test_persistence.py`

**Interfaces:**
- Consumes: Task 1 的画像分析函数。
- Produces: `GET /api/profile/analysis/current`
- Extends: `POST /api/profile/onboarding`、`POST /api/profile/chat`、`PUT /api/profile`、`POST /api/profile/history/analyze`

- [ ] **Step 1: 写接口失败测试**

测试建档自动写入分析文件、读取接口刷新后仍返回同一版本、人工编辑将版本加一并刷新分析、对话建档不再写固定“函数/面向对象”默认值、`/profile/chat` 不能使用其他用户会话。

- [ ] **Step 2: 运行测试并确认缺少接口或分析文件**

Run: `python -m pytest backend/tests/test_api.py backend/tests/test_persistence.py -k "profile" -q`

Expected: 新增测试 FAIL，既有测试保持 PASS。

- [ ] **Step 3: 集成自动分析**

建档和编辑流程按以下顺序执行：构造/提取字段 → 写结构化画像 → 生成融合分析 → 写 `profile_ai_analysis.json` → 写包含 narrative 的历史快照。`GET /analysis/current` 无文件时返回规则降级结果并标明状态，不触发写操作。

- [ ] **Step 4: 修复对话会话归属**

给 `POST /api/profile/chat` 增加 `current_user` 依赖，并校验：

```python
if session.get("user_id") != current_user["user_id"]:
    return fail("会话不存在或无权访问")
```

- [ ] **Step 5: 运行画像后端测试**

Run: `python -m pytest backend/tests/test_profile_ai.py backend/tests/test_api.py backend/tests/test_persistence.py -k "profile" -q`

Expected: PASS。

### Task 3: 共享重置服务与对话确认

**Files:**
- Create: `backend/app/profile_reset.py`
- Modify: `backend/app/routes/profile.py`
- Modify: `backend/app/routes/agent.py`
- Modify: `backend/tests/test_api.py`
- Create: `backend/tests/test_profile_reset.py`

**Interfaces:**
- Produces: `reset_learning_profile(user_id) -> dict[str, Any]`
- Produces: `request_reset_confirmation(user_id) -> dict[str, Any]`
- Produces: `confirm_pending_reset(user_id) -> bool`
- Produces: `DELETE /api/profile`
- Extends: `POST /api/agent/chat` 可返回可选 `action`

- [ ] **Step 1: 写重置失败测试**

覆盖直接 API 重置、归档最多 5 条、清空 major/grade、保留 name/email、清空画像语义记忆但保留 facts/perceptual、用户隔离、对话首次只确认、取消不清理、确认后重置、过期确认不重置。

- [ ] **Step 2: 运行测试并确认接口不存在**

Run: `python -m pytest backend/tests/test_profile_reset.py -q`

Expected: FAIL。

- [ ] **Step 3: 实现共享重置服务**

服务只接受服务端认证得到的 `user_id`。归档结构：

```python
{
    "reset_at": now_iso(),
    "profile": current_profile,
    "analysis": read_json(user_id, "profile_ai_analysis.json", {}),
    "history": read_json(user_id, "profile_history.json", []),
}
```

使用 `update_json()` 原子追加并截取 `[-5:]`；数据库使用兼容 SQL `DELETE FROM profiles WHERE user_id = ?` 和 `UPDATE students SET major='', grade='' ...`。

- [ ] **Step 4: 集成页面 API 和学习伙伴确认**

明确重置表达首次写入十分钟确认状态并返回：

```python
{"answer": "……请回复“确认重置”继续。", "action": {"type": "confirm_profile_reset"}}
```

确认成功返回 `navigate` 动作；普通对话继续原链路。

- [ ] **Step 5: 运行重置和 Agent 回归测试**

Run: `python -m pytest backend/tests/test_profile_reset.py backend/tests/test_api.py -k "profile or agent" -q`

Expected: PASS。

### Task 4: AI 优先的画像页面

**Files:**
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/real.ts`
- Modify: `frontend/src/lib/api/index.ts`
- Modify: `frontend/src/app/(shell)/profile/page.tsx`
- Create: `frontend/test/profile-ai-fusion.spec.ts`

**Interfaces:**
- Produces: `ProfileAnalysis` 类型和 `api.getCurrentProfileAnalysis()`。
- Consumes: Task 2 的读取接口。

- [ ] **Step 1: 写 Playwright 失败测试**

Mock 画像、融合分析、历史、资源、掌握度和任务接口。断言首屏出现“当前综合画像”“目标与差距”“适合你的学习方式”“查看分析依据”，且原始字段只能通过“查看画像资料”进入设置页。

- [ ] **Step 2: 运行测试并确认旧页面不符合断言**

Run: `cd frontend; npx playwright test test/profile-ai-fusion.spec.ts`

Expected: FAIL。

- [ ] **Step 3: 重构数据加载与页面层级**

首屏加载使用 `Promise.all()` 并行请求独立数据。页面结构按 L0/L1/L2/L3 展示，不新增第三方依赖；保留项目现有浅蓝、白色、低饱和风格。分析依据使用原生 `<details>`，原始字段管理统一链接到 `/profile/settings`。

- [ ] **Step 4: 运行页面测试、Lint 和类型构建**

Run: `cd frontend; npx playwright test test/profile-ai-fusion.spec.ts; npm run lint -- "src/app/(shell)/profile/page.tsx" "src/lib/api/types.ts" "src/lib/api/real.ts" "src/lib/api/index.ts"`

Expected: PASS。

### Task 5: 页面重置与可靠重新建档

**Files:**
- Modify: `frontend/src/app/(shell)/profile/settings/page.tsx`
- Modify: `frontend/src/app/onboarding/page.tsx`
- Modify: `frontend/src/components/agent/AgentChat.tsx`
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/real.ts`
- Modify: `frontend/src/lib/api/index.ts`
- Modify: `frontend/test/profile-ai-fusion.spec.ts`
- Modify: `frontend/test/agent-flow.spec.ts`

**Interfaces:**
- Produces: `api.resetProfile()`。
- Consumes: Task 3 的重置接口和聊天 `action`。

- [ ] **Step 1: 写前端失败测试**

测试设置页重置确认、成功后跳转 onboarding、本地完成标记删除；onboarding“重新采集”必须先调重置接口；提交建档失败不得跳首页；AgentChat 的 `navigate` 动作显示“重新开始建档”。

- [ ] **Step 2: 运行新增测试并确认失败**

Run: `cd frontend; npx playwright test test/profile-ai-fusion.spec.ts test/agent-flow.spec.ts`

Expected: FAIL。

- [ ] **Step 3: 实现共享 API 与页面交互**

`resetProfile()` 调用 `DELETE /api/profile`。重置成功后删除：

```typescript
localStorage.removeItem(`sparklearn_profile_collected_at:${userId}`)
localStorage.removeItem('sparklearn_profile_needs_recapture')
```

建档提交必须检查 `response.ok` 和响应 `success`；失败时保留当前选择并展示错误。

- [ ] **Step 4: 运行画像与 Agent 前端测试**

Run: `cd frontend; npx playwright test test/profile-ai-fusion.spec.ts test/agent-flow.spec.ts`

Expected: PASS。

- [ ] **Step 5: 运行全量前端质量门禁**

Run: `cd frontend; npm run lint; npm run build`

Expected: 两条命令退出码均为 0。
