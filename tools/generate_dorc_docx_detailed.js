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
const OUT = path.join(ROOT, "Dorc", "正式交付文档-详细版");
const PROJECT_NAME = "SparkLearn 个性化学习多智能体平台";
const PROJECT_PERIOD = "2026 年 4 月 9 日 至 2026 年 6 月 20 日";
const DOC_DATE = "2026 年 5 月 30 日";
const FONT = "Microsoft YaHei";
const CONTENT_WIDTH = 9026; // A4 width 11906 - 1440*2

const terms = [
  ["StudyBuddy", "SparkLearn 对本地智能体执行内核改造后的自研学习伙伴，用于承接本地工具调用、任务执行、浏览器自动化、学习陪伴和过程日志记录。"],
  ["CrewAI", "多智能体编排框架，用于定义角色、任务、协作顺序、结果聚合和多智能体执行链路。"],
  ["讯飞星辰 Agent 平台", "平台级智能体能力接入与任务执行平台，承担外部智能体能力、资源生成任务、工具调用和教学任务执行。"],
  ["讯飞星火", "SparkLearn 的核心大模型能力来源，承担对话、资源生成、内容优化、教学解释、结构化抽取和个性化逆构。"],
  ["RAG", "检索增强生成机制，通过知识库检索、用户文件检索、证据片段注入和可信回答控制提升回答可靠性。"],
  ["PostgreSQL / PolarDB PostgreSQL", "系统当前使用 PostgreSQL 作为主数据库方案，生产部署推荐使用阿里云 PolarDB PostgreSQL。"],
  ["JSON / JSONL", "用于事件审计、画像快照、Agent 记忆补充层、调试回放和过程日志的轻量数据格式。"],
  ["多模态资源", "包含文档、PPT、视频、图片、代码案例、练习题、拓展阅读、文件上下文和对话中的多媒体输出。"],
];

const commonStandards = "GB/T 8567-2006《计算机软件文档编制规范》、ISO/IEC/IEEE 12207 软件生命周期过程、ISO/IEC/IEEE 15289 生命周期信息项、IEEE 1016 软件设计说明、ISO/IEC/IEEE 29119 软件测试文档。";

function tr(text, options = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: options.size || 21,
    bold: !!options.bold,
    color: options.color || "222222",
    italics: !!options.italics,
    break: options.break || 0,
  });
}

function p(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    spacing: { before: options.before ?? 80, after: options.after ?? 120, line: 360 },
    children: [tr(text, options)],
  });
}

function title(text) {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 360 },
    children: [tr(text, { size: 36, bold: true, color: "1F4E79" })],
  });
}

function h1(text) {
  return p(text, { heading: HeadingLevel.HEADING_1, size: 30, bold: true, color: "1F4E79", before: 260, after: 180 });
}

function h2(text) {
  return p(text, { heading: HeadingLevel.HEADING_2, size: 25, bold: true, color: "2F5597", before: 220, after: 120 });
}

function h3(text) {
  return p(text, { heading: HeadingLevel.HEADING_3, size: 22, bold: true, color: "404040", before: 180, after: 90 });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 80, line: 330 },
    children: [tr(text)],
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { before: 40, after: 80, line: 330 },
    children: [tr(text)],
  });
}

function cell(text, width, shaded = false, bold = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    shading: shaded ? { fill: "D9EAF7", type: ShadingType.CLEAR } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
    },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [tr(text, { bold })] })],
  });
}

function table(headers, rows, widths) {
  const allRows = [
    new TableRow({ children: headers.map((h, i) => cell(h, widths[i], true, true)) }),
    ...rows.map((row) => new TableRow({ children: row.map((v, i) => cell(v, widths[i])) })),
  ];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: allRows,
  });
}

function pageBreak() {
  return new Paragraph({ children: [tr("", { break: 1 })], pageBreakBefore: true });
}

function cover(spec) {
  return [
    title("SparkLearn 软件工程交付文档"),
    p(spec.title, { alignment: AlignmentType.CENTER, size: 32, bold: true, color: "1F4E79", before: 260, after: 420 }),
    table(
      ["项目", "内容"],
      [
        ["项目名称", PROJECT_NAME],
        ["文档版本", "V2.0 详细正式版"],
        ["文档状态", "正式交付文档"],
        ["项目周期", PROJECT_PERIOD],
        ["编写日期", DOC_DATE],
        ["适用对象", spec.audience],
        ["规范依据", spec.standard],
        ["人名处理", "文档内涉及人员示例均使用同学A、教师A、管理员A、开发者A、测试人员A、评审专家A等占位称呼。"],
      ],
      [2200, CONTENT_WIDTH - 2200],
    ),
    pageBreak(),
  ];
}

function frontMatter(spec) {
  return [
    h1("修订记录"),
    table(
      ["版本", "日期", "修订说明", "修订人"],
      [
        ["V1.0", "2026 年 5 月 29 日", "形成项目材料初版。", "开发者A"],
        ["V2.0", DOC_DATE, "依据软件工程文档规范重写为详细正式版，统一 StudyBuddy、CrewAI、讯飞星辰 Agent 平台、PostgreSQL 等技术口径。", "开发者A"],
      ],
      [1300, 1900, 4500, 1326],
    ),
    h1("目录"),
    new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" }),
    pageBreak(),
    h1("文档目的"),
    p(spec.purpose),
    p(`本文件适用于 ${PROJECT_PERIOD} 内 SparkLearn 项目的设计、开发、测试、部署、验收、答辩和后续维护。文档采用正式软件工程交付口径描述，所有核心能力均按已实现技术方案展开说明。`),
    h1("适用范围"),
    p(spec.scope),
    h1("术语与缩略语"),
    table(["术语", "说明"], terms, [2300, CONTENT_WIDTH - 2300]),
    h1("编写规范依据"),
    p(`本文档编写遵循 ${spec.standard} 其中，设计类内容强调模块职责、接口边界、数据结构、执行流程和质量属性；测试类内容强调测试对象、测试策略、测试数据、验收标准和质量结论；用户手册类内容强调操作路径、角色差异和异常处理。`),
  ];
}

