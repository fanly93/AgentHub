"use client"

import { useState, useCallback, useRef } from "react"
import { listRuns } from "@/lib/run-history/recorder"
import type { Run, RunStatus } from "@/lib/run-history/types"

export interface RunFilter {
  status?: RunStatus
  model?: string
  timeRange?: "today" | "7d" | "30d"
}

export function useRunHistory(initialFilter?: RunFilter) {
  const [runs, setRuns] = useState<Run[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const cursorRef = useRef<number | null>(null)
  const filterRef = useRef<RunFilter | undefined>(initialFilter)

  const load = useCallback(async (filter?: RunFilter, cursor?: number) => {
    setIsLoading(true)
    try {
      const result = await listRuns({ cursor, limit: 50, filter })
      if (cursor == null) {
        setRuns(result.runs)
      } else {
        setRuns((prev) => [...prev, ...result.runs])
      }
      cursorRef.current = result.nextCursor
      setHasMore(result.nextCursor !== null)
    } catch (e) {
      console.error("[useRunHistory] load failed", e)
      if (cursor == null) setRuns([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refresh = useCallback(() => {
    cursorRef.current = null
    load(filterRef.current, undefined)
  }, [load])

  const loadMore = useCallback(async () => {
    if (cursorRef.current == null) return
    await load(filterRef.current, cursorRef.current)
  }, [load])

  const updateFilter = useCallback(
    (filter: RunFilter | undefined) => {
      filterRef.current = filter
      cursorRef.current = null
      load(filter, undefined)
    },
    [load]
  )

  return { runs, isLoading, hasMore, loadMore, refresh, updateFilter }
}
