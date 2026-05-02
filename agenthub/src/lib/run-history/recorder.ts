import { db } from "./db"
import type { Run, Span, RunStatus } from "./types"

const TRUNCATE_LIMIT = 10_000
const TRUNCATE_SUFFIX = "…内容已截断"

function truncate(text: string | null | undefined): string | null {
  if (text == null) return null
  if (text.length <= TRUNCATE_LIMIT) return text
  return text.slice(0, TRUNCATE_LIMIT) + TRUNCATE_SUFFIX
}

export async function saveRun(
  run: Omit<Run, "id">,
  spans: Omit<Span, "id" | "runId">[]
): Promise<number> {
  const summary = run.prompt.slice(0, 60)
  const prepared: Omit<Run, "id"> = {
    ...run,
    promptSummary: summary,
    answer: truncate(run.answer) ?? "",
  }

  return db.transaction("rw", db.runs, db.spans, async () => {
    const runId = await db.runs.add(prepared)
    if (spans.length > 0) {
      const spanRows: Omit<Span, "id">[] = spans.map((s) => ({
        ...s,
        runId,
        input: truncate(s.input),
        output: truncate(s.output),
      }))
      await db.spans.bulkAdd(spanRows)
    }
    return runId
  })
}

export async function listRuns(options?: {
  cursor?: number
  limit?: number
  filter?: {
    status?: RunStatus
    model?: string
    timeRange?: "today" | "7d" | "30d"
  }
}): Promise<{ runs: Run[]; nextCursor: number | null }> {
  const limit = Math.min(options?.limit ?? 50, 50)
  const filter = options?.filter

  let minCreatedAt: number | undefined
  if (filter?.timeRange) {
    const now = Date.now()
    if (filter.timeRange === "today") {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      minCreatedAt = d.getTime()
    } else if (filter.timeRange === "7d") {
      minCreatedAt = now - 7 * 24 * 60 * 60 * 1000
    } else if (filter.timeRange === "30d") {
      minCreatedAt = now - 30 * 24 * 60 * 60 * 1000
    }
  }

  let collection = db.runs.orderBy("id").reverse()

  if (options?.cursor != null) {
    collection = collection.filter((r) => (r.id ?? 0) < options.cursor!)
  }

  if (filter?.status) {
    const s = filter.status
    collection = collection.filter((r) => r.status === s)
  }

  if (filter?.model) {
    const m = filter.model
    collection = collection.filter((r) => r.model === m)
  }

  if (minCreatedAt != null) {
    const min = minCreatedAt
    collection = collection.filter((r) => r.createdAt >= min)
  }

  const rows = await collection.limit(limit + 1).toArray()
  const hasMore = rows.length > limit
  const runs = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? (runs[runs.length - 1].id ?? null) : null

  return { runs, nextCursor }
}

export async function getRun(id: number): Promise<Run | undefined> {
  return db.runs.get(id)
}

export async function getSpans(runId: number): Promise<Span[]> {
  return db.spans.where("[runId+order]").between([runId, 0], [runId, Infinity]).toArray()
}

export async function deleteRun(id: number): Promise<void> {
  await db.transaction("rw", db.runs, db.spans, async () => {
    await db.spans.where("runId").equals(id).delete()
    await db.runs.delete(id)
  })
}

export async function clearAllRuns(): Promise<void> {
  await db.transaction("rw", db.runs, db.spans, async () => {
    await db.spans.clear()
    await db.runs.clear()
  })
}

export async function getDistinctModels(): Promise<string[]> {
  const all = await db.runs.orderBy("model").uniqueKeys()
  return all as string[]
}
