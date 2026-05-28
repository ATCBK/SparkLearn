import json
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterable

from .config import settings


def _ensure_dirs() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / 'users' / settings.single_user_id).mkdir(parents=True, exist_ok=True)


@contextmanager
def get_conn() -> Iterable[psycopg2.extensions.connection]:
    conn = psycopg2.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
        sslmode=settings.db_ssl_mode,
        cursor_factory=RealDictCursor
    )
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
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS students (
                user_id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) DEFAULT '',
                email VARCHAR(200) DEFAULT '',
                major VARCHAR(100) DEFAULT '',
                grade VARCHAR(20) DEFAULT '',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS profiles (
                user_id VARCHAR(50) PRIMARY KEY,
                goal JSONB DEFAULT '[]',
                knowledge_level VARCHAR(50) DEFAULT '',
                weak_points JSONB DEFAULT '[]',
                learning_preference JSONB DEFAULT '[]',
                cognitive_style VARCHAR(50) DEFAULT '',
                daily_time INTEGER DEFAULT 60,
                practical_ability VARCHAR(100) DEFAULT '',
                current_stage VARCHAR(100) DEFAULT '',
                version INTEGER DEFAULT 1,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS mastery_records (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                knowledge_point_id VARCHAR(50) NOT NULL,
                knowledge_point_name VARCHAR(100) NOT NULL,
                score NUMERIC(5,2) NOT NULL,
                chapter VARCHAR(100) NOT NULL,
                last_updated TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS contribution_days (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                date VARCHAR(20) NOT NULL,
                count INTEGER NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_contribution_unique
            ON contribution_days(user_id, date);

            CREATE TABLE IF NOT EXISTS tutor_roles (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                persona TEXT DEFAULT '',
                background TEXT DEFAULT '',
                style_guide TEXT DEFAULT '',
                rules TEXT DEFAULT '',
                enabled INTEGER DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tutor_conversations (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                role_id INTEGER,
                title VARCHAR(200) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tutor_messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                sender_role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                file_ids JSONB DEFAULT '[]',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tutor_files (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                stored_path VARCHAR(500) NOT NULL,
                mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
                size_bytes INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS knowledge_files (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                stored_path VARCHAR(500) NOT NULL,
                mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
                size_bytes INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                tags JSONB DEFAULT '[]',
                summary TEXT DEFAULT '',
                chunk_count INTEGER DEFAULT 0,
                reference_count INTEGER DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id SERIAL PRIMARY KEY,
                file_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS agent_pets (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL DEFAULT '小助手',
                avatar VARCHAR(50) NOT NULL DEFAULT 'fox',
                personality VARCHAR(50) NOT NULL DEFAULT 'encouraging',
                level INTEGER NOT NULL DEFAULT 1,
                xp INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE(user_id)
            );

            CREATE TABLE IF NOT EXISTS agent_tasks (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                pet_id VARCHAR(50) NOT NULL,
                task_type VARCHAR(50) NOT NULL,
                input_text TEXT NOT NULL,
                result_json TEXT,
                error_message TEXT,
                feedback TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_agent_tasks_user
            ON agent_tasks(user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS agent_messages (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                sender VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_agent_messages_task
            ON agent_messages(task_id, created_at ASC);

            CREATE TABLE IF NOT EXISTS agent_task_steps (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(50) NOT NULL,
                step_index INTEGER NOT NULL,
                action VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_agent_task_steps
            ON agent_task_steps(task_id, step_index ASC);

            CREATE TABLE IF NOT EXISTS forum_posts (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                tags JSONB DEFAULT '[]',
                status VARCHAR(20) NOT NULL DEFAULT 'published',
                like_count INTEGER NOT NULL DEFAULT 0,
                comment_count INTEGER NOT NULL DEFAULT 0,
                favorite_count INTEGER NOT NULL DEFAULT 0,
                view_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at
            ON forum_posts(created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_forum_posts_user
            ON forum_posts(user_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS forum_comments (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'published',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_forum_comments_post
            ON forum_comments(post_id, created_at ASC);

            CREATE TABLE IF NOT EXISTS forum_post_likes (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_post_likes_unique
            ON forum_post_likes(post_id, user_id);

            CREATE TABLE IF NOT EXISTS forum_post_favorites (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_post_favorites_unique
            ON forum_post_favorites(post_id, user_id);

            CREATE TABLE IF NOT EXISTS forum_attachments (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                stored_path VARCHAR(500) NOT NULL,
                mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
                size_bytes INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_forum_attachments_post
            ON forum_attachments(post_id);

            CREATE TABLE IF NOT EXISTS forum_browsing_history (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                post_id INTEGER NOT NULL,
                viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_history_unique
            ON forum_browsing_history(user_id, post_id);

            CREATE INDEX IF NOT EXISTS idx_forum_history_user_time
            ON forum_browsing_history(user_id, viewed_at DESC);

            CREATE TABLE IF NOT EXISTS teacher_material_files (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                stored_path VARCHAR(500) NOT NULL,
                mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
                size_bytes INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS teacher_broadcasts (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                title VARCHAR(200) NOT NULL,
                content TEXT NOT NULL,
                target_type VARCHAR(20) NOT NULL DEFAULT 'all',
                target_student_ids JSONB DEFAULT '[]',
                material_file_ids JSONB DEFAULT '[]',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_teacher_broadcasts_user_time
            ON teacher_broadcasts(user_id, created_at DESC);
            """
        )

        _ensure_student_columns(cursor)

        timestamp = now_iso()
        cursor.execute(
            """
            INSERT INTO students(user_id, name, email, major, grade, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO NOTHING
            """,
            (settings.single_user_id, '张同学', 'student@sparklearn.ai', '计算机科学', '大二', timestamp, timestamp),
        )
        cursor.execute(
            """
            UPDATE students
            SET email = %s
            WHERE user_id = %s AND (email IS NULL OR email = '')
            """,
            ('student@sparklearn.ai', settings.single_user_id),
        )

        cursor.execute(
            """
            INSERT INTO profiles(
                user_id, goal, knowledge_level, weak_points, learning_preference,
                cognitive_style, daily_time, practical_ability, current_stage, version, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO NOTHING
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

        _seed_mastery(cursor)
        _seed_tutor_workspace(cursor)
        _seed_forum_posts(cursor)


def _ensure_student_columns(cursor) -> None:
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'email'
    """)
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE students ADD COLUMN email VARCHAR(200) DEFAULT ''")


def _seed_mastery(cursor) -> None:
    cursor.execute(
        'SELECT COUNT(1) AS cnt FROM mastery_records WHERE user_id = %s',
        (settings.single_user_id,),
    )
    row = cursor.fetchone()
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

    for s in seed:
        cursor.execute(
            """
            INSERT INTO mastery_records(
                user_id, knowledge_point_id, knowledge_point_name, score, chapter, last_updated
            ) VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (settings.single_user_id, *s, now),
        )


def _seed_tutor_workspace(cursor) -> None:
    ts = now_iso()
    cursor.execute(
        'SELECT COUNT(*) as cnt FROM tutor_roles WHERE user_id = %s',
        (settings.single_user_id,),
    )
    existing_count = cursor.fetchone()['cnt']

    default_roles = [
        {
            'name': '小星同学-通用导师',
            'persona': '你是一位全能型学习导师"小星同学"，擅长根据学生的学习画像和当前阶段，灵活切换教学策略。你既能严谨地讲解数学推导，也能用生活化的例子解释编程概念，还能帮助学生制定学习计划、管理时间、缓解压力。\n\n你的风格是温和而专业的，善于用启发式提问引导学生思考，同时给出具体可执行的建议。你会根据学生的反馈动态调整讲解深度和节奏。',
            'background': '适用人群：所有学习者\n教学场景：概念讲解、题目辅导、学习规划、代码实战、情绪支持\n知识边界：数学、物理、编程、学习方法、时间管理',
            'style_guide': '根据问题类型灵活切换风格\n先理解学生的困惑点再给建议\n用简洁清晰的语言，避免过度专业术语\n给出可执行的下一步行动',
            'rules': '必须做：\n- 回答要具体、有针对性\n- 代码示例必须可运行\n- 数学推导要分步骤\n- 关注学生的情绪状态\n\n不可做：\n- 不给出模糊的建议\n- 不忽略学生的实际水平\n- 不一次性给太多信息',
        },
    ]

    if existing_count < len(default_roles):
        cursor.execute(
            'SELECT name FROM tutor_roles WHERE user_id = %s', (settings.single_user_id,)
        )
        existing_names = [row['name'] for row in cursor.fetchall()]
        for role_data in default_roles:
            if role_data['name'] not in existing_names:
                cursor.execute(
                    """
                    INSERT INTO tutor_roles(
                      user_id, name, persona, background, style_guide, rules, enabled, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, 1, %s, %s)
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

    cursor.execute(
        'SELECT id FROM tutor_roles WHERE user_id = %s ORDER BY id ASC LIMIT 1',
        (settings.single_user_id,),
    )
    role_row = cursor.fetchone()
    role_id = int(role_row['id']) if role_row else 1

    cursor.execute(
        'SELECT id FROM tutor_conversations WHERE user_id = %s ORDER BY updated_at DESC LIMIT 1',
        (settings.single_user_id,),
    )
    conv_row = cursor.fetchone()

    if not conv_row:
        cursor.execute(
            """
            INSERT INTO tutor_conversations(user_id, role_id, title, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (settings.single_user_id, role_id, '新对话', ts, ts),
        )


def _seed_forum_posts(cursor) -> None:
    cursor.execute("SELECT title FROM forum_posts")
    existing_titles = {str(r["title"]) for r in cursor.fetchall()}

    now = now_iso()
    modules = {
        "resource_share": [
            ("Python 函数速查表（可打印版）", "整理了一份函数参数、返回值、作用域的速查表，适合考前快速复习。"),
            ("期末复习资料包：数据结构基础", "含数组、链表、栈队列的思维导图和常见题型汇总。"),
            ("线性代数课堂笔记模板分享", "可直接用于课堂记录，包含定理、例题、错题反思区。"),
            ("英语阅读训练素材合集", "按难度分级的阅读材料，附关键词和阅读问题。"),
            ("机器学习入门代码模板", "包含数据读取、训练、评估三段基础模板，适合新手。"),
            ("前端项目答辩 PPT 模板", "简洁版本，含需求、设计、实现、结果和复盘页。"),
            ("高数错题整理表（Excel）", "按章节、题型、错误原因进行分类追踪。"),
            ("算法题刷题计划（4 周）", "每周目标和题目列表已排好，适合冲刺阶段。"),
            ("数据库实验报告范例", "给出规范结构和评分点提醒，避免格式扣分。"),
            ("学习计划看板 Notion 模板", "含日计划、周回顾、目标拆解和打卡统计。"),
            ("Java OOP 课堂例题资料", "封装、继承、多态的典型例题和讲解。"),
        ],
        "qa": [
            ("闭包为什么能记住外部变量？", "看了很多例子还是不太理解变量捕获机制，求通俗解释。"),
            ("递归和循环怎么选？", "做题时总纠结写递归还是循环，有没有判断标准。"),
            ("线性回归损失函数为什么用 MSE？", "从直觉上怎么理解均方误差更合理？"),
            ("Python 装饰器执行顺序问题", "多个装饰器叠加时到底先执行哪个？"),
            ("SQL 多表连接总是写错", "LEFT JOIN 和 INNER JOIN 在什么场景下最稳妥？"),
            ("背单词总记不住怎么办", "有没有适合每天 30 分钟的复习策略？"),
            ("二叉树层序遍历模板求优化", "我写的版本太啰嗦，想要更清晰的结构。"),
            ("项目汇报总被说逻辑不清", "技术汇报应该怎么组织结构才容易被理解？"),
            ("动态规划状态定义总想不出", "有没有从题目推状态的通用步骤？"),
            ("高数证明题怎么下手", "碰到证明题就卡住，想知道第一步该做什么。"),
            ("Git 冲突处理总出错", "多人协作时怎么减少冲突和误删代码？"),
        ],
        "team_study": [
            ("组队冲刺：Python 期末 14 天", "招 3 位同学一起每日打卡，目标 85+。"),
            ("算法共学小组招募（晚 8 点）", "每天 1 题+讲解，偏 LeetCode 热题。"),
            ("英语四级晨读搭子", "早上 7:30-8:00 线上语音晨读，互相监督。"),
            ("数据库实验周末集训", "周六下午一起做实验和报告，欢迎新手。"),
            ("前端项目结对开发", "做一个小型学习管理系统，React 技术栈。"),
            ("高数刷题互助群", "每晚 9 点对答案+讲思路，不会的题现场讨论。"),
            ("考研数学基础共学", "目标 2 个月过完一轮基础，按周计划推进。"),
            ("Java 面试题每日一练", "每日 5 题，周末集中复盘错题。"),
            ("机器学习论文精读小组", "每周一篇入门论文，轮流做分享。"),
            ("运营实习面试共学群", "行为面和案例面互练，互相给反馈。"),
            ("数据分析项目实战队", "用公开数据做完整分析并产出可展示作品。"),
        ],
        "experience_share": [
            ("我把错题本做成了提分系统", "分享如何用错题分类+复盘提升练习效率。"),
            ("从 62 分到 86 分的复盘", "核心是减少低级错误和提高审题速度。"),
            ("我用番茄钟坚持了 100 天", "给出可复制的时间块安排和中断处理方法。"),
            ("做项目时最容易踩的 5 个坑", "需求不清、边做边改、无版本管理等经验总结。"),
            ("面试失败 7 次后的改进", '如何从"回答知识点"转成"讲清解决问题能力"。'),
            ("如何建立个人知识库", "从资料收集到二次加工的一套轻量流程。"),
            ("我的英语阅读提速方法", "先扫结构再看细节，配合错因记录效果明显。"),
            ("考前一周的冲刺节奏", "不再盲目刷题，改为专题查漏补缺。"),
            ("第一次带队做共学活动", "分享组织打卡、分工和复盘的实际经验。"),
            ("如何把学习成果变成作品集", "从课程作业到可展示项目的整理步骤。"),
            ("拖延症自救：把任务拆到 20 分钟", "用最小行动单元启动，减少心理阻力。"),
        ],
    }

    rows: list[tuple] = []
    idx = 0
    for tag, posts in modules.items():
        for title, content in posts:
            idx += 1
            like_count = (idx * 3) % 19 + 1
            comment_count = (idx * 2) % 11
            favorite_count = (idx * 5) % 9
            view_count = 30 + idx * 7
            if title in existing_titles:
                continue
            rows.append(
                (
                    settings.single_user_id,
                    title,
                    content,
                    json.dumps([tag], ensure_ascii=False),
                    "published",
                    like_count,
                    comment_count,
                    favorite_count,
                    view_count,
                    now,
                    now,
                )
            )

    if rows:
        for row in rows:
            cursor.execute(
                """
                INSERT INTO forum_posts(
                    user_id, title, content, tags, status, like_count, comment_count,
                    favorite_count, view_count, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                row,
            )


def fetch_one(query: str, params: tuple[Any, ...] = ()) -> dict | None:
    with get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchone()


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict]:
    with get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchall()


def execute(query: str, params: tuple[Any, ...] = ()) -> None:
    with get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
