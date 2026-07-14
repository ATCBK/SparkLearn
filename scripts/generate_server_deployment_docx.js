const fs = require("fs");
const path = require("path");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
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

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs");
const ASSET_DIR = path.join(OUT_DIR, "deployment-doc-assets");
const OUT_FILE = path.join(OUT_DIR, "SparkLearn-服务器Docker部署文档.docx");

const PAGE = {
  width: 11906,
  height: 16838,
  margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
};
const CONTENT_WIDTH = PAGE.width - PAGE.margin.left - PAGE.margin.right;

const COLORS = {
  ink: "13233A",
  muted: "58677D",
  blue: "2F6FED",
  lightBlue: "E8F0FF",
  green: "16A673",
  lightGreen: "E8F8F1",
  orange: "E98B2A",
  lightOrange: "FFF2E5",
  line: "C9D5E5",
  gray: "F6F8FB",
  white: "FFFFFF",
};

function text(text, options = {}) {
  return new TextRun({
    text,
    font: "Microsoft YaHei",
    size: options.size || 22,
    bold: Boolean(options.bold),
    color: options.color || COLORS.ink,
  });
}

function p(content, options = {}) {
  return new Paragraph({
    alignment: options.align || AlignmentType.LEFT,
    spacing: { before: options.before || 0, after: options.after ?? 140, line: options.line || 330 },
    children: Array.isArray(content) ? content : [text(content, options)],
  });
}

function h1(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 220 },
    children: [text(title, { size: 32, bold: true, color: COLORS.blue })],
  });
}

function h2(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 160 },
    children: [text(title, { size: 27, bold: true })],
  });
}

function h3(title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 100 },
    children: [text(title, { size: 24, bold: true, color: COLORS.ink })],
  });
}

function note(title, body, tone = "blue") {
  const fill = tone === "green" ? COLORS.lightGreen : tone === "orange" ? COLORS.lightOrange : COLORS.lightBlue;
  const border = tone === "green" ? COLORS.green : tone === "orange" ? COLORS.orange : COLORS.blue;
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: border },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: border },
      left: { style: BorderStyle.SINGLE, size: 8, color: border },
      right: { style: BorderStyle.SINGLE, size: 1, color: border },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: border },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: border },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { fill, type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              p(title, { bold: true, size: 22, after: 80 }),
              p(body, { size: 20, color: COLORS.muted, after: 0 }),
            ],
          }),
        ],
      }),
    ],
  });
}

function image(name, caption) {
  const file = path.join(ASSET_DIR, name);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      children: [
        new ImageRun({
          type: "png",
          data: fs.readFileSync(file),
          transformation: { width: 560, height: 344 },
          altText: { title: caption, description: caption, name },
        }),
      ],
    }),
    p(caption, { align: AlignmentType.CENTER, size: 18, color: COLORS.muted, after: 220 }),
  ];
}

function codeBlock(lines) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { fill: "F3F6FA", type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: lines.map((line) =>
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: line, font: "Consolas", size: 18, color: COLORS.ink })],
              }),
            ),
          }),
        ],
      }),
    ],
  });
}

function cell(content, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
    },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [p(content, { bold: opts.bold, size: opts.size || 19, color: opts.color || COLORS.ink, after: 0 })],
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: headers.map((header, i) => cell(header, widths[i], { bold: true, fill: COLORS.lightBlue, color: COLORS.blue })),
      }),
      ...rows.map((row) =>
        new TableRow({
          children: row.map((value, i) => cell(value, widths[i], { size: 18 })),
        }),
      ),
    ],
  });
}

function bullet(item) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 90, line: 300 },
    children: [text(item, { size: 21 })],
  });
}

function numbered(item) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { after: 90, line: 300 },
    children: [text(item, { size: 21 })],
  });
}

const children = [];

