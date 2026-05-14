# Requirements Document

## Introduction

学习伙伴 Agent 是 SparkLearn 平台的一项新功能，允许用户在学习空间中"认养"一只 AI 小助手（小狐狸、猫头鹰、小机器人等形象）。该 Agent 具备上网搜索资料、整理笔记摘要、对比搜索、每日推荐和收藏入库等核心能力，并通过轻量游戏化的成长系统（Lv.1-5）逐步解锁能力，为用户提供有温度、有成长感的学习陪伴体验。

本功能分三个 MVP 阶段交付：
- v0.1：认养 + 起名 + 单次搜索任务
- v0.2：文章总结 + 收藏入库
- v0.3：成长系统 + 每日推荐

技术架构基于现有 Next.js 前端 + FastAPI 后端，新增 AgentPet、AgentChat、AgentHistory 前端组件，以及 agent.py 路由、agent_pet.py 和 browser_agent.py 服务层，数据存储使用 agent_pets 表和 agent_tasks 表。

## Glossary

- **Agent_Pet**：用户认养的 AI 学习伙伴实例，包含形象、名称、性格和等级属性
- **Agent_Chat**：用户与 Agent_Pet 之间的对话交互界面，包含气泡消息和输入框
- **Agent_Task**：Agent_Pet 执行的一次具体任务（搜索、摘要、对比等），具有异步执行特性
- **Browser_Agent**：后端服务层中负责调用 browser-use 执行网页浏览和信息提取的模块
- **Growth_System**：Agent_Pet 的成长等级系统（Lv.1-Lv.5），通过完成任务获取经验值升级
- **Persona**：Agent_Pet 的性格偏好设定，包括简洁型、话多型、鼓励型三种预设
- **Whitelist**：允许 Browser_Agent 访问的安全网站列表，用于限制搜索范围
- **Resource_Library**：SparkLearn 现有的资源库模块，Agent_Pet 可将搜索结果收藏至此
- **Task_Status**：Agent_Task 的执行状态，包含 pending、running、completed、failed 四种
- **Experience_Points**：Agent_Pet 完成任务后获得的经验值，累积可触发等级提升

## Requirements

### Requirement 1: 认养 Agent Pet

**User Story:** As a 学习者, I want to 认养一只 AI 学习伙伴并为其选择形象和起名, so that 我在学习过程中有一个个性化的陪伴角色。

#### Acceptance Criteria

1. WHEN 用户首次进入学习伙伴页面且尚未认养 Agent_Pet, THE Agent_Pet_Service SHALL 展示认养引导流程，提供 3 种预设形象（小狐狸、猫头鹰、小机器人）供选择
2. WHEN 用户选择一种形象并输入名称（1-10 个字符，仅允许中文、英文字母、数字，不允许空格、特殊字符和纯空白）, THE Agent_Pet_Service SHALL 创建一个 Lv.1 的 Agent_Pet 实例（默认 Persona 为简洁型，初始 Experience_Points 为 0）并持久化到 agent_pets 表
3. WHEN 用户完成认养流程, THE Agent_Pet_Service SHALL 在 3 秒内返回包含 pet_id、avatar_type、name、persona、level 字段的 Agent_Pet 对象
4. IF 用户输入的名称为空、超过 10 个字符或包含不允许的字符, THEN THE Agent_Pet_Service SHALL 返回参数校验错误并提示合法名称规则（1-10 个字符，仅中文、英文字母、数字）
5. IF 用户已拥有一只 Agent_Pet 并尝试再次认养, THEN THE Agent_Pet_Service SHALL 拒绝创建请求并返回错误信息指示该用户已拥有学习伙伴
6. IF Agent_Pet 创建过程中持久化失败, THEN THE Agent_Pet_Service SHALL 返回服务错误信息并确保不产生残留数据（操作原子性回滚）

### Requirement 2: 个性化性格设定

**User Story:** As a 学习者, I want to 为我的学习伙伴选择性格偏好, so that 它的回复风格符合我的沟通习惯。

#### Acceptance Criteria

