# SparkLearn 全平台逻辑检查与修复改动记录

日期：2026-05-30

## 1. 本次验收目标

本次按“全平台所有逻辑不合理的地方全面检查”的要求，对学生端、教师端、管理员端、广场、AI 导师、前端构建、核心后端接口和端到端验收链路进行了检查与修复。

验收覆盖重点：

- 桌面端和移动端同时覆盖。
- 学生、教师、管理员三类角色关键路径覆盖。
- 正常流程、异常输入、空状态、未登录跳转、错误登录、非法接口请求等边界场景覆盖。
- 非 AI 后端接口补充正常和异常测试。
- AI 相关页面补充复杂交互与降级流程测试；资源生成本身按要求不纳入自动化测试。
- 使用 Playwright 做真实页面交互，不只依赖截图。

## 2. 已修复的问题清单

### 2.1 前端端到端验收环境不完整

问题：

- 原 Playwright 只启动前端服务，学生练习、报告、资源等依赖后端的页面无法真实覆盖前后端联动。
- 桌面端和移动端并行运行时会共享单用户后端状态，容易污染测试数据。

改动：

- 修改 `frontend/playwright.config.ts`。
- 增加后端 `uvicorn` 测试服务启动，健康检查地址为 `http://127.0.0.1:8000/health`。
- 保留前端 Next.js 测试服务。
- 将 Playwright `workers` 设置为 `1`，避免桌面端和移动端并发污染共享状态。

### 2.2 缺少跨角色、跨端深度验收脚本

问题：

- 原测试覆盖偏页面级，缺少完整用户路径验证。
- 对移动端布局、空提交、错误登录、未登录访问等异常路径覆盖不足。

改动：

- 新增 `frontend/test/deep-acceptance.spec.ts`。
- 覆盖学生端登录、onboarding、首页、练习、报告、资源无结果、论坛发帖空提交。
- 覆盖教师端错误登录、正确登录、首页、学生列表、学生详情。
- 覆盖管理员端未登录跳转、错误登录、正确登录、论坛管理页面。
- 桌面端和移动端均执行。
- 增加可见文本乱码检查和页面级横向溢出检查。

### 2.3 缺少更广的全平台页面健康扫描与真实互动流

问题：

- 只测关键入口仍无法暴露大量页面在移动端的布局溢出、文本裁切和交互异常。
- 广场、论坛详情、个人设置、教师通知等高频操作缺少端到端验证。

改动：

- 新增 `frontend/test/full-platform-acceptance.spec.ts`。
- 增加学生主站、广场、AI 导师、教师端、管理员端的页面健康扫描。
- 增加页面可见性、可见乱码、页面横向溢出、明显文本裁切检查。
- 增加论坛完整交互：发帖、搜索、详情、空评论校验、评论、点赞、收藏。
- 增加个人设置编辑与保存流程。
- 增加教师通知流程：空标题后端校验、指定学生发送、学生侧已读标记。

### 2.4 练习题接口泄露答案

问题：

- `GET /api/quiz` 返回题目时会把 `correct_answer` 和 `explanation` 一并返回给前端。
- 学生未提交前即可从接口响应中拿到答案，不符合测验业务逻辑。

改动：

- 修改 `backend/app/routes/quiz.py`。
- 题目列表响应移除 `correct_answer` 和 `explanation`。
- 答案解释只保留在提交后的判题结果中。

### 2.5 非法 quiz_id 提交会错误回退到首套题

问题：

- 提交不存在的 `quiz_id` 时，后端会回退使用第一套题。
- 错误请求会得到看似成功的判题结果，掩盖前端或数据状态问题。

改动：

- 修改 `backend/app/routes/quiz.py`。
- 非法 `quiz_id` 提交直接返回 `404`。
- 清理相关调试输出，减少接口噪音。

### 2.6 学习任务完成接口缺少异常语义

问题：

- 完成不存在的学习任务时，接口没有清晰返回 `404`。
- 学习任务 ID 容易在删除后复用，影响事件追踪。
- 贡献计数可能在非完成状态下被错误增加。

