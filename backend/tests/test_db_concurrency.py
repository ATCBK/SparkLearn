from app.db import get_conn


def test_sqlite_connections_use_concurrency_pragmas(client):
    with get_conn() as conn:
        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        busy_timeout = conn.execute("PRAGMA busy_timeout").fetchone()[0]
        foreign_keys = conn.execute("PRAGMA foreign_keys").fetchone()[0]

    assert str(journal_mode).lower() == "wal"
    assert busy_timeout == 10000
    assert foreign_keys == 1
