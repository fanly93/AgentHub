"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteRun } from "@/lib/run-history/recorder"
import type { Run } from "@/lib/run-history/types"

interface RunListItemProps {
  run: Run
  isSelected: boolean
  onClick: () => void
  onDeleted: (id: number) => void
}

function StatusIcon({ status }: { status: Run["status"] }) {
  if (status === "success")
    return <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--success)" }} />
  if (status === "failed")
    return <XCircle className="h-4 w-4 shrink-0" style={{ color: "var(--destructive)" }} />
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--warning)" }} />
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function RunListItem({ run, isSelected, onClick, onDeleted }: RunListItemProps) {
  const [hovered, setHovered] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const tokens = run.totalTokens != null ? run.totalTokens.toLocaleString() : "—"
  const ts = new Date(run.createdAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  const handleDelete = async () => {
    try {
      await deleteRun(run.id!)
      onDeleted(run.id!)
    } catch (e) {
      console.error("[run-list] deleteRun failed", e)
    }
  }

  return (
    <>
      <div
        className={[
          "group relative flex items-start gap-3 border-b border-border px-4 py-3",
          "transition-colors",
          isSelected ? "bg-accent/60" : "hover:bg-accent/40",
        ].join(" ")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          onClick={onClick}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="mt-0.5">
            <StatusIcon status={run.status} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{run.source}</div>
            <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{run.promptSummary}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{ts}</span>
              <span>·</span>
              <span>{formatDuration(run.durationMs)}</span>
              <span>·</span>
              <span>{tokens} tokens</span>
            </div>
          </div>
        </button>

        {hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className={[
              "absolute right-3 top-1/2 -translate-y-1/2 rounded p-1",
              "text-muted-foreground transition-colors",
              "hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ].join(" ")}
            aria-label="删除此条记录"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除这条运行记录？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
