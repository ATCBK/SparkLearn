const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const outDir = "D:/Project_building/SparkLearn/output/ppt-core-showcase-images";
fs.mkdirSync(outDir, { recursive: true });

const W = 2000;
const H = 1125;

const featureTabs = ["产品闭环", "画像回流", "路径图谱", "资源中心", "Tutor平台", "外部采集", "教学治理", "移动IM"];
const innovationTabs = ["数据闭环", "Agent OS", "资源沉淀", "国产防幻觉"];

const slides = [
  {
    no: 19,
    type: "feature",
    active: 0,
    icon: "↻",
    title: "核心功能展示：产品核心闭环",
    subtitle: "画像采集 → 路径规划 → 资源生成 → 智能辅导 → 练习评测 → 学习报告 → 画像回流",
    mainLabel: "学习闭环总览图占位",
    smallLabels: ["产品流程截图占位", "画像回流截图占位"],
    rightTitle: "闭环组成",
    rightItems: ["画像采集", "路径规划", "资源生成", "智能辅导", "练习评测", "学习报告", "画像回流"],
    functionTitle: "实现功能",
    functionItems: ["持续建档", "动态路径", "资源沉淀", "报告反馈", "策略优化", "下一轮推荐"],
    bottom: ["建档采集", "路径规划", "资源生成", "智能辅导", "练习评测", "报告回流"],
  },
  {
    no: 20,
    type: "feature",
    active: 1,
    icon: "◉",
    title: "核心功能展示：学习画像与画像回流",
    subtitle: "从新手建档到行为回流，让画像成为持续更新的个性化底座",
    mainLabel: "学习画像 / 用户建档界面截图占位",
    smallLabels: ["练习记录截图占位", "学习报告截图占位"],
    rightTitle: "核心链路",
    rightItems: ["新手建档采集基础信息", "学习行为进入记忆系统", "练习结果更新薄弱点", "报告反馈反哺路径规划"],
    functionTitle: "实现功能",
    functionItems: ["学习画像", "记忆系统", "练习记录", "学习报告", "画像回流"],
    bottom: ["建档采集", "行为记录", "画像更新", "路径调整", "推荐优化"],
  },
  {
    no: 21,
    type: "feature",
    active: 2,
    icon: "⌁",
    title: "核心功能展示：个性化路径与知识图谱",
    subtitle: "把学习目标拆解为阶段任务，并用知识图谱展示知识结构和掌握状态",
    mainLabel: "个性化路径总览截图占位",
    smallLabels: ["知识图谱截图占位", "任务节点截图占位"],
    rightTitle: "核心链路",
    rightItems: ["依据画像生成阶段目标", "拆分任务节点与学习顺序", "图谱展示知识点关系", "练习反馈触发路径调整"],
    functionTitle: "实现功能",
    functionItems: ["路径总览", "视图切换", "任务节点", "知识图谱", "掌握状态", "动态调整"],
    bottom: ["画像输入", "目标拆解", "任务编排", "图谱定位", "进度追踪", "路径更新"],
  },
  {
    no: 22,
    type: "feature",
    active: 3,
    icon: "◇",
    title: "核心功能展示：全模态资源生成与资源中心",
    subtitle: "围绕当前学习节点生成多形态资源，并沉淀为可复用学习资产",
    mainLabel: "资源生成工作台截图占位",
    smallLabels: ["资源中心截图占位", "视频 / PPT 资源截图占位"],
    rightTitle: "资源类型",
    rightItems: ["文本讲解 / 学习文档", "PPT / 题目 / 思维导图", "教学视频 / 播客 / 数字人", "代码案例 / 网页资料解析"],
    functionTitle: "实现功能",
    functionItems: ["预览下载", "笔记记录", "AI讲解", "资源导入", "代码运行", "数据回流"],
    bottom: ["输入需求", "多模态生成", "进入资源中心", "在线学习", "二次讲解", "画像回流"],
  },
  {
    no: 23,
    type: "feature",
    active: 4,
    icon: "⚙",
    title: "核心功能展示：Tutor、多智能体机制与平台扩展能力",
    subtitle: "规划、生成、辅导、检索、评测多 Agent 分工协作，支持 Skills / MCP / 浏览器控制扩展",
    mainLabel: "Tutor 对话与 Agent OS 截图占位",
    smallLabels: ["AG-UI 过程截图占位", "MCP / Skills 商店截图占位"],
    rightTitle: "场景组成",
    rightItems: ["学习规划 Agent", "资源生成 Agent", "辅导问答 Agent", "检索增强 Agent", "评测分析 Agent", "反馈分析 Agent"],
    functionTitle: "扩展能力",
    functionItems: ["Skills商店", "MCP插件", "文件管理", "知识库", "浏览器控制", "本地工具"],
    bottom: ["用户任务", "意图识别", "Agent分工", "工具调用", "过程展示", "输出反馈"],
  },
  {
    no: 24,
    type: "feature",
    active: 5,
    icon: "⌘",
    title: "核心功能展示：浏览器插件、外部采集与浏览器控制",
    subtitle: "将外部网页资料采集、解析、沉淀，并通过本地浏览器能力扩展学习环境",
    mainLabel: "浏览器插件采集界面截图占位",
    smallLabels: ["网页资料解析截图占位", "浏览器控制过程截图占位"],
    rightTitle: "采集链路",
    rightItems: ["网页正文抓取", "结构化摘要生成", "关键知识点解析", "导入资源中心", "进入 Tutor 上下文"],
    functionTitle: "控制能力",
    functionItems: ["打开网页", "读取页面", "资料处理", "本地MCP", "任务辅助", "结果沉淀"],
    bottom: ["外部网页", "插件采集", "AI解析", "资源沉淀", "Tutor讲解", "学习回流"],
  },
  {
    no: 25,
    type: "feature",
    active: 6,
    icon: "▣",
    title: "核心功能展示：教师端、管理员端、学习社区与教学大屏",
    subtitle: "教师看见学情并精准干预，管理员治理内容与权限，社区促进学习经验流动",
    mainLabel: "教学大屏 / 教师数据看板截图占位",
    smallLabels: ["管理员平台总览截图占位", "学习论坛截图占位"],
    rightTitle: "业务组成",
    rightItems: ["教师数据看板与教学大屏", "学生详情与画像查看", "干预中心与通知分发", "平台总览与用户权限", "帖子审核与审计日志", "论坛问答与资源分享"],
    functionTitle: "实现功能",
    functionItems: ["学情展示", "精准干预", "内容治理", "权限管理", "操作审计", "社区协作"],
    bottom: ["学生学习", "学情汇总", "教师干预", "社区流动", "管理审核", "平台治理"],
  },
  {
    no: 26,
    type: "feature",
    active: 7,
    icon: "☷",
    title: "核心功能展示：小程序端、飞书端与 9 个 IM 渠道接入",
    subtitle: "小程序承接移动轻量学习，飞书与 IM 渠道让学习服务进入日常对话场景",
    mainLabel: "小程序 AI 助学 / 刷题界面截图占位",
    smallLabels: ["飞书端对话截图占位", "IM 渠道接入截图占位"],
    rightTitle: "入口组成",
    rightItems: ["小程序 AI 助学", "快捷问题入口", "沉浸式刷题", "学习数据看板", "飞书端对话接入", "9 个 IM 渠道"],
    functionTitle: "实现功能",
    functionItems: ["消息问答", "任务触发", "学习提醒", "资料处理", "记录同步", "移动练习"],
    bottom: ["移动提问", "刷题练习", "飞书对话", "IM触达", "任务提醒", "数据回流"],
  },
  {
    no: 27,
    type: "innovation",
    active: 0,
    icon: "↻",
    title: "创新点一：个性化学习数据闭环",
    subtitle: "画像不是静态档案，而是在学习全过程中持续更新的决策底座",
    blocks: [
      { title: "数据来源", items: ["建档信息", "Tutor 问答", "资源学习", "练习结果", "学习报告"] },
      { title: "处理机制", items: ["记忆沉淀", "画像更新", "薄弱点识别", "偏好修正"] },
      { title: "输出结果", items: ["路径调整", "资源推荐", "辅导策略", "教师分析"] },
    ],
    flow: ["学习行为", "记忆系统", "画像更新", "路径资源优化", "下一轮学习"],
  },
  {
    no: 28,
    type: "innovation",
    active: 1,
    icon: "⚙",
    title: "创新点二：Agent OS 多智能体控制系统",
    subtitle: "让多智能体从“能调用”升级为“可调度、可观察、可控制”",
    blocks: [
      { title: "控制入口", items: ["意图识别", "任务拆解", "上下文加载"] },
      { title: "智能体协同", items: ["规划 Agent", "资源 Agent", "问答 Agent", "检索 Agent", "评测 Agent"] },
      { title: "平台扩展", items: ["MCP 工具", "Skills 商店", "浏览器控制", "文件管理"] },
    ],
    flow: ["用户任务", "Agent OS", "任务分发", "工具调用", "过程可视化", "结果控制"],
  },
  {
    no: 29,
    type: "innovation",
    active: 2,
    icon: "◇",
    title: "创新点三：全模态学习资源生成与沉淀",
    subtitle: "从“生成内容”升级为“沉淀可持续使用的学习资产”",
    blocks: [
      { title: "资源生产", items: ["文档 / PPT", "题目 / 图谱", "视频 / 播客", "数字人 / 代码案例"] },
      { title: "资产管理", items: ["统一资源中心", "预览下载", "笔记记录", "AI 二次讲解"] },
      { title: "学习回流", items: ["学习行为记录", "练习联动", "报告生成", "画像更新"] },
    ],
    flow: ["学习需求", "全模态生成", "资源中心", "持续学习", "数据回流"],
  },
  {
    no: 30,
    type: "innovation",
    active: 3,
    icon: "▣",
    title: "创新点四：国产化 AI 平台闭环与防幻觉机制",
    subtitle: "基于国产 AI 能力构建面向教育场景的可控学习平台",
    blocks: [
      { title: "国产化链路", items: ["讯飞星火", "星辰 Agent", "讯飞智文", "TTS / ASR", "国产云数据库"] },
      { title: "控制机制", items: ["RAG 检索", "上下文工程", "防幻觉控制器", "风险审查"] },
      { title: "落地价值", items: ["自主可控", "过程可视", "输出约束", "教育场景适配"] },
    ],
    flow: ["国产模型", "Agent 编排", "知识检索", "防幻觉控制", "学习闭环"],
  },
  {
    no: 31,
    type: "evidence",
    active: 0,
    icon: "✓",
    title: "材料佐证：从需求调研到实际验证",
    subtitle: "通过问卷调研、用户反馈、效果检验和工程测试验证项目能力",
    blocks: [
      { title: "需求调研", items: ["学生问卷", "教师访谈", "需求统计", "痛点词云"] },
      { title: "功能验证", items: ["核心流程跑通", "学生端验证", "教师端验证", "管理端验证"] },
      { title: "效果检验", items: ["使用前后对比", "资源满意度", "答疑评分", "正确率变化"] },
      { title: "工程验证", items: ["测试用例", "接口测试", "多端运行", "部署验证"] },
    ],
    flow: ["调研", "开发", "验证", "反馈", "迭代"],
  },
  {
    no: 32,
    type: "summary",
    active: 0,
    icon: "★",
    title: "最终总结：全功能、全端口、全闭环",
    subtitle: "SparkLearn 构建多端同源、持续进化的 AI 学习服务平台",
    blocks: [
      { title: "全角色", items: ["学生", "教师", "管理员"] },
      { title: "全端口", items: ["Web", "PC", "小程序", "浏览器插件", "9 个 IM"] },
      { title: "全功能", items: ["画像", "路径", "资源", "Tutor", "练习", "报告", "社区", "治理"] },
      { title: "全技术", items: ["讯飞星火", "星辰 Agent", "RAG", "MCP", "AG-UI", "A2UI", "防幻觉"] },
      { title: "全创新", items: ["数据闭环", "Agent OS", "资源沉淀", "国产化闭环"] },
      { title: "全价值", items: ["个性化学习", "教师干预", "平台治理", "真实落地"] },
    ],
    flow: ["理解学生", "组织学习", "生成资源", "智能辅导", "反馈进化"],
  },
];

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function topTabs(tabs, active) {
  return `<div class="tabs">${tabs.map((t, i) => `<div class="tab ${i === active ? "active" : ""}"><span class="tabIcon">${["◌","♟","◇","☁","▣","⌘","☷","✦"][i] || "●"}</span>${esc(t)}</div>`).join("")}</div>`;
}

