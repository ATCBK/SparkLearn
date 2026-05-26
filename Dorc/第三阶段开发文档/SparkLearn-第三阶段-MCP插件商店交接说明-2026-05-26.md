# SparkLearn-第三阶段-MCP插件商店交接说明

## 1. 当前任务目标
本次任务目标是把 MCP 插件商店接入 `tutor` 体系，而不是学习广场或主工作台。

目标页面：
- `http://localhost:3000/tutor`
- `http://localhost:3000/tutor/mcp-store`

目标效果：
- 左侧显示已添加的 MCP 服务列表
- 右侧显示新增/编辑 MCP 服务的配置卡片
- 支持测试连接、启用/停用、删除、查看工具
- UI 风格参考你给的截图，但按当前版本做适配，不强求完全一致

## 2. 已完成内容

### 2.1 后端
- 新增 MCP 路由：[`backend/app/routes/mcp.py`](D:\Project_building\SparkLearn\backend\app\routes\mcp.py)
- 注册路由：[`backend/app/main.py`](D:\Project_building\SparkLearn\backend\app\main.py)
- 新增数据表：[`backend/app/db.py`](D:\Project_building\SparkLearn\backend\app\db.py)

当前后端能力：
- `GET /api/mcp/services`
- `POST /api/mcp/services`
- `PUT /api/mcp/services/{id}`
- `DELETE /api/mcp/services/{id}`
- `POST /api/mcp/services/{id}/test`
- `POST /api/mcp/services/{id}/toggle`
- `GET /api/mcp/services/{id}/tools`
- `POST /api/mcp/services/{id}/call`

重要说明：
- 当前 demo 版后端主要支持 `stdio`
- `http` 选项在 UI 里保留了，但后端还没有完整实现 HTTP 传输接入
- `headers` 还只是 UI 占位，没有落库

### 2.2 前端
- 新建页面：[`frontend/src/app/tutor/mcp-store/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\mcp-store\page.tsx)
- 补了 API 封装：
  - [`frontend/src/lib/api/real.ts`](D:\Project_building\SparkLearn\frontend\src\lib\api\real.ts)
  - [`frontend/src/lib/api/index.ts`](D:\Project_building\SparkLearn\frontend\src\lib\api\index.ts)
  - [`frontend/src/lib/api/types.ts`](D:\Project_building\SparkLearn\frontend\src\lib\api\types.ts)

### 2.3 Tutor 入口
已经把 MCP 插件商店入口放回 `tutor` 体系里，不在 `plaza`。

相关文件：
- [`frontend/src/app/tutor/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\page.tsx)
- [`frontend/src/app/tutor/roles/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\roles\page.tsx)
- [`frontend/src/app/tutor/knowledge/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\knowledge\page.tsx)
- [`frontend/src/app/tutor/files/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\files\page.tsx)
- [`frontend/src/app/tutor/workshop/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\workshop\page.tsx)

## 3. 当前 UI 状态
当前 `tutor/mcp-store` 页面已经改成：
- 左侧：已添加 MCP 服务列表
- 右侧：类似你截图的配置卡片
- 分区：
  - `认证`
  - `请求头`
  - `配置`

页面文件：
- [`frontend/src/app/tutor/mcp-store/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\mcp-store\page.tsx)

适配原则：
- 参考图里很多字段和逻辑与本版本后端不一致
- 当前做法是保留 UI 结构，后端暂时只接能落地的字段
- `请求头` 和部分认证字段是 UI 先行，后续再决定是否补后端

## 4. 已知问题 / 待办

### 4.1 前端 lint 还有遗留警告
我跑过 `frontend` 的 lint，`mcp-store` 页面本身只有 warning，没有 error，但 `tutor` 其他页面在这轮里有既有问题或由旧代码导致的 lint error/warning。

需要下一个 Agent 继续处理的重点：
- [`frontend/src/app/tutor/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\page.tsx)
- [`frontend/src/app/tutor/roles/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\roles\page.tsx)
- [`frontend/src/app/tutor/workshop/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\workshop\page.tsx)

### 4.2 mcp-store 目前的能力边界
- `stdio` 路径已经能跑
- `http` 还没有真实接通
- `headers` 没有后端持久化
- 目前只是演示级，不是完整插件市场

## 5. 下一个 Agent 建议继续做什么
建议按这个顺序继续：

1. 先保住 `tutor` 入口稳定
- 确认 `tutor` 侧边栏里能看到 `MCP 插件商店`
- 确认路由 `http://localhost:3000/tutor/mcp-store` 能打开

2. 再收敛 `mcp-store` 的 UI
- 继续优化左列表和右卡片的比例
- 把“认证 / 请求头 / 配置”三个 tab 简化得更贴合当前版本
- 如果觉得截图的字段太多，就保留核心字段，不要硬做全套

3. 决定后端是否补 `headers`
- 如果要接真实 http MCP，再加表字段和 API
- 如果只做演示，可以先不接

4. 处理 lint
- 优先修 `tutor/page.tsx`、`roles/page.tsx`、`workshop/page.tsx` 中的现存报错
- 不要为了清 lint 去重构整个 `tutor` 模块

## 6. 不要碰的东西
当前工作区里有大量与本任务无关的变更，包括：
- `.venv-nanobot/`
- `backend/data/`
- 其他历史任务或环境产物

这些不要回滚，不要清理，不要重置。

如果你只接手 MCP 插件商店这条线，优先只看这些文件：
- [`backend/app/routes/mcp.py`](D:\Project_building\SparkLearn\backend\app\routes\mcp.py)
- [`backend/app/db.py`](D:\Project_building\SparkLearn\backend\app\db.py)
- [`frontend/src/app/tutor/mcp-store/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\mcp-store\page.tsx)
- [`frontend/src/app/tutor/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\page.tsx)
- [`frontend/src/app/tutor/roles/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\roles\page.tsx)
- [`frontend/src/app/tutor/knowledge/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\knowledge\page.tsx)
- [`frontend/src/app/tutor/files/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\files\page.tsx)
- [`frontend/src/app/tutor/workshop/page.tsx`](D:\Project_building\SparkLearn\frontend\src\app\tutor\workshop\page.tsx)

## 7. 备注
这版的核心不是“做完整 MCP 市场”，而是先把 `tutor` 里的 MCP 插件商店变成一个可演示、可配置、可测试的工作入口。后续再决定是否把认证、请求头、HTTP 接入补完整。
