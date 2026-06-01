#!/usr/bin/env python3
"""
SQLite 数据导出脚本
将 SQLite 数据库中的数据导出为 JSON 文件，用于迁移到 PostgreSQL
"""
import sqlite3
import json
import sys
from pathlib import Path

# 添加项目路径
ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "backend"))


def export_database(db_path: str, output_file: str) -> None:
    """导出 SQLite 数据库到 JSON 文件"""
    print(f"正在连接数据库: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # 获取所有表名
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row['name'] for row in cursor.fetchall()]

    print(f"找到 {len(tables)} 个表: {', '.join(tables)}")

    data = {}
    total_rows = 0

    for table in tables:
        try:
            rows = conn.execute(f"SELECT * FROM {table}").fetchall()
            data[table] = [dict(row) for row in rows]
            row_count = len(data[table])
            total_rows += row_count
            print(f"  导出表 {table}: {row_count} 条记录")
        except Exception as e:
            print(f"  导出表 {table} 失败: {e}")
            data[table] = []

    conn.close()

    # 写入 JSON 文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n导出完成!")
    print(f"  总记录数: {total_rows}")
    print(f"  输出文件: {output_file}")
    print(f"  文件大小: {Path(output_file).stat().st_size / 1024:.2f} KB")


def main():
    # 默认路径
    default_db = str(ROOT_DIR / "backend" / "data" / "db" / "sparklearn.db")
    default_output = str(ROOT_DIR / "backup_data.json")

    # 支持命令行参数
    db_path = sys.argv[1] if len(sys.argv) > 1 else default_db
    output_file = sys.argv[2] if len(sys.argv) > 2 else default_output

    if not Path(db_path).exists():
        print(f"错误: 数据库文件不存在: {db_path}")
        sys.exit(1)

    export_database(db_path, output_file)


if __name__ == "__main__":
    main()