1. WHEN 用户在认养流程或设置页面选择 Persona 类型, THE Agent_Pet_Service SHALL 将 Persona 保存到 Agent_Pet 实例中，并在 2 秒内返回保存成功的确认响应
2. THE Agent_Pet_Service SHALL 提供三种预设 Persona：简洁型（单次回复不超过 80 字，不含补充说明）、话多型（单次回复 150-300 字，包含解释和示例）、鼓励型（单次回复 100-200 字，每次回复包含至少一句正向激励语句）
3. WHEN Agent_Pet 生成回复内容时, THE Agent_Chat SHALL 根据当前 Persona 类型调整回复的语气和长度，使回复字数和风格符合该 Persona 的预设范围
4. WHEN 用户修改 Persona 设定, THE Agent_Pet_Service SHALL 在 2 秒内完成 Agent_Pet 实例更新，修改后的下一条回复即使用新 Persona 风格
5. IF 用户在认养流程中未选择 Persona 类型, THEN THE Agent_Pet_Service SHALL 默认将 Persona 设为"鼓励型"
6. IF Persona 保存或更新操作失败, THEN THE Agent_Pet_Service SHALL 返回错误提示信息，并保留 Agent_Pet 当前的 Persona 设定不变
7. IF 用户提交的 Persona 类型不属于三种预设类型之一, THEN THE Agent_Pet_Service SHALL 返回参数校验错误并提示可选的 Persona 类型列表

### Requirement 3: 单次搜索任务

**User Story:** As a 学习者, I want to 让我的学习伙伴帮我上网搜索学习资料, so that 我能快速获取与当前学习内容相关的信息。

#### Acceptance Criteria

1. WHEN 用户在 Agent_Chat 中输入搜索指令（自然语言描述需求，长度为 1-200 个字符）, THE Browser_Agent SHALL 创建一个 Agent_Task（status=pending）并开始异步执行网页搜索，返回最多 5 条搜索结果
2. WHILE Agent_Task 处于 running 状态, THE Agent_Chat SHALL 每 3 秒轮询一次任务状态并向用户展示"搜索中"进度提示
3. WHEN Browser_Agent 完成搜索, THE Agent_Task SHALL 更新 status 为 completed，并存储搜索结果（每条包含：标题、不超过 200 字符的摘要、来源 URL、搜索时间戳）
4. WHEN 搜索结果返回, THE Agent_Chat SHALL 以对话气泡形式展示各条结果摘要，每条包含可点击的来源链接
5. IF Browser_Agent 在 30 秒内未完成搜索, THEN THE Agent_Task SHALL 更新 status 为 failed 并向用户返回超时错误提示信息
6. THE Browser_Agent SHALL 仅访问 Whitelist 中的网站，拒绝访问未列入白名单的域名
7. IF 目标网站不在 Whitelist 中, THEN THE Browser_Agent SHALL 返回安全限制提示并建议最多 3 个白名单内的替代来源
8. IF Browser_Agent 完成搜索但未找到任何匹配结果, THEN THE Agent_Chat SHALL 向用户展示无结果提示信息并建议用户调整搜索关键词
9. IF 用户输入的搜索指令超过 200 个字符, THEN THE Agent_Chat SHALL 返回参数校验错误并提示用户缩短搜索描述
10. IF 用户在已有 Agent_Task 处于 running 状态时发起新的搜索请求, THEN THE Browser_Agent SHALL 拒绝创建新任务并提示用户等待当前任务完成或超时

### Requirement 4: 文章摘要整理

**User Story:** As a 学习者, I want to 让学习伙伴帮我总结一篇文章的要点, so that 我能快速理解长文内容并提取关键信息。

#### Acceptance Criteria

1. WHEN 用户提供一个 URL 或粘贴文本内容（长度在 100 至 50000 字符之间）并请求摘要, THE Browser_Agent SHALL 创建摘要类型的 Agent_Task（status=pending）并提取文章正文内容
2. WHILE Agent_Task 处于 running 状态, THE Agent_Chat SHALL 每 3 秒轮询一次任务状态并向用户展示"摘要生成中"进度提示
3. WHEN 文章内容提取完成, THE Browser_Agent SHALL 调用 LLM 生成结构化摘要，包含主题（1 句话概括）、关键要点列表（3 至 7 条）、结论（1-2 句话总结）
4. WHEN 摘要生成完成, THE Agent_Chat SHALL 以格式化气泡展示摘要结果，分区显示主题、要点列表和结论
5. IF 提供的 URL 无法访问或不在 Whitelist 中, THEN THE Browser_Agent SHALL 将 Agent_Task status 更新为 failed 并返回错误信息，指明失败原因（网络不可达或域名未在白名单中）
6. IF 文章内容提取后正文少于 100 字符, THEN THE Browser_Agent SHALL 将 Agent_Task status 更新为 failed 并返回错误信息指明内容不足无法生成有效摘要
7. IF 文章内容超过 LLM 上下文窗口限制, THEN THE Browser_Agent SHALL 对文章进行分段摘要后合并为最终摘要，最终摘要格式与单次摘要一致
8. IF Browser_Agent 在 60 秒内未完成摘要任务, THEN THE Agent_Task SHALL 更新 status 为 failed 并返回超时错误信息

### Requirement 5: 收藏入库

