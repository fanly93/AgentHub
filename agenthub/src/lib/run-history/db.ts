import Dexie, { type Table } from "dexie"
import type { Run, Span } from "./types"

class RunHistoryDB extends Dexie {
  runs!: Table<Run, number>
  spans!: Table<Span, number>

  constructor() {
    super("run-history")
    this.version(1).stores({
      runs: "++id, createdAt, status, model, [status+createdAt], [model+createdAt]",
      spans: "++id, runId, [runId+order]",
    })
  }
}

export const db = new RunHistoryDB()
