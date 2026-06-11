# SparkLearn-第三阶段-学习宠物嵌入开源轻量Agent内核开发文档

## 1. 文档目标

本文档用于明确以下事项：

1. 将你提供的开源轻量 Agent 项目（下称 `NanoAgent`）嵌入 SparkLearn 学习宠物系统，作为宠物智能体的核心运行时。
2. 学习宠物后续能力统一由 `NanoAgent` 提供（对话、工具调用、记忆、渠道接入、可选 MCP）。
3. SparkLearn 现有后端业务能力不推倒重来，改造为被 `NanoAgent` 调用的工具服务层。
4. 明确分阶段开发计划、接口契约、数据改造、安全要求、验收标准与回滚方案。

---

## 2. 当前系统与目标系统关系

### 2.1 当前系统（现状）

- 前端：Next.js（学生端/教师端/社区端）
- 后端：FastAPI（`backend/app/routes/*`）
- 智能体：当前 `/api/agent` 为项目内置实现，耦合 `single_user_id`，能力分散在业务路由中
- 外部能力：已有星火、Coze、TTS、浏览器控制能力，但缺少统一 Agent 中枢

### 2.2 目标系统（改造后）

- `NanoAgent` 作为学习宠物唯一 Agent 内核
- SparkLearn 后端作为 Tool/API Provider（资源生成、学习画像、路径、测验、报告、教师干预等）
- 飞书作为首发接入渠道，通过 `NanoAgent` 通道能力对接
- 浏览器插件作为 `NanoAgent` 的受控工具之一

一句话：

`NanoAgent` 管“思考与编排”；SparkLearn 管“教育业务能力与数据资产”。

---

## 3. 架构设计

### 3.1 逻辑分层

1. 渠道层（Channel Layer）
- 飞书 webhook / WebSocket / WebUI / 其他聊天渠道

2. 智能体层（Agent Core Layer）
- `NanoAgent` 核心循环
- 模型路由
- 记忆管理
- 工具选择与调用

3. 工具适配层（Tool Adapter Layer）
- SparkLearn API Tool Adapter
- Browser Plugin Adapter
- 可选 MCP Tool Adapter

4. 业务服务层（Business Service Layer）
- 现有 FastAPI 路由服务：profile/path/resources/quiz/report/teacher/forum...

5. 数据层（Data Layer）
- SparkLearn SQLite + 文件存储
- `NanoAgent` 自有会话/记忆存储（可与 SparkLearn 做 ID 映射）

### 3.2 核心调用链（飞书场景）

1. 用户在飞书发消息
2. 飞书事件进入 `NanoAgent` 的 Feishu Channel
3. `NanoAgent` 根据系统提示词与上下文进行意图识别
4. 若需业务能力，调用 SparkLearn Tool Adapter
5. Adapter 请求 SparkLearn 后端 API
6. `NanoAgent` 汇总结果并回发飞书
7. 对话与任务轨迹写入记忆/日志

---

## 4. 嵌入方式选择与结论

### 4.1 两种方案

1. Sidecar 方案（推荐）
- `NanoAgent` 作为独立进程/服务运行
- SparkLearn 通过 HTTP/MCP 方式暴露工具给 `NanoAgent`

2. In-Process 方案
- 把 `NanoAgent` 部分代码直接并入 SparkLearn 后端进程

### 4.2 结论

采用 Sidecar 方案，原因：

1. 风险隔离好：Agent 升级不影响主站后端稳定性
2. 演进快：后续替换模型、加渠道、接 MCP 不改 SparkLearn 主体
3. 运维清晰：Agent 与业务服务可独立扩缩容与回滚

---

## 5. 目标改造范围

### 5.1 保持不变

1. 前端主要页面与交互骨架
2. 现有业务路由（profile/path/resources/quiz/report/teacher）
3. 数据资产（学习记录、知识库、资源索引）

### 5.2 新增

1. `agent-gateway`（SparkLearn 侧）
- 统一鉴权、幂等、审计、速率控制
- 提供给 `NanoAgent` 的标准工具入口

2. `tool adapters`
- 将现有业务接口封装成 Agent 可调用工具

3. `identity mapping`
- 飞书用户与 SparkLearn 用户映射表

4. 统一观测
- trace_id 贯穿飞书事件 -> Agent 推理 -> Tool 调用 -> 业务响应

### 5.3 可下线/收敛

1. 现有 `/api/agent` 可逐步降级为兼容层
2. 新功能优先走 `NanoAgent` 主链路

---

## 6. SparkLearn 对 NanoAgent 暴露的工具清单（MVP）

### 6.1 必选工具

1. `get_profile`
- 获取学习画像与当前阶段

2. `get_learning_path`
- 获取路径、节点掌握度与建议

3. `generate_resource`
- 触发文档/思维导图/题目/阅读材料生成

4. `quiz_generate_and_judge`
- 出题、判题、解析

5. `get_report`
- 拉取阶段学习报告

6. `browser_search`
- 调用浏览器插件做受控检索与页面摘要

### 6.2 第二批工具

1. `teacher_risk_overview`
2. `teacher_broadcast_send`
3. `knowledge_file_manage`
4. `forum_qa_assist`

---

## 7. 接口契约（建议统一格式）

