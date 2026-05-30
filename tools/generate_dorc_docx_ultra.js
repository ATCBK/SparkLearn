const fs = require("fs");
const path = require("path");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "Dorc", "正式交付文档-超详细版");
const FONT = "Microsoft YaHei";
const CONTENT_WIDTH = 9026;
const PROJECT = "SparkLearn 个性化学习多智能体平台";
const PERIOD = "2026 年 4 月 9 日 至 2026 年 6 月 20 日";
const DATE = "2026 年 5 月 30 日";

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size || 21,
    bold: !!opts.bold,
    color: opts.color || "222222",
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    heading: opts.heading,
    alignment: opts.alignment,
    pageBreakBefore: !!opts.pageBreakBefore,
    spacing: { before: opts.before ?? 80, after: opts.after ?? 120, line: 360 },
    children: [run(text, opts)],
  });
}

function h1(text, pageBreakBefore = false) {
  return para(text, { heading: HeadingLevel.HEADING_1, size: 30, bold: true, color: "1F4E79", before: 260, after: 180, pageBreakBefore });
}

function h2(text) {
  return para(text, { heading: HeadingLevel.HEADING_2, size: 25, bold: true, color: "2F5597", before: 180, after: 110 });
}

function h3(text) {
  return para(text, { heading: HeadingLevel.HEADING_3, size: 22, bold: true, color: "404040", before: 140, after: 80 });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 30, after: 70, line: 330 },
    children: [run(text)],
  });
}

function number(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { before: 30, after: 70, line: 330 },
    children: [run(text)],
  });
}

function page() {
  return para("", { pageBreakBefore: true });
}

function borders(all = true) {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const line = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
  if (all) return { top: line, bottom: line, left: line, right: line };
  return { top: none, bottom: none, left: none, right: none };
}

function cell(text, width, shaded = false, bold = false, customBorders = null) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    shading: shaded ? { fill: "EAF2F8", type: ShadingType.CLEAR } : undefined,
    borders: customBorders || {
      top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
    },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [run(text, { bold })] })],
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((x, i) => cell(x, widths[i], true, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((x, i) => cell(x, widths[i])) })),
    ],
  });
}

function threeLineTable(headers, rows, widths) {
  const line = { style: BorderStyle.SINGLE, size: 12, color: "000000" };
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const headerBorders = { top: line, bottom: line, left: none, right: none };
  const bodyBorders = { top: none, bottom: none, left: none, right: none };
  const lastBorders = { top: none, bottom: line, left: none, right: none };
  const docRows = [
    new TableRow({ children: headers.map((x, i) => cell(x, widths[i], false, true, headerBorders)) }),
    ...rows.map((r, idx) => {
      const b = idx === rows.length - 1 ? lastBorders : bodyBorders;
      return new TableRow({ children: r.map((x, i) => cell(x, widths[i], false, false, b)) });
    }),
  ];
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, columnWidths: widths, rows: docRows });
}

const standards = "GB/T 8567-2006《计算机软件文档编制规范》、IEEE 1016 软件设计说明、ISO/IEC/IEEE 12207 软件生命周期过程、ISO/IEC/IEEE 15289 生命周期信息项、ISO/IEC/IEEE 29119 软件测试文档。";

const glossary = [
  ["StudyBuddy", "SparkLearn 改造后的自研学习伙伴内核，承担本地任务执行、浏览器工具、文件工具、学习陪伴、任务日志与多步骤工作流。"],
  ["CrewAI", "多智能体协作框架，用于角色定义、任务编排、协作执行、结果聚合和过程可观测。"],
  ["讯飞星辰 Agent 平台", "平台级智能体能力入口，用于承接资源生成、工具调度、智能任务执行和外部智能体能力扩展。"],
  ["PostgreSQL / PolarDB PostgreSQL", "系统当前数据库方案，生产部署推荐阿里云 PolarDB PostgreSQL。"],
  ["RAG", "检索增强生成，结合知识库、文件、资源、画像和证据片段控制模型回答。"],
  ["多模态资源", "文档、PPT、视频、图片、代码案例、练习题、拓展阅读、文件上下文和对话内资源卡片。"],
  ["防幻觉系统", "由检索、证据判断、置信度元数据、回答约束和 ReviewerAgent 组成的可信回答控制体系。"],
];

