# SparkLearn 个性化画像采集文档

- 文档日期：2026-05-29
- 适用范围：`backend/app/routes/profile.py` 及所有相关模块当前实现
- 文档目的：完整说明 SparkLearn 平台如何从零开始采集、构建并持续更新学习者个性化画像的全链路机制

---

## 1. 画像体系概述 ✅

### 1.1 画像在学习闭环中的核心位置

SparkLearn 的个性化学习闭环由七个环节构成：**画像构建 → 路径规划 → 资源生成 → 学习互动 → 练习评测 → 反馈报告 → 画像更新**。画像作为整个闭环的第二个环节，承接用户初始信息采集，并直接驱动后续路径规划与资源生成两大核心功能模块。没有画像，学习路径就是无源之水；画像不准确，资源推荐就变成无的放矢。

在系统运行中，路径规划模块（`backend/app/routes/path_planning.py`）读取 `profile_snapshot.json` 中的 `goal`、`knowledge_level`、`current_stage` 字段来生成学习阶段与知识树结构；资源生成模块（`backend/app/routes/resources.py`）依据 `weak_points` 和 `learning_preference` 来决定生成什么类型、什么难度的资源。因此，画像的质量直接决定了整个学习体验的个性化程度。

### 1.2 "随学随新"原则的具体含义

"随学随新"是 SparkLearn 画像系统的核心设计原则，其含义是：**用户的每一次学习行为都会触发画像的微调，画像始终反映用户最新的学习状态，而非一成不变的初始设定。** 具体而言：

- 辅导对话结束后，`update_memory_from_turn()`（`backend/app/memory_engine.py` 第383行）自动从对话文本中抽取目标、偏好、约束等语义信息，更新 semantic memory，并同步写入 `memory_store.json`；
- 练习提交后，`_update_mastery()`（`backend/app/routes/quiz.py` 第808行）更新 `mastery_records` 表中的知识点掌握分数，系统通过掌握度的变化间接影响画像中 `current_stage` 的推进与回退判断；
- 每次手动编辑画像或建档操作都会触发 `version + 1` 的递增，确保每一次画像变更都可追溯到具体事件。

这一原则与赛题要求高度一致，确保系统不是"一次画像、终身不变"，而是动态贴合学习者的真实变化。

### 1.3 记忆层已重写适配个性化采集 ✅

在第三阶段开发中（文档参考：`Dorc/第三阶段开发文档/SparkLearn-第三阶段-画像采集与记忆系统及上下文工程设计说明.md`），记忆引擎 `memory_engine.py` 经过完整重写，其 semantic memory 结构新增了对画像相关字段的原生支持。具体表现为：

- `semantic.goals` 数组：对应画像中的 `goal` 字段，存储学习者的长期目标描述；
- `semantic.preferences` 数组：对应画像中的 `learning_preference`，存储学习偏好特征；
- `semantic.constraints` 数组：对应时间约束与学习条件限制，与画像的 `daily_time` 字段联动；
- `semantic.facts` 数组：存储用户主动要求记住的事实信息；
- `semantic.skills` 数组：存储已掌握的技能标签；
- `semantic.weak_points` 数组：对应画像中的 `weak_points`，存储薄弱知识点；
- `semantic.learning_stage` 字符串：对应画像中的 `current_stage`，记录当前所处的学习阶段。

这些字段由 `_default_memory()` 函数（第17行）初始化，在 `load_user_memory()`（第75行）加载，在 `update_memory_from_turn()`（第383行）中自动更新，形成了与画像系统的深度绑定关系。

### 1.4 画像的双向作用：决策依据与反馈落脚点

画像在 SparkLearn 中承担双向作用。**正向作用**：Agent 在每次对话、路径规划、资源生成前，通过 `build_injected_context()`（`memory_engine.py` 第357行）将画像信息注入系统 prompt，作为 Agent 决策的核心依据。在 Tutor 辅导场景中，`tutor_eval.py` 第521行调用 `build_injected_context()` 将记忆上下文拼入 `memory_prompt`，再与角色上下文（`_build_role_prompt`）和页面上下文（`_build_page_context_prompt`）合并后送入大模型。

**反向作用**：学习行为的结果通过事件流反哺画像。例如，练习提交后 `quiz_records.json` 记录了每题的正确率，系统通过 `_update_mastery` 调整掌握度分数；随后在画像分析中，如果某知识点掌握度连续低于阈值，系统会将其标记为 `weak_points` 候选并更新画像。这使得画像不仅是决策的起点，也是学习效果反馈的最终落脚点。

---

## 2. 采集方式（详细说明） ✅

SparkLearn 当前支持四种画像采集方式，覆盖了从首次建档到日常学习中自动更新的完整场景。所有采集接口均定义在 `backend/app/routes/profile.py` 中，画像写入统一经过 `_upsert_profile()` 函数落库。

### 2.1 问卷建档 | POST /api/profile/onboarding ✅

**请求模型**

问卷建档接口接收 `ProfileOnboardingReq` 请求体（`profile.py` 第27-32行），包含五个字段：

```python
class ProfileOnboardingReq(BaseModel):
    goal: list[str] = []        # 学习目标（多选标签）
    level: list[str] = []       # 编程基础水平
    weak: list[str] = []        # 薄弱环节/需加强方向
    preference: list[str] = []  # 学习偏好
    time: list[str] = []        # 每日学习时间
```

前端通过 `/onboarding` 页面（`frontend/src/app/onboarding/page.tsx`）收集用户的五步选择，最终在 `submitOnboarding()` 函数（第265行）中调用此接口提交。

**处理函数**

