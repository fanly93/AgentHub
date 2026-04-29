---
name: figma-to-nextjs-migration
description: >
  把 Figma Make / v0.dev / Bolt / Lovable 等 UI 原型生成器产出的 Vite + React Router
  项目迁移（搬家）到 Next.js 15 App Router 脚手架。处理范围：8 步完整迁移流程——
  备份原项目、创建 Next.js 脚手架、样式系统合并（globals.css + theme.css 合并为
  单份 @theme）、字体切换（@import Google Fonts → next/font/google）、shadcn/ui
  组件库整体复用、布局层重构（Root/Outlet → layout.tsx + 自定义 NavLink）、7 个页面
  逐一搬运（react-router 文件路由 → Next.js App Router 文件路由）、批量替换
  react-router（Link to → Link href，useParams → next/navigation）、"use client"
  标注、Hydration mismatch 修复（Math.random 确定化）、git 基线固化（commit 防 reset 吞掉迁移成果）。

  只要用户提到以下任一场景，就应该主动加载此 Skill：
  - 提到工具名：Figma Make、v0.dev、Bolt、Lovable，且想迁移 / 搬家 / 换框架
  - 提到"Vite 项目换成 Next.js"、"React Router 搬 App Router"
  - 提到"跑流式 API / 服务端组件 / Edge Runtime / SSR"但当前是 Vite 项目
  - 提到"原型项目怎么部署"且技术栈是 React Router / Vite
  - 英文表达：migrate from Vite to Next.js、port React Router to App Router、
    convert v0.dev output to Next.js、move Bolt project to App Router

  不适用场景：Next.js → Remix / Next.js → Vite 的反向迁移、Pages Router → App Router
  的升级、或从零搭建 Next.js 项目（不涉及迁移）。
---

# figma-to-nextjs-migration — UI 原型到生产脚手架的工程化迁移

## 触发条件

收到以下信号时立即加载，无需用户明确要求：
- 提到 Figma Make / v0.dev / Bolt / Lovable 产出的项目 + 迁移意图
- 现有项目是 Vite + React Router，用户想接流式 API / SSR / 正式部署
- 用户说"搬家"、"换成 Next.js"、"React Router 搬 App Router"、"migrate to Next.js"

## 核心心智模型

Figma Make / v0.dev 是 **UI 原型生成器**，不是脚手架生成器。

| 维度 | 原型生成器的选择 | 为什么 |
|------|----------------|--------|
| 构建工具 | Vite（固定不可改） | 冷启动快，原型展示流畅 |
| 路由方案 | React Router v7 | 纯前端路由，无需服务端 |
| 后端架构 | 无 | 原型不考虑 API / 流式 / 服务端数据 |

这些选择对"出 UI 原型"是正确的——但需要流式 API、SSR、正式部署时必须搬家。**搬家不是返工，是工程化必经之路。**

**开工前必知的三个坑**：

1. **坑 1：create-next-app 预装了 3 个文件**——`src/app/page.tsx`、`src/app/layout.tsx`、
   `src/app/globals.css` 是脚手架自带的。Step 3 / Step 5 / Step 6 是**覆盖**它们，不是新建。
   漏覆盖 → 首页永远停在 Next.js 欢迎页。

2. **坑 2：Step 8 的 git commit 是终点线**——搬家对三个预装文件的修改还在 working tree。
   未 commit 就跑 `git reset --hard HEAD` = 修改全部打回默认，搬家功亏一篑。

3. **坑 3：`@latest` 可能拉到 Next.js 16**——Turbopack 下 Noto_Sans_SC 字体 build 有 bug。
   见 @references/common-errors.md 处理方案。

## 工作流（8 步）

### Step 1：备份原项目

```bash
bash .claude/skills/figma-to-nextjs-migration/scripts/backup.sh <源项目目录>
```

带时间戳备份，保留"设计参考底稿"。**永远不要修改备份目录。**

### Step 2：起 Next.js 脚手架

