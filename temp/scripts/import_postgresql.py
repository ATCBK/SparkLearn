#!/usr/bin/env python3
"""
PostgreSQL 数据导入脚本
将 JSON 文件中的数据导入到 PostgreSQL/PolarDB 数据库
"""
import json
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

# 添加项目路径
ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "backend"))


def import_database(json_file: str, db_config: dict) -> None:
    """从 JSON 文件导入数据到 PostgreSQL"""
    print(f"正在读取数据文件: {json_file}")

    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"找到 {len(data)} 个表")

    # 连接数据库
    print(f"正在连接数据库: {db_config['host']}:{db_config['port']}/{db_config['dbname']}")
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()

    # 按照外键依赖顺序导入
    import_order = [
        'students', 'profiles', 'mastery_records', 'contribution_days',
        'tutor_roles', 'tutor_conversations', 'tutor_messages', 'tutor_files',
        'knowledge_files', 'knowledge_chunks', 'agent_pets', 'agent_tasks',
        'agent_messages', 'agent_task_steps', 'forum_posts', 'forum_comments',
        'forum_post_likes', 'forum_post_favorites', 'forum_attachments',
        'forum_browsing_history', 'teacher_material_files', 'teacher_broadcasts'
    ]

    # 添加表中存在但不在导入顺序中的表
    for table in data.keys():
        if table not in import_order:
            import_order.append(table)

    total_imported = 0

    for table in import_order:
        if table not in data or not data[table]:
            print(f"  跳过表 {table}: 无数据")
            continue

        rows = data[table]
        if not rows:
            print(f"  跳过表 {table}: 空表")
            continue

        try:
            columns = list(rows[0].keys())
            columns_str = ', '.join(columns)

            # 使用 ON CONFLICT DO NOTHING 避免重复插入
            query = f"""
                INSERT INTO {table} ({columns_str})
                VALUES %s
                ON CONFLICT DO NOTHING
            """

            values = [tuple(row.values()) for row in rows]

            # 批量插入
            execute_values(cursor, query, values, page_size=1000)

            total_imported += len(rows)
            print(f"  导入表 {table}: {len(rows)} 条记录")

        except Exception as e:
            print(f"  导入表 {table} 失败: {e}")
            conn.rollback()
            # 尝试逐条插入
            print(f"  尝试逐条插入...")
            success_count = 0
            for row in rows:
                try:
                    columns = list(row.keys())
                    columns_str = ', '.join(columns)
                    placeholders = ', '.join(['%s'] * len(columns))
                    query = f"INSERT INTO {table} ({columns_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
                    cursor.execute(query, tuple(row.values()))
                    success_count += 1
                except Exception as e2:
                    print(f"    跳过记录: {e2}")
            print(f"  逐条插入完成: {success_count}/{len(rows)} 条记录")
            total_imported += success_count

    # 提交事务
    conn.commit()

    # 验证导入结果
    print("\n验证导入结果:")
    for table in import_order:
        if table not in data or not data[table]:
            continue
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} 条记录")
        except Exception as e:
            print(f"  {table}: 验证失败 - {e}")

    cursor.close()
    conn.close()

    print(f"\n导入完成!")
    print(f"  总导入记录数: {total_imported}")


def main():
    # 默认路径
    default_json = str(ROOT_DIR / "backup_data.json")

    # 默认数据库配置（需要根据实际情况修改）
    default_db_config = {
        "host": "localhost",
        "port": 5432,
        "dbname": "sparklearn",
        "user": "postgres",
        "password": "postgres"
    }

    # 支持命令行参数
    json_file = sys.argv[1] if len(sys.argv) > 1 else default_json

    if not Path(json_file).exists():
        print(f"错误: 数据文件不存在: {json_file}")
        print("请先运行 export_sqlite.py 导出数据")
        sys.exit(1)

    # 从环境变量或配置文件读取数据库配置
    from app.config import settings
    db_config = {
        "host": settings.db_host,
        "port": settings.db_port,
        "dbname": settings.db_name,
        "user": settings.db_user,
        "password": settings.db_password
    }

    # 如果命令行提供了数据库配置
    if len(sys.argv) > 2:
        db_config["host"] = sys.argv[2]
    if len(sys.argv) > 3:
        db_config["port"] = int(sys.argv[3])
    if len(sys.argv) > 4:
        db_config["dbname"] = sys.argv[4]
    if len(sys.argv) > 5:
        db_config["user"] = sys.argv[5]
    if len(sys.argv) > 6:
        db_config["password"] = sys.argv[6]

    print("=" * 60)
    print("PostgreSQL 数据导入工具")
    print("=" * 60)
    print(f"数据文件: {json_file}")
    print(f"目标数据库: {db_config['host']}:{db_config['port']}/{db_config['dbname']}")
    print(f"用户: {db_config['user']}")
    print("=" * 60)

    confirm = input("确认开始导入？(y/N): ")
    if confirm.lower() != 'y':
        print("已取消导入")
        sys.exit(0)

    import_database(json_file, db_config)


if __name__ == "__main__":
    main()