接口内部调用 `_build_profile_from_onboarding(req)`（第221行）将前端传入的多选标签数组映射为标准画像字段：

- `goal`：直接映射为 `req.goal`，默认值为 `["期末提分"]`
- `knowledge_level`：取 `req.level[0]`，默认值为 `"有一些基础"`
- `weak_points`：映射为 `req.weak`，默认值为 `["函数"]`
- `learning_preference`：映射为 `req.preference`，默认值为 `["实践型"]`
- `cognitive_style`：当前固定为 `"归纳型"`（尚未从前端采集）
- `daily_time`：通过 `_parse_daily_time()`（第252行）将时间标签（如 `"30-60分钟"`、`"2小时以上"`）转为整数分钟数
- `practical_ability`：当前固定为 `"能独立完成小项目"`
- `current_stage`：当前固定为 `"函数与模块"`
- `version`：初始化为 1

**落库路径**

一次完整的问卷建档涉及三次写入操作（`onboarding()` 函数第52-56行）：

1. `_upsert_profile(profile)` → SQLite `profiles` 表（通过 INSERT ON CONFLICT 实现 upsert）
2. `_write_profile_snapshot(profile)` → `profile_snapshot.json`（JSON 格式的完整画像快照）
3. `append_jsonl(..., "learning_events.jsonl", {"type": "profile_onboarding", ...})` → `learning_events.jsonl`（事件日志流）

最终返回 `{"version": 1, "message": "onboarding profile saved"}`。

### 2.2 对话建档 | POST /api/profile/initiate + /api/profile/chat ✅

**会话管理机制**

对话建档采用两阶段接口设计。首先调用 `POST /api/profile/initiate`（第59行）创建会话：

```python
session_id = f"sess_{uuid.uuid4().hex[:8]}"
_sessions[session_id] = {"round": 1, "messages": []}
```

会话以 `session_id` 为键存储在 `_sessions` 内存字典中（第19行），不持久化到数据库或文件。每个会话包含两个字段：`round` 记录当前轮次（1-3），`messages` 暂存用户与助手的对话消息数组。首次调用返回 `session_id`、引导语（`"你好，我是小星同学。请先告诉我你的专业和当前学习目标。"`）、当前轮次和总轮次。

**3轮对话机制**

随后前端通过 `POST /api/profile/chat`（第73行）逐轮发送用户消息。`chat()` 函数将每条用户消息追加到 `session["messages"]` 中，然后对用户最近的输入通过 `spark_lite.stream_chat_events()` 调用讯飞星火 Lite 模型生成自然语言回复（第83行）。模型回复以 SSE 流式返回给前端，前端在 `<MessageBubble>` 组件中展示。

**画像抽取**

当 `round_no` 超过 3（即三轮对话完成后），系统触发 `_build_profile_from_dialog(session["messages"])`（第91行）从对话历史中抽取画像特征。当前实现（第236-249行）采用规则匹配策略：

```python
def _build_profile_from_dialog(messages: list[dict[str, Any]]) -> dict[str, Any]:
    joined = " ".join(m["content"] for m in messages if m["role"] == "user")
    return {
        "goal": ["竞赛准备"] if "竞赛" in joined else ["期末提分"],
        "knowledge_level": "有一些基础",
        "weak_points": ["函数", "面向对象"],
        "learning_preference": ["实践型", "视觉型"],
        "cognitive_style": "归纳型",
        "daily_time": 60,
        "practical_ability": "能独立完成小项目",
        "current_stage": "函数与模块",
        "version": 1,
        "updated_at": now_iso(),
    }
```

对话建档完成后的落库流程与问卷建档一致：`_upsert_profile` → `_write_profile_snapshot` → `append_jsonl`，事件类型为 `profile_dialog_completed`。完成后 `_sessions` 中对应的会话数据被释放（`_sessions.pop(req.session_id, None)`），以控制内存占用。

**对话建档的当前边界**

第三阶段开发文档（`SparkLearn-第三阶段-画像采集与记忆系统及上下文工程设计说明.md` 第189行）明确指出，当前对话建档的画像抽取规则仍偏模板化，`_build_profile_from_dialog` 中的规则较简单（仅通过关键词 `"竞赛"` 判断目标），尚未实现基于 LLM 的结构化 JSON Schema 抽取。后续版本可将此函数升级为调用大模型从对话文本中提取结构化画像字段并附加置信度评分。

### 2.3 手动编辑 | PUT /api/profile ✅

**请求模型**

`ProfileUpdateReq`（第35-47行）支持对全部画像字段的可选更新，所有字段均为可选的（`Optional`）：

```python
class ProfileUpdateReq(BaseModel):
    name: str | None = None            # 姓名（students 表）
    email: str | None = None           # 邮箱（students 表）
    major: str | None = None           # 专业（students 表）
    grade: str | None = None           # 年级（students 表）
    goal: list[str] | None = None      # 学习目标（profiles 表）
    knowledge_level: str | None = None # 知识水平（profiles 表）
    weak_points: list[str] | None = None  # 薄弱点（profiles 表）
    learning_preference: list[str] | None = None  # 学习偏好（profiles 表）
    cognitive_style: str | None = None    # 认知风格（profiles 表）
    daily_time: int | None = None         # 每日学习时长（profiles 表）
    practical_ability: str | None = None  # 实践能力（profiles 表）
    current_stage: str | None = None      # 当前阶段（profiles 表）
```

**双表更新机制**

`update_profile()` 函数（第116-164行）将请求体拆分为两部分处理：

