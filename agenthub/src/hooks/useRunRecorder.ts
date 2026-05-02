"use client"

import { useRef, useCallback } from "react"
import { saveRun } from "@/lib/run-history/recorder"
import type { RunStatus, Span } from "@/lib/run-history/types"
import type { AgentExecutionState } from "@/hooks/useAgentStream"
import type { PlaygroundResponse } from "@/shared/schemas/playgroundResponse"
import type { DeepPartial } from "@/hooks/useStructuredStream"

function buildAgentSpans(
  state: AgentExecutionState,
  runStart: number,
  doneAt: number
): Omit<Span, "id" | "runId">[] {
  const ts = state.spanTimestamps
  const items: Omit<Span, "id" | "runId">[] = []
  let order = 0

  const sortedCalls = [...state.toolCalls].sort((a, b) => a.round - b.round)

  // thinking span
  if (state.thinking) {
    const thinkStart = ts.thinkingStartAt ?? runStart
    const firstCallTime = sortedCalls.length > 0 ? (ts.toolCallAt[sortedCalls[0].callId] ?? null) : null
    const thinkEnd = firstCallTime ?? ts.answerStartAt ?? doneAt
    items.push({
      spanType: "thinking",
      toolName: null, toolCallId: null, input: null,
      output: state.thinking, error: null,
      startedAt: thinkStart,
      durationMs: Math.max(thinkEnd - thinkStart, 1),
      round: 0, order: order++,
    })
  }

  for (let i = 0; i < sortedCalls.length; i++) {
    const tc = sortedCalls[i]
    const callStart = ts.toolCallAt[tc.callId] ?? runStart
    const resultTime = ts.toolResultAt[tc.callId] ?? null

    // tool-call duration = tool execution time (from call event to result event)
    items.push({
      spanType: "tool-call",
      toolName: tc.name, toolCallId: tc.callId,
      input: JSON.stringify(tc.arguments), output: null, error: null,
      startedAt: callStart,
      durationMs: resultTime ? Math.max(resultTime - callStart, 1) : Math.max(doneAt - callStart, 1),
      round: tc.round, order: order++,
    })

    const result = state.toolResults.find((r) => r.callId === tc.callId)
    if (result) {
      const resultStart = resultTime ?? callStart
      // tool-result duration = LLM processing time until next action
      const nextActionTime = i + 1 < sortedCalls.length
        ? (ts.toolCallAt[sortedCalls[i + 1].callId] ?? resultStart)
        : (ts.answerStartAt ?? doneAt)
      items.push({
        spanType: "tool-result",
        toolName: result.name, toolCallId: result.callId,
        input: null,
        output: result.result != null ? JSON.stringify(result.result) : null,
        error: result.error ?? null,
        startedAt: resultStart,
        durationMs: Math.max(nextActionTime - resultStart, 1),
        round: tc.round, order: order++,
      })
    }
  }

  // answer span
  if (state.answer) {
    const ansStart = ts.answerStartAt ?? (sortedCalls.length > 0
      ? (ts.toolResultAt[sortedCalls[sortedCalls.length - 1].callId] ?? runStart)
      : runStart)
    items.push({
      spanType: "answer",
      toolName: null, toolCallId: null, input: null,
      output: state.answer, error: null,
      startedAt: ansStart,
      durationMs: Math.max(doneAt - ansStart, 1),
      round: 0, order: order++,
    })
  }

  return items
}

