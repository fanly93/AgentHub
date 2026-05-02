"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import type { Span } from "@/lib/run-history/types"

const SPAN_COLORS: Record<Span["spanType"], string> = {
  thinking: "hsl(280, 70%, 60%)",
  "tool-call": "hsl(220, 90%, 60%)",
  "tool-result": "hsl(160, 70%, 50%)",
  answer: "hsl(38, 90%, 55%)",
}

const SPAN_LABELS: Record<Span["spanType"], string> = {
  thinking: "思考",
  "tool-call": "工具调用",
  "tool-result": "工具结果",
  answer: "回答",
}

function DurationBadge({ ms }: { ms: number }) {
  const style =
    ms < 200
      ? { color: "var(--success)" }
      : ms < 1000
      ? { color: "var(--warning)" }
      : { color: "var(--destructive)" }
  const label = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  return (
    <span className="ml-2 text-[11px] font-medium" style={style}>
      {label}
    </span>
  )
}

interface SpanRowProps {
  span: Span
  isSelected?: boolean
}

export function SpanRow({ span, isSelected }: SpanRowProps) {
  const [expanded, setExpanded] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const depth = span.spanType === "tool-call" || span.spanType === "tool-result" ? 1 : 0
  const color = SPAN_COLORS[span.spanType]
  const label = SPAN_LABELS[span.spanType]
  const hasDetail = !!(span.input || span.output || span.error)

  useEffect(() => {
    if (isSelected) {
      if (hasDetail) setExpanded(true)
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [isSelected]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rowRef} style={{ paddingLeft: depth * 24 }}>
      <button
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
        className={[
          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px]",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hasDetail ? "hover:bg-accent/40 active:bg-accent/60 cursor-pointer" : "cursor-default",
        ].join(" ")}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <span className="font-medium">{label}</span>
        {span.toolName && (
          <span className="text-muted-foreground">{span.toolName}</span>
        )}
        <DurationBadge ms={span.durationMs} />
        {hasDetail && (
          <span className="ml-auto text-muted-foreground">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </button>

      {expanded && hasDetail && (
        <div className="ml-4 mt-1 space-y-2 rounded border border-border bg-muted/30 p-3 text-[12px]">
          {span.input && (
            <div>
              <div className="mb-1 font-medium text-muted-foreground">输入</div>
              <pre className="whitespace-pre-wrap break-words">{span.input}</pre>
            </div>
          )}
          {span.output && (
            <div>
              <div className="mb-1 font-medium text-muted-foreground">输出</div>
              <pre className="whitespace-pre-wrap break-words">{span.output}</pre>
            </div>
          )}
          {span.error && (
            <div>
              <div className="mb-1 font-medium" style={{ color: "var(--destructive)" }}>错误</div>
              <pre className="whitespace-pre-wrap break-words" style={{ color: "var(--destructive)" }}>{span.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
