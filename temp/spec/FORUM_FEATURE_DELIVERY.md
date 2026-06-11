# SparkLearn 论坛功能交付文档（V1）

## 1. 目标与范围

### 1.1 业务目标
在 SparkLearn 中新增“论坛”模块，支持用户：
- 发布帖子（学习问题、经验分享、资料分享）
- 浏览帖子列表与详情
- 评论互动
- 点赞与收藏
- 上传并下载资料附件

### 1.2 本期范围（V1）
- 单用户模式适配（沿用 `settings.single_user_id`）
- Forum 首页：推荐/最新/热门（按发布时间、互动量排序）
- 发帖页：标题、正文、标签、附件（可选）
- 帖子详情页：内容、附件、评论区
- 基础互动：点赞、收藏、评论发布、删除本人评论
- 基础治理：敏感词拦截（可配置词表）

### 1.3 暂不纳入（V2+）
- 多用户鉴权体系（JWT/SSO）
- 关注关系、私信、@提醒
- 复杂审核流（机审 + 人审后台）
- 帖子编辑历史/版本管理

## 2. 与现有项目适配结论

### 2.1 后端适配点（已存在）
- 框架：FastAPI，路由集中在 `backend/app/routes/`
- DB：SQLite，初始化在 `backend/app/db.py:init_db()`
- 返回协议：统一 `ApiResponse`（`backend/app/schemas.py`）
- 当前模式：`single_user_id` 单用户模式（`backend/app/config.py`）

### 2.2 前端适配点（已存在）
- 框架：Next.js App Router（`frontend/src/app/(shell)/`）
- API 封装：`frontend/src/lib/api/real.ts`
- 类型定义：`frontend/src/lib/api/types.ts`
- 导航配置：`frontend/src/components/layout/navigation.tsx`

结论：论坛模块可按现有规范平滑接入，无需重构基础架构。

## 3. 信息架构与页面设计

### 3.1 页面路由
- `/forum`：论坛首页（列表 + 筛选 + 搜索）
- `/forum/new`：发布帖子
- `/forum/[postId]`：帖子详情
- `/forum/my`：我的帖子/收藏

### 3.2 页面核心组件
- ForumList：帖子卡片列表
- ForumComposer：发帖编辑器（标题/正文/标签/附件）
- ForumDetail：帖子正文 + 附件 + 互动区
- CommentList + CommentInput：评论流

## 4. 数据模型设计（SQLite）

在 `backend/app/db.py:init_db()` 中新增以下表：

### 4.1 `forum_posts`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `user_id TEXT NOT NULL`
- `title TEXT NOT NULL`
- `content TEXT NOT NULL`
- `tags TEXT DEFAULT '[]'`（JSON 数组）
- `status TEXT NOT NULL DEFAULT 'published'`（published/hidden/deleted）
- `like_count INTEGER NOT NULL DEFAULT 0`
- `comment_count INTEGER NOT NULL DEFAULT 0`
- `favorite_count INTEGER NOT NULL DEFAULT 0`
- `view_count INTEGER NOT NULL DEFAULT 0`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

索引：
- `idx_forum_posts_created_at(created_at DESC)`
- `idx_forum_posts_user_id(user_id, created_at DESC)`

### 4.2 `forum_comments`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `post_id INTEGER NOT NULL`
- `user_id TEXT NOT NULL`
- `content TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'published'`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

索引：
- `idx_forum_comments_post(post_id, created_at ASC)`

### 4.3 `forum_post_likes`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `post_id INTEGER NOT NULL`
- `user_id TEXT NOT NULL`
- `created_at TEXT NOT NULL`

唯一索引：
- `idx_forum_like_unique(post_id, user_id)`

### 4.4 `forum_post_favorites`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `post_id INTEGER NOT NULL`
- `user_id TEXT NOT NULL`
- `created_at TEXT NOT NULL`

唯一索引：
- `idx_forum_fav_unique(post_id, user_id)`

### 4.5 `forum_attachments`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `post_id INTEGER NOT NULL`
- `user_id TEXT NOT NULL`
- `filename TEXT NOT NULL`
- `stored_path TEXT NOT NULL`
- `mime_type TEXT DEFAULT 'application/octet-stream'`
- `size_bytes INTEGER NOT NULL`
- `created_at TEXT NOT NULL`

索引：
- `idx_forum_attach_post(post_id)`

## 5. 后端接口设计（FastAPI）

新增文件：`backend/app/routes/forum.py`，并在 `backend/app/main.py` 中 `include_router`。

### 5.1 帖子接口
- `GET /api/forum/posts`
  - 参数：`tab=latest|hot|recommended`，`q`，`tag`，`page`，`page_size`
- `POST /api/forum/posts`
  - body：`title`、`content`、`tags`
- `GET /api/forum/posts/{post_id}`
- `DELETE /api/forum/posts/{post_id}`（软删除）

