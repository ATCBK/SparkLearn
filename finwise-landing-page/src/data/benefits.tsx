import { FiBarChart2, FiBookOpen, FiCheckCircle, FiClipboard, FiFileText, FiLayers, FiMap, FiMessageCircle, FiRefreshCw, FiSearch, FiTarget, FiTrendingUp, FiUserCheck } from "react-icons/fi";

import { IBenefit } from "@/types";

export const benefits: IBenefit[] = [
    {
        title: "学习画像",
        description: "从目标、基础、薄弱点、学习偏好和可投入时间出发，先建立系统对学习者的理解。",
        bullets: [
            {
                title: "对话建档",
                description: "通过问卷与对话采集学习目标、基础水平和当前困难。",
                icon: <FiUserCheck size={26} />
            },
            {
                title: "能力雷达",
                description: "把知识掌握、薄弱点和阶段状态转成可视化画像。",
                icon: <FiBarChart2 size={26} />
            },
            {
                title: "画像更新",
                description: "学习过程中的练习、资源和反馈会继续回写画像。",
                icon: <FiRefreshCw size={26} />
            }
        ],
        imageSrc: "/images/feature-profile-v2.png"
    },
    {
        title: "资源生成",
        description: "围绕当前学习节点自动生成多形态学习材料，把学习需求快速变成可使用的内容。",
        bullets: [
            {
                title: "多模态内容",
                description: "支持文档、PPT、思维导图、视频、播客和练习等资源。",
                icon: <FiLayers size={26} />
            },
            {
                title: "贴合当前节点",
                description: "资源生成会结合画像、目标和路径节点，减少泛泛而谈。",
                icon: <FiTarget size={26} />
            },
            {
                title: "结果可复用",
                description: "生成后的材料进入资源库，方便继续学习、复盘和分享。",
                icon: <FiFileText size={26} />
            }
        ],
        imageSrc: "/images/feature-generate-v2.png"
    },
    {
        title: "路径规划",
        description: "根据画像和学习目标生成阶段路线，把长期目标拆成可以逐步完成的任务。",
        bullets: [
            {
                title: "阶段规划",
                description: "从基础补齐到进阶实践，清楚标出每个阶段要完成什么。",
                icon: <FiMap size={26} />
            },
            {
                title: "任务拆解",
                description: "把复杂学习目标拆成节点任务，降低开始和坚持的成本。",
                icon: <FiClipboard size={26} />
            },
            {
                title: "动态调整",
                description: "根据练习表现和学习反馈，持续调整后续学习节奏。",
                icon: <FiTrendingUp size={26} />
            }
        ],
        imageSrc: "/images/feature-path.png"
    },
    {
        title: "智能辅导",
        description: "通过 AI Tutor、多角色讲解和知识检索，让学习过程不止停留在静态资料。",
        bullets: [
            {
                title: "Tutor 对话",
                description: "围绕当前学习节点持续追问，获得更贴近上下文的讲解。",
                icon: <FiMessageCircle size={26} />
            },
            {
                title: "知识检索",
                description: "结合知识库和资料片段召回，让回答更有依据。",
                icon: <FiSearch size={26} />
            },
            {
                title: "多角色支持",
                description: "可按讲解、启发、督学等不同风格辅助学习。",
                icon: <FiBookOpen size={26} />
            }
        ],
        imageSrc: "/images/feature-tutor-v2.png"
    },
    {
        title: "学习评估",
        description: "用练习、报告和反馈把学习结果沉淀下来，形成可持续优化的学习闭环。",
        bullets: [
            {
                title: "练习评测",
                description: "通过题目与任务检查学习成果，而不是只看是否浏览过内容。",
                icon: <FiCheckCircle size={26} />
            },
            {
                title: "报告复盘",
                description: "把掌握情况、薄弱点和后续建议汇总成清晰报告。",
                icon: <FiBarChart2 size={26} />
            },
            {
                title: "反馈回写",
                description: "评估结果重新进入画像，推动下一轮路径与资源优化。",
                icon: <FiRefreshCw size={26} />
            }
        ],
        imageSrc: "/images/feature-report.png"
    },
];