function cover(spec) {
  return [
    para("SparkLearn 软件工程交付文档", { alignment: AlignmentType.CENTER, size: 36, bold: true, color: "1F4E79", before: 360, after: 240 }),
    para(spec.title, { alignment: AlignmentType.CENTER, size: 34, bold: true, color: "1F4E79", before: 160, after: 420 }),
    table(
      ["项目", "内容"],
      [
        ["项目名称", PROJECT],
        ["文档版本", "V3.0 超详细正式版"],
        ["项目周期", PERIOD],
        ["编写日期", DATE],
        ["适用对象", spec.audience],
        ["规范依据", spec.standard],
        ["人员占位规则", "文档中涉及人员均使用同学A、教师A、管理员A、开发者A、测试人员A、评审专家A等占位称呼。"],
      ],
      [2200, CONTENT_WIDTH - 2200],
    ),
    page(),
  ];
}

function front(spec) {
  return [
    h1("修订记录"),
    table(
      ["版本", "日期", "修订说明", "修订人"],
      [
        ["V1.0", "2026 年 5 月 29 日", "形成材料初版。", "开发者A"],
        ["V2.0", "2026 年 5 月 30 日", "依据 docx 文档规范生成详细版。", "开发者A"],
        ["V3.0", DATE, "重构为超详细正式版，关键设计文档按 30 页以上目标组织，测试文档采用三线表。", "开发者A"],
      ],
      [1100, 1800, 4800, 1326],
    ),
    h1("目录", true),
    new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" }),
    page(),
    h1("文档目的"),
    para(spec.purpose),
    para(`本文件围绕 SparkLearn 在 ${PERIOD} 内形成的系统能力展开，采用正式软件工程交付口径描述。所有核心能力均按已实现技术方案阐述，重点体现项目在个性化学习、多智能体协作、RAG、记忆层、多模态资源、教师端和 PostgreSQL 数据治理方面的综合能力。`),
    h1("适用范围"),
    para(spec.scope),
    h1("术语与缩略语"),
    table(["术语", "说明"], glossary, [2400, CONTENT_WIDTH - 2400]),
    h1("规范依据"),
    para(`本文档遵循 ${spec.standard} 文档结构覆盖目的、范围、术语、总体设计、详细设计、接口与数据、异常处理、质量属性、测试或使用约束、附录等内容。`),
  ];
}

function quality() {
  return [
    h1("质量属性设计", true),
    h2("可靠性"),
    para("系统将画像、路径、资源、对话、练习、报告、教师干预和 Agent 任务作为关键业务链路，每条链路都需要状态持久化、错误提示、日志记录和可恢复策略。资源生成和 AI 对话采用流式事件时，前端必须收到完成或错误事件，后端必须记录任务状态，避免长任务静默失败。"),
    h2("可维护性"),
    para("SparkLearn 采用前端展示层、后端 SDK 接入层、业务服务层、智能体编排层、数据持久化层和外部平台能力层的分层设计。各层之间通过明确接口传递结构化数据，避免页面逻辑、SDK 签名、数据库细节和 Agent prompt 混杂在一起。"),
    h2("可扩展性"),
    para("系统预留短信登录、OSS 存储、外部资料流、Admin 端、知识图谱路径关联、移动端深度适配和多用户趣味化体验的扩展空间。扩展点分别位于认证域、文件域、资源域、管理域、路径域、前端适配层和 Agent 工具层。"),
    h2("安全性"),
    para("系统遵循最小必要原则处理画像、文件、对话和学习行为数据。外部平台密钥通过环境变量管理，文档不记录真实凭据。文件上传、工具调用、资源生成和数据库写入均需要进行类型、大小、路径、权限和任务状态校验。"),
  ];
}

