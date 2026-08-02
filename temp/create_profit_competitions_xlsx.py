# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import date
from pathlib import Path
import re
import zipfile

from openpyxl import Workbook, load_workbook
from openpyxl.formatting.rule import ColorScaleRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo


OUT = Path(r"D:\Project_building\SparkLearn\docs\2026-07-22_国内AI比赛赚钱优先清单.xlsx")
VERIFY_DATE = date(2026, 7, 22)

COLORS = {
    "navy": "16324F",
    "blue": "1F4E78",
    "cyan": "DDEBF7",
    "green": "E2F0D9",
    "yellow": "FFF2CC",
    "orange": "FCE4D6",
    "red": "F4CCCC",
    "gray": "E7E6E6",
    "white": "FFFFFF",
    "ink": "1F2937",
}

thin_gray = Side(style="thin", color="D9E2F3")


def set_link(cell, label: str, url: str) -> None:
    cell.value = label
    cell.hyperlink = url
    cell.style = "Hyperlink"
    cell.font = Font(name="微软雅黑", size=10, color="0563C1", underline="single")


def base_sheet(ws, freeze: str = "A2") -> None:
    ws.freeze_panes = freeze
    ws.sheet_view.showGridLines = False
    ws.auto_filter.ref = ws.dimensions
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.outlinePr.summaryBelow = True


def style_table(ws, headers, widths, table_name, row_height=52) -> None:
    for c, header in enumerate(headers, 1):
        cell = ws.cell(1, c, header)
        cell.fill = PatternFill("solid", fgColor=COLORS["navy"])
        cell.font = Font(name="微软雅黑", size=10, bold=True, color=COLORS["white"])
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(bottom=Side(style="medium", color="A9D18E"))
    ws.row_dimensions[1].height = 34
    for col, width in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(col)].width = width
    for row in ws.iter_rows(min_row=2):
        ws.row_dimensions[row[0].row].height = row_height
        for cell in row:
            cell.font = Font(name="微软雅黑", size=10, color=COLORS["ink"])
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = Border(bottom=thin_gray)
            if cell.row % 2 == 0:
                cell.fill = PatternFill("solid", fgColor="F8FAFC")
    tab = Table(displayName=table_name, ref=f"A1:{get_column_letter(len(headers))}{ws.max_row}")
    tab.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2", showFirstColumn=False, showLastColumn=False,
        showRowStripes=True, showColumnStripes=False
    )
    ws.add_table(tab)
    base_sheet(ws)


headers = [
    "优先级", "状态", "赛事/赛题", "主办方", "类型", "截止时间", "明确现金奖金",
    "奖金吸引力\n1-5", "项目匹配\n1-5", "低竞争\n1-5", "兑现确定\n1-5",
    "改造成本\n1低5高", "赚钱指数", "建议拿什么去投", "参赛限制/坑点",
    "竞争证据", "发现渠道", "官方/报名链接", "核验日期"
]

