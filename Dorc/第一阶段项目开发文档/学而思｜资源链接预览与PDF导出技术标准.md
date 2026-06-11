# 资源链接预览与 PDF 导出技术标准（可迁移版）

## 1. 目标与范围

本标准用于规范“AI 资源生成后返回网页链接”的统一处理链路，保证在不同项目中可复用、可观测、可维护。

适用场景：
- 智能体返回课程文档/资源网页链接
- 前端内嵌预览网页内容
- 用户点击下载时导出为 PDF（浏览器打印语义）

不适用场景：
- 本地二进制文件直传下载
- 纯静态 markdown 无外链渲染项目

---

## 2. 标准链路（必须遵守）

1. 智能体生成结果（流式）  
2. 后端中间层提取结构化链接（`source_url`）  
3. 资源入库时写入：
   - `content`（文本说明）
   - `source_url`（唯一有效链接）
4. 前端预览仅使用 `source_url`，不从正文全文扫链接  
5. 下载默认走 PDF：
   - 后端 Playwright 打开 `source_url`
   - 注入打印样式
   - `page.pdf()` 返回文件流

---

## 3. 数据模型标准

资源对象最小字段：

```json
{
  "id": "gen-xxxx",
  "title": "资源标题",
  "type": "document|mindmap|quiz|reading|code|ppt",
  "status": "generating|completed|failed",
  "content": "资源文本内容",
  "source_url": "https://...",
  "created_at": "YYYY-MM-DD",
  "progress": 100
}
```

约束：
- `source_url` 是唯一可信预览/下载来源
- `source_url` 为空时，前端不得渲染网页预览
- `content` 中出现的 URL 不作为预览依据

---

## 4. API 标准

### 4.1 资源生成

- `POST /api/resources/generate`
- 流式事件：
  - `progress`
  - `text`
  - `meta`（可包含 `links`）
  - `error`
  - `done`

### 4.2 资源预览

- `GET /api/resources/{id}/preview`  
返回：
```json
{ "url": "https://...", "available": true }
```

- `GET /api/resources/{id}/preview/html`  
后端拉取远端 HTML 并返回可嵌入预览内容。

### 4.3 资源下载

- `GET /api/resources/{id}/download/pdf`（标准默认）
- `GET /api/resources/{id}/download`（兼容入口，重定向或复用 PDF 逻辑）
- `GET /api/resources/{id}/download/html`（可选调试/兼容）

---

## 5. 智能体中间层标准

### 5.1 解析规则

必须支持：
- `content` 为字符串
- `content` 为对象（如 `content.text`）
- `data` 为 JSON 字符串包裹
- 事件包中控制消息过滤（如 `generate_answer_finish`）

### 5.2 链接提取规则

优先级：
1. 结构化字段：`file_url` / `url` / `link` / `image_url`
2. 明确标记行：`SOURCE_URL: https://...`
3. 文本内 URL（仅作为兜底，且必须校验）

链接必须通过校验：
- 协议仅 `http/https`
- 必须有 `netloc`
- 清洗 `\\n`, `##`, 末尾标点

---

## 6. PDF 导出标准

### 6.1 导出语义

必须是“浏览器打印语义”：
- Playwright Chromium 打开真实 URL
- 等待页面渲染完成（推荐 `networkidle`）
- 注入打印样式
- 使用 `page.pdf()` 导出

### 6.2 打印样式最小规范

- A4 纸张
- 合理边距（推荐 12-14mm）
- 隐藏 `nav/header/footer/.no-print`
- 保留背景色 `print_background=true`

### 6.3 响应头规范

- `Content-Type: application/pdf`
- `Content-Disposition` 同时包含：
  - `filename=ASCII fallback`
  - `filename*=UTF-8''...`

---

## 7. Windows 运行标准（关键）

若部署在 Windows 且使用 Playwright，必须在应用启动前设置：

```python
asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
```

原因：
- `SelectorEventLoop` 下 `create_subprocess_exec` 可能抛 `NotImplementedError`
- Playwright 启动 Chromium 依赖子进程能力

---

## 8. 错误处理与可观测性标准

### 8.1 错误分层

- 4xx：参数/资源不存在/链接不合法
- 5xx：渲染引擎异常、运行时依赖异常、网络目标站异常

### 8.2 错误信息规范

必须返回可定位上下文：
- 错误类型
- 关键步骤（fetch / goto / pdf）
- 简要异常摘要

### 8.3 日志字段建议

- `resource_id`
- `source_url`
- `provider`（coze）
- `stage`（parse/preview/pdf）
- `elapsed_ms`

---

## 9. 迁移实施清单（Checklist）

1. 配置项迁移
   - Coze token、bot_id 路由
2. 中间层迁移
   - 流式事件解析与链接提取
3. 数据结构迁移
   - 资源对象增加 `source_url`
4. 前端改造
   - 预览仅读 `source_url`
   - 下载默认走 `/download/pdf`
5. 后端依赖
   - `playwright` 安装
   - 安装浏览器：`python -m playwright install chromium`
6. Windows 策略
   - Proactor event loop policy
7. 联调验收
   - 生成、预览、下载 PDF 全链路

---

## 10. 验收标准

通过标准：
- 资源生成后，`source_url` 正确落库
- 前端预览仅在 `source_url` 存在时展示
- 点击下载稳定返回 `.pdf`
- 错误时前端能显示可读提示，后端日志可定位

不通过标准：
- 仍从正文随机抓取链接
- 下载返回 html/markdown 而非 pdf
- Windows 环境出现 `NotImplementedError` 未治理

---

## 11. 推荐扩展（下一步）

- 增加 PDF 元数据（标题/作者/关键词）
- 增加打印模板（课程文档、题集、思维导图不同样式）
- 增加异步导出任务队列（大文档导出）
- 增加导出审计日志（谁在何时导出了什么）

