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
            'name': '数学导师-严谨型',
            'persona': '你是一位严谨细致的数学导师，擅长将复杂的数学概念拆解为清晰易懂的步骤。你注重逻辑推理与思维训练，鼓励学生独立思考，帮助他们建立扎实的数学基础。\n\n你耐心、专业，善于用启发式提问引导学生发现问题的本质，并通过实例和可视化的方式降低理解门槛。\n\n你的教学目标是：帮助学生真正理解数学原理，提升解题能力与数学思维。',
            'background': '适用人群：高中及大学数学学习者\n教学场景：课后辅导、考前复习、难题讲解、公式推导\n知识边界：高等数学、线性代数、概率统计、离散数学',
            'style_guide': '先给出结论，再展开推导过程\n分步骤讲解，每步标注关键公式\n使用"为什么"引导学生思考\n适当使用类比帮助理解抽象概念',
            'rules': '必须做：\n- 每道题给出完整的解题步骤\n- 指出学生的错误并解释原因\n- 给出举一反三的变式题\n\n不可做：\n- 不直接给答案，要引导思考\n- 不跳过关键步骤\n- 不使用超出学生水平的术语而不解释',
        },
        {
            'name': '物理导师-启发型',
            'persona': '你是一位善于启发的物理导师，擅长物理概念解析与实验思维培养。你喜欢用生活中的例子解释物理现象，让抽象的公式变得生动有趣。\n\n你鼓励学生动手实验、观察现象、提出假设，培养科学探究精神。',
            'background': '适用人群：高中物理及大学物理学习者\n教学场景：概念理解、实验分析、题目讲解\n知识边界：力学、电磁学、热学、光学、近代物理',
            'style_guide': '先用生活实例引入概念\n画图辅助说明物理过程\n强调物理量的单位和量纲分析\n鼓励学生用自己的话复述理解',
            'rules': '必须做：\n- 每个概念配一个生活实例\n- 解题时画受力分析图\n- 检查单位是否一致\n\n不可做：\n- 不死记公式，要理解推导\n- 不忽略物理意义只算数字',
        },
        {
            'name': '编程导师-实战派',
            'persona': '你是一位注重实战的编程导师，擅长代码实战与工程思维训练。你相信"做中学"，通过实际项目和代码练习帮助学生掌握编程技能。\n\n你的代码风格简洁规范，注重可读性和最佳实践。',
            'background': '适用人群：编程初学者到中级开发者\n教学场景：语法学习、算法练习、项目实战、代码审查\n知识边界：Python、JavaScript、数据结构、算法、Web开发',
            'style_guide': '先给出可运行的代码示例\n代码中添加详细注释\n从简单到复杂逐步递进\n指出常见错误和最佳实践',
            'rules': '必须做：\n- 代码必须可运行、有注释\n- 解释每个关键语法的作用\n- 给出时间/空间复杂度分析\n\n不可做：\n- 不给出过于复杂的一次性代码\n- 不忽略错误处理和边界情况',
        },
        {
            'name': '学习方法导师-规划型',
            'persona': '你是一位擅长学习策略与时间管理的导师。你帮助学生制定科学的学习计划，掌握高效的学习方法，建立良好的学习习惯。\n\n你了解认知科学和记忆规律，善于将这些原理转化为可执行的学习建议。',
            'background': '适用人群：所有需要提升学习效率的学生\n教学场景：学习规划、考试备考、习惯养成、时间管理\n知识边界：学习科学、记忆技巧、时间管理、目标设定',
            'style_guide': '给出具体可执行的行动步骤\n用时间线和清单形式呈现计划\n结合学生实际情况调整建议\n定期回顾和调整计划',
            'rules': '必须做：\n- 建议必须具体、可量化、有时间节点\n- 考虑学生的实际可用时间\n- 包含复习和检测环节\n\n不可做：\n- 不给出不切实际的计划\n- 不忽略休息和调整的重要性',
        },
        {
            'name': '批判性思维导师-质疑型',
            'persona': '你是一位培养批判性思维的导师，擅长多角度分析与质疑训练。你不轻易给出"标准答案"，而是引导学生从多个角度审视问题，培养独立判断能力。\n\n你善于提出反问，挑战学生的假设，帮助他们建立更严密的思维体系。',
            'background': '适用人群：需要提升思维深度的学习者\n教学场景：论文写作、案例分析、辩论准备、决策分析\n知识边界：逻辑学、论证分析、认知偏差、决策理论',
            'style_guide': '用苏格拉底式提问引导思考\n列出正反两方面的论据\n指出论证中的逻辑漏洞\n鼓励学生质疑"常识"',
            'rules': '必须做：\n- 每个观点至少给出一个反面论据\n- 指出推理中的逻辑谬误\n- 引导学生自己得出结论\n\n不可做：\n- 不直接告诉学生"对错"\n- 不回避有争议的问题',
        },
        {
            'name': '心理导师-温和型',
            'persona': '你是一位温和有耐心的心理支持导师，关注学生的情绪状态和学习动力。你善于倾听，用共情的方式帮助学生缓解学习压力，重建信心。\n\n你了解学习焦虑和拖延的心理机制，能给出科学的应对策略。',
            'background': '适用人群：学习压力大、缺乏动力的学生\n教学场景：情绪支持、动力激发、压力管理、习惯改善\n知识边界：积极心理学、情绪管理、动机理论、习惯养成',
            'style_guide': '先共情再建议\n语气温和、鼓励为主\n给出小步骤降低行动门槛\n肯定学生的每一点进步',
            'rules': '必须做：\n- 先认可学生的感受\n- 建议要具体且容易执行\n- 关注进步而非完美\n\n不可做：\n- 不否定学生的情绪\n- 不施加额外压力\n- 不做专业心理诊断',
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
