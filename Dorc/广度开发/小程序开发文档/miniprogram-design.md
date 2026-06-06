# SparkLearn 小程序技术设计文档

> **版本**: v1.0 · 2026-06-05
> **状态**: 设计中
> **关联文档**: proposal.md、小程序开发详细设计方案.md

---

## 1. 概述

### 1.1 文档目的

本文档是 SparkLearn 小程序的详细技术设计文档，基于 proposal.md 需求文档，定义小程序的整体技术架构、项目结构、前端组件设计、后端接口设计和路由导航设计。

### 1.2 技术选型

| 层级 | 选型 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | Taro | 3.x | 京东跨端框架，支持 React 语法 |
| UI 组件库 | NutUI | 4.x | Taro 官方推荐的移动端 UI 库 |
| 状态管理 | React Hooks | - | 轻量级状态管理，避免额外依赖 |
| 后端服务 | FastAPI | 复用现有 | 完全复用 web 端后端 |
| 认证方式 | JWT + 微信登录 | - | 新增微信登录接口 |
| 数据库 | SQLite | 复用现有 | 与 web 端共享同一数据库 |

### 1.3 设计原则

1. **最大化复用**：复用 web 端后端接口和业务逻辑
2. **渐进式开发**：按里程碑分阶段交付
3. **性能优先**：分包加载、懒加载、缓存策略
4. **一致性体验**：视觉风格对齐 Apple Pure 设计语言

---

## 2. 项目结构设计

### 2.1 目录结构

```
sparklearn-miniprogram/
├── config/                      # 构建配置
│   ├── dev.ts                   # 开发环境配置
│   ├── prod.ts                  # 生产环境配置
│   └── index.ts                 # 主配置文件
├── src/
│   ├── app.ts                   # 应用入口
│   ├── app.config.ts            # 应用配置（页面路由、分包等）
│   ├── app.scss                 # 全局样式
│   ├── assets/                  # 静态资源
│   │   ├── images/              # 图片资源
│   │   ├── icons/               # 图标资源
│   │   └── fonts/               # 字体资源
│   ├── components/              # 公共组件
│   │   ├── ui/                  # 基础 UI 组件
│   │   │   ├── Button/          # 按钮组件
│   │   │   ├── Card/            # 卡片组件
│   │   │   ├── Input/           # 输入框组件
│   │   │   ├── Modal/           # 弹窗组件
│   │   │   ├── Toast/           # 提示组件
│   │   │   └── index.ts         # 组件导出
│   │   ├── business/            # 业务组件
│   │   │   ├── ChatBubble/      # 对话气泡
│   │   │   ├── QuizCard/        # 练习题卡片
│   │   │   ├── ResourceCard/    # 资源卡片
│   │   │   ├── ProgressRing/    # 环形进度条
│   │   │   ├── MasteryBar/      # 掌握度进度条
│   │   │   └── index.ts         # 组件导出
│   │   └── layout/              # 布局组件
│   │       ├── TabBar/          # 底部导航栏
│   │       ├── PageContainer/   # 页面容器
│   │       └── index.ts         # 组件导出
│   ├── pages/                   # 页面
│   │   ├── index/               # 首页（Tab）
│   │   │   ├── index.tsx
│   │   │   ├── index.config.ts
│   │   │   └── index.scss
│   │   ├── learn/               # 学习页（Tab）
│   │   │   ├── index.tsx
│   │   │   ├── index.config.ts
│   │   │   └── index.scss
│   │   ├── resources/           # 资源页（Tab）
│   │   │   ├── index.tsx
│   │   │   ├── index.config.ts
│   │   │   └── index.scss
│   │   ├── profile/             # 我的页（Tab）
│   │   │   ├── index.tsx
│   │   │   ├── index.config.ts
│   │   │   └── index.scss
│   │   ├── onboarding/          # 学习画像建档
│   │   ├── path/                # 学习路径详情
│   │   ├── practice/            # 练习与错题
│   │   ├── tutor/               # 智能辅导
│   │   ├── video/               # 视频播放
│   │   └── report/              # 学习报告
│   ├── subpackages/             # 分包
│   │   ├── learn/               # 学习功能分包
│   │   │   ├── onboarding/
│   │   │   ├── path/
│   │   │   ├── practice/
│   │   │   ├── tutor/
│   │   │   └── video/
│   │   ├── resources/           # 资源功能分包
│   │   │   ├── list/
│   │   │   ├── feed/
│   │   │   ├── generate/
│   │   │   └── detail/
│   │   └── report/              # 报告功能分包
│   │       └── index/
│   ├── services/                # API 服务层
│   │   ├── api.ts               # API 基础封装
│   │   ├── auth.ts              # 认证相关 API
│   │   ├── profile.ts           # 画像相关 API
│   │   ├── resources.ts         # 资源相关 API
│   │   ├── quiz.ts              # 练习相关 API
│   │   ├── tutor.ts             # 辅导相关 API
│   │   └── index.ts             # 服务导出
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useAuth.ts           # 认证 Hook
│   │   ├── useRequest.ts        # 请求 Hook
│   │   ├── useStreaming.ts      # 流式输出 Hook
│   │   └── index.ts             # Hook 导出
│   ├── utils/                   # 工具函数
│   │   ├── storage.ts           # 本地存储
│   │   ├── format.ts            # 格式化工具
│   │   ├── validate.ts          # 验证工具
│   │   └── index.ts             # 工具导出
│   ├── styles/                  # 全局样式
│   │   ├── variables.scss       # SCSS 变量
│   │   ├── mixins.scss          # SCSS Mixins
│   │   ├── reset.scss           # 样式重置
│   │   └── theme.scss           # 主题样式
│   └── types/                   # TypeScript 类型
│       ├── api.ts               # API 类型定义
│       ├── model.ts             # 数据模型类型
│       └── index.ts             # 类型导出
├── project.config.json          # 微信小程序项目配置
├── package.json                 # 项目依赖
├── tsconfig.json                # TypeScript 配置
└── babel.config.js              # Babel 配置
```