1. **身份字段更新**（第121-151行）：`name`、`email`、`major`、`grade` 写入 `students` 表。通过 `req.model_dump(include={...}, exclude_none=True)` 提取身份相关字段，先读取当前 `students` 记录构建合并后的 `next_student` 对象，再执行 `UPDATE students SET name=?, email=?, major=?, grade=?, updated_at=? WHERE user_id=?`。

2. **画像字段更新**（第153-164行）：其余字段写入 `profiles` 表。通过 `req.model_dump(exclude={...}, exclude_none=True)` 提取画像相关字段，与当前画像合并后调用 `_upsert_profile()` 更新。

**版本控制**

每次手动编辑都会触发 `profile["version"] = int(profile.get("version", 1)) + 1`，即 `version + 1`。这一机制确保了画像的每一次变更都有明确的版本号，配合 `learning_events.jsonl` 中的 `profile_updated` 事件记录，可以完整追溯到每次编辑的时间、变更内容与版本序列。

### 2.4 学习行为自动更新 ✅

SparkLearn 的画像系统并非仅在显式建档或手动编辑时才更新。在日常学习过程中，系统通过两种机制自动触发画像的增量更新。

**辅导对话后的记忆更新**

在 Tutor 辅导场景中（`backend/app/routes/tutor_eval.py` 第785-790行），每次用户-助手的完整对话回合结束后，系统自动调用 `update_memory_from_turn()`：

```python
memory_update = update_memory_from_turn(
    user_id=settings.single_user_id,
    user_message=req.message,
    assistant_message=answer,
    page_context=req.page_context,
)
```

`update_memory_from_turn()`（`memory_engine.py` 第383-436行）执行以下操作：

1. 将当前用户问题存入 working memory（`memory_type="working"`），标签 `current_turn`；
2. 将问答对存入 episodic memory（`memory_type="episodic"`），标签 `qa_event`；
3. 通过正则表达式从用户消息中抽取关键信息：
   - 目标识别：`re.search(r"(?:目标|想要|希望|计划|打算)(?:是|为|:)?(.{2,50})", text)` → 追加到 `semantic.goals`
   - 偏好识别：`re.search(r"(?:我喜欢|偏好|更希望)(.{2,50})", text)` → 追加到 `semantic.preferences`
   - 约束识别：`re.search(r"(?:每天|每周).{0,12}(?:分钟|小时)", text)` → 追加到 `semantic.constraints`
   - 事实记忆：`re.search(r"(?:记住|请记住|帮我记住)(.{2,80})", text)` → 追加到 `semantic.facts`
4. 若 semantic memory 有变化，`version + 1` 并写回 `memory_store.json`；
5. 同时追加 `learning_events.jsonl` 中类型为 `memory_updated` 的事件记录（tutor_eval.py 第791-800行）。

**练习提交后的掌握度更新**

在练习评测场景中（`backend/app/routes/quiz.py` 第808-820行），每次提交答案后会调用 `_update_mastery(kp_id, delta)`：

- 答对：`delta = +0.05`（掌握度微增）
- 答错：`delta = -0.03`（掌握度微降）

掌握度的变化虽然不直接写入 `profiles` 表，但会通过以下路径间接影响画像：

1. `quiz_records` → `mastery_records` 表面更新；
2. 后续在路径规划、报告生成、画像分析中，系统读取 `mastery_records` 中的薄弱知识点；
3. 如果某知识点分数持续低于阈值（当前约为 0.5 以下），该知识点会出现在 `weakest_mastery_points` 列表中，成为更新 `weak_points` 的候选依据。

---

## 3. 画像字段定义 ✅

SparkLearn 的学习者画像分布在两张数据库表中 —— `students` 表负责存储身份信息，`profiles` 表负责存储学习画像。两张表通过 `user_id` 建立关联。表结构定义位于 `backend/app/db.py` 第36-58行的 `init_db()` 函数中。

### 3.1 students 表（身份信息字段）

`students` 表（db.py 第36-44行）存储学习者的基本身份信息：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `user_id` | TEXT PRIMARY KEY | — | 用户唯一标识，当前固定为 `"single_user"` |
| `name` | TEXT | `""` | 学生姓名，初始默认值 `"张同学"` |
| `email` | TEXT | `""` | 电子邮箱，初始默认值 `"student@sparklearn.ai"` |
| `major` | TEXT | `""` | 专业名称，初始默认值 `"计算机科学"` |
| `grade` | TEXT | `""` | 年级，初始默认值 `"大二"` |
| `created_at` | TEXT | — | 记录创建时间（ISO 8601 格式） |
| `updated_at` | TEXT | — | 记录最后更新时间（ISO 8601 格式） |

students 表的初始种子数据由 db.py 第350-355行的 `INSERT OR IGNORE` 语句插入。email 字段为后期新增，由 `_ensure_student_columns()` 函数（第393-396行）通过 `ALTER TABLE` 迁移添加，兼容旧版本数据库。

### 3.2 profiles 表（画像核心字段详解）

`profiles` 表（db.py 第46-58行）存储全部学习画像字段：

**goal（JSON 数组，学习目标）**

存储为 TEXT 类型的 JSON 数组，如 `["期末提分", "竞赛准备"]`。在 `_row_to_profile()` 中通过 `json.loads(row["goal"] or "[]")` 反序列化（第209行），在 `_upsert_profile()` 中通过 `json.dumps(..., ensure_ascii=False)` 序列化（第188行）。该字段直接用于路径规划模块生成学习阶段目标和资源生成模块确定内容方向。

**knowledge_level（知识水平等级）**

