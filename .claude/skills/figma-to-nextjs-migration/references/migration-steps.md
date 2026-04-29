# migration-steps.md — 8 步迁移完整命令参考

> 本文件是 SKILL.md 工作流的详细展开，包含实际可执行命令。
> `$SOURCE` = 源项目目录（Figma Make / v0.dev 产出）
> `$TARGET` = 新 Next.js 项目目录

---

## Step 1：备份原项目

```bash
cp -r "$SOURCE" "${SOURCE}.backup-$(date +%Y%m%d%H%M%S)"
```

备份目录保持只读参考，不做任何修改。

---

## Step 2：起 Next.js 脚手架

```bash
cd "$(dirname $TARGET)"

pnpm create next-app@latest "$(basename $TARGET)" \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --no-turbopack \
  --import-alias "@/*" \
  --use-pnpm

cd "$(basename $TARGET)"
pnpm dev   # 验证欢迎页出现后 Ctrl+C 停掉
```

> **版本说明**：`@latest` 在 2026 年可能拉到 Next 16。功能上 App Router 兼容，
> 但 Turbopack 下 Noto_Sans_SC 字体 build 有 bug（见 common-errors.md）。
> 要严格对齐 15 可显式 pin：`pnpm create next-app@15.5 ...`

---

## Step 3：样式系统迁移

### 3a. 覆盖 globals.css（⚠️ 不是新建）

```bash
cp .claude/skills/figma-to-nextjs-migration/templates/globals-css-template.css \
   src/app/globals.css
```

### 3b. 安装全量 shadcn 依赖（pin 版本）

```bash
pnpm add \
  @radix-ui/react-accordion @radix-ui/react-alert-dialog \
  @radix-ui/react-aspect-ratio @radix-ui/react-avatar \
  @radix-ui/react-checkbox @radix-ui/react-collapsible \
  @radix-ui/react-context-menu @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu @radix-ui/react-hover-card \
  @radix-ui/react-label @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu @radix-ui/react-popover \
  @radix-ui/react-progress @radix-ui/react-radio-group \
  @radix-ui/react-scroll-area @radix-ui/react-select \
  @radix-ui/react-separator @radix-ui/react-slider \
  @radix-ui/react-slot @radix-ui/react-switch \
  @radix-ui/react-tabs @radix-ui/react-toggle-group \
  @radix-ui/react-toggle @radix-ui/react-tooltip

pnpm add \
  class-variance-authority@0.7.1 clsx@2 tailwind-merge@3.2.0 \
  tw-animate-css cmdk date-fns@3 lucide-react@0.487.0 \
  react-day-picker@8.10.1 react-hook-form react-resizable-panels@2.1.7 \
  recharts@2.15.2 sonner@2 embla-carousel-react input-otp vaul next-themes@0.4.6
```

> **为什么 pin 版本**：`react-resizable-panels@4.x` 改了 API、`lucide-react@1.x` 换了包名、
> `recharts@3.x` 类型不兼容、`react-day-picker@9.x` 签名变了、`sonner@1`/`2` 导出不同。
> 直接把源项目 `package.json` 的 dependencies 整段复制到新项目再 `pnpm install` 最省事。

---

## Step 4：shadcn/ui 组件库复制

```bash
cp -r $SOURCE/src/app/components/ui     $TARGET/src/components/ui
cp    $SOURCE/src/app/lib/utils.ts      $TARGET/src/lib/utils.ts
mkdir -p $TARGET/src/components/figma
cp    $SOURCE/src/app/components/figma/ImageWithFallback.tsx \
      $TARGET/src/components/figma/ImageWithFallback.tsx

# 检查并修正错误的 import 路径
grep -rn "@/app/lib/utils" $TARGET/src/components/ui && \
  find $TARGET/src/components/ui -name "*.tsx" \
    -exec sed -i '' "s|@/app/lib/utils|@/lib/utils|g" {} +
```

---

## Step 5：布局层重构

### 5a. 复制并修改 layout.tsx 组件

```bash
cp $SOURCE/src/app/components/layout.tsx $TARGET/src/components/layout.tsx
```

手动编辑 `src/components/layout.tsx`，做 3 处变更：

**变更 1**：顶部加 `"use client"` 并替换 import：
```diff
+ "use client";
- import { NavLink, Link } from 'react-router';
+ import Link from 'next/link';
+ import { usePathname } from 'next/navigation';
  import { cn } from '@/lib/utils';
```

**变更 2**：在同一文件加本地 NavLink 封装：
```tsx
function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: (args: { isActive: boolean }) => string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link href={href} className={className ? className({ isActive }) : ''}>
      {children}
    </Link>
  );
}
```

**变更 3**：批量替换 `to=` → `href=`：
```bash
sed -i '' 's|<Link to=|<Link href=|g' $TARGET/src/components/layout.tsx
sed -i '' 's|<NavLink\([^>]*\)to=|<NavLink\1href=|g' $TARGET/src/components/layout.tsx
```

