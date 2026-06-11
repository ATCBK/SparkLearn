# SparkLearn 数据库迁移计划：SQLite → PolarDB PostgreSQL

## Context

### 迁移原因
1. **生产环境需求**：SQLite 不支持高并发，不适合多用户访问
2. **国产化要求**：PolarDB PostgreSQL 是阿里云国产数据库，满足信创要求
3. **功能增强**：PostgreSQL 支持 JSONB、全文搜索等高级功能
4. **可扩展性**：云数据库支持弹性扩容、备份恢复等企业级功能

---

## 迁移方案

### 第一阶段：环境准备

#### 1.1 安装 PostgreSQL 驱动
```bash
# 添加到 requirements.txt
psycopg2-binary==2.9.9
# 或使用异步版本
asyncpg==0.29.0
```

#### 1.2 配置 PolarDB PostgreSQL
在 `.env` 文件中添加数据库配置：
```env
# 数据库配置
DB_HOST=your-polardb-host.pg.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=sparklearn
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL_MODE=require
```

#### 1.3 修改 config.py
在 `Settings` 类中添加数据库配置字段：
```python
# PostgreSQL 配置
db_host: str = "localhost"
db_port: int = 5432
db_name: str = "sparklearn"
db_user: str = ""
db_password: str = ""
db_ssl_mode: str = "prefer"

# 数据库类型选择
db_type: str = "sqlite"  # "sqlite" 或 "postgresql"
```

---

### 第二阶段：代码适配

#### 2.1 创建数据库抽象层
创建 `backend/app/db_postgresql.py`，实现与 `db.py` 相同的接口：

```python
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime
from typing import Iterable

from .config import settings

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
```

#### 2.2 SQL 语法差异处理

| SQLite 语法 | PostgreSQL 语法 | 说明 |
|------------|----------------|------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | 自增主键 |
| `TEXT` | `VARCHAR(n)` 或 `TEXT` | 文本类型 |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | 忽略冲突 |
| `INSERT OR REPLACE` | `INSERT ... ON CONFLICT ... DO UPDATE` | 更新冲突 |
| `datetime('now')` | `NOW()` | 当前时间 |
| `PRAGMA table_info()` | `information_schema.columns` | 表结构查询 |
| `?` 占位符 | `%s` 占位符 | 参数化查询 |

#### 2.3 修改 db.py 的 init_db() 函数

创建 PostgreSQL 版本的建表语句：

```sql
-- PostgreSQL 版本
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

-- 自增主键示例
CREATE TABLE IF NOT EXISTS mastery_records (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    knowledge_point_id VARCHAR(50) NOT NULL,
    knowledge_point_name VARCHAR(100) NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    chapter VARCHAR(100) NOT NULL,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### 2.4 修改参数化查询占位符

将所有 `?` 替换为 `%s`：

```python
# SQLite 版本
conn.execute("SELECT * FROM students WHERE user_id = ?", (user_id,))

# PostgreSQL 版本
cursor.execute("SELECT * FROM students WHERE user_id = %s", (user_id,))
```

#### 2.5 处理 JSON 字段

PostgreSQL 支持原生 JSONB 类型，需要调整 JSON 操作：

```python
# SQLite - 存储为 TEXT
json.dumps(data)

# PostgreSQL - 直接存储 JSONB
# psycopg2 会自动处理 Python dict/list 到 JSONB 的转换
```

---

### 第三阶段：数据迁移

#### 3.1 导出 SQLite 数据
```python
# scripts/export_sqlite.py
import sqlite3
import json

def export_database(db_path, output_file):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    tables = [
        'students', 'profiles', 'mastery_records', 'contribution_days',
        'tutor_roles', 'tutor_conversations', 'tutor_messages', 'tutor_files',
        'knowledge_files', 'knowledge_chunks', 'agent_pets', 'agent_tasks',
        'agent_messages', 'agent_task_steps', 'forum_posts', 'forum_comments',
        'forum_post_likes', 'forum_post_favorites', 'forum_attachments',
        'forum_browsing_history', 'teacher_material_files', 'teacher_broadcasts'
    ]

    data = {}
    for table in tables:
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        data[table] = [dict(row) for row in rows]

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    conn.close()
    print(f"导出完成: {output_file}")

