# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import random
import sqlite3
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.auth import hash_password  # noqa: E402
from app.db import init_db  # noqa: E402
from app.config import settings  # noqa: E402


MOCK_PREFIX = "mock_admin_"
TARGET_TOTAL_USERS = 156
TARGET_TEACHERS = 30
TARGET_KNOWLEDGE_FILES = 272


MAJORS = [
    ("人工智能实验班", "2025级", ["机器学习", "深度学习", "自然语言处理", "计算机视觉"]),
    ("软件工程", "2024级", ["Web 前端工程", "后端服务开发", "软件测试", "项目管理"]),
    ("数据科学与大数据技术", "2024级", ["Python 数据分析", "数据可视化", "数据库系统", "统计学习"]),
    ("计算机科学与技术", "2023级", ["数据结构", "算法设计", "操作系统", "计算机网络"]),
    ("智能教育技术", "2025级", ["学习分析", "教学设计", "教育测量", "AIGC 课程资源"]),
    ("网络空间安全", "2023级", ["网络攻防", "密码学基础", "安全运维", "代码审计"]),
    ("数字媒体技术", "2024级", ["交互设计", "Three.js", "音视频处理", "用户研究"]),
    ("电子信息工程", "2023级", ["信号处理", "嵌入式基础", "传感器应用", "物联网实践"]),
]