main_rows = [
    ["S", "立即报名", "启智杯·AI学习集市", "绵阳城市学院", "小型成果挑战/揭榜", date(2026,7,31),
     "最高8万元；原型30%+场景测试30%+验收40%", 4,5,4,4,2,"",
     "直接把 SparkLearn 包装为“学习任务包生成+陪学智能体+学习记录+结果展示”",
     "社会开发者/独立开发者/创业团队/公司均可；现有成果可报；要接受分阶段验收与成果入库",
     "赛题非常垂直，非全国流量型赛事；但属于交付式奖金，需重视验收条款",
     "微信公众号线索→官网核验", "https://qzb.mycc.edu.cn/tasks", VERIFY_DATE],
    ["S", "立即报名", "教育智能辅助与个性化学习 Skill 开发挑战赛", "科大讯飞", "公司平台 Skill 赛", date(2026,8,27),
     "专家榜5000/3000/2000元；热度榜800/500/300元+京东卡，总计1.23万元", 2,5,4,5,1,"",
     "拆出“学习画像→个性化路径/练习生成”单一 Skill；不要整个平台硬塞进去",
     "核心自研不少于50%；ZIP提交；专家榜比热度榜更值得冲；禁止刷量",
     "AI赛事通抓取约87队（动态值）；奖金覆盖专家榜3队+热度榜10队",
     "AI赛事通/公众号赛事汇总→讯飞官网", "https://www.competehub.dev/zh/competitions/xfyun765", VERIFY_DATE],
    ["S", "立即报名", "多源信息检索与分析 Skill 开发挑战赛", "科大讯飞", "公司平台 Skill 赛", date(2026,8,27),
     "专家榜5000/3000/2000元；热度榜800/500/300元+京东卡，总计1.23万元", 2,5,4,5,1,"",
     "抽取 SparkLearn 的 RAG：多源文档检索、证据引用、知识问答与深度分析",
     "核心自研不少于50%；ZIP提交；真实数据须脱敏；禁止刷量",
     "AI赛事通抓取约75队（动态值）；方向与现成 RAG 高度重合",
     "AI赛事通/公众号赛事汇总→讯飞官网", "https://competehub.dev/zh/competitions/xfyun764", VERIFY_DATE],
    ["S", "立即报名", "启智杯·学生自助服务（校园助手）", "绵阳城市学院", "小型成果挑战/揭榜", date(2026,7,31),
     "最高5万元；分阶段兑现", 3,5,4,4,2,"",
     "把学习助手扩成校园自助智能体：课表/学习/办事/RAG问答/事项提醒",
     "同一启智杯规则；需要按校方真实场景测试并验收",
     "垂直校内场景，传播面小；可与AI学习集市复用大部分代码",
     "微信公众号线索→官网核验", "https://qzb.mycc.edu.cn/tasks", VERIFY_DATE],
    ["A", "学生队必投", "2026星火杯大模型应用创新赛", "科大讯飞", "公司生态应用赛", date(2026,8,13),
     "总奖金25万元：冠军6万；2×3万；3×2万；14×5000元", 4,5,3,5,2,"",
     "原样强化 SparkLearn：学生学习闭环、多智能体协作、知识库、MCP、记忆与防幻觉",
     "仅全日制在校大学生；每队不超过6人；须在讯飞星辰Agent平台发布；晋级受作品热度影响",
     "历届累计参与度高；但技术栈完全对口，迁移成本低",
     "公众号/开发者社区→讯飞官网", "https://challenge.xfyun.cn/xinghuo?ch=dc-web-banner01", VERIFY_DATE],
    ["A", "建议报名", "从自然语言到可执行工作流的 Agent 算法挑战赛", "科大讯飞", "公司算法/Agent赛", date(2026,9,4),
     "第一5000、第二3000、第三2000元，总计1万元", 2,4,3,5,2,"",
     "复用多智能体任务规划与工具调用，改成企业请假/会议室/报销仿真执行 Agent",
     "需要提交可在标准Docker运行的代码；隐藏测试集；看任务成功率、合法性、效率、鲁棒性",
     "AI赛事通抓取约75队（动态值）",
     "AI赛事通/公众号赛事汇总→讯飞官网", "https://www.competehub.dev/zh/competitions/xfyun783", VERIFY_DATE],
    ["A", "先确认资格", "可信 AI 黑客松 2026", "TABEI/产业赞助方", "社区+企业黑客松（台北）", date(2026,8,5),
     "主奖金池1.2万美元起；最多录取20队", 4,4,5,4,3,"",
     "把防幻觉控制器、授权边界、操作审计、人类确认做成“可信学习Agent”",
     "8/29-31台北线下；大陆团队能否报名、入台成本与税务必须先邮件确认",
     "官方明确最多20队，奖金/入围队数比高；官网表述会随赞助加码",
     "社群/Luma活动页→赛事官网", "https://hackathon.chain.tw/", VERIFY_DATE],
    ["A", "先确认资格", "2026和泰 AI 黑客松", "和泰集团×Google Cloud", "企业真题黑客松（台湾）", date(2026,10,14),
     "总奖金超新台币100万元；冠军30万元", 4,3,3,4,3,"",
     "优先选顾客体验/售后/共享出行/品牌营销题；把画像与推荐Agent改成客户服务方案",
     "2-5人；高中/高校/社会人士可报；大陆参赛资格、线下决赛与奖金税务需先确认",
     "往届媒体案例约233队；不是低竞争，但公司真题与奖金明确",
     "高校公众号/社群→赛事官网", "https://ht-hackathon.tw", VERIFY_DATE],
    ["B", "有余力再投", "SpaceMind AI Agent 创新应用大赛", "SpaceMind/科大讯飞赛事平台", "公司生态 Agent 赛", date(2026,8,14),
     "第一1万美元、第二5000美元、第三3000美元，总计1.8万美元", 4,3,4,4,3,"",
     "改成“家庭学习管家/儿童陪伴”：家庭空间感知+学习计划+家长摘要+IoT联动",
     "必须突出家庭空间/IoT/硬件协同，不是纯网页教育应用；英文规则与结算需复核",
     "AI赛事通抓取约54队（动态值）",
     "AI赛事通→讯飞平台", "https://www.competehub.dev/zh/competitions/xfyun778", VERIFY_DATE],
    ["B", "有余力再投", "启智杯·AI程序员智能体", "绵阳城市学院", "小型成果挑战/揭榜", date(2026,7,31),
     "最高30万元；分阶段兑现", 5,2,4,4,4,"",
     "若已有代码Agent能力，再投“需求→代码→测试→部署/文档”的工程智能体；不要从零做",
     "高额但验收重，疑似真实采购式交付；奖金不是报名即赛后一次性发放",
     "垂直赛题、金额高，预计对工程成熟度要求远高于普通黑客松",
     "微信公众号线索→官网核验", "https://qzb.mycc.edu.cn/tasks", VERIFY_DATE],
    ["B", "方案型可投", "第五届琶洲算法大赛·AI+软件应用赛", "琶洲实验室等", "应用方案赛", date(2026,9,15),
     "单赛道冠军8万元；另有落地支持（非现金）", 4,4,2,4,2,"",
     "用 SparkLearn 商业计划书+Demo；强调Agent/RAG落地、教育数据闭环和客户付费场景",
     "报名阶段可先交BP；后续竞争强；其余奖级现金需以完整章程为准",
     "全国性赛事，名气较大、竞争预计高；胜率不如小赛",
     "公众号/赛事媒体→官网", "https://www.aicompetition-pz.com/event_detail/117", VERIFY_DATE],
    ["C", "仅有新疆伙伴", "新疆“AI+”创新融合应用大赛", "新疆克拉玛依等", "地方应用赛", date(2026,7,25),
     "3×1万元、5×8000元、8×5000元", 3,3,3,5,4,"",
     "改成新疆教育/职业培训/双语学习场景，最好绑定当地学校或企业案例",
     "须单位申报；项目需已在新疆落地或具备复制推广条件；时间极短",
     "地方赛奖金覆盖16个项目，但地域与单位门槛高",
     "地方公众号/政府网站", "https://www.xjkel.gov.cn/xjkrls/c110164/202607/45be7b9bb2344885b503fe017063a628.shtml", VERIFY_DATE],
    ["C", "不建议主攻", "AMD Physical AI Global Hackathon", "AMD/生态伙伴", "公司全球黑客松", date(2026,8,6),
     "总奖金3万美元；Physical AI赛道5000/3500/1500美元", 4,2,3,4,5,"",
     "只有能做具身仿真时，才把学习智能体改成机器人教学/实验室助手",
     "需AMD硬件/Physical AI方向，软硬件和仿真成本高；与现项目主线偏离",
     "奖金不错，但并非国内小赛，技术门槛与参赛成本高",
     "AI赛事通公众号镜像→赛事页", "https://competehub.dev/zh/competitions/urls1300082127dbe47010e35bdbccd6cb16", VERIFY_DATE],
]

