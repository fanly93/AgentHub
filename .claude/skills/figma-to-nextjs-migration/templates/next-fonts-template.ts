// 放置位置：此文件内容复制到 src/app/layout.tsx 的 import 区域
// 作用：替代 Figma Make 产出的 fonts.css 里的 @import Google Fonts
// 替换：删除 styles/fonts.css 里的所有 @import url('https://fonts.googleapis.com/...')
//       将下方内容粘贴到 layout.tsx 的 import 区（在 "import type { Metadata }" 之后）

// ────── 复制以下内容到 src/app/layout.tsx ──────

import { Inter, JetBrains_Mono } from "next/font/google";

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

// 用法：在 RootLayout 返回的 <html> 标签上加 className：
// <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable}`}>
//
// globals.css 里的 @theme 已经写好了对接：
//   --font-sans: var(--font-inter), "PingFang SC", "Microsoft YaHei", sans-serif;
//   --font-mono: var(--font-jetbrains-mono), monospace;
// 所以挂上 variable 之后，所有 font-sans / font-mono class 自动生效。

// ────── 关于 Noto_Sans_SC（中文字体）──────
// 理想情况下还应加载 Noto_Sans_SC 以获得最佳中文排版。
// 但 Next.js 16 + Turbopack 下有 build bug（module not found: noto_sans_sc_*.module.css）。
// 临时方案：中文走系统 fallback（macOS PingFang SC / Windows Microsoft YaHei）——
// globals.css 里 --font-sans 已包含这些 fallback，视觉效果可接受。
//
// 待 Next.js 修复后，恢复 Noto_Sans_SC：
// import { Inter, JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
// const notoSansSC = Noto_Sans_SC({
//   subsets: ["latin"],
//   variable: "--font-noto-sans-sc",
//   weight: ["400", "500", "600", "700"],
//   display: "swap",
// });
// 并在 <html> className 加 ${notoSansSC.variable}

export { inter, jetbrainsMono };
