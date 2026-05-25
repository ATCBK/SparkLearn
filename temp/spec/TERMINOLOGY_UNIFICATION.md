# 术语统一：将"我的资料库"统一定义为"知识库"

## 修改完成 ✅

### 修改的文件

#### 1. **知识库页面** - `frontend/src/app/(shell)/knowledge/page.tsx`
- **修改前**：
  ```typescript
  <PageHead
    eyebrow="知识库"
    title="我的资料库"
    description="..."
  />
  ```
- **修改后**：
  ```typescript
  <PageHead
    eyebrow="知识库"
    title="知识库"
    description="..."
  />
  ```

#### 2. **左侧导航菜单** - `frontend/src/components/layout/Sidebar.tsx`
- **修改前**：未在菜单中显示
- **修改后**：
  ```typescript
  { label: '知识库', href: '/knowledge', icon: <Database className="h-5 w-5" />, group: '学习中心' }
  ```

#### 3. **顶部导航栏** - `frontend/src/components/layout/Topbar.tsx`
- **修改前**：
  ```typescript
  '/knowledge': { group: 'SparkLearn', title: '我的资料库' }
  ```
- **修改后**：
  ```typescript
  '/knowledge': { group: 'SparkLearn', title: '知识库' }
  ```

#### 4. **资源中心页面** - `frontend/src/app/(shell)/generate/page.tsx`
- **修改前**：
  ```typescript
  <ProtoButton href="/knowledge" variant="ghost">去资料库</ProtoButton>
  {!knowledge.length && <SoftCard>暂无已整理资料，可先到资料库上传并整理。</SoftCard>}
  ```
- **修改后**：
  ```typescript
  <ProtoButton href="/knowledge" variant="ghost">去知识库</ProtoButton>
  {!knowledge.length && <SoftCard>暂无已整理资料，可先到知识库上传并整理。</SoftCard>}
  ```

## 术语统一规则

| 旧术语 | 新术语 | 使用场景 |
|--------|--------|---------|
| 我的资料库 | 知识库 | 所有用户界面、菜单、按钮、标题 |
| 资料库 | 知识库 | 所有用户界面、提示文案 |

## 现在的导航结构

```
学习中心
├─ 学习工作台 (/)
├─ 学习画像 (/profile)
├─ 个性化路径 (/path)
└─ 知识库 (/knowledge) ✅ 统一命名

资源与练习
├─ 资源中心 (/generate)
└─ 练习评测 (/practice)

分析与反馈
└─ 学习结果 (/report)
```

## 验证清单

- [x] 知识库页面标题统一为"知识库"
- [x] 左侧导航菜单显示"知识库"
- [x] 顶部导航栏显示"知识库"
- [x] 资源中心的按钮文案改为"去知识库"
- [x] 资源中心的提示文案改为"知识库"
- [x] 前端源代码中不再出现"我的资料库"
- [x] 前端源代码中不再出现"资料库"

## 用户体验改进

1. **术语一致性**：用户在整个应用中看到的都是"知识库"，避免混淆
2. **导航清晰**：知识库在一级导航中显示，易于发现和访问
3. **文案统一**：所有链接和提示都使用相同的术语
4. **功能独立**：知识库与资源中心完全独立，各司其职

## 后续维护

- 如果需要修改术语，请同时更新以下文件：
  1. `frontend/src/app/(shell)/knowledge/page.tsx` - 页面标题
  2. `frontend/src/components/layout/Sidebar.tsx` - 菜单项
  3. `frontend/src/components/layout/Topbar.tsx` - 顶部标题
  4. `frontend/src/app/(shell)/generate/page.tsx` - 相关链接和文案
  5. 任何其他引用该功能的文件