export function useRunRecorder(source: string, agentId?: string) {
  const runStartRef = useRef<number>(0)
  const modelRef = useRef<string>("")
  const promptRef = useRef<string>("")

  const startRun = useCallback((model: string, prompt: string) => {
    runStartRef.current = Date.now()
    modelRef.current = model
    promptRef.current = prompt
  }, [])

  const finishAgentRun = useCallback(
    async (state: AgentExecutionState, status: RunStatus) => {
      try {
        const doneAt = Date.now()
        const spans = buildAgentSpans(state, runStartRef.current, doneAt)
        await saveRun(
          {
            source,
            agentId: agentId ?? null,
            model: modelRef.current,
            status,
            prompt: promptRef.current,
            promptSummary: promptRef.current.slice(0, 60),
            answer: state.answer,
            totalTokens: state.usage?.totalTokens ?? null,
            promptTokens: state.usage?.promptTokens ?? null,
            completionTokens: state.usage?.completionTokens ?? null,
            durationMs: doneAt - runStartRef.current,
            createdAt: runStartRef.current,
          },
          spans
        )
      } catch (e) {
        console.error("[run-recorder] finishAgentRun failed", e)
      }
    },
    [source, agentId]
  )

  const finishStructuredRun = useCallback(
    async (object: PlaygroundResponse | undefined, status: RunStatus) => {
      try {
        const doneAt = Date.now()
        const totalMs = Math.max(doneAt - runStartRef.current, 1)
        const answer = object?.answer ?? ""
        const spans: Omit<Span, "id" | "runId">[] = [
          {
            spanType: "answer",
            toolName: null,
            toolCallId: null,
            input: promptRef.current,
            output: answer,
            error: null,
            startedAt: runStartRef.current,
            durationMs: totalMs,
            round: 0,
            order: 0,
          },
        ]
        await saveRun(
          {
            source,
            agentId: agentId ?? null,
            model: object?.metadata?.model ?? modelRef.current,
            status,
            prompt: promptRef.current,
            promptSummary: promptRef.current.slice(0, 60),
            answer,
            totalTokens: object?.metadata?.totalTokens ?? null,
            promptTokens: object?.metadata?.promptTokens ?? null,
            completionTokens: object?.metadata?.completionTokens ?? null,
            durationMs: totalMs,
            createdAt: runStartRef.current,
          },
          spans
        )
      } catch (e) {
        console.error("[run-recorder] finishStructuredRun failed", e)
      }
    },
    [source, agentId]
  )

  const interruptAgentRun = useCallback(
    async (state: AgentExecutionState) => {
      try {
        const doneAt = Date.now()
        const spans = buildAgentSpans(state, runStartRef.current, doneAt)
        await saveRun(
          {
            source,
            agentId: agentId ?? null,
            model: modelRef.current,
            status: "interrupted",
            prompt: promptRef.current,
            promptSummary: promptRef.current.slice(0, 60),
            answer: state.answer,
            totalTokens: state.usage?.totalTokens ?? null,
            promptTokens: state.usage?.promptTokens ?? null,
            completionTokens: state.usage?.completionTokens ?? null,
            durationMs: doneAt - runStartRef.current,
            createdAt: runStartRef.current,
          },
          spans
        )
      } catch (e) {
        console.error("[run-recorder] interruptAgentRun failed", e)
      }
    },
    [source, agentId]
  )

  const interruptStructuredRun = useCallback(
    async (partial: DeepPartial<PlaygroundResponse> | undefined) => {
      try {
        const doneAt = Date.now()
        const totalMs = Math.max(doneAt - runStartRef.current, 1)
        const answer = (partial?.answer as string | undefined) ?? ""
        const spans: Omit<Span, "id" | "runId">[] = [
          {
            spanType: "answer",
            toolName: null,
            toolCallId: null,
            input: promptRef.current,
            output: answer,
            error: null,
            startedAt: runStartRef.current,
            durationMs: totalMs,
            round: 0,
            order: 0,
          },
        ]
        await saveRun(
          {
            source,
            agentId: agentId ?? null,
            model: modelRef.current,
            status: "interrupted",
            prompt: promptRef.current,
            promptSummary: promptRef.current.slice(0, 60),
            answer,
            totalTokens: null,
            promptTokens: null,
            completionTokens: null,
            durationMs: totalMs,
            createdAt: runStartRef.current,
          },
          spans
        )
      } catch (e) {
        console.error("[run-recorder] interruptStructuredRun failed", e)
      }
    },
    [source, agentId]
  )

  return {
    startRun,
    finishAgentRun,
    finishStructuredRun,
    interruptAgentRun,
    interruptStructuredRun,
  }
}
