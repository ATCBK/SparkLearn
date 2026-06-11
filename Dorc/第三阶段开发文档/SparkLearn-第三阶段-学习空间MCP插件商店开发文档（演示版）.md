# SparkLearn-第三阶段-学习空间MCP插件商店开发文档（演示版）

## 1. 文档信息
- 文档版本：v1.0
- 创建日期：2026-05-26
- 适用阶段：第三阶段
- 目标模块：学习空间（Learning Space）
- 项目定位：MCP 服务接入与展示基座（演示可用）

## 2. 建设目标
在学习空间新增一个类似“插件商店”的页面，支持以下能力：
1. 展示系统预置 MCP 服务与用户已添加 MCP 服务。
2. 用户可自行配置 MCP 服务（基础字段）。
3. 用户可测试连接、启停服务、查看工具清单。
4. 形成后续 MCP 能力扩展的基础结构。

本次目标是“演示可用、结构清晰、可快速扩展”，不追求企业级复杂治理。

## 3. 范围定义
### 3.1 In Scope
1. MCP 服务配置管理（增删改查）。
2. 服务状态管理（启用/停用）。
3. 服务连通性测试。
4. MCP tools 列表展示。
5. 学习空间插件商店页面（列表 + 配置抽屉 + 工具弹窗）。

### 3.2 Out of Scope
1. 外部插件市场拉取与签名验证。
2. 复杂权限审批流。
3. 计费结算、套餐管理。
4. 多组织多租户高级治理。
5. 运行期自动安装/热升级。

## 4. 用户角色与用户故事
### 4.1 角色
1. 学生用户（默认）
2. 教师用户（可复用同能力）
3. 系统管理员（维护系统预置服务）

### 4.2 用户故事
1. 作为用户，我希望在学习空间查看可用 MCP 服务以及在线状态。
2. 作为用户，我希望自己新增一个 MCP 服务配置并做连通性测试。
3. 作为用户，我希望启用或停用某个 MCP 服务，控制其是否可用。
4. 作为用户，我希望查看服务下有哪些工具，便于后续在学习流程中调用。

## 5. 页面与交互设计
### 5.1 页面入口
- 路由建议：`/(shell)/mcp-store` 或 `/(shell)/space/mcp-store`
- 侧边栏文案：`MCP 插件商店`

### 5.2 页面分区
1. 顶部统计区
- 服务总数
- 在线服务数
- 用户自配服务数
2. 服务列表区
- 分类标签：`系统预置`、`我的服务`
- 卡片显示：名称、类型、状态、最近测试时间、错误摘要
3. 操作区
- `新增服务`
- `测试连接`
- `启用/停用`
- `查看工具`
- `编辑`
- `删除`
4. 弹窗/抽屉
- 配置表单抽屉
- 工具列表弹窗

### 5.3 配置表单字段
1. 基础信息
- `name`（必填）
- `description`（选填）
2. 连接类型
- `transport`（必填）：`stdio` / `http`
3. 按 transport 显示字段
- `http`：`endpoint`（必填）
- `stdio`：`command`（必填）、`args`（选填，数组）、`env`（选填，键值）
4. 控制项
- `enabled`（默认 false，测试成功后建议启用）

### 5.4 关键交互规则
1. 新增保存不强制必须先测试，但未通过测试时不允许启用。
2. 删除时二次确认。
3. 工具列表拉取失败需展示明确错误原因。
4. 列表中敏感信息不回显（如 token）。

## 6. 技术架构
### 6.1 架构分层
1. 前端层（Next.js）
- 页面展示、表单校验、调用后端 API
2. 后端路由层（FastAPI）
- 参数校验、用户隔离、响应格式统一
3. MCP 配置服务层
- 配置 CRUD、状态持久化
4. MCP 运行时服务层
- 连接测试、工具发现、超时控制
5. 存储层（SQLite/PostgreSQL，按现有后端能力）
- 服务配置数据表

### 6.2 运行模式
1. 配置写入 DB。
2. 测试时按配置临时建立 MCP 连接。
3. 启用后在“服务可用列表”中展示。
4. 工具列表可按需拉取，不做长连接驻留（演示版简化）。

## 7. 数据模型设计
表名建议：`mcp_services`

字段定义：
1. `id`：字符串主键（UUID）
2. `owner_id`：用户 ID（用于隔离）
3. `name`：服务名
4. `description`：描述
5. `source`：`system` | `user`
6. `transport`：`stdio` | `http`
7. `endpoint`：HTTP 地址（http 模式）
8. `command`：启动命令（stdio 模式）
9. `args_json`：命令参数 JSON
10. `env_json`：环境变量 JSON（存储前脱敏或加密）
11. `enabled`：是否启用
12. `last_status`：`unknown` | `online` | `offline`
13. `last_error`：最近错误摘要
14. `last_tested_at`：最近测试时间
15. `created_at`：创建时间
16. `updated_at`：更新时间

索引建议：
1. `(owner_id, source)`
2. `(owner_id, enabled)`
3. `updated_at`

## 8. API 设计
统一前缀建议：`/api/mcp`

### 8.1 获取服务列表
- 方法：`GET /api/mcp/services`
- Query：`scope=all|system|user`（可选）
- 返回示例：
```json
{
  "items": [
    {
      "id": "svc_001",
      "name": "Doc Parser",
      "source": "system",
      "transport": "http",
      "enabled": true,
      "last_status": "online",
      "last_error": "",
      "last_tested_at": "2026-05-26T09:20:00Z"
    }
  ]
}
```

### 8.2 新增服务
- 方法：`POST /api/mcp/services`
- 请求示例：
```json
{
  "name": "My Search MCP",
  "description": "个人检索服务",
  "transport": "http",
  "endpoint": "http://127.0.0.1:9001/mcp",
  "enabled": false
}
```

