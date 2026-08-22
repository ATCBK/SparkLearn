import { IMenuItem, ISocials } from "@/types";

export const footerDetails: {
    subheading: string;
    quickLinks: IMenuItem[];
    email: string;
    telephone: string;
    socials: ISocials;
} = {
    subheading: "SparkLearn 通过学习画像、智能路径、内容生成和成果复盘，帮助用户构建个性化学习闭环，成为更懂你的 AI。",
    quickLinks: [
        {
            text: "能力",
            url: "#features"
        },
        {
            text: "视频",
            url: "#cta"
        },
        {
            text: "FAQ",
            url: "#faq"
        }
    ],
    email: '3211840032@qq.com',
    telephone: '16692815920',
    socials: {}
}
