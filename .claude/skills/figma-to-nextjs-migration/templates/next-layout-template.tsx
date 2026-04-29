// 放置位置：src/app/layout.tsx
// 作用：覆盖 create-next-app 预装的默认 layout（Geist 字体 + 英文 metadata）
// 替换：整个文件内容替换（不保留原有任何内容）
// 前置条件：已复制 src/components/layout.tsx 并完成 NavLink 封装（Step 5a）

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Header, Footer } from "@/components/layout";
import "./globals.css";

// next/font/google 替代 @import Google Fonts 的理由：
// 1. 自动下载字体并内联到 build，避免运行时请求 Google 服务器（国内快 3-5 秒）
// 2. 生成稳定的 CSS 变量（--font-inter 等），避免 FOUT（无样式闪烁）
// 3. 自动 preload，首屏性能最优
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  display: "swap",
});

// 关于 Noto_Sans_SC（中文字体）：
// Next 16 + Turbopack 下 next/font/google 对 CJK 子集有 bug（build 报 module not found）
// 临时方案：中文走系统 fallback（macOS: PingFang SC / Windows: Microsoft YaHei）
// globals.css 里 --font-sans 已包含这些 fallback
// 待 Next.js 修复后，取消下方注释恢复 Noto_Sans_SC：
//
// import { Noto_Sans_SC } from "next/font/google";
// const notoSansSC = Noto_Sans_SC({
//   subsets: ["latin"],
//   variable: "--font-noto-sans-sc",
//   weight: ["400", "500", "600", "700"],
//   display: "swap",
// });
// 同时在 <html> className 里加 ${notoSansSC.variable}

export const metadata: Metadata = {
  title: "AgentHub · AI Agent 商店与 Playground",
  description: "下一代 AI Agent 构建、编排与分发平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-bg-base font-sans text-fg-default antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
