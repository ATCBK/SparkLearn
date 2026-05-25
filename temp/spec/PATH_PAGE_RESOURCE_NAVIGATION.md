# 学习路径资源导航功能

## 功能描述
更新学习路径页面，移除任务数量显示，并为推送的资源添加可点击的导航链接。

## 核心变更

### 1. 移除任务数量显示

#### 之前
```
补弱阶段
夯实基础，3 个任务

达标阶段
能力达标，4 个任务

目标阶段
应用提升，3 个任务
```

#### 现在
```
补弱阶段
夯实基础

达标阶段
能力达标

目标阶段
应用提升
```

### 2. 资源导航功能

#### 资源类型和链接

| 资源类型 | 链接示例 | 说明 |
|---------|---------|------|
| 精讲讲义 | `/resources?type=lecture&goal=理解返回值` | 跳转到资源库查看讲义 |
| 补弱题练 | `/practice?topic=理解返回值` | 跳转到练习页面 |
| 项目案例 | `/resources?type=project&goal=理解返回值` | 跳转到资源库查看项目 |

#### 链接生成规则

```typescript
// 精讲讲义
link: `/resources?type=lecture&goal=${encodeURIComponent(goal)}`

// 补弱题练
link: `/practice?topic=${encodeURIComponent(goal)}`

// 项目案例
link: `/resources?type=project&goal=${encodeURIComponent(goal)}`
```

### 3. 交互改进

#### 资源卡片
- 从 `<div>` 改为 `<a>` 标签
- 添加 `href` 属性指向对应资源
- 鼠标悬停时显示视觉反馈
- 点击时导航到对应页面

#### 视觉反馈
```css
/* 未悬停 */
border: 1px solid #E5EAF2
background: #F9FAFB

/* 悬停 */
border: 1px solid #2563EB
background: #F0F7FF
```

## 代码实现

### 资源数据结构

```typescript
interface Resource {
  id: number
  title: string
  tag: string
  link?: string  // 新增：导航链接
}
```

### 资源生成逻辑

```typescript
const newResources = [
  { 
    id: 1, 
    title: `${goal}精讲讲义`, 
    tag: '优先学习', 
    link: `/resources?type=lecture&goal=${encodeURIComponent(goal)}` 
  },
  { 
    id: 2, 
    title: `${goal}补弱题练`, 
    tag: '5题', 
    link: `/practice?topic=${encodeURIComponent(goal)}` 
  },
  { 
    id: 3, 
    title: `${goal}项目案例`, 
    tag: '待复习', 
    link: `/resources?type=project&goal=${encodeURIComponent(goal)}` 
  },
]
```

### 资源渲染

```typescript
{resources.map((resource) => (
  <a
    key={resource.id}
    href={resource.link || '#'}
    className="block rounded-[10px] border border-[#E5EAF2] bg-[#F9FAFB] p-3 hover:border-[#2563EB] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="text-xs font-bold text-[#111827]">{resource.title}</div>
      <span className="whitespace-nowrap rounded-full bg-[#EFF6FF] px-2 py-1 text-xs font-bold text-[#2563EB]">
        {resource.tag}
      </span>
    </div>
  </a>
))}
```

## 用户体验改进

### 1. 界面更清晰
- 移除冗余的任务数量信息
- 页面更加简洁

### 2. 导航更便捷
- 资源可直接点击跳转
- 无需手动搜索资源
- 一键访问对应内容

### 3. 学习流程更顺畅
- 查看建议 → 点击资源 → 学习资源
- 完整的学习闭环

## 导航流程

### 用户操作
1. 用户点击学习路径中的节点
2. 右侧面板显示对应的资源推送
3. 用户点击资源卡片
4. 浏览器导航到对应的资源页面

### 系统响应
1. 识别点击的资源
2. 获取资源链接
3. 导航到对应页面
4. 显示相关资源内容

## 修改的文件
- `frontend/src/app/(shell)/path/page.tsx`

## 验证清单

- [x] 移除了任务数量显示
- [x] 资源添加了导航链接
- [x] 资源卡片改为可点击的链接
- [x] 添加了悬停视觉反馈
- [x] 链接参数正确编码
- [x] "查看全部资源"按钮链接到资源页面
- [x] 没有 TypeScript 编译错误
- [x] 没有运行时错误

## 示例场景

### 场景 1：用户点击节点5，查看资源

```
1. 用户点击节点5（回顾函数）

2. 右侧面板显示：
   资源推送
   ├─ 回顾函数精讲讲义 [优先学习]
   ├─ 回顾函数补弱题练 [5题]
   └─ 回顾函数项目案例 [待复习]

3. 用户点击"回顾函数精讲讲义"

4. 浏览器导航到：
   /resources?type=lecture&goal=回顾函数

5. 资源页面显示相关讲义内容
```

### 场景 2：用户点击练习资源

```
1. 用户在资源推送中看到"回顾函数补弱题练"

2. 用户点击该资源

3. 浏览器导航到：
   /practice?topic=回顾函数

4. 练习页面自动加载"回顾函数"相关题目
```

## 后续扩展

### 可以考虑的功能
1. **资源预加载**：在用户点击前预加载资源
2. **资源收藏**：用户可以收藏常用资源
3. **学习进度**：显示用户对该资源的学习进度
4. **推荐排序**：根据用户偏好排序资源
5. **资源评分**：显示其他用户对资源的评分

## 性能考虑

- **链接生成**：在点击时生成，无需预加载
- **导航速度**：使用标准 HTML 链接，导航速度快
- **内存占用**：无额外内存占用

## 总结

通过这次更新，学习路径页面变得更加简洁和实用：
- ✅ 界面更清晰（移除任务数量）
- ✅ 导航更便捷（资源可点击）
- ✅ 学习流程更顺畅（一键访问资源）
- ✅ 用户体验更好（完整的学习闭环）
