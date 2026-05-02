"use client";

import { useState } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelector } from "@/components/playground/ModelSelector";
import { ThinkingCard } from "@/components/playground/cards/ThinkingCard";
import { ToolCallCard } from "@/components/playground/cards/ToolCallCard";
import { ToolResultCard } from "@/components/playground/cards/ToolResultCard";
import { AnswerCard } from "@/components/playground/cards/AnswerCard";
import { ErrorCard } from "@/components/playground/ErrorCard";
import { useAgentStream } from "@/hooks/useAgentStream";
import { useRetryCountdown } from "@/hooks/useRetryCountdown";
import { getApiKeyForModel, DEFAULT_MODEL } from "@/lib/models";
import { saveAgentSession } from "@/lib/playground-session";
import { useRunRecorder } from "@/hooks/useRunRecorder";
import type { Agent } from "@/lib/mock-data";
import type { ModelId } from "@/shared/schemas/playgroundResponse";

const CHAR_WARN = 4000;

interface DeepResearchPanelProps {
  agent: Agent;
}

export function DeepResearchPanel({ agent }: DeepResearchPanelProps) {
  const [selectedModel, setSelectedModel] = useState<ModelId>(
    (agent.defaultModel as ModelId | undefined) ?? DEFAULT_MODEL
  );
  const [prompt, setPrompt] = useState("");

  const { state, submit, stop } = useAgentStream("/api/deepresearch/stream");
  const { thinking, toolCalls, toolResults, pendingCallIds, answer, usage, isLoading, error } = state;

  const apiKey = getApiKeyForModel(selectedModel) ?? "";
  const recorder = useRunRecorder(agent.name, agent.id);

  const retryAfterMs =
    error?.code === "RATE_LIMITED" ? undefined : undefined;
  const { secondsLeft, isActive: isRetryActive } = useRetryCountdown(retryAfterMs);

  const hasContent = !!(thinking || toolCalls.length || answer);
  const charCount = prompt.length;
  const isOverLimit = charCount > CHAR_WARN;

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    recorder.startRun(selectedModel, prompt);
    submit(prompt, selectedModel, apiKey, [], (finishedState) => {
      saveAgentSession({
        thinking: finishedState.thinking || undefined,
        toolCalls: finishedState.toolCalls,
        toolResults: finishedState.toolResults,
        answer: finishedState.answer,
        usage: finishedState.usage,
        model: selectedModel,
        selectedTools: [],
        prompt,
        savedAt: Date.now(),
      });
      recorder.finishAgentRun(finishedState, finishedState.error ? "failed" : "success");
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const isSubmit = isMac ? e.metaKey && e.key === "Enter" : e.ctrlKey && e.key === "Enter";
    if (isSubmit && !isLoading && prompt.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 模型选择 */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <ModelSelector
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isLoading}
        />
        <span className="text-xs text-muted-foreground">
          {isLoading ? `研究进行中（${toolCalls.length} 次搜索）…` : "就绪"}
        </span>
      </div>

      {/* web_search 说明 */}
      <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        🔍 深度研究模式：自动执行多轮联网检索（最多 15 步），无需手动选择工具
      </div>

      {/* 响应区 */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {error && (
          <ErrorCard
            error={{ tier: "retryable", message: error.message, code: error.code as Parameters<typeof ErrorCard>[0]["error"] extends { code: infer C } ? C : string, retryAfterMs: undefined } as Parameters<typeof ErrorCard>[0]["error"]}
          />
        )}

        {!isLoading && !hasContent && !error && (
          <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            输入研究主题，AI 将自动规划、多轮检索、输出结构化报告
          </div>
        )}

        {(isLoading || hasContent) && (
          <div className="space-y-4">
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
            {!isLoading && toolCalls.length > 0 && answer && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {toolCalls.length}
                </span>
                <span>共执行 <strong>{toolCalls.length}</strong> 次工具调用，研究完成</span>
              </div>
            )}
            {answer && <AnswerCard content={answer} isStreaming={isLoading} />}
          </div>
        )}
      </div>

      {/* Token/Cost 信息 */}
      {usage && (
        <div className="flex gap-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span>已用 Token：{usage.totalTokens?.toLocaleString() ?? "—"}</span>
          <span>预估成本：${((usage.totalTokens ?? 0) / 1000 * 0.002).toFixed(4)}</span>
        </div>
      )}

      {/* 输入区 */}
      <div className="rounded-lg border border-border bg-card p-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="输入研究主题，如：2025年大语言模型发展趋势…"
          className="min-h-[72px] resize-none"
        />
        {isOverLimit && (
          <p className="mt-1 text-xs text-[--warning]">
            内容可能超出模型限制
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs ${isOverLimit ? "text-[--warning]" : "text-muted-foreground"}`}>
            {charCount.toLocaleString()} 字
          </span>
          {isLoading ? (
            <Button variant="outline" size="sm" onClick={() => { recorder.interruptAgentRun(state); stop(); }} className="gap-2">
              <Square className="h-3.5 w-3.5" />
              停止研究
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isRetryActive}
              className="gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              {isRetryActive ? `${secondsLeft}s 后可重试` : "开始研究"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
