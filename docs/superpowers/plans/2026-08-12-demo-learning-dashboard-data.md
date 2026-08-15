# Demo Learning Dashboard Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a realistic, database-backed demo dataset for SparkLearn student learning analytics, teacher dashboards, and administrator account views.

**Architecture:** Add deterministic-but-natural seed data in the backend, store every demo learner as a real login-capable account, and make teacher dashboard aggregation read from database-backed learner records instead of static mock objects. Administrator statistics should reflect the same accounts and activity records.

**Tech Stack:** FastAPI, SQLite, pytest, passlib password hashing, existing SparkLearn `students`, `profiles`, `mastery_records`, `contribution_days`, `teacher_classes`, `teacher_class_members`, `teacher_broadcasts`, `broadcast_deliveries`, and admin tables.

## Global Constraints

- 所有交互、代码注释、文档内容使用简体中文。
- 所有文件使用 UTF-8 编码。
- 学生手机号必须使用中国 11 位手机号，号段混合 `166`、`138`、`139`、`188`、`199`、`151`、`152`、`178` 等，不集中在一个号段。
- 演示学生必须是真实可登录账号，统一演示密码为 `SparkLearn1`，数据库只存密码哈希。
- 教师大屏数据必须从数据库聚合，不能继续依赖 `_mock_students()` 作为主数据源。
- 模拟数据要自然随机但可复现，避免均匀分桶、整齐递增、模块化痕迹。

---

### Task 1: 演示数据测试约束

**Files:**
- Create: `backend/tests/test_demo_dataset.py`

**Interfaces:**
- Consumes: `app.db.init_db()`, `app.db.fetch_all()`, `app.auth.verify_password()`
- Produces: Test expectations for seeded demo accounts and dashboard aggregation.

- [ ] **Step 1: Write failing tests**

```python
from app.auth import verify_password
from app.db import fetch_all, fetch_one, init_db
from app.routes.teacher import _build_students


def test_demo_students_are_login_capable_chinese_phone_accounts():
    init_db()
    rows = fetch_all(
        """
        SELECT user_id, name, phone, password_hash, is_demo, admin_role
        FROM students
        WHERE is_demo = 1 AND user_id LIKE 'demo_stu_%'
        ORDER BY user_id
        """
    )
    assert len(rows) >= 16
    prefixes = {row["phone"][:3] for row in rows}
    assert len(prefixes) >= 5
    assert prefixes <= {"166", "138", "139", "188", "199", "151", "152", "178"}
    for row in rows:
        assert len(row["phone"]) == 11
        assert row["phone"].isdigit()
        assert row["name"]
        assert row["password_hash"]
        assert verify_password("SparkLearn1", row["password_hash"])
        assert row["admin_role"] == ""


def test_teacher_dashboard_students_come_from_seeded_database_accounts():
    init_db()
    students = _build_students()
    demo_students = [student for student in students if student["id"].startswith("demo_stu_")]
    assert len(demo_students) >= 16
    assert all(student["source"] == "database" for student in demo_students)
    assert len({student["quiz_accuracy"] for student in demo_students}) >= 10
    assert len({student["total_hours"] for student in demo_students}) >= 10
    assert any(student["risk_level"] == "danger" for student in demo_students)
    assert any(student["risk_level"] == "warning" for student in demo_students)
    assert any(student["risk_level"] == "normal" for student in demo_students)


def test_admin_dashboard_counts_demo_teacher_and_students():
    init_db()
    teacher = fetch_one("SELECT user_id, admin_role, password_hash FROM students WHERE user_id = 'demo_teacher_python'")
    assert teacher is not None
    assert teacher["admin_role"] == "teacher_admin"
    assert verify_password("SparkLearn1", teacher["password_hash"])
    student_count = fetch_one("SELECT COUNT(1) AS cnt FROM students WHERE user_id LIKE 'demo_stu_%'")["cnt"]
    assert student_count >= 16
    class_members = fetch_one("SELECT COUNT(1) AS cnt FROM teacher_class_members WHERE student_id LIKE 'demo_stu_%'")["cnt"]
    assert class_members >= student_count
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest backend/tests/test_demo_dataset.py -q`
Expected: FAIL because demo seed accounts and database-backed teacher source do not exist yet.

