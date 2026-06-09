import { IMenuItem, ISocials } from "@/types";

export const footerDetails: {
    subheading: string;
    quickLinks: IMenuItem[];
    email: string;
    telephone: string;
    socials: ISocials;
} = {
    subheading: "SparkLearn 通过学习画像、智能路径、内容生成和成果复盘，讲清楚产品能做什么。",
    quickLinks: [
        {
            text: "能力",
            url: "#features"
        },
        {
            text: "方案",
            url: "#pricing"
        },
        {
            text: "FAQ",
            url: "#faq"
        }
    ],
    email: 'hello@sparklearn.cn',
    telephone: '+86 000 0000 0000',
    socials: {
        // github: 'https://github.com',
        // x: 'https://twitter.com/x',
        twitter: 'https://twitter.com/Twitter',
        facebook: 'https://facebook.com',
        // youtube: 'https://youtube.com',
        linkedin: 'https://www.linkedin.com',
        // threads: 'https://www.threads.net',
        instagram: 'https://www.instagram.com',
    }
}
