# 02 Tutor 智能辅导与过程可观测体系
文档状态：已完成
版本口径：当前代码实现（2026-07-08）
写作口径：仅记录系统基础信息、功能实现、接口、数据流和存储设计。

## 1. Tutor 模块定位
- Tutor 是学生智能辅导入口，提供多轮问答、角色设定、文件上下文、网页资料上下文、会话历史和评价报告。
- Tutor 后端主要位于 `backend/app/routes/tutor_eval.py`，前端入口包括 `frontend/src/app/tutor/page.tsx` 及其子页面。
- Tutor 数据存储覆盖角色、会话、消息、文件、文件切片、元数据和评价结果。

## 2. Tutor 角色管理
- 角色列表用于展示当前用户已经创建或系统初始化的 Tutor 角色。
- 新建角色写入角色名称、persona、background、style_guide、rules 和启用状态。
- 编辑角色可以修改角色设定、背景、风格和规则。
- 删除角色会从用户角色列表中移除对应配置。
- 提示词优化接口根据当前角色配置生成更清晰的角色提示。
- 从问题生成角色接口根据学习问题自动形成适合该问题的 Tutor 角色。

## 3. 会话管理
- 会话包含用户、角色、标题、创建时间和更新时间。
- 创建会话用于开始新的学习主题或问题讨论。
- 更新会话用于修改标题或角色关联。
- 删除会话用于清理历史讨论。
- 会话列表按用户维度返回，便于前端侧边栏展示历史。

## 4. 消息管理
- 消息记录保存用户消息和助手消息。
- 消息与 conversation_id 关联，同一会话内按创建时间排序。
- 消息字段包含 sender_role、content、file_ids、meta_json 和 created_at。
- 删除消息用于移除指定历史消息。
- 聊天接口返回时会把新消息写入 `tutor_messages`。

## 5. 文件辅导能力
- 文件上传接口保存用户上传的学习资料，并写入 `tutor_files`。
- 文件解析后可以生成 chunk，写入 `tutor_file_chunks`。
- 文件列表用于前端展示用户资料库。
- 文件详情用于查看单个资料的分析状态、来源、大小和切片情况。
- 文件删除会移除对应资料记录和关联上下文。

## 6. 网页资料采集
- 网页采集接口接收 URL，把网页内容提取为可被 Tutor 使用的资料。
- 采集结果可以作为文件上下文进入后续问答。
- 网页资料保存时记录 source_type、source_url、analysis_json 和更新时间。

## 7. 对话上下文组成
- 角色上下文：来自 `tutor_roles` 的 persona、background、style_guide 和 rules。
- 页面上下文：前端可传入当前页面和学习场景信息。
- 历史消息：从 `tutor_messages` 中读取最近对话内容。
- 文件上下文：从 `tutor_files` 与 `tutor_file_chunks` 中读取相关内容。
- 知识库上下文：从 knowledge 模块检索相关片段。
- 用户画像上下文：从 profile 和 memory 模块读取学习目标、薄弱点和偏好。

## 8. 智能辅导流程
1. 用户在 Tutor 页面选择角色、会话和可选资料。
2. 前端向 `/api/tutor/chat` 发送问题、会话信息、角色信息、文件信息和页面上下文。
3. 后端读取角色、历史消息、文件片段、知识库片段和用户画像。
4. 后端组织完整提示词并调用模型或智能体能力。
5. 接口以流式或结构化方式返回回答。
6. 回答完成后写入会话消息记录，供后续上下文复用。

## 9. 评价与报告
- 评价报告接口读取会话、消息、角色和学习表现，形成评价数据。
- 刷新评价接口用于重新生成或更新评价结果。
- AI 总结接口根据报告数据生成文字总结。
- Tutor 历史接口用于聚合用户过往问答和学习轨迹。

## 10. Agent 辅助能力
- Agent 伙伴模块提供宠物领取、查看、修改和成长信息。
- Agent 任务支持搜索、总结、对比、推荐等任务形态。
- Agent 消息、步骤和反馈会写入 agent 相关数据表。
- Agent 推荐接口用于给出学习任务或资料建议。

## 11. 相关接口说明
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

### 模块：Agent 伙伴（agent）
- `POST` `/api/agent/pet`：处理函数 `adopt_pet`，文件 `backend/app/routes/agent.py:558`。
- `GET` `/api/agent/pet`：处理函数 `get_pet`，文件 `backend/app/routes/agent.py:580`。
- `PATCH` `/api/agent/pet`：处理函数 `update_pet`，文件 `backend/app/routes/agent.py:589`。
- `POST` `/api/agent/task`：处理函数 `create_task`，文件 `backend/app/routes/agent.py:615`。
- `GET` `/api/agent/task/{task_id}`：处理函数 `get_task`，文件 `backend/app/routes/agent.py:656`。
- `GET` `/api/agent/tasks`：处理函数 `list_tasks`，文件 `backend/app/routes/agent.py:673`。
- `POST` `/api/agent/task/{task_id}/feedback`：处理函数 `submit_feedback`，文件 `backend/app/routes/agent.py:687`。
- `POST` `/api/agent/bookmark`：处理函数 `bookmark_resource`，文件 `backend/app/routes/agent.py:697`。
- `GET` `/api/agent/recommendations`：处理函数 `get_recommendations`，文件 `backend/app/routes/agent.py:715`。

### 模块：记忆系统（memory）
- `GET` `/api/memory`：处理函数 `get_memory`，文件 `backend/app/routes/memory.py:65`。
- `GET` `/api/memory/profile/{user_id}`：处理函数 `get_profile`，文件 `backend/app/routes/memory.py:70`。
- `POST` `/api/memory/add`：处理函数 `add_memory`，文件 `backend/app/routes/memory.py:77`。
- `POST` `/api/memory/search`：处理函数 `search`，文件 `backend/app/routes/memory.py:96`。
- `POST` `/api/memory/inject-context`：处理函数 `inject_context`，文件 `backend/app/routes/memory.py:102`。
- `POST` `/api/memory/consolidate`：处理函数 `consolidate`，文件 `backend/app/routes/memory.py:108`。
- `POST` `/api/memory/forget`：处理函数 `forget`，文件 `backend/app/routes/memory.py:114`。
- `PUT` `/api/memory/profile`：处理函数 `patch_profile`，文件 `backend/app/routes/memory.py:125`。
