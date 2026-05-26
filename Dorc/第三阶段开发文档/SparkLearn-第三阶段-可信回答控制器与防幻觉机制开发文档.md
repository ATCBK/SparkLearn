# SparkLearn 第三阶段：可信回答控制器与防幻觉机制开发文档

## 1. 文档目标

本文档用于指导 SparkLearn 学而思项目落地一套可执行、可验证、可演示的防幻觉机制。目标不是“通过提示词让模型谨慎一点”，而是在现有后端架构上增加一层 **TrustAnswer Controller（可信回答控制器）**，把回答过程拆成：

1. 识别问题类型
2. 检索可用证据
3. 判断回答置信度
4. 基于证据生成回答
5. 对回答中的事实进行校验
6. 输出引用来源与置信度标识

最终效果：

- 在学习辅导、知识问答、资源生成场景中，回答尽量建立在课程资料、学习画像、知识点结构和规则约束之上
- 证据不足时不再“拒不回答”，而是自动降级为低置信回答
- 回答下方展示一个小圆圈，帮助用户理解当前回答可靠程度
- 前端可以看到引用来源
- 后端可以记录“是否有证据、置信度等级、引用了哪些资料、哪些事实被判定为不可靠”

---

## 2. 与当前项目的对应关系

当前项目已经具备可复用基础：

- 知识库检索：
  `backend/app/routes/knowledge.py`
  已有 `retrieve_knowledge_context_async()`，可返回 `context + sources`
- 学习画像：
  `backend/app/routes/profile.py`
  已有画像落库与 `profile_snapshot.json`
- 记忆注入：
  `backend/app/memory_engine.py`
  已有 working / episodic / semantic memory
- 智能辅导主链路：
  `backend/app/routes/tutor_eval.py`
  已有 `/api/tutor/chat`、文件召回、source 回传雏形
- 资源生成：
  `backend/app/routes/resources.py`
  已有知识库上下文拼接，但还没有“回答置信度判断”和“统一置信度展示”
- 规则库基础：
  `backend/app/db.py`
  已有 `tutor_roles.rules` 字段，可承接部分教学规则

当前缺口：

- 没有统一的“回答前控制器”
- 没有独立的 `AnswerabilityJudge`
- 没有标准化置信度分级策略
- 没有统一的置信度 UI 输出格式
- 没有逐条 claim 校验
- 没有统一 citation 渲染格式
- 没有可信回答日志与评估指标

所以第三阶段不建议把防幻觉逻辑散落到各个路由里，而应新增统一控制层。

---

## 3. 总体架构

```text
User Question
   ↓
TrustAnswerController
   ├── QueryRouter
   ├── EvidenceRetriever
   ├── AnswerabilityJudge
   ├── GroundedGenerator
   ├── ClaimVerifier
   └── CitationRenderer
   ↓
SSE / JSON Response
```

在 SparkLearn 中建议接入这三个主入口：

1. `/api/tutor/chat`
   学习辅导主场景，优先落地
2. `/api/resources/generate`
   资源生成场景，第二优先级
3. `/api/report/ai-summary` 与教师 AI 总结接口
   报告类生成，第三优先级

---

## 4. 可信回答控制器的职责定义

### 4.1 TrustAnswerController

职责：

- 统一编排一次回答的全流程
- 决定调用哪些证据源
- 决定最终回答属于高置信、中置信还是低置信
- 决定最终输出的引用和置信度说明

建议新增文件：

- `backend/app/trust_answer_controller.py`

建议核心方法：

```python
async def answer(req: TrustAnswerRequest) -> TrustAnswerResult:
    ...
```

---

### 4.2 QueryRouter

职责：

- 判断问题属于哪一类
- 决定需要检索哪些证据源
- 决定回答风险等级

建议分类：

1. `knowledge_qa`
   课程概念、知识点解释、题目原理、术语问答
2. `personalized_guidance`
   结合画像给学习建议、推荐学习动作
3. `resource_based`
   基于上传资料回答、总结、抽取重点
4. `rule_constrained`
   需要遵守项目规则、教学规范、输出格式约束
5. `open_ended`
   开放性闲聊、低风险鼓励、非事实密集型对话