### 2.2 分包策略

**主包**（首次加载，≤ 2MB）：
- 4 个 Tab 页面：`pages/index`、`pages/learn`、`pages/resources`、`pages/profile`
- 公共组件：`components/ui`、`components/layout`
- 工具函数：`utils`、`services`、`hooks`
- 全局样式：`styles`

**分包 1 - 学习功能**：
- `subpackageLearn/pages/onboarding`（学习画像建档）
- `subpackageLearn/pages/path`（学习路径详情）
- `subpackageLearn/pages/practice`（练习与错题）
- `subpackageLearn/pages/tutor`（智能辅导）
- `subpackageLearn/pages/video`（视频播放）

**分包 2 - 资源功能**：
- `subpackageResources/pages/list`（资源中心）
- `subpackageResources/pages/feed`（资源推送）
- `subpackageResources/pages/generate`（资源生成）
- `subpackageResources/pages/detail`（资源详情）

**分包 3 - 报告功能**：
- `subpackageReport/pages/index`（学习报告）

### 2.3 配置文件

**app.config.ts 核心配置**：

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/learn/index',
    'pages/resources/index',
    'pages/profile/index',
  ],
  tabBar: {
    list: [
      { pagePath: 'pages/index/index', text: '首页', iconPath: 'assets/icons/home.png', selectedIconPath: 'assets/icons/home-active.png' },
      { pagePath: 'pages/learn/index', text: '学习', iconPath: 'assets/icons/learn.png', selectedIconPath: 'assets/icons/learn-active.png' },
      { pagePath: 'pages/resources/index', text: '资源', iconPath: 'assets/icons/resource.png', selectedIconPath: 'assets/icons/resource-active.png' },
      { pagePath: 'pages/profile/index', text: '我的', iconPath: 'assets/icons/profile.png', selectedIconPath: 'assets/icons/profile-active.png' },
    ],
    color: '#6b7280',
    selectedColor: '#2563eb',
    backgroundColor: '#ffffff',
  },
  subpackages: [
    { root: 'subpackageLearn', pages: ['pages/onboarding/index', 'pages/path/index', 'pages/practice/index', 'pages/tutor/index', 'pages/video/index'] },
    { root: 'subpackageResources', pages: ['pages/list/index', 'pages/feed/index', 'pages/generate/index', 'pages/detail/index'] },
    { root: 'subpackageReport', pages: ['pages/index/index'] },
  ],
  preloadRule: {
    'pages/index/index': { network: 'all', packages: ['subpackageLearn'] },
    'pages/learn/index': { network: 'all', packages: ['subpackageLearn'] },
    'pages/resources/index': { network: 'all', packages: ['subpackageResources'] },
  },
})
```

---

## 3. 前端组件设计

### 3.1 基础 UI 组件

#### 3.1.1 Button 按钮组件

**功能描述**：
- 支持三种变体：primary（主按钮）、secondary（次按钮）、ghost（幽灵按钮）
- 支持三种尺寸：small、medium、large
- 支持加载状态、禁用状态
- 支持图标按钮

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| variant | 'primary' \| 'secondary' \| 'ghost' | 'primary' | 按钮变体 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 按钮尺寸 |
| loading | boolean | false | 是否加载中 |
| disabled | boolean | false | 是否禁用 |
| icon | ReactNode | - | 图标 |
| block | boolean | false | 是否占满宽度 |
| onClick | () => void | - | 点击事件 |

**样式规范**：
- 主按钮：背景色 #2563eb，文字白色
- 次按钮：背景色 #f3f4f6，文字 #374151
- 幽灵按钮：透明背景，文字 #2563eb
- 圆角：8px
- 最小高度：44px（符合移动端触摸标准）

---

#### 3.1.2 Card 卡片组件

**功能描述**：
- 通用卡片容器
- 支持标题、副标题、操作区
- 支持点击、阴影等交互效果

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | - | 卡片标题 |
| subtitle | string | - | 卡片副标题 |
| extra | ReactNode | - | 右上角操作区 |
| clickable | boolean | false | 是否可点击 |
| bordered | boolean | true | 是否显示边框 |
| shadow | 'none' \| 'small' \| 'medium' | 'small' | 阴影大小 |
| onClick | () => void | - | 点击事件 |

**样式规范**：
- 背景色：#ffffff
- 圆角：12px
- 内边距：16px
- 阴影：0 2px 8px rgba(0, 0, 0, 0.06)

---

#### 3.1.3 Input 输入框组件

**功能描述**：
- 支持文本输入、多行文本
- 支持前缀、后缀图标
- 支持计数器、清除按钮
- 支持错误状态

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'text' \| 'number' \| 'password' \| 'textarea' | 'text' | 输入框类型 |
| value | string | - | 输入值 |
| placeholder | string | - | 占位符 |
| maxLength | number | - | 最大长度 |
| showCount | boolean | false | 是否显示计数器 |
| clearable | boolean | false | 是否可清除 |
| prefix | ReactNode | - | 前缀图标 |
| suffix | ReactNode | - | 后缀图标 |
| error | boolean | false | 是否错误状态 |
| errorMessage | string | - | 错误提示 |
| onChange | (value: string) => void | - | 值变化事件 |

---

#### 3.1.4 Modal 弹窗组件

**功能描述**：
- 模态弹窗
- 支持标题、内容、操作按钮
- 支持自定义内容

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| visible | boolean | false | 是否可见 |
| title | string | - | 弹窗标题 |
| content | string | - | 弹窗内容 |
| showCancel | boolean | true | 是否显示取消按钮 |
| cancelText | string | '取消' | 取消按钮文字 |
| confirmText | string | '确定' | 确认按钮文字 |
| onConfirm | () => void | - | 确认事件 |
| onCancel | () => void | - | 取消事件 |
| onClose | () => void | - | 关闭事件 |

---

#### 3.1.5 Toast 提示组件

**功能描述**：
- 轻提示
- 支持成功、失败、警告、加载等类型
- 支持自动消失

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'success' \| 'fail' \| 'warning' \| 'loading' | - | 提示类型 |
| message | string | - | 提示内容 |
| duration | number | 2000 | 显示时长（ms） |
| visible | boolean | false | 是否可见 |

---

### 3.2 业务组件

#### 3.2.1 ChatBubble 对话气泡组件

**功能描述**：
- AI 对话气泡
- 支持用户消息和 AI 消息两种样式
- 支持流式输出（打字机效果）
- 支持代码块展示和复制

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'user' \| 'ai' | - | 消息类型 |
| content | string | - | 消息内容 |
| streaming | boolean | false | 是否流式输出中 |
| avatar | string | - | 头像地址 |
| timestamp | string | - | 时间戳 |

**样式规范**：
- 用户消息：背景色 #2563eb，文字白色，右对齐
- AI 消息：背景色 #f3f4f6，文字 #374151，左对齐
- 代码块：背景色 #1f2937，文字 #e5e7eb，等宽字体
- 复制按钮：悬浮于代码块右上角

---

#### 3.2.2 QuizCard 练习题卡片组件

**功能描述**：
- 支持单选题、多选题、填空题
- 支持答题反馈（正确/错误）
- 支持解析展示

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'single' \| 'multiple' \| 'fill' | - | 题目类型 |
| question | string | - | 题目内容 |
| options | Array\<{id: string, text: string}\> | - | 选项列表 |
| answer | string \| string[] | - | 正确答案 |
| explanation | string | - | 解析 |
| onSubmit | (answer: string \| string[]) => void | - | 提交答案 |

**交互逻辑**：
- 用户选择/输入答案后点击提交
- 调用后端接口验证答案
- 显示正确/错误反馈（绿色/橙色背景）
- 展示解析内容

---

#### 3.2.3 ResourceCard 资源卡片组件

**功能描述**：
- 资源列表卡片
- 支持缩略图、标题、类型标签
- 支持推荐理由展示

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | string | - | 资源 ID |
| title | string | - | 资源标题 |
| type | string | - | 资源类型 |
| thumbnail | string | - | 缩略图地址 |
| reason | string | - | 推荐理由 |
| onClick | (id: string) => void | - | 点击事件 |

---

#### 3.2.4 ProgressRing 环形进度条组件

**功能描述**：
- 环形进度展示
- 支持自定义大小、颜色
- 支持中心文字

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| percent | number | 0 | 进度百分比（0-100） |
| size | number | 80 | 组件大小（px） |
| strokeWidth | number | 8 | 线条宽度 |
| color | string | '#2563eb' | 进度条颜色 |
| bgColor | string | '#e5e7eb' | 背景颜色 |
| text | string | - | 中心文字 |

**实现方式**：
- 使用 Canvas 2D 绘制
- 支持动画过渡效果

---

#### 3.2.5 MasteryBar 掌握度进度条组件

**功能描述**：
- 知识点掌握度展示
- 渐变色进度条
- 支持标签和数值

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| label | string | - | 知识点名称 |
| score | number | 0 | 掌握度分数（0-1） |
| showValue | boolean | true | 是否显示数值 |

**样式规范**：
- 进度条高度：8px
- 圆角：4px
- 渐变色：根据分数动态计算
  - 0-0.3：红色系 (#ef4444 → #f87171)
  - 0.3-0.6：橙色系 (#f59e0b → #fbbf24)
  - 0.6-1.0：绿色系 (#10b981 → #34d399)

---

### 3.3 布局组件

#### 3.3.1 TabBar 底部导航栏

**功能描述**：
- 4 个 Tab：首页、学习、资源、我的
- 支持图标和文字
- 支持选中状态切换

**配置**：

| Tab | 图标 | 选中图标 | 页面路径 |
|-----|------|----------|----------|
| 首页 | home.png | home-active.png | pages/index/index |
| 学习 | learn.png | learn-active.png | pages/learn/index |
| 资源 | resource.png | resource-active.png | pages/resources/index |
| 我的 | profile.png | profile-active.png | pages/profile/index |

**样式规范**：
- 高度：50px + 安全区域
- 背景色：#ffffff
- 图标大小：24px
- 文字大小：10px
- 选中颜色：#2563eb
- 未选中颜色：#6b7280

---

#### 3.3.2 PageContainer 页面容器

**功能描述**：
- 统一页面容器
- 支持下拉刷新
- 支持加载状态
- 支持安全区域适配

**Props 定义**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | - | 页面标题 |
| showBack | boolean | false | 是否显示返回按钮 |
| showRefresh | boolean | false | 是否支持下拉刷新 |
| loading | boolean | false | 是否加载中 |
| onRefresh | () => void | - | 刷新事件 |

---

## 4. 后端接口设计

### 4.1 接口概述

小程序完全复用 web 端后端接口，仅需新增 1 个微信登录接口。

**复用接口清单**（17 个）：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/profile` | GET | 获取学生画像 |
| `/api/profile` | PUT | 更新学生画像 |
| `/api/profile/initiate` | POST | 启动建档 |
| `/api/profile/chat` | POST | 建档对话（流式） |
| `/api/learning-path` | GET | 获取学习路径 |
| `/api/resources` | GET | 获取资源列表 |
| `/api/resources/{id}` | GET | 获取资源详情 |
| `/api/resources/generate` | POST | 生成资源（流式） |
| `/api/tasks/today` | GET | 获取今日任务 |
| `/api/tasks/{id}/complete` | PUT | 完成任务 |
| `/api/quiz` | GET | 获取练习题 |
| `/api/quiz/submit` | POST | 提交答案 |
| `/api/quiz/wrong` | GET | 获取错题列表 |
| `/api/tutor/chat` | POST | 智能辅导（流式） |
| `/api/tutor/history` | GET | 辅导历史 |
| `/api/evaluation/report` | GET | 学习报告 |
| `/api/contribution` | GET | 打卡数据 |