TEXT 类型，描述学习者当前的整体知识水平。可选值包括但不限于：`"零基础"`、`"入门阶段"`、`"有一些基础"`、`"有一定基础"`、`"基础较好"`。该字段影响资源生成的难度梯度和路径规划的起始节点。在前端 `/onboarding` 页面中，第二个步骤的选项卡片（`level` 步骤，onboarding/page.tsx 第63-69行）对应此字段的采集。

**weak_points（JSON 数组，薄弱知识点）**

TEXT 类型的 JSON 数组，如 `["函数", "面向对象", "闭包"]`。存储学习者当前需要重点加强的知识点列表。该字段由初始建档设定，后续通过练习评测的 `mastery_records` 中分数较低的知识点自动补充。在 Tutor 辅导场景中，`build_injected_context()`（memory_engine.py 第370-371行）将薄弱点注入系统 prompt，引导 AI 针对性地加强薄弱环节讲解。

**learning_preference（JSON 数组，学习偏好类型）**

TEXT 类型的 JSON 数组，如 `["视觉型", "实践型", "互动型"]`。描述学习者偏好的学习方式。可选值包括：`"视觉型"`（偏好视频教程）、`"阅读型"`（偏好文档阅读）、`"实践型"`（偏好动手实践）、`"互动型"`（偏好交流讨论）。该字段直接影响资源生成模块输出的内容形式（视频/文档/代码案例/互动问答）。在前端 `/onboarding` 页面中，第四个步骤（`preference` 步骤）的卡片选项与此字段对应。

**cognitive_style（认知风格）**

TEXT 类型。描述学习者的认知处理风格。当前默认值为 `"归纳型"`，表示从具体实例中总结规律的学习方式。该字段目前尚未在 UI 层面完整暴露给用户自行选择，在 `_build_profile_from_onboarding()` 和 `_build_profile_from_dialog()` 中均硬编码为 `"归纳型"`。未来可扩展为从用户答题模式中推断认知风格，并提供给资源生成模块调节内容呈现方式。

**daily_time（每日学习时长，分钟）**

INTEGER 类型，默认值 60（分钟）。描述学习者每天可投入的学习时间。在问卷建档中通过 `_parse_daily_time()`（profile.py 第252-259行）将前端标签转换为整数值：

- `"30-60分钟"` → 45 分钟
- `"1-2小时"` → 90 分钟
- `"2小时以上"` → 150 分钟
- 其他情况 → 30 分钟（默认）

该字段用于路径规划模块计算任务颗粒度，确保每日任务量与用户可用时间匹配。

**practical_ability（实践能力）**

TEXT 类型。描述学习者的实际动手能力水平。当前默认值为 `"能独立完成小项目"`，硬编码于画像构建函数中。该字段在路径规划中用于判断是否适合进入项目实战阶段。

**current_stage（当前学习阶段）**

TEXT 类型。描述学习者当前所处的学习具体阶段。默认值为 `"函数与模块"`。该字段与路径规划模块紧密耦合：`/api/path-planning/generate` 接口读取此字段作为当前节点位置，路径模块根据掌握度变化决定向下一阶段推进或回退到前一阶段。在报告模块中，当前阶段也是分析学习进度的重要参考坐标。

---

## 4. 采集流程详解 ✅

本章节深入说明三种主要采集路径的完整数据流，从前端发起到后端落库，再到事件记录的端到端过程。

### 4.1 问卷建档完整流程 ✅

问卷建档是 SparkLearn 最主要的初始画像采集通道。其完整数据流如下：

**第一步：前端交互**

用户在 `/onboarding` 页面（`frontend/src/app/onboarding/page.tsx`）依次完成 5 个步骤的选择：

1. **学习目标**（`goal` 步骤，第46-58行）：卡片选项包括"掌握核心技能"、"准备找工作"、"项目实战能力"、"兴趣探索"，支持单选；
2. **编程基础**（`level` 步骤，第59-70行）：卡片选项为"零基础"、"入门阶段"、"有一定基础"、"基础较好"，支持单选；
3. **薄弱环节**（`weak` 步骤，第71-78行）：标签选项为"语法与数据结构"、"项目实战经验"、"高级设计能力"、"编程语言实践"、"其他方面"，支持多选；
4. **学习偏好**（`preference` 步骤，第79-91行）：卡片选项为"视频教程"、"文档阅读"、"动手实践"、"互动交流"，支持多选；
5. **学习时间**（`time` 步骤，第92-99行）：标签选项为"5小时以下"、"5-10小时"、"10-20小时"、"20小时以上"，仅支持单选。

每步选择后，前端通过 `confirmSelection()` 函数（第190行）将选中项添加到消息列表中，并通过步骤指示器（第294-326行）展示当前进度。第五步完成后调用 `submitOnboarding()` 函数（第265行）。

**第二步：API 请求提交**

`submitOnboarding()` 函数组装请求体并发送到后端：

```typescript
const body = {
  goal: selections[0] || [],
  level: selections[1] || [],
  weak: selections[2] || [],
  preference: selections[3] || [],
  time: selections[4] || [],
}
await fetch(`${NEXT_PUBLIC_API_BASE_URL}/api/profile/onboarding`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
```

**第三步：后端处理**

`backend/app/routes/profile.py` 中的 `onboarding()` 函数（第50-56行）按以下顺序执行：

1. `_build_profile_from_onboarding(req)` → 将前端传入的多选标签数组映射为标准化画像字典
2. `_upsert_profile(profile)` → 通过 INSERT ON CONFLICT 将画像写入 SQLite `profiles` 表
3. `_write_profile_snapshot(profile)` → 通过 `write_json()` 将完整画像写入 `profile_snapshot.json`
4. `append_jsonl(...)` → 在 `learning_events.jsonl` 中追加类型为 `profile_onboarding` 的事件记录

