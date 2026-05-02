"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { TraceWaterfall } from "./TraceWaterfall"
import { SpanRow } from "./SpanRow"
import { getSpans } from "@/lib/run-history/recorder"
import type { Run, Span } from "@/lib/run-history/types"

function StatusBadge({ status }: { status: Run["status"] }) {
  if (status === "success")
    return (
      <span className="flex items-center gap-1 text-[13px]" style={{ color: "var(--success)" }}>
        <CheckCircle2 className="h-3.5 w-3.5" /> 成功
      </span>
    )
  if (status === "failed")
    return (
      <span className="flex items-center gap-1 text-[13px]" style={{ color: "var(--destructive)" }}>
        <XCircle className="h-3.5 w-3.5" /> 失败
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-[13px]" style={{ color: "var(--warning)" }}>
      <Loader2 className="h-3.5 w-3.5" /> 中断
    </span>
  )
}

function formatDuration(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

interface RunDetailProps {
  run: Run
}

export function RunDetail({ run }: RunDetailProps) {
  const [spans, setSpans] = useState<Span[]>([])
  const [spansLoading, setSpansLoading] = useState(true)
  const [selectedSpanId, setSelectedSpanId] = useState<number | null>(null)

  useEffect(() => {
    setSpansLoading(true)
    setSelectedSpanId(null)
    getSpans(run.id!)
      .then(setSpans)
      .catch(() => setSpans([]))
      .finally(() => setSpansLoading(false))
  }, [run.id])

  const metaItems = [
    { label: "来源", value: run.source },
    { label: "状态", value: <StatusBadge status={run.status} /> },
    { label: "耗时", value: formatDuration(run.durationMs) },
    { label: "模型", value: run.model },
  ]

  return (
    <div className="flex h-full flex-col gap-6">
      {/* 顶部元数据 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metaItems.map(({ label, value }) => (
          <div key={label}>
            <div className="text-[12px] text-muted-foreground">{label}</div>
            <div className="mt-1 text-[14px]">{value}</div>
          </div>
        ))}
      </div>

      {/* 瀑布图区域 */}
      <div>
        <div className="mb-2 text-[13px] text-muted-foreground">Trace 瀑布图</div>
        {spansLoading ? (
          <div className="space-y-2 rounded-md border border-border bg-background p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-background p-4">
            <TraceWaterfall
              run={run}
              spans={spans}
              selectedSpanId={selectedSpanId ?? undefined}
              onSpanClick={(id) => setSelectedSpanId(id === selectedSpanId ? null : id)}
            />
          </div>
        )}
      </div>

      {/* Span 列表（可展开） */}
      {!spansLoading && spans.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] text-muted-foreground">执行步骤</div>
          <div className="rounded-md border border-border bg-background p-2">
            {spans.map((span) => (
              <SpanRow key={span.id} span={span} isSelected={span.id === selectedSpanId} />
            ))}
          </div>
        </div>
      )}

      {/* 三 Tab 面板 */}
      <Tabs defaultValue="input" className="flex-1">
        <TabsList>
          <TabsTrigger value="input">输入</TabsTrigger>
          <TabsTrigger value="output">输出</TabsTrigger>
          <TabsTrigger value="meta">元数据</TabsTrigger>
        </TabsList>

        <TabsContent value="input">
          {spansLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-4 text-[13px]">
              {run.prompt}
            </pre>
          )}
        </TabsContent>

        <TabsContent value="output">
          {spansLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-4 text-[13px]">
              {run.answer || "（无输出）"}
            </pre>
          )}
        </TabsContent>

        <TabsContent value="meta">
          <div className="rounded-md border border-border bg-background p-4">
            <div className="grid grid-cols-2 gap-y-3 text-[13px] md:grid-cols-3">
              {[
                ["模型", run.model],
                ["输入 Tokens", run.promptTokens?.toLocaleString() ?? "—"],
                ["输出 Tokens", run.completionTokens?.toLocaleString() ?? "—"],
                ["总 Tokens", run.totalTokens?.toLocaleString() ?? "—"],
                ["总耗时", formatDuration(run.durationMs)],
                ["来源", run.source],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className="mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
