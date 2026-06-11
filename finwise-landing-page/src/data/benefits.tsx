import { FiBarChart2, FiBookOpen, FiCheckCircle, FiPieChart, FiShield, FiTarget, FiTrendingUp, FiVideo } from "react-icons/fi";

import { IBenefit } from "@/types";

export const benefits: IBenefit[] = [
    {
        title: "学习画像",
        description: "先把用户的目标、薄弱点和学习偏好看清楚，再开始推荐内容和路径。",
        bullets: [
            {
                title: "能力雷达",
                description: "用清晰的图形把掌握情况展示出来。",
                icon: <FiBarChart2 size={26} />
            },
            {
                title: "目标管理",
                description: "把学习目标直接转成可执行的任务。",
                icon: <FiTarget size={26} />
            },
            {
                title: "趋势预判",
                description: "通过趋势提示下一步最该补什么。",
                icon: <FiTrendingUp size={26} />
            }
        ],
        imageSrc: "/images/plot1.png"
    },
    {
        title: "智能路径",
        description: "根据当前状态自动生成适合的学习路线，让用户少绕路、少试错。",
        bullets: [
            {
                title: "阶段规划",
                description: "从基础到进阶，路径层次清楚。",
                icon: <FiBookOpen size={26} />
            },
            {
                title: "任务拆解",
                description: "把复杂目标拆成每天能做的步骤。",
                icon: <FiPieChart size={26} />
            },
            {
                title: "进度反馈",
                description: "每一步完成后都能看到进展变化。",
                icon: <FiCheckCircle size={26} />
            }
        ],
        imageSrc: "/images/plot2.png"
    },
    {
        title: "成果闭环",
        description: "从内容生成到练习巩固，再到报告复盘，产品把结果完整呈现出来。",
        bullets: [
            {
                title: "AI 生成",
                description: "题目、讲解和素材生成更高效。",
                icon: <FiVideo size={26} />
            },
            {
                title: "练习巩固",
                description: "让学习结果马上进入练习验证。",
                icon: <FiShield size={26} />
            },
            {
                title: "报告复盘",
                description: "把学习成果汇总成清晰的结果页。",
                icon: <FiTrendingUp size={26} />
            }
        ],
        imageSrc: "/images/plot1.png"
    },
];
