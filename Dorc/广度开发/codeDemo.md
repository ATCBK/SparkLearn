# 代码案例功能 — 设计方案与解决方案

## 一、问题背景



### 现状分析

| 维度 | 现状 | 问题 |
|------|------|------|
| 资源生成 | AI 生成 Markdown 纯文本，走 Coze 适配器 | Coze 配置为空时生成失败，返回"生成结果为空" |
| 内容展示 | `<pre>` 标签原样输出 | 无语法高亮、无 Markdown 渲染、截断 700 字符 |
| 代码编辑 | 不支持 | 无法修改代码、无法复制 |
| 代码运行 | 不支持 | 无法验证正确性，"可运行实践案例"为空话 |
| 专属配置 | 无 | 语言、难度等选项缺失 |

---

## 二、设计方案（三层递进）

### 方案一：Markdown 渲染 + 语法高亮

**目标：** 解决"不适配现代需求"，让代码案例看起来像现代编程学习平台。

#### 改动内容

**1. 新建组件 `MarkdownCodePreview.tsx`**

路径：`frontend/src/components/ui/MarkdownCodePreview.tsx`

- 封装 `react-markdown` + `remark-gfm`（已有依赖，复用 AIAssistant.tsx 的模式）
- 自定义 `code` 组件：有语言标记的代码块用 `@uiw/react-codemirror` 只读模式 + One Dark 主题渲染
- 无语言标记的行内代码用 `bg-[#f1f5f9] rounded px-1.5 py-0.5 font-mono` 样式
- Markdown 元素映射：h1/h2/h3 用设计系统字体、p 用 `text-small`、ul/ol 用标准列表、blockquote 用蓝色左边框
- 内置工具栏：语言标签、复制按钮（`navigator.clipboard`）、编辑切换、重置按钮

**2. 修改 `generate/page.tsx`**

- 第 274-275 行（资源库预览）：`<pre>` 替换为 `<MarkdownCodePreview>`，代码类型专属渲染
- 第 675 行（步骤 4 预览）：去掉 `slice(0, 700)` 截断，代码类型用 `<MarkdownCodePreview>` 完整渲染

**3. 修改 `practice/page.tsx`**

- 第 317 行：练习页代码片段 `<pre>` 替换为 `<MarkdownCodePreview>`，深色背景 + One Dark 主题自然融合

**4. 安装依赖**

```bash
npm install @codemirror/lang-python
```

项目已安装 `@uiw/react-codemirror`、`@codemirror/lang-html`、`@codemirror/lang-json`、`@codemirror/theme-one-dark`（均未使用），本次激活它们并补充 Python 语法支持。

---

### 方案二：结构化提示词 + 可编辑代码 + 代码专属配置

**目标：** 提升生成质量 + 让用户能在浏览器里编辑代码。

#### 改动内容

**1. 代码专属配置选项**

在 `generate/page.tsx` 步骤 2 配置区，当 `type === 'code'` 时显示：

- **编程语言选择器**：Python / JavaScript / HTML/CSS（对应 CodeMirror 已安装的语言包）
- **难度级别**：入门（零基础友好）/ 进阶（有一定基础）/ 高级（深入原理）
- **配套练习题开关**：勾选后 AI 在案例末尾附带 2-3 道可运行的编程练习

前端状态变量：

```typescript
const [codeLanguage, setCodeLanguage] = useState('python')
const [codeLevel, setCodeLevel] = useState('beginner')
const [codeIncludeExercise, setCodeIncludeExercise] = useState(true)
```

生成时将选项注入提示词：

```
编程语言：Python
难度：高级（深入原理）
要求：包含 2-3 道可运行的配套练习题（含测试用例）
主题需求：请基于"函数返回值"生成一个完整的代码案例...
```

**2. 后端结构化提示词**

修改 `backend/app/routes/resources.py` 的 `_build_resource_prompt()` 函数，代码类型提示词改为：

```
请生成一个代码学习案例，按 Markdown 格式输出。
必须包含以下章节：
「问题描述」用一两句话描述要解决的问题；
「代码实现」用 Markdown 代码块包裹完整可运行的代码并加注释；
「逐行讲解」对关键代码行用编号列表解释；
「运行结果」展示预期输出；
「常见错误」列出 2-3 个初学者常犯的错误；
「扩展练习」给出 1-2 个可以自己尝试修改的练习。
如果用户要求包含配套练习题，请在末尾增加「配套练习」章节，
用 JSON 代码块给出测试用例数组，
格式为 [{"name":"描述","input":"函数调用","expected":"期望输出"}]。
```

