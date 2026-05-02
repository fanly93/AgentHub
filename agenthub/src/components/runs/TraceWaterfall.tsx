"use client"

import type { Span, Run } from "@/lib/run-history/types"

const BAR_HEIGHT = 24
const BAR_GAP = 8
const LABEL_WIDTH = 100
const TICK_COUNT = 4

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

function durationColor(ms: number): string {
  if (ms < 200) return "var(--success)"
  if (ms < 1000) return "var(--warning)"
  return "var(--destructive)"
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface TraceWaterfallProps {
  run: Run
  spans: Span[]
  selectedSpanId?: number
  onSpanClick?: (spanId: number) => void
}

export function TraceWaterfall({ run, spans, selectedSpanId, onSpanClick }: TraceWaterfallProps) {
  if (spans.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded border border-dashed border-border text-[12px] text-muted-foreground">
        无 span 数据
      </div>
    )
  }

  const totalMs = Math.max(run.durationMs, 1)
  const svgHeight = spans.length * (BAR_HEIGHT + BAR_GAP) + 24

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    Math.round((i / TICK_COUNT) * totalMs)
  )

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 400 }}>
        {/* 图例 */}
        <div className="mb-3 flex flex-wrap gap-3">
          {(Object.entries(SPAN_LABELS) as [Span["spanType"], string][]).map(([type, label]) => (
            <span key={type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: SPAN_COLORS[type] }} />
              {label}
            </span>
          ))}
        </div>

        {/* SVG 主体 */}
        <svg
          width="100%"
          height={svgHeight}
          className="overflow-visible"
          aria-label="Trace 瀑布图"
        >
          {/* 刻度线 */}
          {ticks.map((ms, i) => {
            const x = `${(i / TICK_COUNT) * 100}%`
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={svgHeight - 20}
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? undefined : "3 3"}
                />
                <text
                  x={x}
                  y={svgHeight - 4}
                  textAnchor={i === 0 ? "start" : i === TICK_COUNT ? "end" : "middle"}
                  fontSize={10}
                  fill="var(--muted-foreground)"
                >
                  {formatMs(ms)}
                </text>
              </g>
            )
          })}

          {/* span 条 */}
          {spans.map((span, i) => {
            const depth = span.spanType === "tool-call" || span.spanType === "tool-result" ? 1 : 0
            const y = i * (BAR_HEIGHT + BAR_GAP)
            const offsetMs = Math.max(0, span.startedAt - run.createdAt)
            const xPct = Math.min((offsetMs / totalMs) * 100, 99)
            const wPct = Math.max((span.durationMs / totalMs) * 100, 0.5)
            const barColor = SPAN_COLORS[span.spanType]
            const dColor = durationColor(span.durationMs)
            const isSelected = span.id != null && span.id === selectedSpanId

            return (
              <g
                key={span.id ?? i}
                onClick={() => span.id != null && onSpanClick?.(span.id)}
                style={{ cursor: onSpanClick ? "pointer" : "default" }}
              >
                {/* 背景轨道 */}
                <rect
                  x={`${depth * 2}%`}
                  y={y}
                  width="98%"
                  height={BAR_HEIGHT}
                  rx={3}
                  fill="var(--muted)"
                  opacity={0.4}
                />
                {/* 实际 bar */}
                <rect
                  x={`${xPct}%`}
                  y={y}
                  width={`${wPct}%`}
                  height={BAR_HEIGHT}
                  rx={3}
                  fill={barColor}
                  opacity={isSelected ? 1 : 0.85}
                />
                {/* 耗时点标记 */}
                <rect
                  x={`calc(${xPct + wPct}% - 3px)`}
                  y={y + 4}
                  width={3}
                  height={BAR_HEIGHT - 8}
                  rx={1}
                  fill={dColor}
                />
                {/* 选中高亮边框 */}
                {isSelected && (
                  <rect
                    x={`${depth * 2}%`}
                    y={y - 1}
                    width="98%"
                    height={BAR_HEIGHT + 2}
                    rx={3}
                    fill="none"
                    stroke="var(--ring)"
                    strokeWidth={2}
                  />
                )}
                {/* 标签 */}
                <text
                  x={`${xPct + 0.5}%`}
                  y={y + BAR_HEIGHT / 2 + 4}
                  fontSize={10}
                  fill="white"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {span.toolName ?? SPAN_LABELS[span.spanType]}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
