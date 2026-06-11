# SparkLearn 测试文档

> 适用版本：v3.0+ | 最后更新：2026-05-29

## 1. 测试策略 ✅

SparkLearn 采用分层测试策略，从单元到集成再到端到端，逐层构建对系统质量的信心。本章阐述整体测试策略和各级测试的关注重点。

**单元测试**：以 API 路由为测试单元，使用 pytest + pytest-asyncio + httpx AsyncClient 组合。每个测试用例独立创建一个 ASGI Transport 客户端，绕过网络层直接测试 FastAPI 路由逻辑。测试数据库与生产数据库使用同一 SQLite 引擎，但通过 fixture 中的配置策略实现隔离（清空敏感 API key、初始化干净数据库）。单元测试覆盖的核心能力包括：画像建档与查询、辅导流式对话与历史记录、练习评测提交与判题、资源生成流式输出、Agent 宠物任务执行等。

**集成测试**：前后端联调测试，验证前端页面与后端 API 的数据交互是否匹配。包括 API 响应数据格式与前端 TypeScript 类型定义的对应关系、SSE（Server-Sent Events）流式数据的前端解析、文件上传流程的完整性以及 WebSocket 连接的稳定性。当前集成测试以手动联调为主，后续将引入 Playwright E2E 框架进行自动化集成测试。

**E2E 测试**：模拟真实用户学习旅程的端到端测试。典型旅程包括：进入平台 → 填写学习画像 → 查看推荐学习路径 → 选择知识点 → AI 生成学习资源 → 进入辅导对话 → 完成练习评测 → 查看学习报告。E2E 测试使用 Playwright（前端已有 `@playwright/test` 依赖）驱动真实 Chrome 浏览器执行。当前 E2E 测试为预留框架，具体用例待业务稳定后编写。

**测试覆盖率目标**：单元测试覆盖所有 API 路由的核心成功路径和关键错误路径。集成测试覆盖前后端数据交互的边界条件。E2E 测试覆盖主要用户旅程。测试代码不追求 100% 覆盖率，而是聚焦于高频使用路径和曾出现过 bug 的回归热点。

## 2. 测试环境搭建 ✅

本章描述如何从零搭建 SparkLearn 的测试环境，包括依赖安装、配置文件和 fixture 设计。

**依赖安装**：测试框架的核心依赖已包含在 `requirements.txt` 中：`pytest==8.3.3`（测试框架）、`pytest-asyncio==0.24.0`（异步测试支持）、`httpx==0.27.0`（HTTP 客户端，用于 AsyncClient）。确保在 `backend/` 目录下已执行 `pip install -r requirements.txt`。如果单独安装测试依赖：`pip install pytest pytest-asyncio httpx`。

**配置文件**：测试代码位于 `backend/tests/` 目录，包含 `conftest.py`（全局 fixture 配置）和 `test_api.py`（API 测试用例）。测试不需要单独的配置文件，`conftest.py` 会自动导入 `app.main:app` 和 `app.config:settings`，并通过 fixture 机制在测试前清空敏感配置（将 `spark_app_id`、`spark_api_key`、`spark_api_secret` 设为空字符串），确保测试不会意外调用真实外部 API。

**测试 fixture 设计**：`conftest.py` 中定义了两个核心 fixture。`anyio_backend`（session 级别）：指定异步后端为 `asyncio`，确保 pytest-asyncio 使用正确的异步事件循环。`client`（function 级别，每个测试函数独立）：(1) 清空星火 API 配置，保持测试离线/确定性；(2) 调用 `init_db()` 初始化测试数据库（使用 SQLite 内存表或临时文件）；(3) 创建 `httpx.ASGITransport` 直接对接 FastAPI app，跳过网络层；(4) 返回 `AsyncClient` 实例，测试用例通过 `await client.get/post/delete` 等方法调用 API。每个测试函数获得独立的 client 实例，测试之间不共享数据库状态。

**测试数据库隔离**：当前测试使用与开发环境相同的 SQLite 数据库路径。通过 fixture 中每次调用 `init_db()`（使用 `CREATE TABLE IF NOT EXISTS` 语义）确保测试间数据结构一致。未来可增强为：使用 `:memory:` 内存数据库加速测试执行，或在每次测试后回滚/清理测试数据以确保测试完全隔离。

## 3. 现有测试用例说明 ✅