children.push(
  new Paragraph({ spacing: { before: 1600, after: 300 }, alignment: AlignmentType.CENTER, children: [text("SparkLearn", { size: 48, bold: true, color: COLORS.blue })] }),
  new Paragraph({ spacing: { after: 300 }, alignment: AlignmentType.CENTER, children: [text("服务器 Docker 部署文档", { size: 38, bold: true })] }),
  new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.CENTER, children: [text("官网、平台端、后端服务上线部署与更新回滚说明", { size: 22, color: COLORS.muted })] }),
  new Paragraph({ spacing: { before: 500, after: 80 }, alignment: AlignmentType.CENTER, children: [text("适用环境：CentOS 7.x / Docker / Docker Compose / 内网或国内镜像环境", { size: 20 })] }),
  new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.CENTER, children: [text("服务器地址：172.17.6.31", { size: 20 })] }),
  new Paragraph({ spacing: { after: 900 }, alignment: AlignmentType.CENTER, children: [text("生成日期：2026-07-13", { size: 20 })] }),
  note("安全说明", "本文档不会写入任何真实 API Key、Token、服务器密码或云服务密钥。部署时密钥统一放在服务器 .env.deploy 中，并通过文件权限限制访问。", "orange"),
  new Paragraph({ pageBreakBefore: true, children: [] }),
  h1("目录"),
  new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ pageBreakBefore: true, children: [] }),
);

children.push(
  h1("1. 文档说明"),
  h2("1.1 文档目的"),
  p("本文档用于说明 SparkLearn 项目在服务器环境中的完整部署流程。文档重点覆盖服务器初始化、Docker 环境安装、项目打包上传、容器构建启动、演示数据同步、部署验证、版本更新和异常回滚。"),
  p("本文档面向项目开发者、运维人员、答辩材料整理人员和后续接手项目的同学。阅读后应能够清楚知道每一步做什么、为什么做、做完后如何确认成功，以及失败后如何恢复。"),
  h2("1.2 适用范围"),
  bullet("适用于 SparkLearn 官网、平台端、后端 API 服务部署到学校服务器或同类 Linux 服务器的场景。"),
  bullet("适用于服务器不能直接稳定访问外网，需要使用国内 yum 源、npm 镜像源、Docker 镜像源的场景。"),
  bullet("适用于先以 SQLite 演示数据上线，后续再迁移 PostgreSQL 或云数据库的阶段。"),
  bullet("不在本文档中展开桌面端 Electron、小程序、浏览器插件的生产发布流程。"),
  h2("1.3 真实部署目标"),
  table(
    ["服务", "部署内容", "端口", "说明"],
    [
      ["官网", "finwise-landing-page / Next.js", "3001", "对外展示项目介绍、入口和宣传页面。"],
      ["平台端", "frontend / Next.js", "3000", "学生端、教师端、管理员端统一平台入口。"],
      ["后端", "backend / FastAPI", "8000", "提供业务接口、AI 调用、SQLite 数据访问和文件服务。"],
      ["数据", "backend/data", "无独立端口", "通过 Docker volume 或目录挂载持久化。"],
    ],
    [1700, 3300, 1200, CONTENT_WIDTH - 6200],
  ),
);

children.push(
  h1("2. 项目部署架构"),
  ...image("01-architecture.png", "图 1：SparkLearn 服务器 Docker 部署架构"),
  h2("2.1 架构说明"),
  p("SparkLearn 的服务器部署采用单机 Docker Compose 编排。服务器上同时运行三个核心容器：后端 FastAPI 容器、平台端 Next.js 容器、官网 Next.js 容器。三个服务共享同一台服务器的网络环境，其中前端页面通过 HTTP 请求访问后端 API。"),
  p("当前部署以演示和准上线环境为目标，数据库采用 SQLite 文件，数据目录挂载到服务器宿主机路径，避免容器重建后数据丢失。后续如果切换为 PostgreSQL，可在保持前后端容器结构不变的情况下替换数据库连接层。"),
  h2("2.2 服务器目录规划"),
  table(
    ["路径", "用途", "维护建议"],
    [
      ["/opt/sparklearn/app", "当前正在运行的项目目录。", "不要手工随意删除，更新前先备份。"],
      ["/opt/sparklearn/releases", "保存每次上传的发布包。", "按时间戳命名，便于回滚。"],
      ["/opt/sparklearn/app/.env.deploy", "服务器专用环境变量文件。", "只保留在服务器，不提交到仓库。"],
      ["/opt/sparklearn/app/data/backend", "后端数据挂载目录。", "数据库同步或替换前必须备份。"],
      ["/opt/sparklearn/backups", "部署和数据备份目录。", "每次更新或数据替换前创建新备份。"],
    ],
    [3100, 3400, CONTENT_WIDTH - 6500],
  ),
);

