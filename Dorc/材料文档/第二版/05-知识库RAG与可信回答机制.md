# 知识库RAG与可信回答机制（第二版）

## 1. 目的
回答的可信度不止来自大模型输出，而来自三层来源：
1) 用户画像上下文；2) 知识库上下文；3) 外部检索与证据。

## 2. 知识库链路

### 2.1 上传与索引
- `POST /api/knowledge/files`：上传课程文件。
- `PUT /api/knowledge/files/{id}/index`：文本抽取、分块、embedding、入库。
- `GET /api/knowledge/stats`：文件/切片统计。
- `GET /api/knowledge/chunks`：分片查询。

### 2.2 检索
- `GET /api/knowledge/retrieve`：按 query 返回 top-k + sources。
- `file_ids` 来自 `/api/knowledge/files?status=indexed` 过滤。
- 查询为空时仍可返回最近语义候选；有检索向量则按余弦排序。

## 3. Tutor 的证据链（信任控制）
在 `TrustAnswerController` 中流程为：

1. `route_query` 解析场景与风险级别。
2. `retrieve_evidence` 拉取课程证据与工具证据。
3. 合并 Web 搜索结果（若开启 `web_search`）。
4. `judge_answerability` 给出 `confidence_level` 与 `reason_codes`。
5. `render_citations` 生成可返回给前端的引用。

## 4. 接口响应中的可信字段
在 `/api/tutor/chat` 流中常见事件：

- `confidence`：`{ score, level, color, label, message, reason_codes }`
- `citations`：证据列表（`id/label/sourceType/snippet/score`）
- `trust_meta`：查询类型、风险、建议动作、证据条数

前端在 `onConfidence/onCitations/onTrustMeta` 中同步显示。

## 5. 失败与降级
- 向量检索异常：仍可继续对话（不返回空）；转向通用 prompt 兜底。
- Web 检索失败：继续走本地/知识库上下文。
- Spark 回答无文本：`_fallback` 提示“证据不足，建议补充资料”。
- 如果 `trust_meta` 无可验证证据，会降低置信度并提示用户动作。

## 6. 在项目汇报中的价值表达
- 强化“防幻觉”而不是“无限制生成”。
- 任何高风险问题都能看见证据条目和置信度下降。
- 与传统教学助手相比具备“可审计性”优势。