if __name__ == "__main__":
    export_database("backend/data/db/sparklearn.db", "backup_data.json")
```

#### 3.2 导入到 PostgreSQL
```python
# scripts/import_postgresql.py
import json
import psycopg2
from psycopg2.extras import execute_values

def import_database(json_file, db_config):
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

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

    for table in import_order:
        if table not in data or not data[table]:
            continue

        rows = data[table]
        columns = rows[0].keys()

        # 构建 INSERT 语句
        placeholders = ', '.join(['%s'] * len(columns))
        columns_str = ', '.join(columns)
        query = f"INSERT INTO {table} ({columns_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"

        values = [tuple(row.values()) for row in rows]
        execute_values(cursor, query, values)

        print(f"导入 {table}: {len(rows)} 条记录")

    conn.commit()
    cursor.close()
    conn.close()
    print("导入完成")

if __name__ == "__main__":
    db_config = {
        "host": "your-polardb-host.pg.rds.aliyuncs.com",
        "port": 5432,
        "dbname": "sparklearn",
        "user": "your_username",
        "password": "your_password"
    }
    import_database("backup_data.json", db_config)
```

---

### 第四阶段：数据库切换

#### 4.1 创建数据库工厂模式
修改 `backend/app/db.py`，支持动态切换：

```python
from .config import settings

def get_db_module():
    """根据配置返回对应的数据库模块"""
    if settings.db_type == "postgresql":
        from . import db_postgresql as db_module
    else:
        from . import db_sqlite as db_module
    return db_module

# 导出统一接口
def get_conn():
    return get_db_module().get_conn()

def init_db():
    return get_db_module().init_db()

def now_iso():
    return get_db_module().now_iso()
```

#### 4.2 更新 main.py
```python
# 在 startup 事件中
@app.on_event("startup")
async def startup():
    from app.db import init_db
    init_db()  # 会根据配置自动选择 SQLite 或 PostgreSQL
```

---

### 第五阶段：测试验证

#### 5.1 单元测试
```bash
# 运行测试
pytest backend/tests/ -v

# 测试数据库连接
pytest backend/tests/test_db_connection.py -v
```

#### 5.2 功能测试清单
- [ ] 用户注册/登录
- [ ] 学习档案创建/更新
- [ ] 知识点掌握记录
- [ ] AI 导师对话
- [ ] 知识库文件上传
- [ ] 论坛发帖/评论
- [ ] 教师广播功能

#### 5.3 性能测试
```bash
# 使用 Apache Bench 测试并发
ab -n 1000 -c 50 http://localhost:8000/api/students
```

---

## 关键文件清单

### 需要修改的文件
1. `backend/requirements.txt` - 添加 psycopg2-binary
2. `backend/app/config.py` - 添加 PostgreSQL 配置
3. `backend/app/db.py` - 重构为数据库抽象层
4. `backend/app/main.py` - 更新启动逻辑

### 需要新建的文件
1. `backend/app/db_postgresql.py` - PostgreSQL 实现
2. `backend/app/db_sqlite.py` - SQLite 实现（从 db.py 拆分）
3. `scripts/export_sqlite.py` - 数据导出脚本
4. `scripts/import_postgresql.py` - 数据导入脚本
5. `scripts/migrate_schema.py` - Schema 迁移脚本

### 配置文件
1. `.env` - 添加数据库连接信息
2. `docker-compose.yml`（可选）- 本地 PostgreSQL 开发环境

---

## 风险与注意事项

### 数据类型兼容性
- SQLite 的 `TEXT` 存储 JSON → PostgreSQL 的 `JSONB`
- SQLite 的 `INTEGER` 表示布尔值 → PostgreSQL 的 `BOOLEAN`
- 时间戳格式需要统一

### SQL 语法差异
- 占位符：`?` → `%s`
- 冲突处理：`INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`
- 自增主键：`AUTOINCREMENT` → `SERIAL`

### 连接池管理
生产环境建议使用连接池：
```python
from psycopg2 import pool

