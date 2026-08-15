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
    teacher = fetch_one(
        "SELECT user_id, admin_role, password_hash FROM students WHERE user_id = 'demo_teacher_python'"
    )
    assert teacher is not None
    assert teacher["admin_role"] == "teacher_admin"
    assert verify_password("SparkLearn1", teacher["password_hash"])

    student_count = fetch_one(
        "SELECT COUNT(1) AS cnt FROM students WHERE user_id LIKE 'demo_stu_%'"
    )["cnt"]
    assert student_count >= 16
    class_members = fetch_one(
        "SELECT COUNT(1) AS cnt FROM teacher_class_members WHERE student_id LIKE 'demo_stu_%'"
    )["cnt"]
    assert class_members >= student_count
