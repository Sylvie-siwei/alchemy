import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Alchemy — AI-Native Requirement Workspace",
  description: "AI 原生需求演化工作空间 · 合成数据与 Mock 分析演示",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><aside className="public-demo-notice">公开作品演示 · 全部预置数据为合成案例 · AI 建议由 Mock 生成 · 请勿输入真实业务或个人信息</aside>{children}</body></html>;
}