> 注意：提示词中不使用嵌套的 Markdown 代码块（\`\`\`），避免 LLM 解析混乱。

**3. 前端内容解析**

`parseCodeExercise()` 函数检测结构化内容，支持两种格式：
- `## 问题描述`（Markdown 标题格式）
- `「问题描述」`（中文方括号格式）

提取各章节内容后：
- 「代码实现」→ 提取代码块中的代码和语言
- 「配套练习」→ 提取 JSON 测试用例
- 其他章节 → 作为说明文字展示

---

### 方案三：交互式代码练习 + 后端运行 + 测试验证

**目标：** 把代码案例从"阅读材料"变成"可练习的编程题"，直接解决"无法直接练习"。

#### 改动内容

**1. 新建组件 `CodeExerciseCard.tsx`**

路径：`frontend/src/components/ui/CodeExerciseCard.tsx`

布局从上到下：

| 区域 | 组件 | 说明 |
|------|------|------|
| 头部 | ProtoCard + Pill | 标题、难度标签、语言标识 |
| 描述 | 文本区 | 问题描述，`whitespace-pre-wrap` |
| 编辑器 | @uiw/react-codemirror | One Dark 主题，行号，折叠，高亮当前行 |
| 操作栏 | ProtoButton | 运行代码（主按钮）、重置、查看提示、查看答案 |
| 提示区 | SoftCard | 蓝色背景，显示常见错误 |
| 答案区 | SoftCard | 绿色背景，显示参考代码 |
| 输出面板 | SoftCard + 终端风格 | stdout/stderr，成功绿色边框，失败红色边框 |
| 测试结果 | CheckCircle2/XCircle + Pill | 每个测试用例的通过/失败状态、期望值vs实际值 |

状态管理：

```typescript
const [code, setCode] = useState(initialCode)        // 编辑器内容
const [output, setOutput] = useState<string | null>    // stdout
const [stderr, setStderr] = useState<string | null>    // stderr
const [isRunning, setIsRunning] = useState(false)      // 加载状态
const [testResults, setTestResults] = useState<TestResult[] | null>  // 测试结果
const [showSolution, setShowSolution] = useState(false) // 答案可见性
const [showHints, setShowHints] = useState(false)       // 提示可见性
const [timedOut, setTimedOut] = useState(false)         // 超时标记
```

**2. 后端代码运行接口**

新建 `backend/app/routes/code_runner.py`，注册到 `main.py`。

接口一：`POST /api/code/run`

```json
// 请求
{ "code": "print('hello')", "language": "python" }

// 响应
{ "stdout": "hello\n", "stderr": "", "exit_code": 0, "timed_out": false }
```

实现：
- 使用 `asyncio.create_subprocess_exec(sys.executable, "-c", code)` 执行 Python 子进程
- 5 秒超时（`asyncio.wait_for`）
- 输出截断 10KB
- 跨平台：Windows 用 `sys.executable`，Linux 用 `python3`

接口二：`POST /api/code/run-tests`

```json
// 请求
{
  "code": "def add(a, b): return a + b",
  "language": "python",
  "test_cases": [
    { "name": "基本功能", "input": "add(2, 3)", "expected": "5" },
    { "name": "零值处理", "input": "add(0, 0)", "expected": "0" }
  ]
}

// 响应
{
  "results": [
    { "name": "基本功能", "passed": true, "expected": "5", "actual": "5" },
    { "name": "零值处理", "passed": true, "expected": "0", "actual": "0" }
  ],
  "stdout": "",
  "stderr": "",
  "timed_out": false,
  "exit_code": 0
}
```

实现：
- 将用户代码 + 测试断言拼接为一个 Python 脚本
- 用 `repr()` 比较实际输出和期望输出
- 捕获每个测试的异常，统一返回 JSON 格式结果

**3. 智能渲染策略**

`generate/page.tsx` 中根据内容自动选择渲染方式：

