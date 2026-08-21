# SparkLearn Agent Town UI Implementation Plan

> **For agentic workers:** Implement inline in the existing SparkLearn workspace. Do not modify the FastAPI workshop orchestration.

**Goal:** Replace the legacy DOM workshop town with the MIT-licensed `agent-town` Canvas visualization while preserving all existing Tutor Workshop behavior.

**Architecture:** SparkLearn SSE events remain owned by the existing API client and page. A pure adapter maps Workshop metadata, phases, Hub events, errors, and completion into stable Town agents and compact timeline events. A client-only React wrapper owns the `AgentTown` Canvas instance through refs so animation frames never enter React state.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Canvas 2D through `agent-town`, Vitest.

## Global Constraints

- Keep `POST /api/tutor/chat`, SSE, roles, conversations, authentication, memory, MCP, Trust Answer, database, and model behavior unchanged.
- Do not modify `backend/app/routes/tutor_eval.py`.
- Use the npm package `agent-town` under its MIT license; do not copy its backend examples.
- Keep the existing question input, role selection, `startDiscussion()`, `sendMessage()`, final answer, and error handling.
- Optimize for 1920x1080 and usable 1440px desktop layouts.

### Task 1: Dependency and adapter contract

- [ ] Install `agent-town` and Vitest.
- [ ] Add pure adapter tests for registration, Hub deltas, phase changes, custom agents, completion, and errors.
- [ ] Implement typed Town state, configuration, and reducer-style adapter until tests pass.

### Task 2: Canvas scene and HUD

- [ ] Add a client-only Canvas scene wrapper with one engine instance, ref-based updates, click selection, resize cleanup, and teardown.
- [ ] Add task/agent status panel, Agent Inspector, and compact Event Timeline.
- [ ] Compose the three-column Agent Town workspace with completion and phase feedback.

### Task 3: Existing Workshop integration

- [ ] Expose `workshop_meta` through the existing API handler types without changing the wire protocol.
- [ ] Replace the legacy `CyberTownVerse` rendering and fixed DOM town definitions in the Workshop page.
- [ ] Preserve role selection, conversation creation, SSE callbacks, answer rendering, and errors.

### Task 4: Verification

- [ ] Run adapter tests.
- [ ] Run frontend lint.
- [ ] Run `npm run build` and fix TypeScript, SSR, hydration, import, and Canvas lifecycle errors.

