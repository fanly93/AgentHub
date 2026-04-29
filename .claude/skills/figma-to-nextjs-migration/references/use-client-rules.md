# use-client-rules.md — "use client" 判定规则

## 核心规则

Next.js 15 App Router **默认所有组件都是服务端组件（Server Component）**。
文件里只要出现以下任一特性，**必须在文件第一行加 `"use client";`**：

| 特性类型 | 具体 API |
|---------|---------|
| React 状态 hooks | `useState` / `useReducer` / `useRef` / `useMemo` / `useCallback` |
| 副作用 hooks | `useEffect` / `useLayoutEffect` |
| 浏览器 API | `window` / `localStorage` / `sessionStorage` / `document` |
| 事件处理 | `onClick` / `onChange` / `onSubmit` / `onKeyDown` 等 |
| Next.js Client hooks | `useRouter` / `usePathname` / `useSearchParams` / `useParams` |
| 第三方 Client-only 库 | 任何使用了上述特性的库（如 `recharts`、`embla-carousel` 等） |

## 逐页判断表（AgentHub 项目）

| 页面 / 组件 | 需要 "use client" | 原因 |
|------------|:-----------------:|------|
| `app/page.tsx`（Landing） | ❌ 不需要 | 纯展示，无交互状态 |
| `app/pricing/page.tsx` | ❌ 不需要 | 纯展示，FAQ 展开可用原生 `<details>` |
| `app/gallery/page.tsx` | ✅ **需要** | `useState(searchTerm)` + `useEffect` |
| `app/agent/[id]/page.tsx` | ✅ **需要** | `useState(prompt, isGenerating, output)` + `useParams` |
| `app/runs/page.tsx` | ✅ **需要** | `useState` + `useEffect` |
| `app/settings/page.tsx` | ✅ **需要** | `useState(activeTab)` |
| `app/pipeline/page.tsx` | ✅ **需要** | `useState(selectedNode)` |
| `src/components/layout.tsx`（Header） | ✅ **需要** | `NavLink` 用了 `usePathname()` |
| `src/components/layout.tsx`（Footer） | 共享文件，跟 Header 一起标 | Footer 本身不需要，但和 Header 在同一文件 |

## 批量操作命令

```bash
cd src/app

for file in gallery/page.tsx "agent/[id]/page.tsx" runs/page.tsx settings/page.tsx pipeline/page.tsx; do
  if ! head -1 "$file" | grep -q '"use client"'; then
    printf '"use client";\n' | cat - "$file" > /tmp/_tmpfile && mv /tmp/_tmpfile "$file"
    echo "✅ $file"
  fi
done
```

## 常见误区

### ❌ 误区 1：整个路由都用 Server Component

有些页面大部分内容是静态的，只有一个按钮有交互——不要因为一个按钮就把整页标 "use client"。
正确做法：把交互部分拆成独立的 Client Component 子文件。

```
app/
  pricing/
    page.tsx           ← Server Component（无 "use client"）
    PricingToggle.tsx  ← "use client"（只有这个月付/年付切换按钮需要）
```

### ❌ 误区 2：以为加了 "use client" 就会性能差

"use client" 只是告诉框架"这个组件需要在浏览器运行"，不是说整棵树都发给客户端。
合理地把 Client Component 作为叶子节点使用，对性能影响极小。

### ✅ 正确判断流程

1. 检查文件里有没有 `useState` / `useEffect` / `onClick` 等
2. 有 → 加 `"use client"`
3. 没有 → 不加（保持 Server Component 默认）
4. 加完后 `pnpm build` 跑一遍，有报错说明漏了某个文件

## "use client" 的位置要求

必须是文件**绝对第一行**，在所有 import 之前：

```tsx
"use client";                    // ← 第一行，带分号
import { useState } from "react"; // ← import 在后面
import Link from "next/link";
...
```

错误示例（会被 Next.js 忽略）：
```tsx
import { useState } from "react"; // ❌ import 跑到前面去了
"use client";                     // ← 这里的指令无效
```
