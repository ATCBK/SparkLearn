import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from .config import settings


def _ensure_dirs() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / "users" / settings.single_user_id).mkdir(parents=True, exist_ok=True)


@contextmanager
def get_conn() -> Iterable[sqlite3.Connection]:
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def init_db() -> None:
    _ensure_dirs()
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS students (
              user_id TEXT PRIMARY KEY,
              name TEXT DEFAULT '',
              major TEXT DEFAULT '',
              grade TEXT DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profiles (
              user_id TEXT PRIMARY KEY,
              goal TEXT DEFAULT '[]',
              knowledge_level TEXT DEFAULT '',
              weak_points TEXT DEFAULT '[]',
              learning_preference TEXT DEFAULT '[]',
              cognitive_style TEXT DEFAULT '',
              daily_time INTEGER DEFAULT 60,
              practical_ability TEXT DEFAULT '',
              current_stage TEXT DEFAULT '',
              version INTEGER DEFAULT 1,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS mastery_records (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              knowledge_point_id TEXT NOT NULL,
              knowledge_point_name TEXT NOT NULL,
              score REAL NOT NULL,
              chapter TEXT NOT NULL,
              last_updated TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contribution_days (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              date TEXT NOT NULL,
              count INTEGER NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_contribution_unique
            ON contribution_days(user_id, date);
            """
        )

        timestamp = now_iso()
        conn.execute(
            """
            INSERT OR IGNORE INTO students(user_id, name, major, grade, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (settings.single_user_id, "张同学", "计算机科学", "大二", timestamp, timestamp),
        )

        conn.execute(
            """
            INSERT OR IGNORE INTO profiles(
                user_id, goal, knowledge_level, weak_points, learning_preference,
                cognitive_style, daily_time, practical_ability, current_stage, version, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                settings.single_user_id,
                json.dumps(["期末提分", "竞赛准备"], ensure_ascii=False),
                "有一定基础",
                json.dumps(["函数", "面向对象"], ensure_ascii=False),
                json.dumps(["视觉型", "实践型"], ensure_ascii=False),
                "归纳型",
                60,
                "能独立完成小项目",
                "函数与模块",
                1,
                timestamp,
            ),
        )

        _seed_mastery(conn)


def _seed_mastery(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        "SELECT COUNT(1) AS cnt FROM mastery_records WHERE user_id = ?",
        (settings.single_user_id,),
    ).fetchone()
    if row and row["cnt"] > 0:
        return
    now = now_iso()
    seed = [
        ("1.1", "变量定义", 0.9, "基础语法"),
        ("1.2", "数据类型", 0.85, "基础语法"),
        ("2.1", "条件语句", 0.75, "控制流"),
        ("2.2", "循环", 0.7, "控制流"),
        ("3.1", "函数定义", 0.62, "函数"),
        ("3.2", "参数传递", 0.55, "函数"),
        ("3.3", "闭包", 0.45, "函数"),
        ("4.1", "类与对象", 0.3, "面向对象"),
    ]
    conn.executemany(
        """
        INSERT INTO mastery_records(
            user_id, knowledge_point_id, knowledge_point_name, score, chapter, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [(settings.single_user_id, *x, now) for x in seed],
    )


def fetch_one(query: str, params: tuple[Any, ...] = ()) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute(query, params).fetchone()


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return list(conn.execute(query, params).fetchall())


def execute(query: str, params: tuple[Any, ...] = ()) -> None:
    with get_conn() as conn:
        conn.execute(query, params)