路由依据：

- 是否包含“这份资料/这个文档/上面内容”
- 是否提及“我适合怎么学”“根据我的情况”
- 是否提及具体知识点或题目
- 是否要求给出确定性事实、定义、步骤、结论

建议输出：

```python
class RoutedQuery(BaseModel):
    query_type: str
    risk_level: str
    need_knowledge: bool
    need_profile: bool
    need_memory: bool
    need_rules: bool
    need_user_files: bool
```

---

### 4.3 EvidenceRetriever

职责：

- 按 QueryRouter 的结果，组合多个证据源
- 为生成器返回结构化证据，而不是只拼接一段长 prompt

SparkLearn 中建议支持 4 个证据源：

1. 课程资源库
   来源：`knowledge_files + knowledge_chunks`
2. 学习画像库
   来源：`profiles`、`profile_snapshot.json`
3. 知识点图谱
   来源：`mastery_records`、`learning.py` 中的 `_GRAPH_NODES`
4. 项目规则库
   来源：`tutor_roles.rules` + 新增规则配置文件

建议新增证据统一结构：

```python
class EvidenceItem(BaseModel):
    source_type: str
    source_id: str
    title: str
    snippet: str
    score: float = 0.0
    metadata: dict[str, Any] = {}
```

```python
class EvidenceBundle(BaseModel):
    knowledge: list[EvidenceItem] = []
    profile: list[EvidenceItem] = []
    graph: list[EvidenceItem] = []
    rules: list[EvidenceItem] = []
```

实现建议：

- 复用 `knowledge.py` 的向量召回逻辑
- 从 `profile.py` / `tutor_eval.py` 读取画像摘要
- 从 `learning.py` 中按知识点名称、当前阶段、薄弱点召回图谱节点
- 新增 `backend/app/trust_rules.py`，维护置信度分级、引用、教学规范

---

### 4.4 AnswerabilityJudge

职责：

- 判断“当前回答能有多可信”
- 决定是高置信回答、中置信回答还是低置信回答
- 这是第一阶段最关键模块，必须先做

判断维度建议：

1. 是否存在与问题主题直接相关的知识证据
2. 是否存在足够多的证据片段
3. 证据分数是否达到阈值
4. 用户问题是否依赖未上传资料
5. 是否需要个性化信息但画像为空
6. 是否涉及高风险确定性判断

建议输出：

```python
class AnswerabilityDecision(BaseModel):
    confidence_score: float
    confidence_level: str
    response_mode: str
    reason_codes: list[str]
    missing_requirements: list[str]
    suggested_user_action: str = ""
```

建议原因码：

- `NO_EVIDENCE`
- `LOW_RETRIEVAL_SCORE`
- `PROFILE_REQUIRED_BUT_MISSING`
- `FILE_REQUIRED_BUT_NOT_PROVIDED`
- `KNOWLEDGE_GRAPH_GAP`
- `RULE_CONFLICT`

建议阈值：

- `0.80 - 1.00`：高置信，可给明确结论
- `0.55 - 0.79`：中置信，可回答，但要保留条件词和证据边界
- `0.00 - 0.54`：低置信，允许给方向性帮助，但不能给强确定性结论
- `top1_score < 0.55` 且 `top3_avg < 0.45` 时，默认不进入高置信
- 有效证据条数 `< 2` 时，不允许输出“唯一正确”“最适合”“一定是”这类表述
- 个性化建议场景中画像为空时，只能给通用建议，不能给“你目前最适合”这类确定结论

低置信场景输出模板建议：

```text
先给你一个基于当前信息的初步判断：……

当前置信度较低，原因是相关课程资料/学习画像证据不足。
如果你补充以下信息，我可以把判断做得更准确：
1. 上传相关课程资料或题目内容
2. 告诉我当前卡住的知识点
3. 如果需要个性化建议，请先完善学习画像
```

注意：

- 这里不是“完全不回答”
- 而是“回答保留，但降低确定性表达 + 明示置信度 + 引导补充信息”

### 4.4.1 置信度圆圈标准体系

前端不再展示“拒不回答”，而是在每条回答下方显示一个小圆圈状态，帮助用户理解当前回答的可靠程度。

