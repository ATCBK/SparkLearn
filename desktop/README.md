# SparkLearn Desktop

第四阶段桌面端 MVP 使用 Electron 复用现有前端、后端和本机 `nanobot`。

详细使用教程见 [USAGE.md](./USAGE.md)。

桌面端不是把服务部署到远程服务器，而是在用户电脑上统一托管本机环境：

1. `frontend` 由 Electron 拉起 Next.js 本机服务，只监听 `127.0.0.1:3000`。
2. `backend` 由 Electron 拉起 FastAPI 本机服务，只监听 `127.0.0.1:8000`。
3. `nanobot` 由 Electron 拉起源码目录中的本机进程，只监听 `127.0.0.1:8900`。
4. 前端只访问本机后端，后端再代理调用本机 `nanobot`，不让浏览器页面直接接触模型密钥或本机进程配置。

## 开发启动

```powershell
cd D:\Project_building\SparkLearn\desktop
npm install
npm run doctor
npm run dev
```

Electron 会按顺序处理：

1. 检查并可选启动本机 `nanobot`。
2. 启动 `backend`：`http://127.0.0.1:8000/health`。
3. 启动 `frontend`：`http://127.0.0.1:3000`。
4. 打开桌面窗口加载现有 Next.js 页面。

## 配置

默认配置见 `config/desktop.config.example.json`，`nanobot` 专用配置见 `config/nanobot.sparklearn.config.json`。

如需本机覆盖，创建 `config/desktop.config.json`。该文件不应提交，用于覆盖端口、命令、路径和 nanobot 是否强制要求。

## 验收

前后端模块级改动必须同时覆盖前端和后端测试。

前端验收使用 Playwright，并同时跑桌面端和移动端 project：

```powershell
cd D:\Project_building\SparkLearn\frontend
npx playwright test --project=desktop-chromium --project=mobile-chromium
```

学伴链路专项验收：

```powershell
cd D:\Project_building\SparkLearn\frontend
npx playwright test test/agent-flow.spec.ts --project=desktop-chromium --project=mobile-chromium
```

后端验收：

```powershell
cd D:\Project_building\SparkLearn\backend
python -m pytest tests\test_api.py -q
```

验收重点不是只看页面是否出现，而是按用户流程执行点击、输入、跳转、等待任务、异常拦截、收藏、反馈等完整链路。

## 日志

桌面端日志写入 Electron `userData/logs` 目录。Windows 开发环境通常位于：

```text
%APPDATA%\sparklearn-desktop\logs
```