### 5.2 评论接口
- `GET /api/forum/posts/{post_id}/comments`
- `POST /api/forum/posts/{post_id}/comments`
- `DELETE /api/forum/comments/{comment_id}`

### 5.3 互动接口
- `POST /api/forum/posts/{post_id}/like`（toggle）
- `POST /api/forum/posts/{post_id}/favorite`（toggle）

### 5.4 附件接口
- `POST /api/forum/posts/{post_id}/attachments`（multipart）
- `GET /api/forum/posts/{post_id}/attachments`
- `GET /api/forum/attachments/{attachment_id}/download`

### 5.5 我的内容
- `GET /api/forum/my/posts`
- `GET /api/forum/my/favorites`

## 6. 前端改造清单（Next.js）

### 6.1 页面与组件
- 新增：
  - `frontend/src/app/(shell)/forum/page.tsx`
  - `frontend/src/app/(shell)/forum/new/page.tsx`
  - `frontend/src/app/(shell)/forum/[postId]/page.tsx`
  - `frontend/src/app/(shell)/forum/my/page.tsx`
- 新增组件目录：`frontend/src/components/forum/`

### 6.2 API 层
- `frontend/src/lib/api/types.ts` 新增：
  - `ForumPost`、`ForumComment`、`ForumAttachment`
- `frontend/src/lib/api/real.ts` 新增：
  - `getForumPosts`
  - `createForumPost`
  - `getForumPostDetail`
  - `toggleForumLike`
  - `toggleForumFavorite`
  - `getForumComments`
  - `createForumComment`
  - `uploadForumAttachments`

### 6.3 导航接入
- 在 `frontend/src/components/layout/navigation.tsx` 添加：
  - 页面元信息：`/forum`、`/forum/my`
  - 视产品策略决定是否加入移动端主 Tab（建议先不占主 Tab）

## 7. 资料共享能力设计

### 7.1 支持格式（V1）
- `pdf/docx/pptx/xlsx/zip/png/jpg`

### 7.2 文件限制（建议）
- 单文件 ≤ 20MB
- 单帖最多 5 个附件
- 后端存储路径：`backend/data/users/{single_user_id}/forum/attachments/`

### 7.3 安全策略
- 校验扩展名与 MIME
- 文件名标准化，避免路径穿透
- 下载接口只通过后端受控路径输出

## 8. 内容治理与风控（V1）

- 敏感词过滤：命中则拒绝发布并返回可读错误
- 重复灌水限制：同用户 30 秒内最多发 1 帖
- 超长内容限制：标题 <= 120 字，正文 <= 10000 字
- 审计字段：记录 `created_at/updated_at/user_id`

## 9. 非功能要求

- 列表接口 p95 < 300ms（本地 SQLite 场景）
- 页面首屏可交互 < 2.5s（本地开发基准）
- 错误可恢复：网络失败可重试，前端提示明确
- 接口统一走 `ApiResponse` 协议

## 10. 测试与验收

### 10.1 后端测试（`backend/tests/`）
- `test_forum_posts.py`
- `test_forum_comments.py`
- `test_forum_interactions.py`
- `test_forum_attachments.py`

### 10.2 前端测试（`frontend/test/`）
- 新增论坛页面冒烟：列表展示、发帖、评论、点赞
- 新增附件上传/下载链路回归

### 10.3 验收标准（UAT）
- 用户可在 `/forum/new` 成功发帖并在 `/forum` 可见
- 帖子详情可展示评论并新增评论
- 点赞/收藏状态可切换且计数正确
- 附件可上传并下载
- 删除帖子后列表不再展示（软删除）

## 11. 实施计划（建议 3 个迭代）

### 迭代 1（后端核心）
- 建表 + forum 路由 + 帖子/评论/互动接口
- 单元测试通过

### 迭代 2（前端主流程）
- 论坛首页、发帖页、详情页打通
- API 层与类型接入

### 迭代 3（资料共享 + 治理）
- 附件上传下载
- 敏感词、频控、边界体验
- E2E 冒烟

## 12. 风险与后续

### 12.1 当前风险
- 单用户模式下互动数据仅模拟真实社区场景
- SQLite 并发能力有限，多用户上线前需评估迁移（PostgreSQL）

### 12.2 后续演进（V2）
- 引入用户系统与权限模型
- 审核后台与举报系统
- 推荐流（结合学习路径与知识薄弱点）

---

## 附：最小可行接口返回结构示例

```json
{
  "success": true,
  "data": {
    "id": 101,
    "title": "Python 函数闭包怎么理解？",
    "content": "...",
    "tags": ["Python", "函数"],
    "like_count": 3,
    "comment_count": 2,
    "favorite_count": 1,
    "created_at": "2026-05-24T10:00:00Z"
  },
  "error": null
}
```