**第四步：返回与跳转**

后端返回 `{"version": profile["version"], "message": "onboarding profile saved"}`。前端接收到响应后，展示完成动画（"正在为你生成个性化学习方案"），并在约 1.5 秒后通过 `router.push('/')` 跳转回首页，完成建档闭环。

### 4.2 对话建档完整流程 ✅

对话建档是问卷建档的补充通道，适用于不擅长填写问卷的学习者。其完整数据流如下：

**第一阶段：初始化会话**

前端调用 `POST /api/profile/initiate`。后端 `initiate()` 函数（profile.py 第59-70行）创建新的会话对象：

```python
session_id = f"sess_{uuid.uuid4().hex[:8]}"
_sessions[session_id] = {"round": 1, "messages": []}
```

返回给前端 `session_id`、首轮引导语、当前轮次（1）和总轮次（3）。引导语为系统预设的开场白，询问用户的专业和学习目标。

**第二阶段：第一轮对话**

前端展示引导语后，用户输入第一轮回答。前端调用 `POST /api/profile/chat`，传入 `session_id` 和用户的 `message`。后端：

1. 将用户消息追加到 `session["messages"]`，格式为 `{"role": "user", "content": ..., "ts": now_iso()}`
2. 取最近 6 条消息构建 `history_for_model`
3. 调用 `spark_lite.stream_chat_events()` 通过 SSE 流式返回助手回复
4. `round_no += 1` 递增轮次
5. 如果 `round_no <= 3`，返回 `{"round": 2, "total_rounds": 3, "profile_saved": false}`，指示前端继续对话

**第三阶段：第二、三轮对话**

与第一轮流程相同，系统继续通过 `spark_lite` 生成贴合用户回答的追问回复，引导用户逐步暴露更多学习相关特征。每轮对话的消息都累积在 `session["messages"]` 中。

**第四阶段：画像抽取与落库**

当 `round_no > 3`（即第三轮完成后），触发画像抽取：

```python
profile = _build_profile_from_dialog(session["messages"])
```

`_build_profile_from_dialog()` 将所有用户消息文本拼接后通过关键词匹配抽取画像字段。抽取完成后的落库流程与问卷建档完全一致：`_upsert_profile` → `_write_profile_snapshot` → `append_jsonl`（事件类型为 `profile_dialog_completed`）。

**第五阶段：会话释放**

画像写入完成后，系统通过 `_sessions.pop(req.session_id, None)` 释放该会话占用的内存，确保 `_sessions` 字典不会无限增长。同时向前端 SSE 流返回 `{"done": {"round": 3, "total_rounds": 3, "profile_saved": true}}`，标记对话建档完成。

### 4.3 画像更新事件流（学习行为驱动） ✅

画像更新事件流描述了从学习行为到画像字段变更的完整传递链路。这一链路体现了 SparkLearn "随学随新"的设计原则。

**Tutor 对话结束后的更新链路**

1. **行为发生**：用户在辅导页面与 AI 导师进行问答交互（`POST /api/tutor/chat`）
2. **对话存储**：用户消息与助手回复写入 `tutor_messages` 表（tutor_eval.py 第730-773行）
3. **事件追加**：`append_jsonl(... "learning_events.jsonl" {"type": "tutor_chat"})`（tutor_eval.py 第775-783行）
4. **记忆更新**：`update_memory_from_turn()` 调用（tutor_eval.py 第785-790行），从用户消息中抽取目标、偏好、约束、事实四类信息，更新 `semantic memory` 对应数组
5. **画像同步**：semantic memory 中的 `goals`、`preferences`、`weak_points`、`learning_stage` 等字段与 `profiles` 表及 `profile_snapshot.json` 通过 `build_injected_context()` 在下次对话时注入上下文，形成持续联动

**练习提交后的更新链路**

1. **行为发生**：用户提交练习答案（`POST /api/quiz/submit`，quiz.py 对应路由）
2. **判题记录**：验证答案正确性，写入 `quiz_records.json`
3. **事件追加**：`append_jsonl(... "learning_events.jsonl" {"type": "submit_quiz"})`（quiz.py 第254-256行）
4. **掌握度更新**：`_update_mastery(kp_id, delta)`（quiz.py 第808-820行），`delta = +0.05`（答对）/ `-0.03`（答错）
5. **画像间接影响**：后续在路径规划或报告生成时，读取 `mastery_records` 中掌握度最低的知识点，作为 `weak_points` 和 `current_stage` 调整的依据

---

## 5. 数据存储 ✅/🔲

SparkLearn 的画像数据采用"结构化数据库 + 文件快照 + 事件流 + 记忆存储"四层存储架构，每种存储形式承担不同的职责。当前实现中，SQLite 为实际使用的结构化存储，文件系统存储均已正常运行；PolarDB PostgreSQL 迁移为待实现规划。

### 5.1 SQLite profiles 表（✅ 当前）→ 🔲 PolarDB PostgreSQL 迁移

当前画像核心数据存储于 SQLite 数据库文件 `backend/data/db/sparklearn.db` 中的 `profiles` 表。该数据库路径由 `backend/app/config.py` 第90行的 `db_path` 配置项定义。SQLite 的优势是零配置、便携性强，适合当前单用户开发和演示阶段。所有画像的增删改查操作通过 `backend/app/db.py` 中的 `execute()`、`fetch_one()`、`fetch_all()` 三个封装函数完成，上层 `profile.py` 不直接操作数据库连接，实现了较好的数据访问层抽象。

