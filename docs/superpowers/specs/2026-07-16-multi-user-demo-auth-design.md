# SparkLearn 多用户演示与真实注册设计

## 背景

当前 SparkLearn 已经具备学生端、教师端、社区端、桌面端、小程序端等产品能力，也已经有短信验证码注册登录、JWT、本地用户存储和首次画像采集页面。但后端大量业务仍以 `settings.single_user_id` 和 `backend/data/users/single_user/` 作为默认读写空间，导致评审演示和真实新用户体验混在一起。

本设计目标是把系统改造成两条清晰轨道：

- 演示账号轨道：使用指定手机号和密码登录后，直接进入完整演示页面，展示已有画像、路径、资源、练习、报告、Tutor、知识库等能力。
- 真实新用户轨道：评委或新用户自行注册后，从空白系统开始，完成 onboarding，再逐步生成自己的学习数据。空内容区域用矢量插画、简短说明和明确行动按钮承接。

## 目标

1. 支持手机号 + 密码登录，作为演示账号和真实用户回访的稳定登录方式。
2. 保留手机号 + 验证码登录，用于快速登录、注册验证和后续找回密码能力扩展。
3. 注册时要求设置密码，并在前后端做一致的密码强度校验。
4. 通过配置识别演示账号，让指定手机号进入完整演示数据空间。
5. 让非演示账号使用独立用户空间，初始状态为空，不再读取 `single_user` 的演示数据。
6. 为资源、练习、报告、知识库、导师对话等模块提供真实空状态。

## 非目标

- 本阶段不做复杂组织、多学校、多班级租户模型。
- 本阶段不重构教师端完整权限体系，只保证学生端数据不串号。
- 本阶段不引入第三方 OAuth。
- 本阶段不把所有历史演示数据删除，而是把它转化为演示账号或模板数据。

## 用户体验设计

### 登录页

登录卡片内增加二级切换：

- 密码登录：手机号、密码、登录按钮。
- 验证码登录：手机号、验证码、获取验证码、登录按钮。

注册入口仍在同一页面。注册表单包含：

- 手机号
- 验证码
- 昵称
- 密码
- 确认密码

密码规则：

- 至少 8 位。
- 必须包含字母和数字。
- 前端实时提示，后端强制校验。
- 密码只保存哈希，禁止保存明文。

### 演示账号

新增环境配置：

```env
DEMO_USER_PHONE=13800000000
DEMO_USER_ID=demo_user
```

当用户使用 `DEMO_USER_PHONE` 登录成功时，后端返回的用户身份绑定到 `DEMO_USER_ID`。演示账号进入系统后：

- 跳过首次 onboarding。
- 直接进入学生端首页。
- 使用完整演示数据，包括学习画像、路径、任务、资源、练习记录、报告、Tutor 对话和知识库内容。
- 演示数据可以从当前 `single_user` 数据迁移或复制到 `demo_user`。

### 真实新用户

非演示手机号注册成功后：

- 创建独立 `user_id`。
- 创建空 `profiles` 记录。
- 创建用户目录 `backend/data/users/{user_id}/`。
- 不复制演示资源、练习、报告或对话。
- 登录后进入 `/onboarding`。

onboarding 完成后：

- 写入用户画像。
- 生成或展示个性化学习路径。
- 首页展示属于该用户的任务、路径和推荐入口。

## 空状态设计

真实新用户没有数据时，各模块不能显示演示内容，也不能只显示空白。统一采用：

- 轻量矢量插画。
- 一句话说明当前为空的原因。
- 一个主操作按钮。
- 一个可选次操作链接。

建议空状态：

| 模块 | 空状态说明 | 主操作 |
| --- | --- | --- |
| 学习路径 | 完成画像后生成第一条学习路径 | 去完善画像 |
| 资源库 | 还没有学习资源 | 生成第一份资源 |
| 知识库 | 还没有上传资料 | 上传第一份资料 |
| 练习 | 还没有练习记录 | 生成第一套练习 |
| 报告 | 完成练习后生成报告 | 开始一次练习 |
| Tutor 对话 | 还没有和导师对话 | 开始提问 |
| 视频资源 | 还没有生成视频 | 生成学习视频 |
| 学习发现收藏 | 还没有收藏内容 | 去学习发现 |

插画实现建议：

- 第一阶段使用本地 SVG 组件或 CSS + SVG 组合，避免外部资源依赖。
- 统一放在 `frontend/src/components/empty-states/`。
- 每个空状态组件接收 `title`、`description`、`actionLabel`、`onAction`。

