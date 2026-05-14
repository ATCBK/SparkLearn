# Implementation Plan: 学习伙伴 Agent (Learning Companion Agent)

## Overview

基于现有 SparkLearn 架构（FastAPI + SQLite + Next.js App Router）实现学习伙伴 Agent 功能。按照 MVP 分阶段交付：v0.1 认养+搜索、v0.2 摘要+收藏、v0.3 成长系统+每日推荐。实现顺序为：数据库 → 后端服务层 → API 路由 → 前端组件 → 集成联调。

## Tasks

- [ ] 1. 数据库 Schema 与基础配置
  - [ ] 1.1 创建 Agent 相关数据库表
    - 在 `backend/app/db.py` 中新增 `agent_pets`、`agent_tasks`、`agent_messages`、`agent_task_steps` 四张表的 CREATE TABLE 语句
    - 包含所有索引定义（idx_agent_tasks_user、idx_agent_tasks_status、idx_agent_messages_task、idx_agent_task_steps）
    - 确保在应用启动时自动执行建表
    - _Requirements: 1.2, 3.1, 8.1, 9.1_

  - [ ] 1.2 创建白名单配置文件和管理模块
    - 创建 `backend/app/config/whitelist.json`，包含初始域名列表（docs.python.org、*.runoob.com、realpython.com 等）
    - 在 `backend/app/services/` 目录下创建 `whitelist.py`，实现 `WhitelistManager` 类
    - 支持精确域名匹配和 `*.domain.com` 通配符匹配
    - 实现 30 秒缓存刷新机制（内存缓存 + TTL）
    - 域名校验在 100ms 内完成
    - _Requirements: 10.1, 10.2, 10.6_

  - [ ] 1.3 扩展 config.py 新增 Agent LLM 配置项
    - 在 `backend/app/config.py` 的 Settings 类中新增 agent 相关配置字段
    - 包含 `agent_llm_provider`、`agent_llm_model`、`agent_browser_llm_provider`、`agent_browser_llm_model`、`agent_browser_llm_base_url`、`agent_browser_llm_api_key`、`agent_browser_headless` 等
    - 配置从 `.env` 文件读取
    - _Requirements: 3.1, 4.1_

- [ ] 2. 后端服务层 — Agent Pet 管理
  - [ ] 2.1 实现 agent_pet.py 服务（认养与状态管理）
    - 创建 `backend/app/services/agent_pet.py`
    - 实现 `create_pet(user_id, name, avatar, personality)` — 创建 Agent Pet，校验名称正则 `^[\u4e00-\u9fa5a-zA-Z0-9]{1,10}$`，校验 avatar 枚举值，校验用户唯一性（UNIQUE 约束）
    - 实现 `get_pet(user_id)` — 获取当前用户的 Pet 信息
    - 实现 `update_pet(user_id, personality)` — 更新 Persona 设定，校验 personality 枚举值
    - 所有操作确保原子性，失败时无残留数据
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 编写 agent_pet.py 单元测试
    - 测试名称校验（合法/非法字符、长度边界）
    - 测试重复认养拒绝
    - 测试 Persona 更新和默认值
    - _Requirements: 1.4, 1.5, 2.5, 2.7_

- [ ] 3. 后端服务层 — 成长系统
  - [ ] 3.1 实现 growth.py 服务（经验值与等级管理）
    - 创建 `backend/app/services/growth.py`
    - 定义 `LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000]`
    - 定义 `XP_REWARDS = {"search": 10, "summarize": 20, "compare": 25, "recommend": 15, "plan": 30}`
    - 定义 `LEVEL_ABILITIES` 映射（Lv.1-5 对应解锁能力列表）
    - 实现 `award_xp(pet_id, task_type)` — 授予经验值，检测升级，返回 (new_xp, new_level_or_None)
    - 实现 `check_ability(pet_level, task_type)` — 校验当前等级是否已解锁指定能力
    - 实现 `get_level_info(xp)` — 根据经验值计算当前等级和下一等级所需经验
    - Lv.5 后继续累计但不升级
    - failed 任务不授予经验值
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 3.2 编写 growth.py 单元测试
    - 测试各等级阈值判定
    - 测试经验值授予和升级触发
    - 测试能力解锁校验
    - 测试 Lv.5 上限行为
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

