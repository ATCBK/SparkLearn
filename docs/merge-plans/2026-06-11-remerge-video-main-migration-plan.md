# `fix/remerge-video-main` -> `build/hero` 迁移方案

## 目标

- 以 `build/hero` 为主线，不污染原工作区和原分支。
- 只吸收远端 `origin/fix/remerge-video-main` 在分叉后新增的功能点。
- 在隔离分支完成迁移、清理和验证，再决定是否合入正式分支。

## 分支与隔离策略

- 当前本地工作分支：`build/hero`
- 远端目标分支：`origin/fix/remerge-video-main`
- 分叉点：`b4232ae3`
- 朋友分支新增提交：`467bd77d` `小程序开发和细节修改`
- 隔离工作树：`D:\Project_building\SparkLearn-remerge-video-main`
- 隔离迁移分支：`merge/remerge-video-main-from-build-hero`

本次所有迁移、测试、清理都只发生在隔离工作树和隔离分支中，未切换也未改写原工作区 `build/hero`。

## 差异结论

### 朋友分支新增内容

1. 小程序新增完整 `miniapp/` 工程。
2. 后端语言/资源链路修复：
   - `backend/app/clients/tts_client.py`
   - `backend/app/routes/voice_admin.py`
   - `backend/app/routes/quiz.py`
   - `backend/app/routes/resources.py`
3. 网页端资源生成与代码练习：
   - `frontend/src/app/(shell)/generate/page.tsx`
   - `frontend/src/components/ui/CodePracticePanel.tsx`
   - `frontend/src/components/ui/MarkdownCodePreview.tsx`
   - `frontend/src/lib/api/index.ts`
   - `frontend/src/lib/api/real.ts`
   - `frontend/src/lib/api/types.ts`
4. 网页端练习评测修复：
   - `frontend/src/app/(shell)/practice/page.tsx`
5. 视频详情页重做：
   - `frontend/src/app/(shell)/video/page.tsx`
6. 大屏展示文案和布局修正：
   - `frontend/public/screen/index.html`
   - `frontend/public/screen/students.html`
   - `frontend/public/screen/activity.html`
   - `frontend/public/screen/knowledge.html`
7. 说明文档和设计稿：
   - `docs/superpowers/specs/2026-06-09-miniapp-ui-redesign-design.md`
   - `Dorc/广度开发/...`

### 与 `build/hero` 的真实重叠点

只有两个文件在双方分叉后都改过：

1. `frontend/src/app/(shell)/generate/page.tsx`
2. `frontend/src/lib/api/real.ts`

其余迁移项都属于单边新增或单边修改，冲突面较小。

## 已执行的迁移策略

### 采用方式

- 未直接 merge 朋友分支到原分支。
- 在隔离分支对朋友新增提交 `467bd77d` 执行 `cherry-pick --no-commit`。
- 以 `build/hero` 为当前基线，检查自动合并结果。

### 两个重叠文件的处理结果

1. `frontend/src/app/(shell)/generate/page.tsx`
   - 保留了 `build/hero` 上“资源按最新时间排序”的既有逻辑。
   - 叠加了朋友分支的代码预览和代码练习面板能力。
2. `frontend/src/lib/api/real.ts`
   - 保留了 `build/hero` 上资源排序逻辑。
   - 叠加了 `evaluateCodeResource` 代码判题接口。

### 清理项

1. 移除了误提交的本地构建产物：
   - `miniapp/.swc/...`
2. 新增忽略规则：
   - `.gitignore` 增加 `miniapp/.swc/`
3. 回退无意义锁文件噪音：
   - `desktop/package-lock.json`

## 迁移清单

### A. 直接迁入，风险低

- `backend/app/clients/tts_client.py`
- `backend/app/routes/quiz.py`
- `backend/app/routes/voice_admin.py`
- `frontend/src/app/(shell)/practice/page.tsx`
- `frontend/src/app/(shell)/video/page.tsx`
- `frontend/public/screen/*.html`
- `desktop/package.json`
- `frontend/src/components/ui/CodePracticePanel.tsx`
- `frontend/src/components/ui/MarkdownCodePreview.tsx`
- `frontend/src/lib/api/index.ts`
- `frontend/src/lib/api/types.ts`
- `miniapp/` 全量新增
- 设计稿和说明文档

原因：这些改动不覆盖 `build/hero` 独有主线功能，且与当前分支没有实质性双边冲突。

### B. 已手工合并，风险中

- `frontend/src/app/(shell)/generate/page.tsx`
- `frontend/src/lib/api/real.ts`

原因：这两个文件同时承载你当前分支已上线的资源排序逻辑和朋友分支新增的代码练习能力，需要人工确认两侧行为都还成立。

### C. 后续需要重点回归验证，风险中高

