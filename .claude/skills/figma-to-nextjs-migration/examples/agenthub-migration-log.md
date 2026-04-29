# AgentHub 迁移成功案例（压缩版）

**迁移时间**：2024-04 / **迁移工具**：Figma Make → Next.js 15 App Router
**源项目**：`Start Project`（Vite + React Router v7 + Tailwind v4 + shadcn/ui）
**目标项目**：`agenthub`（Next.js 15 + App Router + 同款 UI 栈）

---

## 为什么搬家

Figma Make 产出的是纯前端 Vite 原型，无法接流式 API（服务端推送逐字显示 AI 回答）。
AgentHub 的核心功能是 AI Agent Playground，打字机效果必须用 Next.js 的 Route Handler 或 Server Actions 实现。

---

## 8 步执行记录

### Step 1：备份 + 起脚手架（5 分钟）

```bash
cp -r "Start Project" "Start Project.backup-20240420"

pnpm create next-app@latest agenthub \
  --typescript --tailwind --app --src-dir \
  --no-eslint --no-turbopack --import-alias "@/*" --use-pnpm

cd agenthub && pnpm dev  # 看到欢迎页 ✅，Ctrl+C 停掉
```

**踩坑**：`@latest` 拉到 Next 16，Noto_Sans_SC 字体 build 失败。
**处理**：移除 Noto_Sans_SC，中文走系统 fallback（PingFang SC），效果可接受。

### Step 2：合并样式系统（5 分钟）

**覆盖** `src/app/globals.css`（不是新建！脚手架预装版本只有极简 --background/--foreground）。

合并 `globals.css` + `theme.css` 的 `@theme`，删掉重复 token，统一单层写法。
用 `@import "tailwindcss"` 替代 `@import 'tailwindcss' source(none); @source ...`（Next.js 自动扫 src 目录）。

一次性装全 shadcn 依赖（从源项目 package.json 抄 dependencies，pin 版本）。
- `react-resizable-panels@4.x` → 降 `@2.1.7`（API 改了）
- `lucide-react@0.487.0`（不要装到 `@1.x`）
- `recharts@2.15.2`、`react-day-picker@8.10.1`、`sonner@2`

### Step 3：shadcn/ui 组件迁移（3 分钟）

```bash
cp -r "Start Project/src/app/components/ui"    agenthub/src/components/ui
cp    "Start Project/src/app/lib/utils.ts"     agenthub/src/lib/utils.ts
cp -r "Start Project/src/app/components/figma" agenthub/src/components/figma
```

检查 `@/app/lib/utils` 误引用 → 批量改为 `@/lib/utils`。

### Step 4：布局层重构（5 分钟）

```bash
cp "Start Project/src/app/components/layout.tsx" agenthub/src/components/layout.tsx
```

改 `layout.tsx`：
1. 顶部加 `"use client"`（NavLink 需要 usePathname）
2. 替换 `import { NavLink, Link } from 'react-router'` → `next/link` + `usePathname`
3. 加本地 NavLink 封装（`usePathname()` 判断 active）
4. `<Link to="...">` → `<Link href="...">`

**覆盖** `src/app/layout.tsx`（整合 next/font + Header/Footer）。
字体：`Inter` + `JetBrains_Mono`（各带 variable 注入到 `<html>` className）。

### Step 5：搬 7 个页面（10 分钟）

| 源文件 | 目标 | 说明 |
|--------|------|------|
| Landing.tsx | `src/app/page.tsx` | ⚠️ 覆盖预装文件！ |
| Pricing.tsx | `src/app/pricing/page.tsx` | |
| Gallery.tsx | `src/app/gallery/page.tsx` | |
| AgentDetail.tsx | `src/app/agent/[id]/page.tsx` | 动态路由 |
| RunHistory.tsx | `src/app/runs/page.tsx` | |
| Settings.tsx | `src/app/settings/page.tsx` | |
| Pipeline.tsx | `src/app/pipeline/page.tsx` | |

同时复制：`mock-data.ts` / `design-tokens.json` / `normalization-report.ts` → `src/lib/`
创建：`src/app/not-found.tsx`（404 页，显示"页面不见了"）

### Step 6：批量替换 react-router（10 分钟）

**批量加 "use client"**（Gallery / AgentDetail / RunHistory / Settings / Pipeline）：
```bash
for file in gallery/page.tsx "agent/[id]/page.tsx" runs/page.tsx settings/page.tsx pipeline/page.tsx; do
  printf '"use client";\n' | cat - "$file" > /tmp/_t && mv /tmp/_t "$file"
done
```

**批量替换 import**：用 AI 提示词一次性处理 7 个文件（详见 migration-steps.md §7b）。

**修 Hydration mismatch**：`mock-data.ts` 顶部加 seededRandom，替换所有 `Math.random()` 和 `Date.now()`。

**修 /docs 死链**：Landing 里的 `/docs` 改为 `href="#"`。

### Step 7：启动验证（5 分钟）

```bash
pnpm dev
```

逐页访问 7 个路由，目视检查：
- ✅ 首页显示 Figma Make 的 Landing（不是 Next.js 欢迎页）
- ✅ 控制台无 Hydration mismatch 警告
- ✅ 顶部导航高亮当前页
- ✅ Gallery 搜索/筛选生效
- ✅ AgentDetail Playground "发送"能触发打字机效果

### Step 8：固化基线（⚠️ 不可跳过，1 分钟）

```bash
git add -A
git commit -m "migration complete: figma-make starter → next.js 15 app router"
```

`git log --oneline` 第一行是 "migration complete" = 搬家完成。

---

## 关键教训

1. **Landing 覆盖预装文件是最容易漏的**——搬家后首页是欢迎页 = Step 6 漏了这一步
2. **Step 8 commit 是终点线**——没 commit 就 reset = 首页 + 样式全部打回脚手架默认
3. **pin 依赖版本**——`@latest` 对 react-resizable-panels / lucide-react / recharts 等有 breaking change
4. **Noto_Sans_SC 在 Next 16 暂时移除**——中文 fallback 效果已足够，等 Next.js 修 bug 后恢复

---

## 搬家结果

| 检查项 | 结果 |
|--------|------|
| `pnpm dev` 启动 | ✅ 无报错 |
| `pnpm build` | ✅ 无类型错误 |
| 7 个路由可访问 | ✅ 全部 200 |
| Hydration warning | ✅ 控制台干净 |
| git 基线 | ✅ "migration complete" commit 存在 |
| 下半场接流式 API | ✅ 已可开始 |