🔲 **待实现**：随着系统向多用户 SaaS 平台演进，计划将 SQLite 替换为 PolarDB PostgreSQL。这一迁移的技术基础已经具备：数据库操作已通过 `db.py` 中的统一封装函数隔离，上层路由代码不直接依赖 SQLite 特有的语法。迁移时仅需修改 `db.py` 中的连接方式（从 `sqlite3.connect` 切换到 PostgreSQL 连接池），业务层的画像采集逻辑无需重写。

### 5.2 profile_snapshot.json（JSON，完整画像快照）✅

`profile_snapshot.json` 是布局在 `backend/data/users/{user_id}/profile_snapshot.json` 的完整画像快照文件。由 `_write_profile_snapshot()` 函数（profile.py 第262-263行）将画像字典通过 `write_json()` 持久化为格式化的 JSON 文件。

```python
def _write_profile_snapshot(profile: dict[str, Any]) -> None:
    write_json(settings.single_user_id, "profile_snapshot.json", profile)
```

`write_json()` 函数（`backend/app/storage.py` 第22-24行）使用 `json.dumps(payload, ensure_ascii=False, indent=2)` 写入，确保中文字符正常显示和人类可读的缩进格式。该快照文件的作用是为路径规划、资源生成、报告生成等模块提供无需查询数据库即可快速读取的画像数据副本，同时作为画像状态的备份，在数据库异常时可作为恢复依据。

### 5.3 learning_events.jsonl（JSONL，事件流）✅

`learning_events.jsonl` 是布局在 `backend/data/users/{user_id}/learning_events.jsonl` 的事件日志文件。通过 `append_jsonl()` 函数（`backend/app/storage.py` 第27-31行）以追加模式写入，每条记录为一行 JSON：

```python
def append_jsonl(user_id: str, filename: str, record: dict[str, Any]) -> None:
    path = _user_dir(user_id) / filename
    line = json.dumps({"ts": now_iso(), **record}, ensure_ascii=False)
    with path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
```

每条事件记录自动附加 `ts` 时间戳字段。画像相关的事件类型包括：

- `profile_onboarding`：问卷建档完成（profile.py 第55行）
- `profile_dialog_completed`：对话建档完成（profile.py 第94-98行）
- `profile_updated`：手动编辑画像（profile.py 第159-163行，包含变更 patch 信息）
- `tutor_chat`：辅导对话完成（tutor_eval.py 第775-783行）
- `memory_updated`：记忆更新（tutor_eval.py 第791-800行）
- `submit_quiz`：练习提交（quiz.py 第254-256行）

JSONL 格式的优势是：可流式追加、可逐行解析、无需全量加载即可查看最近事件，适合作为行为审计和画像变更溯源的基本数据源。

### 5.4 memory_store.json → ["semantic"] ✅

`memory_store.json` 是布局在 `backend/data/users/{user_id}/memory_store.json` 的分层记忆存储文件。由 `memory_engine.py` 中的 `load_user_memory()`（第75行）和 `save_user_memory()`（第137行）管理。

semantic memory 作为记忆存储的第二层，包含七个与画像直接关联的子字段：

| semantic 字段 | 对应画像字段 | 数据形态 | 说明 |
|--------------|------------|---------|------|
| `goals` | `goal` | 字符串数组 | 长期学习目标描述，由正则抽取或手动写入 |
| `preferences` | `learning_preference` | 字符串数组 | 学习偏好特征，从用户消息中识别 |
| `constraints` | `daily_time` 等 | 字符串数组 | 时间约束和学习条件限制 |
| `facts` | — | 字符串数组 | 用户主动要求记住的事实性信息 |
| `skills` | — | 字符串数组 | 已掌握的技能标签 |
| `weak_points` | `weak_points` | 字符串数组 | 薄弱知识点，与画像和掌握度双向映射 |
| `learning_stage` | `current_stage` | 字符串 | 当前所处的学习阶段 |

这些字段通过 `_default_memory()` 初始化（第17-33行），在 `update_memory_from_turn()` 中自动更新（第383-436行），在 `build_injected_context()` 中格式化后注入 Tutor 对话的系统 prompt（第357-380行）。semantic memory 与 `profiles` 表形成互补：profiles 表提供结构化的查询和版本控制，semantic memory 提供自然语言化的上下文注入能力。

---

## 6. 前端交互说明 ✅

前端部分提供了两种画像采集的用户交互界面，以及画像编辑的通用组件。所有前端代码位于 `frontend/src/app/` 目录下，API 类型定义集中于 `frontend/src/lib/api/types.ts`。

### 6.1 /onboarding 页面：问卷式建档 UI ✅

`/onboarding` 页面（`frontend/src/app/onboarding/page.tsx`）采用类聊天界面的问卷引导流程。页面核心组件和交互逻辑如下：

**步骤指示器**（第294-326行）：页面顶部展示 5 个步骤的进度条，每个步骤由一个圆形序号和步骤名称组成。已完成步骤显示为绿色（`#34c759`）并带有 `CheckCircle2` 对勾图标，当前步骤显示为蓝色（`#2563eb`），未完成步骤显示为灰色（`#94a3b8`）。步骤之间通过线段连接器分隔。

**对话气泡**（`MessageBubble` 组件，第498-522行）：助手消息显示为左侧带 `SpriteAvatar` 精灵头像的浅色气泡（`bg-[#f8fafc]`），用户消息显示为右侧蓝色气泡（`bg-[#2563eb]`）。消息支持 `whitespace-pre-line` 渲染，确保引导语中的换行符正确展示。

**选项交互**（第350-418行）：两种选项样式：
- **卡片选项**（`current.cards`）：2 列的网格布局，每个卡片包含图标、标题、描述。选中态显示蓝色边框和浅蓝背景。
- **标签选项**（`current.tags`）：圆角标签按钮，选中态显示蓝色实心背景和白色文字。