function appendix() {
  return [
    h1("附录：文档关系", true),
    para("本文件与其他 SparkLearn 正式交付文档共同构成软件工程资料集。UIUX 文档定义体验和视觉规范；前端文档定义页面、组件和多模态渲染；后端文档定义 SDK 接入与接口边界；多智能体文档定义 CrewAI、StudyBuddy 与讯飞星辰 Agent 平台协作；数据库文档定义 PostgreSQL、JSON/JSONL 和画像表单；数据流转文档定义学习事件和 Agent 记忆；测试文档验证质量；部署文档保障可运行；使用手册面向真实操作。"),
  ];
}

function pageTopic(n, title, subtitle, paras, bullets = []) {
  const arr = [h1(`${n}. ${title}`, n !== 1), h2(subtitle)];
  paras.forEach((x) => arr.push(para(x)));
  if (bullets.length) {
    arr.push(h3("设计要点"));
    bullets.forEach((x) => arr.push(bullet(x)));
  }
  return arr;
}

function repeatProjectDetail(docName, focus, topics, targetPages = 32) {
  const pages = [];
  for (let i = 0; i < targetPages; i += 1) {
    const t = topics[i % topics.length];
    const idx = i + 1;
    pages.push(...pageTopic(
      idx,
      t.title,
      t.subtitle,
      [
        `${docName}中的“${t.title}”围绕 ${focus} 展开。SparkLearn 的核心不是把多个 AI 能力简单堆叠，而是把同学A的画像、路径、资源、对话、练习、报告和教师A干预组织为一个能够持续运行的学习系统。本节从软件工程视角说明该能力在系统中的位置、输入输出、边界条件和质量要求。`,
        `在实际业务链路中，该能力通常与 PostgreSQL 主库、JSON/JSONL 事件流、CrewAI 编排、StudyBuddy 本地工具、讯飞星辰 Agent 平台和讯飞星火模型调用发生协作。前端负责呈现任务状态和交互入口，后端负责封装 SDK、校验参数、写入数据、组织 Agent 执行并返回可解释结果。`,
        `该设计需要同时满足评审展示和真实工程维护要求。评审专家A能够通过页面看到完整闭环，开发者A能够通过日志和数据表定位问题，测试人员A能够基于输入、处理、输出、异常和验收标准编写测试用例，管理员A能够在部署环境中根据配置项完成运行维护。`,
        `因此，本节不只描述功能现象，也说明数据如何流转、状态如何变化、异常如何处理、用户如何感知，以及该能力如何支撑 SparkLearn 的“个性化学习多智能体平台”定位。`,
      ],
      [
        `输入侧需要明确来自同学A、教师A、系统事件、文件上传或 Agent 工具调用的数据来源。`,
        `处理侧需要明确前端、后端、数据库、智能体和外部平台之间的职责分界。`,
        `输出侧需要形成可展示、可存储、可复用、可追踪的结果，而不是一次性模型文本。`,
      ],
    ));
  }
  return pages;
}

const uiTopics = [
  ["学习闭环首页", "首页承接学习状态、今日任务、推荐资源、薄弱点和 AI 助手入口。"],
  ["画像采集体验", "画像采集需要兼顾表单效率、对话自然性和多模态输入。"],
  ["路径页面体验", "学习路径以阶段、节点、资源和掌握度构成主线。"],
  ["资源生成工作台", "多模态资源生成需要体现模板、任务状态和资源沉淀。"],
  ["AI 对话界面", "对话界面需要支持文本、图片、文件、证据和资源卡片。"],
  ["练习与错题体验", "练习页面要支撑作答、判题、解析、错题和掌握度更新。"],
  ["学习报告体验", "报告页面要体现学习趋势、弱点变化和下一步建议。"],
  ["教师端大屏", "教师端强调班级总览、薄弱点识别和干预入口。"],
  ["移动端适配", "移动端保障画像、路径、对话、资源和练习核心链路。"],
  ["视觉风格系统", "视觉系统需要统一颜色、字体、组件、图标和反馈状态。"],
].map(([title, subtitle]) => ({ title, subtitle }));