**新增接口**（1 个）：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/wechat-login` | POST | 微信登录 |

---

### 4.2 微信登录接口详细设计

#### 4.2.1 接口定义

**接口路径**：`POST /api/auth/wechat-login`

**接口描述**：
微信小程序登录接口，接收前端通过 `wx.login()` 获取的临时 code，调用微信接口换取 openid，完成用户认证。

**认证要求**：无需认证（登录接口）

---

#### 4.2.2 请求参数

**请求头**：

| Header | 值 | 说明 |
|--------|-----|------|
| Content-Type | application/json | JSON 格式 |

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 微信登录临时凭证，由 `wx.login()` 获取 |

**请求示例**：

```json
{
  "code": "0a3lGd000xxxxx"
}
```

---

#### 4.2.3 响应参数

**成功响应**（HTTP 200）：

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 固定为 true |
| data | object | 响应数据 |
| data.openid | string | 微信用户唯一标识 |
| data.token | string | JWT Token |
| data.is_new_user | boolean | 是否为新用户 |
| data.user | object | 用户信息 |
| data.user.user_id | string | 用户 ID |
| data.user.name | string | 用户名称 |
| data.user.avatar | string | 用户头像 |

**成功响应示例**：

```json
{
  "success": true,
  "data": {
    "openid": "oXXXXxxx",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "is_new_user": false,
    "user": {
      "user_id": "wx_oXXXXxxx",
      "name": "张同学",
      "avatar": "https://thirdwx.qlogo.cn/mmopen/..."
    }
  }
}
```

**错误响应**：

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | INVALID_CODE | code 无效或已过期 |
| 500 | WX_API_ERROR | 微信接口调用失败 |
| 500 | SERVER_ERROR | 服务器内部错误 |

**错误响应示例**：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CODE",
    "message": "微信登录凭证无效"
  }
}
```

