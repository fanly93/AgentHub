"use client";

import { useState } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelector } from "@/components/playground/ModelSelector";
import { AnswerCard } from "@/components/playground/cards/AnswerCard";
import { ErrorCard } from "@/components/playground/ErrorCard";
import { useStructuredStream } from "@/hooks/useStructuredStream";
import { useRetryCountdown } from "@/hooks/useRetryCountdown";
import { getApiKeyForModel, DEFAULT_MODEL } from "@/lib/models";
import { saveSession } from "@/lib/playground-session";
import { CATEGORY_PROMPTS } from "@/lib/mock-data";
import type { Agent } from "@/lib/mock-data";
import type { PlaygroundResponse } from "@/shared/schemas/playgroundResponse";
import type { ModelId } from "@/shared/schemas/playgroundResponse";

const CHAR_WARN = 4000;

interface SimpleAgentPanelProps {
  agent: Agent;
}

type SimpleInput = {
  model: ModelId;
  prompt: string;
  agentSystemPrompt?: string;
};

export function SimpleAgentPanel({ agent }: SimpleAgentPanelProps) {
  const [selectedModel, setSelectedModel] = useState<ModelId>(
    (agent.defaultModel as ModelId | undefined) ?? DEFAULT_MODEL
  );
  const [prompt, setPrompt] = useState("");

  const { object, isLoading, error, submit, stop } = useStructuredStream<PlaygroundResponse, SimpleInput>({
    api: "/api/playground/stream",
    onFinish: ({ object: finishedObj }) => {
      if (finishedObj?.answer) {
        saveSession(finishedObj as PlaygroundResponse, selectedModel, prompt);
      }
    },
  });

  const apiKey = getApiKeyForModel(selectedModel) ?? "";

  const retryAfterMs =
    error && (error as Record<string, unknown>).tier === "retryable"
      ? ((error as Record<string, unknown>).retryAfterMs as number | undefined)
      : undefined;
  const { secondsLeft, isActive: isRetryActive } = useRetryCountdown(retryAfterMs);

  const charCount = prompt.length;
  const isOverLimit = charCount > CHAR_WARN;
  const agentSystemPrompt = CATEGORY_PROMPTS[agent.category];

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    submit(
      { model: selectedModel, prompt, agentSystemPrompt },
      { "X-Provider-Api-Key": apiKey }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const isSubmit = isMac ? e.metaKey && e.key === "Enter" : e.ctrlKey && e.key === "Enter";
    if (isSubmit && !isLoading && prompt.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContent = !!object?.answer;
  const errorData = error
    ? ({
        tier: (error as Record<string, unknown>).tier ?? "retryable",
        message: error.message,
        code: (error as Record<string, unknown>).code ?? "STREAM_INTERRUPTED",
        retryAfterMs: (error as Record<string, unknown>).retryAfterMs,
      } as Parameters<typeof ErrorCard>[0]["error"])
    : null;

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
          {isLoading ? "生成中…" : "就绪"}
        </span>
      </div>

      {/* 响应区 */}
      <div className="flex-1">
        {errorData && <ErrorCard error={errorData} />}

        {!isLoading && !hasContent && !error && (
          <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            输入问题，AI 将按{agent.category}角色为你解答
          </div>
        )}

        {(isLoading || hasContent) && (
          <AnswerCard content={object?.answer} isStreaming={isLoading} />
        )}
      </div>

      {/* Token/Cost */}
      {object?.metadata && (
        <div className="flex gap-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span>已用 Token：{object.metadata.totalTokens?.toLocaleString() ?? "—"}</span>
          <span>
            预估成本：${(((object.metadata.totalTokens ?? 0) / 1000) * 0.002).toFixed(4)}
          </span>
        </div>
      )}

      {/* 输入区 */}
      <div className="rounded-lg border border-border bg-card p-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={`向 ${agent.name} 提问…`}
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
            <Button variant="outline" size="sm" onClick={stop} className="gap-2">
              <Square className="h-3.5 w-3.5" />
              停止
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isRetryActive}
              className="gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              {isRetryActive ? `${secondsLeft}s 后可重试` : "发送"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