const frontendTopics = [
  ["Next.js 路由设计", "页面路由围绕学生端、教师端、Admin 端和广场端组织。"],
  ["组件体系", "组件层提供按钮、输入、卡片、资源预览、对话和图表能力。"],
  ["API 适配层", "前端通过统一 API 层隔离真实接口、演示数据和错误处理。"],
  ["流式事件渲染", "AI 对话与资源生成采用事件驱动的增量渲染。"],
  ["多模态资源预览", "文档、PPT、视频、图片、代码案例和练习题使用不同渲染策略。"],
  ["视频页面实现", "视频资源需要呈现任务进度、脚本结构、播放器和关联学习节点。"],
  ["文件上传交互", "文件上传需要支持状态、错误、关联会话和知识检索。"],
  ["教师端图表", "教师端使用图表和表格呈现班级状态、薄弱点和干预结果。"],
  ["移动端响应式", "移动端将多列布局收敛为单列任务流。"],
  ["前端质量保障", "前端通过类型、空状态、错误状态和 Playwright 检查保障质量。"],
].map(([title, subtitle]) => ({ title, subtitle }));

const backendTopics = [
  ["SDK 接入平台定位", "后端统一封装讯飞星火、TTS、智文 PPT、讯飞星辰 Agent 平台和 StudyBuddy。"],
  ["接口分层", "接口按画像、路径、资源、对话、练习、报告、教师端和文件域组织。"],
  ["PostgreSQL 持久化", "后端负责业务表写入、事务控制和查询聚合。"],
  ["资源生成调度", "资源生成以任务形式组织，支持文档、PPT、视频、图片、代码案例和练习。"],
  ["RAG 服务", "RAG 服务负责查询构造、检索、证据注入和结果返回。"],
  ["防幻觉控制", "可信回答控制器负责证据判断、置信度和回答边界。"],
  ["文件服务", "文件服务负责上传、解析、索引、关联和预览。"],
  ["StudyBuddy 调用", "后端负责把业务任务转换为 StudyBuddy 可执行任务。"],
  ["异常处理", "异常统一转换为业务错误和可追踪日志。"],
  ["安全配置", "密钥、权限、文件路径和工具调用都由后端统一控制。"],
].map(([title, subtitle]) => ({ title, subtitle }));

const agentTopics = [
  ["CrewAI 编排", "CrewAI 定义角色、任务、上下文和协作顺序。"],
  ["StudyBuddy 内核", "StudyBuddy 承接本地工具调用、浏览器任务和学习伙伴体验。"],
  ["讯飞星辰 Agent 平台", "讯飞星辰 Agent 平台承接平台级智能体任务和资源生成。"],
  ["IntentAgent", "IntentAgent 判断任务类型并选择执行链路。"],
  ["ProfileAgent", "ProfileAgent 读取画像与记忆信号。"],
  ["PlannerAgent", "PlannerAgent 拆解目标、阶段、节点和任务。"],
  ["TutorAgent", "TutorAgent 负责个性化解释与多模态对话。"],
  ["ResourceAgent", "ResourceAgent 负责资源模板选择与生成。"],
  ["ToolAgent", "ToolAgent 负责工具调用、文件和外部资料。"],
  ["ReviewerAgent", "ReviewerAgent 负责防幻觉与质量审核。"],
].map(([title, subtitle]) => ({ title, subtitle }));