建议标准：

1. `green`
   标签：高置信
   分数区间：`0.80 - 1.00`
   含义：有足够证据支撑，回答可直接参考
2. `yellow`
   标签：中置信
   分数区间：`0.55 - 0.79`
   含义：有部分证据支撑，但仍需结合具体题目或资料确认
3. `red`
   标签：低置信
   分数区间：`0.00 - 0.54`
   含义：证据不足，只能提供方向性帮助，不能视为确定结论

建议前端文案：

- 高置信：`已基于课程资料和学习记录回答`
- 中置信：`已结合部分资料回答，建议继续核对`
- 低置信：`当前证据不足，以下回答仅供参考`

建议前端结构：

```json
{
  "confidence": {
    "score": 0.72,
    "level": "medium",
    "color": "yellow",
    "label": "中置信",
    "reason_codes": ["LOW_RETRIEVAL_SCORE"],
    "message": "已结合部分资料回答，建议继续核对"
  }
}
```

---

### 4.5 GroundedGenerator

职责：

- 只允许模型基于证据回答
- 明确区分“证据支持的内容”和“启发式建议”

生成约束建议：

1. 回答优先引用检索片段
2. 不能把未出现在证据中的事实说成确定事实
3. 如需补充通用说明，要显式使用“通常”“一般来说”
4. 个性化建议必须引用画像或学习记录
5. 证据不足时，不拒绝作答，而是自动降级为低置信表达
6. 回答末尾自动输出引用来源

建议系统提示词骨架：

```text
你是 SparkLearn 的可信学习辅导助手。
你只能优先依据提供的证据回答。
如果证据不足，不要补全为确定性事实，而要自动降低语气，并明确标记低置信度。
如果给出个性化建议，必须引用学习画像或学习记录。
回答中每个关键结论都应能在证据中找到支撑。
```

建议生成结果结构：

```python
class GroundedDraft(BaseModel):
    answer_text: str
    claims: list[str]
    used_evidence_ids: list[str]
```

这里的 `claims` 不是给前端看的，而是供 `ClaimVerifier` 二次校验。

---

### 4.6 ClaimVerifier

职责：

- 把回答拆成若干事实断言
- 检查每条断言能否被证据支持

这是第二阶段增强能力，第一版可以先做轻量规则实现。

建议策略：

1. 句级切分
2. 抽取包含以下特征的句子作为 claim
   - 定义句
   - 因果句
   - 数值句
   - “你目前/你适合/你应该”这类个性化判断句
3. 对每条 claim 与证据片段做相似度比对
4. 无支撑 claim 做三种处理
   - 删除
   - 弱化语气
   - 改写为“基于目前信息，倾向于……”

建议输出：

```python
class ClaimCheckResult(BaseModel):
    claim: str
    supported: bool
    support_evidence_ids: list[str]
    action: str  # keep | soften | remove
```

示例：

- 原句：
  “你当前最薄弱的是函数返回值。”
- 若证据只有最近一次错题，不足以支撑“最薄弱”
- 改写：
  “从当前已记录的错题和画像看，你在函数返回值上存在明显卡点。”

---

### 4.7 CitationRenderer

职责：

- 将最终使用到的证据转换成前端可展示的引用列表
- 这是第一阶段必须做

建议输出格式：

```json
{
  "answer": "……",
  "citations": [
    {
      "id": "knowledge:12:4",
      "label": "Python基础知识库.xlsx · 第5片段",
      "source_type": "knowledge",
      "snippet": "函数返回值用于把函数内部结果传回调用处……"
    },
    {
      "id": "profile:user-1",
      "label": "学习画像",
      "source_type": "profile",
      "snippet": "当前薄弱点：函数、面向对象"
    }
  ]
}
```

前端表现建议：

- 聊天气泡下方展示“引用来源”
- 鼠标悬停或展开后查看片段
- 若为低置信，则显示“当前证据不足，以下回答仅供参考”

---

## 5. SparkLearn 场景化回答策略

### 5.1 学习辅导 `/api/tutor/chat`

这是最优先落地点。

现状：

- 已有会话历史
- 已有上传文件召回
- 已有画像摘要
- 已有 memory 注入