children.push(
  h1("3. 服务器环境要求"),
  h2("3.1 基础配置"),
  p("真实部署服务器为学校内网服务器，地址为 172.17.6.31。前期探测环境为 CentOS 7.6，服务器资源满足项目演示部署要求。建议生产或长期演示环境至少满足 4 核 CPU、8GB 内存和 400GB 可用磁盘；实际部署中可根据访问量调整。"),
  table(
    ["检查项", "建议值", "检查命令"],
    [
      ["操作系统", "CentOS 7.x 或兼容 Linux 发行版", "cat /etc/os-release"],
      ["CPU", "至少 4 核，建议 8 核", "nproc"],
      ["内存", "至少 8GB，建议 16GB", "free -h"],
      ["磁盘", "至少 100GB 可用，建议 400GB", "df -h"],
      ["网络", "可访问国内镜像源和 AI 服务域名", "curl -I 目标地址"],
    ],
    [2300, 3000, CONTENT_WIDTH - 5300],
  ),
  h2("3.2 端口要求"),
  p("服务器需要开放 3000、3001、8000 三个 TCP 端口。3000 用于平台端访问，3001 用于官网访问，8000 用于后端 API 健康检查和前端接口调用。"),
  codeBlock([
    "firewall-cmd --permanent --add-port=3000/tcp",
    "firewall-cmd --permanent --add-port=3001/tcp",
    "firewall-cmd --permanent --add-port=8000/tcp",
    "firewall-cmd --reload",
  ]),
  h2("3.3 国内镜像要求"),
  p("学校服务器或内网服务器经常存在外网访问不稳定的问题。部署时应优先配置国内 yum 源、npm registry 和 Docker registry mirrors。这样可以降低依赖安装失败和镜像拉取超时的概率。"),
);

children.push(
  h1("4. 部署文件与项目路径"),
  h2("4.1 本地项目路径"),
  p("本地项目根目录为 D:\\Project_building\\SparkLearn。部署文档中的相对路径均以该目录为基准。"),
  table(
    ["本地路径", "说明"],
    [
      ["frontend/", "Next.js 平台端，包含学生端、教师端、管理员端。"],
      ["finwise-landing-page/", "Next.js 官网页面。"],
      ["backend/", "FastAPI 后端服务，包含 API 路由、数据库初始化、AI 服务适配。"],
      ["backend/data/db/sparklearn.db", "SQLite 数据库文件，当前演示数据主要保存在这里。"],
      ["backend/data/users/single_user", "单用户模式下的用户文件、资源、历史记录等。"],
      ["docs/", "部署文档、交付材料、部署记录建议保存位置。"],
    ],
    [3600, CONTENT_WIDTH - 3600],
  ),
  h2("4.2 当前部署文件状态说明"),
  note("当前工作区提示", "本次生成文档时，在当前工作区未检索到 docker-compose.deploy.yml、Dockerfile.backend、Dockerfile.frontend、Dockerfile.landing 等部署文件。此前服务器部署过程中曾使用这些文件完成容器化部署。若当前仓库已被清理，需要先从历史版本、备份或部署服务器中恢复这些文件，再执行下一次上线更新。", "orange"),
  p("标准部署文件建议包括：后端 Dockerfile、平台端 Dockerfile、官网 Dockerfile、docker-compose.deploy.yml、.dockerignore，以及服务器专用 .env.deploy。部署文件应进入版本管理，但 .env.deploy 不应提交。"),
);

