"use client";

import { useCallback, useImperativeHandle, forwardRef } from "react";
import { useStructuredStream, type DeepPartial } from "@/hooks/useStructuredStream";
import { useAgentStream, type AgentExecutionState } from "@/hooks/useAgentStream";
import { PlaygroundResponseSchema, type PlaygroundResponse, type ModelId } from "@/shared/schemas/playgroundResponse";
import type { ToolName } from "@/shared/schemas/agentStream";
import { saveSession } from "@/lib/playground-session";
import { ThinkingCard } from "./cards/ThinkingCard";
import { ToolCallCard } from "./cards/ToolCallCard";
import { ToolResultCard } from "./cards/ToolResultCard";
import { AnswerCard } from "./cards/AnswerCard";
import { ErrorCard } from "./ErrorCard";

export interface ResponseAreaHandle {
  submit: (prompt: string, model: ModelId, apiKey: string) => void;
  stop: () => void;
  currentObject: DeepPartial<PlaygroundResponse> | AgentExecutionState | undefined;
}

interface ResponseAreaProps {
  selectedTools: ToolName[];
  onLoadingChange?: (isLoading: boolean) => void;
  onErrorChange?: (error: (Error & Record<string, unknown>) | null) => void;
  onAgentFinish?: (state: AgentExecutionState) => void;
  onAgentStop?: (state: AgentExecutionState) => void;
  onStructuredStop?: (object: DeepPartial<PlaygroundResponse> | undefined) => void;
  onStructuredFinish?: (object: PlaygroundResponse | undefined) => void;
}

export const ResponseArea = forwardRef<ResponseAreaHandle, ResponseAreaProps>(
  function ResponseArea({ selectedTools, onLoadingChange, onErrorChange, onAgentFinish, onAgentStop, onStructuredStop, onStructuredFinish }, ref) {
    // ── No-tool mode (existing) ───────────────────────────────────────────
    const { object, isLoading: isLegacyLoading, error: legacyError, submit: legacySubmit, stop: legacyStop } =
      useStructuredStream<PlaygroundResponse>({
        api: "/api/playground/stream",
        onFinish: ({ object: finishedObj }) => {
          onLoadingChange?.(false);
          if (finishedObj) {
            const parsed = PlaygroundResponseSchema.safeParse(finishedObj);
            if (parsed.success) {
              const model = parsed.data.metadata?.model ?? "deepseek-v4-flash";
              saveSession(parsed.data, model, "");
              onStructuredFinish?.(parsed.data);
            } else {
              onStructuredFinish?.(undefined);
            }
          } else {
            onStructuredFinish?.(undefined);
          }
        },
        onError: (err) => {
          onLoadingChange?.(false);
          onErrorChange?.(err);
        },
      });

    // ── Agent mode (new) ──────────────────────────────────────────────────
    const { state: agentState, submit: agentSubmit, stop: agentStop } = useAgentStream();

    const isAgentMode = selectedTools.length > 0;

    const handleSubmit = useCallback(
      (prompt: string, model: ModelId, apiKey: string) => {
        onErrorChange?.(null);
        onLoadingChange?.(true);

        if (isAgentMode) {
          agentSubmit(prompt, model, apiKey, selectedTools, (finishedState) => {
            onLoadingChange?.(false);
            onAgentFinish?.(finishedState);
          });
        } else {
          legacySubmit({ model, prompt }, { "X-Provider-Api-Key": apiKey });
        }
      },
      [isAgentMode, agentSubmit, legacySubmit, selectedTools, onLoadingChange, onErrorChange, onAgentFinish]
    );

    const handleStop = useCallback(() => {
      if (isAgentMode) {
        onAgentStop?.(agentState);
        agentStop();
        onLoadingChange?.(false);
      } else {
        onStructuredStop?.(object);
        legacyStop();
      }
    }, [isAgentMode, agentStop, legacyStop, onLoadingChange, onAgentStop, onStructuredStop, agentState, object]);

    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
      stop: handleStop,
      currentObject: isAgentMode ? agentState : object,
    }));

    // ── Agent mode rendering ──────────────────────────────────────────────
    if (isAgentMode) {
      const { thinking, toolCalls, toolResults, pendingCallIds, answer, isLoading, error } = agentState;
      const hasContent = !!(thinking || toolCalls.length || answer);

      if (error) {
        onErrorChange?.({ name: "AgentError", message: error.message, code: error.code } as Error & Record<string, unknown>);
      }

      if (!isLoading && !hasContent && !error) {
        return (
          <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            选择工具、输入 Prompt，AI 实时执行过程将在此处展示
          </div>
        );
      }

      return (
        <div className="space-y-6">
          {thinking && (
            <ThinkingCard content={thinking} isStreaming={isLoading && !toolCalls.length} />
          )}

          {toolCalls.map((tc) => {
            const isPending = pendingCallIds.has(tc.callId);
            const result = toolResults.find((r) => r.callId === tc.callId);
            return (
              <div key={tc.callId} className="space-y-2">
                <ToolCallCard agentCall={tc} />
                {isPending ? (
                  <ToolResultCard agentResult={{ callId: tc.callId, name: tc.name, result: null }} isLoading />
                ) : result ? (
                  <ToolResultCard agentResult={result} />
                ) : null}
              </div>
            );
          })}

          {answer && <AnswerCard content={answer} isStreaming={isLoading} />}
        </div>
      );
    }

    // ── Legacy (no-tool) mode rendering ──────────────────────────────────
    const isStreamInterrupted =
      !!legacyError &&
      (legacyError as Record<string, unknown>).code === "STREAM_INTERRUPTED" &&
      !!object;
    const displayError =
      legacyError && !isStreamInterrupted
        ? (legacyError as unknown as PlaygroundResponse & { message: string; tier: string; code: string; retryAfterMs?: number })
        : null;
    const hasAnyContent = !!(object?.thinking || object?.toolCalls || object?.toolResults || object?.answer);

    if (!isLegacyLoading && !hasAnyContent && !legacyError) {
      return (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          发送 Prompt 后，AI 响应将在此处以结构化卡片形式展示
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {isStreamInterrupted && <ErrorCard error={null} streamInterrupted />}
        {displayError && <ErrorCard error={displayError as Parameters<typeof ErrorCard>[0]["error"]} />}

        {(object?.thinking !== undefined || (isLegacyLoading && !object?.answer)) && (
          <ThinkingCard content={object?.thinking} isStreaming={isLegacyLoading} />
        )}

        {(object?.toolCalls !== undefined || (isLegacyLoading && object?.thinking)) && (
          <ToolCallCard
            toolCalls={object?.toolCalls as Parameters<typeof ToolCallCard>[0]["toolCalls"]}
            isStreaming={isLegacyLoading}
          />
        )}

        {(object?.toolResults !== undefined || (isLegacyLoading && object?.toolCalls)) && (
          <ToolResultCard
            toolResults={object?.toolResults as Parameters<typeof ToolResultCard>[0]["toolResults"]}
            isStreaming={isLegacyLoading}
          />
        )}

        <AnswerCard content={object?.answer} isStreaming={isLegacyLoading} />
      </div>
    );
  }
);
