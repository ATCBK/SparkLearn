# SparkLearn 小程序

基于 Taro 3 + React + TypeScript 开发的个性化学习平台小程序。

## 项目结构

```
miniapp/
├── src/
│   ├── pages/                    # 页面
│   │   ├── home/                # 首页
│   │   ├── graph/               # 知识图谱
│   │   ├── practice/            # 刷题
│   │   ├── profile/             # 个人中心
│   │   ├── practice-result/     # 练习结果
│   │   ├── practice-history/    # 练习历史
│   │   ├── question-detail/     # 题目详情
│   │   ├── graph-detail/        # 知识点详情
│   │   ├── ai-chat/             # AI 对话
│   │   └── settings/            # 设置
│   ├── stores/                  # 状态管理 (Zustand)
│   ├── services/                # API 服务
│   ├── types/                   # TypeScript 类型定义
│   ├── utils/                   # 工具函数
│   └── assets/                  # 静态资源
│       ├── icons/               # 图标
│       ├── images/              # 图片
│       └── styles/              # 样式
├── config/                      # 配置文件
├── project.config.json          # 微信小程序配置
├── package.json                 # 依赖配置
├── tsconfig.json                # TypeScript 配置
└── babel.config.js              # Babel 配置
```

## 开发环境

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- 微信开发者工具

### 安装依赖

```bash
cd miniapp
npm install
```

### 开发模式

```bash
npm run dev:weapp
```

### 构建生产版本

```bash
npm run build:weapp
```

## 功能说明

### 1. 首页
- 用户学习数据概览
- 功能入口（智能刷题、知识图谱、刷题历史、AI 助手）
- 今日学习统计
- 热门知识点推荐
- 快速开始（随机刷题、错题重练）

### 2. 知识图谱
- 知识点分类浏览
- 知识点列表展示
- 掌握度可视化
- 点击查看详情，长按开始练习

### 3. 智能刷题
- 练习配置（题数、难度、题型）
- 多题型支持（单选、多选、判断、填空）
- 实时答题反馈
- 答案解析

### 4. 个人中心
- 用户信息展示
- 学习数据统计
- 功能菜单（刷题历史、错题本、AI 助手）
- 学习分析
- 设置

### 5. 其他页面
- 练习结果：展示练习成绩和统计
- 练习历史：查看历史练习记录
- 题目详情：查看题目完整信息
- 知识点详情：查看知识点掌握度和相关题目
- AI 对话：与 AI 学习助手对话
- 设置：应用设置管理

## 配置说明

### 微信小程序 AppID

在 `project.config.json` 中配置你的小程序 AppID：

```json
{
  "appid": "your-appid-here"
}
```

### API 接口

在 `src/services/api.ts` 中配置后端 API 地址：

```typescript
const BASE_URL = 'http://your-api-server:8000/api';
```

## TabBar 图标

需要在 `src/assets/icons/` 目录下添加以下图标文件：

- `home.png` / `home-active.png` - 首页图标
- `graph.png` / `graph-active.png` - 知识图谱图标
- `practice.png` / `practice-active.png` - 刷题图标
- `profile.png` / `profile-active.png` - 个人中心图标

图标建议尺寸：81x81 像素，PNG 格式。

## 样式规范

- 主题色：#1890FF
- 成功色：#52C41A
- 警告色：#FAAD14
- 错误色：#FF4D4F
- 背景色：#F5F5F5
- 字体大小：22-40px
- 圆角：8-24px

## 后端接口

小程序需要配合后端 API 使用，主要接口包括：

- 用户登录和信息管理
- 知识图谱数据
- 题目获取和答案提交
- 练习历史记录
- 错题管理
- 学习统计
- AI 对话

## 开发注意事项

1. **TypeScript 类型**：所有数据结构都有完整的类型定义，确保类型安全
2. **状态管理**：使用 Zustand 进行全局状态管理
3. **API 封装**：统一的 API 请求封装，支持 token 认证
4. **样式规范**：使用 SCSS，遵循 BEM 命名规范
5. **组件化**：页面和功能模块化开发

## 部署

1. 使用微信开发者工具打开 `dist` 目录
2. 在微信开发者工具中上传代码
3. 在微信公众平台提交审核
4. 审核通过后发布

## 常见问题

### Q: 如何修改 API 地址？

A: 编辑 `src/services/api.ts` 文件中的 `BASE_URL` 变量。

### Q: 如何添加新的页面？

A: 在 `src/pages` 目录下创建新页面，并在 `app.config.ts` 中注册路由。

### Q: 如何自定义主题色？

A: 修改 `src/app.scss` 中的 SCSS 变量。

## 技术支持

如有问题，请联系开发团队或提交 Issue。