---

#### 4.2.4 业务流程

```
前端调用 wx.login() 获取 code
        ↓
调用 POST /api/auth/wechat-login
        ↓
后端接收 code 参数
        ↓
调用微信接口 jscode2session
GET https://api.weixin.qq.com/sns/jscode2session
  ?appid=APPID
  &secret=SECRET
  &js_code=CODE
  &grant_type=authorization_code
        ↓
微信返回 openid 和 session_key
        ↓
查询数据库 students 表
  WHERE openid = ?
        ↓
┌─────────────────────────────────────┐
│ 用户存在                            │
│   → 更新 last_login_at              │
│   → 生成 JWT Token                  │
│   → 返回 is_new_user = false        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 用户不存在                          │
│   → 创建新用户记录                   │
│   → 创建空画像记录                   │
│   → 生成 JWT Token                  │
│   → 返回 is_new_user = true         │
└─────────────────────────────────────┘
```

---

#### 4.2.5 数据库变更

**students 表新增字段**：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| openid | TEXT | '' | 微信用户唯一标识 |
| unionid | TEXT | '' | 微信开放平台唯一标识（可选） |
| login_type | TEXT | 'phone' | 登录类型：phone / wechat |

**SQL 变更语句**：

```sql
-- 新增 openid 字段
ALTER TABLE students ADD COLUMN openid TEXT DEFAULT '';

-- 新增 unionid 字段
ALTER TABLE students ADD COLUMN unionid TEXT DEFAULT '';

-- 新增 login_type 字段
ALTER TABLE students ADD COLUMN login_type TEXT DEFAULT 'phone';

-- 创建 openid 索引
CREATE INDEX IF NOT EXISTS idx_students_openid ON students(openid);
```