本章从 `backend/tests/test_api.py` 中提取所有现有测试用例，逐一说明其覆盖场景、输入数据和预期输出。共 6 个测试用例，覆盖五大核心功能模块。

### 3.1 test_profile_onboarding_and_get ✅

**测试目标**：验证学习画像的建档和查询功能。用户通过问卷表单提交学习偏好后，系统应正确存储画像数据并能通过 GET 接口查询到完整画像信息。

**输入数据**：向 `/api/profile/onboarding` 发送 POST 请求，JSON 负载为 `{"goal": ["期末提分"], "level": ["有一些基础"], "weak": ["函数"], "preference": ["实践型"], "time": ["30-60分钟"]}`。这模拟了用户首次进入平台时的画像建档流程，包含五个维度：学习目标、当前水平、薄弱知识点、学习偏好和每日学习时长。

**预期输出**：(1) POST 请求返回 HTTP 200，`response.json()["success"]` 为 `True`；(2) 随后向 `/api/profile` 发送 GET 请求，返回 HTTP 200，`response.json()["success"]` 为 `True`，且 `response.json()["data"]` 中包含 `"goal"` 字段。验证了数据写入和读取的一致性。

**覆盖场景**：画像首次建档的完整闭环——从表单提交到数据持久化再到查询验证。这是用户进入平台后的第一步操作，其正确性直接影响后续的个性化推荐和学习路径规划。

### 3.2 test_tutor_stream_and_history ✅

**测试目标**：验证智能辅导的流式对话（SSE）和历史记录查询功能。这是系统中交互最频繁的核心功能之一。

**输入数据**：向 `/api/tutor/chat` 发送 POST 请求，JSON 负载为 `{"message": "什么是闭包", "mode": "knowledge_qa"}`。使用 `knowledge_qa` 模式表示基于知识库的问答模式。

**预期输出**：(1) POST 请求返回 HTTP 200，响应体文本中包含 `"type": "text"` 和 `"type": "done"`。这表明 SSE 流式响应正确返回了文本内容和完成信号；(2) 随后向 `/api/tutor/history` 发送 GET 请求，返回 HTTP 200，`response.json()["success"]` 为 `True`，且消息数组 `response.json()["data"]` 的长度 >= 2（至少包含一条用户消息和一条助手回复）。验证了对话记录的完整持久化和查询能力。

**覆盖场景**：辅导对话的 SSE 流式输出正确性和对话消息的完整历史记录。这是教学中师-生/生-AI 交互的核心路径。

### 3.3 test_quiz_submit ✅

**测试目标**：验证练习评测功能的完整流程——获取题目、提交答案、获取判题结果。

**输入数据**：(1) 向 `/api/quiz` 发送 GET 请求获取题目列表；(2) 取第一道题的 `id`，向 `/api/quiz/submit` 发送 POST 请求，JSON 负载为 `{"quiz_id": <first["id"]>, "answer": "list"}`。

**预期输出**：(1) GET 请求返回 HTTP 200，题目列表不为空；(2) POST 提交请求返回 HTTP 200，`response.json()["success"]` 为 `True`，且返回数据中 `response.json()["data"]` 包含 `"correct"` 字段。该字段表示 AI 判题结果（是否正确）。验证了"出题 → 答题 → 判题"的标准学习闭环。

**覆盖场景**：练习评测的标准路径——获取题目、提交答案、接收判题反馈。这是学习效果验证和知识点掌握度评估的基础。

### 3.4 test_generate_stream ✅

**测试目标**：验证 AI 资源生成的流式输出功能。用户指定资源类型和主题后，系统应通过 SSE 返回生成进度和最终结果。

**输入数据**：向 `/api/resources/generate` 发送 POST 请求，JSON 负载为 `{"type": "document", "prompt": "Python 变量"}`。生成类型为 `document`（文档），主题为"Python 变量"。

**预期输出**：返回 HTTP 200，响应体文本中同时包含 `"type": "progress"`（进度更新事件）和 `"type": "done"`（完成事件）。这表明 SSE 流正确推送了生成进度信息并最终完成了资源生成。

**覆盖场景**：资源生成功能的 SSE 流式输出机制。这是 AI 辅助学习材料生成的核心功能，支持 6 种资源类型（document/ppt/mindmap/quiz/reading/code）的流式生成。

### 3.5 test_tutor_workspace_closed_loop ✅