**自由输入**（第426-448行）：底部提供文本输入框，用户可直接输入想法而非选择预设选项。输入框支持回车发送，发送按钮在输入为空时禁用。

**完成动画**（第244-263行）：所有步骤完成后，助手展示完成祝贺消息，随后在约 1.5 秒后自动跳转回首页。

### 6.2 前端 API 类型定义（from types.ts）✅

前端有两个核心的画像相关类型定义（`frontend/src/lib/api/types.ts`）：

**StudentProfile**（第171-185行）：前端视角的画像完整数据结构，字段使用 camelCase 命名：

```typescript
export interface StudentProfile {
  id: string              // 用户标识
  name: string            // 姓名
  email: string           // 邮箱
  major: string           // 专业
  grade: string           // 年级
  goals: string[]         // 学习目标数组
  knowledgeLevel: string  // 知识水平
  weakPoints: string[]    // 薄弱知识点数组
  learningPreference: string[]  // 学习偏好数组
  cognitiveStyle: string  // 认知风格
  dailyTime: number       // 每日学习时长（分钟）
  practicalAbility: string // 实践能力
  currentStage: string    // 当前学习阶段
}
```

**ProfileUpdatePayload**（第187-200行）：画像更新请求体，所有字段均为可选（`?`），与后端 `ProfileUpdateReq` 的 `Optional` 语义一致：

```typescript
export interface ProfileUpdatePayload {
  name?: string
  email?: string
  major?: string
  grade?: string
  goals?: string[]
  knowledgeLevel?: string
  weakPoints?: string[]
  learningPreference?: string[]
  cognitiveStyle?: string
  dailyTime?: number
  practicalAbility?: string
  currentStage?: string
}
```

注意前端类型的 `goals`、`weakPoints`、`learningPreference` 使用复数命名（如 `goals` 而非 `goal`），在与后端交互时需通过 API 层完成字段名称的映射转换。

---

## 7. 与记忆引擎的联动 ✅（重点）

SparkLearn 的画像系统并非孤立存在，而是与记忆引擎（`memory_engine.py`）形成了深度的双向联动关系。画像为记忆提供结构化的用户特征锚点，记忆为画像提供动态更新的上下文数据来源。

### 7.1 画像字段与 semantic memory 的映射关系

画像字段与 semantic memory 之间存在精确的字段级映射，如下表所示：

| 画像字段 (profiles 表) | semantic memory 字段 | 数据同步方向 | 同步触发机制 |
|----------------------|---------------------|------------|------------|
| `goal` | `semantic.goals` | 双向 | 建档时写入 profiles；对话中正则抽取追加到 semantic；`build_injected_context` 读取 semantic 注入 prompt |
| `learning_preference` | `semantic.preferences` | 双向 | 建档时写入 profiles；用户表述偏好后追加到 semantic |
| `daily_time` | `semantic.constraints` | 单向（画像→记忆） | 时间约束作为 constraint 存入 semantic |
| `weak_points` | `semantic.weak_points` | 双向 | 建档设定 + 掌握度分析；对话中识别的不懂之处追加到 semantic |
| — | `semantic.skills` | 单向（记忆→画像辅助） | 对话中识别到的技能标签，在 `consolidate_memory` 时可能影响 `cognitive_style` 和 `practical_ability` 判断 |
| `current_stage` | `semantic.learning_stage` | 双向 | 路径规划更新阶段后同步到 semantic |
| — | `semantic.facts` | 单向 | 用户要求记住的事实信息，不直接映射到画像字段但影响 Tutor 对话质量 |

在 `consolidate_memory()` 函数（memory_engine.py 第278-313行）中，episodic memory 中重要性较高的事件会根据内容关键词和标签分类整理到对应的 semantic 子字段中。例如，包含"目标"、"计划"、"打算"关键词的事件会被分类到 `semantic.goals`，包含"薄弱"、"错题"、"不会"关键词的事件会被分类到 `semantic.weak_points`。

### 7.2 画像更新触发记忆更新

画像变更会触发记忆系统的同步更新，具体路径如下：

**手动编辑画像**（profile.py 第116-164行）：
1. 用户通过 `PUT /api/profile` 更新画像字段
2. `_upsert_profile()` 写入 profiles 表 → `version + 1`
3. `_write_profile_snapshot()` 更新快照文件
4. `append_jsonl()` 记录 `profile_updated` 事件
5. 记忆系统在下次 `load_user_memory()` 调用时自动读取最新的 `profile_snapshot.json`（通过 `save_user_memory()` 的合并逻辑）

**辅导对话后**（tutor_eval.py 第785-790行）：
1. `update_memory_from_turn()` 被调用
2. 从用户消息中正则提取目标/偏好/约束/事实 → 追加到 semantic 对应数组
3. 如有变化 → `memory_store.json` 的 `version` 递增
4. `memory_updated` 事件写入 `learning_events.jsonl`
5. 下次 `build_injected_context()` 调用时，更新后的 semantic memory 自动注入对话上下文

### 7.3 记忆上下文注入辅导对话

记忆上下文的注入是画像在实际业务场景中最核心的消费方式。在 Tutor 辅导对话中（`tutor_eval.py` 第521行）：

```python
memory_prompt = build_injected_context(settings.single_user_id, req.message, top_k=8)
```

`build_injected_context()` 函数（memory_engine.py 第357-380行）构建结构化的记忆上下文 prompt。注入的内容包括：