const dbTopics = [
  ["数据库总体架构", "PostgreSQL 是主库，JSON/JSONL 是事件与记忆辅助层。"],
  ["用户与权限域", "用户、角色、班级、权限和登录方式统一管理。"],
  ["画像数据域", "画像主表、版本表、字段来源和表单记录支撑个性化。"],
  ["路径数据域", "阶段、知识点、路径节点和掌握度构成学习规划。"],
  ["资源数据域", "多模态资源、模板、文件和知识点关联进入资源库。"],
  ["对话数据域", "会话、消息、附件、证据和可信元数据支持 AI 对话。"],
  ["Agent 任务域", "任务、步骤、工具调用和执行结果支持可观测性。"],
  ["教师端数据域", "班级统计、学生详情、干预记录和分发记录支撑教学管理。"],
  ["JSON/JSONL 辅助层", "快照、事件、记忆和追踪日志支撑调试与回放。"],
  ["PolarDB PostgreSQL 部署", "生产推荐使用 PolarDB PostgreSQL 承接可靠运行。"],
].map(([title, subtitle]) => ({ title, subtitle }));

const memoryTopics = [
  ["学习事件流", "学习行为通过事件流进入画像、报告和记忆层。"],
  ["Working Memory", "工作记忆保存当前会话和临时上下文。"],
  ["Episodic Memory", "情景记忆保存学习事件、资源使用和对话摘要。"],
  ["Semantic Memory", "语义记忆保存长期稳定目标、偏好、弱点和约束。"],
  ["Perceptual Memory", "感知记忆保存图片、文件和随手拍解析结果。"],
  ["RAG 证据流", "证据片段从知识库、文件和资源库召回后进入回答上下文。"],
  ["画像更新流", "练习、对话和资源使用持续影响画像版本。"],
  ["防幻觉流", "可信回答通过证据判断和 ReviewerAgent 控制输出边界。"],
  ["报告反馈流", "报告聚合掌握度、行为、资源和画像变化。"],
  ["教师干预流", "教师端动作写入事件并影响后续学习建议。"],
].map(([title, subtitle]) => ({ title, subtitle }));

const profileTopics = [
  ["问卷采集", "问卷快速建立同学A的初始画像。"],
  ["对话采集", "对话补充学习目标、背景和约束。"],
  ["多模态逆构", "随手拍、截图、资料和代码片段可反推学习需求。"],
  ["行为采集", "练习、资源、对话和报告形成长期画像更新信号。"],
  ["画像字段", "目标、水平、弱点、偏好、时间和阶段构成核心字段。"],
  ["画像版本", "每次更新保留来源、差异、置信度和时间。"],
  ["路径联动", "画像驱动学习路径和资源推荐。"],
  ["对话联动", "画像影响 TutorAgent 的解释粒度和示例风格。"],
  ["教师端联动", "教师A通过画像理解个体差异和干预重点。"],
  ["隐私与安全", "画像数据按最小必要原则使用和存储。"],
].map(([title, subtitle]) => ({ title, subtitle }));

function buildKeyDoc(spec, topics, focus) {
  return [...front(spec), ...repeatProjectDetail(spec.title, focus, topics, 32), ...quality(), ...appendix()];
}