**测试目标**：验证智能辅导工坊（Workspace）的完整闭环——角色创建 → 对话会话创建 → 文件上传 → 流式对话 → 历史验证 → 消息删除 → 计数更新。这是所有测试中最复杂的一个，模拟了真实用户在使用辅导功能时的完整操作序列。

**输入数据与操作序列**：
1. GET `/api/tutor/roles` — 获取已有导师角色列表。
2. POST `/api/tutor/roles` — 创建新角色，JSON `{"name": "测试角色", "persona": "你是测试导师"}`。
3. POST `/api/tutor/conversations` — 创建新对话会话，JSON `{"title": "闭环测试会话", "role_id": <role_id>}`。
4. POST `/api/tutor/files` — 上传测试文件，`multipart/form-data` 包含 `("files", ("sample.txt", b"hello workspace", "text/plain"))`。
5. POST `/api/tutor/chat` — 发起流式对话，JSON `{"message": "请解释闭包", "conversation_id": <conv_id>, "role_id": <role_id>, "file_ids": [<file_id>], "mode": "knowledge_qa"}`。
6. GET `/api/tutor/history?conversation_id=<conv_id>&limit=50` — 查询对话历史。
7. GET `/api/tutor/conversations` — 验证删除前的消息计数。
8. DELETE `/api/tutor/messages/<user_msg_id>` — 删除一条用户消息。
9. GET `/api/tutor/conversations` — 验证删除后的消息计数减少。

**预期输出**：(1) 角色创建返回 `success: True`，`data` 中包含 `id`；(2) 对话创建返回 `success: True`，`data` 中包含 `id`；(3) 文件上传返回 `success: True`，`data` 数组包含文件信息（含 `id`）；(4) 流式对话返回 SSE 文本，包含 `"type": "text"` 和 `"type": "done"`；(5) 对话历史中至少 2 条消息，用户消息的 `file_names` 字段包含 `"sample.txt"`；(6) 删除消息前消息计数 `>= 2`；(7) 消息删除返回 `success: True`；(8) 删除消息后会话消息计数减 1。所有断言构成一个严密的闭环验证链。

**覆盖场景**：辅导工坊的完整交互链，包括角色管理、对话管理、文件上传关联、流式对话、历史查询和消息删除。这是系统中交互最复杂的模块，覆盖了多个 API 的串联使用场景。

### 3.6 test_agent_task_can_use_nanobot_backend ✅

**测试目标**：验证 Agent 学习宠物的任务执行链路——从领养宠物到创建任务到轮询获取结果。通过 `monkeypatch` 替换 Nanobot 客户端为假的实现函数，确保测试不依赖真实 Nanobot 服务。

**输入数据与操作序列**：
1. 使用 `monkeypatch.setattr` 将 `nanobot_pet_client.run_task` 替换为 `fake_run_task`（接收 task_type/input_text/user_id/personality 参数，返回预设的搜索结果）。
2. POST `/api/agent/pet` — 领养宠物，JSON `{"name": "小星", "avatar": "fox", "personality": "encouraging"}`。
3. POST `/api/agent/task` — 创建任务，JSON `{"task_type": "search", "input_text": "Python 闭包"}`。
4. 轮询 GET `/api/agent/task/<task_id>` — 最多轮询 10 次，每次检查状态是否为 `completed`。

**预期输出**：(1) 宠物领养成功（如果已有宠物则返回已有数据，也视为成功）；(2) 任务创建返回 `success: True`，`data` 中包含 `task_id`；(3) 任务最终状态为 `completed`；(4) 任务结果 `data["result"]["items"][0]["title"]` 为 `"闭包入门"`（来自 fake 函数预设的返回值）；(5) 任务步骤 `data["steps"]` 中包含 `description` 为 `"已切换到学习宠物新内核"` 的步骤（验证了 Nanobot 内核切换的步骤记录）。测试结束后通过 `finally` 块恢复 `nanobot_pet_enabled` 原始值。

**覆盖场景**：Agent 宠物"领养 → 分配任务 → 执行（模拟 Nanobot）→ 获取结果"的完整链路。验证了 Agent 任务的状态机转换（pending → running → completed）、XP 奖励机制和步骤日志记录功能。

## 4. 测试执行命令 ✅

本章提供常用的测试执行命令，覆盖不同粒度的测试场景。

