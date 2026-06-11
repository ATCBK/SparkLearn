# SparkLearn-第三阶段-学习宠物Nanobot接入最终实施文档

## 1. 最终技术决策

### 1.1 已确认决策

1. `nanobot` 只替换学习宠物逻辑，不替换 SparkLearn 其他模块。
2. SparkLearn 现有前端展示效果尽量保持不变，尤其是学习宠物相关页面、组件、交互骨架和任务展示风格。
3. `nanobot` 尽量不改内核代码，优先复用其原生 `feishu` channel、agent loop、memory、tool/MCP 能力。
4. 工具接入统一走 `MCP`，不走“直接改 nanobot 内置工具”的方式。
5. `nanobot` 的密钥和配置使用本地环境变量/本地 `.env` 注入，不在 SparkLearn 仓库里再维护一套新密钥体系。
6. 浏览器插件首版只接最简单能力，不做全功能浏览器自动化。

### 1.2 浏览器插件首版范围

首版仅允许：

1. `search`
2. `open`
3. `read/summary`

首版不允许：

1. 登录
2. 表单提交
3. 文件上传
4. 文件下载
5. 页面写操作

---

## 2. 最终架构边界

### 2.1 `nanobot` 负责什么

`nanobot` 只负责学习宠物这条链路中的以下能力：

1. 飞书消息接入
2. 会话上下文管理
3. 智能体推理和工具选择
4. 最终回复生成
5. 可选的流式输出

### 2.2 SparkLearn 负责什么

SparkLearn 继续负责：

1. 学习画像
2. 学习路径
3. 资源生成
4. 测验生成与判题
5. 报告与业务数据
6. 学习宠物前端展示
7. 用户体系与业务存储

### 2.3 最终调用关系

调用主链路：

1. 飞书用户发消息给学习宠物
2. `nanobot` 的 Feishu Channel 收到消息
3. `nanobot` 判断是否需要调用工具
4. 通过 `MCP` 调用 SparkLearn 暴露的业务工具
5. SparkLearn 返回结果
6. `nanobot` 组织最终回复
7. 飞书收到宠物回复

站内页面链路：

1. SparkLearn 前端仍然调用 SparkLearn 后端接口
2. SparkLearn 后端新增“宠物兼容层”
3. 兼容层请求本地运行的 `nanobot` API
4. 将 `nanobot` 返回结果转换为现有前端能消费的数据结构

这意味着：

1. 飞书侧由 `nanobot` 直接接入。
2. SparkLearn 站内宠物 UI 不直接依赖 `nanobot` 协议。
3. SparkLearn 只是把 `nanobot` 当成“宠物对话引擎”。

---

## 3. 为什么这样拆

### 3.1 保持 `nanobot` 改动最小

`nanobot` 已经具备：

1. `nanobot/channels/feishu.py`
2. `config.tools.mcpServers`
3. agent loop 和 memory
4. OpenAI-compatible API

所以没有必要改它内核去重造飞书接入、消息流、工具编排。

### 3.2 保持 SparkLearn 现有体验

你的学习宠物前端现在已经有自己的：

1. 组件结构
2. 对话展示方式
3. 任务状态结构
4. 数据字段风格

如果让前端直接改接 `nanobot` 原始协议，代价大，而且容易破坏已有展示效果。更稳的做法是保留 SparkLearn 的前后端契约，只在后端兼容层做转发和映射。

---

## 4. 首版接入范围

### 4.1 替换范围

只替换学习宠物逻辑，包括：

1. 学习宠物对话
2. 宠物工具调用
3. 宠物飞书接入

### 4.2 不替换范围

不替换以下模块：

1. 教师端
2. 社区端
3. 普通学习页面业务路由
4. 资源中心非宠物入口
5. 现有数据库主体结构

### 4.3 工具清单（MVP）

首版通过 `MCP` 暴露给 `nanobot` 的工具：

1. `spark_get_profile`
2. `spark_get_learning_path`
3. `spark_generate_resource`
4. `spark_quiz_generate`
5. `spark_quiz_judge`
6. `spark_get_report`
7. `spark_browser_search`

---

## 5. MCP 接入方案

### 5.1 方案结论

SparkLearn 新增一个本地 MCP Server，供 `nanobot` 调用。

不建议首版：

1. 改 `nanobot` 内置工具
2. 写 `nanobot.tools` 插件包替代 MCP

原因：

1. MCP 是 `nanobot` 已支持的标准入口。
2. 后续加工具只改 SparkLearn，不碰 `nanobot`。
3. 升级 `nanobot` 时冲突最小。

### 5.2 MCP Server 运行方式

建议放在 SparkLearn 后端目录下作为独立模块运行，例如：

1. `backend/app/mcp_server/server.py`
2. `backend/app/mcp_server/tools/*.py`

由 `nanobot` 在配置里通过 `command + args` 启动本地 MCP Server。

### 5.3 `nanobot` 配置方式

在本地 `nanobot` 配置中注册：

```json
{
  "tools": {
    "mcpServers": {
      "sparklearn": {
        "command": "python",
        "args": ["-m", "backend.app.mcp_server.server"],
        "toolTimeout": 30
      }
    }
  }
}
```

说明：

