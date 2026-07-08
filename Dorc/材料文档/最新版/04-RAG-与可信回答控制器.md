# 04 RAG 与可信回答控制器
文档状态：已完成
版本口径：当前代码实现（2026-07-08）
写作口径：仅记录系统基础信息、功能实现、接口、数据流和存储设计。

## 1. RAG 模块定位
- RAG 用于把用户上传资料、知识库文件、网页资料和 Tutor 文件作为回答和生成内容的依据。
- 知识库主实现位于 `backend/app/routes/knowledge.py`，可信回答相关实现位于 `backend/app/trust_*.py`。
- RAG 结果可以进入 Tutor 对话、资源生成、学习资料分析和问答回答。

## 2. 知识库文件管理
- 文件列表接口返回当前用户的知识库文件。
- 文件上传接口保存文件基础信息、文件路径、大小、类型和状态。
- 文件详情接口返回单个文件的元数据、摘要和索引状态。
- 删除接口移除文件记录和关联内容。
- 统计接口返回文件数量、切片数量、引用数量等。

## 3. 文件解析与切片
- 上传文件后，后端提取文本内容。
- 文本按 chunk_index 切成多个知识片段。
- 每个 chunk 保存 file_id、chunk_index、content、embedding_json 和 created_at。
- 知识片段用于检索、上下文注入和后续问答。

## 4. 向量化与检索
- Embedding 客户端负责把查询文本和知识片段转换为向量。
- 检索过程可以基于向量相似度和文本匹配返回相关 chunk。
- 检索结果包含片段内容、来源文件、排序分数和引用信息。
- 检索结果长度需要控制，避免一次注入过多上下文。

## 5. Tutor 中的 RAG 使用
1. 用户在 Tutor 提问时选择文件或知识库资料。
2. 后端读取文件片段或根据问题检索知识库片段。
3. 片段被组织进 Tutor 的系统提示词和用户上下文。
4. 模型回答时基于资料内容生成解释、步骤或总结。
5. 对话结果写入消息记录，供后续继续使用。

## 6. 资源生成中的 RAG 使用
- 生成文档、阅读材料、练习题、代码案例等资源时，可以加载知识库上下文。
- 知识片段作为优先参考材料进入生成 prompt。
- 生成结果保存在资源中心，并可继续被预览、下载和评价。

## 7. 信息流资料进入知识库
- 信息流 source 接口提供可用来源。
- 搜索和推荐接口返回外部学习资料。
- 收藏接口保存用户关注资料。
- 导入资源接口把外部资料转换为资源或知识上下文。

## 8. 可信回答控制流程
1. 问题路由识别问题类型、风险等级、是否需要知识库、是否需要画像和是否需要用户文件。
2. 检索器根据问题和资料范围查找候选证据片段。
3. 引用模块整理证据来源和可引用内容。
4. 回答控制器组织回答约束，要求回答与证据一致。
5. 规则模块检查输出是否存在无依据断言、低置信度内容或不合规内容。
6. 最终返回回答文本、引用信息、风险标记和处理结果。

## 9. 风险审查机制
- 高风险问题需要更严格的证据约束。
- 无知识依据的问题需要提示依据不足或降低确定性表达。
- 涉及敏感内容、错误学习建议或不可靠事实时，需要经过规则审查。
- 可信回答流程优先保证回答可解释、可追溯和可控制。