改动：

- 修改 `backend/app/routes/learning.py`。
- 不存在的任务完成请求返回 `404`。
- 新任务 ID 增加时间戳，降低删除后重复 ID 风险。
- 仅当任务状态更新为 `completed` 时增加贡献计数。

### 2.7 资源代理存在 SSRF 风险

问题：

- 资源文本/二进制代理没有充分限制目标 URL。
- 可能访问本机、私网、链路本地、保留地址或 `.local` 地址。
- 请求使用了 `verify=False`，降低 HTTPS 校验安全性。

改动：

- 修改 `backend/app/routes/resources.py`。
- 增加公共 HTTP/HTTPS URL 校验。
- 拒绝 localhost、私网、链路本地、多播、保留 IP 和 `.local` 域名。
- 移除 `verify=False`。
- 增加最大重定向次数限制。

### 2.8 generate 页面构建失败

问题：

- `frontend/src/app/(shell)/generate/page.tsx` 直接使用 `useSearchParams`，Next.js 构建时需要 Suspense 边界。
- 导致 `npm run build` 失败。

改动：

- 修改 `frontend/src/app/(shell)/generate/page.tsx`。
- 将使用 `useSearchParams` 的页面内容包进 `Suspense`。
- 生产构建已通过。

### 2.9 论坛发帖和评论空提交体验不合理

问题：

- 新建帖子页对空标题、空正文缺少明确的前端阻断与提示。
- 帖子详情页空评论没有稳定提示，用户不知道提交失败原因。

改动：

- 修改 `frontend/src/app/(shell)/forum/new/page.tsx`。
- 修改 `frontend/src/app/(shell)/forum/[postId]/page.tsx`。
- 发帖空标题提示：`请输入帖子标题`。
- 发帖空正文提示：`请输入正文内容`。
- 空评论提示：`请输入评论内容`，有效输入后清除错误。

### 2.10 教师端和管理员端移动端布局溢出

问题：

- 教师端和管理员端固定侧边栏在窄屏下仍占位，导致移动端内容横向溢出或头部挤压。

改动：

- 修改 `frontend/src/app/(teacher)/teacher/layout.tsx`。
- 修改 `frontend/src/app/(admin)/admin/layout.tsx`。
- 小于 900px 时隐藏固定侧边栏。
- 移除移动端左侧固定 margin。
- 调整 header 和内容区响应式间距。

### 2.11 教师学生列表筛选器移动端挤压

问题：

- 风险等级、学习阶段筛选器在移动端容易横向挤压。

改动：

- 修改 `frontend/src/app/(teacher)/teacher/students/page.tsx`。
- 筛选控件允许换行，降低横向溢出风险。

### 2.12 练习与报告页面移动端横向溢出

问题：

- 练习页题目标题、选项区域、按钮行在小屏上容易撑宽页面。
- 报告页热力图网格可能撑开移动端页面。

改动：

- 修改 `frontend/src/app/(shell)/practice/page.tsx`。
- 修改 `frontend/src/app/(shell)/report/page.tsx`。
- 练习页增加根容器 overflow guard。
- 长题干和选项文本允许换行。
- 选择题选项在小屏下单列显示。
- 报告页热力图增加横向滚动容器，避免页面级横向溢出。

### 2.13 学习路径、错题本、收藏题移动端卡片溢出

问题：

- 学习路径节点在桌面布局中可能撑宽网格。
- 错题本和收藏题卡片中的长文本、标签、按钮在移动端容易撑开页面。

改动：

- 修改 `frontend/src/app/(shell)/path/page.tsx`。
- 修改 `frontend/src/app/(shell)/practice/mistakes/page.tsx`。
- 修改 `frontend/src/app/(shell)/practice/favorites/page.tsx`。
- 使用 `minmax(0, 1fr)`、`min-w-0`、`max-w-full`、`overflow-hidden` 和 `break-words` 约束长内容。
- 移动端卡片操作区改为纵向或可换行布局。