1. 这是本地运行时配置，不写入 SparkLearn 仓库的固定配置。
2. 密钥从本地环境变量读取。

---

## 6. SparkLearn 侧改造清单

### 6.1 新增模块

建议新增：

1. `backend/app/mcp_server/server.py`
2. `backend/app/mcp_server/tool_registry.py`
3. `backend/app/mcp_server/tools/profile_tools.py`
4. `backend/app/mcp_server/tools/path_tools.py`
5. `backend/app/mcp_server/tools/resource_tools.py`
6. `backend/app/mcp_server/tools/quiz_tools.py`
7. `backend/app/mcp_server/tools/report_tools.py`
8. `backend/app/mcp_server/tools/browser_tools.py`
9. `backend/app/services/pet_nanobot_client.py`
10. `backend/app/routes/pet_agent.py`

### 6.2 需要接入主应用的文件

建议改造：

1. [main.py](/D:/Project_building/SparkLearn/backend/app/main.py)
2. [db.py](/D:/Project_building/SparkLearn/backend/app/db.py)
3. [config.py](/D:/Project_building/SparkLearn/backend/app/config.py)
4. [real.ts](/D:/Project_building/SparkLearn/frontend/src/lib/api/real.ts)

### 6.3 建议保留不动

首版尽量不动：

1. 现有 `routes/profile.py`
2. 现有 `routes/resources.py`
3. 现有 `routes/quiz.py`
4. 现有前端宠物 UI 组件结构

---

## 7. 前端兼容方案

### 7.1 基本原则

前端仍然把学习宠物当作 SparkLearn 自己的能力来调用。

### 7.2 实现方式

新增后端接口：

1. `POST /api/agent/pet/chat`
2. `GET /api/agent/pet/status`
3. `GET /api/agent/pet/history`

这些接口内部再去请求本地 `nanobot` API。

### 7.3 为什么这样做

这样可以保留：

1. 当前宠物头像/面板/UI
2. 当前前端状态管理
3. 当前流式输出展示逻辑
4. 当前字段命名和任务文案

---

## 8. 浏览器插件最简接法

### 8.1 目标

只让学习宠物具备“查资料并摘要”的最简能力。

### 8.2 工具定义

只提供一个 MCP 工具：

1. `spark_browser_search(query: str) -> {items: [...], summary: str}`

内部可以复用你已有的浏览器控制代码，但对 `nanobot` 暴露时只暴露一个简单工具，而不是完整浏览器动作集。

### 8.3 好处

1. 降低首版复杂度
2. 不把浏览器执行细节暴露给模型
3. 后续要扩展，再加新工具而不是改旧协议

---

## 9. 身份与会话

### 9.1 飞书身份

新增映射表：

1. `external_identities`

建议字段：

1. `provider`
2. `open_id`
3. `spark_user_id`
4. `tenant_key`
5. `created_at`
6. `updated_at`

### 9.2 站内会话

SparkLearn 站内宠物继续使用自己的 `user_id` 体系。

### 9.3 飞书首次进入

建议策略：

1. 首次飞书发言自动创建或绑定 SparkLearn 用户
2. 若后续需要严格绑定，再补显式绑定流程

---

## 10. 部署方式

### 10.1 进程划分

建议三部分：

1. SparkLearn Frontend
2. SparkLearn Backend
3. `nanobot` 独立进程

### 10.2 本地环境变量

`nanobot` 侧使用本地环境变量注入：

1. 飞书 `APP_ID / APP_SECRET`
2. 大模型 API Key
3. 其他搜索或工具密钥

SparkLearn 仓库不额外托管一套 `nanobot` 密钥配置文件。

---

## 11. 分阶段开发顺序

### Phase 1：底座接通

1. 本地启动 `nanobot`
2. 配置飞书 channel
3. SparkLearn 新增 `pet_agent` 兼容层
4. SparkLearn 能调用本地 `nanobot` API 完成基础对话

### Phase 2：MCP 工具接入

1. 新增 SparkLearn MCP Server
2. 接入 `profile/path/resource/quiz/report`
3. 在 `nanobot` 本地配置 MCP Server
4. 端到端联调飞书宠物问答

### Phase 3：浏览器最简能力

1. 新增 `spark_browser_search`
2. 做白名单与超时控制
3. 联调摘要输出

### Phase 4：站内宠物切流

1. 让 SparkLearn 站内宠物接口转调 `nanobot`
2. 保持前端效果不变
3. 灰度替换旧 `/api/agent` 中宠物相关逻辑

---

## 12. 验收标准

### 12.1 功能验收

1. 飞书能和学习宠物稳定对话
2. 学习宠物能调用画像、路径、资源、测验、报告工具
3. 浏览器最简检索能力可用
4. SparkLearn 站内宠物展示效果基本不变

### 12.2 技术验收

1. `nanobot` 不修改或仅极少修改
2. 工具调用全部经由 MCP
3. SparkLearn 前端不直接耦合 `nanobot` 原始协议

---

## 13. 直接开工口径

从现在开始，开发口径固定为：

1. `nanobot` 是学习宠物的智能体内核。
2. SparkLearn 是学习业务和前端展示承载层。
3. 工具接入全部走 MCP。
4. 浏览器插件只接最简单只读检索摘要。
5. 首版优先打通飞书和站内宠物双入口。

