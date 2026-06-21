# Webpage Material Capture Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable browser extension that captures the current webpage text, saves it into SparkLearn "我的资料", and stores both an AI analysis card and a readable lecture script.

**Architecture:** The browser extension extracts selected text or visible page text and posts it to the FastAPI backend. The backend stores it as a `tutor_files` record, indexes text chunks for Tutor usage, and saves AI analysis JSON for the web detail page.

**Tech Stack:** Chrome Extension Manifest V3, FastAPI, SQLite/PostgreSQL schema definitions, Next.js 16 frontend, existing Spark LLM adapter.

## Global Constraints

- All user-facing copy must be Simplified Chinese.
- Text files must be UTF-8 encoded.
- Captured web materials are saved to "我的资料", not automatically to the knowledge base.
- First version targets local backend `http://127.0.0.1:8000`.

---

### Task 1: Backend Web Capture API

**Files:**
- Modify: `backend/app/db.py`
- Modify: `backend/app/db_sqlite.py`
- Modify: `backend/app/db_postgresql.py`
- Modify: `backend/app/routes/tutor_eval.py`
- Test: `backend/tests/test_web_materials.py`

**Interfaces:**
- Consumes: `POST /api/tutor/files/web-capture` payload `{ title, url, text, excerpt }`
- Produces: `TutorFile` response with `source_type`, `source_url`, `analysis`, and optional `content`

- [x] Write failing tests for web capture save and empty text rejection.
- [x] Add `tutor_files` metadata columns for web capture and AI analysis.
- [x] Save captured text as a UTF-8 `.txt` file under the existing uploads directory.
- [x] Reuse tutor file indexing so captured pages can be used in Tutor conversations.
- [x] Add AI analysis generation with fallback output.
- [x] Verify with `pytest backend/tests/test_web_materials.py -q`.

### Task 2: Web Frontend My Materials UI

**Files:**
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/real.ts`
- Modify: `frontend/src/lib/api/index.ts`
- Modify: `frontend/src/app/tutor/files/page.tsx`

**Interfaces:**
- Consumes: `api.getTutorFiles()`, `api.getTutorFile(fileId)`
- Produces: "我的资料" UI with list, details, analysis card, key points, and lecture script

- [x] Extend `TutorFile` type with source and analysis fields.
- [x] Add detail fetch API.
- [x] Update `/tutor/files` from file table to materials list and detail panel.
- [x] Run frontend type check and document unrelated existing failures.

### Task 3: Browser Extension

**Files:**
- Create: `browser-extension/manifest.json`
- Create: `browser-extension/content.js`
- Create: `browser-extension/popup.html`
- Create: `browser-extension/popup.css`
- Create: `browser-extension/popup.js`
- Create: `browser-extension/README.md`

**Interfaces:**
- Consumes: current tab DOM text and `POST /api/tutor/files/web-capture`
- Produces: an installable local Chrome/Edge extension folder

- [x] Add Manifest V3 extension metadata and permissions.
- [x] Capture selected text first, otherwise visible page text.
- [x] Add popup configuration for backend URL.
- [x] Submit captured material to SparkLearn and show success/error state.
- [x] Verify JS syntax with `node --check`.
