import { BsBarChartFill, BsFillStarFill } from "react-icons/bs";
import { PiGlobeFill } from "react-icons/pi";

import { IStats } from "@/types";

export const stats: IStats[] = [
    {
        title: "1000+",
        icon: <BsBarChartFill size={34} className="text-blue-500" />,
        description: "每日学习记录与结果汇总，帮助用户快速查看进展。"
    },
    {
        title: "4.9",
        icon: <BsFillStarFill size={34} className="text-yellow-500" />,
        description: "以清晰体验和稳定输出获得高满意度反馈。"
    },
    {
        title: "500+",
        icon: <PiGlobeFill size={34} className="text-green-600" />,
        description: "覆盖多场景学习需求，支持个人与机构协同使用。"
    }
];