## 10. 数据存储说明
### 表：tutor_files
- 字段数量：12
- `id`：INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id`：TEXT NOT NULL
- `filename`：TEXT NOT NULL
- `stored_path`：TEXT NOT NULL
- `mime_type`：TEXT DEFAULT 'application/octet-stream'
- `size_bytes`：INTEGER NOT NULL
- `source_type`：TEXT DEFAULT 'upload'
- `source_url`：TEXT DEFAULT ''
- `status`：TEXT DEFAULT 'ready'
- `analysis_json`：TEXT DEFAULT '{}'
- `updated_at`：TEXT DEFAULT ''
- `created_at`：TEXT NOT NULL
- 用途说明：`tutor_files` 由 `backend/app/db.py` 的 `init_db()` 初始化，用于对应业务模块的数据持久化。

### 表：tutor_file_chunks
- 字段数量：6
- `id`：INTEGER PRIMARY KEY AUTOINCREMENT
- `file_id`：INTEGER NOT NULL
- `chunk_index`：INTEGER NOT NULL
- `content`：TEXT NOT NULL
- `embedding_json`：TEXT DEFAULT ''
- `created_at`：TEXT NOT NULL
- 用途说明：`tutor_file_chunks` 由 `backend/app/db.py` 的 `init_db()` 初始化，用于对应业务模块的数据持久化。

### 表：knowledge_files
- 字段数量：15
- `id`：INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id`：TEXT NOT NULL
- `subject_id`：INTEGER DEFAULT 0
- `subject_name`：TEXT DEFAULT ''
- `filename`：TEXT NOT NULL
- `stored_path`：TEXT NOT NULL
- `mime_type`：TEXT DEFAULT 'application/octet-stream'
- `size_bytes`：INTEGER NOT NULL
- `status`：TEXT DEFAULT 'pending'
- `tags`：TEXT DEFAULT '[]'
- `summary`：TEXT DEFAULT ''
- `chunk_count`：INTEGER DEFAULT 0
- `reference_count`：INTEGER DEFAULT 0
- `created_at`：TEXT NOT NULL
- `updated_at`：TEXT NOT NULL
- 用途说明：`knowledge_files` 由 `backend/app/db.py` 的 `init_db()` 初始化，用于对应业务模块的数据持久化。

### 表：knowledge_chunks
- 字段数量：5
- `id`：INTEGER PRIMARY KEY AUTOINCREMENT
- `file_id`：INTEGER NOT NULL
- `chunk_index`：INTEGER NOT NULL
- `content`：TEXT NOT NULL
- `created_at`：TEXT NOT NULL
- 用途说明：`knowledge_chunks` 由 `backend/app/db.py` 的 `init_db()` 初始化，用于对应业务模块的数据持久化。

### 表：info_stream_cache
- 字段数量：13
- `id`：INTEGER PRIMARY KEY AUTOINCREMENT
- `source`：TEXT NOT NULL
- `external_id`：TEXT
- `title`：TEXT
- `summary`：TEXT
- `url`：TEXT
- `thumbnail`：TEXT
- `author`：TEXT
- `tags`：TEXT DEFAULT '[]'
- `extra_data`：TEXT DEFAULT '{}'
- `cached_at`：TEXT NOT NULL
- `expires_at`：TEXT NOT NULL
- `click_count`：INTEGER DEFAULT 0
- 用途说明：`info_stream_cache` 由 `backend/app/db.py` 的 `init_db()` 初始化，用于对应业务模块的数据持久化。