connection_pool = pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=20,
    host=settings.db_host,
    port=settings.db_port,
    dbname=settings.db_name,
    user=settings.db_user,
    password=settings.db_password
)
```

### 备份策略
- 迁移前完整备份 SQLite 数据库
- PolarDB 自动备份（阿里云提供）
- 定期手动备份验证

---


## 验证方法

### 迁移成功标准
1. 所有表结构正确创建
2. 数据完整迁移（记录数一致）
3. 所有 API 接口正常工作
4. 性能达到预期指标
5. 无数据丢失或损坏

### 回滚方案
如果迁移失败：
1. 恢复 SQLite 数据库文件
2. 切换配置回 SQLite 模式
3. 重启应用服务

---

## 后续优化

1. **连接池优化**：使用 pgbouncer 或 SQLAlchemy 连接池
2. **读写分离**：PolarDB 支持读写分离架构
3. **索引优化**：根据查询模式添加合适索引
4. **监控告警**：配置阿里云数据库监控
5. **自动备份**：设置定期备份策略

---

# 设计实现

## 实际配置值

### PolarDB PostgreSQL 连接信息

```env
DB_TYPE=postgresql
DB_HOST=pc-uf6q6wb3d7w96j9h9.pg.polardb.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=sparklearn
DB_USER=xd16696787393
DB_PASSWORD=XieDi20050420@
DB_SSL_MODE=prefer
```

> **注意**：SSL 模式使用 `prefer` 而非 `require`，因为 PolarDB 实例未启用 SSL。

---

## 已完成的文件修改

### 1. 新增依赖

**文件**：`backend/requirements.txt`

```diff
+ psycopg2-binary==2.9.9
```

### 2. 配置文件更新

**文件**：`backend/app/config.py`

在 `Settings` 类中新增字段：

```python
# 数据库类型选择: "sqlite" 或 "postgresql"
db_type: str = "sqlite"

# PostgreSQL/PolarDB 配置
db_host: str = "localhost"
db_port: int = 5432
db_name: str = "sparklearn"
db_user: str = ""
db_password: str = ""
db_ssl_mode: str = "prefer"
```

**文件**：`.env`

```env
# 数据库配置
DB_TYPE=postgresql
DB_HOST=pc-uf6q6wb3d7w96j9h9.pg.polardb.rds.aliyuncs.com
DB_PORT=5432
DB_NAME=sparklearn
DB_USER=xd16696787393
DB_PASSWORD=XieDi20050420@
DB_SSL_MODE=prefer
```

### 3. 数据库抽象层

**文件**：`backend/app/db.py`

重构为数据库抽象层，根据 `DB_TYPE` 配置自动选择 SQLite 或 PostgreSQL：

```python
from .config import settings

def _get_db_module():
    """根据配置返回对应的数据库模块"""
    if settings.db_type == "postgresql":
        from . import db_postgresql as db_module
    else:
        from . import db_sqlite as db_module
    return db_module

# 统一接口
def get_conn():
    return _get_db_module().get_conn()

def init_db():
    return _get_db_module().init_db()

def now_iso():
    return _get_db_module().now_iso()

def fetch_one(query, params=()):
    return _get_db_module().fetch_one(query, params)

def fetch_all(query, params=()):
    return _get_db_module().fetch_all(query, params)

def execute(query, params=()):
    return _get_db_module().execute(query, params)
