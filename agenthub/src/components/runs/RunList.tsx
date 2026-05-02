"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { RunListItem } from "./RunListItem"
import type { Run } from "@/lib/run-history/types"

interface RunListProps {
  runs: Run[]
  isLoading: boolean
  hasMore: boolean
  selectedId: number | null
  onSelect: (run: Run) => void
  onLoadMore: () => void
  onDeleted: (id: number) => void
  isFiltered?: boolean
}

export function RunList({ runs, isLoading, hasMore, selectedId, onSelect, onLoadMore, onDeleted, isFiltered }: RunListProps) {
  const router = useRouter()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore])

  if (isLoading && runs.length === 0) {
    return (
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-border px-4 py-3">
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!isLoading && runs.length === 0) {
    if (isFiltered) {
      return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-[14px] text-muted-foreground">没有符合条件的记录</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-[14px] text-muted-foreground">空空如也，先去 Playground 聊一次吧</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.push("/playground")}
        >
          打开 Playground
        </Button>
      </div>
    )
  }

  return (
    <div>
      {runs.map((run) => (
        <RunListItem
          key={run.id}
          run={run}
          isSelected={run.id === selectedId}
          onClick={() => onSelect(run)}
          onDeleted={onDeleted}
        />
      ))}
      <div ref={sentinelRef} className="h-4" />
      {isLoading && hasMore && (
        <div className="flex items-center justify-center py-3">
          <Skeleton className="h-3 w-24" />
        </div>
      )}
    </div>
  )
}