- [ ] 4. Checkpoint — 基础服务层验证
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. 后端服务层 — 浏览器 Agent 任务执行
  - [ ] 5.1 实现 browser_agent.py 核心框架
    - 创建 `backend/app/services/browser_agent.py`
    - 实现 `BrowserAgentService` 类，初始化 browser-use 配置
    - 实现 `_get_llm()` — 获取 DeepSeek V3 LLM 实例（langchain_openai.ChatOpenAI）
    - 实现白名单校验集成（调用 WhitelistManager）
    - 实现 `on_step` 回调机制，将浏览器操作步骤写入 agent_task_steps 表
    - 实现重定向拦截逻辑（navigation hook 中二次校验域名）
    - _Requirements: 3.1, 9.2, 10.2, 10.3, 10.4, 10.7_

  - [ ] 5.2 实现搜索任务执行逻辑
    - 在 `BrowserAgentService` 中实现 `execute_search(query, pet, on_step)` 方法
    - 使用 browser-use Agent 执行真实浏览器搜索
    - 返回最多 5 条结果（标题、摘要≤200字符、来源URL、时间戳）
    - 搜索超时 30 秒自动标记 failed
    - 无结果时返回空列表标识
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.8_

  - [ ] 5.3 实现摘要任务执行逻辑
    - 在 `BrowserAgentService` 中实现 `execute_summarize(url_or_text, pet, on_step)` 方法
    - 支持 URL 访问提取和直接文本输入两种模式
    - 调用 LLM 生成结构化摘要（主题、3-7 条关键要点、结论）
    - 文章超长时分段摘要后合并
    - 内容不足 100 字符时返回错误
    - 超时 60 秒自动标记 failed
    - _Requirements: 4.1, 4.3, 4.5, 4.6, 4.7, 4.8_

  - [ ] 5.4 实现异步任务管理（创建、状态流转、超时监控）
    - 实现 `create_task(user_id, pet_id, task_type, input_text)` — 创建任务记录，1 秒内返回 task_id
    - 实现 `run_task_async(task_id)` — 使用 `asyncio.create_task()` 后台执行
    - 实现状态流转：pending → running → completed/failed
    - 实现并发限制：同一用户 running 状态任务存在时拒绝新任务（429）
    - 实现超时监控：running 超过 60 秒自动标记 failed
    - 合法状态转换路径校验：pending→running、running→completed、running→failed、pending→failed
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.7, 9.8, 3.10_

  - [ ]* 5.5 编写 browser_agent.py 单元测试
    - 测试白名单校验逻辑（精确匹配、通配符、拒绝场景）
    - 测试任务状态流转
    - 测试并发限制
    - 测试超时处理
    - Mock browser-use 调用测试搜索/摘要结果解析
    - _Requirements: 3.5, 3.10, 9.7, 9.8, 10.2, 10.3_

