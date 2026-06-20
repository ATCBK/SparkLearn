# Resource Quality Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight resource quality evaluation flow in the resource center that shows a tag beside `AI讲解` and opens a modal with a radar chart and learning-fit analysis.

**Architecture:** Add one backend endpoint under `resources` that combines rule-based scoring with a short AI explanation. Update the resource center page to trigger evaluation on demand, cache results in page state, and render a reusable trigger plus a modal dialog with a radar chart.

**Tech Stack:** FastAPI, Pydantic, existing Spark LLM helper, Next.js App Router, React, TypeScript, lucide-react, existing proto UI primitives.

---

### Task 1: Define API Contracts

**Files:**
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/real.ts`

- [ ] Add resource quality result types in `frontend/src/lib/api/types.ts`
- [ ] Add `evaluateResourceQuality(resourceId: string)` in `frontend/src/lib/api/real.ts`
- [ ] Keep the response shape focused on tag, radar dimensions, summary, and advice

### Task 2: Add Backend Evaluation Endpoint

**Files:**
- Modify: `backend/app/routes/resources.py`

- [ ] Add Pydantic models for quality dimensions and response payload
- [ ] Add `POST /api/resources/{resource_id}/quality-evaluate`
- [ ] Read resource data and current student profile
- [ ] Compute rule-based dimension scores and label
- [ ] Generate short AI summary and advice with graceful fallback

### Task 3: Build Frontend Quality State and Trigger

**Files:**
- Modify: `frontend/src/app/(shell)/generate/page.tsx`

- [ ] Add page state for loading, result cache, and active dialog
- [ ] Add a trigger beside `AI讲解` in the library detail header
- [ ] Add the same trigger in the generated resource result area
- [ ] Show `评估质量` before evaluation and `标签 + 图标` after evaluation

### Task 4: Build Quality Modal with Radar Chart

**Files:**
- Modify: `frontend/src/app/(shell)/generate/page.tsx`

- [ ] Add a lightweight modal dialog implementation in-page
- [ ] Render a radar chart for four dimensions
- [ ] Render label, summary, dimension details, and advice
- [ ] Match the current light visual language instead of using heavy charts

### Task 5: Verify and Clean Up

**Files:**
- Modify: `frontend/src/app/(shell)/generate/page.tsx`
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/real.ts`
- Modify: `backend/app/routes/resources.py`

- [ ] Run targeted searches to confirm both entry points exist
- [ ] Run frontend build or type checks if available
- [ ] Run backend syntax validation if available
- [ ] Fix any integration issues and keep the feature scoped to the resource center