function qualitySection() {
  return [
    h1("质量属性与工程约束"),
    h2("可靠性"),
    p("系统围绕学习闭环中的关键业务动作建立可靠性约束。画像采集、资源生成、AI 对话、练习判题、学习报告和教师端干预均应具备状态记录、错误提示、日志追踪和数据持久化。外部 SDK 调用失败时，后端统一转换为可解释的业务错误，避免将平台密钥、堆栈信息或模型内部错误暴露给同学A、教师A或评审专家A。"),
    h2("可维护性"),
    p("SparkLearn 按前端页面层、后端 SDK 接入层、业务服务层、Agent 编排层、数据持久化层和外部平台接入层划分职责。前端不直接接触外部平台密钥，后端不把具体页面样式写入业务逻辑，Agent 编排不直接处理数据库迁移细节。分层设计使开发者A可以在局部修改资源生成、记忆策略或页面展示时，不破坏其他主链路。"),
    h2("可扩展性"),
    p("系统允许新增资源类型、Agent 角色、外部工具、数据库字段和教师端分析指标。CrewAI 用于角色编排，StudyBuddy 用于本地工具执行，讯飞星辰 Agent 平台用于平台级智能体能力接入，PostgreSQL 用于结构化持久化，JSON/JSONL 用于事件流和调试回放。该组合为后续接入短信登录、OSS 存储、外部资料流、知识图谱和 Admin 端提供扩展基础。"),
    h2("安全性"),
    p("系统遵循最小必要原则处理用户数据。画像数据、学习事件、文件内容和对话记录均应按业务目的使用。密钥通过环境变量或部署配置管理，不写入文档正文、前端代码和版本库。文件上传、资源生成和工具调用均需要校验文件类型、大小、路径和任务权限。"),
  ];
}

function relationSection() {
  return [
    h1("与其他文档的关系"),
    p("本文件是 SparkLearn 软件工程交付文档集的一部分。UIUX 文档定义体验和视觉规则；前端技术设计文档定义页面、组件和多模态渲染；后端 SDK 接入文档定义平台能力封装和业务接口边界；多智能体协作文档定义 CrewAI、StudyBuddy 与讯飞星辰 Agent 平台的任务协作；混合架构与数据库文档定义 PostgreSQL、JSON/JSONL 和画像表单；数据流转与记忆层文档定义学习数据如何进入 Agent 上下文；测试文档验证质量；部署文档确保系统可运行；使用手册面向同学A、教师A和评审专家A。"),
  ];
}

function roleTable() {
  return table(
    ["角色", "使用目标", "核心操作", "系统响应"],
    [
      ["同学A", "获得个性化学习路径、多模态资源和 AI 辅导。", "完成画像采集、查看路径、生成资源、上传文件、提问、练习。", "形成画像、规划路径、生成资源、更新记忆、输出报告。"],
      ["教师A", "掌握班级学习状态并进行教学干预。", "查看大屏、筛选学生、查看画像、分发资料、查看报告。", "聚合班级指标、生成干预建议、记录资料分发结果。"],
      ["管理员A", "维护系统部署、数据库、密钥和运行状态。", "配置 PostgreSQL、检查 SDK、维护文件目录、处理异常。", "保障服务稳定、日志可查、数据可恢复。"],
      ["开发者A", "开发、联调、测试和维护平台能力。", "修改代码、扩展 Agent、编写测试、维护文档。", "形成可验证、可交付、可演示的软件成果。"],
    ],
    [1300, 2300, 2800, 2626],
  );
}

function scheduleSection() {
  return [
    h1("项目周期与阶段成果"),
    p(`SparkLearn 项目周期统一定义为 ${PROJECT_PERIOD}。文档中的设计、测试、部署和使用说明均围绕该周期内形成的软件能力展开。`),
    table(
      ["阶段", "时间范围", "阶段目标", "主要成果"],
      [
        ["启动与需求确认", "2026 年 4 月 9 日 至 2026 年 4 月 18 日", "明确赛题、用户角色、核心闭环和技术路线。", "形成学习闭环、功能树、技术路线和文档框架。"],
        ["核心功能建设", "2026 年 4 月 19 日 至 2026 年 5 月 12 日", "完成学生端主流程、资源生成、练习报告和教师端基础能力。", "完成画像、路径、资源、对话、练习、报告、教师端大屏。"],
        ["智能体与数据深化", "2026 年 5 月 13 日 至 2026 年 5 月 30 日", "完成 CrewAI、StudyBuddy、讯飞星辰 Agent 平台融合和 PostgreSQL 迁移。", "完成 RAG 重构、记忆层重写、防幻觉系统、多模态对话和资源模板沉淀。"],
        ["测试优化与交付", "2026 年 5 月 31 日 至 2026 年 6 月 20 日", "完成质量验证、部署固化、文档交付和答辩演示准备。", "形成测试文档、部署文档、使用手册和软件工程交付文档集。"],
      ],
      [1600, 2100, 2600, 2726],
    ),
  ];
}

