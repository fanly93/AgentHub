"use client"

import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getDistinctModels } from "@/lib/run-history/recorder"
import type { RunFilter } from "@/hooks/useRunHistory"

interface FilterBarProps {
  onFilterChange: (filter: RunFilter) => void
}

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState<string>("all")
  const [model, setModel] = useState<string>("all")
  const [timeRange, setTimeRange] = useState<string>("all")

  useEffect(() => {
    getDistinctModels().then(setModels).catch(() => setModels([]))
  }, [])

  const handleChange = (
    field: "status" | "model" | "timeRange",
    value: string
  ) => {
    const next = {
      status: field === "status" ? value : status,
      model: field === "model" ? value : model,
      timeRange: field === "timeRange" ? value : timeRange,
    }
    if (field === "status") setStatus(value)
    if (field === "model") setModel(value)
    if (field === "timeRange") setTimeRange(value)

    const filter: RunFilter = {}
    if (next.status !== "all") filter.status = next.status as RunFilter["status"]
    if (next.model !== "all") filter.model = next.model
    if (next.timeRange !== "all") filter.timeRange = next.timeRange as RunFilter["timeRange"]
    onFilterChange(filter)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={status} onValueChange={(v) => handleChange("status", v)}>
        <SelectTrigger className="h-8 w-full text-[12px]">
          <SelectValue placeholder="状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem value="success">成功</SelectItem>
          <SelectItem value="failed">失败</SelectItem>
          <SelectItem value="interrupted">中断</SelectItem>
        </SelectContent>
      </Select>

      <Select value={model} onValueChange={(v) => handleChange("model", v)}>
        <SelectTrigger className="h-8 w-full text-[12px]">
          <SelectValue placeholder="模型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部模型</SelectItem>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={timeRange} onValueChange={(v) => handleChange("timeRange", v)}>
        <SelectTrigger className="h-8 w-full text-[12px]">
          <SelectValue placeholder="时间范围" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部时间</SelectItem>
          <SelectItem value="today">今天</SelectItem>
          <SelectItem value="7d">最近 7 天</SelectItem>
          <SelectItem value="30d">最近 30 天</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
