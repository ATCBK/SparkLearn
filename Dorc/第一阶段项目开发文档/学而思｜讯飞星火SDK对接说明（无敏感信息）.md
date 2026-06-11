# SparkLearn 讯飞星火 SDK 对接说明（无敏感信息）

> 适用版本：Spark1.5 Windows SDK（本项目当前接入基线）  
> 对齐文档：  
> - `Dorc/后端设计文档.md`  
> - `Dorc/后端技术文档（赛题对齐版）.md`

---

## 1. 文档目的

本文档用于说明 SparkLearn 在后端中如何接入讯飞星火 SDK，明确：

1. 接入范围与功能边界  
2. SDK 能力与项目 API 的映射关系  
3. 流式协议（SSE envelope）与事件规范  
4. 多轮对话、历史记录、画像落库的实现约束  
5. 测试与验收标准

本文档不包含任何密钥、凭证或占位敏感配置。

---

## 2. 接入目标

本期接入目标：

1. 基于 SDK 的 LLM 能力接入 Web 后端  
2. 支持流式输出（异步）  
3. 支持多轮上下文  
4. 支持历史记录查询  
5. 支持画像采集并双写入 SQLite + JSON/JSONL  
6. 与现有前端页面完成联调

---

## 3. SDK 侧关键能力（已确认）

基于 SDK 头文件与 demo，可确认的关键点：

1. 全局初始化：`SparkChain::init(...)`  
2. 模型配置：`LLMConfig::domain("general")`  
3. 异步流式：`LLM::arun(...) + registerLLMCallbacks(...)`  
4. 多轮记忆：`Memory::WindowMemory(n)` / `Memory::TokenMemory(n)`  
5. 结束标识：`LLMResult.getStatus() == 2`  
6. 错误回调：`onLLMError(...)`

---

## 4. 总体接入架构

为兼容现有 Python FastAPI 后端，采用分层桥接：

1. `Spark SDK Bridge（Windows C++）`  
   - 直接调用 Spark SDK  
   - 负责回调收集、流式分片、错误码映射
2. `FastAPI Orchestrator（Python）`  
   - 负责业务编排、字段映射、存储落库、统一 API 输出
3. `Frontend API Adapter（Next.js）`  
   - 统一接收 SSE envelope  
   - 页面渲染与状态管理

原则：

1. SDK 逻辑不直接暴露给前端  
2. 所有前端请求走后端业务 API  
3. 流式输出统一 envelope，禁止接口各自定义

---

## 5. 功能映射（SDK -> 业务 API）

### 5.1 智能辅导（Tutor）

- API：`POST /api/tutor/chat`（SSE）  
- API：`GET /api/tutor/history`

用途：

1. 实时答疑（流式）  
2. 多轮对话延续  
3. 历史查询

后端要求：

1. 每轮消息必须落历史存储  
2. 返回统一 SSE envelope  
3. 失败返回可展示错误事件

### 5.2 对话式画像建档（Profile Chat）

- API：`POST /api/profile/initiate`  
- API：`POST /api/profile/chat`（SSE）  
- API：`GET /api/profile`  
- API：`PUT /api/profile`

用途：

1. 对话采集学习者画像字段  
2. 结束时结构化画像写入存储

强约束（必须满足）：

1. 画像写入 SQLite（`profiles`）  
2. 同步写入 JSON/JSONL（快照/事件）  
3. 保留 version 变更记录

### 5.3 资源生成（Generate）

- API：`POST /api/resources/generate`（SSE）  
- API：`GET /api/resources`  
- API：`GET /api/resources/{resource_id}`

用途：

1. 生成学习资源文本内容  
2. 按进度事件推动前端实时渲染

### 5.4 学习评估摘要（Evaluation）

- API：`POST /api/evaluation/refresh`  
- API：`GET /api/evaluation/report`

用途：

1. 基于学习行为与掌握度生成评估摘要  
2. 结果用于报告页展示

---

## 6. 流式协议规范（统一 SSE envelope）

所有流式接口统一事件格式：

```text
data: {"type":"<event_type>","payload":{...}}

```

推荐事件类型：

1. `text`：增量文本片段  
2. `progress`：阶段进度  
3. `meta`：结构化补充信息（如来源、阶段）  
4. `done`：流结束  
5. `error`：异常终止

SDK 回调到业务事件映射建议：

1. `onLLMResult` -> `text` / `done`  
2. `onLLMEvent` -> `progress` 或 `meta`  
3. `onLLMError` -> `error`

---

## 7. 多轮与历史策略

### 7.1 多轮上下文

使用 SDK memory 能力实现短期上下文，并由后端维持会话级上下文标识。

建议：

1. Tutor 使用窗口记忆（固定轮数）  
2. 画像对话使用会话轮次控制（固定轮次后结构化落库）

### 7.2 历史持久化

历史记录不依赖 SDK 内存，统一持久化在后端：

1. 对话主表/JSON 记录消息序列  
2. `GET /api/tutor/history` 从持久层读取  
3. 重启后可恢复历史查询能力

---

## 8. 数据落库约束（重点）

画像采集链路必须满足“双写”：

1. SQLite：  
   - `profiles`（结构化画像）  
   - `students` / `mastery_records`（按业务更新）
2. JSON/JSONL：  
   - 画像变更事件  
   - 对话事件日志  
   - 评估与任务行为轨迹

一致性要求：

1. 先完成核心结构写入，再追加事件日志  
2. 失败时返回明确错误，并记录失败事件

---

## 9. 错误处理与降级

按照后端技术文档的统一策略：

1. SDK 调用异常 -> 转换为统一业务错误  
2. 流式中断 -> 发送 `error` 事件并结束流  
3. 超时 -> 返回降级提示（保持前端可用）  
4. 对内容审核失败或低置信场景 -> 标记并降级返回

---

## 10. 测试与验收标准

### 10.1 后端测试

1. 单测全过  
2. API 集成测试全过  
3. 流式接口覆盖：`tutor/profile-chat/resources-generate`

### 10.2 联调测试

1. 前端切换真实 API 模式  
2. Playwright 在真实 API 下完整回归  
3. 重点验证：
   - 流式渲染
   - 多轮会话连续性
   - 历史查询可回放
   - 画像在 SQLite + JSON/JSONL 均可查

---

## 11. 与后续 Quiz 链路关系

本期顺序：

1. 先完成 Tutor / Profile / Generate / Evaluation 的 SDK 接入  
2. 再实施 Quiz 的“大模型出题 + 服务端判题”

Quiz 原则不变：

1. 出题可由模型生成  
2. 判题入口统一在服务端  
3. 题目与答案以服务端落库为准，确保可测与可追溯

---

## 12. 非目标说明（本文件范围外）

本文件不包含：

1. 任何密钥、账号、证书或占位凭证  
2. 生产部署脚本细节  
3. 第三方视频/PPT平台的具体商业配置

