// [Prep-02] 修复 #3: Gallery 加载态骨架屏
export function AgentCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
        <div className="h-3 w-8 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2.5 w-full animate-pulse rounded bg-muted/70" />
        <div className="h-2.5 w-5/6 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-14 animate-pulse rounded bg-muted/70" />
        <div className="h-5 w-12 animate-pulse rounded bg-muted/70" />
        <div className="h-5 w-16 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="mt-4 flex justify-between border-t border-border pt-3">
        <div className="h-3 w-16 animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-12 animate-pulse rounded bg-muted/70" />
      </div>
    </div>
  );
}
