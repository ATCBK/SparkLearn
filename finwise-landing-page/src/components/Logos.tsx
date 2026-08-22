import { SiDiscord, SiGmail, SiSlack, SiTelegram, SiTencentqq, SiWechat } from "react-icons/si";
import type { IconType } from "react-icons";

type ImChannel = {
  name: string;
  color?: string;
  icon?: IconType;
  image?: string;
};

const imChannels: ImChannel[] = [
  { name: "飞书", image: "/images/im-channels/feishu.png" },
  { name: "钉钉", image: "/images/im-channels/dingtalk.ico" },
  { name: "Slack", icon: SiSlack, color: "#4A154B" },
  { name: "QQ", icon: SiTencentqq, color: "#12B7F5" },
  { name: "企业微信", image: "/images/im-channels/wecom.png" },
  { name: "微信", icon: SiWechat, color: "#07C160" },
  { name: "Telegram", icon: SiTelegram, color: "#26A5E4" },
  { name: "Discord", icon: SiDiscord, color: "#5865F2" },
  { name: "邮箱", icon: SiGmail, color: "#EA4335" },
];

const Logos: React.FC = () => {
  return (
    <section id="logos" className="bg-background px-5 py-16 md:py-20">
      <p className="text-center text-lg font-medium">
        已有 <span className="text-secondary">4 所高校</span>、
        <span className="text-secondary">500 多名学生</span>在使用 SparkLearn
      </p>
      <p className="mt-3 text-center text-base text-foreground/70">
        同时已接入 9 种主流 IM 渠道，覆盖教学通知、学习提醒与师生互动等多种教育场景。
      </p>
      <div className="mx-auto mt-8 grid w-full max-w-6xl grid-cols-2 items-center gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-9">
        {imChannels.map(({ name, image, icon: Icon, color }) => (
          <div
            key={name}
            className="flex h-14 items-center justify-center gap-2.5 text-[#2f3542]"
            aria-label={name}
          >
            {image ? (
              <img src={image} alt="" className="h-8 w-8 shrink-0 object-contain" />
            ) : (
              Icon && <Icon className="h-8 w-8 shrink-0" color={color} aria-hidden="true" />
            )}
            <span className="whitespace-nowrap text-xl font-semibold leading-none">{name}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Logos;