### 表：info_stream_bookmarks
- 字段数量：4
- `id`：INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id`：TEXT NOT NULL
- `cache_id`：INTEGER REFERENCES info_stream_cache(id)
- `created_at`：TEXT NOT NULL
- 用途说明：`info_stream_bookmarks` 由 `backend/app/db.py` 的 `init_db()` 初始化，用于对应业务模块的数据持久化。

## 11. 相关接口说明
### 模块：知识库（knowledge）
- `GET` `/api/knowledge/files`：处理函数 `list_knowledge_files`，文件 `backend/app/routes/knowledge.py:19`。
- `POST` `/api/knowledge/files`：处理函数 `upload_knowledge_file`，文件 `backend/app/routes/knowledge.py:45`。
- `PUT` `/api/knowledge/files/{file_id}/index`：处理函数 `index_knowledge_file`，文件 `backend/app/routes/knowledge.py:85`。
- `GET` `/api/knowledge/files/{file_id}`：处理函数 `get_knowledge_file`，文件 `backend/app/routes/knowledge.py:133`。
- `DELETE` `/api/knowledge/files/{file_id}`：处理函数 `delete_knowledge_file`，文件 `backend/app/routes/knowledge.py:141`。
- `GET` `/api/knowledge/stats`：处理函数 `knowledge_stats`，文件 `backend/app/routes/knowledge.py:154`。
- `GET` `/api/knowledge/chunks`：处理函数 `knowledge_chunks`，文件 `backend/app/routes/knowledge.py:178`。
- `GET` `/api/knowledge/retrieve`：处理函数 `retrieve_knowledge`，文件 `backend/app/routes/knowledge.py:195`。

### 模块：学习发现（info_stream）
- `GET` `/api/info-stream/sources`：处理函数 `get_sources`，文件 `backend/app/routes/info_stream.py:23`。
- `GET` `/api/info-stream/search`：处理函数 `search`，文件 `backend/app/routes/info_stream.py:35`。
- `GET` `/api/info-stream/recommendations`：处理函数 `get_recommendations`，文件 `backend/app/routes/info_stream.py:47`。
- `POST` `/api/info-stream/bookmark`：处理函数 `bookmark`，文件 `backend/app/routes/info_stream.py:164`。
- `POST` `/api/info-stream/import-resource`：处理函数 `import_resource`，文件 `backend/app/routes/info_stream.py:214`。
- `GET` `/api/info-stream/bookmarks`：处理函数 `get_bookmarks`，文件 `backend/app/routes/info_stream.py:238`。

### 模块：Tutor 辅导（tutor_eval）
- `GET` `/api/tutor/roles`：处理函数 `list_roles`，文件 `backend/app/routes/tutor_eval.py:884`。
- `POST` `/api/tutor/roles`：处理函数 `create_role`，文件 `backend/app/routes/tutor_eval.py:898`。
- `PUT` `/api/tutor/roles/{role_id}`：处理函数 `update_role`，文件 `backend/app/routes/tutor_eval.py:924`。
- `DELETE` `/api/tutor/roles/{role_id}`：处理函数 `delete_role`，文件 `backend/app/routes/tutor_eval.py:958`。
- `POST` `/api/tutor/roles/optimize-prompt`：处理函数 `optimize_prompt`，文件 `backend/app/routes/tutor_eval.py:1004`。
- `POST` `/api/tutor/roles/generate-from-question`：处理函数 `generate_role_from_question`，文件 `backend/app/routes/tutor_eval.py:1144`。
- `GET` `/api/tutor/conversations`：处理函数 `list_conversations`，文件 `backend/app/routes/tutor_eval.py:1171`。
- `POST` `/api/tutor/conversations`：处理函数 `create_conversation`，文件 `backend/app/routes/tutor_eval.py:1192`。
- `PUT` `/api/tutor/conversations/{conversation_id}`：处理函数 `update_conversation`，文件 `backend/app/routes/tutor_eval.py:1210`。
- `DELETE` `/api/tutor/conversations/{conversation_id}`：处理函数 `delete_conversation`，文件 `backend/app/routes/tutor_eval.py:1254`。
- `GET` `/api/tutor/messages`：处理函数 `tutor_messages`，文件 `backend/app/routes/tutor_eval.py:1261`。
- `DELETE` `/api/tutor/messages/{message_id}`：处理函数 `delete_tutor_message`，文件 `backend/app/routes/tutor_eval.py:1276`。
- `POST` `/api/tutor/files`：处理函数 `upload_tutor_file`，文件 `backend/app/routes/tutor_eval.py:1294`。
- `POST` `/api/tutor/files/web-capture`：处理函数 `import_web_capture`，文件 `backend/app/routes/tutor_eval.py:1342`。
- `GET` `/api/tutor/files`：处理函数 `list_tutor_files`，文件 `backend/app/routes/tutor_eval.py:1386`。
- `GET` `/api/tutor/files/{file_id}`：处理函数 `get_tutor_file`，文件 `backend/app/routes/tutor_eval.py:1396`。
- `DELETE` `/api/tutor/files/{file_id}`：处理函数 `delete_tutor_file`，文件 `backend/app/routes/tutor_eval.py:1404`。
- `POST` `/api/tutor/chat`：处理函数 `tutor_chat`，文件 `backend/app/routes/tutor_eval.py:1418`。
- `GET` `/api/tutor/history`：处理函数 `tutor_history`，文件 `backend/app/routes/tutor_eval.py:2048`。
- `GET` `/api/evaluation/report`：处理函数 `get_evaluation_report`，文件 `backend/app/routes/tutor_eval.py:2094`。
- `POST` `/api/evaluation/refresh`：处理函数 `refresh_evaluation`，文件 `backend/app/routes/tutor_eval.py:2101`。
- `POST` `/api/report/ai-summary`：处理函数 `generate_report_ai_summary`，文件 `backend/app/routes/tutor_eval.py:2118`。
