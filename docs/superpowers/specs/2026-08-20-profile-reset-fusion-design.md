# 学习画像重置与 AI 融合展示设计

## 1. 目标

本设计解决两个相互关联的问题：用户无法安全地重置当前学习画像并重新建档；画像采集和页面展示仍以离散字段为主，缺少基于多项信息关联关系生成的 AI 综合判断。

决赛版本保留 `students` 和 `profiles` 作为可编辑的结构化数据源，不迁移数据库，不删除学习记录；新增可追溯的融合分析产物，并将画像页面的信息层级调整为“AI 综合画像优先、原始字段按需查看”。

## 2. 设计原则

- 结构化字段仍是可编辑事实，不由 AI 静默覆盖。
- AI 结论必须记录画像版本、来源、生成方式、时间和置信度。
- 模型不可用时允许规则降级，但页面必须明确标识，不能伪装成 AI 结论。
- 重置只清除当前有效画像、专业/年级和画像语义记忆，不删除练习、资源、学习记录、姓名、邮箱和账号身份。
- 重置前归档旧画像、旧分析和旧历史；重新建档后，当前页面和下游上下文不得继续读取旧画像。
- 危险操作必须二次确认；对话中的自然语言重置同样适用。

## 3. 数据结构

当前画像字段继续写入 `profiles` 表和 `profile_snapshot.json`。融合分析写入用户目录下的 `profile_ai_analysis.json`：

```json
{
  "status": "ready",
  "schema_version": "profile-analysis-v1",
  "profile_version": 2,
  "source_type": "onboarding",
  "generated_by": "llm",
  "model": "configured-default",
  "confidence": 0.82,
  "overview": "学习者当前处于……",
  "narrative": "一段连续、完整的学习画像描述……",
  "goal_gap": "当前基础与目标之间……",
  "strengths": ["……"],
  "focus_areas": ["……"],
  "learning_strategy": "……",
  "next_actions": ["……"],
  "evidence": [
    {"source": "onboarding", "label": "学习目标与基础", "captured_at": "ISO-8601"}
  ],
  "analysis_steps": [],
  "updated_at": "ISO-8601"
}
```

`generated_by` 只能是 `llm`、`rule_fallback` 或 `legacy_unverified`。模型解析失败或不可用时，规则降级只能基于实际字段生成保守描述；无依据项使用“尚未采集”或“待验证”。

画像历史快照继续存放于 `profile_history.json`，每条新增 `narrative`、`analysis_source` 和 `confidence`，从而支持多段画像对比。当前三天窗口和最多 12 条的兼容规则不变。

重置归档写入 `profile_reset_archive.json`，每条包含重置时间、数据库画像快照、当前分析和当前画像历史。活动文件随后写为空对象或空列表，避免旧内容被继续读取。

## 4. 后端链路

### 4.1 画像融合生成

新增独立的画像分析模块，负责：

1. 构造只包含当前字段、来源和有限历史的结构化提示词。
2. 请求现有 `spark_lite.stream_chat_events()`。
3. 从模型输出中提取并校验 JSON。
4. 清理空值、限制数组数量、钳制置信度到 `0..1`。
5. 模型失败时返回带 `generated_by=rule_fallback` 的保守结果。

以下动作完成后自动生成或刷新融合分析：

- `POST /api/profile/onboarding`：问卷建档完成。
- `POST /api/profile/chat`：第三轮对话建档完成。
- `PUT /api/profile`：用户修改画像基础资料。
- `POST /api/profile/history/analyze`：用户主动重新生成。

新增 `GET /api/profile/analysis/current` 读取已保存分析。旧的 `POST /api/profile/history/analyze` 保持返回 `analysis`、`analysis_steps`、`updated_at`，同时返回完整新字段，保证现有调用兼容。

对话建档在完成时必须保存用户原始对话片段，并通过 LLM 提取结构化字段；模型不可用时使用不编造默认值的规则提取。现有固定写入“函数、面向对象、期末提分”等默认值的逻辑必须删除。

### 4.2 画像重置

