# 管理员端真实化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将管理员端从前端 Mock 状态改为真实 API、真实权限、真实审计、真实影响平台用户数据的管理后台。

**Architecture:** 后端新增 `admin` 路由，使用独立管理员登录与 `require_admin_user` 依赖保护所有管理接口；用户状态、管理角色、权限配置、系统设置、审计日志持久化到 SQLite 表。前端管理端改为调用真实 API，所有操作通过后端落库并刷新页面数据。

**Tech Stack:** FastAPI、Pydantic、SQLite、JWT、Next.js App Router、React、pytest、ESLint。

## Global Constraints

- 所有交互、文档、commit 信息使用简体中文。
- 不使用 Mock 作为管理端数据源；管理端页面必须读取后端真实 API。
- 管理操作必须有管理员鉴权，普通用户 Token 必须返回 403。
- 影响用户的管理操作必须落库并写入审计日志。

---

### Task 1: 后端管理员鉴权与数据模型

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/db.py`
- Create: `backend/app/routes/admin.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_admin_api.py`

**Interfaces:**
- Produces: `POST /api/admin/login`
- Produces: `GET /api/admin/me`
- Produces: `require_admin_user()`

- [x] **Step 1: 写鉴权失败和登录测试**
- [x] **Step 2: 新增配置、数据列、审计表、设置表**
- [x] **Step 3: 实现管理员登录和依赖**
- [x] **Step 4: 跑 `pytest backend/tests/test_admin_api.py -q`**

### Task 2: 后端真实管理接口

**Files:**
- Modify: `backend/app/routes/admin.py`
- Test: `backend/tests/test_admin_api.py`

**Interfaces:**
- Produces: `GET /api/admin/dashboard`
- Produces: `GET /api/admin/users`
- Produces: `POST /api/admin/users`
- Produces: `PATCH /api/admin/users/{user_id}`
- Produces: `POST /api/admin/users/batch-authorize`
- Produces: `GET /api/admin/audit`
- Produces: `GET /api/admin/settings`
- Produces: `PUT /api/admin/settings`

- [x] **Step 1: 覆盖普通用户 403、用户冻结、权限修改、审计写入测试**
- [x] **Step 2: 查询真实 students/profiles/tutor/knowledge/forum 数据**
- [x] **Step 3: 用户创建、冻结、授权和设置保存全部落库**
- [x] **Step 4: 跑管理端 API 测试**

### Task 3: 前端管理端接真实 API

**Files:**
- Modify: `frontend/src/lib/auth.ts`
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/real.ts`
- Modify: `frontend/src/lib/api/index.ts`
- Modify: `frontend/src/app/(admin)/admin/login/page.tsx`
- Modify: `frontend/src/app/(admin)/admin/layout.tsx`
- Modify: `frontend/src/app/(admin)/admin/dashboard/page.tsx`
- Modify: `frontend/src/app/(admin)/admin/users/page.tsx`
- Modify: `frontend/src/app/(admin)/admin/audit/page.tsx`
- Modify: `frontend/src/app/(admin)/admin/settings/page.tsx`

**Interfaces:**
- Consumes: Task 1/2 API。
- Produces: 管理员端页面全部通过 `api.*Admin*` 读取和写入真实后端。

- [x] **Step 1: 增加 admin token helper 和 API wrapper**
- [x] **Step 2: 登录页调用真实登录接口**
- [x] **Step 3: dashboard/users/audit/settings 页面读取真实数据**
- [x] **Step 4: 用户冻结、批量授权、设置保存调用真实接口**

### Task 4: 验证与对抗性审查

**Files:**
- Test: `backend/tests/test_admin_api.py`
- Test: Frontend ESLint target files

- [x] **Step 1: 跑后端 API 测试**
- [x] **Step 2: 跑前端目标 lint**
- [x] **Step 3: 扫描管理端静态 Mock 残留**
- [x] **Step 4: 做对抗性审查：普通用户越权、伪 token、前端本地 token、操作是否落库、审计是否记录**
