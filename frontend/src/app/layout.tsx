import type { Metadata } from "next";
import "./globals.css";
import { DownloadStatusProvider } from "@/components/providers/DownloadStatusProvider";
import { GenerationTaskProvider } from "@/components/providers/GenerationTaskProvider";

export const metadata: Metadata = {
  title: "SparkLearn - AI 驱动的个性化学习平台",
  description: "学而思 SparkLearn - 基于多 Agent 协作的智能自适应学习系统",
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
      <body className="min-h-full">
        <DownloadStatusProvider>
          <GenerationTaskProvider>{children}</GenerationTaskProvider>
        </DownloadStatusProvider>
      </body>
    </html>
  );
}
