# SparkLearn 小程序快速开始

## 5 分钟快速启动

### 步骤 1: 安装依赖

```bash
cd miniapp
npm install
```

### 步骤 2: 配置 API 地址

编辑 `src/services/api.ts` 文件，修改第 3 行：

```typescript
const BASE_URL = 'http://localhost:8000/api'; // 修改为你的后端 API 地址
```

### 步骤 3: 配置 AppID

编辑 `project.config.json` 文件，修改第 4 行：

```json
{
  "appid": "your-appid-here" // 修改为你的微信小程序 AppID
}
```

### 步骤 4: 下载图标

```bash
node scripts/download-icons.js
```

### 步骤 5: 启动开发服务器

**Windows:**
```bash
scripts\start.bat
```

**Linux/Mac:**
```bash
./scripts/start.sh
```

或者直接运行：

```bash
npm run dev:weapp
```

### 步骤 6: 使用微信开发者工具

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择 `miniapp/dist` 目录
4. 点击"导入"

## 常见问题

### Q: npm install 失败怎么办？

A: 尝试使用淘宝镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

### Q: 图标下载失败怎么办？

A: 手动下载图标：

1. 访问 https://www.iconfont.cn/
2. 搜索所需的图标（首页、图表、测试、用户）
3. 下载 81x81 像素的 PNG 格式
4. 放入 `src/assets/icons/` 目录
5. 重命名为：home.png、graph.png、practice.png、profile.png
6. 以及对应的 -active.png 文件

### Q: 如何修改主题色？

A: 编辑 `src/assets/styles/variables.scss` 文件：

```scss
$primary-color: #1890FF; // 修改为主题色
```

### Q: 如何添加新页面？

A: 

1. 在 `src/pages/` 目录下创建新目录
2. 创建 `index.tsx`、`index.scss`、`index.config.ts` 文件
3. 在 `src/app.config.ts` 中添加页面路径

## 项目结构说明

```
miniapp/
├── src/
│   ├── pages/          # 页面目录
│   ├── components/     # 组件目录
│   ├── stores/         # 状态管理
│   ├── services/       # API 服务
│   ├── types/          # 类型定义
│   ├── utils/          # 工具函数
│   └── assets/         # 静态资源
├── config/             # 配置文件
├── scripts/            # 脚本文件
└── package.json        # 依赖配置
```

## 开发命令

```bash
# 开发模式
npm run dev:weapp

# 构建生产版本
npm run build:weapp

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

## 下一步

1. 阅读 [USAGE.md](USAGE.md) 了解详细使用方法
2. 阅读 [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) 了解项目详情
3. 阅读 [CHANGELOG.md](CHANGELOG.md) 了解版本历史

## 获取帮助

- 查看 [README.md](README.md) 了解项目概述
- 提交 [Issue](https://github.com/ATCBK/SparkLearn/issues) 报告问题
- 联系开发团队获取支持

---

**祝你开发愉快！** 🚀