**User Story:** As a 学习者, I want to 将学习伙伴找到的资料收藏到我的资源库, so that 我能在后续学习中方便地查阅这些资料。

#### Acceptance Criteria

1. WHEN 用户对某条搜索结果或摘要点击"收藏"操作, THE Agent_Pet_Service SHALL 将该资源保存到 Resource_Library 中，存储内容包含标题、来源 URL（如有）、内容摘要、收藏时间，并关联当前用户和来源 Agent_Task
2. WHEN 收藏成功, THE Agent_Chat SHALL 在 2 秒内展示收藏确认消息，包含资源在 Resource_Library 中的标题
3. THE Agent_Pet_Service SHALL 为收藏的资源自动生成 1-5 个标签（基于内容关键词提取），每个标签长度不超过 10 个字符
4. IF 相同 URL 的资源已存在于当前用户的 Resource_Library 中, THEN THE Agent_Pet_Service SHALL 阻止重复收藏，提示用户该资源已收藏并提供查看入口
5. IF 收藏操作因服务异常未能完成, THEN THE Agent_Pet_Service SHALL 返回错误提示信息，告知用户收藏失败并建议重试，原有对话内容和搜索结果保持不变

### Requirement 6: 成长等级系统

**User Story:** As a 学习者, I want to 看到我的学习伙伴随着使用逐渐成长升级, so that 我有持续使用的动力和成就感。

#### Acceptance Criteria

1. THE Growth_System SHALL 定义 5 个等级（Lv.1 至 Lv.5），每个等级需要的累计 Experience_Points 分别为 0、100、300、600、1000
2. WHEN Agent_Pet 完成一个 Agent_Task（status=completed）, THE Growth_System SHALL 根据任务类型授予 Experience_Points：搜索任务 10 点、摘要任务 20 点、对比搜索 25 点、每日推荐任务 15 点、自动学习计划建议任务 30 点
3. WHEN Agent_Pet 的累计 Experience_Points 达到下一等级阈值, THE Growth_System SHALL 自动提升 Agent_Pet 等级并在 Agent_Chat 中发送一条升级通知消息，包含新等级编号和新解锁的能力名称
4. THE Growth_System SHALL 按等级解锁能力：Lv.1 单次搜索、Lv.2 文章摘要、Lv.3 对比搜索、Lv.4 每日推荐、Lv.5 自动学习计划建议
5. WHEN 用户请求使用尚未解锁的能力, THE Agent_Chat SHALL 提示当前等级不足并告知解锁该能力所需的等级和当前累计经验值与目标等级阈值之间的差值
6. WHILE Agent_Pet 已达到 Lv.5（最高等级）, THE Growth_System SHALL 继续累计 Experience_Points 但不再触发等级提升
7. IF Agent_Task 的 status 为 failed, THEN THE Growth_System SHALL 不授予该任务对应的 Experience_Points

### Requirement 7: 每日推荐

**User Story:** As a 学习者, I want to 每天收到学习伙伴根据我的学习情况推荐的内容, so that 我能持续发现有价值的学习资源。

#### Acceptance Criteria

1. WHEN 用户当日（以服务器本地日期 00:00 为分界）首次打开学习伙伴页面, THE Agent_Pet_Service SHALL 基于用户学习画像（薄弱点、当前阶段、学习偏好）生成恰好 3 条推荐内容，并在 15 秒内返回结果
2. THE Agent_Pet_Service SHALL 从 Whitelist 网站中筛选与用户当前学习阶段匹配的资源作为推荐候选，且不推荐用户过去 30 天内已收藏到 Resource_Library 或已点击"查看详情"的资源
3. WHEN 推荐内容生成完成, THE Agent_Chat SHALL 以专属推荐卡片样式展示每条推荐，每张卡片包含标题（不超过 50 字符）、简介（不超过 150 字符）和"查看详情"操作按钮
4. WHILE Agent_Pet 等级低于 Lv.4, THE Agent_Pet_Service SHALL 不触发每日推荐功能
5. WHEN 用户当日已获取过推荐内容后再次打开学习伙伴页面, THE Agent_Chat SHALL 展示当日已生成的推荐内容，不重新生成
6. IF Agent_Pet_Service 在 15 秒内未能生成推荐内容或 Whitelist 中无匹配资源, THEN THE Agent_Chat SHALL 向用户展示推荐暂不可用的提示信息并建议稍后重试

### Requirement 8: 对话历史记录

**User Story:** As a 学习者, I want to 查看与学习伙伴的历史对话和任务记录, so that 我能回顾之前搜索过的资料和获得的建议。

#### Acceptance Criteria

