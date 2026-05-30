# SparkLearn 桌面端使用教程

本教程只适用于 SparkLearn 桌面端。桌面端会在你的电脑本机启动前端、后端和 Nanobot，不会把这些服务部署到远程服务器。

## 1. 首次准备

打开 PowerShell，进入桌面端目录：

```powershell
cd D:\Project_building\SparkLearn\desktop
```

安装桌面端依赖：

```powershell
npm install
```

检查本机环境：

```powershell
npm run doctor
```

看到下面结果说明基础环境可用：

```text
SparkLearn desktop environment looks ready.
```

## 2. 启动桌面端

在 `desktop` 目录执行：

```powershell
npm run dev
```

启动后 Electron 会自动托管本机服务：

| 服务 | 本机地址 | 说明 |
| --- | --- | --- |
| 前端 | `http://127.0.0.1:3000` | 桌面窗口加载的 SparkLearn 页面 |
| 后端 | `http://127.0.0.1:8000` | 本机 FastAPI 服务 |
| Nanobot | `http://127.0.0.1:8900` | 本机学习学伴内核 |

正常情况下会弹出 SparkLearn 桌面窗口。

## 3. 使用 AI 学伴

进入桌面窗口里的「AI 学伴」页面。

页面右上角会显示 Nanobot 状态：

- `Nanobot 在线`：本机 Nanobot 已启动，学伴任务会优先走本机 Nanobot。
- `备用模式`：本机 Nanobot 暂不可用，桌面端会继续使用 SparkLearn 后端备用能力，不会直接中断用户流程。

推荐按这种方式输入任务：

```text
Python 装饰器学习资料：请按初学者路径推荐，并说明阅读顺序
```

不要只输入很短的词，例如：

```text
闭包
```

这种输入会被前端拦截，因为任务目标不够明确。

## 4. 常见问题

### 4.1 `npm run doctor` 不通过

先看错误提示。常见原因：

- Node.js 或 npm 不可用。
- Python 不可用。
- `D:\Project_building\SparkLearn\nanobot-main` 不存在。
- 当前 Python 环境不能运行 `python -m nanobot --help`。

### 4.2 端口被占用

桌面端默认使用：

```text
3000 / 8000 / 8900
```

如果启动失败并提示端口占用，先关闭已有的前端、后端或 Nanobot 进程，再重新执行：

```powershell
npm run dev
```

### 4.3 Nanobot 显示备用模式

这通常表示 `127.0.0.1:8900` 没有健康响应。先运行：

```powershell
cd D:\Project_building\SparkLearn\desktop
npm run doctor
```

如果 doctor 通过，再重新启动桌面端。

## 5. 验收测试

学伴桌面/移动双端专项测试：

```powershell
cd D:\Project_building\SparkLearn\frontend
npx playwright test test/agent-flow.spec.ts --project=desktop-chromium --project=mobile-chromium
```

后端接口测试：

```powershell
cd D:\Project_building\SparkLearn\backend
python -m pytest tests\test_api.py -q
```

## 6. 关闭桌面端

直接关闭 Electron 窗口即可。桌面端会按顺序回收：

1. 前端进程
2. 后端进程
3. Nanobot 进程

如果出现残留进程，再重新运行 `npm run doctor` 检查环境状态。
