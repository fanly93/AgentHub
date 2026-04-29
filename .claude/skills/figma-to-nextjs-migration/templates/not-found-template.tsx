// 放置位置：src/app/not-found.tsx
// 作用：替代 React Router 的 `{ path: "*", element: <NotFound /> }`
// 在 Next.js App Router 里，此文件名固定为 not-found.tsx，框架自动处理 404 路由
// 替换：新建文件（create-next-app 不预装，直接新建）

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-[48px] text-center">
      <h1 className="text-[30px] font-bold text-fg-default mb-[8px]">404</h1>
      <p className="text-[14px] text-fg-secondary mb-[24px]">页面不见了</p>
      <Button asChild>
        <Link href="/">回首页</Link>
      </Button>
    </div>
  );
}
