# SparkLearn 小程序使用说明

## 快速开始

### 1. 安装依赖

```bash
cd miniapp
npm install
```

### 2. 配置项目

#### 修改 API 地址

编辑 `src/services/api.ts` 文件，修改 `BASE_URL` 为你的后端 API 地址：

```typescript
const BASE_URL = 'http://your-api-server:8000/api';
```

#### 修改微信小程序 AppID

编辑 `project.config.json` 文件，修改 `appid` 为你的小程序 AppID：

```json
{
  "appid": "your-appid-here"
}
```

### 3. 下载图标

运行以下命令下载图标：

```bash
node scripts/download-icons.js
```

或者手动下载图标到 `src/assets/icons/` 目录。

### 4. 启动开发服务器

```bash
npm run dev:weapp
```

### 5. 使用微信开发者工具

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择 `miniapp/dist` 目录
4. 点击"导入"

## 功能说明

### 首页

- 显示用户学习数据概览
- 提供功能入口（智能刷题、知识图谱、刷题历史、AI 助手）
- 展示今日学习统计
- 推荐热门知识点
- 快速开始（随机刷题、错题重练）

### 知识图谱

- 浏览知识点分类
- 查看知识点列表
- 查看掌握度
- 点击查看详情
- 长按开始练习

### 智能刷题

- 配置练习参数（题数、难度、题型）
- 支持多种题型（单选、多选、判断、填空）
- 实时答题反馈
- 查看答案解析

### 个人中心

- 查看用户信息
- 查看学习数据统计
- 访问功能菜单（刷题历史、错题本、AI 助手）
- 查看学习分析
- 进入设置

### AI 对话

- 与 AI 学习助手对话
- 提问学习问题
- 获取学习建议
- 使用快捷问题

### 设置

- 消息通知设置
- 深色模式（即将支持）
- 自动保存设置
- 清除缓存
- 意见反馈
- 关于信息

## 开发指南

### 添加新页面

1. 在 `src/pages/` 目录下创建新页面目录
2. 创建页面文件：
   - `index.tsx` - 页面组件
   - `index.scss` - 页面样式
   - `index.config.ts` - 页面配置
3. 在 `app.config.ts` 中注册页面路由

### 添加新组件

1. 在 `src/components/` 目录下创建组件目录
2. 创建组件文件：
   - `index.tsx` - 组件
   - `index.scss` - 组件样式
3. 在相应的 `index.ts` 中导出组件

### 修改主题色

编辑 `src/assets/styles/variables.scss` 文件，修改颜色变量：

```scss
$primary-color: #1890FF;
$success-color: #52C41A;
$warning-color: #FAAD14;
$error-color: #FF4D4F;
```

### 添加新的 API 接口

编辑 `src/services/api.ts` 文件，添加新的接口方法：

```typescript
export const api = {
  // 现有接口...

  // 新增接口
  getNewData: (params: any) => request<any>('/new-endpoint', 'GET', params),
};
```

## 常见问题

### Q: 如何修改 API 地址？

A: 编辑 `src/services/api.ts` 文件中的 `BASE_URL` 变量。

### Q: 如何添加新的页面？

A: 在 `src/pages` 目录下创建新页面，并在 `app.config.ts` 中注册路由。

### Q: 如何自定义主题色？

A: 修改 `src/assets/styles/variables.scss` 中的 SCSS 变量。

### Q: 图标文件在哪里？

A: 图标文件在 `src/assets/icons/` 目录下，需要替换占位符图标为真正的 PNG 图标。

### Q: 如何部署到微信小程序？

A: 使用微信开发者工具打开 `dist` 目录，上传代码并提交审核。

## 技术支持

如有问题，请联系开发团队或提交 Issue。