```

### 4. PostgreSQL 实现

**文件**：`backend/app/db_postgresql.py`

- 使用 `psycopg2` 驱动
- 使用 `RealDictCursor` 返回字典格式结果
- 建表语句适配 PostgreSQL 语法（`SERIAL`、`JSONB`、`TIMESTAMP` 等）
- 占位符使用 `%s`（PostgreSQL 标准）
- 冲突处理使用 `ON CONFLICT DO NOTHING`

### 5. SQLite 实现（保留）

**文件**：`backend/app/db_sqlite.py`

从原 `db.py` 复制，保持 SQLite 功能不变，用于回滚。

### 6. 数据迁移脚本

**文件**：`scripts/export_sqlite.py`

```bash
python scripts/export_sqlite.py
```

功能：
- 读取 SQLite 数据库
- 导出所有表数据为 JSON 格式
- 生成 `backup_data.json` 文件

**文件**：`scripts/import_postgresql.py`

```bash
python scripts/import_postgresql.py
```

功能：
- 读取 `backup_data.json`
- 按外键依赖顺序导入数据
- 使用 `ON CONFLICT DO NOTHING` 避免重复
- 导入后验证数据完整性

---

## 遇到的问题及解决方案

### 问题 1：SSL 连接失败

**错误信息**：
```
server does not support SSL, but SSL was required
```

**解决方案**：
将 `.env` 中的 `DB_SSL_MODE` 从 `require` 改为 `prefer`：

```env
DB_SSL_MODE=prefer
```

### 问题 2：IP 白名单未配置

**错误信息**：
```
connection to server failed: Connection timed out
```

**解决方案**：
1. 获取本地公网 IP（访问 https://ipinfo.io/ip）
2. 在阿里云控制台 → PolarDB → 白名单与安全组
3. 添加公网 IP 到白名单

### 问题 3：中文引号导致语法错误

**错误信息**：
```
SyntaxError: invalid syntax
```

**原因**：`db_postgresql.py` 中的中文字符串包含中文引号 `""`，与 Python 字符串引号冲突。

**解决方案**：
将包含中文引号的字符串改用单引号包裹：

```python
# 修改前
("面试失败 7 次后的改进", "如何从"回答知识点"转成"讲清解决问题能力"。"),

# 修改后
("面试失败 7 次后的改进", '如何从"回答知识点"转成"讲清解决问题能力"。'),
```

---

## 验证结果

### 连接测试

```
PostgreSQL version: PostgreSQL 16.13 (PolarDB 16.13.16.4 build 005e8a0c)
Database: sparklearn
User: xd16696787393
```

### 数据库初始化

```
Created 22 tables:
  - agent_messages
  - agent_pets
  - agent_task_steps
  - agent_tasks
  - contribution_days
  - forum_attachments
  - forum_browsing_history
  - forum_comments
  - forum_post_favorites
  - forum_post_likes
  - forum_posts
  - knowledge_chunks
  - knowledge_files
  - mastery_records
  - profiles
  - students
  - teacher_broadcasts
  - teacher_material_files
  - tutor_conversations
  - tutor_files
  - tutor_messages
  - tutor_roles
```

### 数据迁移

```
Imported students: 1 rows
Imported profiles: 1 rows
Imported mastery_records: 8 rows
Imported tutor_roles: 2 rows
Imported tutor_conversations: 2 rows
Imported tutor_messages: 3 rows
Imported tutor_files: 1 rows
Imported agent_pets: 1 rows
Imported agent_tasks: 1 rows
Imported agent_messages: 1 rows
Imported agent_task_steps: 13 rows
Imported forum_posts: 45 rows
Imported forum_comments: 1 rows
Imported forum_post_likes: 1 rows
Imported forum_post_favorites: 1 rows
Imported forum_attachments: 1 rows
Imported forum_browsing_history: 1 rows

Total imported: 84 rows
```

### 应用加载

```
Database: postgresql
FastAPI app loaded successfully!
Routes: 132
Application is ready to start.
```

---

## 启动命令

```bash
# 启动后端服务
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 回滚方案

如需回滚到 SQLite，只需修改 `.env` 文件：

```env
DB_TYPE=sqlite
```

然后重启应用即可，无需修改任何代码。

---

## 文件清单

```
SparkLearn-main/
├── .env                              # 环境配置（含数据库连接信息）
├── backup_data.json                  # SQLite 导出的备份数据
├── backend/
│   ├── app/
│   │   ├── config.py                 # 配置文件（新增 PostgreSQL 配置）
│   │   ├── db.py                     # 数据库抽象层（自动选择 SQLite/PostgreSQL）
│   │   ├── db_sqlite.py              # SQLite 实现（从 db.py 复制）
│   │   ├── db_postgresql.py          # PostgreSQL 实现
│   │   └── main.py                   # FastAPI 应用入口
│   └── requirements.txt              # 依赖（新增 psycopg2-binary）
├── dbDeSign.md                       # 数据库迁移设计文档
└── scripts/
    ├── export_sqlite.py              # SQLite 数据导出脚本
    └── import_postgresql.py          # PostgreSQL 数据导入脚本
```