### 7.1 Tool Request

```json
{
  "tool": "generate_resource",
  "trace_id": "uuid",
  "user": {
    "spark_user_id": "single_user_or_real_id",
    "channel": "feishu",
    "channel_user_id": "ou_xxx"
  },
  "input": {
    "type": "document",
    "prompt": "解释 Python 闭包并给出练习"
  },
  "meta": {
    "timeout_ms": 20000,
    "idempotency_key": "event_id"
  }
}
```

### 7.2 Tool Response

```json
{
  "success": true,
  "trace_id": "uuid",
  "data": {},
  "error": null,
  "latency_ms": 1234
}
```

---

## 8. 数据模型改造

新增表（SQLite）建议：

1. `external_identities`
- `id`
- `provider`（feishu）
- `tenant_key`
- `open_id`
- `union_id`
- `spark_user_id`
- `created_at`
- `updated_at`
- 唯一索引：`provider + open_id`

2. `channel_events`
- `id`
- `provider`
- `event_id`
- `event_type`
- `payload_json`
- `status`（received/processed/failed）
- `trace_id`
- `created_at`
- 唯一索引：`provider + event_id`（幂等）

3. `agent_tool_calls`
- `id`
- `trace_id`
- `tool`
- `spark_user_id`
- `request_json`
- `response_json`
- `status`
- `latency_ms`
- `created_at`

---

## 9. 浏览器插件接入规范

### 9.1 安全约束（强制）

1. 域名白名单（默认拒绝）
2. 动作白名单（MVP 仅允许 search/open/read/summary）
3. 单次任务超时（如 25s）
4. 最大步骤数（如 8 步）
5. 敏感信息页面自动中断（登录页、支付页、表单提交页）

### 9.2 结果标准化

统一返回：

- `title`
- `url`
- `snippet`
- `confidence`
- `source`

---

## 10. 飞书接入方案

### 10.1 MVP 范围

1. 接收单聊文本消息
2. 验签与事件去重
3. 支持同步短回复 + 异步长任务补发
4. 用户映射自动创建（首次发言）

### 10.2 后续扩展

1. 群聊 @ 触发
2. 卡片消息（学习计划、练习入口）
3. 消息线程化与任务状态更新

---

## 11. 分阶段实施计划

### Phase 0（0.5 天）

1. 固定技术决策（本文档评审通过）
2. 确认部署方式：本机/测试机双进程

### Phase 1（1-2 天）基础接通

1. 启动 `NanoAgent` 服务
2. SparkLearn 新增 `agent-gateway` 工具入口
3. 打通飞书 webhook -> `NanoAgent` -> 文本回复

### Phase 2（2-3 天）工具接入

1. 接入 6 个 MVP 工具
2. 浏览器插件适配与白名单策略落地
3. 首轮端到端联调

### Phase 3（1-2 天）稳定性与安全

1. 幂等、重试、超时、限流
2. 审计日志与 trace
3. 异常回退与熔断策略

### Phase 4（1 天）验收发布

1. 回归测试
2. 预生产演练
3. 灰度上线

---

## 12. 测试与验收标准

### 12.1 功能验收

1. 飞书发问可稳定触发学习宠物回复
2. 能调用资源生成/路径/测验/报告能力
3. 浏览器插件任务可控且可追踪

### 12.2 稳定性验收

1. 同一 `event_id` 不重复执行
2. Tool 超时可回退，不阻塞整体会话
3. 关键链路成功率 >= 98%（测试样本）

### 12.3 安全验收

1. 验签失败请求全部拒绝
2. 非白名单域名浏览器请求全部拒绝
3. 日志无明文密钥、Cookie、Token

---

## 13. 风险清单与应对

1. 风险：双系统（NanoAgent + SparkLearn）调试成本上升
- 应对：统一 trace_id 与结构化日志

2. 风险：浏览器插件执行不可控
- 应对：严格动作白名单 + 超时 + 人工确认开关

3. 风险：旧 `/api/agent` 与新链路并存导致混乱
- 应对：标记新旧入口，前端配置开关，逐步迁移

4. 风险：飞书消息突发流量
- 应对：事件入队 + 异步执行 + 限流

---

## 14. 回滚方案

1. 通道级回滚
- 飞书入口切回旧客服/静态回复

2. 能力级回滚
- `NanoAgent` 工具调用失败时回退至 SparkLearn 旧 `/api/agent` 或固定文案

3. 发布级回滚
- Sidecar 方案可直接停用 `NanoAgent`，不影响主站 API

---

## 15. 交付物清单

1. 架构与开发文档（本文档）
2. `agent-gateway` 接口实现
3. `external_identities / channel_events / agent_tool_calls` 数据迁移脚本
4. 飞书接入配置说明与联调手册
5. 浏览器插件安全策略配置
6. E2E 验收报告

---

## 16. 最终建议（执行口径）

1. 采用 Sidecar 嵌入：`NanoAgent` 做学习宠物内核，SparkLearn 做业务工具层。
2. 第一版本只做飞书 + 6 个 MVP 工具，先保证稳定闭环。
3. 浏览器插件严格“只读受控”，不要在首版开放高风险写操作。
4. 完成灰度验证后，再逐步将旧 `/api/agent` 入口下线或转兼容层。