- `backend/app/routes/resources.py`

原因：

- 新增了资源生成失败回退链路。
- 新增了代码判题 AI 逻辑。
- 这部分功能依赖模型服务返回格式，容易出现“接口通了但结果结构不稳定”的问题。

## 功能映射到朋友口述需求

### 1. 多智能体语言功能问题

对应迁移点：

- `backend/app/clients/tts_client.py`
- `backend/app/routes/voice_admin.py`
- `frontend/src/app/(shell)/video/page.tsx`

预期效果：

- WebSocket 连接参数兼容性更强。
- 播放/语音链路更不容易因 `proxy` 或 `ssl` 参数差异失败。

### 2. 代码资源生成修复

对应迁移点：

- `backend/app/routes/resources.py`
- `frontend/src/app/(shell)/generate/page.tsx`
- `frontend/src/components/ui/CodePracticePanel.tsx`
- `frontend/src/lib/api/*`

预期效果：

- 资源生成失败时会尝试 Spark 回退。
- 代码类资源支持更好的预览和在线判题。

### 3. 视频详情页面更改

对应迁移点：

- `frontend/src/app/(shell)/video/page.tsx`

预期效果：

- 视频页布局、学习状态、数字人陪学区、移动端交互整体重做。

### 4. 大屏文字和展示图修改

对应迁移点：

- `frontend/public/screen/index.html`
- `frontend/public/screen/students.html`
- `frontend/public/screen/activity.html`
- `frontend/public/screen/knowledge.html`

预期效果：

- 文案从“知识图谱”更明确收敛到“学生知识详情”。
- 气泡图、雷达图等视觉布局更适合当前展示内容。

### 5. 网页端练习评测答对却判错

对应迁移点：

- `frontend/src/app/(shell)/practice/page.tsx`

预期效果：

- 判题结果以后端返回为准，不再只靠前端本地比较。
- 已答题记录和解析同步回填，减少“明明答对却显示错误”的前端状态错判。

## 实施计划

1. 完成隔离分支迁移并保持 `build/hero` 不变。
2. 运行前端静态检查，先验证类型和语法。
3. 运行后端基础检查，确认资源路由和判题链路无语法问题。
4. 如条件允许，补充小程序安装/构建验证。
5. 通过后再提交隔离分支，供你人工确认是否继续合入正式主线。

## 测试计划

### 前端

- `frontend` 执行 lint
- 重点人工回归：
  - 资源生成页代码资源预览
  - 代码练习判题
  - 练习评测提交流程
  - 视频详情页打开、播放、数字人对话入口

### 后端

- 针对资源路由做语法编译检查
- 重点人工回归：
  - `/api/resources/generate`
  - `/api/resources/code/evaluate/:id`
  - `/api/quiz/*`
  - `/api/voice/*`

### 小程序

- 安装 `miniapp` 依赖
- 尝试 `build:weapp`
- 确认是否还需要补 `.gitignore`、环境变量、README

## 风险评估

### 低风险

- 大屏静态页文本和布局调整
- 小程序纯新增目录
- `desktop/package.json` 新增脚本

### 中风险

- 资源生成页与 API 层双边合并点
- 练习评测前端状态回写
- 视频详情页大改版带来的交互回归

### 高风险

- `backend/app/routes/resources.py` 的模型回退和 AI 判题结果解析
- 语音链路依赖外部服务时的播放稳定性
- 小程序首次构建依赖本机 Node/Taro 环境

## 建议的验收顺序

1. 先验前端网页端核心链路：
   - 资源生成
   - 练习评测
   - 视频详情页
2. 再验语言和播放能力：
   - TTS
   - 数字人对话
3. 最后验小程序：
   - 依赖安装
   - 编译通过
   - 页面结构可打开

## 当前状态

- 迁移分支已建立。
- 朋友最新新增提交已迁入隔离分支。
- 已完成双边重叠点处理。
- 已清理一项误提交构建产物。
- 已完成基础验证，结果如下：
  - 后端语法编译通过：
    - `backend/app/clients/tts_client.py`
    - `backend/app/routes/quiz.py`
    - `backend/app/routes/resources.py`
    - `backend/app/routes/voice_admin.py`
  - `miniapp` 执行 `npm ci` 后，`npm run build:weapp` 编译成功。
  - `frontend` 执行全量 `npm run lint` 失败，但失败主要来自仓库既有历史问题，不集中在本次迁移文件。
  - `frontend` 执行全量 `npm run build` 失败，阻塞点是既有重复全局声明：
    - `frontend/src/lib/auth.ts`
    - `frontend/src/components/layout/Sidebar.tsx`
    - `frontend/src/app/tutor/mcp-store/page.tsx`
  - 针对本次迁移文件执行定向 `eslint`，结果为 0 error，仅 9 个 warning。
