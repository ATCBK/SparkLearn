# A2UI Chat Task Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/tutor` 对话页通过 A2UI 风格 SSE 事件渲染多张学习任务卡。

**Architecture:** 后端在现有 `/api/tutor/chat` SSE 流中新增 `a2ui` 事件，前端在当前 assistant 消息上归并协议消息并用白名单组件渲染。PoC 不引入全站 UI 框架，不允许后端下发任意可执行代码。

**Tech Stack:** FastAPI、Python、Next.js 16、React 19、TypeScript、SSE。

## Global Constraints

- 所有交互和回答使用简体中文。
- 所有新增文本文件使用 UTF-8 编码。
- A2UI 协议标记使用 `protocol: "a2ui"`、`version: "0.9.1"`。
- 只在 `/tutor` 对话页实现 PoC。
- 只渲染 `sparklearn.task_cards.v1` catalog。

---

### Task 1: 后端 A2UI 任务卡 envelope

**Files:**
- Modify: `backend/app/routes/tutor_eval.py`
- Test: `backend/tests/test_tutor_a2ui_task_cards.py`

**Interfaces:**
- Produces: `_should_emit_a2ui_task_cards(message: str, mode: str) -> bool`
- Produces: `_build_a2ui_task_card_events(message: str, answer: str, conversation_id: int) -> list[dict[str, Any]]`

- [ ] **Step 1: Write the failing test**

```python
from backend.app.routes.tutor_eval import _build_a2ui_task_card_events, _should_emit_a2ui_task_cards


def test_should_emit_a2ui_task_cards_for_learning_plan_request():
    assert _should_emit_a2ui_task_cards("帮我安排本周 Python 学习任务卡", "knowledge_qa") is True


def test_should_not_emit_a2ui_task_cards_for_image_mode():
    assert _should_emit_a2ui_task_cards("帮我生成一张图", "image_gen") is False


def test_build_a2ui_task_card_events_returns_surface_data_and_component():
    events = _build_a2ui_task_card_events(
        "帮我安排本周 Python 学习任务卡",
        "可以按三步走：基础语法、练习、复盘。",
        12,
    )

    assert [list(event.keys())[0] for event in events] == ["createSurface", "updateDataModel", "updateComponents"]
    surface_id = events[0]["createSurface"]["surfaceId"]
    assert surface_id == "sparklearn-task-cards-12"
    assert events[0]["createSurface"]["catalogId"] == "sparklearn.task_cards.v1"
    tasks = events[1]["updateDataModel"]["value"]["tasks"]
    assert len(tasks) == 3
    assert tasks[0]["actions"][0]["name"] == "complete_task"
    assert events[2]["updateComponents"]["components"][0]["component"] == "SparkTaskCards"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_tutor_a2ui_task_cards.py -q`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

Add helpers to `backend/app/routes/tutor_eval.py`, then emit each envelope as `yield ("a2ui", envelope)` after the assistant answer is available and before `done`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_tutor_a2ui_task_cards.py -q`

Expected: PASS.

### Task 2: 前端类型和 API 事件归并

**Files:**
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/real.ts`

**Interfaces:**
- Produces: `A2UIEnvelope`
- Produces: `A2UISurfaceState`
- Produces: `handlers.onA2UI?: (envelope: A2UIEnvelope) => void`

- [ ] **Step 1: Write type definitions**

Add TypeScript interfaces for A2UI envelopes and attach `a2uiSurfaces?: A2UISurfaceState[]` to `Message`.

- [ ] **Step 2: Parse `a2ui` SSE events**

In `sendMessage()`, when `evt.type === "a2ui"`, call `handlers?.onA2UI?.(evt.payload as A2UIEnvelope)`.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: no new type or lint errors from changed files.

### Task 3: 前端任务卡渲染

**Files:**
- Create: `frontend/src/components/a2ui/A2UITaskCards.tsx`
- Modify: `frontend/src/app/tutor/page.tsx`

**Interfaces:**
- Consumes: `A2UISurfaceState[]`
- Produces: `<A2UITaskCards surfaces={...} onAction={...} />`

- [ ] **Step 1: Add focused renderer component**

Create a client component that renders `SparkTaskCards` surfaces only.

- [ ] **Step 2: Wire into `/tutor`**

Store incoming A2UI envelopes on the current assistant message, render cards below markdown content, and map action clicks to `handleSend()` text commands.

- [ ] **Step 3: Run build or lint**

Run: `npm run lint`

Expected: no new lint errors from changed files.

### Task 4: Manual smoke test

**Files:**
- No code files.

**Interfaces:**
- Consumes: running backend and frontend.

- [ ] **Step 1: Start backend**

Run backend dev server on `127.0.0.1:8000`.

- [ ] **Step 2: Start frontend**

Run frontend dev server.

- [ ] **Step 3: Try prompt**

Send: `帮我安排本周 Python 学习任务卡，做成多张任务卡`

Expected: assistant text appears and three task cards appear below it.