```bash
bash .claude/skills/figma-to-nextjs-migration/scripts/create-next-scaffold.sh <新项目名>
```

固定参数：`--typescript --tailwind --app --src-dir --no-eslint --no-turbopack --import-alias "@/*" --use-pnpm`

完成后进入新目录：`cd <新项目名> && pnpm dev`，能看到 Next.js 欢迎页即成功，Ctrl+C 停掉。

### Step 3：合并样式系统（⚠️ 覆盖预装文件）

**覆盖** `src/app/globals.css`（不是新建）。内容来自 @templates/globals-css-template.css，包含：
- `@import "tailwindcss"` + `@import "tw-animate-css"`
- `@custom-variant dark (&:is(.dark *))`
- 完整 `@theme`（颜色 / 字体 / 间距 / 圆角 token）

同时装全量 shadcn 依赖（从源项目 `package.json` 抄 dependencies，**必须 pin 版本**）：
```bash
# 关键版本锁定（@latest 会拉到不兼容版本）
pnpm add class-variance-authority@0.7.1 clsx@2 tailwind-merge@3.2.0 \
  tw-animate-css lucide-react@0.487.0 react-resizable-panels@2.1.7 \
  recharts@2.15.2 react-day-picker@8.10.1 sonner@2 date-fns@3
```

### Step 4：复制 shadcn/ui 组件库

```bash
# 路径用变量，SOURCE 是源项目目录，TARGET 是新项目目录
cp -r $SOURCE/src/app/components/ui    $TARGET/src/components/ui
cp    $SOURCE/src/app/lib/utils.ts     $TARGET/src/lib/utils.ts
cp -r $SOURCE/src/app/components/figma $TARGET/src/components/figma
```

检查误引用（如有则批量修正）：
```bash
grep -rn "@/app/lib/utils" $TARGET/src/components/ui
# 有命中则：find $TARGET/src/components/ui -name "*.tsx" -exec sed -i '' "s|@/app/lib/utils|@/lib/utils|g" {} +
```

### Step 5：重构 layout.tsx（⚠️ 覆盖预装文件）

1. 先复制源项目布局组件：
   ```bash
   cp $SOURCE/src/app/components/layout.tsx $TARGET/src/components/layout.tsx
   ```
2. 修改 `src/components/layout.tsx`：
   - 顶部加 `"use client"`（因为 `usePathname` 是 Client-only hook）
   - 替换 `import { NavLink, Link } from 'react-router'`
     → `import Link from 'next/link'` + `import { usePathname } from 'next/navigation'`
   - 添加本地 NavLink 封装（用 `usePathname()` 判断 active，见 @references/rr-to-next-mapping.md）
   - `<Link to="...">` 全部改为 `<Link href="...">`

3. **覆盖** `src/app/layout.tsx`（不是新建）。参考 @templates/next-layout-template.tsx，
   整合 next/font + Header/Footer。

### Step 6：搬 7 个页面（⚠️ Landing 覆盖预装文件）

路由映射完整对照见 @references/rr-to-next-mapping.md。

| 源文件 | 目标路径 | 说明 |
|--------|---------|------|
| `Landing.tsx` | `src/app/page.tsx` | ⚠️ **覆盖**预装文件，不要漏 |
| `Pricing.tsx` | `src/app/pricing/page.tsx` | 新建目录 |
| `Gallery.tsx` | `src/app/gallery/page.tsx` | 新建目录 |
| `AgentDetail.tsx` | `src/app/agent/[id]/page.tsx` | 动态路由，方括号是目录名 |
| `RunHistory.tsx` | `src/app/runs/page.tsx` | 新建目录 |
| `Settings.tsx` | `src/app/settings/page.tsx` | 新建目录 |
| `Pipeline.tsx` | `src/app/pipeline/page.tsx` | 新建目录 |

同时复制数据层：
```bash
cp $SOURCE/src/app/lib/mock-data.ts         $TARGET/src/lib/mock-data.ts
cp $SOURCE/src/app/lib/design-tokens.json   $TARGET/src/lib/
cp $SOURCE/src/app/lib/normalization-report.ts $TARGET/src/lib/
```