- [ ] 6. 后端 API 路由层
  - [ ] 6.1 实现 routes/agent.py — Pet 管理接口
    - 创建 `backend/app/routes/agent.py`，使用 `APIRouter(prefix='/api/agent', tags=['agent'])`
    - 实现 `POST /api/agent/pet` — 认养 Pet（Pydantic 校验，409 重复，422 参数错误）
    - 实现 `GET /api/agent/pet` — 获取 Pet 信息（含 next_level_xp、unlocked_abilities）
    - 实现 `PATCH /api/agent/pet` — 更新 Persona
    - 在 `backend/app/main.py` 中注册 agent router
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.4_

  - [ ] 6.2 实现 routes/agent.py — 任务管理接口
    - 实现 `POST /api/agent/task` — 创建任务（能力等级校验 403、并发限制 429、输入校验 422）
    - 实现 `GET /api/agent/task/{task_id}` — 查询任务状态（含 steps 实时步骤、404 不存在）
    - 实现 `GET /api/agent/tasks` — 历史任务列表（分页 page/page_size、archived 参数、每页 20 条）
    - 实现 `POST /api/agent/task/{task_id}/feedback` — 提交反馈
    - _Requirements: 3.1, 3.9, 8.2, 8.3, 8.4, 9.1, 9.5, 9.6_

  - [ ] 6.3 实现 routes/agent.py — 收藏与推荐接口
    - 实现 `POST /api/agent/bookmark` — 收藏入库（去重校验 409、自动生成标签）
    - 实现 `GET /api/agent/recommendations` — 每日推荐（等级校验、当日缓存、15 秒超时）
    - 收藏写入 `knowledge_files` 表，复用现有资源库模式
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 7. Checkpoint — 后端 API 完整性验证
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. 前端 — API 层与类型定义
  - [ ] 8.1 扩展前端 API 层新增 Agent 相关函数
    - 在 `frontend/src/lib/api/real.ts` 中新增 Agent API 调用函数
    - `createPet(data)` / `getPet()` / `updatePet(data)` — Pet 管理
    - `createTask(data)` / `getTask(taskId)` / `getTasks(params)` — 任务管理
    - `bookmarkResource(data)` — 收藏
    - `getRecommendations()` — 每日推荐
    - `submitFeedback(taskId, feedback)` — 反馈
    - 定义 TypeScript 类型：`AgentPetData`、`AgentTaskData`、`AgentMessageData`、`TaskStepData`
    - _Requirements: 1.3, 3.4, 5.2, 7.3, 8.2, 9.5_

- [ ] 9. 前端 — 认养引导流程
  - [ ] 9.1 实现 AdoptionFlow.tsx 认养引导组件
    - 创建 `frontend/src/components/agent/AdoptionFlow.tsx`
    - 实现三步引导流程：形象选择 → 起名 → 性格选择
    - 形象选择：3 种预设（小狐狸 fox、猫头鹰 owl、小机器人 robot），卡片式选择
    - 起名输入：实时校验 1-10 字符、中英文数字，错误提示
    - 性格选择：简洁型/话多型/鼓励型，带描述说明
    - 提交后调用 `createPet` API，成功后跳转到主对话界面
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.5_

- [ ] 10. 前端 — Agent 主页面与伙伴形象
  - [ ] 10.1 实现 Agent 主页面 page.tsx
    - 创建 `frontend/src/app/(shell)/agent/page.tsx`
    - 页面加载时调用 `getPet()` 判断是否已认养
    - 未认养：展示 AdoptionFlow 组件
    - 已认养：展示 AgentPet + AgentChat 布局，侧边可展开 AgentHistory
    - _Requirements: 1.1, 8.6_

  - [ ] 10.2 实现 AgentPet.tsx 伙伴形象组件
    - 创建 `frontend/src/components/agent/AgentPet.tsx`
    - 展示 Avatar 形象（根据 avatar 类型渲染对应图标/插画）
    - 展示等级标识（Lv.1-5）和经验进度条
    - 展示当前已解锁能力列表
    - 任务执行中展示忙碌动画状态
    - _Requirements: 6.3, 6.4, 6.5_

