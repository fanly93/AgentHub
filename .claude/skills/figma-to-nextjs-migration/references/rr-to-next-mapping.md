# rr-to-next-mapping.md — React Router ↔ Next.js App Router 对照表

## 路由结构对照

| React Router（当前） | Next.js App Router（目标） |
|---------------------|--------------------------|
| `src/app/App.tsx` + `RouterProvider` | 不存在（框架自动处理） |
| `routes.tsx` 的 `createBrowserRouter([...])` | 文件系统路由（`app/*/page.tsx`） |
| `{ index: true, element: <Landing /> }` | `app/page.tsx` |
| `{ path: "pricing", element: <Pricing /> }` | `app/pricing/page.tsx` |
| `{ path: "gallery", element: <Gallery /> }` | `app/gallery/page.tsx` |
| `{ path: "agent/:id", element: <AgentDetail /> }` | `app/agent/[id]/page.tsx` |
| `{ path: "runs", element: <RunHistory /> }` | `app/runs/page.tsx` |
| `{ path: "settings", element: <Settings /> }` | `app/settings/page.tsx` |
| `{ path: "pipeline", element: <Pipeline /> }` | `app/pipeline/page.tsx` |
| `{ path: "*", element: <NotFound /> }` | `app/not-found.tsx` |
| `Root` 组件（带 Header + Outlet） | `app/layout.tsx` |

## API 对照

| React Router API | Next.js 等价 |
|-----------------|-------------|
| `import { Link } from 'react-router'` | `import Link from 'next/link'` |
| `<Link to="/gallery">` | `<Link href="/gallery">` |
| `<Link to={`/agent/${id}`}>` | `<Link href={`/agent/${id}`}>` |
| `import { NavLink } from 'react-router'` | 自定义封装（见下方代码） |
| `import { useParams } from 'react-router'` | `import { useParams } from 'next/navigation'` |
| `const { id } = useParams()` | 同左（Next.js 13+ 签名兼容）；有 TS 报错改为 `useParams<{ id: string }>()` |
| `import { useNavigate } from 'react-router'` | `import { useRouter } from 'next/navigation'` |
| `navigate('/pricing')` | `router.push('/pricing')` |
| `import { useLocation } from 'react-router'` | `import { usePathname } from 'next/navigation'` |
| `location.pathname` | `pathname`（usePathname() 返回值） |

## 自定义 NavLink 封装

React Router 内置 NavLink（会自动加 active class），Next.js 没有。迁移时在 `src/components/layout.tsx` 里加这个封装：

```tsx
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

> **说明**：`href !== '/'` 这个判断是为了防止 `/` 在所有路由下都被标为 active。
> `pathname.startsWith(href)` 让 `/gallery` 在 `/gallery/detail` 时也高亮。

## 动态路由目录命名

```
React Router:  path: "agent/:id"
Next.js 目录:  src/app/agent/[id]/page.tsx
```

创建目录时方括号需转义（bash）：
```bash
mkdir -p src/app/agent/\[id\]
```

## 文件扔掉清单（不搬）

| 文件 | 原因 |
|------|------|
| `vite.config.ts` | Next.js 有自己的 `next.config.js` |
| `src/main.tsx` | Next.js 用 `app/layout.tsx` 替代 |
| `src/app/App.tsx` | Next.js 用文件路由替代 |
| `src/app/routes.tsx` | Next.js 用文件系统路由替代 |
| `fonts.css`（@import Google Fonts） | 换成 `next/font/google` |
| `figma-asset-resolver` vite 插件 | 代码里没用到 |
| 未使用的 npm 包（MUI / motion / canvas-confetti 等） | Figma Make 硬塞的，实际无引用 |