1. THE Agent_Chat SHALL 持久化所有对话消息（用户输入和 Agent_Pet 回复）到 agent_tasks 表关联的消息记录中，每条消息包含发送方标识、内容文本（最大 5000 字符）和时间戳
2. WHEN 用户打开 AgentHistory 组件, THE Agent_Pet_Service SHALL 在 2 秒内按时间倒序返回历史任务列表，每页 20 条，每条包含任务类型、Task_Status、创建时间和结果摘要（最大 100 字符）
3. WHEN 用户点击某条历史任务, THE AgentHistory SHALL 展示该任务的完整对话消息列表（按时间正序排列）和结果详情（包含任务类型、状态、执行时长、完整结果内容及来源链接）
4. THE Agent_Pet_Service SHALL 保留最近 100 条任务记录在活跃列表中，超出部分按创建时间从早到晚移入归档列表；归档记录仍可通过 AgentHistory 的"已归档"入口查看，但不计入活跃列表分页
5. IF AgentHistory 组件加载历史任务列表失败, THEN THE AgentHistory SHALL 展示错误提示信息并提供重试操作入口
6. WHEN 用户打开 AgentHistory 组件且当前无任何任务记录, THE AgentHistory SHALL 展示空状态提示，引导用户发起首次对话

### Requirement 9: 异步任务状态管理

**User Story:** As a 学习者, I want to 在学习伙伴执行耗时任务时了解进度, so that 我知道任务是否在正常执行。

#### Acceptance Criteria

1. WHEN 一个 Agent_Task 被创建, THE Agent_Pet_Service SHALL 在 1 秒内返回 task_id 并将 Task_Status 设为 pending，响应内容包含 task_id、task_type、status 和 created_at 字段
2. WHEN Browser_Agent 开始执行任务, THE Agent_Pet_Service SHALL 将 Task_Status 从 pending 更新为 running，且 pending 到 running 的转换时间不超过 5 秒
3. WHEN 任务执行完成, THE Agent_Pet_Service SHALL 将 Task_Status 更新为 completed 并存储结果数据（结果数据结构由任务类型决定：搜索任务包含标题、摘要、来源 URL；摘要任务包含主题、关键要点、结论）
4. IF 任务执行过程中发生异常, THEN THE Agent_Pet_Service SHALL 将 Task_Status 更新为 failed，记录错误原因（最长 500 字符），并保留已获取的部分数据（如有）
5. WHEN 用户通过 Agent_Chat 查询指定 task_id 的状态, THE Agent_Chat SHALL 返回该任务的 task_id、task_type、status、created_at、updated_at 及结果摘要（completed 状态）或错误原因（failed 状态）
6. IF 用户查询的 task_id 不存在或不属于当前用户, THEN THE Agent_Chat SHALL 返回错误提示，指明任务不存在或无权访问
7. IF Agent_Task 在 running 状态超过 60 秒未完成, THEN THE Agent_Pet_Service SHALL 自动将 Task_Status 更新为 failed 并记录超时错误原因
8. THE Agent_Pet_Service SHALL 仅允许合法的状态转换路径：pending→running、running→completed、running→failed、pending→failed，拒绝其他任何状态变更请求

### Requirement 10: 安全边界控制

**User Story:** As a 平台管理者, I want to 限制学习伙伴的网页访问范围, so that 学生不会通过该功能访问不适当的内容。

#### Acceptance Criteria

1. THE Browser_Agent SHALL 维护一份 Whitelist 配置，包含允许访问的域名列表（最多500条），支持精确域名（example.com）和通配符子域名（*.example.com，匹配所有子域名但不匹配根域名本身）
2. WHEN Browser_Agent 收到搜索或访问请求, THE Browser_Agent SHALL 在执行前校验目标 URL 的域名是否在 Whitelist 中，校验应在100ms内完成
3. IF 目标域名不在 Whitelist 中, THEN THE Browser_Agent SHALL 拒绝执行该请求，向用户返回错误信息指明该域名不在允许访问范围内，并保留用户的原始查询上下文
4. IF 请求目标经过重定向后最终域名不在 Whitelist 中, THEN THE Browser_Agent SHALL 中止访问并返回安全限制错误，指明被拦截的重定向目标域名
5. IF Whitelist 配置为空（无任何域名条目）, THEN THE Browser_Agent SHALL 拒绝所有网页访问请求并返回错误信息指明白名单未配置
6. THE Whitelist SHALL 支持通过后端配置文件进行增删改，配置变更后30秒内生效，无需重启服务
7. THE Browser_Agent SHALL 记录所有被拒绝的访问请求，记录内容包含目标域名、请求时间（ISO 8601格式精确到秒）、用户标识，日志保留不少于90天用于安全审计
