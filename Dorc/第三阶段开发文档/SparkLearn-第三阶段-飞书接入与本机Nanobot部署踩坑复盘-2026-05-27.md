# SparkLearn 第三阶段飞书接入与本机 Nanobot 部署踩坑复盘

日期：2026-05-27

## 1. 背景与结论

本阶段目标是让学习宠物能力由 `nanobot` 驱动，同时尝试接入飞书配置流程。

最终结论：

1. `nanobot` 必须保持本机部署（localhost）才能稳定满足当前产品诉求。
2. “用户在飞书内网页直接连接用户电脑本机服务（127.0.0.1）完成配置”这个方案不可行。
3. 正确方向是“飞书侧做账号/授权与配置下发，本机 SparkLearn 进程拉取配置并驱动本机 nanobot”。

## 2. 已踩坑问题清单

### 2.1 方案级错误：飞书容器内网页直连本机服务

现象：

1. 在飞书内打开配置页时，无法稳定访问 `http://127.0.0.1:8900` 或本机服务端口。
2. 用户侧感知为“网页能打开，但无法完成本机绑定/配置提交”。

根因：

1. 飞书内嵌浏览器/容器与用户本机网络上下文隔离。
2. `127.0.0.1` 始终指向当前运行容器自身，不是用户电脑。
3. 企业网络策略、证书、跨域、端口策略会进一步放大失败概率。

结论：

该路径不具备可交付性，不应继续投入。

### 2.2 配置源混淆：误加载用户目录残留配置

现象：

1. `nanobot` 启动后加载了历史配置，而非项目预期配置。
2. 联调时出现“看似启动成功，但行为与当前项目配置不一致”。

根因：

1. `.env` 中 `NANOBOT_CONFIG_PATH` 指向了用户目录（如 `C:\Users\xxx\.nanobot\config.json`）。
2. 用户目录存在历史残留，造成配置污染。

修复：

1. 将配置切换为项目内路径：
   - `D:\Project_building\SparkLearn\nanobot-main\.nanobot\config.json`
2. `nanobot` 启动参数显式传 `--config` 与 `--workspace`，避免隐式默认路径。

### 2.3 运行时误判：端口占用导致无法重启

现象：

1. `uvicorn` 启动报错 `WinError 10013`。

根因：

1. 背景已存在旧 `uvicorn` / `nanobot` 进程占用端口。

修复：

1. 启动前检查 `8000/8900` 端口占用并清理遗留进程。

### 2.4 上游模型误判为接入故障

现象：

1. 学习宠物任务可完成但输出异常，返回 `Sorry, your account balance is insufficient`。

根因：

1. 上游模型账户余额不足，不是 SparkLearn 与 nanobot 的接入代码问题。

修复：

1. 更新可用 key 或充值后再验证链路。

## 3. 约束下的正确技术方案

在“nanobot 必须本机部署”的前提下，推荐架构如下：

1. 本机 SparkLearn 后端：
   - 负责启动/守护本机 `nanobot`（`127.0.0.1:8900`）。
   - 负责学习宠物任务路由与回退。
2. 飞书侧（H5/应用）：
   - 只做用户身份、授权确认、配置录入。
   - 不直连用户本机 `localhost`。
3. 云端配置服务（可轻量）：
   - 保存用户配置与设备绑定关系。
   - 向本机 SparkLearn 提供配置拉取接口。
4. 本机配置同步：
   - SparkLearn 进程主动从云端拉取配置并写入项目配置文件。
   - 更新后按需重启或热更新 nanobot。

## 4. 本项目当前落地基线

### 4.1 必备环境变量

1. `NANOBOT_PET_ENABLED=true`
2. `NANOBOT_AUTO_START=true`
3. `NANOBOT_API_BASE_URL=http://127.0.0.1:8900`
4. `NANOBOT_PROJECT_DIR=D:\Project_building\SparkLearn\nanobot-main`
5. `NANOBOT_PYTHON_EXE=D:\Project_building\SparkLearn\.venv-nanobot\Scripts\python.exe`
6. `NANOBOT_CONFIG_PATH=D:\Project_building\SparkLearn\nanobot-main\.nanobot\config.json`
7. `NANOBOT_WORKSPACE=D:\Project_building\SparkLearn\nanobot-main\.workspace`

### 4.2 启动与验证

1. 启动后端：

```powershell
cd D:\Project_building\SparkLearn\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

2. 健康检查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8900/health
```

3. 学习宠物任务检查：

```powershell
$task = Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:8000/api/agent/task' `
  -ContentType 'application/json' `
  -Body (@{ task_type='search'; input_text='Python 闭包' } | ConvertTo-Json)
$taskId = $task.data.task_id
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/api/agent/task/$taskId"
```

判定标准：

返回步骤中出现“已切换到学习宠物新内核”“正在调用 nanobot 处理任务”。

## 5. 风险与防回归清单

1. 配置路径必须固定到项目内，禁止默认读用户目录配置。
2. 启动脚本必须打印实际 `nanobot` 启动命令（含 `--config`）。
3. 端口占用检测应内置到开发启动流程。
4. 上游模型错误要分类透传（余额不足、模型不存在、超时、网络错误）。
5. `.venv-nanobot` 不应纳入版本库，避免污染 git 状态与交付包。

## 6. 后续实施建议（按优先级）

### P0

1. 将“飞书网页直连 localhost”从方案中下线并在需求文档标注为禁用路径。
2. 固化项目内 `NANOBOT_CONFIG_PATH` 与 `NANOBOT_WORKSPACE`。
3. 增加启动自检：端口占用、配置文件存在性、编码（UTF-8 无 BOM）。

### P1

1. 增加“设备绑定 + 云端配置拉取”最小闭环。
2. 在 `nanobot_pet_client` 增加错误分类与前端友好提示。

### P2

1. 继续推进 MCP 工具层，把 SparkLearn 业务能力暴露给本机 nanobot。

## 7. 一句话归档

本次踩坑本质是“把跨容器网络访问当成本机回环访问来设计”，后续必须坚持“本机能力本机闭环、飞书只做云端入口”的架构边界。

