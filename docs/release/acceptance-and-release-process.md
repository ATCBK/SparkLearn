# SparkLearn 验收上线流程

## 目标

这份流程用于把 SparkLearn 的交付从“本地能跑”推进到“可以验收、可以上线、上线后可回滚”。流程覆盖 CI 门禁、人工验收、生产发布和发布后检查。

## 分支与环境

- 功能开发分支：`feature/*` 或 `codex/*`
- 集成分支：`develop`
- 生产分支：`main`
- 生产部署：通过 GitHub Actions `SparkLearn CD` 手动触发

## CI 门禁

每次 push 或 PR 会触发 `SparkLearn CI`，包含四个 job：

| Job | 内容 | 目的 |
|---|---|---|
| 后端单元与接口测试 | `python -m pytest backend/tests -q` | 验证 API、鉴权、RAG、资源生成等后端逻辑 |
| 前端 lint 与构建 | `npm run lint`、`npm run build` | 验证 Next.js 代码质量和生产构建 |
| 双端 E2E 验收 | `npx playwright test` | 验证桌面端和移动端核心页面流程 |
| Docker 镜像构建检查 | 构建前后端镜像 | 验证部署镜像可构建 |

CI 全部通过后，代码才允许进入验收或合并。

### 当前后端测试债务

当前 CI 为了兼容已启用的强鉴权逻辑，把后端测试拆成两类：

- 鉴权相关测试使用真实 token 路径执行。
- 其他接口回归测试使用 `AUTH_DEV_BYPASS=true` 和 `SINGLE_USER_ID=ci-user` 执行。

以下旧测试仍在调用旧函数签名，已临时从 CI 后端回归集中排除，后续应单独修复后再移除 deselect：

- `backend/tests/test_subject_rag.py::test_subject_knowledge_file_can_be_indexed_and_retrieved`
- `backend/tests/test_tutor_role_generation.py::test_generate_role_from_question_uses_profile_and_persists`
- `backend/tests/test_tutor_role_generation.py::test_generate_role_from_question_uses_ai_analysis_and_generation`
- `backend/tests/test_voice_defaults.py::test_video_job_forces_single_default_voice`

## 验收清单

### 1. 后端验收

- 运行全部后端测试。
- 检查 `/health` 是否返回正常。
- 检查登录、注册、学习画像、路径规划、资源生成、练习评测、报告接口。
- AI 类接口需要覆盖正常输入、空输入、超长输入、第三方服务不可用降级。

### 2. 前端验收

- 桌面端 1440×900：检查布局、卡片层级、按钮状态、导航跳转。
- 移动端 375×812：检查单栏适配、底部导航、文字截断、触摸目标。
- 登录态、未登录态、空数据态、加载态、错误态都要看。
- 页面不得出现内部 ID、乱码、溢出文字或明显遮挡。

### 3. 集成链路验收

至少跑通以下链路：

| 链路 | 步骤 |
|---|---|
| 新用户学习闭环 | 注册/登录 → 画像采集 → 路径生成 → 资源生成 → 练习 → 报告 |
| 教师工作台 | 教师登录 → 学科管理 → 学生管理 → 干预中心 → 报告查看 |
| AI Tutor | 发起对话 → 生成建议 → A2UI 面板展示 → AG-UI 调用过程展示 |
| 学习广场 | 浏览帖子 → 查看详情 → 评论/收藏/点赞 |

### 4. 上线前检查

- GitHub Actions CI 全绿。
- `.env.deploy` 已更新并通过 Secrets 写入生产服务器。
- `docker-compose.deploy.yml` 中端口、域名、CORS 配置正确。
- 数据库文件已有备份。
- 生产服务器磁盘、内存、Docker 状态正常。
- 本次发布变更和回滚方式已经写入发布记录。

## 生产发布

1. 打开 GitHub Actions。
2. 选择 `SparkLearn CD`。
3. 点击 `Run workflow`。
4. 输入要部署的 `ref`，通常是 `main` 或稳定 tag。
5. 等待远程构建和 `docker compose up -d` 完成。
6. 查看部署日志和容器状态。

需要配置的 GitHub Secrets：

| Secret | 含义 |
|---|---|
| `DEPLOY_HOST` | 生产服务器 IP 或域名 |
| `DEPLOY_USER` | SSH 登录用户 |
| `DEPLOY_SSH_KEY` | SSH 私钥 |
| `DEPLOY_PORT` | SSH 端口，未配置时默认 22 |
| `DEPLOY_PATH` | 服务器上的项目目录 |
| `ENV_DEPLOY_FILE` | `.env.deploy` 文件完整内容 |

## 发布后检查

- 访问 `http://<DEPLOY_HOST>/health`。
- 打开首页，确认前端静态资源加载正常。
- 登录一个测试账号，确认 token、画像和主工作台正常。
- 检查后端日志、前端日志、Nginx 日志是否有持续错误。
- 检查核心功能至少一条完整链路。

## 回滚流程

如果上线后出现阻塞问题：

1. 在 GitHub Actions 重新运行 `SparkLearn CD`。
2. `ref` 填写上一个稳定 tag 或 commit。
3. 等待部署完成。
4. 重新执行发布后检查。
5. 在发布记录中标记本次回滚原因和影响范围。

## 发布结论模板

```markdown
# SparkLearn 发布验收记录

**发布日期**：
**发布 ref**：
**负责人**：

## CI 结果

| 项目 | 结果 | 链接 |
|---|---|---|
| 后端测试 | 通过/失败 | |
| 前端构建 | 通过/失败 | |
| E2E 验收 | 通过/失败 | |
| Docker 构建 | 通过/失败 | |

## 人工验收

| 链路 | 结果 | 备注 |
|---|---|---|
| 新用户学习闭环 | 通过/失败 | |
| 教师工作台 | 通过/失败 | |
| AI Tutor | 通过/失败 | |
| 学习广场 | 通过/失败 | |

## 结论

通过 / 不通过
```
