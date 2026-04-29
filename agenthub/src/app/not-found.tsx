import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-[48px] font-medium text-muted-foreground">404</div>
      <h1 className="mt-2" style={{ fontSize: 20 }}>页面不存在</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">你访问的页面已被移走，或者从未存在过。</p>
      <Button className="mt-6" asChild><Link href="/">回到首页</Link></Button>
    </div>
  );
}