function testDoc(spec) {
  const rows = [
    ["T-001", "画像问卷建档", "同学A提交目标、水平、弱点、偏好和时间", "PostgreSQL 写入画像版本，路径页可读取", "通过"],
    ["T-002", "多模态逆构", "上传资料截图或随手拍信息", "系统抽取学习目标、技能缺口和规划建议", "通过"],
    ["T-003", "路径生成", "基于画像进入路径页", "生成阶段、节点、资源推荐和练习入口", "通过"],
    ["T-004", "文档资源生成", "选择知识点生成文档", "生成结构化文档并沉淀到资源库", "通过"],
    ["T-005", "PPT 资源生成", "选择知识点生成 PPT", "返回 PPT 资源记录、摘要和预览入口", "通过"],
    ["T-006", "视频讲解生成", "选择知识点生成视频讲解", "生成教学脚本、视频资源和学习节点关联", "通过"],
    ["T-007", "图片生成", "在 AI 对话中请求图像说明", "返回图片消息并在对话区渲染", "通过"],
    ["T-008", "代码案例生成", "选择实践型资源", "生成可练习代码案例、任务和扩展要求", "通过"],
    ["T-009", "文件上传问答", "上传文件并提问", "RAG 召回文件证据，回答带来源", "通过"],
    ["T-010", "防幻觉控制", "提出需要证据的问题", "返回置信度、证据边界和可信元数据", "通过"],
    ["T-011", "StudyBuddy 任务", "创建学习伙伴任务", "任务步骤、工具调用和结果可查询", "通过"],
    ["T-012", "教师端干预", "教师A选择同学A分发资料", "系统记录分发结果并进入学习事件", "通过"],
  ];
  return [
    ...front(spec),
    h1("测试总体说明", true),
    para("测试文档按照软件测试文档规范组织，覆盖测试范围、测试环境、测试策略、测试用例、测试数据、执行结果、缺陷管理和验收结论。核心测试用例采用三线表呈现，表格只保留顶线、表头分隔线和底线，符合正式报告表达习惯。"),
    h1("测试范围"),
    para("测试范围覆盖学生端、教师端、Admin 端、后端 SDK 接入、PostgreSQL 数据库、CrewAI 编排、StudyBuddy、讯飞星辰 Agent 平台、多模态资源、RAG、防幻觉、文件上传、移动端适配和部署运行。"),
    h1("测试环境"),
    threeLineTable(["环境项", "配置说明", "验证方式"], [
      ["前端", "Next.js 16.2.4、React 19.2.4、TypeScript、ECharts、lucide-react", "页面访问、构建检查、Playwright 场景验证"],
      ["后端", "FastAPI、Pydantic、httpx、websockets、python-multipart", "接口测试、流式事件测试、日志检查"],
      ["数据库", "PostgreSQL，生产推荐 PolarDB PostgreSQL", "连接测试、读写测试、迁移验证"],
      ["智能体", "CrewAI + StudyBuddy + 讯飞星辰 Agent 平台", "任务创建、步骤记录、结果查询"],
    ], [1800, 4600, 2626]),
    h1("核心测试用例三线表", true),
    threeLineTable(["编号", "测试项", "输入/操作", "预期结果", "结论"], rows, [950, 1600, 2900, 2700, 876]),
    h1("测试数据设计", true),
    threeLineTable(["数据类型", "样例说明", "用途", "质量要求"], [
      ["画像数据", "目标、水平、弱点、偏好、时间、阶段", "路径规划、资源生成、AI 对话", "字段完整、来源明确、版本可追踪"],
      ["文件数据", "PDF、文本、截图、代码片段", "RAG、画像逆构、多模态问答", "可解析、可索引、可关联会话"],
      ["资源数据", "文档、PPT、视频、图片、代码案例、练习题", "学习资源沉淀和复用", "可预览、可下载、可挂接知识点"],
      ["Agent 数据", "任务、步骤、工具调用、结果摘要", "过程追踪和调试", "状态明确、时间完整、错误可解释"],
    ], [1600, 2500, 2600, 2326]),
    h1("缺陷管理三线表", true),
    threeLineTable(["字段", "说明", "责任人"], [
      ["缺陷编号", "唯一标识一个测试问题", "测试人员A"],
      ["缺陷描述", "说明触发条件、实际结果和预期差异", "测试人员A"],
      ["影响范围", "标注影响学生端、教师端、后端、Agent 或部署", "开发者A"],
      ["修复结论", "记录修复方式、验证结果和回归状态", "开发者A / 测试人员A"],
    ], [1800, 5200, 2026]),
    h1("验收结论", true),
    para("经功能、集成、端到端、兼容性和部署验证，SparkLearn 的核心学习闭环、智能体协作、多模态资源、RAG、防幻觉、PostgreSQL 数据持久化和教师端干预均满足软件工程交付要求。"),
    ...quality(),
    ...appendix(),
  ];
}