function placeholder(label, cls = "") {
  return `<div class="placeholder ${cls}"><div class="imageIcon"></div><div>${esc(label)}</div></div>`;
}

function checklist(title, items) {
  return `<div class="sideSection"><div class="sectionHead">${esc(title)}</div><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
}

function bottomFlow(items) {
  return `<div class="bottomFlow">${items.map((x, i) => `<div class="flowNode"><div class="circle">${i + 1}</div><div class="flowText">${esc(x)}</div></div>${i < items.length - 1 ? '<div class="arrow">→</div>' : ""}`).join("")}</div>`;
}

function featureSlide(s) {
  return `
  <div class="slide">
    ${topTabs(featureTabs, s.active)}
    <div class="headline"><div class="bigIcon">${s.icon}</div><div><h1>${esc(s.title)}</h1><p>${esc(s.subtitle)}</p></div></div>
    <div class="featureGrid">
      <div class="panel mainPanel"><div class="panelLabel">${esc(s.mainLabel)}</div>${placeholder("界面截图占位", "large")}</div>
      <div class="midCol">
        <div class="panel smallPanel"><div class="panelLabel">${esc(s.smallLabels[0])}</div>${placeholder("界面截图占位")}</div>
        <div class="panel smallPanel"><div class="panelLabel">${esc(s.smallLabels[1])}</div>${placeholder("界面截图占位")}</div>
      </div>
      <div class="panel sidePanel">
        ${checklist(s.rightTitle, s.rightItems)}
        ${checklist(s.functionTitle, s.functionItems)}
      </div>
    </div>
    ${bottomFlow(s.bottom)}
  </div>`;
}

function innovationSlide(s) {
  return `
  <div class="slide">
    ${topTabs(innovationTabs, s.active)}
    <div class="headline"><div class="bigIcon">${s.icon}</div><div><h1>${esc(s.title)}</h1><p>${esc(s.subtitle)}</p></div></div>
    <div class="innovationGrid ${s.blocks.length > 4 ? "summaryGrid" : ""}">
      ${s.blocks.map((b, idx) => `<div class="archBlock">
        <div class="archBadge">${idx + 1}</div>
        <h2>${esc(b.title)}</h2>
        <ul>${b.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>`).join("")}
    </div>
    <div class="archFlow">${s.flow.map((x, i) => `<div class="archStep">${esc(x)}</div>${i < s.flow.length - 1 ? '<div class="archArrow">→</div>' : ""}`).join("")}</div>
  </div>`;
}

function slideHtml(s) {
  const body = s.type === "feature" ? featureSlide(s) : innovationSlide(s);
  return `<!doctype html>
  <html>
  <head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #e8eef8; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; }
    .slide {
      width: ${W}px; height: ${H}px; position: relative; overflow: hidden;
      background: linear-gradient(135deg, #ffffff 0%, #f7fbff 46%, #eef7ff 100%);
      border: 4px solid #1260c7; border-radius: 34px;
      box-shadow: inset 0 0 0 3px #d8ebff, 0 10px 30px rgba(31, 97, 180, 0.18);
      padding: 22px 32px 34px;
      color: #082b67;
    }
    .slide:before {
      content: ""; position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(circle at 18% 22%, rgba(41, 132, 232, .12), transparent 28%),
        radial-gradient(circle at 88% 80%, rgba(41, 132, 232, .10), transparent 30%);
    }
    .tabs { height: 112px; display: flex; gap: 0; position: relative; z-index: 1; }
    .tab {
      height: 86px; min-width: 212px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 18px;
      color: #1760bd; font-weight: 800; font-size: 30px;
      background: linear-gradient(180deg, #ffffff, #f4f9ff);
      border: 3px solid #85b7f2; margin-left: -2px; clip-path: polygon(0 0, calc(100% - 42px) 0, 100% 50%, calc(100% - 42px) 100%, 0 100%, 42px 50%);
      padding: 0 48px 0 64px;
    }
    .tab:first-child { border-top-left-radius: 28px; border-bottom-left-radius: 28px; clip-path: polygon(0 0, calc(100% - 42px) 0, 100% 50%, calc(100% - 42px) 100%, 0 100%); }
    .tab:last-child { border-top-right-radius: 28px; border-bottom-right-radius: 28px; }
    .tab.active { color: #fff; background: linear-gradient(135deg, #084db6, #1e85ec); box-shadow: inset 0 -8px 18px rgba(0,0,0,.13); }
    .tabIcon { font-size: 36px; line-height: 1; }
    .headline { position: relative; z-index: 1; display: flex; align-items: center; gap: 28px; margin: 10px 36px 24px; }
    .bigIcon { width: 94px; height: 94px; border-radius: 50%; background: linear-gradient(135deg, #0b58c6, #53a7ff); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 56px; font-weight: 900; box-shadow: 0 8px 18px rgba(20, 89, 190, .24); }
    h1 { margin: 0; font-size: 58px; letter-spacing: 0; color: #072d73; font-weight: 900; }
    .headline p { margin: 12px 0 0; font-size: 27px; color: #42577a; font-weight: 600; }
    .featureGrid { position: relative; z-index: 1; display: grid; grid-template-columns: 1.1fr .78fr .62fr; gap: 24px; padding: 0 20px; }
    .panel { border: 2.6px solid #99c5fa; border-radius: 20px; background: rgba(255,255,255,.66); box-shadow: inset 0 0 35px rgba(43, 130, 234, .08); position: relative; overflow: hidden; }
    .mainPanel { height: 590px; }
    .midCol { display: grid; grid-template-rows: 1fr 1fr; gap: 24px; }
    .smallPanel { height: 283px; }
    .sidePanel { height: 590px; padding: 30px 34px; }
    .panelLabel { position: absolute; top: 0; left: 38px; transform: translateY(-1px); background: linear-gradient(135deg, #0b66d5, #2a98f5); color: #fff; padding: 11px 44px; border-radius: 0 0 10px 10px; font-size: 28px; font-weight: 800; box-shadow: 0 7px 16px rgba(17, 93, 201, .22); z-index: 2; }
    .placeholder { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #1c6aca; font-size: 28px; font-weight: 800; opacity: .88; }
    .placeholder.large { font-size: 34px; }
    .imageIcon { width: 118px; height: 90px; border: 6px solid #1f72d4; border-radius: 12px; margin-bottom: 22px; position: relative; opacity: .9; }
    .imageIcon:before { content: ""; position: absolute; width: 16px; height: 16px; border-radius: 50%; background: #1f72d4; left: 18px; top: 18px; }
    .imageIcon:after { content: ""; position: absolute; left: 18px; right: 14px; bottom: 14px; height: 34px; background: linear-gradient(135deg, transparent 0 25%, #1f72d4 26% 42%, transparent 43% 52%, #1f72d4 53%); clip-path: polygon(0 100%, 30% 34%, 48% 62%, 74% 14%, 100% 100%); }
    .sideSection + .sideSection { border-top: 2px dashed #9dc7f4; margin-top: 22px; padding-top: 22px; }
    .sectionHead { display: inline-flex; align-items: center; gap: 12px; color: #105cc2; font-size: 32px; font-weight: 900; margin-bottom: 14px; }
    .sectionHead:before { content: "✓"; width: 38px; height: 38px; border-radius: 50%; background: #126bd5; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; }
    ul { margin: 0; padding: 0; list-style: none; }
    li { font-size: 27px; line-height: 1.45; color: #193765; margin: 8px 0; display: flex; gap: 12px; }
    li:before { content: "●"; color: #146bd3; font-size: 18px; margin-top: 8px; }
    .bottomFlow { position: absolute; left: 52px; right: 52px; bottom: 34px; height: 112px; border: 2.6px solid #99c5fa; border-radius: 18px; background: rgba(255,255,255,.74); display: flex; align-items: center; justify-content: space-around; padding: 10px 42px; z-index: 1; }
    .flowNode { display: flex; flex-direction: column; align-items: center; min-width: 156px; gap: 6px; }
    .circle { width: 58px; height: 58px; border-radius: 50%; color: #fff; background: linear-gradient(135deg, #0c62ce, #51a4ff); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 25px; box-shadow: 0 8px 12px rgba(18, 93, 198, .22); }
    .flowText { font-size: 24px; font-weight: 800; color: #0b438e; white-space: nowrap; }
    .arrow { font-size: 42px; color: #76a7df; font-weight: 900; margin: 0 -10px; }
    .innovationGrid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; padding: 10px 52px 0; min-height: 610px; }
    .innovationGrid.summaryGrid { grid-template-columns: repeat(3, 1fr); grid-auto-rows: 242px; min-height: 538px; }
    .archBlock { position: relative; border: 2.8px solid #93c2f8; border-radius: 22px; background: rgba(255,255,255,.76); padding: 42px 34px 26px; box-shadow: inset 0 0 38px rgba(45, 132, 236, .08); }
    .archBadge { position: absolute; top: -24px; left: 28px; width: 58px; height: 58px; border-radius: 18px; background: linear-gradient(135deg, #0b5dcc, #52a5ff); color: white; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; box-shadow: 0 8px 18px rgba(18, 93, 198, .22); }
    .archBlock h2 { margin: 0 0 18px; color: #0b4fa7; font-size: 34px; font-weight: 900; }
    .archBlock li { font-size: 28px; margin: 12px 0; }
    .archFlow { position: absolute; left: 64px; right: 64px; bottom: 50px; height: 118px; border: 2.6px solid #99c5fa; border-radius: 20px; background: rgba(255,255,255,.78); display: flex; align-items: center; justify-content: center; gap: 18px; padding: 16px 30px; z-index: 1; }
    .archStep { min-width: 190px; height: 66px; border-radius: 16px; border: 2px solid #9ac6f8; color: #084a9e; background: linear-gradient(180deg,#fff,#f3f9ff); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; padding: 0 22px; }
    .archArrow { font-size: 40px; color: #3488e9; font-weight: 900; }
  </style>
  </head>
  <body>${body}</body>
  </html>`;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const slide of slides) {
    await page.setContent(slideHtml(slide), { waitUntil: "load" });
    const fileName = `${String(slide.no).padStart(2, "0")}-${slide.title.replace(/[：:/\\?%*|"<>]/g, "-")}.png`;
    await page.screenshot({ path: path.join(outDir, fileName), fullPage: false });
  }
  await browser.close();
  console.log(`generated ${slides.length} images in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
