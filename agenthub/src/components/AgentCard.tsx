import { Star, Zap } from "lucide-react";
import type { Agent } from "@/lib/mock-data";
import { Badge } from "./ui/badge";

export function AgentCard({ agent, onClick }: { agent: Agent; onClick?: () => void }) {
  return (
    // [Prep-02] 修复 #2: 卡片 hover 仅加深 border，不改背景、不加阴影、不放大
    <button
      onClick={onClick}
      className="group flex flex-col items-start rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-[hsl(220,15%,30%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex w-full items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[14px] text-foreground">{agent.name}</div>
            <div className="text-[12px] text-muted-foreground">{agent.author} · {agent.provider}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-current text-[hsl(38,90%,55%)]" />
          {agent.rating.toFixed(1)}
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">{agent.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {agent.capabilities.slice(0, 3).map((c) => (
          <Badge key={c} variant="secondary" className="text-[11px]">{c}</Badge>
        ))}
      </div>
      <div className="mt-4 flex w-full items-center justify-between border-t border-border pt-3">
        <span className="text-[12px] text-muted-foreground">{agent.runs.toLocaleString()} 次运行</span>
        <span className="text-[13px] text-foreground">{agent.price}</span>
      </div>
    </button>
  );
}
