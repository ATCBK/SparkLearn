"""
数据库抽象层 - 根据配置自动选择 SQLite 或 PostgreSQL
"""
from .config import settings


def _get_db_module():
    """根据配置返回对应的数据库模块"""
    if settings.db_type == "postgresql":
        from . import db_postgresql as db_module
    else:
        from . import db_sqlite as db_module
    return db_module


# 导出统一接口
def get_conn():
    return _get_db_module().get_conn()


def init_db():
    return _get_db_module().init_db()


def now_iso():
    return _get_db_module().now_iso()


def fetch_one(query: str, params: tuple = ()):
    return _get_db_module().fetch_one(query, params)


def fetch_all(query: str, params: tuple = ()):
    return _get_db_module().fetch_all(query, params)


def execute(query: str, params: tuple = ()):
    return _get_db_module().execute(query, params)