SURNAMES = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜"
GIVEN_NAMES = [
    "子涵", "宇轩", "梓萱", "雨桐", "思源", "嘉怡", "浩然", "若曦", "明哲", "诗涵",
    "泽宇", "欣怡", "一诺", "俊杰", "佳宁", "博文", "清扬", "知远", "睿琪", "晨曦",
    "舒航", "沐阳", "书瑶", "景行", "亦辰", "昕妍", "铭泽", "安琪", "嘉言", "语晨",
]
TEACHER_NAMES = [
    "周明远", "陈若楠", "李嘉诚", "王书航", "赵雨薇", "孙启航", "刘景行", "黄思齐", "吴佳宁", "郑明哲",
    "何清扬", "徐知远", "马一鸣", "朱海宁", "胡文博", "林书瑶", "郭子墨", "罗欣怡", "梁浩然", "宋语晨",
    "高睿琪", "谢安琪", "唐沐阳", "许嘉言", "邓梓萱", "曹亦辰", "叶晨曦", "袁泽宇", "沈若曦", "韩俊杰",
]
DOC_TYPES = [
    ("课程讲义", "application/pdf", ".pdf"),
    ("实验指导书", "application/pdf", ".pdf"),
    ("章节题库", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"),
    ("项目案例", "application/pdf", ".pdf"),
    ("知识点速查表", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"),
    ("课堂板书整理", "text/markdown", ".md"),
    ("考前复习清单", "application/pdf", ".pdf"),
    ("学习路径模板", "application/json", ".json"),
]
AUDIT_ACTIONS = [
    ("导入用户", "success"),
    ("更新教师权限", "info"),
    ("同步知识库索引", "success"),
    ("处理内容审核", "warning"),
    ("巡检模型服务", "info"),
    ("冻结异常账号", "warning"),
]


def now_iso(dt: datetime | None = None) -> str:
    value = dt or datetime.now(UTC)
    return value.replace(tzinfo=None).isoformat(timespec="seconds") + "Z"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def mock_name(index: int) -> str:
    return f"{SURNAMES[index % len(SURNAMES)]}{GIVEN_NAMES[index % len(GIVEN_NAMES)]}"


def phone(base: int, index: int) -> str:
    return f"{base + index:011d}"


def delete_previous_mock(conn: sqlite3.Connection) -> None:
    file_ids = [
        row["id"]
        for row in conn.execute(
            "SELECT id FROM knowledge_files WHERE user_id LIKE ? OR stored_path LIKE ?",
            (f"{MOCK_PREFIX}%", "mock_admin_overview/%"),
        ).fetchall()
    ]
    if file_ids:
        placeholders = ",".join("?" for _ in file_ids)
        conn.execute(f"DELETE FROM knowledge_chunks WHERE file_id IN ({placeholders})", file_ids)
    conn.execute(
        "DELETE FROM knowledge_files WHERE user_id LIKE ? OR stored_path LIKE ?",
        (f"{MOCK_PREFIX}%", "mock_admin_overview/%"),
    )
    conn.execute("DELETE FROM tutor_messages WHERE user_id LIKE ?", (f"{MOCK_PREFIX}%",))
    conn.execute("DELETE FROM tutor_conversations WHERE user_id LIKE ?", (f"{MOCK_PREFIX}%",))
    conn.execute("DELETE FROM teacher_class_members WHERE student_id LIKE ?", (f"{MOCK_PREFIX}%",))
    conn.execute("DELETE FROM teacher_classes WHERE user_id LIKE ?", (f"{MOCK_PREFIX}%",))
    conn.execute("DELETE FROM teacher_subjects WHERE user_id LIKE ?", (f"{MOCK_PREFIX}%",))
    conn.execute("DELETE FROM profiles WHERE user_id LIKE ?", (f"{MOCK_PREFIX}%",))
    conn.execute(
        "DELETE FROM admin_audit_logs WHERE actor_id LIKE ? OR target_id LIKE ? OR detail_json LIKE ?",
        (f"{MOCK_PREFIX}%", f"{MOCK_PREFIX}%", "%admin_overview_demo%"),
    )
    conn.execute("DELETE FROM students WHERE user_id LIKE ?", (f"{MOCK_PREFIX}%",))


def seed_users(conn: sqlite3.Connection) -> tuple[list[str], list[str]]:
    random.seed(20260811)
    timestamp = now_iso()
    existing_users = int(conn.execute("SELECT COUNT(1) AS cnt FROM students").fetchone()["cnt"] or 0)
    users_to_create = max(0, TARGET_TOTAL_USERS - existing_users)
    student_count = max(0, users_to_create - TARGET_TEACHERS)
    teacher_ids: list[str] = []
    student_ids: list[str] = []
    password_hash = hash_password("SparkLearn1")

    teacher_rows = []
    for index in range(TARGET_TEACHERS):
        major, grade, subjects = MAJORS[index % len(MAJORS)]
        created_at = now_iso(datetime.now(UTC) - timedelta(days=210 - index * 3))
        user_id = f"{MOCK_PREFIX}teacher_{index + 1:03d}"
        teacher_ids.append(user_id)
        teacher_rows.append(
            (
                user_id,
                f"{TEACHER_NAMES[index]}老师",
                phone(13900000000, index + 1),
                f"teacher{index + 1:03d}@sparklearn.demo",
                major,
                grade,
                password_hash,
                "teacher_admin",
                "active",
                88 + index % 10,
                "admin_demo_seed",
                created_at,
                now_iso(datetime.now(UTC) - timedelta(days=index % 17)),
                now_iso(datetime.now(UTC) - timedelta(days=index % 11)),
            )
        )

        for subject_index, subject in enumerate(subjects[: 2 + index % 2]):
            conn.execute(
                """
                INSERT INTO teacher_subjects(
                  user_id, name, code, description, enabled, deleted, sort_order, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?)
                """,
                (
                    user_id,
                    subject,
                    f"demo-{index + 1:03d}-{subject_index + 1}",
                    f"{major}教师团队维护的{subject}课程与知识库资料。",
                    subject_index + 1,
                    timestamp,
                    timestamp,
                ),
            )

    student_rows = []
    for index in range(student_count):
        major, grade, _subjects = MAJORS[(index * 3 + 1) % len(MAJORS)]
        created_at = now_iso(datetime.now(UTC) - timedelta(days=random.randint(1, 180)))
        updated_at = now_iso(datetime.now(UTC) - timedelta(days=random.randint(0, 24)))
        user_id = f"{MOCK_PREFIX}student_{index + 1:03d}"
        status = "frozen" if index in {18, 57, 86, 112} else "active"
        score = random.randint(52, 96)
        name = mock_name(index)
        student_ids.append(user_id)
        student_rows.append(
            (
                user_id,
                name,
                phone(18826000000, index + 1),
                f"student{index + 1:03d}@sparklearn.demo",
                major,
                grade,
                password_hash,
                "",
                status,
                score,
                "admin_demo_seed",
                created_at,
                updated_at,
                now_iso(datetime.now(UTC) - timedelta(days=random.randint(0, 20))),
            )
        )

    conn.executemany(
        """
        INSERT INTO students(
          user_id, name, phone, email, major, grade, password_hash, admin_role,
          account_status, permission_score, auth_provider, created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        teacher_rows + student_rows,
    )

    profile_rows = []
    for index, user_id in enumerate(teacher_ids + student_ids):
        major, _grade, subjects = MAJORS[index % len(MAJORS)]
        profile_rows.append(
            (
                user_id,
                json.dumps(["期末提分", "项目实践", "能力画像完善"], ensure_ascii=False),
                random.choice(["入门", "有一定基础", "进阶提升", "项目实战中"]),
                json.dumps(random.sample(subjects, k=min(2, len(subjects))), ensure_ascii=False),
                json.dumps(random.sample(["视觉型", "实践型", "讨论型", "结构化笔记", "短视频微课"], k=2), ensure_ascii=False),
                random.choice(["归纳型", "演绎型", "案例驱动", "问题驱动"]),
                random.choice([45, 60, 75, 90, 120]),
                f"正在围绕{major}进行阶段性训练",
                random.choice(subjects),
                1,
                timestamp,
            )
        )
    conn.executemany(
        """
        INSERT INTO profiles(
          user_id, goal, knowledge_level, weak_points, learning_preference,
          cognitive_style, daily_time, practical_ability, current_stage, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        profile_rows,
    )

    return teacher_ids, student_ids


def seed_knowledge(conn: sqlite3.Connection, teacher_ids: list[str]) -> None:
    random.seed(20260812)
    rows = []
    for index in range(TARGET_KNOWLEDGE_FILES):
        major, _grade, subjects = MAJORS[index % len(MAJORS)]
        subject = subjects[index % len(subjects)]
        doc_type, mime_type, suffix = DOC_TYPES[index % len(DOC_TYPES)]
        status = "indexed" if index < 256 else ("processing" if index < 266 else "pending")
        title = f"{subject}{doc_type}-{2026 - index % 3}秋第{index % 12 + 1:02d}版{suffix}"
        created_at = now_iso(datetime.now(UTC) - timedelta(days=random.randint(0, 210)))
        updated_at = now_iso(datetime.now(UTC) - timedelta(days=random.randint(0, 18)))
        chunk_count = random.randint(8, 64) if status == "indexed" else random.randint(0, 6)
        rows.append(
            (
                teacher_ids[index % len(teacher_ids)],
                index % 20 + 1,
                subject,
                title,
                f"mock_admin_overview/{major}/{subject}/{title}",
                mime_type,
                random.randint(180_000, 9_800_000),
                status,
                json.dumps([major, subject, doc_type], ensure_ascii=False),
                f"覆盖{subject}核心概念、课堂例题和阶段练习，适合{major}学生课前预习与课后复盘。",
                chunk_count,
                random.randint(1, 18) if status == "indexed" else 0,
                created_at,
                updated_at,
            )
        )

    conn.executemany(
        """
        INSERT INTO knowledge_files(
          user_id, subject_id, subject_name, filename, stored_path, mime_type, size_bytes,
          status, tags, summary, chunk_count, reference_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


def seed_activity(conn: sqlite3.Connection, teacher_ids: list[str], student_ids: list[str]) -> None:
    random.seed(20260813)
    timestamp = now_iso()
    conversation_rows = []
    message_rows = []
    active_students = student_ids[: min(96, len(student_ids))]
    for index, user_id in enumerate(active_students):
        count = 2 + index % 5
        for conv_index in range(count):
            created_at = now_iso(datetime.now(UTC) - timedelta(days=random.randint(0, 45), hours=random.randint(0, 20)))
            title = random.choice(["函数专项答疑", "项目报告润色", "错题复盘", "学习路径调整", "知识库问答"])
            conversation_rows.append((user_id, None, f"{title}-{conv_index + 1}", created_at, created_at))

    conn.executemany(
        """
        INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        conversation_rows,
    )

    conv_rows = conn.execute(
        "SELECT id, user_id, title, created_at FROM tutor_conversations WHERE user_id LIKE ?",
        (f"{MOCK_PREFIX}%",),
    ).fetchall()
    for row in conv_rows:
        message_rows.append((row["id"], row["user_id"], "user", f"请帮我梳理{row['title']}的学习重点。", "[]", "{}", row["created_at"]))
        message_rows.append((row["id"], row["user_id"], "assistant", "已根据你的画像拆成目标、薄弱点和下一步练习。", "[]", "{}", row["created_at"]))
    conn.executemany(
        """
        INSERT INTO tutor_messages(conversation_id, user_id, sender_role, content, file_ids, meta_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        message_rows,
    )

    for index, teacher_id in enumerate(teacher_ids[:12]):
        major, _grade, subjects = MAJORS[index % len(MAJORS)]
        class_id = conn.execute(
            """
            INSERT INTO teacher_classes(
              user_id, name, subject_id, subject_name, grade, description, invite_code, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
            """,
            (
                teacher_id,
                f"{major}{index % 3 + 1}班",
                index + 1,
                subjects[0],
                "2026 春季班",
                f"{subjects[0]}课程演示班级，用于管理员平台总览数据联调。",
                f"ADM{index + 1:04d}",
                timestamp,
                timestamp,
            ),
        ).lastrowid
        members = []
        for student_id in student_ids[index * 8 : index * 8 + 18]:
            members.append((class_id, student_id, "", "", "admin_import", "active", timestamp, timestamp))
        conn.executemany(
            """
            INSERT OR IGNORE INTO teacher_class_members(
              class_id, student_id, display_name, phone, source, status, joined_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            members,
        )

    audit_rows = []
    for index in range(34):
        action, level = AUDIT_ACTIONS[index % len(AUDIT_ACTIONS)]
        actor_id = teacher_ids[index % len(teacher_ids)]
        created_at = now_iso(datetime.now(UTC) - timedelta(days=index % 9, hours=index % 7))
        audit_rows.append(
            (
                actor_id,
                "演示运营管理员",
                action,
                "demo",
                f"{MOCK_PREFIX}audit_{index + 1:03d}",
                f"管理员总览演示事件 {index + 1}",
                level,
                json.dumps({"source": "admin_overview_demo", "batch": "2026-08"}, ensure_ascii=False),
                created_at,
            )
        )
    conn.executemany(
        """
        INSERT INTO admin_audit_logs(
          actor_id, actor_name, action, target_type, target_id, target_label, level, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        audit_rows,
    )


def main() -> None:
    init_db()
    with connect() as conn:
        delete_previous_mock(conn)
        teacher_ids, student_ids = seed_users(conn)
        seed_knowledge(conn, teacher_ids)
        seed_activity(conn, teacher_ids, student_ids)
        conn.commit()

        stats = {
            "注册用户": conn.execute("SELECT COUNT(1) AS cnt FROM students").fetchone()["cnt"],
            "教师账号": conn.execute("SELECT COUNT(1) AS cnt FROM students WHERE admin_role = 'teacher_admin'").fetchone()["cnt"],
            "知识库文档": conn.execute("SELECT COUNT(1) AS cnt FROM knowledge_files").fetchone()["cnt"],
            "已索引文档": conn.execute("SELECT COUNT(1) AS cnt FROM knowledge_files WHERE status = 'indexed'").fetchone()["cnt"],
            "Tutor 对话": conn.execute("SELECT COUNT(1) AS cnt FROM tutor_conversations").fetchone()["cnt"],
        }
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
