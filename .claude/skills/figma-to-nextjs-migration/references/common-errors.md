# common-errors.md — 常见报错 & 修复方案

## 编译 / 运行时报错

| 报错信息 | 根本原因 | 修复方法 |
|---------|---------|---------|
| `Error: useState can only be used in a Client Component` | 页面顶部没加 `"use client"` | 在文件**第一行**加 `"use client";`（参考 use-client-rules.md） |
| `Module not found: Can't resolve 'react-router'` | 有 import 没换完 | 全局搜 `react-router`：`grep -rn "react-router" src/`，逐一替换为 `next/link` / `next/navigation` |
| `Property 'to' does not exist on type 'LinkProps'` | `<Link to="...">` 没换成 `<Link href="...">` | 全局替换：`find src -name "*.tsx" -exec sed -i '' 's/<Link to=/<Link href=/g' {} +` |
| `Hydration mismatch` 警告 | `mock-data.ts` 里有 `Math.random()` / `Date.now()` | 参考 hydration-fixes.md，用 `seededRandom(42)` 替代 |
| `Error: Nesting of 'html' is not allowed` | layout.tsx 里有多余的 `<html>` 嵌套 | 检查是否误把 HTML 模板塞进了组件 |
| `Module not found: Can't resolve '@/lib/utils'` | `utils.ts` 还没复制或路径不对 | `cp $SOURCE/src/app/lib/utils.ts src/lib/utils.ts` |
| `PanelGroup is not exported from 'react-resizable-panels'` | 装了 `react-resizable-panels@4.x`（API 变了） | `pnpm add react-resizable-panels@2.1.7` 重新 pin |
| `recharts` 类型报错 | 装了 `recharts@3.x` | `pnpm add recharts@2.15.2` |
| `lucide-react: 找不到某图标` | 装了 `lucide-react@1.x`（另一个包） | `pnpm add lucide-react@0.487.0` |

## 样式相关

| 现象 | 原因 | 修复 |
|------|------|------|
| 字体显示宋体 / 系统默认字体 | `<html>` 上没挂 font variable | 检查 `layout.tsx` 的 `className={...}` 是否包含 `inter.variable` 和 `jetbrainsMono.variable` |
| shadcn 组件动画不生效 | `globals.css` 里缺 `@import "tw-animate-css"` | 在 `globals.css` 第二行加 `@import "tw-animate-css";` |
| `bg-bg-base` / `text-fg-default` / `bg-status-warning` 等 class 不生效 | `globals.css` 里 `@theme` token 没迁移过来 | 用 templates/globals-css-template.css 完整覆盖 `src/app/globals.css` |
| 所有颜色变白灰（变回 Next.js 默认） | Step 8 没 commit，后来跑了 `git reset --hard` | 重新执行 Step 3，然后**立刻** `git commit`，参考 commit-baseline.sh |
| 首页显示 Next.js 欢迎页 | Landing.tsx 没有覆盖 `src/app/page.tsx` | `cp $SOURCE/src/app/pages/Landing.tsx src/app/page.tsx`，然后 commit |

## Next.js 16 / Turbopack 兼容问题

| 问题 | 场景 | 处理方案 |
|------|------|---------|
| `build error: module not found: noto_sans_sc_*.module.css` | `@latest` 拉到 Next 16，`next/font/google` 对 Noto_Sans_SC CJK 子集有 bug | 临时移除 `Noto_Sans_SC` import，中文走系统 fallback（PingFang SC / Microsoft YaHei）；在 `--font-sans` 里补全 fallback 列表 |
| shadcn 某些组件样式不对（Turbopack） | 用了 `--no-turbopack` 但仍有问题 | 确认 `package.json` 的 `"dev"` 脚本没有 `--turbo` flag；或显式 pin Next.js 版本：`pnpm create next-app@15.5` |

## 路由相关

| 现象 | 原因 | 修复 |
|------|------|------|
| `/agent/agent-1` 返回 404 | `[id]` 目录的方括号没有正确创建 | 检查目录名是否是字面量 `[id]`，不是 `id`；bash 里需要转义：`mkdir -p src/app/agent/\[id\]` |
| 所有后台页（/runs /settings /pipeline）导航高亮不对 | NavLink 封装的 `startsWith` 逻辑问题 | 检查 NavLink 的 `isActive` 计算，`/` 路由要用 `pathname === href` 而不是 `startsWith` |
| `useParams()` 返回的 `id` 是 `undefined` | 在 Server Component 里用了 `useParams` | 页面顶部加 `"use client"`；或改为从 props 读 `params`：`{ params }: { params: { id: string } }` |

## git 相关

| 现象 | 原因 | 修复 |
|------|------|------|
| `git reset --hard` 后首页变欢迎页 | Step 8 没有 commit，`page.tsx` 还在 working tree | 永远先 commit 再 reset；或从备份 `.backup-xxx` 里重新复制 |
| `git log --oneline` 只有一条 "Initial commit from Create Next App" | Step 8 的 commit 没做 | 运行 `commit-baseline.sh` 或手动 `git add -A && git commit` |