---

#### 4.2.6 实现伪代码

```python
# 后端实现逻辑（FastAPI）

@router.post("/wechat-login")
async def wechat_login(req: WechatLoginReq):
    # 1. 调用微信接口获取 openid
    wx_response = await call_wechat_jscode2session(req.code)
    
    if "errcode" in wx_response:
        raise HTTPException(status_code=400, detail="微信登录失败")
    
    openid = wx_response["openid"]
    session_key = wx_response["session_key"]
    
    # 2. 查询用户是否存在
    user = fetch_one("SELECT * FROM students WHERE openid = ?", (openid,))
    
    if user:
        # 3a. 用户存在，更新登录时间
        execute("UPDATE students SET last_login_at = ? WHERE user_id = ?", 
                (now_iso(), user["user_id"]))
        is_new_user = False
    else:
        # 3b. 用户不存在，创建新用户
        user_id = f"wx_{openid}"
        execute("""
            INSERT INTO students (user_id, name, openid, login_type, created_at, updated_at)
            VALUES (?, ?, ?, 'wechat', ?, ?)
        """, (user_id, f"用户{openid[-4:]}", openid, now_iso(), now_iso()))
        
        # 创建空画像
        execute("INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)", 
                (user_id, now_iso()))
        
        is_new_user = True
        user = {"user_id": user_id, "name": f"用户{openid[-4:]}", "avatar": ""}
    
    # 4. 生成 JWT Token
    token = create_access_token(user["user_id"])
    
    # 5. 返回响应
    return ok({
        "openid": openid,
        "token": token,
        "is_new_user": is_new_user,
        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "avatar": user.get("avatar", ""),
        }
    })
```