1. **长期目标**：`"长期目标: [\"期末提分\", \"竞赛准备\"]"`（第364-365行）
2. **学习偏好**：`"学习偏好: [\"视觉型\", \"实践型\"]"`（第366-367行）
3. **约束条件**：`"约束条件: [\"每天1小时\"]"`（第368-369行）
4. **薄弱点**：`"薄弱点: [\"函数\", \"面向对象\"]"`（第370-371行）
5. **能力标签**：`"能力标签: [\"Python基础\", \"数据结构\"]"`（第372-373行）
6. **当前学习阶段**：`"当前学习阶段: 函数与模块"`（第374-375行）
7. **相关历史记忆**：通过 `search_memory()` 召回与当前问题相关的前 8 条记忆记录（第376-378行）
8. **冲突处理提示**：`"若历史记忆与当前问题冲突，以当前问题为准，并在回答中体现调整。"`（第379行）

这个记忆上下文与角色上下文（`_build_role_prompt`）和页面上下文（`_build_page_context_prompt`）合并后，作为系统 prompt 发送给大模型。这使得 AI 导师能够"记住"学习者的目标、偏好和薄弱点，提供真正个性化的辅导体验。

---

## 8. 待实现规划 🔲

当前画像采集系统已实现核心采集通道和基本的自动更新机制，但仍有若干重要的扩展方向尚未实现。以下为待实现的规划项目：

### 8.1 🔲 对话建档画像抽取升级

当前 `_build_profile_from_dialog()`（profile.py 第236-249行）采用简单的关键词匹配规则（仅通过 `"竞赛" in joined` 判断学习目标），抽取粒度粗糙。待实现方案：将此函数升级为 LLM 驱动的结构化抽取，使用 JSON Schema 约束输出格式，要求模型返回每个画像字段的值和置信度评分，对低置信度字段标记为"待确认"状态，在前端展示给用户复核。

### 8.2 🔲 逆构个性化系统

用户随手拍一张教材封面照片或输入一句简短需求（如"我想学机器学习"），大模型自动从非结构化输入中逆构出完整的教学规划。这一机制的核心思路是：将用户微小的行为信号（一张照片、一句话、一次点击）作为输入，通过 LLM 的理解和推理能力，自动补全画像中的缺失字段（目标、基础水平、偏好建议、阶段推荐），生成初始学习路径并征求用户确认。逆构的结果可直接写入 `profiles` 表并触发路径规划模块生成首轮学习方案。

### 8.3 🔲 PolarDB PostgreSQL 迁移

如第 5.1 节所述，当前 SQLite 存储方案适用于单用户开发阶段。待系统支持多用户场景时，需迁移至 PolarDB PostgreSQL。迁移方案的技术基础已经具备：数据库操作已通过 `db.py` 的统一封装函数隔离，只需修改连接层实现即可。

### 8.4 🔲 画像-路径联动增强

当前画像更新与路径调整之间缺少自动化的事件驱动联动机制。待实现方案：由事件触发画像微更新（如连续错题自动追加 `weak_points` 候选），并将更改写入"待确认"状态；同时路径规划模块监听画像变更事件，自动评估是否需要调整当前学习路径（推进、回退或重新生成）。

### 8.5 🔲 语义检索型长期记忆召回

当前记忆召回以"最近窗口 + 显式拼接"为主（`build_injected_context` 中的 `search_memory` 虽然支持语义搜索，但基于规则评分），尚未接入 Embedding 向量进行深度语义检索。待实现方案：在 `memory_store.json` 的事件内容上计算 Embedding 向量，通过向量相似度召回与当前问题语义最相关的历史记忆，替代当前基于 token 交集的 `_semantic_score` 评分机制。

### 8.6 🔲 画像观测与审计

当前画像变更链路缺乏统一的 trace_id 机制。待实现方案：为画像的每一次变更（建档、编辑、自动更新）分配唯一的 trace_id，将触发源、变更字段、变更前后值、时间戳关联记录，便于调试画像采集逻辑和评审展示。

---

## 附录：关键代码定位清单

| 模块 | 文件路径 | 关键函数/内容 |
|------|---------|------------|
| 画像采集路由 | `backend/app/routes/profile.py` | `onboarding()`, `initiate()`, `chat()`, `get_profile()`, `update_profile()`, `_build_profile_from_onboarding()`, `_build_profile_from_dialog()`, `_upsert_profile()`, `_row_to_profile()` |
| 数据库初始化 | `backend/app/db.py` | `init_db()` (students 表第36行，profiles 表第46行), `_upsert_profile()` |
| 记忆引擎 | `backend/app/memory_engine.py` | `_default_memory()`, `load_user_memory()`, `save_user_memory()`, `update_memory_from_turn()`, `build_injected_context()`, `consolidate_memory()` |
| 存储层 | `backend/app/storage.py` | `read_json()`, `write_json()`, `append_jsonl()` |
| 辅导上下文工程 | `backend/app/routes/tutor_eval.py` | `build_injected_context()` 调用（第521行）, `update_memory_from_turn()` 调用（第785行） |
| 练习与掌握度记忆 | `backend/app/routes/quiz.py` | `_update_mastery()`（第808行）, `_build_submit_context()` |
| 前端建模页面 | `frontend/src/app/onboarding/page.tsx` | `submitOnboarding()`（第265行）, `STEPS` 数据（第46行）, `MessageBubble` 组件（第498行） |
| 前端 API 类型 | `frontend/src/lib/api/types.ts` | `StudentProfile`（第171行）, `ProfileUpdatePayload`（第187行） |
| 系统配置 | `backend/app/config.py` | `single_user_id`, `data_dir`, `db_path` |