改造方式：

将当前 `tutor_chat()` 中“直接拼 prompt -> 调模型”的部分替换为：

```text
tutor_chat
  -> TrustAnswerController.answer()
     -> 返回 answer / citations / confidence / trust_meta
  -> SSE 输出
```

SSE 事件建议新增：

- `trust_meta`
- `citations`
- `confidence`
- `verification`

返回示例：

```json
{
  "type": "trust_meta",
  "data": {
    "query_type": "knowledge_qa",
    "confidence_score": 0.81,
    "confidence_level": "high",
    "evidence_count": 4
  }
}
```

---

### 5.2 资源生成 `/api/resources/generate`

现状问题：

- 虽然会拼接 `knowledge_context`
- 但如果资料不足，仍可能生成看似完整但置信度偏低的内容

改造原则：

- 资源类输出不能只靠模型流畅度
- 必须先判断资料是否足够支撑生成

建议：

- `document`、`blog`、`reading`、`quiz` 生成前都先走 `AnswerabilityJudge`
- 若没有知识库证据，只能生成“通用模板型资源”，并明确标记 `content_source = generic`
- 若要求“基于我的资料生成讲义”，但没有有效资料，则进入低置信模式，并提示补资料

---

### 5.3 报告总结与教师端 AI 总结

这类场景应更多依赖结构化数据，而不是自由生成。

建议：

- 先从 `profiles`、`mastery_records`、`learning_events` 抽取结构化事实
- 模型只负责组织语言
- 禁止模型自行编造分数、趋势、完成率
- 报告型回答同样输出置信度圆圈，但通常以结构化数据完整度来计分

---

## 6. 第一阶段必须做的三项能力

你已经明确了第一阶段优先级，这里给出可直接执行的落地方案。

### 6.1 RAG 检索

目标：

- 回答前先从知识库、画像、知识点图谱中找证据

最低交付标准：

- 支持知识库 TopK 检索
- 支持画像摘要注入
- 支持知识点图谱节点补充

当前复用：

- `retrieve_knowledge_context_async()`
- `_load_profile_snapshot()`
- `learning.py` 中知识点图结构

建议新增：

- `backend/app/trust_retriever.py`

---

### 6.2 引用来源

目标：

- 每个回答都能回显来源

最低交付标准：

- 至少支持知识库来源引用
- 能展示文件名、片段号、摘要

第二步增强：

- 加入画像来源、规则来源、知识图谱来源

---

### 6.3 低置信度提示

目标：

- 没有证据时不输出强确定性内容
- 回答下方展示置信度圆圈和说明文案

最低交付标准：

- 问题需要资料但未检索到有效证据时，回答自动降级为低置信模式
- 输出可读原因、置信度圆圈和下一步建议

建议文案分级：

1. 缺资料：
   “当前没有检索到足够相关课程资料，以下回答仅供参考。你可以上传讲义、题目或截图后继续问。”
2. 缺画像：
   “当前个性化依据不足，以下先给通用建议。如果你希望更贴合自己，请先完善学习画像。”
3. 问题过宽：
   “这个问题范围较大，以下先给一个方向性回答。建议补充具体知识点或题目内容。”

---

## 7. 推荐的代码结构

建议在 `backend/app` 下新增：

```text
backend/app/
├─ trust_answer_controller.py
├─ trust_router.py
├─ trust_retriever.py
├─ trust_judge.py
├─ trust_generator.py
├─ trust_verifier.py
├─ trust_citation.py
├─ trust_rules.py
└─ trust_schemas.py
```

### 7.1 trust_schemas.py

统一定义：

- `TrustAnswerRequest`
- `RoutedQuery`
- `EvidenceItem`
- `EvidenceBundle`
- `AnswerabilityDecision`
- `GroundedDraft`
- `ClaimCheckResult`
- `TrustAnswerResult`

### 7.2 trust_rules.py

配置项建议：

- 各场景最小证据数
- 各场景召回分数阈值
- 置信度分级模板
- 圆圈颜色与文案映射
- 可弱化表达词典

示例：

