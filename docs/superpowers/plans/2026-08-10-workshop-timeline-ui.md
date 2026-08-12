# Workshop Timeline UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the selected timeline workbench UI for `/tutor/workshop`, where timeline items show compact summaries by default and expand to reveal full agent content.

**Architecture:** Keep the existing `/api/tutor/chat` workshop SSE contract and adapt `hub` events into frontend timeline items. Replace the current chat-like workshop page with a three-column workbench: agent status rail, collapsible timeline, and shared board. Use local UI helpers inside the page first to keep the change scoped.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind utility classes, Playwright.

## Global Constraints

- 所有交互和回答必须使用中文（简体中文）。
- 文件编码使用 UTF-8。
- 不改动后端协议，不引入新依赖。
- 不触碰当前工作区里与本任务无关的修改。

---

### Task 1: Playwright acceptance coverage

**Files:**
- Create: `frontend/test/workshop-timeline-ui.spec.ts`

**Interfaces:**
- Consumes: existing `/tutor/workshop` route and `api.sendMessage()` SSE parsing.
- Produces: a regression test that expects a collapsed summary and expandable full content in the workshop timeline.

- [ ] **Step 1: Write the failing test**

Create a Playwright test that mocks:

- `GET /api/tutor/roles`
- `POST /api/tutor/conversations`
- `POST /api/tutor/chat` as SSE

The SSE stream should include one long `hub` event from `资料研究员` and final `text` / `done` events. The test should:

- Open `/tutor/workshop`
- Start a discussion
- Assert `研讨时间线` is visible
- Assert a compact summary text is visible
- Assert the long hidden detail is not visible before expansion
- Click the timeline item
- Assert the full content is visible

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
npx playwright test test/workshop-timeline-ui.spec.ts --project=desktop-chromium
```

Expected: FAIL because the current page has no timeline workbench and no expandable event card.

- [ ] **Step 3: Keep test scoped**

If the test fails because the page still contains old mojibake text, keep selectors based on stable Chinese text from the new target UI and `data-testid` attributes.

### Task 2: Timeline workbench implementation

**Files:**
- Modify: `frontend/src/app/tutor/workshop/page.tsx`

**Interfaces:**
- Consumes: `TutorRole[]`, `WorkshopHubEvent[]`, `api.getTutorRoles()`, `api.createTutorConversation()`, `api.sendMessage()`.
- Produces: three-column workbench with agent rail, collapsible timeline, shared board, and final conclusion panel.

- [ ] **Step 1: Implement event adaptation helpers**

Add helpers:

```ts
type TimelineEvent = WorkshopHubEvent & {
  id: string
  summary: string
  tone: 'profile' | 'tool' | 'risk' | 'action' | 'synthesis' | 'default'
}
```

`summary` should be the first meaningful sentence or a trimmed 72-character preview.

- [ ] **Step 2: Implement collapsible timeline cards**

Each card should:

- Show agent name, phase label, time, summary, and action tone.
- Store expanded IDs in React state.
- Show full `evt.content` only when expanded.
- Toggle on click with an accessible button.

- [ ] **Step 3: Implement agent status rail**

Left rail should show selected roles and system agents with visual status:

- `观察中`
- `查证中`
- `发言中`
- `等待中`
- `总结中`

Status can be derived from latest event per agent and current streaming state.

- [ ] **Step 4: Implement shared board**

Right board should derive structured display from available events and final text:

- 共识
- 证据
- 风险
- 行动项
- 可追问

Use existing final answer parser as a fallback, but display it as board sections rather than one raw text card.

- [ ] **Step 5: Preserve existing flow**

The page must still:

- Load roles.
- Allow selecting up to 6 roles.
- Create a tutor conversation.
- Send `workshopEnabled: true` and selected role IDs.
- Stream hub events and final answer.

- [ ] **Step 6: Run validation**

Run:

```bash
cd frontend
npx playwright test test/workshop-timeline-ui.spec.ts --project=desktop-chromium
npm run lint -- src/app/tutor/workshop/page.tsx test/workshop-timeline-ui.spec.ts
```

Expected: both commands exit 0.