- [ ] 11. 前端 — 对话交互组件
  - [ ] 11.1 实现 AgentChat.tsx 对话交互组件
    - 创建 `frontend/src/components/agent/AgentChat.tsx`
    - 实现消息列表渲染（用户消息 + Agent 回复气泡样式）
    - 实现输入框（限制 200 字符，发送按钮）
    - 发送消息后调用 `createTask` API 创建任务
    - _Requirements: 3.1, 3.4, 3.9, 4.4_

  - [ ] 11.2 实现任务状态轮询与进度展示
    - 任务创建后每 3 秒轮询 `getTask(taskId)` 获取状态
    - pending/running 状态展示"搜索中"/"摘要生成中"进度提示
    - 展示 agent_task_steps 实时操作步骤（如"正在打开搜索引擎..."）
    - completed 时停止轮询，展示结果
    - failed 时停止轮询，展示错误信息
    - _Requirements: 3.2, 3.5, 4.2, 9.1, 9.3_

  - [ ] 11.3 实现搜索结果与摘要结果展示
    - 搜索结果：卡片列表，每条含标题、摘要、可点击来源链接、"收藏"按钮
    - 摘要结果：格式化展示主题、关键要点列表、结论
    - 无结果时展示提示信息并建议调整关键词
    - 能力未解锁时展示等级不足提示（当前等级、目标等级、经验差值）
    - _Requirements: 3.4, 3.8, 4.4, 6.5_

  - [ ] 11.4 实现收藏功能交互
    - 搜索结果/摘要结果中的"收藏"按钮点击后调用 `bookmarkResource` API
    - 成功后展示确认消息（含资源标题）
    - 重复收藏时展示已收藏提示
    - 失败时展示错误提示并建议重试
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [ ] 12. 前端 — 历史记录与每日推荐
  - [ ] 12.1 实现 AgentHistory.tsx 历史记录组件
    - 创建 `frontend/src/components/agent/AgentHistory.tsx`
    - 按时间倒序展示历史任务列表（任务类型图标、状态标签、创建时间、结果摘要）
    - 分页加载（每页 20 条），支持"已归档"切换
    - 点击任务展开详情（完整对话消息列表、结果详情、执行时长、来源链接）
    - 空状态引导用户发起首次对话
    - 加载失败展示错误提示和重试按钮
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 12.2 实现每日推荐卡片展示
    - 在 AgentChat 中集成每日推荐展示逻辑
    - 用户当日首次打开时调用 `getRecommendations()` API
    - 以推荐卡片样式展示 3 条推荐（标题≤50字符、简介≤150字符、"查看详情"按钮）
    - 等级低于 Lv.4 时不触发推荐
    - 当日已获取过推荐时直接展示缓存内容
    - 超时或无匹配时展示暂不可用提示
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 13. Checkpoint — 前端组件完整性验证
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. 集成与安全
  - [ ] 14.1 实现 Persona 对 LLM 回复风格的控制
    - 在 browser_agent.py 中集成 `PERSONA_PROMPTS` 字典
    - Agent 回复时根据 pet.personality 注入对应 system prompt 前缀
    - 简洁型≤80字、话多型150-300字、鼓励型100-200字含正向激励
    - _Requirements: 2.2, 2.3_

  - [ ] 14.2 实现安全审计日志
    - 在 WhitelistManager 中记录所有被拒绝的访问请求
    - 日志内容：目标域名、请求时间（ISO 8601）、用户标识
    - 日志写入文件，保留不少于 90 天
    - 重定向拦截也记录到审计日志
    - _Requirements: 10.3, 10.4, 10.5, 10.7_

  - [ ] 14.3 实现升级通知与消息持久化
    - 任务完成后调用 `growth.award_xp()`，如果触发升级则在 agent_messages 中插入升级通知消息
    - 升级通知包含新等级编号和新解锁能力名称
    - 所有对话消息（用户输入和 Agent 回复）持久化到 agent_messages 表
    - 每条消息包含 sender、content（≤5000字符）、created_at
    - _Requirements: 6.3, 8.1_

  - [ ]* 14.4 编写集成测试
    - 测试完整认养流程（创建 → 查询 → 更新 Persona）
    - 测试任务生命周期（创建 → 轮询 → 完成 → 经验值授予）
    - 测试收藏入库（搜索 → 收藏 → 去重校验）
    - 测试白名单拦截（合法域名通过、非法域名拒绝、重定向拦截）
    - _Requirements: 1.2, 3.1, 5.1, 9.1, 10.2, 10.4_

- [ ] 15. Final Checkpoint — 全功能验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 后端使用 Python (FastAPI + SQLite)，前端使用 TypeScript (Next.js App Router + Tailwind CSS)
- 遵循项目现有模式：APIRouter + raw SQLite + Pydantic 校验 + fetchJson 封装
- browser-use 需要安装 `browser-use`、`playwright`、`langchain-openai` 依赖
- 白名单配置变更后 30 秒内生效，无需重启服务
- 前端轮询间隔 3 秒，超时后自动停止轮询
- 每日推荐使用当日缓存，同一天内不重复生成

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 4, "tasks": ["5.5", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["9.1", "10.1", "10.2"] },
    { "id": 8, "tasks": ["11.1", "12.1"] },
    { "id": 9, "tasks": ["11.2", "11.3", "12.2"] },
    { "id": 10, "tasks": ["11.4", "14.1", "14.2"] },
    { "id": 11, "tasks": ["14.3", "14.4"] }
  ]
}
```