### 2.14 AI 导师相关页面移动端不适配

问题：

- AI 导师、角色页、工作坊页存在固定左侧导航或固定宽列表，移动端容易出现横向溢出。
- 消息标题、角色标签、工具栏在小屏上可读性和换行不稳定。

改动：

- 修改 `frontend/src/app/tutor/page.tsx`。
- 修改 `frontend/src/app/tutor/roles/page.tsx`。
- 修改 `frontend/src/app/tutor/workshop/page.tsx`。
- 移动端隐藏固定左侧导航。
- 对话列表和角色列表改为全宽、限制高度。
- 主内容区在移动端允许自然纵向排列。
- 消息、标题、角色标签和工具栏增加换行、滚动或宽度约束。

### 2.15 广场移动端侧边栏和内容区溢出

问题：

- 广场固定侧边栏在移动端仍占 260px。
- 版块页搜索、筛选、帖子标题和正文摘要在窄屏下可能撑宽页面。

改动：

- 修改 `frontend/src/app/plaza/layout.tsx`。
- 修改 `frontend/src/components/plaza/PlazaSidebar.tsx`。
- 修改 `frontend/src/components/plaza/BoardModulePage.tsx`。
- 移动端隐藏固定侧边栏并移除主内容左边距。
- 搜索和筛选区域允许换行。
- 帖子标题和摘要允许断行。

### 2.16 后端错误详情没有传到前端

问题：

- `fetchJson` 抛错时没有稳定包含 FastAPI 返回的 `detail`。
- 教师通知等页面只能展示泛化错误，用户无法知道是标题、内容还是学生选择有问题。

改动：

- 修改 `frontend/src/lib/api/real.ts`。
- `fetchJson` 支持 string/list 形式的 `detail`，并写入错误消息。
- 修改 `frontend/src/app/(teacher)/teacher/broadcast/page.tsx`。
- 将后端校验详情映射为更友好的标题、内容、学生选择错误提示。

## 3. 新增后端验收测试

新增文件：`backend/tests/test_acceptance_edges.py`

覆盖内容：

- `/api/quiz` 不再泄露 `correct_answer`。
- `/api/quiz` 不再泄露 `explanation`。
- 非法 quiz 提交返回 `404`。
- 完成不存在的学习任务返回 `404`。
- 资源代理拒绝私网、本机、本地域名等 URL。
- 教师通知校验必填字段和非法目标学生。
- 论坛拒绝非法审核动作和非法附件输入。

新增配置：`pytest.ini`

作用：

- 设置 `pythonpath = backend`。
- 设置 `testpaths = backend/tests`。
- 让仓库根目录可以直接执行后端测试。

## 4. 验证结果

已执行并通过：

```bash
pytest -q
```

结果：

```text
13 passed
```

已执行并通过：

```bash
npm run build
```

结果：

```text
Next.js production build passed
```

已执行并通过：

```bash
npx playwright test test/deep-acceptance.spec.ts test/full-platform-acceptance.spec.ts --reporter=line
```

结果：

```text
20 passed
```

已执行并通过：

```bash
npx playwright test test/agent-flow.spec.ts --reporter=line
```

结果：

```text
6 passed
```

说明：

- Playwright 覆盖 `desktop-chromium` 和 `mobile-chromium`。
- 后端和前端服务由 Playwright 配置自动启动。
- 资源生成本身按验收要求未纳入自动化测试。

## 5. 本次涉及的主要文件

前端：

