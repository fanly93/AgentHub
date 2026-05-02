"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useRunHistory } from "@/hooks/useRunHistory"
import { clearAllRuns } from "@/lib/run-history/recorder"
import { RunList } from "@/components/runs/RunList"
import { RunDetail } from "@/components/runs/RunDetail"
import { FilterBar } from "@/components/runs/FilterBar"
import type { Run } from "@/lib/run-history/types"
import type { RunFilter } from "@/hooks/useRunHistory"

export default function RunHistoryPage() {
  const { runs, isLoading, hasMore, loadMore, refresh, updateFilter } = useRunHistory()
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [activeFilter, setActiveFilter] = useState<RunFilter>({})

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = (filter: RunFilter) => {
    setSelectedRun(null)
    setActiveFilter(filter)
    updateFilter(filter)
  }

  const isFiltered = Object.keys(activeFilter).length > 0

  const handleDeleted = (id: number) => {
    if (selectedRun?.id === id) setSelectedRun(null)
    refresh()
  }

  const handleClearAll = async () => {
    try {
      await clearAllRuns()
      setSelectedRun(null)
      refresh()
    } catch (e) {
      console.error("[runs-page] clearAllRuns failed", e)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">运行记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看每一次 Agent 的输入、输出与执行过程</p>
        </div>
        {runs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                清空全部
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清空所有记录</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将删除所有运行记录及其 Trace 数据，不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>清空全部</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-[13px] text-muted-foreground">
            运行历史
          </div>
          <div className="border-b border-border px-3 py-2">
            <FilterBar onFilterChange={handleFilterChange} />
          </div>
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <RunList
              runs={runs}
              isLoading={isLoading}
              hasMore={hasMore}
              selectedId={selectedRun?.id ?? null}
              onSelect={setSelectedRun}
              onLoadMore={loadMore}
              onDeleted={handleDeleted}
              isFiltered={isFiltered}
            />
          </div>
        </aside>

        <div className="overflow-y-auto rounded-lg border border-border bg-card p-6">
          {selectedRun ? (
            <RunDetail run={selectedRun} />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
              选择一条记录查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
