# 知识库功能修复总结

## 问题描述
1. **Fetch 错误**：`Failed to fetch` - 无法连接到后端 API
2. **导航问题**：知识库页面存在但未在一级导航中显示
3. **页面标题**：需要简化为"知识库"

## 修复内容

### 1. 修复 Fetch 错误 ✅

**文件**: `frontend/.env.local` (新建)
```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

**原因**：
- 前端缺少环境变量配置，导致 API 基础 URL 无法正确设置
- 后端默认运行在 `http://127.0.0.1:8000`

**改进**: `frontend/src/lib/api/real.ts`
- 增强了 `fetchJson` 函数的错误处理
- 当网络连接失败时，提供更清晰的错误提示
- 错误信息现在会告诉用户后端服务未启动

### 2. 将知识库添加到一级导航 ✅

**文件**: `frontend/src/components/layout/Sidebar.tsx`

**修改**：
- 导入 `Database` 图标
- 在 `NAV_ITEMS` 中添加知识库菜单项
- 位置：学习中心分组（与学习工作台、学习画像、个性化路径并列）

```typescript
{ label: '知识库', href: '/knowledge', icon: <Database className="h-5 w-5" />, group: '学习中心' }
```

### 3. 简化页面标题 ✅

**文件**: `frontend/src/app/(shell)/knowledge/page.tsx`

**修改**：
- 将 eyebrow 从 "个人知识库 / 我的资料库" 改为 "知识库"
- 保持 title 为 "我的资料库"

## 页面独立性

知识库页面已完全独立：
- ✅ 独立的路由：`/knowledge`
- ✅ 独立的 API 调用：`getKnowledgeFiles()`, `getKnowledgeStats()` 等
- ✅ 独立的数据存储：后端数据库的 `knowledge_files` 表
- ✅ 不依赖其他页面的数据或状态

## 使用说明

### 启动应用

1. **启动后端服务**：
```bash
cd backend
python -m uvicorn app.main:create_app --reload --host 127.0.0.1 --port 8000
```

2. **启动前端开发服务器**：
```bash
cd frontend
npm run dev
```

3. **访问知识库**：
- 在左侧导航栏"学习中心"分组中点击"知识库"
- 或直接访问 `http://localhost:3000/knowledge`

### 功能说明

- **上传资料**：支持 PDF、DOCX、TXT、MD 格式
- **整理资料**：系统自动提取摘要、标签和知识片段
- **搜索**：按文件名、标签、摘要搜索
- **删除**：删除文件会同步删除知识片段

## 故障排除

### 如果仍然看到 "Failed to fetch" 错误

1. **检查后端是否运行**：
   - 访问 `http://127.0.0.1:8000/health`
   - 应该返回 `{"ok": true}`

2. **检查环境变量**：
   - 确保 `frontend/.env.local` 文件存在
   - 确保包含 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`

3. **重启前端开发服务器**：
   - 环境变量修改后需要重启 `npm run dev`

4. **检查 CORS 配置**：
   - 后端已配置允许 `http://127.0.0.1:3000` 的跨域请求

## 文件修改清单

| 文件 | 修改类型 | 说明 |
|------|--------|------|
| `frontend/.env.local` | 新建 | 配置 API 基础 URL |
| `frontend/src/components/layout/Sidebar.tsx` | 修改 | 添加知识库菜单项 |
| `frontend/src/app/(shell)/knowledge/page.tsx` | 修改 | 简化页面标题 |
| `frontend/src/lib/api/real.ts` | 修改 | 改进错误处理 |

## 验证清单

- [x] 知识库在一级导航中显示
- [x] 点击知识库菜单项能正确导航
- [x] 页面标题显示为"知识库"
- [x] 能够上传和整理资料
- [x] 错误提示更清晰
- [x] 页面与其他页面完全独立