children.push(
  h1("5. 首次部署流程"),
  ...image("02-deployment-flow.png", "图 2：首次部署流程"),
  h2("5.1 SSH 登录服务器"),
  p("部署操作通过 SSH 登录服务器完成。登录后建议先确认当前用户、系统版本和工作目录，避免误操作其他服务器。"),
  codeBlock([
    "ssh root@172.17.6.31",
    "whoami",
    "hostname",
    "cat /etc/os-release",
  ]),
  h2("5.2 环境探测"),
  p("环境探测的目的是确认服务器是否满足部署要求。建议保存探测输出，作为部署文档和问题排查依据。"),
  codeBlock([
    "nproc",
    "free -h",
    "df -h",
    "ip addr",
    "curl -I https://registry.npmmirror.com",
    "curl -I https://docker.m.daocloud.io",
  ]),
  h2("5.3 yum 源修复"),
  p("CentOS 7 默认源可能已停止维护或访问失败。实际部署中曾通过备份原 repo 文件，并写入 CentOS 7.9 vault 国内源来恢复 yum makecache 能力。"),
  codeBlock([
    "mkdir -p /etc/yum.repos.d/bak-$(date +%Y%m%d-%H%M%S)",
    "mv /etc/yum.repos.d/*.repo /etc/yum.repos.d/bak-时间戳/",
    "vi /etc/yum.repos.d/CentOS-Vault-7.9.2009.repo",
    "yum clean all",
    "yum makecache",
  ]),
  h2("5.4 Docker 与 Compose 安装"),
  p("安装 Docker 后需要启动服务并设置开机自启。Docker Compose 建议使用 v2 插件形式，部署命令统一使用 docker compose。"),
  codeBlock([
    "yum install -y yum-utils device-mapper-persistent-data lvm2",
    "yum install -y docker-ce docker-ce-cli containerd.io",
    "systemctl enable docker",
    "systemctl start docker",
    "docker version",
    "docker compose version",
  ]),
  h2("5.5 Docker 国内镜像源"),
  p("真实部署中曾因基础镜像拉取超时导致构建失败。解决方式是在 /etc/docker/daemon.json 中配置国内 registry mirrors，然后重启 Docker。"),
  codeBlock([
    "cat > /etc/docker/daemon.json <<'EOF'",
    "{",
    "  \"registry-mirrors\": [",
    "    \"https://docker.m.daocloud.io\",",
    "    \"https://docker.1ms.run\"",
    "  ]",
    "}",
    "EOF",
    "systemctl daemon-reload",
    "systemctl restart docker",
    "docker run --rm hello-world",
  ]),
);

children.push(
  h1("6. 项目上传与容器启动"),
  h2("6.1 本地打包原则"),
  p("发布包从 Windows 本地项目生成。打包时应排除 node_modules、.git、.next、Python 缓存、临时目录、大型测试产物和敏感配置文件。发布包只包含源码、部署文件、必要的静态资源和经过确认的数据文件。"),
  codeBlock([
    "tar -czf temp/sparklearn-deploy-时间戳.tar.gz \\",
    "  --exclude=.git \\",
    "  --exclude=node_modules \\",
    "  --exclude=frontend/.next \\",
    "  --exclude=finwise-landing-page/.next \\",
    "  --exclude=temp \\",
    "  .",
  ]),
  h2("6.2 上传与解压"),
  p("发布包上传到服务器 releases 目录。不要直接覆盖当前 app 目录，先解压到 app-new，确认配置和文件完整后再切换。"),
  codeBlock([
    "scp temp/sparklearn-deploy-时间戳.tar.gz root@172.17.6.31:/opt/sparklearn/releases/",
    "ssh root@172.17.6.31",
    "mkdir -p /opt/sparklearn/app-new",
    "tar -xzf /opt/sparklearn/releases/sparklearn-deploy-时间戳.tar.gz -C /opt/sparklearn/app-new",
  ]),
  h2("6.3 环境变量配置"),
  p("服务器环境变量文件统一命名为 .env.deploy，放在 /opt/sparklearn/app/.env.deploy。该文件包含真实 AI 服务配置、后端配置、CORS 配置等敏感信息。部署文档只说明字段用途，不写真实值。"),
  table(
    ["配置项", "用途", "注意事项"],
    [
      ["APP_NAME / APP_VERSION", "应用标识和版本。", "可用于健康检查和日志识别。"],
      ["CORS_ORIGINS", "允许前端访问后端的来源。", "应包含平台端和官网地址。"],
      ["DB_PATH / DATA_DIR", "SQLite 数据库与数据目录。", "容器内路径需与挂载目录一致。"],
      ["SPARK / COZE / TTS / EMBEDDING", "国内 AI 服务配置。", "只写入服务器 .env.deploy，不进入文档。"],
      ["USE_MOCK_DATA", "真实服务不可用时是否使用兜底数据。", "演示环境可保留切换能力。"],
    ],
    [2500, 3100, CONTENT_WIDTH - 5600],
  ),
  h2("6.4 启动服务"),
  p("配置完成后进入 /opt/sparklearn/app，使用 Docker Compose 构建并后台启动服务。"),
  codeBlock([
    "cd /opt/sparklearn/app",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d --build",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy ps",
  ]),
);