```python
MIN_EVIDENCE_BY_TYPE = {
    "knowledge_qa": 2,
    "personalized_guidance": 2,
    "resource_based": 2,
    "open_ended": 0,
}
```

```python
CONFIDENCE_COLOR_MAP = {
    "high": "green",
    "medium": "yellow",
    "low": "red",
}
```

---

## 8. 数据结构与落库设计

第一阶段建议先最小化落库，但要保证可追踪。

### 8.1 新增表 `trust_answer_logs`

建议字段：

| 字段 | 说明 |
|---|---|
| id | 主键 |
| user_id | 用户 |
| scene | tutor / resource / report |
| query_text | 用户问题 |
| query_type | 路由结果 |
| confidence_level | 置信度等级 |
| confidence_score | 置信度分数 |
| evidence_count | 证据数 |
| used_sources_json | 使用来源 |
| confidence_reason | 低置信原因 |
| answer_text | 最终回答 |
| verification_json | claim 校验结果 |
| created_at | 时间 |

用途：

- 答辩演示
- 质量分析
- 后续阈值调优

### 8.2 可选新增 `trust_feedback`

记录用户是否认为“回答可信/不可信”。

---

## 9. 接口设计建议

### 9.1 内部调用请求体

```python
class TrustAnswerRequest(BaseModel):
    scene: str
    query: str
    conversation_id: int | None = None
    file_ids: list[int] = []
    knowledge_file_ids: list[int] = []
    page_context: str = ""
    role_prompt: str = ""
    use_profile: bool = True
    use_memory: bool = True
```

### 9.2 内部调用返回体

```python
class TrustAnswerResult(BaseModel):
    confidence_score: float
    confidence_level: str
    answer: str
    confidence_message: str = ""
    citations: list[dict[str, Any]] = []
    verification: list[dict[str, Any]] = []
    trust_meta: dict[str, Any] = {}
```

### 9.3 tutor SSE 增补

当前 `done` 事件建议扩成：

```json
{
  "message": {...},
  "memory": {...},
  "sources": [...],
  "trust": {
    "confidence_score": 0.81,
    "confidence_level": "high",
    "query_type": "knowledge_qa"
  },
  "confidence": {
    "score": 0.81,
    "level": "high",
    "color": "green",
    "label": "高置信",
    "message": "已基于课程资料和学习记录回答"
  }
}
```

---

## 10. 关键流程设计

### 10.1 正常回答流程

```text
用户提问
-> QueryRouter 识别为 knowledge_qa
-> EvidenceRetriever 从知识库/画像/图谱中召回
-> AnswerabilityJudge 判定证据充足
-> GroundedGenerator 基于证据生成
-> ClaimVerifier 清洗无依据句子
-> CitationRenderer 输出引用
-> 返回答案 + 绿色置信度圆圈
```

### 10.2 低置信流程

```text
用户提问
-> QueryRouter 识别为 resource_based
-> EvidenceRetriever 没检索到有效资料
-> AnswerabilityJudge 判定为低置信
-> 进入降级生成，只输出方向性回答
-> 回答下方展示红色小圆圈 + 原因说明 + 补充资料建议
```

### 10.3 个性化建议流程

```text
用户提问“我接下来该怎么学”
-> QueryRouter 识别 personalized_guidance
-> 检索画像 + 薄弱点 + 当前阶段 + 最近资源
-> 若画像缺失，只给通用建议 + 黄色或红色圆圈
-> 若画像充分，才输出个性化方案 + 绿色或黄色圆圈
```

---

## 11. Prompt 设计原则

### 11.1 系统约束

- 明确“证据优先”
- 明确“资料不足时不做强确定回答，而是降级为低置信回答”
- 明确“个性化结论必须有画像依据”

### 11.2 证据组织方式

不要简单把全部上下文拼成一段大文本，建议使用分区：

```text
[规则约束]
...

[学习画像]
...

[知识图谱]
...

[课程资料证据]
1. ...
2. ...
3. ...
```

### 11.3 输出约束

要求模型输出：

1. 正文回答
2. 使用到的证据编号
3. 不确定项列表
4. 建议置信度等级

即便最终不把“不确定项列表”展示给用户，也可用于校验。

---