### 8.3 更新服务
- 方法：`PUT /api/mcp/services/{id}`
- 仅允许更新 `source=user` 且属于当前 `owner_id` 的记录。

### 8.4 删除服务
- 方法：`DELETE /api/mcp/services/{id}`
- 仅允许删除 `source=user`。

### 8.5 测试连接
- 方法：`POST /api/mcp/services/{id}/test`
- 行为：尝试连接并执行 `tools/list`。
- 返回示例：
```json
{
  "ok": true,
  "status": "online",
  "duration_ms": 812,
  "tool_count": 14,
  "error": ""
}
```

### 8.6 启停服务
- 方法：`POST /api/mcp/services/{id}/toggle`
- 请求：
```json
{
  "enabled": true
}
```
- 规则：若最近一次测试失败，不允许 `enabled=true`。

### 8.7 获取工具列表
- 方法：`GET /api/mcp/services/{id}/tools`
- 返回示例：
```json
{
  "items": [
    {"name": "search_docs", "description": "Search docs", "input_schema": {"type": "object"}}
  ]
}
```

## 9. 后端实现建议（基于现有 FastAPI）
### 9.1 目录建议
- `backend/app/routes/mcp.py`
- `backend/app/services/mcp_config_service.py`
- `backend/app/services/mcp_runtime_service.py`
- `backend/app/schemas_mcp.py`

### 9.2 职责拆分
1. `mcp.py`
- 定义路由与请求响应
2. `mcp_config_service.py`
- 配置 CRUD
- 用户隔离校验
3. `mcp_runtime_service.py`
- 测试连接
- 拉取 tools
- 超时控制
4. `schemas_mcp.py`
- Pydantic 模型与字段校验

### 9.3 关键校验
1. `transport=http` 时 `endpoint` 必填。
2. `transport=stdio` 时 `command` 必填。
3. `enabled=true` 前需有最近成功测试记录。

## 10. 前端实现建议（基于现有 Next.js App Router）
### 10.1 页面路径
- `frontend/src/app/(shell)/mcp-store/page.tsx`

### 10.2 组件建议
- `frontend/src/components/mcp/McpServiceCard.tsx`
- `frontend/src/components/mcp/McpServiceFormDrawer.tsx`
- `frontend/src/components/mcp/McpToolsModal.tsx`
- `frontend/src/components/mcp/McpStatusBadge.tsx`

### 10.3 API 封装
- `frontend/src/lib/api/mcp.ts`
- 与现有 `frontend/src/lib/api` 结构保持一致。

### 10.4 UI 状态
1. 空状态：暂无服务，引导新增。
2. 加载态：Skeleton。
3. 错误态：可重试按钮。
4. 成功态：toast + 状态刷新。

## 11. 安全与治理（演示版最小要求）
1. `stdio` 命令白名单，禁止任意系统命令。
2. `env_json` 中敏感键（如 `token`、`api_key`）存储时加密或脱敏。
3. API 全量按 `owner_id` 过滤。
4. 所有测试与工具拉取调用设置超时（建议 15 秒）。
5. 单用户并发限制（建议 3）。

## 12. 日志与监控
### 12.1 日志字段
- `trace_id`
- `owner_id`
- `service_id`
- `action`（create/update/test/toggle/list_tools）
- `duration_ms`
- `status`
- `error_code`

### 12.2 最小监控指标
1. 测试成功率
2. 测试平均耗时
3. 在线服务数量
4. 工具列表拉取失败率

## 13. 错误码建议
1. `MCP_CFG_4001` 参数非法
2. `MCP_CFG_4003` 不支持的 transport
3. `MCP_AUTH_4031` 无权限操作该服务
4. `MCP_RUN_5001` 连接超时
5. `MCP_RUN_5002` 连接失败
6. `MCP_RUN_5003` tools/list 调用失败
7. `MCP_RUN_5004` 启用前未通过测试

## 14. 里程碑与工期
1. M1（0.5 天）
- 数据表与 Pydantic 模型
- 服务 CRUD API
2. M2（0.5 天）
- 测试连接 API
- 工具列表 API
3. M3（1 天）
- 学习空间插件商店页面
- 配置抽屉与工具弹窗
4. M4（0.5 天）
- 联调、自测、缺陷修复

总计：约 2.5 天（演示版）

## 15. 测试计划
### 15.1 功能测试
1. 新增 http 服务成功。
2. 新增 stdio 服务成功（白名单内）。
3. 测试成功后可启用，测试失败不可启用。
4. 工具列表可展示。
5. 删除后列表刷新正确。

### 15.2 安全测试
1. 非 owner 无法更新/删除他人配置。
2. 非白名单 command 被拒绝。
3. 敏感字段不在响应中明文返回。

### 15.3 异常测试
1. endpoint 不可达。
2. 超时。
3. MCP 返回非预期结构。

## 16. 验收标准
1. 学习空间出现 `MCP 插件商店` 页面入口。
2. 用户可新增、编辑、删除自己的 MCP 服务。
3. 服务可测试连接并展示状态。
4. 服务可启停，状态可见。
5. 可查看工具列表。
6. 用户隔离与最小安全策略生效。

## 17. 后续扩展路线（第四阶段可选）
1. 引入系统插件市场清单（远程源 + 本地缓存）。
2. 服务健康巡检与自动重试。
3. 工具级权限（按页面/按角色开放）。
4. 学习链路内嵌调用（如知识检索、文档解析、习题生成）。
5. 接入调用审计看板。

## 18. 附录：建议初始预置服务
1. 文档解析 MCP（提取结构化知识点）
2. 检索增强 MCP（知识库/网页检索）
3. 习题生成 MCP（按知识点出题）

以上 3 个服务最容易在演示中体现学习闭环价值。