children.push(
  h1("7. 演示数据同步"),
  ...image("05-data-flow.png", "图 3：演示数据同步流程"),
  h2("7.1 数据同步目标"),
  p("演示环境不能只部署空页面，还需要同步适合展示的数据。当前项目使用 SQLite 文件 backend/data/db/sparklearn.db 保存主要业务数据，用户文件和生成资源位于 backend/data/users/single_user 与 backend/data/artifacts。"),
  p("数据同步的核心原则是：先清理本地测试数据，再生成稳定演示数据，最后上传服务器替换。替换前必须备份服务器原数据，替换后必须验证页面和接口。"),
  h2("7.2 论坛数据维护示例"),
  p("本次项目已将论坛旧测试数据清理，并重新写入四个板块的真实演示内容：资料共享、学习答疑、组队共学、经验共享。每个板块 12 条，另有自然评论、点赞、收藏和浏览历史，用于保证页面展示不空、不乱、不像测试环境。"),
  table(
    ["板块", "标签", "当前演示数量", "说明"],
    [
      ["资料共享", "resource_share", "12", "课件、笔记、模板、资料包等内容。"],
      ["学习答疑", "qa", "12", "具体学习问题、概念疑问、方法求助。"],
      ["组队共学", "team_study", "12", "打卡、刷题、答辩互评等组队内容。"],
      ["经验共享", "experience_share", "12", "复盘方法、项目经验、备考策略。"],
    ],
    [2000, 2200, 1800, CONTENT_WIDTH - 6000],
  ),
  h2("7.3 数据上传与替换"),
  codeBlock([
    "cd /opt/sparklearn/app",
    "mkdir -p /opt/sparklearn/backups/data-$(date +%Y%m%d-%H%M%S)",
    "cp -a data /opt/sparklearn/backups/data-时间戳/",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy down",
    "scp backend/data/db/sparklearn.db root@172.17.6.31:/opt/sparklearn/app/data/backend/db/sparklearn.db",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d",
  ]),
  note("数据替换提醒", "如果容器内路径与宿主机挂载路径不同，应先通过 docker compose 配置确认实际 volume 映射。不要在未确认挂载路径的情况下直接覆盖数据库。", "orange"),
);

children.push(
  h1("8. 部署验证"),
  h2("8.1 基础健康检查"),
  p("部署完成后先验证容器是否运行，再验证后端健康检查、平台端和官网是否可访问。"),
  codeBlock([
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy ps",
    "curl http://127.0.0.1:8000/health",
    "curl -I http://127.0.0.1:3000",
    "curl -I http://127.0.0.1:3001",
  ]),
  h2("8.2 业务接口验证"),
  p("后端不仅要健康检查通过，还应验证关键业务接口能够读取数据库并返回正确结构。当前论坛板块统计接口可用于验证演示数据是否同步成功。"),
  codeBlock([
    "curl http://127.0.0.1:8000/api/forum/board-stats",
    "curl http://127.0.0.1:8000/api/dashboard/stats",
  ]),
  h2("8.3 AI 网络验证"),
  p("由于 SparkLearn 使用国内 AI 服务，部署后应在后端容器内验证服务域名可达。返回 401、403 或 404 不一定代表失败；在未携带鉴权时出现这些状态，通常说明网络链路已打通。真正需要警惕的是 DNS 失败、连接超时或 TLS 握手失败。"),
  codeBlock([
    "docker exec -it sparklearn-backend sh",
    "curl -I https://api.deepseek.com/",
    "curl -I https://spark-api.xf-yun.com/",
    "curl -I https://api.coze.cn/",
    "curl -I https://dashscope.aliyuncs.com/",
  ]),
);

