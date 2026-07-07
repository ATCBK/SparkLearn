# 多智能体协作与星辰Agent平台（第二版）

## 1. 设计目标
把 Tutor 从“单模型聊天”升级为：

- 可执行的研讨会式决策链。
- 可调用外部工具的协作链。
- 可视化每一步行为的事件链。

## 2. 星辰Agent平台（MCP）集成

### 2.1 服务管理
星辰Agent平台在本项目中通过 `/api/mcp` 完成管理：

- `GET /api/mcp/services`：列出所有服务。
- `POST /api/mcp/services`：新增服务（stdio/http）。
- `PUT /api/mcp/services/{id}`：更新服务参数。
- `POST /api/mcp/services/{id}`：执行 `test`（连接校验）。
- `POST /api/mcp/services/{id}/toggle`：开关。
- `GET /api/mcp/services/{id}/tools`：拉取工具列表。
- `POST /api/mcp/services/{id}/call`：工具调用。

### 2.2 兼容细节（实现要点）
- stdio 与 http 双模式。
- Windows 兼容性：spawn + 线程池读写。
- 支持协议兼容降级：若 stdio frame 头不匹配，自动退化到非 framing 读取。

## 3. Tutor 研讨会（workshop）工作流

在 `/api/tutor/chat` 中，当 `workshopEnabled=true` 时：

1. 发送 `workshop_meta`：参与者、轮次、复杂度。
2. 触发阶段事件：
   - `workshop_phase: profile_analysis running/done`
   - `workshop_phase: discussion running/done`（每轮）
   - `workshop_phase: synthesis running/done`
3. `hub` 事件承载各参与者摘要（逐字增量也可 `delta=true`）。
4. 最后产出 `agui` 阶段性事件和最终回答。

## 4. /api/agent 与学习宠物能力

- `POST /api/agent/pet`：创建宠物。
- `GET /api/agent/pet`：读取。
- `PATCH /api/agent/pet`：升级。
- `POST /api/agent/task`：创建子任务。
- `GET /api/agent/task/{id}` / `/api/agent/tasks`：任务追踪。
- `POST /api/agent/task/{id}/feedback`：人工反馈。

这套接口用于“长期任务化学习交互”，和 Tutor 主流程形成并行增强。

## 5. 交互失败处理
- MCP `tools/list`/`tools/call` 失败：
  - tutor 仍可继续生成回答。
  - `mcp_calls` 会写入失败状态（`ok=false` + error）。
  - AGUI 记录工具失败事件，供用户查看。
- 工具调用超时：单次调用设定 tool timeout；超时记为失败并继续。
- 研讨会流程异常：保底输出 synthesis（基于已收集的 hub 信息）而非返回空。

## 6. 可观测与答辩表达
- 你可以用这张结论句：
  “星辰Agent平台提供了外部世界可执行能力，tutor 的多智能体研讨通过阶段事件将协作过程外显，系统不会因单工具失败而失去最终响应。”