---

### 4.3 接口调用规范

#### 4.3.1 请求头规范

所有需要认证的接口，请求头需携带：

```
Authorization: Bearer <token>
Content-Type: application/json
```

#### 4.3.2 响应格式规范

**成功响应**：

```json
{
  "success": true,
  "data": { ... }
}
```

**错误响应**：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

#### 4.3.3 流式输出接口

**接口**：`/api/profile/chat`、`/api/resources/generate`、`/api/tutor/chat`

**实现方式**：
- 使用 `wx.request` 的 `onChunkReceived` 回调
- 服务端返回 `Transfer-Encoding: chunked`
- 前端逐块接收并渲染

**数据格式**：

```
data: {"type": "text", "content": "你"}
data: {"type": "text", "content": "好"}
data: {"type": "progress", "stage": "生成中", "percent": 50}
data: {"type": "done", "content": "完整内容"}
```

---

## 5. 路由与导航设计

### 5.1 页面路由表

| 页面 | 路径 | 分包 | 来源页面 | 说明 |
|------|------|------|----------|------|
| 首页 | `/pages/index/index` | 主包 | Tab | 学习总览 |
| 学习 | `/pages/learn/index` | 主包 | Tab | 学习功能聚合 |
| 资源 | `/pages/resources/index` | 主包 | Tab | 资源功能聚合 |
| 我的 | `/pages/profile/index` | 主包 | Tab | 个人功能聚合 |
| 学习画像建档 | `/subpackageLearn/pages/onboarding/index` | 分包1 | 首次登录 | 5步对话式建档 |
| 学习路径详情 | `/subpackageLearn/pages/path/index` | 分包1 | 首页/学习 | 当前阶段和进度 |
| 练习与错题 | `/subpackageLearn/pages/practice/index` | 分包1 | 学习 | 练习/错题/收藏 |
| 智能辅导 | `/subpackageLearn/pages/tutor/index` | 分包1 | 学习 | 对话式辅导 |
| 视频播放 | `/subpackageLearn/pages/video/index` | 分包1 | 学习 | 视频播放 |
| 资源中心 | `/subpackageResources/pages/list/index` | 分包2 | 资源 | 搜索+筛选+列表 |
| 资源推送 | `/subpackageResources/pages/feed/index` | 分包2 | 资源 | AI推荐卡片 |
| 资源生成 | `/subpackageResources/pages/generate/index` | 分包2 | 资源 | 类型选择+需求输入 |
| 资源详情 | `/subpackageResources/pages/detail/index` | 分包2 | 资源生成 | 资源内容展示 |
| 学习报告 | `/subpackageReport/pages/index/index` | 分包3 | 我的 | 统计+薄弱点 |

---

### 5.2 导航流设计

#### 5.2.1 首次登录流程

```
用户打开小程序
        ↓
检查本地 Token
        ↓
┌─────────────────────────────────────┐
│ Token 不存在或已过期                  │
│   → 调用 wx.login() 获取 code       │
│   → 调用 /api/auth/wechat-login     │
│   → 判断 is_new_user                │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│ is_new_user = true                  │
│   → 跳转学习画像建档页               │
│   → 完成 5 步建档                   │
│   → 跳转首页                        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ is_new_user = false                 │
│   → 直接跳转首页                    │
└─────────────────────────────────────┘
```

#### 5.2.2 主导航流

```
首页（Tab）
├── 学习路径详情 → 返回首页
├── 练习与错题 → 返回首页
├── 智能辅导 → 返回首页
├── 视频播放 → 返回首页
├── 资源中心 → 返回首页
├── 资源推送 → 返回首页
├── 资源生成 → 资源详情 → 返回资源生成
└── 学习报告 → 返回首页

学习（Tab）
├── 学习路径 → 学习路径详情
├── 练习入口 → 练习与错题
├── 辅导入口 → 智能辅导
└── 视频入口 → 视频播放

资源（Tab）
├── 资源中心 → 资源列表 → 资源详情
├── 资源推送 → 资源详情
└── 资源生成 → 资源详情

我的（Tab）
├── 个人信息 → 编辑个人信息
└── 学习报告 → 学习报告页
```

---

