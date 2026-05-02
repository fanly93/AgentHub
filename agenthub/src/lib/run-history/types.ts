export type RunStatus = "success" | "failed" | "interrupted"
export type SpanType = "thinking" | "tool-call" | "tool-result" | "answer"

export interface Run {
  id?: number
  source: string
  agentId: string | null
  model: string
  status: RunStatus
  prompt: string
  promptSummary: string
  answer: string
  totalTokens: number | null
  promptTokens: number | null
  completionTokens: number | null
  durationMs: number
  createdAt: number
}

export interface Span {
  id?: number
  runId: number
  spanType: SpanType
  toolName: string | null
  toolCallId: string | null
  input: string | null
  output: string | null
  error: string | null
  startedAt: number
  durationMs: number
  round: number
  order: number
}