### Task 2: 数据库种子生成器

**Files:**
- Modify: `backend/app/db.py`
- Modify: `backend/app/db_postgresql.py` only if import compatibility is broken by SQLite changes.

**Interfaces:**
- Produces: `_seed_demo_learning_dataset(conn: sqlite3.Connection) -> None`
- Produces: student rows with `user_id` prefix `demo_stu_`, teacher row `demo_teacher_python`, demo class and memberships.

- [ ] **Step 1: Add deterministic seed data**

Implement a seed helper that:
- Creates one teacher account `demo_teacher_python` with phone `16600009001`, `admin_role = 'teacher_admin'`, password `SparkLearn1`.
- Creates at least 18 students with mixed Chinese phone prefixes.
- Inserts profile, mastery, contribution, class membership, broadcasts, deliveries, forum activity, and audit logs.
- Uses deterministic values with small non-uniform variations, not `random.random()` at runtime.

- [ ] **Step 2: Call seed helper from `init_db()`**

Call `_seed_demo_learning_dataset(conn)` after base seed helpers.

- [ ] **Step 3: Run focused tests**

Run: `pytest backend/tests/test_demo_dataset.py::test_demo_students_are_login_capable_chinese_phone_accounts -q`
Expected: PASS.

### Task 3: 教师大屏聚合改造

**Files:**
- Modify: `backend/app/routes/teacher.py`

**Interfaces:**
- Consumes: database rows from Task 2.
- Produces: `_build_students() -> list[dict[str, Any]]` with `source: "database"` for seeded students.

- [ ] **Step 1: Replace `_mock_students()` dependency**

Change `_build_students()` to load demo and real learner accounts from `students`, `profiles`, `mastery_records`, and `contribution_days`.

- [ ] **Step 2: Keep natural risk calculation**

Compute `risk_level` from recent activity, quiz accuracy, task completion, and weak point count.

- [ ] **Step 3: Run dashboard tests**

Run: `pytest backend/tests/test_demo_dataset.py::test_teacher_dashboard_students_come_from_seeded_database_accounts -q`
Expected: PASS.

### Task 4: 管理员端口径与账号文档

**Files:**
- Create: `docs/demo-accounts.md`
- Modify: `docs/评委评阅说明.md`

**Interfaces:**
- Consumes: seeded account list.
- Produces: answerable demo account documentation.

- [ ] **Step 1: Document login accounts**

Document admin, teacher, and several representative student accounts with phone, password, and what to inspect.

- [ ] **Step 2: Update judge-facing document**

Replace placeholder account text in `docs/评委评阅说明.md` with the canonical demo account reference.

- [ ] **Step 3: Run admin test**

Run: `pytest backend/tests/test_demo_dataset.py::test_admin_dashboard_counts_demo_teacher_and_students -q`
Expected: PASS.

### Task 5: Final Verification

**Files:**
- No additional files expected.

**Interfaces:**
- Produces: verified implementation report.

- [ ] **Step 1: Run focused backend tests**

Run: `pytest backend/tests/test_demo_dataset.py backend/tests/test_teacher_classes.py backend/tests/test_admin_api.py -q`
Expected: PASS.

- [ ] **Step 2: Inspect database sample**

Run a read-only SQLite query showing demo students, phone prefixes, teacher class members, and admin counts.

- [ ] **Step 3: Summarize viewing effect**

Report the exact pages to inspect:
- `/teacher/dashboard`
- `/teacher/students`
- `/teacher/students/<demo student id>`
- `/admin/dashboard`
- `/admin/users`
- `/admin/audit`
