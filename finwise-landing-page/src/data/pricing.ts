import { IPricing } from "@/types";

export const tiers: IPricing[] = [
    {
        name: '体验版',
        price: 29,
        features: [
            '学习画像与基础推荐',
            '体验学习路径与能力展示',
            '查看基础报告与结果页',
            '适合首次了解产品',
        ],
    },
    {
        name: '进阶版',
        price: 99,
        features: [
            'AI 生成内容与练习',
            '成长积分与激励机制',
            '更完整的报告和复盘',
            '适合高频学习用户',
        ],
    },
    {
        name: '机构版',
        price: '定制',
        features: [
            '班级与教师协同管理',
            '机构品牌与页面定制',
            '多角色权限与数据看板',
            '适合机构落地与商务合作',
        ],
    },
]
