"use client";

import { useReducer, useCallback, useRef } from "react";
import type {
  AgentToolCall,
  AgentToolResult,
  ToolName,
  AgentStreamEvent,
} from "@/shared/schemas/agentStream";
import type { ModelId } from "@/shared/schemas/playgroundResponse";

// ── State ──────────────────────────────────────────────────────────────────

export interface SpanTimestamps {
  thinkingStartAt: number | null;
  answerStartAt: number | null;
  toolCallAt: Record<string, number>;
  toolResultAt: Record<string, number>;
}

export interface AgentExecutionState {
  thinking: string;
  toolCalls: AgentToolCall[];
  toolResults: AgentToolResult[];
  pendingCallIds: Set<string>;
  answer: string;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
  isLoading: boolean;
  error: { message: string; code: string } | null;
  spanTimestamps: SpanTimestamps;
}

const emptyTimestamps = (): SpanTimestamps => ({
  thinkingStartAt: null,
  answerStartAt: null,
  toolCallAt: {},
  toolResultAt: {},
});

const initialState: AgentExecutionState = {
  thinking: "",
  toolCalls: [],
  toolResults: [],
  pendingCallIds: new Set(),
  answer: "",
  usage: null,
  isLoading: false,
  error: null,
  spanTimestamps: emptyTimestamps(),
};

// ── Reducer ────────────────────────────────────────────────────────────────

type Action =
  | { type: "reset" }
  | { type: "start" }
  | { type: "thinking-delta"; delta: string }
  | { type: "tool-call"; callId: string; name: string; arguments: Record<string, unknown>; round: number }
  | { type: "tool-result"; callId: string; name: string; result: unknown; error?: string }
  | { type: "answer-delta"; delta: string }
  | { type: "done"; usage?: AgentExecutionState["usage"] }
  | { type: "error"; message: string; code: string };

function reducer(state: AgentExecutionState, action: Action): AgentExecutionState {
  switch (action.type) {
    case "reset":
      return { ...initialState };
    case "start":
      return { ...initialState, isLoading: true };
    case "thinking-delta":
      return { ...state, thinking: state.thinking + action.delta };
    case "tool-call": {
      const pending = new Set(state.pendingCallIds);
      pending.add(action.callId);
      return {
        ...state,
        toolCalls: [
          ...state.toolCalls,
          { callId: action.callId, name: action.name, arguments: action.arguments, round: action.round },
        ],
        pendingCallIds: pending,
      };
    }
    case "tool-result": {
      const pending = new Set(state.pendingCallIds);
      pending.delete(action.callId);
      return {
        ...state,
        toolResults: [
          ...state.toolResults,
          { callId: action.callId, name: action.name, result: action.result, error: action.error },
        ],
        pendingCallIds: pending,
      };
    }
    case "answer-delta":
      return { ...state, answer: state.answer + action.delta };
    case "done":
      return { ...state, usage: action.usage ?? null, isLoading: false };
    case "error":
      return { ...state, error: { message: action.message, code: action.code }, isLoading: false };
    default:
      return state;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAgentStream(route = "/api/agent/stream") {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const roundRef = useRef(0);

  const submit = useCallback(
    async (
      prompt: string,
      model: ModelId,
      apiKey: string,
      tools: ToolName[],
      onFinish?: (state: AgentExecutionState) => void
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      roundRef.current = 0;

      dispatch({ type: "start" });

      // 本地积累流数据，独立于 React state 批处理，确保 onFinish 拿到完整数据
      let localThinking = "";
      const localToolCalls: AgentToolCall[] = [];
      const localToolResults: AgentToolResult[] = [];
      let localAnswer = "";
      let localUsage: AgentExecutionState["usage"] = null;
      let localError: { message: string; code: string } | null = null;
      const localTimestamps: SpanTimestamps = emptyTimestamps();

      let lineBuffer = "";

      try {
        const res = await fetch(route, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Provider-Api-Key": apiKey,
          },
          body: JSON.stringify({ model, prompt, tools }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ message: "请求失败", code: "STREAM_INTERRUPTED" }));
          dispatch({ type: "error", message: errBody.message ?? "请求失败", code: errBody.code ?? "STREAM_INTERRUPTED" });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          dispatch({ type: "error", message: "无法读取响应流", code: "STREAM_INTERRUPTED" });
          return;
        }

        const decoder = new TextDecoder();
        let hasDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed) as AgentStreamEvent;
              dispatchEvent(event, dispatch, roundRef);
              // 同步积累到本地变量，不依赖 React state 批处理时机
              const now = Date.now();
              switch (event.type) {
                case "thinking-delta":
                  localThinking += event.delta;
                  if (localTimestamps.thinkingStartAt === null) localTimestamps.thinkingStartAt = now;
                  break;
                case "tool-call":
                  localToolCalls.push({ callId: event.callId, name: event.name, arguments: event.arguments, round: roundRef.current });
                  localTimestamps.toolCallAt[event.callId] = now;
                  break;
                case "tool-result":
                  localToolResults.push({ callId: event.callId, name: event.name, result: event.result, error: event.error });
                  localTimestamps.toolResultAt[event.callId] = now;
                  break;
                case "answer-delta":
                  localAnswer += event.delta;
                  if (localTimestamps.answerStartAt === null) localTimestamps.answerStartAt = now;
                  break;
                case "done":
                  localUsage = event.usage ?? null;
                  hasDone = true;
                  break;
                case "error":
                  localError = { message: event.message, code: event.code };
                  break;
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }

        if (hasDone && onFinish) {
          const finalState: AgentExecutionState = {
            thinking: localThinking,
            toolCalls: localToolCalls,
            toolResults: localToolResults,
            pendingCallIds: new Set(),
            answer: localAnswer,
            usage: localUsage,
            isLoading: false,
            error: localError,
            spanTimestamps: localTimestamps,
          };
          onFinish(finalState);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        dispatch({ type: "error", message: "网络连接中断，请重试", code: "STREAM_INTERRUPTED" });
      }
    },
    [route]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "done" });
  }, []);

  return { state, submit, stop };
}

// ── Event dispatcher ───────────────────────────────────────────────────────

function dispatchEvent(
  event: AgentStreamEvent,
  dispatch: React.Dispatch<Action>,
  roundRef: React.MutableRefObject<number>
) {
  switch (event.type) {
    case "thinking-delta":
      dispatch({ type: "thinking-delta", delta: event.delta });
      break;
    case "tool-call":
      roundRef.current += 1;
      dispatch({
        type: "tool-call",
        callId: event.callId,
        name: event.name,
        arguments: event.arguments,
        round: roundRef.current,
      });
      break;
    case "tool-result":
      dispatch({
        type: "tool-result",
        callId: event.callId,
        name: event.name,
        result: event.result,
        error: event.error,
      });
      break;
    case "answer-delta":
      dispatch({ type: "answer-delta", delta: event.delta });
      break;
    case "done":
      dispatch({ type: "done", usage: event.usage });
      break;
    case "error":
      dispatch({ type: "error", message: event.message, code: event.code });
      break;
  }
}