**运行全部测试**：`pytest backend/tests/test_api.py -v`。`-v` 参数启用详细输出，显示每个测试的名称和执行状态（PASSED/FAILED/SKIPPED）。这是最常用的命令，建议在每次修改后端代码后执行以确保未引入回归问题。

**运行特定测试**：`pytest backend/tests/test_api.py -v -k "tutor"`。`-k` 参数支持模糊匹配，`"tutor"` 会匹配所有名称中包含 "tutor" 的测试（即 `test_tutor_stream_and_history` 和 `test_tutor_workspace_closed_loop` 两个用例）。类似地，`-k "profile"` 匹配画像测试，`-k "quiz"` 匹配练习测试，`-k "agent"` 匹配 Agent 宠物测试。这在调试特定模块时非常高效，避免等待全部测试执行。

**运行测试并生成覆盖率报告**：`pytest --cov=backend/app backend/tests/`。`--cov=backend/app` 指定测量 `backend/app/` 目录的代码覆盖率。加 `--cov-report=html` 可生成 HTML 格式的可视化报告（输出到 `htmlcov/` 目录），在浏览器中查看每条语句的覆盖情况。加 `--cov-report=term-missing` 在终端输出未覆盖的具体行号。

**使用详细输出调试**：`pytest backend/tests/test_api.py -vvs`。`-s` 参数允许测试中的 `print()` 输出显示在终端（默认被 pytest 捕获），`-vv` 在失败时显示完整的 diff 对比。组合使用可帮助定位失败原因。

**注意事项**：测试执行前确保满足以下条件：(1) 在 `backend/` 目录或项目根目录执行命令；(2) Python 虚拟环境已激活且已安装所有依赖；(3) Playwright 浏览器已安装（`python -m playwright install chromium`），虽然当前测试被配置为离线模式，但导入路径中可能触发相关模块加载；(4) `backend/app/config.py` 中引用的路径（`ROOT_DIR`）在测试环境下正确解析（`ROOT_DIR` 通过 `Path(__file__).resolve().parents[2]` 从 config.py 向上两级计算得到项目根目录）。

## 5. 测试数据管理 ✅

本章描述测试数据的设计原则、fixture 管理策略和数据清理机制。

**Fixtures 设计原则**：`conftest.py` 中的 `client` fixture 采用 function 级别作用域，每个测试函数获得独立的 client 实例。fixture 执行流程：(1) 清空 `settings.spark_app_id/api_key/api_secret` 确保测试绝对不会调用真实讯飞 API（避免产生费用和网络依赖）；(2) 调用 `init_db()` 重建数据库结构（使用 `CREATE TABLE IF NOT EXISTS` 语义，保留已有数据但确保表结构完整）；(3) 创建 `AsyncClient` 并 yield 给测试函数；(4) 测试结束后无需显式清理，因为测试之间共享数据库文件，依赖测试用例自身管理数据状态。

**测试数据特征**：当前测试数据主要是通过 API 调用实时创建（如创建角色、对话、文件上传等），而非使用预置的 fixture 数据。这种方式的优点是测试数据和测试逻辑紧密耦合，修改接口时测试数据自动适配；缺点是缺乏边界条件和异常数据的覆盖。未来可引入预置 fixture 数据集（如 fixture 创建默认画像、预置题库等）来减少重复代码和提升测试覆盖广度。

**数据清理策略**：当前采用"测试间自然累积 + 定期重置"策略。由于所有测试共享同一个 SQLite 数据库文件，每次 `init_db()` 使用 `IF NOT EXISTS` 不会清空已有数据，因此：(1) 同一个测试函数多次运行可能会累积历史数据；(2) 测试函数应妥善处理数据存在的场景（如 Agent 宠物测试中处理已有宠物的情况）；(3) 开发者在需要干净状态时可手动删除 `backend/data/db/sparklearn.db` 文件再运行测试。未来可增强为在每次测试或每个 session 前自动清空/重建数据库。

**monkeypatch 管理**：对于需要替换外部依赖的测试（如 `test_agent_task_can_use_nanobot_backend`），使用 pytest 的 `monkeypatch` fixture 动态替换模块属性。关键实践：(1) 使用 `try/finally` 块确保在测试结束后恢复原始状态，避免影响后续测试；(2) 对被替换的函数做参数断言（验证 fake 函数接收到的参数是否符合预期），不仅验证调用成功还验证调用正确。

## 6. 已知测试缺口 🔲

