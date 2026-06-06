# 贡献指南

感谢您对 SparkLearn 小程序项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 1. 报告问题

如果您发现了 bug 或有功能建议，请创建 Issue：

1. 点击 "Issues" 标签
2. 点击 "New Issue" 按钮
3. 选择问题类型（bug 报告或功能请求）
4. 填写详细信息
5. 提交 Issue

### 2. 提交代码

#### 步骤 1: Fork 项目

1. 点击项目页面右上角的 "Fork" 按钮
2. 将项目克隆到本地：

```bash
git clone https://github.com/your-username/SparkLearn.git
cd SparkLearn/miniapp
```

#### 步骤 2: 创建分支

```bash
git checkout -b feature/your-feature-name
```

#### 步骤 3: 修改代码

1. 进行您的修改
2. 确保代码符合项目规范
3. 添加必要的测试

#### 步骤 4: 提交更改

```bash
git add .
git commit -m "feat: 添加新功能"
```

#### 步骤 5: 推送代码

```bash
git push origin feature/your-feature-name
```

#### 步骤 6: 创建 Pull Request

1. 点击 "Pull Requests" 标签
2. 点击 "New Pull Request" 按钮
3. 选择您的分支
4. 填写 PR 描述
5. 提交 PR

## 代码规范

### Git 提交信息规范

使用 Conventional Commits 规范：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具相关

示例：
```
feat: 添加用户登录功能
fix: 修复首页加载缓慢问题
docs: 更新 README 文档
```

### 代码风格

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 使用 SCSS 编写样式
- 遵循 BEM 命名规范

### 文件组织

```
src/
├── pages/          # 页面
├── components/     # 组件
├── stores/         # 状态管理
├── services/       # API 服务
├── types/          # 类型定义
├── utils/          # 工具函数
└── assets/         # 静态资源
```

## 开发环境

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- 微信开发者工具

### 安装依赖

```bash
npm install
```

### 启动开发

```bash
npm run dev:weapp
```

### 代码检查

```bash
npm run lint
```

### 代码格式化

```bash
npm run format
```

## 测试

### 运行测试

```bash
npm run test
```

### 测试覆盖率

```bash
npm run test:coverage
```

## 文档

### 更新文档

如果您的更改涉及文档，请同时更新相关文档：

- README.md - 项目说明
- USAGE.md - 使用说明
- CHANGELOG.md - 版本历史
- API 文档（如果需要）

### 生成文档

```bash
npm run docs
```

## 发布流程

1. 更新版本号
2. 更新 CHANGELOG.md
3. 创建 Git 标签
4. 发布到微信小程序

## 行为准则

### 我们的承诺

为了营造一个开放和友好的环境，我们承诺：

- 尊重所有贡献者
- 接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 我们的标准

积极的行为包括：

- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

不可接受的行为包括：

- 使用性暗示的语言或图像
- 恶意评论或人身攻击
- 公开或私下骚扰
- 未经许可发布他人的私人信息

## 联系方式

如有问题，请联系开发团队：

- Email: [your-email@example.com]
- GitHub Issues: [项目 Issues 页面]

## 许可证

参与本项目即表示您同意遵守项目的 [MIT 许可证](LICENSE)。

感谢您的贡献！
