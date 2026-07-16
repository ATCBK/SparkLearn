# Multi User Demo Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable multi-user authentication slice: phone password login, password registration, demo-account routing, user workspace initialization, and visible logout.

**Architecture:** Keep the existing FastAPI + SQLite auth stack, add password hashing and demo-user resolution in `backend/app/auth.py`, and keep JSON/file user data isolated through the existing `user_id` directory model. Update the Next.js auth page to support password and SMS login modes while preserving the current onboarding routing.

**Tech Stack:** FastAPI, SQLite, passlib bcrypt, JWT, Next.js 16 App Router, TypeScript localStorage auth.

## Global Constraints

- 所有交互和回答必须使用简体中文。
- 文件编码使用 UTF-8。
- 密码只保存哈希，禁止保存明文。
- 演示账号使用手机号 + 密码登录，真实新用户注册后进入 onboarding。

---

### Task 1: Backend Password Auth And Demo User

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/auth.py`
- Test: `backend/tests/test_auth_password.py`

**Interfaces:**
- Produces: `validate_password_strength(password: str) -> str | None`
- Produces: `hash_password(password: str) -> str`
- Produces: `verify_password(password: str, password_hash: str) -> bool`
- Produces: `POST /api/auth/password/login`

- [x] **Step 1: Write failing tests**

Create `backend/tests/test_auth_password.py` with cases for weak-password registration rejection, password registration storing a hash, password login success, wrong password rejection, and demo phone resolving to demo user.

- [x] **Step 2: Run tests to verify they fail**

Run: `pytest backend/tests/test_auth_password.py -q`
Expected: FAIL because the password login endpoint and required fields do not exist yet.

- [x] **Step 3: Implement minimal backend code**

Add config fields, database columns, password helpers, password-required registration, and password login.

- [x] **Step 4: Run tests to verify they pass**

Run: `pytest backend/tests/test_auth_password.py -q`
Expected: PASS.

### Task 2: Frontend Auth Modes And Registration Password

**Files:**
- Modify: `frontend/src/lib/api/real.ts`
- Modify: `frontend/src/app/auth/page.tsx`
- Modify: `frontend/src/app/auth/auth.css`

**Interfaces:**
- Produces: `passwordLogin(phone: string, password: string)`
- Updates: `smsRegister(phone: string, code: string, name: string, password: string)`

- [x] **Step 1: Add API client functions**

Add password login and extend registration payload.

- [x] **Step 2: Add UI mode state**

Add `loginMethod: "password" | "sms"` inside login mode and render the correct fields.

- [x] **Step 3: Add password registration fields**

Add password, confirm password, client-side validation, and submit the password to the backend.

### Task 3: Visible Logout

**Files:**
- Modify: `frontend/src/components/layout/Topbar.tsx`

**Interfaces:**
- Consumes: `logout()` from `frontend/src/lib/auth.ts`

- [x] **Step 1: Add topbar logout button**

Add a `LogOut` icon button beside the avatar that calls `logout()`.

### Task 4: Verification

**Files:**
- No source files.

- [x] **Step 1: Backend targeted tests**

Run: `pytest backend/tests/test_auth_password.py backend/tests/test_sms_client.py -q`

- [x] **Step 2: Frontend static validation**

Run: `npm run lint` in `frontend/` if available; otherwise run the project’s available build/check command and report any pre-existing failures.