skill_headers = ["赛题", "截止", "现金奖结构", "抓取队伍数", "匹配度1-5", "低竞争1-5", "改造成本1低5高", "撒网指数", "可复用模块", "建议", "链接", "数据日期"]
skill_rows = [
    ["教育智能辅助与个性化学习 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 87,5,4,1,"", "画像、路径规划、练习生成", "第一批完成", "https://www.competehub.dev/zh/competitions/xfyun765", VERIFY_DATE],
    ["多源信息检索与分析 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 75,5,4,1,"", "RAG、引用、深度检索", "第一批完成", "https://competehub.dev/zh/competitions/xfyun764", VERIFY_DATE],
    ["数据智能分析与应用 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 89,4,4,2,"", "学习数据报告、异常检测", "第二批", "https://www.competehub.dev/zh/competitions/xfyun771", VERIFY_DATE],
    ["电商内容智能生成与用户洞察 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 98,3,4,3,"", "内容生成、画像", "若要扩赛道再做", "https://challenge.xfyun.cn/competition", VERIFY_DATE],
    ["智能办公协同助理 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 130,3,3,2,"", "工作流、提醒、文档", "第三批", "https://www.competehub.dev/zh/competitions/xfyun772", VERIFY_DATE],
    ["全场景内容智能创作 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 146,3,3,2,"", "课程/资源生成", "第三批", "https://challenge.xfyun.cn/competition", VERIFY_DATE],
    ["人才匹配与发展智能辅助 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 155,3,3,3,"", "画像与路径推荐", "可改职业学习", "https://challenge.xfyun.cn/competition", VERIFY_DATE],
    ["医疗健康智能理解与辅助决策 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 154,1,3,5,"", "少量RAG可复用", "不建议，合规成本高", "https://challenge.xfyun.cn/competition", VERIFY_DATE],
    ["代码智能辅助与质量保障 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 233,2,2,4,"", "开发文档、测试", "除非已有成熟代码Agent", "https://www.competehub.dev/zh/competitions/xfyun762", VERIFY_DATE],
    ["政务公文智能处理 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 278,1,2,4,"", "文档RAG", "不建议", "https://challenge.xfyun.cn/competition", VERIFY_DATE],
    ["金融材料智能解析与风险洞察 Skill", date(2026,8,27), "5000/3000/2000 + 热度奖", 329,1,1,5,"", "文档解析", "不建议", "https://challenge.xfyun.cn/competition", VERIFY_DATE],
]

conditional_headers = ["赛事", "当前判断", "为什么没放主攻", "仍可能有价值的点", "下一动作", "链接", "核验日期"]
conditional_rows = [
    ["2026 AI助残创新创意大赛", "开放，7月31日截止；公告仅写‘酌情给予物质奖励’", "没有核验到固定现金金额，不满足‘现金明确’硬条件", "教育、心理支持与智能体很贴；创意赛允许个人/团队且可多项目", "先电话/邮件确认冠军现金与决赛差旅，再决定", "https://www.hunantoday.cn/news/xhn/202607/33145775.html", VERIFY_DATE],
    ["2026面向东盟AI+跨境电商创新应用大赛", "官网显示社会组仍开放/延期", "本轮未从公开正文稳定提取现金奖明细", "社会组可交BP+AI功能Demo，可能比算法赛更容易复用", "联系组委会索取社会组奖项表后再投", "https://aicbec.cn/", VERIFY_DATE],
    ["AI+软件 AI Agent黑客松（深圳）", "目前仍在征集出题企业/赞助方", "参赛报名尚未正式开放，奖金池未定", "主题高度匹配Agent、代码、测试与研发提效", "盯深圳软件行业协会公众号，开放即加入", "https://www.ssia.org.cn/page63?article_id=2787", VERIFY_DATE],
]

closed_headers = ["赛事", "为什么剔除", "截止/现状", "原现金诱惑", "链接"]
closed_rows = [
    ["腾讯云黑客松·AI智能体争霸赛", "官网仍显示进行中，但作品提交已截止，不能再参赛", "作品提交5月31日已截止", "奖金45万元", "https://tch.cloud.tencent.com/contest/41"],
    ["AI+人力资源服务全球创新创意大赛", "报名截止已过", "2026年7月15日截止", "每赛道一等奖20万、二等奖10万、三等奖5万", "https://rsj.huaian.gov.cn/col/3932_871247/art/o/17802432/1782178471257X1hmgnrV.html"],
    ["UClawHunt/爪寻AI百人黑客松", "报名/活动已结束", "7月上旬已关闭", "曾有2万/5万元奖金口径", "https://www.competehub.dev/zh/monthly/2026-07"],
    ["TapTap制造新星 Game Jam", "报名已截止", "2026年7月18日截止", "奖金曾明确", "https://www.taptap.cn/"],
]


wb = Workbook()
ws = wb.active
ws.title = "赚钱优先榜"
ws.append(headers)
for row in main_rows:
    ws.append(row)
for r in range(2, ws.max_row + 1):
    ws.cell(r, 13, f"=ROUND(100*(H{r}*I{r}*J{r}*K{r})/(625*L{r}),1)")
    ws.cell(r, 6).number_format = "yyyy-mm-dd"
    ws.cell(r, 19).number_format = "yyyy-mm-dd"
    set_link(ws.cell(r, 18), "打开链接", main_rows[r-2][17])
style_table(ws, headers, [8,11,32,18,18,13,38,10,10,10,10,12,11,42,46,38,22,14,13], "MoneyPriority", 68)
ws.auto_filter.ref = f"A1:S{ws.max_row}"
ws.conditional_formatting.add(f"M2:M{ws.max_row}", ColorScaleRule(start_type="min", start_color="F8696B", mid_type="percentile", mid_value=50, mid_color="FFEB84", end_type="max", end_color="63BE7B"))
ws.conditional_formatting.add(f"A2:A{ws.max_row}", FormulaRule(formula=["$A2=\"S\""], fill=PatternFill("solid", fgColor=COLORS["green"])))
ws.conditional_formatting.add(f"B2:B{ws.max_row}", FormulaRule(formula=['ISNUMBER(SEARCH("确认",$B2))'], fill=PatternFill("solid", fgColor=COLORS["yellow"])))

ws2 = wb.create_sheet("讯飞Skill撒网池")
ws2.append(skill_headers)
for row in skill_rows:
    ws2.append(row)
for r in range(2, ws2.max_row+1):
    ws2.cell(r, 8, f"=ROUND(100*(E{r}*F{r})/(25*G{r}),1)")
    ws2.cell(r, 2).number_format = "yyyy-mm-dd"
    ws2.cell(r, 12).number_format = "yyyy-mm-dd"
    set_link(ws2.cell(r, 11), "打开链接", skill_rows[r-2][10])
style_table(ws2, skill_headers, [34,13,30,13,12,12,15,12,30,24,14,13], "SkillPool", 54)
ws2.conditional_formatting.add(f"H2:H{ws2.max_row}", ColorScaleRule(start_type="min", start_color="F8696B", mid_type="percentile", mid_value=50, mid_color="FFEB84", end_type="max", end_color="63BE7B"))

ws3 = wb.create_sheet("条件型与待确认")
ws3.append(conditional_headers)
for row in conditional_rows:
    ws3.append(row)
for r in range(2, ws3.max_row+1):
    ws3.cell(r, 7).number_format = "yyyy-mm-dd"
    set_link(ws3.cell(r, 6), "打开链接", conditional_rows[r-2][5])
style_table(ws3, conditional_headers, [34,36,44,42,36,14,13], "ConditionalPool", 78)

ws4 = wb.create_sheet("已截止别浪费时间")
ws4.append(closed_headers)
for row in closed_rows:
    ws4.append(row)
for r in range(2, ws4.max_row+1):
    set_link(ws4.cell(r, 5), "查看原页", closed_rows[r-2][4])
style_table(ws4, closed_headers, [36,42,28,32,14], "ClosedPool", 58)

ws5 = wb.create_sheet("赚钱打法")
ws5.sheet_view.showGridLines = False
ws5.column_dimensions["A"].width = 22
ws5.column_dimensions["B"].width = 100
notes = [
    ("结论", "现金优先顺序：先做启智杯AI学习集市 + 讯飞教育Skill + 讯飞多源检索Skill；有学生身份再加星火杯。前三个可共用同一套教育/RAG核心，边际成本最低。"),
    ("赚钱指数", "赚钱指数 = 100 ×（奖金吸引力 × 项目匹配 × 低竞争 × 兑现确定）÷（625 × 改造成本）。它是筛选用相对分，不是中奖概率；越高表示同样时间更值得投。"),
    ("7月22-23日", "先占报名坑位：启智杯两个赛题、星火杯（如有学生队）、可信AI黑客松先发邮件确认大陆资格。报名不等于必须最后提交，但错过截止就彻底没机会。"),
    ("7月24-27日", "把 SparkLearn 拆成三个可独立演示的资产：①个性化学习Skill；②多源检索/RAG Skill；③完整学习闭环Demo。统一准备2分钟视频、8页路演PPT、架构图、真实效果截图。"),
    ("7月28-31日", "启智杯优先交AI学习集市，再复用为校园助手；同时提交讯飞两个Skill的可运行ZIP。启智杯AI程序员只在已有成熟代码Agent时投，别被30万元拖走主线。"),
    ("8月策略", "星火杯用完整项目；讯飞Skill赛用单点能力；SpaceMind只做家庭学习管家改造。热度榜可以合规做内容分发，但主攻专家榜，严禁刷量。"),
    ("现金风险", "“最高奖金/激励金/落地扶持”不等于一次性现金。启智杯是分阶段验收式兑现；台湾赛要先确认大陆资格、差旅和税务；未写固定现金的赛事放在待确认页。"),
    ("信息源说明", "小红书对公开搜索引擎收录很差，本表主要通过公众号赛事聚合、AI赛事通、开发者社区和高校转发发现线索，再回到主办方官网/正式通知核验。队伍数为抓取时动态值，仅用于判断拥挤度。"),
    ("核验边界", "全网无法数学意义上保证‘所有’；本表是截至2026-07-22仍开放、现金明确或高价值待确认、且与SparkLearn可复用的赚钱优先池。报名当天仍应再点官网确认延期/关闭/规则变更。"),
]
for idx, (k, v) in enumerate(notes, 1):
    ws5.cell(idx, 1, k)
    ws5.cell(idx, 2, v)
    ws5.row_dimensions[idx].height = 54 if idx > 2 else 66
    for c in (1,2):
        ws5.cell(idx,c).font = Font(name="微软雅黑", size=11, bold=(c==1), color=COLORS["ink"])
        ws5.cell(idx,c).alignment = Alignment(vertical="center", wrap_text=True)
        ws5.cell(idx,c).border = Border(bottom=thin_gray)
    ws5.cell(idx,1).fill = PatternFill("solid", fgColor=COLORS["cyan"] if idx % 2 else COLORS["green"])
ws5.freeze_panes = "A1"

for sheet in wb.worksheets:
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.orientation = "landscape"
    sheet.page_margins.left = 0.25
    sheet.page_margins.right = 0.25
    sheet.page_margins.top = 0.5
    sheet.page_margins.bottom = 0.5

wb.calculation.fullCalcOnLoad = True
wb.calculation.forceFullCalc = True
wb.calculation.calcMode = "auto"
OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)

# Windows 环境未必可用 LibreOffice 重算。向公式单元格写入已计算缓存值，
# 同时保留 <f> 公式；Excel 打开后仍会按 auto 模式再次计算。
cache_values = {
    "xl/worksheets/sheet1.xml": {
        f"M{r}": round(100 * (main_rows[r-2][7] * main_rows[r-2][8] * main_rows[r-2][9] * main_rows[r-2][10]) / (625 * main_rows[r-2][11]), 1)
        for r in range(2, len(main_rows) + 2)
    },
    "xl/worksheets/sheet2.xml": {
        f"H{r}": round(100 * (skill_rows[r-2][4] * skill_rows[r-2][5]) / (25 * skill_rows[r-2][6]), 1)
        for r in range(2, len(skill_rows) + 2)
    },
}
tmp_out = OUT.with_name(OUT.stem + ".cached.xlsx")
with zipfile.ZipFile(OUT, "r") as zin, zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename in cache_values:
            text = data.decode("utf-8")
            for ref, value in cache_values[item.filename].items():
                pattern = rf'(<c\s+r="{ref}"[^>]*>.*?<f[^>]*>.*?</f>\s*<v>)(.*?)(</v>)'
                text, n = re.subn(pattern, rf'\g<1>{value}\g<3>', text, count=1, flags=re.DOTALL)
                assert n == 1, f"未找到公式缓存单元格: {item.filename}!{ref}"
            data = text.encode("utf-8")
        zout.writestr(item, data)
tmp_out.replace(OUT)

# 结构性自检：文件可重新打开、表数/公式/超链接完整。
check = load_workbook(OUT, data_only=False)
assert check.sheetnames == ["赚钱优先榜", "讯飞Skill撒网池", "条件型与待确认", "已截止别浪费时间", "赚钱打法"]
assert sum(1 for row in check["赚钱优先榜"].iter_rows() for c in row if c.hyperlink) == len(main_rows)
assert sum(1 for row in check["讯飞Skill撒网池"].iter_rows() for c in row if c.hyperlink) == len(skill_rows)
assert all(check["赚钱优先榜"].cell(r, 13).data_type == "f" for r in range(2, check["赚钱优先榜"].max_row + 1))
check.close()
cached = load_workbook(OUT, data_only=True)
assert all(isinstance(cached["赚钱优先榜"].cell(r, 13).value, (int, float)) for r in range(2, cached["赚钱优先榜"].max_row + 1))
assert all(isinstance(cached["讯飞Skill撒网池"].cell(r, 8).value, (int, float)) for r in range(2, cached["讯飞Skill撒网池"].max_row + 1))
cached.close()
print(OUT)