## 后端设计

### 配置

新增配置字段：

- `demo_user_phone`
- `demo_user_id`
- `auth_password_min_length`
- `auth_password_require_letter`
- `auth_password_require_digit`

### 数据库

扩展 `students` 表：

- `password_hash TEXT DEFAULT ''`
- `is_demo INTEGER DEFAULT 0`
- `auth_provider TEXT DEFAULT 'phone'`

保持 `user_id` 为所有业务数据隔离键。

### 认证接口

新增接口：

- `POST /api/auth/password/login`

请求：

```json
{
  "phone": "13800000000",
  "password": "password123"
}
```

返回沿用现有 token 结构：

```json
{
  "token": "...",
  "user": {
    "user_id": "demo_user",
    "name": "演示账号",
    "phone": "13800000000",
    "is_demo": true
  }
}
```

扩展接口：

- `POST /api/auth/sms/register`

新增字段：

```json
{
  "phone": "13800000000",
  "code": "123456",
  "name": "张同学",
  "password": "password123"
}
```

### 当前用户上下文

逐步移除路由中的 `settings.single_user_id` 直接读写，改为：

```python
current_user: dict = Depends(get_current_user)
user_id = current_user["user_id"]
```

文件读写统一使用当前用户：

```python
read_json(user_id, "resources_index.json", [])
write_json(user_id, "task_progress.json", tasks)
append_jsonl(user_id, "learning_events.jsonl", event)
```

第一阶段优先改造学生端主链路：

1. profile
2. learning
3. resources
4. quiz
5. knowledge
6. tutor_eval

第二阶段再改造：

1. forum
2. teacher
3. agent
4. video
5. mcp
6. voice_admin

## 演示数据迁移

保留当前 `single_user` 数据作为演示源。初始化时如果 `demo_user` 目录不存在，可以执行一次迁移：

1. 创建 `students` 中的 `demo_user`。
2. 复制 `backend/data/users/single_user/` 到 `backend/data/users/demo_user/`。
3. 将数据库中属于 `single_user` 的演示记录复制到 `demo_user`。
4. 标记 `students.is_demo = 1`。

迁移脚本应可重复执行，重复执行不破坏已有演示数据。

## 前端设计

### 登录注册页面

`frontend/src/app/auth/page.tsx` 增加登录方式状态：

- `loginMethod: "password" | "sms"`

密码登录调用 `passwordLogin`。

注册增加：

- `password`
- `confirmPassword`
- 密码强度提示

注册成功后：

- 演示账号：进入 `/`
- 真实新用户：进入 `/onboarding`

### API 客户端

`frontend/src/lib/api/real.ts` 新增：

```ts
export async function passwordLogin(phone: string, password: string)
```

扩展：

```ts
export async function smsRegister(phone: string, code: string, name: string, password: string)
```

### 空状态组件

新增通用组件：

- `EmptyState`
- `EmptyResourceState`
- `EmptyPracticeState`
- `EmptyReportState`
- `EmptyKnowledgeState`

空状态组件要符合现有产品风格：干净、轻量、信息明确，不做营销式大卡片。

## 安全设计

- 密码使用 `passlib[bcrypt]` 或等价哈希方案。
- 登录失败返回统一错误，不泄露手机号是否存在的过多细节。
- JWT 继续使用 `sub = user_id`。
- `JWT_SECRET` 后续应从环境变量读取，不能长期使用硬编码默认值。
- 演示账号密码通过初始化脚本或管理配置设置，不写入代码。

## 验收标准

1. 使用演示手机号 + 密码登录后，进入完整演示首页。
2. 使用新手机号注册后，进入 onboarding。
3. 新用户未完成数据沉淀前，各模块显示空状态，不显示演示数据。
4. 两个不同新用户之间资源、练习、画像、任务互不影响。
5. 验证码登录仍可用。
6. 密码登录错误时给出清晰提示。
7. 注册密码不满足规则时前后端都拒绝。
8. 后端测试覆盖注册、密码登录、演示账号识别、用户隔离。

## 实施顺序

1. 扩展认证模型和数据库字段。
2. 新增密码哈希与密码登录接口。
3. 扩展注册流程，要求设置密码。
4. 增加演示账号配置和初始化逻辑。
5. 改造 profile、learning、resources、quiz 主链路使用当前用户。
6. 增加前端登录方式切换和注册密码字段。
7. 增加空状态组件并接入学生端核心页面。
8. 补测试和 README。