children.push(
  h1("9. 更新发布流程"),
  ...image("03-update-flow.png", "图 4：版本更新发布流程"),
  h2("9.1 更新前检查"),
  p("每次修改代码或数据后，不应直接在服务器上手改运行目录。推荐流程是在本地完成修改与验证，然后重新生成发布包上传服务器。"),
  codeBlock([
    "cd D:\\Project_building\\SparkLearn\\frontend",
    "npm run lint",
    "cd D:\\Project_building\\SparkLearn",
    "python -m compileall backend\\app",
  ]),
  h2("9.2 服务器更新步骤"),
  numbered("上传新发布包到 /opt/sparklearn/releases。"),
  numbered("备份当前 /opt/sparklearn/app 为 app.old-时间戳。"),
  numbered("解压新包到 /opt/sparklearn/app-new。"),
  numbered("从旧 app 复制 .env.deploy 到 app-new。"),
  numbered("切换 app-new 为正式 app。"),
  numbered("执行 docker compose up -d --build 重建并启动。"),
  numbered("执行健康检查、页面检查、关键接口检查。"),
  h2("9.3 推荐命令"),
  codeBlock([
    "cd /opt/sparklearn",
    "cp -a app app.old-$(date +%Y%m%d-%H%M%S)",
    "cp app/.env.deploy app-new/.env.deploy",
    "mv app app.switching",
    "mv app-new app",
    "cd app",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d --build",
  ]),
);

children.push(
  h1("10. 回滚与恢复"),
  ...image("04-rollback-flow.png", "图 5：异常回滚流程"),
  h2("10.1 回滚原则"),
  p("回滚的目标是在新版本异常时快速恢复到上一个已验证可用版本。不要在故障现场反复尝试无记录的手工修复，应先恢复服务，再整理日志和原因。"),
  h2("10.2 代码回滚"),
  codeBlock([
    "cd /opt/sparklearn",
    "docker compose -f app/docker-compose.deploy.yml --env-file app/.env.deploy down",
    "rm -rf app",
    "mv app.old-时间戳 app",
    "cd app",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d",
  ]),
  h2("10.3 数据回滚"),
  p("如果本次更新替换了 SQLite 数据库或 data 目录，代码回滚后还需要恢复数据备份。数据恢复前应停止容器，避免数据库文件正在被写入。"),
  codeBlock([
    "cd /opt/sparklearn/app",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy down",
    "rm -rf data",
    "cp -a /opt/sparklearn/backups/data-时间戳/data ./data",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy up -d",
  ]),
);