### 5b. 覆盖 src/app/layout.tsx（⚠️ 不是新建）

```bash
cp .claude/skills/figma-to-nextjs-migration/templates/next-layout-template.tsx \
   $TARGET/src/app/layout.tsx
```

---

## Step 6：页面层迁移

### 6a. 复制 7 个页面

```bash
# Landing → 覆盖预装文件（⚠️ 不是新建）
cp $SOURCE/src/app/pages/Landing.tsx    $TARGET/src/app/page.tsx

# 其余 6 页创建新目录
mkdir -p $TARGET/src/app/pricing   && cp $SOURCE/src/app/pages/Pricing.tsx    $TARGET/src/app/pricing/page.tsx
mkdir -p $TARGET/src/app/gallery   && cp $SOURCE/src/app/pages/Gallery.tsx    $TARGET/src/app/gallery/page.tsx
mkdir -p $TARGET/src/app/agent/\[id\] && cp $SOURCE/src/app/pages/AgentDetail.tsx $TARGET/src/app/agent/\[id\]/page.tsx
mkdir -p $TARGET/src/app/runs      && cp $SOURCE/src/app/pages/RunHistory.tsx  $TARGET/src/app/runs/page.tsx
mkdir -p $TARGET/src/app/settings  && cp $SOURCE/src/app/pages/Settings.tsx   $TARGET/src/app/settings/page.tsx
mkdir -p $TARGET/src/app/pipeline  && cp $SOURCE/src/app/pages/Pipeline.tsx   $TARGET/src/app/pipeline/page.tsx
```

### 6b. 复制数据层

```bash
cp $SOURCE/src/app/lib/mock-data.ts           $TARGET/src/lib/mock-data.ts
cp $SOURCE/src/app/lib/design-tokens.json     $TARGET/src/lib/
cp $SOURCE/src/app/lib/normalization-report.ts $TARGET/src/lib/
```

### 6c. 创建 not-found.tsx

```bash
cp .claude/skills/figma-to-nextjs-migration/templates/not-found-template.tsx \
   $TARGET/src/app/not-found.tsx
```

---

## Step 7：批量替换 react-router + 修 "use client" + 修 Hydration

### 7a. 批量加 "use client"

```bash
cd $TARGET/src/app

for file in gallery/page.tsx agent/\[id\]/page.tsx runs/page.tsx settings/page.tsx pipeline/page.tsx; do
  if ! head -1 "$file" | grep -q '"use client"'; then
    printf '"use client";\n' | cat - "$file" > /tmp/_tmpfile && mv /tmp/_tmpfile "$file"
    echo "✅ 加了 use client: $file"
  fi
done
```

> Landing.tsx 和 Pricing.tsx 是纯展示，不需要 "use client"。

### 7b. 批量替换 react-router import

```bash
cd $TARGET

# 替换 import 语句
find src/app -name "*.tsx" -exec sed -i '' \
  "s|import { Link } from 'react-router'||g" {} +
find src/app -name "*.tsx" -exec sed -i '' \
  "s|import { useParams } from 'react-router'||g" {} +
find src/app -name "*.tsx" -exec sed -i '' \
  "s|import { Link, useParams } from 'react-router'||g" {} +

# 替换 JSX 属性
find src/app -name "*.tsx" -exec sed -i '' \
  "s|<Link to=|<Link href=|g" {} +
```

> 对每个文件手动补全正确的 import（用到 Link 的加 `import Link from 'next/link'`，
> 用到 useParams 的加 `import { useParams } from 'next/navigation'`）。

### 7c. 替换相对路径 import

```bash
find src/app -name "*.tsx" -exec sed -i '' \
  "s|from '\.\./components/ui/|from '@/components/ui/|g" {} +
find src/app -name "*.tsx" -exec sed -i '' \
  "s|from '\.\./lib/|from '@/lib/|g" {} +
find src/app -name "*.tsx" -exec sed -i '' \
  "s|from '\.\./components/figma/|from '@/components/figma/|g" {} +
```

### 7d. 修 Hydration mismatch

见 hydration-fixes.md——在 `src/lib/mock-data.ts` 顶部加 seededRandom，替换 Math.random()。

### 7e. 修 Landing 的 /docs 死链

```bash
sed -i '' 's|<Link to="/docs">|<Link href="#"|g' $TARGET/src/app/page.tsx
# 或改为外部链接：href="https://docs.example.com"
```

---

## Step 8：固化基线（终点线）

```bash
cd $TARGET
git add -A
git commit -m "migration complete: figma-make starter → next.js 15 app router"
```

脚本版：`bash .claude/skills/figma-to-nextjs-migration/scripts/commit-baseline.sh`

> 搬家完成的标志：`git log --oneline` 第一行是 "migration complete"。