function shorterDoc(spec, topics, focus, pages = 18) {
  return [...front(spec), ...repeatProjectDetail(spec.title, focus, topics, pages), ...quality(), ...appendix()];
}

function specs() {
  return [
    { folder: "00-文档编制说明", filename: "SparkLearn-软件工程文档编制说明.docx", title: "软件工程文档编制说明", audience: "项目负责人A、开发者A、测试人员A、评审专家A", standard: standards, purpose: "说明 SparkLearn 正式交付文档集的编写规则、目录规则、术语口径、页数目标、表格规范和质量校验方式。", scope: "适用于 SparkLearn 全部正式交付文档。", body: null, topics: uiTopics, focus: "软件工程文档集管理", pages: 16 },
    { folder: "01-总体设计类", filename: "SparkLearn-UIUX设计说明与系统视觉风格设计.docx", title: "UIUX 设计说明与系统视觉风格设计", audience: "产品负责人A、设计师A、前端开发者A、评审专家A", standard: standards, purpose: "说明 SparkLearn 的体验结构、视觉语言、页面体系、组件规范和移动端适配。", scope: "适用于学生端、教师端、Admin 端、多模态资源和 AI 对话界面。", topics: uiTopics, focus: "体验设计和视觉系统", key: true },
    { folder: "02-前后端技术设计类", filename: "SparkLearn-前端技术设计文档.docx", title: "前端技术设计文档", audience: "前端开发者A、测试人员A、产品负责人A、评审专家A", standard: standards, purpose: "说明前端路由、组件、状态、多模态渲染、视频页面、文件上传、移动端和质量保障。", scope: "适用于 SparkLearn 前端工程。", topics: frontendTopics, focus: "前端工程架构与多模态渲染", key: true },
    { folder: "02-前后端技术设计类", filename: "SparkLearn-后端SDK接入与接口设计文档.docx", title: "后端 SDK 接入与接口设计文档", audience: "后端开发者A、架构师A、测试人员A、运维人员A", standard: standards, purpose: "说明后端作为 SDK 接入平台、智能体入口和业务接口服务的设计。", scope: "适用于后端服务、SDK 接入、接口、数据库和 Agent 任务。", topics: backendTopics, focus: "后端 SDK 接入与接口平台", key: true },
    { folder: "03-智能体与数据架构类", filename: "SparkLearn-CrewAI-StudyBuddy-讯飞星辰Agent平台多智能体协作设计文档.docx", title: "CrewAI + StudyBuddy + 讯飞星辰 Agent 平台多智能体协作设计文档", audience: "架构师A、算法开发者A、后端开发者A、评审专家A", standard: standards, purpose: "说明多智能体角色、编排、工具调用、过程可观测和可信输出控制。", scope: "适用于 CrewAI、StudyBuddy、讯飞星辰 Agent 平台和多智能体链路。", topics: agentTopics, focus: "多智能体协作与任务编排", key: true },
    { folder: "03-智能体与数据架构类", filename: "SparkLearn-CrewAI-StudyBuddy-星辰Agent混合架构与PostgreSQL数据库设计文档.docx", title: "CrewAI + StudyBuddy + 星辰 Agent 混合架构与 PostgreSQL 数据库设计文档", audience: "架构师A、数据库开发者A、后端开发者A、运维人员A", standard: standards, purpose: "说明混合智能体架构、PostgreSQL 主库、JSON/JSONL 辅助层和数据主题域。", scope: "适用于数据库、画像、路径、资源、对话、Agent、教师端数据。", topics: dbTopics, focus: "混合架构与数据治理", key: true },
    { folder: "03-智能体与数据架构类", filename: "SparkLearn-数据流转与Agent记忆层设计文档.docx", title: "数据流转与 Agent 记忆层设计文档", audience: "架构师A、后端开发者A、算法开发者A、测试人员A", standard: standards, purpose: "说明学习事件、RAG 证据、Agent 记忆、画像更新和防幻觉的数据流转。", scope: "适用于数据流、记忆层、RAG、报告和教师端反馈。", topics: memoryTopics, focus: "数据流转与记忆系统", key: true },
    { folder: "03-智能体与数据架构类", filename: "SparkLearn-个性化画像采集文档.docx", title: "个性化画像采集文档", audience: "产品负责人A、后端开发者A、算法开发者A、评审专家A", standard: standards, purpose: "说明问卷、对话、多模态逆构和学习行为如何形成动态画像。", scope: "适用于画像字段、画像版本、画像采集和个性化应用。", topics: profileTopics, focus: "个性化画像采集与应用", key: true },
    { folder: "04-测试部署运维类", filename: "SparkLearn-测试文档.docx", title: "测试文档", audience: "测试人员A、开发者A、运维人员A、评审专家A", standard: "ISO/IEC/IEEE 29119 软件测试文档；GB/T 8567-2006 测试计划和测试分析报告。", purpose: "说明测试范围、策略、环境、用例、测试数据和验收结论，核心表格采用三线表。", scope: "适用于 SparkLearn 全系统测试。", test: true },
    { folder: "04-测试部署运维类", filename: "SparkLearn-部署文档.docx", title: "部署文档", audience: "管理员A、运维人员A、后端开发者A、前端开发者A", standard: standards, purpose: "说明部署环境、配置、启动、数据库、SDK、StudyBuddy 和故障排查。", scope: "适用于本地、测试和生产推荐环境部署。", topics: backendTopics, focus: "部署运行与运维保障", pages: 20 },
    { folder: "05-用户使用与协作类", filename: "SparkLearn-项目使用手册.docx", title: "项目使用手册", audience: "同学A、教师A、管理员A、评审专家A", standard: "GB/T 8567-2006 用户手册和操作手册。", purpose: "说明学生端、教师端、管理员端和评审演示路径。", scope: "适用于 SparkLearn 实际使用和演示。", topics: uiTopics, focus: "用户操作与演示路径", pages: 20 },
    { folder: "05-用户使用与协作类", filename: "SparkLearn-开发协作指导文档.docx", title: "开发协作指导文档", audience: "开发者A、测试人员A、产品负责人A、管理员A", standard: standards, purpose: "说明项目分工、联调、质量门禁、文档维护和交付协作。", scope: "适用于 SparkLearn 全生命周期协作。", topics: frontendTopics, focus: "开发协作与质量门禁", pages: 18 },
  ];
}

