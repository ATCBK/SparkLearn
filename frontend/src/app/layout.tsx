import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SparkLearn - AI 驱动的个性化学习平台",
  description: "SparkLearn 是基于多 Agent 协作的智能自适应学习系统，连接画像、路径、资源、练习、反馈与报告。",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
    shortcut: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
