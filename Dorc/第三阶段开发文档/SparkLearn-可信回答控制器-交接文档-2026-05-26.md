# SparkLearn 可信回答控制器交接文档（2026-05-26）

## 1. 本次交接范围

本次交接只覆盖一件事：

- 为 SparkLearn 第三阶段补一套“可信回答控制器 TrustAnswer Controller”的方案文档
- 并将原来的“资料不足拒答”产品思路，改成“回答下方显示置信度小圆圈”的标准体系

本次 **没有落后端代码**，当前完成的是方案设计和交接材料，便于下一位 Agent 直接进入实现。

---

## 2. 已完成内容

已新增并更新以下核心文档：

1. [SparkLearn-第三阶段-可信回答控制器与防幻觉机制开发文档.md](D:\Project_building\SparkLearn\Dorc\第三阶段开发文档\SparkLearn-第三阶段-可信回答控制器与防幻觉机制开发文档.md)

这份文档已经完成以下改造：

- 定义了 `TrustAnswerController` 的 6 个模块
  - `QueryRouter`
  - `EvidenceRetriever`
  - `AnswerabilityJudge`
  - `GroundedGenerator`
  - `ClaimVerifier`
  - `CitationRenderer`
- 明确接入点优先级
  - `/api/tutor/chat`
  - `/api/resources/generate`
  - `/api/report/ai-summary`
- 把原来的“拒答逻辑”改成了“低置信度降级回答”
- 建立了前端统一展示的置信度圆圈标准

---

## 3. 当前最终产品方向

这一点非常关键，下一位 Agent 不要再回退到“拒绝回答”方案。

### 当前确定的产品策略

不是：

- 资料不足时直接拒答

而是：

- 资料不足时仍然回答
- 但回答必须降级为“低置信度模式”
- 在回答下方展示一个小圆圈，告诉用户当前回答可信程度
- 同时补一句说明文案，帮助用户理解为什么是这个等级

### 当前确定的三档标准

1. `green`
   - 等级：高置信
   - 分数：`0.80 - 1.00`
   - 文案：`已基于课程资料和学习记录回答`

2. `yellow`
   - 等级：中置信
   - 分数：`0.55 - 0.79`
   - 文案：`已结合部分资料回答，建议继续核对`

3. `red`
   - 等级：低置信
   - 分数：`0.00 - 0.54`
   - 文案：`当前证据不足，以下回答仅供参考`

这三档标准已经写入主方案文档，后续实现应保持一致。

---

## 4. 已确认的技术方向

### 4.1 不是纯 Prompt 方案

当前方向不是再写一段更强的提示词，而是增加后端控制层。

建议新增模块：

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

### 4.2 优先接入现有链路

当前代码现状已经查过，下一位 Agent 可以直接复用：

- 知识库检索：
  [knowledge.py](D:\Project_building\SparkLearn\backend\app\routes\knowledge.py)
  重点函数：`retrieve_knowledge_context_async()`
- 画像：
  [profile.py](D:\Project_building\SparkLearn\backend\app\routes\profile.py)
- 记忆：
  [memory_engine.py](D:\Project_building\SparkLearn\backend\app\memory_engine.py)
- 智能辅导主链路：
  [tutor_eval.py](D:\Project_building\SparkLearn\backend\app\routes\tutor_eval.py)
  重点接口：`/api/tutor/chat`
- 资源生成：
  [resources.py](D:\Project_building\SparkLearn\backend\app\routes\resources.py)

### 4.3 第一优先接入点

下一位 Agent 应优先改：

- `backend/app/routes/tutor_eval.py`

原因：

- 这里已经有会话、文件召回、画像摘要、memory 注入
- 最适合先接 `TrustAnswerController`
- 也是答辩最容易演示的主场景

---

## 5. 当前文档里已经定死的接口方向

下一位 Agent 实现时，建议沿用这些字段，不要另起一套名字。

### 内部判断结果

```python
class AnswerabilityDecision(BaseModel):
    confidence_score: float
    confidence_level: str
    response_mode: str
    reason_codes: list[str]
    missing_requirements: list[str]
    suggested_user_action: str = ""
```

### 最终返回结果

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

### 前端圆圈结构

```json
{
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

## 6. 当前没有做的事

以下内容 **还没开始实现**：

- `trust_*` 模块代码
- `/api/tutor/chat` 的后端接入
- `confidence` SSE 事件输出
- 前端小圆圈组件
- `trust_answer_logs` 表
- `ClaimVerifier` 代码

所以当前状态是：

- 方案文档完成
- 产品表达方向确定
- 实现还没开始

---

## 7. 下一位 Agent 的建议执行顺序

不要重新讨论方案，直接按下面顺序做：

1. 新建 `backend/app/trust_schemas.py`
2. 新建 `backend/app/trust_rules.py`
3. 新建 `backend/app/trust_router.py`
4. 新建 `backend/app/trust_retriever.py`
5. 新建 `backend/app/trust_judge.py`
6. 新建 `backend/app/trust_citation.py`
7. 新建 `backend/app/trust_answer_controller.py`
8. 把 `/api/tutor/chat` 接到控制器
9. 给 SSE 增加 `confidence` / `trust_meta` / `citations`
10. 再做前端回答下方的小圆圈 UI

---

## 8. 实现时的关键约束

### 不要做的事

- 不要再回到“资料不足直接拒答”
- 不要把 memory 当成强事实证据
- 不要只凭一个向量分数就判高置信
- 不要把前端圆圈做成孤立视觉组件，必须绑定真实后端分数

### 必须保持的事

- 先检索，再回答
- 先打分，再展示置信度
- 证据不足时，回答必须降级语气
- 回答下方必须有引用和置信度说明

---

## 9. 推荐的第一版最小实现

为了尽快跑通演示，建议下一位 Agent 第一版只做：

1. 知识库证据检索
2. 画像摘要注入
3. 三档置信度打分
4. `/api/tutor/chat` 输出 `confidence`
5. 前端显示小圆圈

先不要一上来做复杂版 `ClaimVerifier`。

第一版目标是能演示：

- 有资料时：绿色或黄色圆圈
- 没资料时：红色圆圈
- 同时能看到引用来源

---

## 10. 本次变更说明

本次没有改业务代码，只新增/更新了文档。

本次真正完成的文件：

1. [SparkLearn-第三阶段-可信回答控制器与防幻觉机制开发文档.md](D:\Project_building\SparkLearn\Dorc\第三阶段开发文档\SparkLearn-第三阶段-可信回答控制器与防幻觉机制开发文档.md)
2. [SparkLearn-可信回答控制器-交接文档-2026-05-26.md](D:\Project_building\SparkLearn\Dorc\第三阶段开发文档\SparkLearn-可信回答控制器-交接文档-2026-05-26.md)

---

## 11. 一句话交接结论

当前已经把 SparkLearn 的防幻觉方案从“拒答机制”改成了“可信回答 + 置信度圆圈”体系，主文档已完成，下一位 Agent 应直接进入 `/api/tutor/chat` 的后端实现，不需要再重新讨论产品方向。