### 5.3 页面跳转方式

#### 5.3.1 Tab 切换

使用 `Taro.switchTab()` 切换底部 Tab：

```typescript
Taro.switchTab({ url: '/pages/index/index' })
```

#### 5.3.2 普通页面跳转

使用 `Taro.navigateTo()` 跳转到非 Tab 页面：

```typescript
Taro.navigateTo({ url: '/subpackageLearn/pages/practice/index' })
```

#### 5.3.3 返回上一页

使用 `Taro.navigateBack()` 返回：

```typescript
Taro.navigateBack({ delta: 1 })
```

#### 5.3.4 重定向

使用 `Taro.redirectTo()` 关闭当前页并跳转：

```typescript
Taro.redirectTo({ url: '/pages/index/index' })
```

---

### 5.4 页面参数传递

#### 5.4.1 通过 URL 参数传递

```typescript
// 跳转时传递参数
Taro.navigateTo({ url: '/subpackageResources/pages/detail/index?id=123' })

// 目标页面接收参数
const router = useRouter()
const id = router.params.id
```

#### 5.4.2 通过全局状态传递

使用 React Context 或全局状态管理复杂数据：

```typescript
// 定义 Context
const ProfileContext = createContext<Profile | null>(null)

// 提供数据
<ProfileContext.Provider value={profile}>
  <App />
</ProfileContext.Provider>

// 消费数据
const profile = useContext(ProfileContext)
```

---

### 5.5 预加载策略

**配置说明**：

| 触发页面 | 预加载分包 | 网络条件 |
|----------|------------|----------|
| 首页 | 学习功能分包 | 所有网络 |
| 学习页 | 学习功能分包 | 所有网络 |
| 资源页 | 资源功能分包 | 所有网络 |

**实现方式**：
在 `app.config.ts` 中配置 `preloadRule`：

```typescript
preloadRule: {
  'pages/index/index': {
    network: 'all',
    packages: ['subpackageLearn'],
  },
  'pages/learn/index': {
    network: 'all',
    packages: ['subpackageLearn'],
  },
  'pages/resources/index': {
    network: 'all',
    packages: ['subpackageResources'],
  },
},
```

---

## 6. 状态管理设计

### 6.1 状态分层

| 层级 | 状态类型 | 存储方式 | 说明 |
|------|----------|----------|------|
| 全局状态 | 用户信息、Token | localStorage | 跨页面共享 |
| 页面状态 | 页面数据、加载状态 | useState | 页面内部使用 |
| 组件状态 | 表单数据、UI 状态 | useState | 组件内部使用 |

### 6.2 全局状态管理

**认证状态**（useAuth Hook）：

```typescript
interface AuthState {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthActions {
  login: (code: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}
```

**状态持久化**：
- Token：存储在 `wx.setStorageSync('token', token)`
- 用户信息：存储在 `wx.setStorageSync('user', userInfo)`
- 过期时间：Token 内嵌 exp 字段，每次请求前校验

---

### 6.3 请求状态管理

**useRequest Hook**：

```typescript
interface RequestState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

interface RequestActions {
  run: () => Promise<void>
  refresh: () => Promise<void>
  mutate: (data: T) => void
}
```

**使用示例**：

```typescript
const { data, loading, error, run } = useRequest(() => api.getResources())

useEffect(() => {
  run()
}, [])
```

---

## 7. 网络请求设计

### 7.1 API 基础封装

**请求拦截器**：
- 自动添加 Authorization header
- 自动添加 Content-Type
- 请求日志记录

**响应拦截器**：
- 统一错误处理
- Token 过期自动跳转登录
- 响应数据格式化

---

### 7.2 流式输出实现

**实现方案**：
使用 `wx.request` 的 `onChunkReceived` 回调实现流式输出。

**核心逻辑**：

```typescript
function useStreaming(url: string) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  const startStream = useCallback((params: any) => {
    setLoading(true)
    setContent('')

    const requestTask = wx.request({
      url: `${BASE_URL}${url}`,
      method: 'POST',
      data: params,
      enableChunked: true,
      success: () => setLoading(false),
      fail: () => setLoading(false),
    })

    requestTask.onChunkReceived((response) => {
      const text = arrayBufferToString(response.data)
      setContent(prev => prev + text)
    })
  }, [url])

  return { content, loading, startStream }
}
```

---

## 8. 本地存储设计

### 8.1 存储规范

| Key | 类型 | 说明 | 有效期 |
|-----|------|------|--------|
| token | string | JWT Token | 登录期间 |
| user | object | 用户信息 | 登录期间 |
| profile | object | 学习画像 | 永久 |
| preferences | object | 用户偏好设置 | 永久 |
| last_sync | string | 最后同步时间 | 永久 |