本章列出当前测试覆盖的盲区和未来需要补充的测试场景，按优先级排列。

**知识库嵌入测试** 🔲：当前没有验证知识库文件上传（`/api/knowledge/files`）、Embedding 向量化处理（`/api/knowledge/files/{id}/index`）、文档分段（chunk 管理）和关键词检索的测试用例。这是 RAG 系统的核心能力，缺少测试意味着知识库功能的回归风险较高。需要补充的测试包括：上传 PDF/DOCX/TXT 文件并验证处理状态从 `pending` → `processing` → `indexed` 的完整流程；验证文本分段数和向量化正确性；验证基于知识库的问答能否检索到正确的文档片段。

**MCP 连接测试** 🔲：MCP（Model Context Protocol）插件系统是平台能力扩展的重要机制，当前缺少自动化测试。需要补充的测试包括：注册 MCP 服务（stdio/http 两种传输模式）、测试连接状态检查（`/api/mcp/services/{id}/test`）、获取工具列表（`/api/mcp/services/{id}/tools`）、调用工具（`/api/mcp/services/{id}/tools/{tool_id}/call`）、启用/禁用服务切换。MCP 测试的难点在于需要模拟真实的 MCP 服务端（如文件系统服务、网络服务），可考虑使用轻量级 mock MCP server。

**视频 E2E 测试** 🔲：视频生成模块涉及多个子模块协作（AI 脚本优化 → TTS 语音合成 → 视频渲染），当前缺少端到端验证。需要补充的测试包括：提交视频生成请求并轮询状态（`/api/video/generate` → SSE 进度流 → `/api/video/{id}` 状态查询）；验证不同 provider（`html_ppt`/AI 模式）的输出格式；验证 TTS 语音合成产物的可播放性。视频生成的执行时间较长（分钟级），测试需要设置合理的超时或使用 mock。

**教师端测试** 🔲：教师端功能（大屏看板、广播消息、教学资料管理、学生管理）当前没有专门的 API 测试。需要补充的测试包括：教师大屏数据聚合接口的数据完整性和降级逻辑（后端不可用时返回演示数据）；广播消息的创建、目标群体筛选和消息送达验证；教学资料上传和关联学生的流程。教师端是一个相对独立的子系统，可单独建立测试文件。

**错误路径与边界测试** 🔲：当前测试主要覆盖"快乐路径"（正常输入和预期成功结果），缺少对异常输入和错误状态的处理验证。需要补充的测试包括：无效/缺失必填参数时返回 422/400 错误；未领养宠物就创建 Agent 任务应返回"请先认养学习伙伴"错误；等级不足时创建未解锁类型任务应返回等级不足提示；在资源生成中传入不支持的类型应返回明确的错误提示；超大文件上传应触发大小限制；并发的 Agent 任务应返回"当前有任务正在执行"错误。

**TTS 音色选择回归测试** 🔲：当前用户可以在视频生成时切换 TTS 发音人（如从 `xiaoyan` 切换到 `xiaofeng`），但缺少验证音色配置是否正确传递到 TTS API 的测试。需要补充的测试包括：验证不同的 `voice` 参数值被正确传递到讯飞 TTS 接口；验证无效音色名应被拒绝或回退到默认音色；验证 TTS 文本超长时的自动分段逻辑。

**PolarDB PostgreSQL 迁移测试** 🔲：当系统从 SQLite 迁移到 PolarDB PostgreSQL 时，需要验证数据迁移的完整性和业务逻辑的一致性。需要补充的测试包括：SQLite → PostgreSQL 数据导出导入的字段映射正确性；自增主键策略（SQLite `AUTOINCREMENT` → PostgreSQL `SERIAL`/`IDENTITY`）的兼容性；JSON 字段读写的一致性（SQLite 存 TEXT 但 Schema 中标记为 JSON）；datetime 格式和时区处理的差异；以及所有现有 API 测试在 PostgreSQL 后端上是否仍能通过。

**手机端适配测试** 🔲：移动端适配为规划中功能。当移动端 UI 就绪后，需要补充的测试包括：响应式布局在不同屏幕尺寸（320px/375px/768px）下的渲染正确性；触摸交互和手势操作的可用性；移动端性能指标（首屏加载时间、资源功耗消耗）；移动浏览器兼容性（Safari iOS、Chrome Android、微信内置浏览器等）。
