# SparkLearn RAG 与研讨会功能交接文档（2026-05-26）

## 1. 本轮目标

本轮主要在做两件事：

1. 把知识库从“纯文本拼接”改成“可用 RAG（讯飞 embedding）”。
2. 修复研讨会（Workshop）流式体验与结论展示问题。

---

## 2. 已完成项（可用状态）

### 2.1 RAG 主体已落地

- 已接入讯飞 embedding HTTP 协议（query/para）。
- 已完成签名兼容修复（`authorization` 使用签名串，非二次 base64）。
- `query` / `para` 均已实测返回 2560 维向量。
- 知识库索引流程已变更为：
  - 文本提取（当前优先支持 txt/md/pdf）
  - 结构化分块 + overlap
  - `para` 向量入库
- 检索流程已支持：
  - `query` 向量化
  - chunk 余弦相似度召回
  - 生成上下文拼接

相关文件：

- `backend/app/embeddings.py`
- `backend/app/config.py`
- `backend/app/db.py`
- `backend/app/routes/knowledge.py`
- `backend/app/routes/resources.py`
- `.env`（已写入 `XFYUN_EMB_*`）

### 2.2 Chat 上传文件已接入向量检索

- `POST /api/tutor/files` 上传后会尝试解析+分块+向量化。
- 新增 `tutor_file_chunks` 表用于存储聊天文件分块向量。
- `POST /api/tutor/chat` 在传入 `file_ids` 时，已检索相关 chunk 并注入回答上下文。
- 已返回 `sources`（文件名、chunk 序号、分数、片段）。

相关文件：

- `backend/app/routes/tutor_eval.py`
- `backend/app/db.py`

---

## 3. 研讨会问题现状（重点）

### 3.1 用户反馈

- “研讨会一直刷新”
- “各导师内容看起来不是流式”
- 一度出现“无法会话”

### 3.2 已定位出的根因

1. **前端事件透传缺口**：`real.ts` 里 `hub` 事件未透传 `delta`，导致页面无法识别“增量更新”。
2. **后端发包粒度问题**：早期逻辑是导师整段结束后才 emit 一次 `hub`，用户体感不是实时逐步输出。
3. **服务启动层干扰**：用户环境出现 `nanobot_runtime` 启动 `asyncio.create_subprocess_exec` 的 `NotImplementedError`，会导致 API 启动失败（与 workshop 逻辑是两层问题，但会表现为“没法会话”）。

---

## 4. 当前代码改动中需要重点复核的点

> 下一个 Agent 请先做这一步：**先跑后端启动 + `/api/tutor/chat` workshop 场景回归**，确认没有引入语法或事件协议回归。

### 4.1 前端

- `frontend/src/lib/api/types.ts`
  - `WorkshopHubEvent` 新增 `delta?: boolean`
- `frontend/src/lib/api/real.ts`
  - `hub` 事件需透传 `payload.delta`（这是修“无限刷新”关键）
- `frontend/src/app/tutor/workshop/page.tsx`
  - 已有按 `delta` 合并逻辑（同一 agentId + round 覆盖）
  - 有最终结论流式草稿展示
- `frontend/src/app/tutor/page.tsx`
  - 已有 `hub` 的 delta 合并逻辑

### 4.2 后端

- `backend/app/routes/tutor_eval.py`
  - workshop discussion 改为分块推送 `hub` 增量事件（`delta=True`）
  - 最终落地消息 `delta=False`
  - `StreamingResponse` 增加 `Cache-Control/X-Accel-Buffering`
  - chat 文件向量化、检索注入、sources 返回

---

## 5. 待办优先级（给下一个 Agent）

### P0（先做）

1. **修复并验证 workshop 的完整链路**（最重要）
   - 逐条导师发言是否实时增长
   - 是否还会重复刷屏
   - 右侧结论是否稳定展示
2. **确保 API 能稳定启动**
   - `nanobot_runtime` 在 Windows 下应可降级，不应阻塞主服务

### P1

3. **补全 sources 前端展示**
   - 目前后端已返回，前端应在 tutor UI 显示引用来源卡片
4. **上传文件导致页面错乱问题**
   - 用户已明确反馈，尚未完成最终修复

---

## 6. 回归测试清单

1. 上传 `txt/md/pdf` 到知识库并索引成功。
2. 资源生成带 `knowledge_file_ids` 时能引用知识片段。
3. Tutor 页上传文件后提问，回答能体现文件内容。
4. `/api/tutor/chat` 返回 `sources`。
5. Workshop：
   - `hub` 事件持续到达
   - 同导师同轮消息增量更新
   - 不出现重复刷屏
   - 最终结论区有内容

---

## 7. 风险说明

1. 当前分块与检索仍是“最小可用”版本，后续还可加重排。
2. `nanobot_runtime` 启动异常是独立高风险点，会误导成业务功能不可用。
3. 前端 `next build` 历史问题仍存在：
   - `/generate` 页 `useSearchParams` 缺 `Suspense`（与本次 workshop 改动无关）。

---

## 8. 建议接手顺序

1. 先保证后端可稳定启动（nanobot 降级）。
2. 再验证 workshop SSE 协议（尤其 `hub.delta`）。
3. 最后处理“学习空间上传后页面错乱”并做端到端回归。

