# Role Workshop One-Line Mentor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-line role generator in the tutor role workshop that creates a personalized mentor from the user's question and learning profile, saves it immediately, and switches the active tutor to that new role.

**Architecture:** Add a backend generation endpoint that builds a role blueprint from the current learner profile and the user's one-line request, then persists it through the existing `tutor_roles` table. Expose that endpoint in the shared frontend API, add a compact entry point in the role workshop, and pass a pending role selection back to the tutor page so the current conversation adopts the new mentor automatically.

**Tech Stack:** FastAPI, Pydantic, SQLite/PostgreSQL-backed tutor role storage, Next.js App Router, React, shared frontend API wrappers, pytest.

---

### Task 1: Backend role-generation endpoint

**Files:**
- Modify: `backend/app/routes/tutor_eval.py`
- Test: `backend/tests/test_tutor_role_generation.py`

- [ ] **Step 1: Write the failing test**

```python
import pytest

from app.routes import tutor_eval


@pytest.mark.asyncio
async def test_generate_role_from_question_uses_profile_and_persists(monkeypatch):
    monkeypatch.setattr(tutor_eval, "_load_profile_snapshot", lambda: {
        "goal": ["竞赛提分"],
        "knowledge_level": "中等",
        "weak_points": ["函数"],
        "learning_preference": ["先结论后推导"],
        "cognitive_style": "归纳型",
        "daily_time": 45,
        "practical_ability": "能独立完成小项目",
        "current_stage": "强化训练",
    })
    monkeypatch.setattr(tutor_eval, "_execute_returning_id", lambda *args, **kwargs: 77)
    monkeypatch.setattr(tutor_eval, "fetch_one", lambda *args, **kwargs: {
        "id": 77,
        "name": "函数提分导师",
        "persona": "擅长函数题型拆解",
        "background": "结合竞赛提分目标",
        "style_guide": "先结论后步骤",
        "rules": "不直接给答案",
        "enabled": 1,
        "created_at": "2026-06-19T00:00:00Z",
        "updated_at": "2026-06-19T00:00:00Z",
    })

    async def fake_stream_chat_events(*args, **kwargs):
        yield "text", {"content": '{"name":"函数提分导师","persona":"擅长函数题型拆解","background":"结合竞赛提分目标","style_guide":"先结论后步骤","rules":"不直接给答案"}'}

    monkeypatch.setattr(tutor_eval.spark_lite, "stream_chat_events", fake_stream_chat_events)

    result = await tutor_eval._generate_role_from_question("我想快速补函数")

    assert result["name"] == "函数提分导师"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_tutor_role_generation.py::test_generate_role_from_question_uses_profile_and_persists -v`
Expected: fail because `_generate_role_from_question` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a `GenerateRoleReq` model, a `_generate_role_from_question()` helper that reads the learner profile and parses JSON output from `spark_lite`, and a `POST /api/tutor/roles/generate-from-question` endpoint that inserts the resulting role into `tutor_roles` and returns the created row.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_tutor_role_generation.py::test_generate_role_from_question_uses_profile_and_persists -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routes/tutor_eval.py backend/tests/test_tutor_role_generation.py
git commit -m "feat: add one-line tutor role generation"
```

### Task 2: Frontend API wiring

**Files:**
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/real.ts`
- Modify: `frontend/src/lib/api/index.ts`

- [ ] **Step 1: Write the failing test**

No new unit test is required here; verify the typed API surface compiles after the new method is added.

- [ ] **Step 2: Run a type-check-oriented compile path**

Run the frontend typecheck command used by the repo after the method is declared.

- [ ] **Step 3: Write minimal implementation**

Add a request/response type for the generated role endpoint and expose `createTutorRoleFromQuestion()` through the shared API wrapper.

- [ ] **Step 4: Run typecheck or build to verify it passes**

Run the repo's frontend typecheck command and confirm there are no missing exports or type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/types.ts frontend/src/lib/api/real.ts frontend/src/lib/api/index.ts
git commit -m "feat: expose tutor role generation api"
```

### Task 3: Role workshop and active tutor handoff

**Files:**
- Modify: `frontend/src/app/tutor/roles/page.tsx`
- Modify: `frontend/src/app/tutor/page.tsx`

- [ ] **Step 1: Write the failing test**

Use the existing manual flow as acceptance evidence: generate a role from the workshop, navigate to `/tutor`, and confirm the current tutor role matches the generated role.

- [ ] **Step 2: Run the flow to verify it fails**

Open the role workshop and confirm there is no one-line create entry yet.

- [ ] **Step 3: Write minimal implementation**

Add a concise question input and a “一键生成并启用” action in the role workshop. After creation, store the new role ID as a pending selection and move to `/tutor`; on the tutor page, consume the pending role ID and update the current conversation to use that role.

- [ ] **Step 4: Run the flow to verify it passes**

Manually generate a role, land on `/tutor`, and confirm the current tutor role pill and conversation role reflect the new role.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/tutor/roles/page.tsx frontend/src/app/tutor/page.tsx
git commit -m "feat: auto switch to generated tutor role"
```

### Task 4: Verification

**Files:**
- None

- [ ] **Step 1: Run backend tests**

Run the new role-generation test together with the tutor route regression tests.

- [ ] **Step 2: Run frontend validation**

Run the frontend typecheck or build command used in this repo.

- [ ] **Step 3: Smoke test the user flow**

Create a role from the workshop, verify it is saved, and verify the tutor page opens with that role active.

