import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { runs, traceNodes } from "../lib/mock-data";
import type { NavKey } from "../components/Layout";

const StatusIcon = ({ s }: { s: string }) => {
  if (s === "success") return <CheckCircle2 className="h-4 w-4 text-[hsl(160,70%,50%)]" />;
  if (s === "failed") return <XCircle className="h-4 w-4 text-[hsl(0,70%,60%)]" />;
  return <Loader2 className="h-4 w-4 animate-spin text-[hsl(38,90%,55%)]" />;
};

export function RunHistory({ onNav }: { onNav: (k: NavKey) => void }) {
  const [selectedId, setSelectedId] = useState(runs[0].id);
  const selected = runs.find((r) => r.id === selectedId)!;
  const total = traceNodes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);

  if (!runs.length) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-32 text-center">
        <div className="text-[14px] text-muted-foreground">还没有运行记录，去 Playground 跑一次？</div>
        <Button className="mt-4" onClick={() => onNav("detail")}>打开 Playground</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 style={{ fontSize: 24 }}>运行记录</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">查看每一次 Agent 的输入、输出与执行过程</p>

      {/* [Prep-02] 修复 #4: md 断点 sidebar 顶置并允许横向滚动 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-[13px] text-muted-foreground">最近 12 次</div>
          <ul className="max-h-[640px] overflow-y-auto lg:max-h-[640px]">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/40 ${
                    selectedId === r.id ? "bg-accent/60" : ""
                  }`}
                >
                  <StatusIcon s={r.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{r.agent}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{r.timestamp}</span>
                      <span>·</span>
                      <span>{r.duration}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Agent", selected.agent],
              ["状态", selected.status === "success" ? "成功" : selected.status === "failed" ? "失败" : "运行中"],
              ["耗时", selected.duration],
              ["成本", selected.cost],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[12px] text-muted-foreground">{k}</div>
                <div className="mt-1 text-[14px]">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-3 text-[13px] text-muted-foreground">Trace 瀑布图</div>
            <div className="space-y-2 rounded-md border border-border bg-background p-4">
              {traceNodes.map((n) => {
                const left = (n.start / total) * 100;
                const width = (n.duration / total) * 100;
                return (
                  <div key={n.id} className="flex items-center gap-3">
                    <div className="w-32 truncate text-[12px] text-muted-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{n.name}</div>
                    <div className="relative flex-1 h-6 rounded bg-muted">
                      <div
                        className="absolute top-0 h-6 rounded"
                        style={{ left: `${left}%`, width: `${width}%`, background: n.color }}
                        title={`${n.duration}ms`}
                      />
                    </div>
                    <div className="w-14 text-right text-[12px] text-muted-foreground">{n.duration}ms</div>
                  </div>
                );
              })}
              <div className="mt-2 flex items-center gap-4 pt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: 'hsl(220, 90%, 60%)' }} />router</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: 'hsl(280, 70%, 60%)' }} />llm</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: 'hsl(160, 70%, 50%)' }} />tool</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: 'hsl(38, 90%, 55%)' }} />output</span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="input" className="mt-6">
            {/* [Prep-02] 修复 #5: Tab 标签英文 → 中文 */}
            <TabsList>
              <TabsTrigger value="input">输入</TabsTrigger>
              <TabsTrigger value="output">输出</TabsTrigger>
              <TabsTrigger value="meta">元数据</TabsTrigger>
            </TabsList>
            <TabsContent value="input">
              <pre className="rounded-md border border-border bg-background p-4 text-[13px] whitespace-pre-wrap" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
{selected.input}
              </pre>
            </TabsContent>
            <TabsContent value="output">
              <pre className="rounded-md border border-border bg-background p-4 text-[13px] whitespace-pre-wrap" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
{selected.output}
              </pre>
            </TabsContent>
            <TabsContent value="meta">
              <pre className="rounded-md border border-border bg-background p-4 text-[12px]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
{`{
  "id": "${selected.id}",
  "model": "gpt-5",
  "tokens_in": 312,
  "tokens_out": 528,
  "latency_ms": 1560,
  "cache_hit": false,
  "tools_used": ["retriever.search", "calculator"]
}`}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