- `frontend/playwright.config.ts`
- `frontend/test/deep-acceptance.spec.ts`
- `frontend/test/full-platform-acceptance.spec.ts`
- `frontend/test/agent-flow.spec.ts`
- `frontend/src/lib/api/real.ts`
- `frontend/src/app/(shell)/generate/page.tsx`
- `frontend/src/app/(shell)/forum/new/page.tsx`
- `frontend/src/app/(shell)/forum/[postId]/page.tsx`
- `frontend/src/app/(shell)/path/page.tsx`
- `frontend/src/app/(shell)/practice/page.tsx`
- `frontend/src/app/(shell)/practice/mistakes/page.tsx`
- `frontend/src/app/(shell)/practice/favorites/page.tsx`
- `frontend/src/app/(shell)/report/page.tsx`
- `frontend/src/app/(teacher)/teacher/layout.tsx`
- `frontend/src/app/(teacher)/teacher/students/page.tsx`
- `frontend/src/app/(teacher)/teacher/broadcast/page.tsx`
- `frontend/src/app/(admin)/admin/layout.tsx`
- `frontend/src/app/plaza/layout.tsx`
- `frontend/src/app/tutor/page.tsx`
- `frontend/src/app/tutor/roles/page.tsx`
- `frontend/src/app/tutor/workshop/page.tsx`
- `frontend/src/components/plaza/PlazaSidebar.tsx`
- `frontend/src/components/plaza/BoardModulePage.tsx`

后端：

- `backend/app/routes/quiz.py`
- `backend/app/routes/learning.py`
- `backend/app/routes/resources.py`
- `backend/tests/test_acceptance_edges.py`
- `pytest.ini`

文档：

- `Dorc/第四阶段开发文档/SparkLearn-全平台逻辑检查与修复改动记录-2026-05-30.md`

## 6. 当前仍需关注的风险

### 6.1 尚不能等同于“所有页面每个按钮穷举验收”

本次已经覆盖三类角色的关键主路径、高风险边界、更多页面健康扫描和若干真实互动流，但平台页面数量较多，仍不能等同于每个页面、每个按钮、每个接口组合都已穷举。

后续建议继续补齐：

- 资源详情、收藏、打开、统计链路。
- 更多管理员增删改查异常路径。
- 教师端班级、干预、报告相关更细粒度用例。
- 广场更多管理动作和权限边界。

### 6.2 仍存在历史数据或文案编码风险

本次新增端到端测试已经对覆盖路径做了可见文本乱码检查，但仓库和运行数据中仍可能存在历史数据或历史文案编码污染。被当前关键路径覆盖到的页面已通过检查，未覆盖页面建议后续单独做一次文案与编码清理。

### 6.3 认证仍偏演示形态

当前前端多处认证状态依赖本地状态或演示账号流程。本次未重构认证体系，也未补齐后端权限校验矩阵。若进入正式生产，需要补充真实 session/token、角色权限和接口级鉴权测试。

### 6.4 后端仍是单用户共享状态

自动化验收已将 Playwright workers 调整为 `1`。这说明当前测试必须串行执行，避免共享状态污染。若后续要并行测试，需要先改造后端测试隔离能力。

### 6.5 lint 尚未完全清理

本次重点是业务逻辑、构建和验收测试。早前执行 `npm run lint` 时仍有既有 lint 问题，包括 `public/vendor` 脚本和部分源码规则问题。本次未将 lint 清零，建议作为独立技术债处理。

### 6.6 测试运行会改动运行时数据

本次测试运行会触发以下运行时数据变化：

- `backend/data/db/sparklearn.db`
- `backend/data/users/single_user/*.json`
- `backend/data/users/single_user/*.jsonl`
- `frontend/test-results/*`
- Python `__pycache__`

这些属于当前项目的本地运行数据和测试产物。本次未擅自清理或回滚，后续如需提交代码，建议先确认哪些运行数据应纳入版本控制，哪些应加入 `.gitignore` 或恢复到基线。

## 7. 验收结论

本次已经修复一批会影响真实使用、测试可靠性、移动端体验和接口安全边界的问题，并新增覆盖学生端、教师端、管理员端、广场和 AI 导师相关页面的桌面端/移动端自动化验收。

当前状态：

- 后端新增边界测试通过：`13 passed`。
- 前端生产构建通过。
- 跨端深度验收和全平台验收通过：`20 passed`。
- AI/Nanobot 流程验收通过：`6 passed`。
- 资源生成本身已按要求跳过。
- 仍建议继续开展按钮级穷举验收、历史编码清理、认证权限体系加固和 lint 清理。
