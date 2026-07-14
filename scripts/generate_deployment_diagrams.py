# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT = Path("docs/deployment-doc-assets")
OUT.mkdir(parents=True, exist_ok=True)


def font(size: int, bold: bool = False):
    candidates = [
        "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
    ]
    for item in candidates:
        if item and Path(item).exists():
            return ImageFont.truetype(item, size)
    return ImageFont.load_default()


F_TITLE = font(34, True)
F_H = font(22, True)
F_BODY = font(18)
F_SMALL = font(15)


COLORS = {
    "bg": "#F7FAFC",
    "ink": "#13233A",
    "muted": "#58677D",
    "blue": "#2F6FED",
    "blue2": "#E8F0FF",
    "green": "#16A673",
    "green2": "#E8F8F1",
    "orange": "#E98B2A",
    "orange2": "#FFF2E5",
    "purple": "#7B61FF",
    "purple2": "#F0EDFF",
    "line": "#C9D5E5",
    "white": "#FFFFFF",
}


def wrap_text(draw, text, fnt, width):
    lines = []
    for paragraph in text.split("\n"):
        current = ""
        for ch in paragraph:
            trial = current + ch
            if draw.textbbox((0, 0), trial, font=fnt)[2] <= width:
                current = trial
            else:
                if current:
                    lines.append(current)
                current = ch
        if current:
            lines.append(current)
    return lines


def rounded_box(draw, xy, title, body, fill, outline="#C9D5E5", title_color=None):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=18, fill=fill, outline=outline, width=2)
    draw.text((x1 + 22, y1 + 18), title, font=F_H, fill=title_color or COLORS["ink"])
    y = y1 + 54
    for line in wrap_text(draw, body, F_SMALL, x2 - x1 - 44):
        draw.text((x1 + 22, y), line, font=F_SMALL, fill=COLORS["muted"])
        y += 23


def arrow(draw, start, end, color="#718096"):
    draw.line([start, end], fill=color, width=4)
    sx, sy = start
    ex, ey = end
    if abs(ex - sx) >= abs(ey - sy):
        direction = 1 if ex > sx else -1
        pts = [(ex, ey), (ex - direction * 14, ey - 8), (ex - direction * 14, ey + 8)]
    else:
        direction = 1 if ey > sy else -1
        pts = [(ex, ey), (ex - 8, ey - direction * 14), (ex + 8, ey - direction * 14)]
    draw.polygon(pts, fill=color)


def canvas(title, size=(1400, 860)):
    img = Image.new("RGB", size, COLORS["bg"])
    draw = ImageDraw.Draw(img)
    draw.text((48, 36), title, font=F_TITLE, fill=COLORS["ink"])
    draw.line((48, 88, size[0] - 48, 88), fill=COLORS["line"], width=2)
    return img, draw


def architecture():
    img, d = canvas("SparkLearn 服务器 Docker 部署架构")
    rounded_box(d, (70, 145, 340, 305), "用户浏览器", "访问平台端、官网与后端接口。\n学生、教师、管理员均通过 Web 使用。", COLORS["white"])
    rounded_box(d, (430, 125, 720, 255), "平台端容器", "sparklearn-frontend\nNext.js 平台应用\n端口：3000", COLORS["blue2"], COLORS["blue"])
    rounded_box(d, (430, 315, 720, 445), "官网容器", "sparklearn-landing\nNext.js 官网应用\n端口：3001", COLORS["purple2"], COLORS["purple"])
    rounded_box(d, (810, 220, 1100, 370), "后端容器", "sparklearn-backend\nFastAPI + Uvicorn\n端口：8000\n健康检查：/health", COLORS["green2"], COLORS["green"])
    rounded_box(d, (810, 470, 1100, 635), "数据目录挂载", "/opt/sparklearn/app/data/backend\nSQLite 数据库、用户文件、演示数据", COLORS["orange2"], COLORS["orange"])
    rounded_box(d, (1160, 220, 1340, 635), "国内 AI 服务", "讯飞星火\n星辰/Coze\nDeepSeek\nDashScope\n通过 .env.deploy 注入密钥", COLORS["white"])
    arrow(d, (340, 220), (430, 190), COLORS["blue"])
    arrow(d, (340, 245), (430, 380), COLORS["purple"])
    arrow(d, (720, 190), (810, 290), COLORS["green"])
    arrow(d, (720, 380), (810, 310), COLORS["green"])
    arrow(d, (955, 370), (955, 470), COLORS["orange"])
    arrow(d, (1100, 300), (1160, 300), COLORS["green"])
    d.text((72, 720), "部署结果：后端 8000、平台端 3000、官网 3001 对外开放；数据通过挂载目录持久化，服务由 Docker Compose 统一编排。", font=F_BODY, fill=COLORS["ink"])
    img.save(OUT / "01-architecture.png")