function makeDoc(spec) {
  const children = [
    ...cover(spec),
    ...frontMatter(spec),
    ...spec.sections,
    ...qualitySection(),
    ...relationSection(),
  ];
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 21 },
          paragraph: { spacing: { line: 360 } },
        },
      },
      paragraphStyles: [
        { id: "Title", name: "Title", run: { font: FONT, size: 36, bold: true }, paragraph: { alignment: AlignmentType.CENTER } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 30, bold: true, color: "1F4E79" }, paragraph: { spacing: { before: 260, after: 180 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 25, bold: true, color: "2F5597" }, paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 22, bold: true, color: "404040" }, paragraph: { spacing: { before: 180, after: 90 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 260 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 260 } } } }] },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: { default: new Header({ children: [p("SparkLearn 软件工程交付文档", { alignment: AlignmentType.RIGHT, size: 18, color: "666666" })] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [tr("第 ", { size: 18 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }), tr(" 页", { size: 18 })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

function uiuxSections() {
  return [
    ...scheduleSection(),
    h1("产品体验设计总览"),
    p("SparkLearn 的 UIUX 设计不是单纯的页面美化，而是围绕个性化学习闭环建立的一套学习操作界面。平台首要任务是让同学A清楚知道自己当前处在什么学习阶段、下一步应该做什么、为什么系统推荐这些内容，以及学习行为如何影响画像、路径和报告。"),
    p("系统体验采用“任务推进 + 数据反馈 + AI 辅导常驻”的结构。首页承接学习状态总览，画像页面承接个性化输入，路径页面承接阶段规划，资源页面承接多模态产物，练习页面承接掌握度验证，报告页面承接学习反馈，AI 对话贯穿所有页面。"),
    h2("学生端信息架构"),
    p("学生端页面以学习闭环顺序组织。首页显示学习进度、今日任务、推荐资源、薄弱知识点、学习打卡和 AI 助手入口。画像页显示基础画像、学习偏好、弱点、目标、时间约束和可编辑字段。路径页以知识阶段和节点为主线，展示当前节点、后续节点、关联资源和练习入口。资源生成页支持文档、PPT、视频、图片、代码案例、练习题等多模态资源。"),
    p("AI 对话页面既是问答入口，也是文件理解、图片生成、资源解释和学习计划细化入口。对话区中的消息不只包含文本，还包含图片、文件引用、资源卡片、证据来源、置信度提示和可继续操作的建议。"),
    h2("教师端信息架构"),
    p("教师端面向教师A的班级管理和教学干预场景。教师A需要快速理解班级整体情况，所以页面优先呈现班级概览、学习活跃度、薄弱知识点排行、掌握度分布、资源使用情况和高风险学生提醒。教师A进入学生详情后，可以看到同学A的画像、路径、练习、报告和系统生成的干预建议。"),
    p("教师端视觉风格比学生端更偏数据工具，强调密度、可扫描性和横向比较。图表用于表达趋势、分布和风险等级，表格用于呈现学生列表和资料分发记录，操作按钮用于筛选、推送、查看详情和生成报告。"),
    h2("视觉语言"),
    p("系统视觉采用清晰、可信、温和的学习产品风格。颜色体系应区分主操作、辅助操作、提醒、成功、风险和资源类型。主色用于关键按钮、当前路径节点和 AI 助手入口；绿色用于完成状态；黄色用于需关注状态；红色用于风险提示；蓝色用于知识、资源和可信证据。"),
    p("字体层级遵循页面标题、模块标题、正文、辅助说明四级结构。正文必须保证可读性，避免字体过小。移动端优先保证主任务文字、按钮文字、题目内容和 AI 对话内容的阅读体验。"),
    h2("组件规范"),
    p("按钮用于明确命令，例如生成、上传、提交、保存、查看、分发和重试。图标用于高频工具，例如搜索、筛选、下载、播放、刷新、展开、关闭和设置。卡片用于单个资源、单个任务、单个报告摘要或单个学生信息，不将完整页面包装为多层卡片。"),
    p("资源卡片必须包含资源类型、标题、生成状态、来源、更新时间、预览入口和操作入口。对视频、PPT、文档、代码案例和练习题，卡片需要显示不同的内容摘要，帮助同学A判断是否继续查看。"),
    h2("移动端适配"),
    p("移动端支持同学A在手机上完成画像采集、路径查看、AI 对话、资源预览和练习提交。布局从桌面端的多列结构收敛为单列结构，导航可折叠，操作按钮靠近拇指可触区域。AI 对话输入框固定在底部，资源预览区避免横向溢出，表格信息转换为卡片或折叠面板。"),
    p("移动端不是独立简化版，而是学习闭环的连续入口。用户在电脑端生成的资源、报告和路径状态，应能在手机端继续查看；手机端通过随手拍输入的资料，也应能进入画像逆构、RAG 检索和资源生成流程。"),
    h1("典型角色与体验路径"),
    roleTable(),
    h1("页面验收标准"),
    ...[
      "页面首屏必须让同学A看到当前学习状态和下一步任务。",
      "任意关键页面必须提供 AI 辅导入口，且 AI 能感知当前页面上下文。",
      "多模态资源必须可预览、可沉淀、可再次打开。",
      "教师端必须支持从班级总览进入单个学生详情。",
      "移动端必须保证核心任务不依赖横向滚动。",
    ].map(bullet),
  ];
}

function frontendSections() {
  return [
    ...scheduleSection(),
    h1("前端架构定位"),
    p("SparkLearn 前端承担学习闭环的交互组织、多模态资源展示、AI 对话承载、教师端数据呈现和移动端体验适配。前端不只是接口调用层，而是将画像、路径、资源、练习、报告和 Agent 协作过程转化为可理解界面的产品层。"),
    p("前端采用 Next.js App Router 组织页面结构，学生端、教师端、广场端、认证页、画像页、AI 辅导页和多模态资源页通过路由分组管理。组件层提供按钮、输入、卡片、对话、资源预览、进度、空状态、错误状态和图表等复用能力。"),
    h2("路由与页面结构"),
    p("学生端核心路由包括首页、画像、学习路径、资源生成、知识库、练习、错题、收藏、学习报告、AI 学习伙伴和视频资源。教师端核心路由包括教师首页、大屏、学生列表、学生详情、教学干预、资料分发和报告查看。"),
    p("路由设计遵循业务闭环，而不是技术模块堆叠。用户从首页进入画像、路径、资源、练习和报告时，页面状态应保持连续；从资源进入 AI 对话时，对话上下文应携带资源 ID、知识点、页面来源和用户画像摘要。"),
    h2("状态管理与 API 适配"),
    p("前端通过 API 适配层屏蔽后端真实服务、演示数据、流式事件和错误处理差异。对于生成类任务，前端需要维护 task_id、status、progress、message、result、error 等状态。对于 AI 对话，前端需要维护消息列表、输入状态、附件列表、流式增量内容和完成事件。"),
    p("用户画像、当前路径节点、选中文件、资源生成状态和 AI 对话上下文属于跨页面状态。前端需要保证页面跳转后，用户不丢失刚上传的文件、刚生成的资源和刚进行的对话上下文。"),
    h2("多模态资源渲染设计"),
    p("文档资源使用 Markdown/富文本渲染，支持标题、列表、表格、代码块、引用和下载。PPT 资源以资源地址、页数摘要和预览入口呈现。视频资源以生成状态、讲解脚本、播放器和资源元数据呈现。图片资源在对话区和资源库均可展示。代码案例资源必须包含说明、代码、练习任务、可复制入口和扩展建议。"),
    p("多模态资源的前端展示必须服务学习任务，而不是只展示文件。资源卡片需要说明该资源对应哪个知识点、适合哪个阶段、解决什么薄弱点、来自哪个生成模板，以及是否已经被同学A学习或收藏。"),
    h2("AI 对话多模态实现"),
    p("AI 对话采用流式事件驱动渲染。后端可发送 text、image、file、source、confidence、resource、step、done、error 等事件类型，前端按事件类型增量更新消息。文本增量进入当前助手消息，图片事件生成图片消息，source 事件生成证据引用区域，confidence 事件生成可信度提示。"),
    p("对话输入区支持文本、文件、图片和当前页面上下文。文件上传完成后，前端将 file_id 传入对话请求；页面上下文包含 route、knowledge_point、resource_id、profile_summary 等字段；同学A在资源页面提问时，AI 能针对当前资源进行解释和拓展。"),
    h2("视频资源技术实现与渲染"),
    p("视频生成在前端呈现为长任务。用户发起生成后，前端显示进度、当前阶段、脚本摘要和可取消/重试入口。生成完成后，播放器读取后端返回的视频资源地址，并将脚本、封面、资源类型、知识点和生成模板一起展示。"),
    p("视频内容按正常教学讲解组织，包括知识点导入、概念解释、示例演示、常见错误、练习建议和总结。前端不把视频视为孤立文件，而是与学习路径节点、资源库、练习题和 AI 对话打通。"),
    h2("移动端技术要求"),
    p("移动端采用响应式断点和单列布局。导航从侧边栏转换为底部或抽屉式导航，资源列表转换为纵向卡片，教师端复杂表格转换为分组面板。AI 对话输入框固定在可触达区域，上传和发送按钮保持足够触控面积。"),
    p("移动端性能需要控制首屏资源体积。图片资源使用合适尺寸，视频预览按需加载，图表延迟渲染，长列表使用分页或虚拟滚动策略。"),
  ];
}

function backendSections() {
  return [
    ...scheduleSection(),
    h1("后端总体定位"),
    p("SparkLearn 后端是 SDK 接入平台、智能体编排入口、业务数据中枢和多模态资源调度中心。后端不应被描述为普通 API 清单，因为它承担了外部模型 SDK、讯飞星辰 Agent 平台、CrewAI、StudyBuddy、PostgreSQL、RAG、防幻觉和资源生成模板之间的协调职责。"),
    p("前端面向业务接口发起请求，后端负责将请求转换为模型调用、工具调用、数据库读写、文件处理和 Agent 任务。这样可以让前端保持简单，让 SDK 密钥、签名、重试、异常、限流和日志都集中在后端控制。"),
    h2("SDK 接入平台分层"),
    p("SDK 接入层负责封装讯飞星火、讯飞 TTS、讯飞智文 PPT、讯飞星辰 Agent 平台等外部能力。业务服务层负责画像、路径、资源、对话、练习、报告和教师端逻辑。Agent 编排层负责 CrewAI、StudyBuddy 和 ReviewerAgent 等角色协作。数据层负责 PostgreSQL、JSON/JSONL 事件流和文件存储。"),
    p("每个 SDK 接入模块都应提供统一的调用入口、输入结构、输出结构、错误转换和日志记录。业务层不直接拼接 SDK 签名，不直接暴露平台响应原文，而是使用内部标准数据结构。"),
    h2("核心业务接口域"),
    p("画像域接口负责问卷提交、对话采集、多模态逆构、画像查询、画像更新和画像版本记录。路径域接口负责学习阶段、知识点节点、推荐资源和掌握度关联。资源域接口负责生成文档、PPT、视频、图片、代码案例和练习题。对话域接口负责 AI Tutor、多模态消息、文件上下文、RAG 证据和可信回答元数据。"),
    p("教师端接口负责班级总览、学生详情、教学干预、资料分发和报告聚合。文件域接口负责上传、解析、索引、关联会话和资源预览。工具域接口负责 StudyBuddy 工具调用、浏览器任务、外部资料检索和任务日志查询。"),
    h2("流式接口设计"),
    p("AI 对话和资源生成均适合采用流式返回。流式事件能让同学A看到生成过程，也能让前端逐步渲染文本、图片、证据、进度和完成状态。事件类型包括 progress、text、image、resource、source、confidence、step、done 和 error。"),
    p("流式接口必须保证最终有 done 或 error 事件。中途异常不能让前端无限等待。对于多模态资源生成，后端需要在任务完成后写入资源表，并返回 resource_id、type、title、url、metadata、created_at 等字段。"),
    h2("SDK 安全与配置"),
    p("所有 SDK 凭据通过环境变量或部署平台配置管理。文档中只出现配置项名称和用途，不出现真实密钥。后端启动时检查必要配置是否存在，并在调用前进行模型名称、发音人、文件路径和任务类型校验。"),
    p("讯飞 TTS 发音人选择由后端维护映射表，前端只传业务选项，后端转换为 SDK 参数。讯飞智文 PPT 调用由后端组织标题、大纲、作者和生成参数。讯飞星辰 Agent 平台调用由后端封装任务输入、用户标识、工具权限和返回结果。"),
    h2("异常处理"),
    p("后端异常分为参数错误、权限错误、文件错误、数据库错误、SDK 调用错误、Agent 执行错误和资源生成错误。每类异常都应转换为统一业务响应，包含错误码、错误消息、建议操作和 request_id。日志中保留详细信息，响应中不暴露内部堆栈。"),
  ];
}

function multiAgentSections() {
  return [
    ...scheduleSection(),
    h1("多智能体架构目标"),
    p("SparkLearn 使用 CrewAI + StudyBuddy + 讯飞星辰 Agent 平台构成混合多智能体体系。该体系的目标是把复杂学习任务拆解为可观察、可协作、可复用的智能体角色，让画像、路径、资源、辅导、工具、审核和记忆更新形成完整链路。"),
    p("单一模型调用很难表达教育系统中的任务分工，也不利于展示系统做了什么。多智能体架构能够记录每个角色的输入、判断、工具调用和输出，使评审专家A可以看到系统如何从同学A的输入一步步生成教学结果。"),
    h2("三层智能体职责"),
    p("CrewAI 负责角色定义和任务编排，适合表达 ProfileAgent、PlannerAgent、TutorAgent、ResourceAgent、ToolAgent、ReviewerAgent 等角色之间的协作关系。StudyBuddy 负责本地执行，适合处理浏览器工具、文件工具、资源保存、任务步骤和学习伙伴交互。讯飞星辰 Agent 平台负责平台级 Agent 能力，适合承接外部任务、资源生成、工具扩展和模型增强。"),
    p("三者不是重复关系，而是分层协作关系。CrewAI 管流程，StudyBuddy 管本地工具和执行体验，讯飞星辰 Agent 平台管外部智能体能力和平台生态。"),
    h2("核心 Agent 角色"),
    p("IntentAgent 判断同学A当前输入是知识问答、资源生成、路径规划、文件理解、图片生成还是教师端干预。ProfileAgent 读取画像和记忆，提供目标、水平、偏好、弱点和阶段。PlannerAgent 把目标拆成阶段、节点、任务和资源需求。TutorAgent 负责教学解释和多轮对话。ResourceAgent 负责多模态资源生成。ToolAgent 负责浏览器、文件、检索和外部工具。ReviewerAgent 负责防幻觉、证据一致性、格式审核和风险提示。"),
    p("这些角色的输出不是只给模型内部使用，也会进入执行日志。系统可以记录每个 Agent 的步骤、耗时、状态和摘要，便于调试、回放和答辩展示。"),
    h2("典型协作链路"),
    ...[
      "个性化问答链路：IntentAgent 识别问题类型，ProfileAgent 注入画像，RAG 检索证据，TutorAgent 生成解释，ReviewerAgent 做可信审核，MemoryAgent 写入长期记忆。",
      "资源生成链路：IntentAgent 识别资源类型，PlannerAgent 明确教学目标，ResourceAgent 选择模板并生成内容，ToolAgent 保存资源，ReviewerAgent 检查结构质量，资源表写入 PostgreSQL。",
      "画像逆构链路：同学A上传随手拍或资料片段，ToolAgent 解析输入，ProfileAgent 抽取目标和约束，PlannerAgent 生成学习规划，MemoryAgent 更新画像版本。",
      "教师干预链路：教师A选择班级或同学A，系统聚合画像和掌握度，PlannerAgent 形成干预建议，ResourceAgent 匹配资料，ToolAgent 完成资料分发记录。",
    ].map(numbered),
    h2("过程可观测性"),
    p("多智能体执行必须可观测。每次任务记录 task_id、user_id、agent_name、input_summary、tool_calls、status、started_at、finished_at、duration_ms、output_summary 和 error_message。执行记录进入 PostgreSQL，关键事件进入 JSONL，便于本地回放和线上排错。"),
  ];
}

function databaseSections() {
  return [
    ...scheduleSection(),
    h1("混合架构概述"),
    p("SparkLearn 当前数据库方案以 PostgreSQL 为主库，生产推荐 PolarDB PostgreSQL。JSON 和 JSONL 不再承担核心业务主存储，而是作为事件流、快照、Agent 记忆补充、离线调试和演示回放的辅助层。"),
    p("混合架构的设计目标是兼顾关系型数据的一致性、复杂查询能力和事件型数据的灵活记录能力。画像、资源、对话、练习、报告、教师端数据进入 PostgreSQL；Agent 执行步骤、学习事件、过程摘要和快照进入 JSON/JSONL。"),
    h2("PostgreSQL 主题域"),
    p("用户与权限域保存用户、角色、班级、登录方式、权限和账户状态。画像域保存画像主表、画像版本、画像字段来源、表单结果和多模态逆构结果。路径域保存学习阶段、知识点、路径节点、节点状态和推荐资源关联。资源域保存文档、PPT、视频、图片、代码案例、练习题、外部资源和模板信息。"),
    p("对话与记忆域保存会话、消息、附件、RAG 证据、Agent 记忆、执行步骤和可信回答元数据。教师端域保存班级指标、学生概览、教学干预、资料分发、报告聚合和大屏配置。"),
    h2("画像与表单数据模型"),
    p("画像模型包含 user_id、goal、knowledge_level、weak_points、learning_preference、daily_time、cognitive_style、practical_ability、current_stage、version、source_type、confidence、created_at 和 updated_at。表单数据保留原始选项，画像表保存规范化字段，画像版本表记录每次变更。"),
    p("多模态逆构结果需要保存输入类型、解析文本、识别出的学习目标、项目意图、技能缺口、推荐阶段、置信度和关联文件。这样同学A提供的随手拍、代码截图或资料片段可以转化为可追踪的学习规划依据。"),
    h2("资源与模板模型"),
    p("资源表记录 type、title、summary、content_url、preview_url、metadata、template_id、knowledge_point、profile_version、created_by、created_at 和 status。模板表记录资源类型、适用阶段、结构要求、提示词片段、输出格式和质量标准。"),
    p("固定优质模板是资源稳定生成的关键。文档模板包含学习目标、核心概念、示例、常见错误和练习建议；代码案例模板包含场景、代码、运行说明、练习任务和扩展挑战；视频模板包含导入、讲解、示例、总结和练习引导。"),
    h2("JSON/JSONL 辅助层"),
    p("profile_snapshot.json 用于保存当前画像快照，便于快速注入 Agent 上下文。learning_events.jsonl 用于保存学习行为事件，包括画像提交、路径生成、资源生成、练习提交、报告生成和对话摘要。agent_trace.jsonl 用于保存 Agent 执行步骤和工具调用。"),
    p("JSON/JSONL 文件不能替代 PostgreSQL 的业务一致性，但可以提高调试效率。开发者A在本地排查问题时可以直接查看事件流，评审专家A在答辩时也可以通过事件日志理解系统的动态学习过程。"),
  ];
}

function dataMemorySections() {
  return [
    ...scheduleSection(),
    h1("数据流转总览"),
    p("SparkLearn 的数据流转从同学A的输入开始，经过画像采集、路径规划、资源生成、AI 对话、练习评测、学习报告和画像更新，最终形成持续演化的学习闭环。每一步都产生结构化数据、事件日志和 Agent 可用上下文。"),
    p("系统将数据分为业务数据、事件数据、记忆数据、文件数据和证据数据。业务数据进入 PostgreSQL；事件数据进入 JSONL；记忆数据同时在 PostgreSQL 和 JSON 快照中保留；文件数据进入文件服务和知识索引；证据数据进入 RAG 检索结果和可信回答元数据。"),
    h2("画像采集流"),
    p("同学A可以通过问卷、对话、多模态输入和学习行为形成画像。问卷提供稳定结构化字段，对话补充背景和目标，多模态输入通过图片或文件反推学习需求，学习行为通过练习、资源使用和对话主题持续更新画像。"),
    p("画像更新不是覆盖式写入，而是版本化写入。系统保留旧版本、变更字段、触发事件、来源类型和置信度。这样教师A查看学生情况时，可以理解画像变化来源；开发者A排查推荐异常时，也能追踪画像字段变化。"),
    h2("RAG 数据流"),
    p("RAG 流程从查询构造开始。系统综合用户问题、页面上下文、画像摘要、选中文件、当前路径节点和历史对话，形成检索查询。检索范围包括知识库、上传文件、资源库、学习记录和可信资料片段。"),
    p("检索结果进入 ReviewerAgent 进行证据质量判断。系统评估证据数量、相关性、来源、覆盖程度和问题风险，再决定回答风格。高证据问题给出明确解释，复杂问题给出证据边界，涉及不确定内容时提示同学A补充材料。"),
    h2("Agent 记忆层"),
    p("Working Memory 保存当前会话、当前任务和临时上下文。Episodic Memory 保存学习事件、资源使用、对话摘要和练习结果。Semantic Memory 保存长期稳定的目标、偏好、弱点、约束和技能。Perceptual Memory 保存从图片、文件和多模态输入中解析出的信息。"),
    p("记忆更新由事件触发。一次对话结束后，系统抽取新的偏好、目标或约束；一次练习提交后，系统更新知识点掌握度；一次资源生成后，系统记录资源类型和学习意图；一次教师干预后，系统记录干预建议和分发结果。"),
    h2("防幻觉数据流"),
    p("防幻觉系统贯穿检索、生成和审核。生成前，系统注入证据和画像；生成中，模型被约束在证据范围内解释；生成后，ReviewerAgent 输出置信度、证据来源和风险提示。前端将置信度和引用来源展示给同学A，使回答具有可解释性。"),
  ];
}

function profileSections() {
  return [
    ...scheduleSection(),
    h1("画像系统定位"),
    p("个性化画像是 SparkLearn 的核心数据资产。没有画像，学习路径只是通用课程表；没有持续更新，资源生成无法贴合同学A的真实变化。画像系统负责把用户的目标、基础、弱点、偏好、时间约束和学习行为转化为可计算、可追踪、可注入 Agent 上下文的数据结构。"),
    h2("采集方式"),
    p("问卷采集用于快速建立初始画像。系统通过学习目标、当前水平、薄弱点、学习偏好和每日可用时间等问题，形成第一版 profile。对话采集用于补充自由表达信息，例如同学A想做一个项目、准备比赛、希望补某类知识或希望以代码练习为主。"),
    p("多模态采集用于处理随手拍、资料截图、错题图片、代码片段和项目想法。系统通过模型解析输入内容，逆构出学习需求、技能缺口、项目规划和资源建议。行为采集用于长期更新画像，练习正确率、错题类型、资源使用和对话主题都会影响画像字段。"),
    h2("字段设计"),
    p("画像核心字段包括 goal、knowledge_level、weak_points、learning_preference、daily_time、cognitive_style、practical_ability、current_stage、version、source_type、confidence 和 updated_at。goal 可多值，weak_points 可按知识点组织，learning_preference 可包含文档型、实践型、视频型、项目型和对话型等偏好。"),
    p("画像字段需要记录来源。来自问卷的字段 source_type 为 onboarding；来自对话的字段为 dialog；来自多模态逆构的字段为 multimodal_inference；来自练习的字段为 practice_result；来自教师A修正的字段为 teacher_edit。"),
    h2("画像更新规则"),
    p("画像更新采用版本化策略。每次更新生成新版本，并保存字段差异、触发事件和更新时间。系统不会因为一次低置信输入覆盖长期稳定画像，而是结合置信度、重复出现次数、教师确认和学习行为进行合并。"),
    p("例如同学A多次在对话中表达更喜欢代码练习，同时代码案例资源使用频率较高，系统会增强 learning_preference 中的实践型权重。如果同学A在某知识点练习连续错误，系统会把该知识点加入 weak_points 候选，并在路径和资源推荐中体现。"),
    h2("画像应用"),
    p("路径规划读取画像的目标、水平和阶段。资源生成读取弱点、偏好和时间约束。AI 对话读取画像摘要以调整解释深度。教师端读取画像聚合班级差异。学习报告读取画像版本变化，说明同学A的学习状态如何演化。"),
  ];
}

function testSections() {
  return [
    ...scheduleSection(),
    h1("测试目标与范围"),
    p("SparkLearn 测试文档按照 ISO/IEC/IEEE 29119 的思想组织，覆盖单元测试、集成测试、端到端测试、兼容性测试、性能与稳定性检查、部署验证和验收测试。测试对象包括前端页面、后端 SDK 接入、PostgreSQL 数据库、CrewAI 编排、StudyBuddy 工具调用、讯飞星辰 Agent 平台、多模态资源生成、RAG、防幻觉和教师端。"),
    h2("测试策略"),
    p("单元测试验证后端路由、数据模型、工具函数、资源模板和防幻觉判断。集成测试验证前后端字段一致性、SDK 封装、PostgreSQL 读写、文件上传、RAG 检索和 Agent 执行日志。端到端测试模拟同学A从画像采集到报告查看的完整学习闭环。"),
    p("多模态测试重点验证文档、PPT、视频、图片、代码案例和练习题是否能稳定生成、保存、预览和再次打开。教师端测试重点验证班级数据聚合、学生详情、教学干预和资料分发。移动端测试重点验证核心流程在手机屏幕下可用。"),
    h2("核心测试用例"),
    ...[
      "画像建档：同学A提交问卷，系统写入 PostgreSQL，生成画像版本，并能在路径页面读取。",
      "多模态逆构：同学A上传资料或随手拍，系统解析输入，生成学习目标、技能缺口和路径建议。",
      "资源生成：同学A选择知识点生成文档、PPT、视频、图片、代码案例和练习题，资源进入资源库。",
      "AI 对话：同学A上传文件并提问，系统返回多模态回答、RAG 证据、置信度和记忆更新事件。",
      "教师干预：教师A查看班级薄弱点，选择同学A分发资料，系统记录分发结果。",
      "部署验证：管理员A配置 PostgreSQL 和 SDK 凭据后，前后端、StudyBuddy 和外部平台调用正常。",
    ].map(numbered),
    h2("验收标准"),
    p("验收标准包括功能完整、数据落库正确、资源可预览、对话可追踪、Agent 日志完整、错误可解释、移动端核心流程可用、部署步骤可复现和文档描述与系统能力一致。"),
  ];
}

function deploySections() {
  return [
    ...scheduleSection(),
    h1("部署目标"),
    p("部署文档面向管理员A和运维人员A，目标是保证 SparkLearn 可以在本地演示环境、测试环境和生产推荐环境中稳定运行。系统部署对象包括前端 Next.js 应用、后端 Python 服务、PostgreSQL / PolarDB PostgreSQL、StudyBuddy 执行环境、文件存储目录和外部 SDK 配置。"),
    h2("环境要求"),
    p("后端建议使用 Python 3.12 及以上，前端建议使用 Node.js 20 LTS 及以上。数据库使用 PostgreSQL，生产推荐 PolarDB PostgreSQL。服务器需要具备文件上传和资源生成目录的读写权限。浏览器自动化、文件解析和多模态资源生成依赖应在部署前完成检查。"),
    h2("配置项"),
    p("数据库配置包括 host、port、database、user、password、sslmode、pool_size 和 timeout。讯飞星火配置包括 app_id、api_key、api_secret、model 和 endpoint。讯飞 TTS 配置包括 app_id、api_key、api_secret、voice、timeout 和 concurrency。讯飞智文 PPT 配置包括 app_id、api_secret、author 和 timeout。讯飞星辰 Agent 平台配置包括 base_url、token、agent_id 和任务参数。"),
    p("所有配置通过环境变量或部署平台注入。文档不记录真实密钥，版本库不提交密钥文件。管理员A部署时应先复制配置模板，再填入正式环境参数。"),
    h2("启动顺序"),
    ...[
      "初始化 PostgreSQL 数据库，执行迁移脚本，确认表结构和索引存在。",
      "安装后端依赖，检查 Python 环境、文件目录、SDK 配置和数据库连接。",
      "启动后端服务，访问健康检查接口，确认数据库和 SDK 基础连通性。",
      "安装前端依赖，配置后端地址，执行构建或开发启动。",
      "启动 StudyBuddy 执行环境，确认工具权限、工作区路径和任务日志目录。",
      "进入系统完成画像、资源生成、AI 对话和教师端大屏的部署验收。",
    ].map(numbered),
    h2("故障排查"),
    p("数据库连接失败时检查网络、安全组、用户名、密码、数据库名、SSL 设置和连接池参数。SDK 调用失败时检查密钥、模型名称、额度、接口地址、签名参数和超时。资源生成失败时检查模板、文件目录、任务日志和外部平台返回结果。前端页面异常时检查接口地址、浏览器控制台、流式事件格式和跨域配置。"),
  ];
}

function manualSections() {
  return [
    ...scheduleSection(),
    h1("使用手册概述"),
    p("本手册面向同学A、教师A、管理员A和评审专家A，说明 SparkLearn 的主要使用路径。平台核心体验是“画像构建 -> 路径规划 -> 资源生成 -> AI 辅导 -> 练习评测 -> 学习报告 -> 画像更新”的闭环。"),
    h1("学生端操作说明"),
    h2("建立画像"),
    p("同学A首次进入系统后，先完成画像采集。系统通过问卷了解学习目标、基础水平、薄弱点、学习偏好和可用时间。同学A也可以通过对话补充背景，或上传资料、截图、随手拍内容，由系统逆构学习需求和规划。"),
    h2("查看学习路径"),
    p("画像完成后，同学A进入学习路径页面。页面展示当前阶段、知识点节点、推荐资源和练习入口。同学A可以查看每个节点的学习目标、预计学习方式、关联资源和掌握状态。"),
    h2("生成多模态资源"),
    p("同学A可以选择知识点和资源类型，生成文档、PPT、视频、图片、代码案例、练习题和拓展阅读。生成完成后，资源进入资源库，支持预览、再次打开和在 AI 对话中引用。"),
    h2("使用 AI 对话"),
    p("同学A可以在任意页面打开 AI 对话。AI 能结合当前页面、画像、文件、资源和知识库进行回答。对话支持文本、图片、文件和资源卡片，回答中展示证据来源和可信度提示。"),
    h2("完成练习与查看报告"),
    p("同学A完成练习后，系统返回判题结果、解析、错题记录和掌握度变化。学习报告汇总学习趋势、薄弱点、资源使用和后续建议。画像会根据学习行为持续更新。"),
    h1("教师端操作说明"),
    p("教师A进入教师端后查看班级总览，包括学习活跃度、薄弱点分布、资源使用情况和学生风险提示。教师A可以进入同学A详情页，查看画像、路径、练习和报告，并进行资料分发或教学干预。"),
    h1("管理员操作说明"),
    p("管理员A负责配置 PostgreSQL、SDK 凭据、文件目录、StudyBuddy 工作区和部署环境。管理员A也负责查看日志、处理错误、备份数据和维护系统运行状态。"),
  ];
}

function collaborationSections() {
  return [
    ...scheduleSection(),
    h1("协作目标"),
    p("开发协作指导文档用于规范 SparkLearn 项目在需求、设计、开发、测试、部署和文档交付中的协作方式。项目周期为 2026 年 4 月 9 日至 2026 年 6 月 20 日，协作目标是保证功能可演示、代码可维护、数据可追踪、文档可交付。"),
    h2("角色分工"),
    p("产品负责人A负责需求边界、用户流程、赛题对齐和答辩材料。前端开发者A负责页面、组件、移动端、多模态渲染和交互体验。后端开发者A负责 SDK 接入、接口、数据库、文件服务和资源生成。算法开发者A负责 CrewAI、StudyBuddy、讯飞星辰 Agent 平台、RAG、记忆层和防幻觉。测试人员A负责测试计划、测试用例、回归验证和验收记录。"),
    h2("联调规范"),
    p("前后端联调前必须确认请求字段、响应字段、流式事件类型、错误码和数据落库位置。Agent 联调必须保留 task_id、执行步骤、工具调用和输出摘要。多模态资源联调必须验证生成、保存、预览、再次打开和与学习路径关联。"),
    h2("文档规范"),
    p("所有正式交付文档必须使用统一术语，不出现真实人名，不出现被替换的旧技术名称。设计变更需要同步更新对应文档，避免代码能力和材料描述不一致。文档应说明模块背景、系统位置、详细设计、数据结构、流程、异常处理和质量约束。"),
    h2("质量门禁"),
    p("提交前需要完成本地构建、关键接口测试、核心流程检查和文档术语扫描。涉及数据库、SDK、Agent、资源生成和文件上传的修改必须补充测试说明。涉及用户体验的修改必须检查桌面端和移动端显示效果。"),
  ];
}

function docGuideSections() {
  return [
    ...scheduleSection(),
    h1("文档集定位"),
    p("SparkLearn 正式交付文档集用于支撑项目答辩、软件验收、后续维护和团队交接。文档集以软件工程规范为主线，将产品体验、技术架构、前后端实现、智能体协作、数据库设计、数据流转、测试部署和用户使用纳入统一目录。"),
    h2("目录规范"),
    ...[
      "00-文档编制说明：保存文档集规范、命名规则、状态口径和规范依据。",
      "01-总体设计类：保存 UIUX 设计说明与系统视觉风格设计。",
      "02-前后端技术设计类：保存前端技术设计和后端 SDK 接入与接口设计。",
      "03-智能体与数据架构类：保存多智能体协作、混合架构与数据库、数据流转与记忆层、个性化画像采集。",
      "04-测试部署运维类：保存测试文档和部署文档。",
      "05-用户使用与协作类：保存项目使用手册和开发协作指导文档。",
    ].map(bullet),
    h2("术语规范"),
    p("全文统一使用 StudyBuddy 指代改造后的本地学习伙伴内核，使用 CrewAI + StudyBuddy + 讯飞星辰 Agent 平台描述多智能体架构，使用 PostgreSQL / PolarDB PostgreSQL 描述数据库方案。文档不出现被替换的旧技术名称，不出现真实人名。"),
    h2("格式规范"),
    p("所有文档均为 Word docx 格式，使用 A4 页面、标准页边距、页眉页脚、标题样式、自动目录、修订记录和术语表。正文以连续说明为主，表格只用于辅助表达字段、流程、角色和配置项。"),
  ];
}

const specs = [
  {
    folder: "00-文档编制说明",
    filename: "SparkLearn-软件工程文档编制说明.docx",
    title: "软件工程文档编制说明",
    audience: "项目负责人A、开发者A、测试人员A、评审专家A",
    standard: commonStandards,
    purpose: "说明 SparkLearn 正式交付文档集的目录结构、编写规则、术语口径、格式要求和软件工程规范依据。",
    scope: "适用于 SparkLearn 项目全部正式交付文档的编写、维护、校验和归档。",
    sections: docGuideSections(),
  },
  {
    folder: "01-总体设计类",
    filename: "SparkLearn-UIUX设计说明与系统视觉风格设计.docx",
    title: "UIUX 设计说明与系统视觉风格设计",
    audience: "产品负责人A、设计师A、前端开发者A、评审专家A",
    standard: "GB/T 8567-2006 设计说明、用户手册编制要求；IEEE 1016 软件设计说明；可用性与一致性设计原则。",
    purpose: "说明 SparkLearn 的界面体验、视觉体系、页面结构、组件规范、移动端适配和用户操作闭环。",
    scope: "适用于学生端、教师端、移动端、多模态资源页面、AI 对话页面和系统视觉风格。",
    sections: uiuxSections(),
  },
  {
    folder: "02-前后端技术设计类",
    filename: "SparkLearn-前端技术设计文档.docx",
    title: "前端技术设计文档",
    audience: "前端开发者A、测试人员A、产品负责人A、评审专家A",
    standard: "IEEE 1016 软件设计说明；GB/T 8567-2006 概要设计说明和详细设计说明。",
    purpose: "说明 SparkLearn 前端架构、路由、状态管理、多模态资源渲染、视频展示、AI 对话和移动端实现方案。",
    scope: "适用于 SparkLearn Web 前端、学生端、教师端、AI 对话、多模态资源和移动端适配。",
    sections: frontendSections(),
  },
  {
    folder: "02-前后端技术设计类",
    filename: "SparkLearn-后端SDK接入与接口设计文档.docx",
    title: "后端 SDK 接入与接口设计文档",
    audience: "后端开发者A、架构师A、测试人员A、运维人员A",
    standard: "GB/T 8567-2006 接口需求说明、概要设计说明和详细设计说明；ISO/IEC/IEEE 12207。",
    purpose: "说明 SparkLearn 后端作为 SDK 接入平台、智能体编排入口、业务接口服务和数据中枢的设计。",
    scope: "适用于后端服务、SDK 接入、业务接口、外部平台调用、PostgreSQL 和 Agent 任务。",
    sections: backendSections(),
  },
  {
    folder: "03-智能体与数据架构类",
    filename: "SparkLearn-CrewAI-StudyBuddy-讯飞星辰Agent平台多智能体协作设计文档.docx",
    title: "CrewAI + StudyBuddy + 讯飞星辰 Agent 平台多智能体协作设计文档",
    audience: "架构师A、算法开发者A、后端开发者A、评审专家A",
    standard: "IEEE 1016 软件设计说明；ISO/IEC/IEEE 15289 生命周期信息项。",
    purpose: "说明 SparkLearn 多智能体角色体系、协作流程、工具调用、记忆读取、资源生成和可信输出控制。",
    scope: "适用于 CrewAI、StudyBuddy、讯飞星辰 Agent 平台和 SparkLearn 多智能体业务链路。",
    sections: multiAgentSections(),
  },
  {
    folder: "03-智能体与数据架构类",
    filename: "SparkLearn-CrewAI-StudyBuddy-星辰Agent混合架构与PostgreSQL数据库设计文档.docx",
    title: "CrewAI + StudyBuddy + 星辰 Agent 混合架构与 PostgreSQL 数据库设计文档",
    audience: "架构师A、数据库开发者A、后端开发者A、运维人员A",
    standard: "GB/T 8567-2006 数据要求说明和概要设计说明；ISO/IEC/IEEE 12207。",
    purpose: "说明 SparkLearn 的混合智能体架构、PostgreSQL 主库、JSON/JSONL 辅助层、用户画像表单和资源沉淀模型。",
    scope: "适用于数据库设计、数据迁移、画像模型、资源模型、事件日志和 Agent 数据持久化。",
    sections: databaseSections(),
  },
  {
    folder: "03-智能体与数据架构类",
    filename: "SparkLearn-数据流转与Agent记忆层设计文档.docx",
    title: "数据流转与 Agent 记忆层设计文档",
    audience: "架构师A、后端开发者A、算法开发者A、测试人员A",
    standard: "GB/T 8567-2006 详细设计说明；ISO/IEC/IEEE 15289 生命周期信息项。",
    purpose: "说明 SparkLearn 用户输入、画像、资源、RAG、Agent 记忆、防幻觉和学习报告之间的数据流转机制。",
    scope: "适用于学习闭环数据、Agent 记忆、RAG 证据、多模态输入、事件日志和 PostgreSQL 持久化。",
    sections: dataMemorySections(),
  },
  {
    folder: "03-智能体与数据架构类",
    filename: "SparkLearn-个性化画像采集文档.docx",
    title: "个性化画像采集文档",
    audience: "产品负责人A、后端开发者A、算法开发者A、评审专家A",
    standard: "GB/T 8567-2006 数据要求说明；ISO/IEC/IEEE 15289 生命周期信息项。",
    purpose: "说明 SparkLearn 如何通过问卷、对话、多模态输入和学习行为持续采集并更新个性化画像。",
    scope: "适用于用户画像、表单采集、画像逆构、行为采集、画像版本和 Agent 上下文注入。",
    sections: profileSections(),
  },
  {
    folder: "04-测试部署运维类",
    filename: "SparkLearn-测试文档.docx",
    title: "测试文档",
    audience: "测试人员A、开发者A、运维人员A、评审专家A",
    standard: "ISO/IEC/IEEE 29119 软件测试文档；GB/T 8567-2006 测试计划和测试分析报告。",
    purpose: "说明 SparkLearn 的测试范围、测试策略、测试用例、验收标准和质量结论。",
    scope: "适用于前端、后端、PostgreSQL、SDK、Agent、多模态资源、RAG、防幻觉、部署和移动端。",
    sections: testSections(),
  },
  {
    folder: "04-测试部署运维类",
    filename: "SparkLearn-部署文档.docx",
    title: "部署文档",
    audience: "管理员A、运维人员A、后端开发者A、前端开发者A",
    standard: "GB/T 8567-2006 安装计划和操作手册；ISO/IEC/IEEE 12207 运维过程。",
    purpose: "说明 SparkLearn 的环境准备、PostgreSQL 配置、SDK 配置、服务启动、部署验收和故障排查。",
    scope: "适用于本地演示环境、测试环境、生产推荐环境、后端、前端、StudyBuddy 和外部平台接入。",
    sections: deploySections(),
  },
  {
    folder: "05-用户使用与协作类",
    filename: "SparkLearn-项目使用手册.docx",
    title: "项目使用手册",
    audience: "同学A、教师A、管理员A、评审专家A",
    standard: "GB/T 8567-2006 用户手册和操作手册。",
    purpose: "面向使用者说明 SparkLearn 的学生端、教师端、管理员端和评审演示路径。",
    scope: "适用于画像采集、路径学习、资源生成、AI 对话、练习报告、教师端和部署后使用。",
    sections: manualSections(),
  },
  {
    folder: "05-用户使用与协作类",
    filename: "SparkLearn-开发协作指导文档.docx",
    title: "开发协作指导文档",
    audience: "开发者A、测试人员A、产品负责人A、管理员A",
    standard: "GB/T 8567-2006 软件开发计划和维护手册；ISO/IEC/IEEE 12207。",
    purpose: "说明 SparkLearn 项目开发协作、分工、联调、质量门禁和文档维护规则。",
    scope: "适用于需求、设计、开发、联调、测试、部署、文档和交付全过程。",
    sections: collaborationSections(),
  },
];

async function save(spec) {
  const dir = path.join(OUT, spec.folder);
  fs.mkdirSync(dir, { recursive: true });
  const doc = makeDoc(spec);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(dir, spec.filename), buffer);
}

async function main() {
  for (const spec of specs) {
    await save(spec);
  }
  console.log(`Generated ${specs.length} detailed DOCX files under ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
