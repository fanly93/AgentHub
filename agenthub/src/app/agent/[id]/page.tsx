"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { agents } from "@/lib/mock-data";
import { AgentCard } from "@/components/AgentCard";
import { GeneralAgentPanel } from "@/components/agent-detail/GeneralAgentPanel";
import { DeepResearchPanel } from "@/components/agent-detail/DeepResearchPanel";
import { SimpleAgentPanel } from "@/components/agent-detail/SimpleAgentPanel";

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const agent = agents.find((a) => a.id === id) ?? agents[0];
  const similar = agents.filter((a) => a.id !== agent.id).slice(0, 4);

  const agentType = agent.agentType ?? "simple";

  let PlaygroundPanel: React.ReactNode;
  if (agentType === "general") {
    PlaygroundPanel = <GeneralAgentPanel agent={agent} />;
  } else if (agentType === "deepresearch") {
    PlaygroundPanel = <DeepResearchPanel agent={agent} />;
  } else {
    PlaygroundPanel = <SimpleAgentPanel agent={agent} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <button onClick={() => router.push("/gallery")} className="hover:text-foreground">商店</button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{agent.category}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{agent.name}</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[40%_1fr]">
        {/* 左侧：Agent 信息 */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/15 text-2xl">
              {agent.emoji ?? <Zap className="h-7 w-7 text-primary" />}
            </div>
            <div className="flex-1">
              <h1 style={{ fontSize: 20 }}>{agent.name}</h1>
              <div className="mt-1 text-[13px] text-muted-foreground">
                由 {agent.author} 维护 · 基于 {agent.provider}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[13px]">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-current text-[hsl(38,90%,55%)]" />
                  {agent.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">{agent.runs.toLocaleString()} 次运行</span>
                <span className="text-foreground">{agent.price}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {agent.capabilities.map((c) => (
              <Badge key={c} variant="secondary" className="text-[12px]">{c}</Badge>
            ))}
          </div>

          <h3 className="mt-6" style={{ fontSize: 14 }}>简介</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {agent.description}
          </p>

          <Button className="mt-6 w-full">
            <Plus className="mr-1 h-4 w-4" />添加到我的 Agent
          </Button>
        </div>

        {/* 右侧：Playground 面板 */}
        <div className="flex min-h-[600px] flex-col rounded-lg border border-border bg-card p-4">
          {PlaygroundPanel}
        </div>
      </div>

      <div className="mt-12">
        <h2 style={{ fontSize: 18 }}>相似 Agent</h2>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {similar.map((a) => (
            <div key={a.id} className="min-w-[280px] flex-1">
              <AgentCard agent={a} onClick={() => router.push(`/agent/${a.id}`)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