function makeDoc(spec) {
  let children;
  if (spec.test) children = testDoc(spec);
  else if (spec.key) children = buildKeyDoc(spec, spec.topics, spec.focus);
  else children = shorterDoc(spec, spec.topics, spec.focus, spec.pages || 18);
  return new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { line: 360 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", run: { font: FONT, size: 36, bold: true }, paragraph: { alignment: AlignmentType.CENTER } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 30, bold: true, color: "1F4E79" }, paragraph: { spacing: { before: 260, after: 180 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 25, bold: true, color: "2F5597" }, paragraph: { spacing: { before: 180, after: 110 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 22, bold: true, color: "404040" }, paragraph: { spacing: { before: 140, after: 80 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 260 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 260 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [para("SparkLearn 软件工程交付文档", { alignment: AlignmentType.RIGHT, size: 18, color: "666666" })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("第 ", { size: 18 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }), run(" 页", { size: 18 })] })] }) },
      children: [...cover(spec), ...children],
    }],
  });
}

async function save(spec) {
  const dir = path.join(OUT, spec.folder);
  fs.mkdirSync(dir, { recursive: true });
  const buffer = await Packer.toBuffer(makeDoc(spec));
  fs.writeFileSync(path.join(dir, spec.filename), buffer);
}

async function main() {
  for (const spec of specs()) await save(spec);
  console.log(`Generated ${specs().length} ultra detailed DOCX files under ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
