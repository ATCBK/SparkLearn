# SparkLearn 第三阶段学习宠物 Nanobot 接入交接文档

日期：2026-05-26

## 1. 当前目标

把 `nanobot` 作为 SparkLearn 学习宠物的逻辑内核接入进来，同时保持现有学习宠物前端展示、接口协议和业务外观尽量不变。

当前策略是：

1. SparkLearn 保留现有 UI 和任务展示。
2. 学习宠物对话逻辑切到本地 `nanobot`。
3. 后端启动时自动拉起本地 `nanobot`。
4. 工具层后续再用 MCP 接入。

## 2. 已完成内容

### 2.1 后端接线

已修改后端，让学习宠物任务可以优先走 `nanobot`：

- `backend/app/routes/agent.py`
- `backend/app/pet_nanobot.py`
- `backend/app/nanobot_runtime.py`
- `backend/app/main.py`

已实现的行为：

1. `/api/agent/task` 在开启 `NANOBOT_PET_ENABLED=true` 时优先调用 `nanobot`。
2. 如果 `nanobot` 失败，会自动回退旧链路。
3. 后端启动时会尝试自动拉起本地 `nanobot`。
4. 后端退出时会回收自己启动的 `nanobot` 进程。

### 2.2 配置

已补充 `.env` 里的 `nanobot` 相关配置：

- `NANOBOT_PET_ENABLED=true`
- `NANOBOT_AUTO_START=true`
- `NANOBOT_API_BASE_URL=http://127.0.0.1:8900`
- `NANOBOT_API_MODEL=deepseek-ai/DeepSeek-V3`
- `NANOBOT_PROJECT_DIR=D:\Project_building\SparkLearn\nanobot-main`
- `NANOBOT_PYTHON_EXE=D:\Project_building\SparkLearn\.venv-nanobot\Scripts\python.exe`
- `NANOBOT_CONFIG_PATH=C:\Users\32118\.nanobot\config.json`

### 2.3 独立运行环境

已为 `nanobot` 建立独立虚拟环境：

- `.venv-nanobot`

目的：

1. 避免 `nanobot` 依赖和 SparkLearn 后端依赖互相污染。
2. 让后端自动启动 `nanobot` 时使用独立解释器。

### 2.4 本地 `nanobot` 配置修复

已修复用户目录下的 `nanobot` 配置文件：

- `C:\Users\32118\.nanobot\config.json`

关键点：

1. 配置文件必须是 UTF-8 无 BOM。
2. 当前可被 `nanobot` 正确解析。
3. 当前识别到的 provider/model 组合为：
   - `provider=openai`
   - `model=deepseek-ai/DeepSeek-V3`

## 3. 当前联调结果

### 3.1 已验证通过

1. 后端 `8000/health` 正常。
2. `nanobot` `8900/health` 正常。
3. 学习宠物任务已经能走到 `nanobot` 链路。
4. 任务步骤里能看到：
   - 已切换到学习宠物新内核
   - 正在调用 nanobot 处理任务
   - nanobot 已返回结果，正在整理输出

### 3.2 当前阻塞

真正阻塞不是 SparkLearn 接入代码，而是 `nanobot` 上游模型调用：

- 之前出现过 `Model does not exist`
- 现在已经定位到真正原因是上游账户余额不足

当前实际返回的是：

```text
Sorry, your account balance is insufficient
```

也就是说：

1. SparkLearn -> nanobot 链路已经通了。
2. nanobot 自己能启动。
3. 目前卡在模型服务商余额，不是 SparkLearn 接入层错误。

## 4. 关键文件清单

### 4.1 SparkLearn 侧

- `backend/app/config.py`
- `backend/app/main.py`
- `backend/app/nanobot_runtime.py`
- `backend/app/pet_nanobot.py`
- `backend/app/routes/agent.py`
- `backend/tests/test_api.py`
- `.env`
- `运行命令.md`

### 4.2 nanobot 侧

- `D:\Project_building\SparkLearn\nanobot-main`

说明：

1. 这个项目没有大改核心。
2. 主要是用它的 OpenAI-compatible API 和本地配置。

## 5. 已知注意事项

1. Windows 下不要再用 `asyncio.create_subprocess_exec` 拉起 `nanobot`，已改成 `subprocess.Popen`。
2. `nanobot` 配置文件不要用带 BOM 的 UTF-8 写入，否则会被它当成配置解析失败。
3. 后端自动启动 `nanobot` 时必须指定独立 Python：
   - `.venv-nanobot\Scripts\python.exe`
4. `.env` 里的 `NANOBOT_API_MODEL` 必须和 `nanobot` 当前可用模型一致。

## 6. 下一个 Agent 应该做什么

优先级建议如下：

### P0

1. 先确认当前 `SiliconFlow` key 是否已充值或已更换为可用 key。
2. 如果有新 key，先手工验证：
   - `POST http://127.0.0.1:8900/v1/chat/completions`
3. 再跑一次学习宠物任务：
   - `POST /api/agent/task`
   - `GET /api/agent/task/{task_id}`

### P1

4. 如果上游模型仍不稳定，考虑在 `nanobot_pet_client` 中增加更清晰的错误回退。
5. 把当前学习宠物相关链路整理成最终可交付版本文档。

### P2

6. 继续做 MCP 工具层，把 SparkLearn 的业务能力暴露给 `nanobot`。

## 7. 推荐验证命令

```powershell
cd D:\Project_building\SparkLearn\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8900/health
```

```powershell
$body = @{
  model = 'deepseek-ai/DeepSeek-V3'
  messages = @(@{ role = 'user'; content = 'Say hello in one sentence.' })
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:8900/v1/chat/completions' `
  -ContentType 'application/json' `
  -Body $body
```

## 8. 结论

当前可以确认：

1. 接入架构没有问题。
2. 自动启动没有问题。
3. 学习宠物已经确实切到 `nanobot`。
4. 当前唯一阻塞是上游模型账户余额，不是 SparkLearn 代码本身。