创建 `src/app/not-found.tsx`，内容来自 @templates/not-found-template.tsx。

### Step 7：批量替换 react-router + 修 "use client" + 修 Hydration

详细操作和完整命令见 @references/migration-steps.md。

**执行顺序**：

1. **加 "use client"**：判断规则见 @references/use-client-rules.md。
   需要标记的页面：Gallery / AgentDetail / RunHistory / Settings / Pipeline + layout.tsx

2. **批量替换 import**（对 7 个页面文件执行）：
   - 删除 `import { Link } from 'react-router'` / `import { useParams } from 'react-router'`
   - 加 `import Link from 'next/link'` / `import { useParams } from 'next/navigation'`
   - `<Link to="...">` → `<Link href="...">`
   - 相对路径 import → `@/` 绝对路径

3. **修 Hydration mismatch**：`Math.random()` / `Date.now()` → seededRandom，
   见 @references/hydration-fixes.md

4. **修死链**：`Landing.tsx` 里的 `/docs` 改为外部占位链接或 `href="#"`

遇到编译报错先查 @references/common-errors.md。

### Step 8：固化基线（⚠️ 不可跳过）

```bash
bash .claude/skills/figma-to-nextjs-migration/scripts/commit-baseline.sh
```

等价操作：`git add -A && git commit -m "migration complete: figma-make → next.js app router"`

**为什么必须做**：create-next-app 自动初始化 git 仓库（有一条 "Initial commit"），
但 Step 3/5/6 对预装文件的覆盖还在 working tree，未 commit 就 reset = 首页变欢迎页 +
样式 token 全丢 + 字体配置打回 Geist 默认。

## 关键决策规则

- **哪些文件要标 "use client"？** → @references/use-client-rules.md
- **React Router API 怎么换成 Next.js？** → @references/rr-to-next-mapping.md
- **遇到 Hydration warning？** → @references/hydration-fixes.md
- **遇到编译 / 运行报错？** → @references/common-errors.md
- **首页还是 Next.js 欢迎页？** → Step 6 漏覆盖 `page.tsx`，或 Step 8 没 commit
- **Gallery 里 Math.random() 怎么处理？** → 改成 `seededRandom(42)` 的 `rand()`，见 hydration-fixes.md

## 验收标准

运行验证脚本：
```bash
bash .claude/skills/figma-to-nextjs-migration/scripts/verify.sh
```

逐项确认：
- [ ] `pnpm dev` 无报错启动，`pnpm build` 无类型错误通过
- [ ] **首页 `/` 显示 Figma Make 的 Landing，不是 Next.js 欢迎页**（最容易被忽略的验收点）
- [ ] 7 个路由全部可访问（`/` `/pricing` `/gallery` `/agent/agent-1` `/runs` `/settings` `/pipeline`）
- [ ] 浏览器控制台无 Hydration mismatch 警告
- [ ] 顶部导航高亮当前活跃页
- [ ] `git log --oneline` 有一条 "migration complete" commit（Step 8 落地凭证）

## 反模式（主动规避）

- ❌ **不要在原 Vite 项目上直接加 Next.js 依赖硬改**——必须 `create-next-app` 起新项目
- ❌ **不要把 `@import` Google Fonts 留在 globals.css**——用 `next/font/google`，否则国内加载慢 3-5 秒且有 FOUT
- ❌ **不要在 Server Component 里用 `useState` / `useEffect`**——必须标 `"use client"`
- ❌ **不要把 `~/` 路径别名照搬**——统一改成 `@/`（create-next-app 的 `--import-alias "@/*"` 已配置）
- ❌ **不要跳过 Step 8 的 git commit**——这不是可选步骤，是搬家终点线
- ❌ **不要把 references 内容复制进页面代码**——遇到具体问题，先读 @references/ 对应文件再操作
- ❌ **不要用 `@latest` 装 pinned 依赖**——recharts / lucide-react / react-day-picker 等有重大 breaking change