## 12. 开发步骤

### 第 1 周：最小可用版本

目标：

- 先把第一阶段三项能力跑通

任务：

1. 新建 `trust_*` 模块骨架
2. 实现 QueryRouter
3. 实现 Knowledge/Profile/Graph 的 EvidenceRetriever
4. 实现 AnswerabilityJudge
5. 实现 CitationRenderer
6. 实现置信度圆圈输出结构
7. 接入 `/api/tutor/chat`

验收：

- 能回答带知识库证据的问题
- 能展示引用来源
- 没证据时会自动切换到低置信回答
- 前端能显示置信度圆圈

### 第 2 周：增强可信度

任务：

1. 加入 ClaimVerifier 轻量版
2. 新增 `trust_answer_logs`
3. 把 `/api/resources/generate` 接到控制器
4. 加入规则库与场景阈值

验收：

- 回答会自动删掉或弱化无证据结论
- 资源生成场景不再盲目输出

### 第 3 周：评估与优化

任务：

1. 做离线问答样本集
2. 调整阈值
3. 增加教师端可视化统计

验收：

- 可统计高/中/低置信回答占比、引用率、低证据回答率

---

## 13. 验收标准

### 必须满足

1. 知识问答前必须先检索
2. 回答结果必须包含来源
3. 证据不足时不能给强确定性结论
4. 每条回答下方必须展示置信度圆圈

### 建议满足

1. 个性化建议必须引用画像
2. 资源生成必须标记内容来源类型
3. 回答日志可追踪

### 演示用例建议

1. 上传 Python 基础资料，问“什么是函数返回值”
   预期：回答 + 引用资料片段 + 绿色圆圈
2. 不上传资料，问“根据这份讲义帮我总结”
   预期：给出低置信提示型回答，并提示上传资料
3. 已有画像，问“我现在更适合先补什么”
   预期：回答中引用薄弱点和当前阶段
4. 画像为空，问“我最适合的学习路径是什么”
   预期：不输出强个性化结论，只给通用建议，并显示黄色或红色圆圈

---

## 14. 风险与注意事项

### 14.1 不要把 memory 当事实库

记忆系统里很多内容是会话归纳，置信度不一定高。它适合做“偏好、上下文、近期事件”补充，不适合单独支撑知识性事实。

### 14.2 不要只靠相似度阈值

向量召回高分不等于真的能回答。还要看：

- 证据是否覆盖问题核心
- 是否有多个独立片段支持
- 是否只是关键词撞上

### 14.3 不要把低置信做成僵硬失败

在教育场景里，低置信提示要“保守但不打断学习”，所以推荐：

- 不直接沉默
- 给原因
- 给补充动作
- 给可继续提问的方向
- 用统一圆圈等级帮助用户建立预期

### 14.4 报告类生成优先结构化

凡是涉及分数、趋势、次数、阶段判断的内容，先读真实数据，再让模型组织语言。

---

## 15. 建议的首批实现清单

按优先级，不要乱序：

1. 新增 `trust_schemas.py`
2. 新增 `trust_router.py`
3. 新增 `trust_retriever.py`
4. 新增 `trust_judge.py`
5. 新增 `trust_citation.py`
6. 新增 `trust_answer_controller.py`
7. 接入 `backend/app/routes/tutor_eval.py` 的 `/api/tutor/chat`
8. 新增 `trust_answer_logs`
9. 第二阶段再做 `trust_verifier.py`
10. 第三阶段再扩到 `/api/resources/generate` 和报告接口

---

## 16. 结论

对 SparkLearn 来说，防幻觉机制最合适的做法不是再堆一层大模型提示词，而是新增一个 **TrustAnswer Controller**，把“检索、判定、生成、校验、引用、置信度展示”做成后端控制链路。

这套方案与你当前项目是贴合的，因为：

- 你已经有知识库索引能力
- 已经有学习画像和记忆系统
- 已经有智能辅导主链路
- 只缺统一的可信回答编排层

第一阶段只要把：

- RAG 检索
- 引用来源
- 低置信度圆圈提示

三件事做扎实，答辩时就已经能清楚证明“系统具备防幻觉机制”，而不是停留在口头描述。