新增 `DELETE /api/profile`：

1. 根据当前登录用户读取画像、分析和历史。
2. 将这些内容追加到 `profile_reset_archive.json`。
3. 删除 `profiles` 当前行，并清空 `students` 中的 `major`、`grade`，保留姓名和邮箱。
4. 清空 `profile_snapshot.json`、`profile_ai_analysis.json` 和活动 `profile_history.json`。
5. 清空 `memory_store.json` 中的 `goals`、`preferences`、`constraints`、`skills`、`weak_points` 和 `learning_stage`；保留事实记忆、感知资产与历史对话记录。
6. 清理该用户未完成的对话建档会话和重置确认状态。
7. 追加 `profile_reset` 学习事件。
8. 返回 `{reset: true, redirect: "/onboarding", reset_at}`。

学习记录、资源、练习、任务和已有学习路径不删除。它们保留为历史学习资产，但在没有当前画像时不得被解释为当前画像结论；重建画像后是否重算路径属于后续路径模块任务。

### 4.3 对话内重置

学习伙伴聊天先执行本地高精度意图判断：仅当文本明确包含“重置/清空/重新建立”与“学习画像/画像/建档”组合时进入重置流程。

- 首次请求：只创建十分钟有效的确认状态，返回影响范围和“请回复确认重置”。
- 用户确认：调用与 `DELETE /api/profile` 相同的共享重置服务，返回重新建档入口。
- 用户取消或确认超时：清除确认状态，不改画像。
- 普通对话：继续走原有大模型聊天链路。

前端聊天响应增加可选动作：

```json
{
  "answer": "学习画像已重置，可以重新开始建档。",
  "action": {"type": "navigate", "label": "重新开始建档", "href": "/onboarding"}
}
```

## 5. 前端信息架构

画像页采用四层信息深度：

- L0 概览：AI 综合画像、状态、版本、置信度、最近更新时间。
- L1 聚焦：目标与差距、优势、待提升点、学习策略、下一步行动，以及可展开的分析依据。
- L2 管理：`/profile/settings` 维护原始字段，主页面只提供“查看画像资料”入口。
- L3 执行：重新生成分析、重置画像、重新对话建档。

页面首屏不再以头像和字段卡片占据主体。头像保留为身份辅助；“当前基础、薄弱点、偏好、阶段”等字段不直接作为主要结论，而由 AI 融合模块解释它们之间的关系。

无分析时显示真实状态：

- `rule_fallback`：显示“基础分析（AI 暂不可用）”。
- `legacy_unverified`：显示“历史分析，建议重新生成”。
- 无画像：显示重新建档入口。

个人设置页新增“重置学习画像”危险操作区；现有 `/onboarding` 的“重新采集”必须先调用同一重置接口并确认，不能只在前端覆盖旧字段。

## 6. 异常与安全

- 所有画像接口按 `current_user.user_id` 隔离。
- `/api/profile/chat` 增加鉴权，并验证会话归属当前用户。
- 模型自由文本、空输出、错误事件和非法 JSON 均不得当作有效分析保存。
- 重置归档最多保留最近 5 次，避免无界增长。
- 重置确认文件按用户隔离并带过期时间。
- 前端不根据本地 `localStorage` 单独判断重置成功，服务端是画像状态的唯一真源。

## 7. 验收标准

- 建档完成后自动产生融合画像；刷新页面仍可读取。
- 画像首页主体展示综合分析和字段关系，不再由字段卡片主导。
- 原始字段仍可在设置页查看、修改；修改后分析版本同步刷新。
- 模型不可用时显示明确降级状态，不出现伪造结论。
- 用户从设置页或 onboarding 重新采集入口重置后，`GET /api/profile` 不再返回旧画像，并进入 `/onboarding`。
- 学习伙伴收到明确重置请求后先确认；确认前无数据变化，确认后提供重新建档入口。
- 重置后旧画像可在归档中追溯，但当前分析和历史不读取旧内容。
- 两个用户之间的画像、分析、确认状态和归档完全隔离。