def deployment_flow():
    img, d = canvas("首次部署流程")
    steps = [
        ("1. 环境探测", "确认 CentOS、CPU、内存、磁盘、网络和端口。"),
        ("2. 修复 yum 源", "CentOS 7 使用 vault/国内源恢复软件安装能力。"),
        ("3. 安装 Docker", "安装 Docker Engine 与 Compose，配置国内镜像。"),
        ("4. 本地打包上传", "Windows 侧生成发布包，通过 SSH/SCP 上传服务器。"),
        ("5. 配置环境变量", "服务器保留 .env.deploy，密钥不写入文档和仓库。"),
        ("6. 构建启动", "docker compose up -d --build 启动三类服务。"),
        ("7. 验证验收", "检查 /health、3000、3001、AI 网络连通性。"),
    ]
    x, y = 70, 145
    w, h, gap = 250, 128, 34
    positions = []
    for i, (title, body) in enumerate(steps):
        row = 0 if i < 4 else 1
        col = i if i < 4 else i - 4
        px = x + col * (w + gap)
        py = y + row * 250
        positions.append((px, py, px + w, py + h))
        rounded_box(d, positions[-1], title, body, COLORS["white"])
    for i in range(3):
        arrow(d, (positions[i][2], positions[i][1] + h // 2), (positions[i + 1][0], positions[i + 1][1] + h // 2), COLORS["blue"])
    arrow(d, (positions[3][0] + w // 2, positions[3][3]), (positions[4][0] + w // 2, positions[4][1]), COLORS["blue"])
    for i in range(4, 6):
        arrow(d, (positions[i][2], positions[i][1] + h // 2), (positions[i + 1][0], positions[i + 1][1] + h // 2), COLORS["blue"])
    d.text((70, 690), "关键原则：每一步都先记录、再执行；涉及替换代码或数据前必须先备份，部署成功后保存验证结果。", font=F_BODY, fill=COLORS["ink"])
    img.save(OUT / "02-deployment-flow.png")


def update_flow():
    img, d = canvas("版本更新发布流程")
    steps = [
        ("本地修复", "完成页面、接口、数据或配置修改。"),
        ("本地验证", "执行 lint、编译检查、关键接口验证。"),
        ("生成发布包", "排除 node_modules、.git、临时产物。"),
        ("上传 releases", "上传到 /opt/sparklearn/releases。"),
        ("备份旧版本", "备份 /opt/sparklearn/app 与数据目录。"),
        ("替换目录", "复制 .env.deploy 后切换 app-new 为 app。"),
        ("重建容器", "down 后 up -d --build。"),
        ("验证通过", "健康检查、页面访问、业务数据检查。"),
    ]
    for i, (title, body) in enumerate(steps):
        px = 70 + (i % 4) * 320
        py = 145 + (i // 4) * 245
        rounded_box(d, (px, py, px + 260, py + 132), title, body, COLORS["blue2"] if i < 4 else COLORS["green2"], COLORS["blue"] if i < 4 else COLORS["green"])
    for i in range(3):
        arrow(d, (330 + i * 320, 211), (390 + i * 320, 211), COLORS["blue"])
    arrow(d, (550, 277), (550, 390), COLORS["blue"])
    for i in range(4, 7):
        arrow(d, (330 + (i - 4) * 320, 456), (390 + (i - 4) * 320, 456), COLORS["green"])
    d.text((70, 700), "更新部署不直接覆盖旧版本，始终保留可回退目录。数据库更新单独备份，避免代码成功但数据不可恢复。", font=F_BODY, fill=COLORS["ink"])
    img.save(OUT / "03-update-flow.png")


def rollback_flow():
    img, d = canvas("异常回滚流程")
    rounded_box(d, (80, 145, 350, 290), "发现异常", "页面打不开、接口失败、容器异常退出或数据错误。", COLORS["orange2"], COLORS["orange"])
    rounded_box(d, (430, 145, 700, 290), "停止新服务", "docker compose down\n避免继续写入异常数据。", COLORS["white"])
    rounded_box(d, (780, 145, 1050, 290), "恢复旧 app", "删除当前 app，恢复 app.old-时间戳。", COLORS["blue2"], COLORS["blue"])
    rounded_box(d, (430, 395, 700, 540), "恢复数据", "如数据库被替换，则恢复 data.backup-时间戳。", COLORS["green2"], COLORS["green"])
    rounded_box(d, (780, 395, 1050, 540), "重新启动", "docker compose up -d\n再执行健康检查。", COLORS["purple2"], COLORS["purple"])
    rounded_box(d, (1130, 270, 1340, 415), "记录原因", "保留日志、错误命令、时间点与处理结论。", COLORS["white"])
    arrow(d, (350, 218), (430, 218), COLORS["orange"])
    arrow(d, (700, 218), (780, 218), COLORS["blue"])
    arrow(d, (915, 290), (565, 395), COLORS["green"])
    arrow(d, (700, 468), (780, 468), COLORS["purple"])
    arrow(d, (1050, 468), (1130, 365), COLORS["purple"])
    d.text((80, 690), "回滚目标不是“清空重来”，而是在最短时间内恢复到上一个已验证可用版本。", font=F_BODY, fill=COLORS["ink"])
    img.save(OUT / "04-rollback-flow.png")


def data_flow():
    img, d = canvas("演示数据同步流程")
    steps = [
        ("本地数据清理", "清理测试帖、乱码、验收账号痕迹。"),
        ("生成演示数据", "论坛四个板块各 10-15 条真实内容。"),
        ("本地验证", "接口统计、页面数量、列表内容检查。"),
        ("服务器备份", "备份当前 SQLite 与 data 目录。"),
        ("上传替换", "上传 sparklearn.db 或数据包到服务器。"),
        ("重启验证", "检查论坛统计、学生端、教师端和管理端。"),
    ]
    for i, (title, body) in enumerate(steps):
        px = 100 + i * 205
        py = 230 if i % 2 == 0 else 385
        rounded_box(d, (px, py, px + 175, py + 125), title, body, COLORS["white"])
        if i < len(steps) - 1:
            nx = 100 + (i + 1) * 205
            ny = 230 if (i + 1) % 2 == 0 else 385
            arrow(d, (px + 175, py + 62), (nx, ny + 62), COLORS["blue"])
    d.text((100, 650), "数据同步需要和代码更新分开管理。代码可以重建，演示数据要先备份再替换，避免答辩展示内容被测试数据污染。", font=F_BODY, fill=COLORS["ink"])
    img.save(OUT / "05-data-flow.png")


architecture()
deployment_flow()
update_flow()
rollback_flow()
data_flow()
print(f"generated {len(list(OUT.glob('*.png')))} diagrams in {OUT}")
