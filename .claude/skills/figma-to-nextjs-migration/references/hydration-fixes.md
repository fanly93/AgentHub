# hydration-fixes.md — Hydration Mismatch 修复模式

## 什么是 Hydration Mismatch

Next.js 会在服务端先渲染 HTML（SSR），然后在浏览器端"注水"（hydrate）接管。
如果两次渲染结果不一致，React 会抛 Hydration mismatch 警告，表现为：

```
Warning: Text content did not match.
  Server: "0.7234..."  Client: "0.1893..."
```

搬家后最常见的触发源是 `mock-data.ts` 里的 `Math.random()` 和 `Date.now()`。

## 修复方案：seededRandom 确定化

在 `src/lib/mock-data.ts` 顶部加入种子随机数函数，替换所有不确定值：

```ts
// [Prep-03] 修复 Hydration mismatch：确定化所有随机值
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}
const rand = seededRandom(42);
```

然后做两处替换：

**替换 1：`Math.random()` → `rand()`**
```ts
// 修改前
const rating = Math.random() * 5;
const downloads = Math.floor(Math.random() * 10000);

// 修改后
const rating = rand() * 5;
const downloads = Math.floor(rand() * 10000);
```

**替换 2：`Date.now()` → 固定时间戳**
```ts
// 修改前
const createdAt = new Date(Date.now() - Math.random() * 86400000 * 30);

// 修改后（1713600000000 = 2024-04-20 UTC，一个合理的固定基准）
const createdAt = new Date(1713600000000 - rand() * 86400000 * 30);
```

## 批量替换命令

```bash
cd src/lib

# 先加 seededRandom 函数到文件顶部（手动操作更安全）
# 再批量替换 Math.random()
sed -i '' 's/Math\.random()/rand()/g' mock-data.ts

# 替换 Date.now()（有上下文的建议手动处理）
grep -n "Date\.now()" mock-data.ts   # 先看看有几处
# 手动改成 1713600000000
```

## 验证修复效果

```bash
pnpm dev
# 打开浏览器，打开控制台（F12）
# 切换到 Console 标签
# 刷新页面，查看是否还有 "Warning: Text content did not match" 消息
# 如果控制台干净 = 修复成功
```

## 其他常见 Hydration 触发源

| 触发源 | 原因 | 修复方式 |
|--------|------|---------|
| `Math.random()` | 服务端/客户端各算一次，结果不同 | 用 `seededRandom` 替代 |
| `Date.now()` / `new Date()` | 时间戳在服务端和客户端不同 | 用固定时间戳替代，或移到 `useEffect` 里 |
| `localStorage` / `sessionStorage` | 服务端不存在这些 API | 移到 `useEffect` 里访问，或加 `typeof window !== 'undefined'` 守卫 |
| `window.innerWidth` | 服务端无窗口尺寸 | 移到 `useEffect` 里，或用 CSS media query 替代 |
| 第三方组件内部使用 `Math.random()` | 无法直接控制 | 给该组件所在文件加 `"use client"` + dynamic import with `ssr: false` |

## dynamic import 禁用 SSR（高级场景）

如果某个第三方组件根本无法在服务端渲染，用 dynamic import：

```tsx
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('./HeavyChart'), {
  ssr: false,           // 完全跳过服务端渲染
  loading: () => <div>加载中...</div>,
});
```

> **适用场景**：echarts / d3 / canvas 类库，这些库依赖浏览器 API，无法 SSR。
> AgentHub 的 `recharts` 一般不需要这样处理，正常加 "use client" 即可。
