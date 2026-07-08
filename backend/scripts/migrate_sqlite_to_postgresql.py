# -*- coding: utf-8 -*-
"""将本地 SQLite 业务数据迁移到云端 PostgreSQL。

默认跳过验证码、浏览记录、资讯缓存等临时历史数据；本地 SQLite 文件不会被修改。
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json, execute_batch


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings  # noqa: E402
from app.db_postgresql import init_db  # noqa: E402


DEFAULT_SKIP_TABLES = {
    "sms_codes",
    "forum_browsing_history",
    "info_stream_cache",
    "info_stream_bookmarks",
}


def _sqlite_tables(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    ).fetchall()
    return [str(row[0]) for row in rows]


def _sqlite_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [str(row[1]) for row in conn.execute(f'PRAGMA table_info("{table}")').fetchall()]


def _postgres_columns_and_types(conn, table: str) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table,),
        )
        return {str(name): str(data_type) for name, data_type in cur.fetchall()}


def _coerce_value(value: Any, pg_type: str) -> Any:
    if value == "" and pg_type in {"timestamp without time zone", "timestamp with time zone", "date"}:
        return None
    if pg_type == "boolean":
        return bool(value)
    if pg_type in {"json", "jsonb"}:
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return Json(value)
        if isinstance(value, str) and value.strip():
            try:
                return Json(json.loads(value))
            except json.JSONDecodeError:
                return Json(value)
        return Json({} if pg_type == "jsonb" else value)
    return value


def _quote_sqlite_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _reset_sequences(conn, tables: list[str]) -> None:
    with conn.cursor() as cur:
        for table in tables:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = %s
                  AND column_default LIKE 'nextval%%'
                """,
                (table,),
            )
            for (column_name,) in cur.fetchall():
                cur.execute(
                    """
                    SELECT setval(
                        pg_get_serial_sequence(%s, %s),
                        COALESCE((SELECT MAX({column}) FROM {table}), 0) + 1,
                        false
                    )
                    """.format(
                        column=sql.Identifier(column_name).as_string(conn),
                        table=sql.Identifier(table).as_string(conn),
                    ),
                    (table, column_name),
                )


def migrate(include_history: bool = False) -> None:
    if settings.db_type.lower() not in {"postgres", "postgresql"}:
        raise RuntimeError(f"当前 DB_TYPE={settings.db_type}，请先切换为 postgresql")

    sqlite_path = settings.db_path
    if not sqlite_path.exists():
        raise FileNotFoundError(f"SQLite 数据库不存在：{sqlite_path}")

    init_db()

    skip_tables = set() if include_history else DEFAULT_SKIP_TABLES
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    pg_conn = psycopg2.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
        sslmode=settings.db_ssl_mode,
    )

    try:
        sqlite_tables = _sqlite_tables(sqlite_conn)
        pg_tables = []
        with pg_conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                """
            )
            pg_tables = [str(row[0]) for row in cur.fetchall()]

        tables = [table for table in sqlite_tables if table in pg_tables and table not in skip_tables]
        missing = sorted(set(sqlite_tables) - set(pg_tables))
        if missing:
            raise RuntimeError(f"PostgreSQL 缺少表：{missing}")

        with pg_conn.cursor() as cur:
            if tables:
                cur.execute(
                    sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
                        sql.SQL(", ").join(sql.Identifier(table) for table in tables)
                    )
                )

        counts: list[tuple[str, int]] = []
        for table in tables:
            sqlite_columns = _sqlite_columns(sqlite_conn, table)
            pg_types = _postgres_columns_and_types(pg_conn, table)
            columns = [column for column in sqlite_columns if column in pg_types]
            select_columns = ", ".join(_quote_sqlite_identifier(column) for column in columns)
            rows = sqlite_conn.execute(
                f"SELECT {select_columns} FROM {_quote_sqlite_identifier(table)}"
            ).fetchall()
            payload = [
                tuple(_coerce_value(row[column], pg_types[column]) for column in columns)
                for row in rows
            ]
            if payload:
                insert_sql = sql.SQL("INSERT INTO {table} ({columns}) VALUES ({values})").format(
                    table=sql.Identifier(table),
                    columns=sql.SQL(", ").join(sql.Identifier(column) for column in columns),
                    values=sql.SQL(", ").join(sql.Placeholder() for _ in columns),
                )
                with pg_conn.cursor() as cur:
                    execute_batch(cur, insert_sql, payload, page_size=100)
            counts.append((table, len(payload)))

        _reset_sequences(pg_conn, tables)
        pg_conn.commit()

        print("迁移完成。")
        if skip_tables:
            print("已跳过历史/临时表：" + ", ".join(sorted(skip_tables)))
        for table, count in counts:
            print(f"{table}: {count}")
    except Exception:
        pg_conn.rollback()
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="将 SQLite 业务数据迁移到 PostgreSQL")
    parser.add_argument(
        "--include-history",
        action="store_true",
        help="同时迁移验证码、浏览历史、资讯缓存等临时历史数据",
    )
    args = parser.parse_args()
    migrate(include_history=args.include_history)


if __name__ == "__main__":
    main()