children.push(
  h1("11. 常见问题与处理"),
  table(
    ["问题", "现象", "处理方式"],
    [
      ["Docker 镜像拉取失败", "build 阶段 timeout 或 connection reset。", "配置 Docker registry mirrors，必要时离线导入基础镜像。"],
      ["npm 依赖下载失败", "npm ci 超时或 registry 不可达。", "使用 registry.npmmirror.com，构建时显式指定 registry。"],
      ["前端构建找不到 @ 别名", "Module not found: Can't resolve '@/xxx'。", "检查 tsconfig baseUrl 和 next.config alias。"],
      ["Tailwind 缺失", "构建提示 tailwindcss 找不到。", "生产构建时安装 devDependencies，使用 npm ci --include=dev。"],
      ["后端找不到 app 模块", "ModuleNotFoundError: No module named 'app'。", "设置 PYTHONPATH=/app/backend，并使用 uvicorn app.main:app。"],
      ["NumPy 兼容失败", "容器启动时报 CPU 指令集不支持。", "锁定兼容版本，例如 numpy==1.26.4。"],
      ["数据没有更新", "页面列表仍是旧数据。", "确认替换的是挂载目录中的数据库，并重启后端容器。"],
      ["AI 调用失败", "接口超时或鉴权失败。", "先区分网络不可达和密钥错误，再检查 .env.deploy。"],
    ],
    [1900, 3200, CONTENT_WIDTH - 5100],
  ),
  h1("12. 运维命令速查"),
  h2("12.1 Docker 常用命令"),
  codeBlock([
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy ps",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy logs -f backend",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy restart",
    "docker compose -f docker-compose.deploy.yml --env-file .env.deploy down",
    "docker system df",
  ]),
  h2("12.2 端口与进程检查"),
  codeBlock([
    "ss -lntp | grep -E '3000|3001|8000'",
    "firewall-cmd --list-ports",
    "curl http://127.0.0.1:8000/health",
  ]),
  h2("12.3 备份命令"),
  codeBlock([
    "mkdir -p /opt/sparklearn/backups/backup-$(date +%Y%m%d-%H%M%S)",
    "cp -a /opt/sparklearn/app /opt/sparklearn/backups/backup-时间戳/app",
    "cp -a /opt/sparklearn/app/data /opt/sparklearn/backups/backup-时间戳/data",
  ]),
);

children.push(
  h1("13. 交付清单"),
  table(
    ["检查项", "状态", "说明"],
    [
      ["服务器环境探测", "应完成", "记录 OS、CPU、内存、磁盘、网络。"],
      ["Docker 环境", "应完成", "Docker 与 Compose 可用，镜像源可拉取。"],
      ["平台端访问", "应完成", "http://172.17.6.31:3000"],
      ["官网访问", "应完成", "http://172.17.6.31:3001"],
      ["后端健康检查", "应完成", "http://172.17.6.31:8000/health"],
      ["演示数据", "应完成", "论坛四个板块各 12 条演示内容。"],
      ["回滚方案", "应完成", "保留 app.old 和 data backup。"],
      ["敏感信息保护", "必须完成", ".env.deploy 不进入仓库和文档正文。"],
    ],
    [2700, 1700, CONTENT_WIDTH - 4400],
  ),
  h2("13.1 已知限制"),
  p("当前服务器部署以演示和准上线为目标。后端容器曾采用最小镜像方案优先保证 API 服务可运行，视频处理、浏览器自动化、复杂文档渲染等能力如果需要在服务器完整启用，应在第二阶段补齐 ffmpeg、Playwright 浏览器运行时和相关系统依赖。"),
  h2("13.2 后续优化建议"),
  bullet("补齐并纳入版本管理：Dockerfile.backend、Dockerfile.frontend、Dockerfile.landing、docker-compose.deploy.yml、.dockerignore。"),
  bullet("将部署记录固定保存到 docs/deployment-evidence/日期-server-deploy，便于答辩和复盘。"),
  bullet("将 SQLite 演示数据包与代码发布包拆开管理，减少更新代码时误覆盖数据的风险。"),
  bullet("上线稳定后轮换 AI 密钥，并收敛 .env.deploy 文件权限。"),
  bullet("如果长期多人使用，规划 PostgreSQL、对象存储、反向代理和 HTTPS。"),
);

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Microsoft YaHei", size: 22, color: COLORS.ink } },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Microsoft YaHei", color: COLORS.blue },
        paragraph: { spacing: { before: 300, after: 220 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 27, bold: true, font: "Microsoft YaHei", color: COLORS.ink },
        paragraph: { spacing: { before: 220, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Microsoft YaHei", color: COLORS.ink },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 520, hanging: 260 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 620, hanging: 320 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE.width, height: PAGE.height },
          margin: PAGE.margin,
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                text("SparkLearn 服务器 Docker 部署文档  |  第 ", { size: 18, color: COLORS.muted }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Microsoft YaHei", size: 18, color: COLORS.muted }),
                text(" 页", { size: 18, color: COLORS.muted }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

fs.mkdirSync(OUT_DIR, { recursive: true });
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT_FILE, buffer);
  console.log(OUT_FILE);
});