### 8.2 存储工具

```typescript
// 封装 wx.setStorageSync
export function setStorage<T>(key: string, value: T): void {
  try {
    wx.setStorageSync(key, value)
  } catch (e) {
    console.error('存储失败:', e)
  }
}

// 封装 wx.getStorageSync
export function getStorage<T>(key: string): T | null {
  try {
    return wx.getStorageSync(key) as T
  } catch (e) {
    return null
  }
}

// 清除认证相关存储
export function clearAuthStorage(): void {
  wx.removeStorageSync('token')
  wx.removeStorageSync('user')
}
```

---

## 9. 错误处理设计

### 9.1 错误类型

| 错误类型 | 处理方式 | 用户提示 |
|----------|----------|----------|
| 网络错误 | 重试机制 | "网络连接失败，请重试" |
| 认证失败 | 跳转登录 | "登录已过期，请重新登录" |
| 业务错误 | 显示提示 | 显示后端返回的错误信息 |
| 未知错误 | 上报日志 | "系统异常，请稍后重试" |

### 9.2 全局错误处理

```typescript
// 全局错误拦截
Taro.onError((error) => {
  console.error('全局错误:', error)
  // 上报错误日志
})

// 请求错误处理
function handleRequestError(error: any) {
  if (error.statusCode === 401) {
    // Token 过期，跳转登录
    clearAuthStorage()
    Taro.redirectTo({ url: '/pages/login/index' })
  } else if (error.statusCode >= 500) {
    // 服务器错误
    Taro.showToast({ title: '系统异常，请稍后重试', icon: 'none' })
  } else {
    // 其他错误
    Taro.showToast({ title: error.message || '请求失败', icon: 'none' })
  }
}
```

---

## 10. 性能优化设计

### 10.1 分包加载

- 主包体积控制在 2MB 以内
- 非核心页面放入分包
- 配置预加载策略

### 10.2 图片优化

- 使用 WebP 格式
- 实现图片懒加载
- 使用 CDN 加速

### 10.3 数据缓存

- 接口数据本地缓存
- 设置合理的缓存过期时间
- 下拉刷新时清除缓存

### 10.4 渲染优化

- 虚拟列表（长列表）
- 避免不必要的重渲染
- 使用 useMemo/useCallback

---

## 11. 安全设计

### 11.1 数据安全

- HTTPS 传输加密
- Token 安全存储
- 敏感信息不落本地日志

### 11.2 接口安全

- JWT Token 认证
- 接口签名验证（可选）
- 请求频率限制

### 11.3 微信登录安全

- code 一次性使用
- session_key 不下发前端
- openid 不直接暴露给前端

---

## 12. 测试策略

### 12.1 单元测试

- 工具函数测试
- 组件渲染测试
- Hook 逻辑测试

### 12.2 集成测试

- 页面跳转测试
- 接口联调测试
- 状态管理测试

### 12.3 端到端测试

- 核心流程测试
- 边界场景测试
- 性能测试

---

## 13. 部署与发布

### 13.1 构建流程

```bash
# 开发环境
npm run dev:weapp

# 生产环境
npm run build:weapp
```

### 13.2 发布流程

1. 本地构建测试
2. 上传代码到微信开发者工具
3. 提交审核
4. 审核通过后发布

### 13.3 版本管理

- 遵循语义化版本号
- 记录版本更新日志
- 支持灰度发布

---

## 附录 A：术语表

| 术语 | 说明 |
|------|------|
| Taro | 京东开源的跨端框架，支持 React 语法 |
| NutUI | Taro 官方推荐的移动端 UI 组件库 |
| 流式输出 | AI 逐字输出，模拟打字效果 |
| 掌握度 | 学生对知识点的掌握程度，0-1 范围 |
| Apple Pure | 苹果纯净设计语言，强调简洁、留白、层次清晰 |
| JWT | JSON Web Token，用于用户认证 |
| openid | 微信用户唯一标识 |

---

## 附录 B：参考文档

- [proposal.md](proposal.md) - 需求文档
- [小程序开发详细设计方案.md](小程序开发详细设计方案.md) - 详细设计方案
- [Taro 官方文档](https://taro-docs.jd.com/) - Taro 框架文档
- [NutUI 官方文档](https://nutui.jd.com/) - NutUI 组件库文档
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/) - 微信官方文档

---

*本文档随开发迭代持续更新。最后更新：2026-06-05 v1.0*
