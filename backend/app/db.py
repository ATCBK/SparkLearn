import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterable

from .config import settings


def _ensure_dirs() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / 'users' / settings.single_user_id).mkdir(parents=True, exist_ok=True)


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
    return datetime.utcnow().isoformat() + 'Z'


def init_db() -> None:
    _ensure_dirs()
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS students (
              user_id TEXT PRIMARY KEY,
              name TEXT DEFAULT '',
              email TEXT DEFAULT '',
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

            CREATE TABLE IF NOT EXISTS tutor_roles (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              name TEXT NOT NULL,
              persona TEXT DEFAULT '',
              background TEXT DEFAULT '',
              style_guide TEXT DEFAULT '',
              rules TEXT DEFAULT '',
              enabled INTEGER DEFAULT 1,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tutor_conversations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              role_id INTEGER,
              title TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tutor_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              conversation_id INTEGER NOT NULL,
              user_id TEXT NOT NULL,
              sender_role TEXT NOT NULL,
              content TEXT NOT NULL,
              file_ids TEXT DEFAULT '[]',
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tutor_files (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              filename TEXT NOT NULL,
              stored_path TEXT NOT NULL,
              mime_type TEXT DEFAULT 'application/octet-stream',
              size_bytes INTEGER NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS knowledge_files (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              filename TEXT NOT NULL,
              stored_path TEXT NOT NULL,
              mime_type TEXT DEFAULT 'application/octet-stream',
              size_bytes INTEGER NOT NULL,
              status TEXT DEFAULT 'pending',
              tags TEXT DEFAULT '[]',
              summary TEXT DEFAULT '',
              chunk_count INTEGER DEFAULT 0,
              reference_count INTEGER DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS knowledge_chunks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_id INTEGER NOT NULL,
              chunk_index INTEGER NOT NULL,
              content TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_pets (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              name TEXT NOT NULL DEFAULT '小助手',
              avatar TEXT NOT NULL DEFAULT 'fox',
              personality TEXT NOT NULL DEFAULT 'encouraging',
              level INTEGER NOT NULL DEFAULT 1,
              xp INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(user_id)
            );

            CREATE TABLE IF NOT EXISTS agent_tasks (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              pet_id TEXT NOT NULL,
              task_type TEXT NOT NULL,
              input_text TEXT NOT NULL,
              result_json TEXT,
              error_message TEXT,
              feedback TEXT,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_agent_tasks_user
            ON agent_tasks(user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS agent_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              task_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              sender TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_agent_messages_task
            ON agent_messages(task_id, created_at ASC);

            CREATE TABLE IF NOT EXISTS agent_task_steps (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              task_id TEXT NOT NULL,
              step_index INTEGER NOT NULL,
              action TEXT NOT NULL,
              description TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_agent_task_steps
            ON agent_task_steps(task_id, step_index ASC);

            CREATE TABLE IF NOT EXISTS forum_posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              title TEXT NOT NULL,
              content TEXT NOT NULL,
              tags TEXT DEFAULT '[]',
              status TEXT NOT NULL DEFAULT 'published',
              like_count INTEGER NOT NULL DEFAULT 0,
              comment_count INTEGER NOT NULL DEFAULT 0,
              favorite_count INTEGER NOT NULL DEFAULT 0,
              view_count INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at
            ON forum_posts(created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_forum_posts_user
            ON forum_posts(user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS forum_comments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              post_id INTEGER NOT NULL,
              user_id TEXT NOT NULL,
              content TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'published',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_forum_comments_post
            ON forum_comments(post_id, created_at ASC);

            CREATE TABLE IF NOT EXISTS forum_post_likes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              post_id INTEGER NOT NULL,
              user_id TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_post_likes_unique
            ON forum_post_likes(post_id, user_id);

            CREATE TABLE IF NOT EXISTS forum_post_favorites (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              post_id INTEGER NOT NULL,
              user_id TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_post_favorites_unique
            ON forum_post_favorites(post_id, user_id);

            CREATE TABLE IF NOT EXISTS forum_attachments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              post_id INTEGER NOT NULL,
              user_id TEXT NOT NULL,
              filename TEXT NOT NULL,
              stored_path TEXT NOT NULL,
              mime_type TEXT DEFAULT 'application/octet-stream',
              size_bytes INTEGER NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_forum_attachments_post
            ON forum_attachments(post_id);

            CREATE TABLE IF NOT EXISTS forum_browsing_history (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              post_id INTEGER NOT NULL,
              viewed_at TEXT NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_history_unique
            ON forum_browsing_history(user_id, post_id);

            CREATE INDEX IF NOT EXISTS idx_forum_history_user_time
            ON forum_browsing_history(user_id, viewed_at DESC);
            """
        )

        _ensure_student_columns(conn)

        timestamp = now_iso()
        conn.execute(
            """
            INSERT OR IGNORE INTO students(user_id, name, email, major, grade, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (settings.single_user_id, '张同学', 'student@sparklearn.ai', '计算机科学', '大二', timestamp, timestamp),
        )
        conn.execute(
            """
            UPDATE students
            SET email = ?
            WHERE user_id = ? AND (email IS NULL OR email = '')
            """,
            ('student@sparklearn.ai', settings.single_user_id),
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
                json.dumps(['期末提分', '竞赛准备'], ensure_ascii=False),
                '有一定基础',
                json.dumps(['函数', '面向对象'], ensure_ascii=False),
                json.dumps(['视觉型', '实践型'], ensure_ascii=False),
                '归纳型',
                60,
                '能独立完成小项目',
                '函数与模块',
                1,
                timestamp,
            ),
        )

        _seed_mastery(conn)
        _seed_tutor_workspace(conn)


def _ensure_student_columns(conn: sqlite3.Connection) -> None:
    columns = {row['name'] for row in conn.execute('PRAGMA table_info(students)').fetchall()}
    if 'email' not in columns:
        conn.execute("ALTER TABLE students ADD COLUMN email TEXT DEFAULT ''")


def _seed_mastery(conn: sqlite3.Connection) -> None:
    row = conn.execute(
        'SELECT COUNT(1) AS cnt FROM mastery_records WHERE user_id = ?',
        (settings.single_user_id,),
    ).fetchone()
    if row and row['cnt'] > 0:
        return

    now = now_iso()
    seed = [
        ('1.1', '变量定义', 0.90, '基础语法'),
        ('1.2', '数据类型', 0.85, '基础语法'),
        ('2.1', '条件语句', 0.75, '控制流'),
        ('2.2', '循环', 0.70, '控制流'),
        ('3.1', '函数定义', 0.62, '函数'),
        ('3.2', '参数传递', 0.55, '函数'),
        ('3.3', '闭包', 0.45, '函数'),
        ('4.1', '类与对象', 0.30, '面向对象'),
    ]

    conn.executemany(
        """
        INSERT INTO mastery_records(
            user_id, knowledge_point_id, knowledge_point_name, score, chapter, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [(settings.single_user_id, *x, now) for x in seed],
    )


def _seed_tutor_workspace(conn: sqlite3.Connection) -> None:
    ts = now_iso()
    existing_count = conn.execute(
        'SELECT COUNT(*) as cnt FROM tutor_roles WHERE user_id = ?',
        (settings.single_user_id,),
    ).fetchone()['cnt']

    # 默认角色库
    default_roles = [
        {
            'name': '小星同学-通用导师',
            'persona': '你是一位全能型学习导师"小星同学"，擅长根据学生的学习画像和当前阶段，灵活切换教学策略。你既能严谨地讲解数学推导，也能用生活化的例子解释编程概念，还能帮助学生制定学习计划、管理时间、缓解压力。\n\n你的风格是温和而专业的，善于用启发式提问引导学生思考，同时给出具体可执行的建议。你会根据学生的反馈动态调整讲解深度和节奏。',
            'background': '适用人群：所有学习者\n教学场景：概念讲解、题目辅导、学习规划、代码实战、情绪支持\n知识边界：数学、物理、编程、学习方法、时间管理',
            'style_guide': '根据问题类型灵活切换风格\n先理解学生的困惑点再给建议\n用简洁清晰的语言，避免过度专业术语\n给出可执行的下一步行动',
            'rules': '必须做：\n- 回答要具体、有针对性\n- 代码示例必须可运行\n- 数学推导要分步骤\n- 关注学生的情绪状态\n\n不可做：\n- 不给出模糊的建议\n- 不忽略学生的实际水平\n- 不一次性给太多信息',
        },
    ]

    # 补充缺失的默认角色
    if existing_count < len(default_roles):
        existing_names = [
            row['name'] for row in conn.execute(
                'SELECT name FROM tutor_roles WHERE user_id = ?', (settings.single_user_id,)
            ).fetchall()
        ]
        for role_data in default_roles:
            if role_data['name'] not in existing_names:
                conn.execute(
                    """
                    INSERT INTO tutor_roles(
                      user_id, name, persona, background, style_guide, rules, enabled, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                    """,
                    (
                        settings.single_user_id,
                        role_data['name'],
                        role_data['persona'],
                        role_data['background'],
                        role_data['style_guide'],
                        role_data['rules'],
                        ts,
                        ts,
                    ),
                )

    # 确保有一个角色 ID
    role_row = conn.execute(
        'SELECT id FROM tutor_roles WHERE user_id = ? ORDER BY id ASC LIMIT 1',
        (settings.single_user_id,),
    ).fetchone()
    role_id = int(role_row['id']) if role_row else 1

    conv_row = conn.execute(
        'SELECT id FROM tutor_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
        (settings.single_user_id,),
    ).fetchone()

    if not conv_row:
        conn.execute(
            """
            INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (settings.single_user_id, role_id, '新对话', ts, ts),
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