```
代码类型资源内容
  ├── 包含「问题描述」/「代码实现」结构化标记？
  │     ├── 是 → CodeExerciseCard（可编辑 + 可运行 + 测试验证）
  │     │         + MarkdownCodePreview（展示剩余说明章节）
  │     └── 否 → MarkdownCodePreview（语法高亮 + 可编辑 + 可复制）
  └── 非代码类型 → 原有 <pre> 纯文本展示
```

---

## 三、遇到的问题与解决

### 问题 1：代码生成结果为空

**现象：** 选择代码案例生成后，返回"code 生成结果为空，请稍后重试。"

**原因分析：**

1. `.env` 中 Coze 配置全为空：
   ```
   COZE_API_TOKEN=
   COZE_BOT_ID_RESOURCE_CODE=
   ```
2. 代码类型走 `coze_adapter.stream_resource_text()`，Token 为空时返回错误，但错误被静默吞掉，最终 `content` 为空字符串
3. `_fallback_resource_content()` 生成兜底文本："code 生成结果为空，请稍后重试。"

**对比：** blog 类型使用 `spark_lite.stream_chat_events()`（讯飞星火 LLM），不依赖 Coze，所以能正常工作。

**解决方案：** 将代码类型和 blog 类型合并到同一个分支，都走 `spark_lite`：

```python
# 修改前
elif resource_type == "blog":
    # 只有 blog 走 spark_lite
    ...

# 修改后
elif resource_type in ("blog", "code"):
    # blog 和 code 都走 spark_lite
    ...
```

修改文件：`backend/app/routes/resources.py` 第 107-145 行。

### 问题 2：嵌套代码块导致 LLM 解析失败

**现象：** 结构化提示词模板中包含 \`\`\`python 和 \`\`\` 作为模板文字，LLM 可能将其误解为实际代码块边界。

**原因：** 提示词模板直接写了：
```
"## 代码实现\n"
"```python\n"
"[完整可运行的代码]\n"
"```\n"
```

**解决方案：** 改用纯文字描述章节格式，不使用嵌套的 Markdown 代码块：
```
"「代码实现」用 Markdown 代码块包裹完整可运行的代码并加注释；"
```

### 问题 3：前端解析器只识别 `##` 格式

**现象：** AI 可能用 `「问题描述」` 或 `## 问题描述` 等不同格式输出章节标题。

**解决方案：** `parseCodeExercise()` 同时支持两种格式：

```typescript
const hasStructuredMarkers =
  /^##\s*(问题描述|代码实现|...)/m.test(content) ||
  /「(问题描述|代码实现|...)」/.test(content)

const sectionRegex = /^##\s*(.+)$|「(.+?)」[:：]?\s*$/gm
```

---

## 四、关键文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `frontend/src/components/ui/MarkdownCodePreview.tsx` | 新建 | Markdown + CodeMirror 语法高亮组件 |
| `frontend/src/components/ui/CodeExerciseCard.tsx` | 新建 | 交互式代码练习组件 |
| `backend/app/routes/code_runner.py` | 新建 | 代码运行 + 测试验证接口 |
| `backend/app/main.py` | 修改 | 注册 code_runner 路由 |
| `backend/app/routes/resources.py` | 修改 | 代码类型改走 spark_lite + 结构化提示词 |
| `frontend/src/app/(shell)/generate/page.tsx` | 修改 | 代码专属配置 + 智能渲染策略 |
| `frontend/src/app/(shell)/practice/page.tsx` | 修改 | 练习页代码片段语法高亮 |
| `frontend/package.json` | 修改 | 安装 @codemirror/lang-python |

---

## 五、验证方式

1. **生成验证：** 重启后端 → 进入资源生成页 → 选择"代码案例" → 确认步骤 2 出现语言/难度/练习选项 → 生成 → 确认返回结构化内容（问题描述、代码实现、讲解等）
2. **展示验证：** 在资源库中点击代码案例 → 确认代码块有语法高亮、Markdown 正常渲染、不截断
3. **编辑验证：** 点击代码块工具栏的编辑按钮 → 修改代码 → 点复制 → 确认剪贴板内容正确
4. **运行验证：** 代码块点"运行代码" → 确认输出面板显示结果 → 有测试用例时确认通过/失败状态
5. **练习页验证：** 进入练习页 → 确认代码片段有语法高亮（不再是纯白文本）
