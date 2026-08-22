import { ITestimonial } from "@/types";
import { siteDetails } from "./siteDetails";

export const testimonials: ITestimonial[] = [
    {
        name: '林老师',
        role: '高中班主任',
        message: `${siteDetails.siteName} 把学习画像和路径推荐放在一起，学生能很快知道自己接下来该做什么。`,
        avatar: '/images/testimonial-teacher-lin-front.webp',
    },
    {
        name: '王老师',
        role: '教研负责人',
        message: `它把内容生成、练习巩固和复盘报告串成完整闭环，能够更好地支持教师备课、课堂教学和课后辅导。`,
        avatar: '/images/testimonial-teacher-wang-front.webp',
    },
    {
        name: '陈同学',
        role: '高三学生',
        message: `${siteDetails.siteName} 的界面很直观，我能一眼看懂自己的薄弱点和下一步任务。`,
        avatar: '/images/testimonial-student-china.webp',
    },
];
