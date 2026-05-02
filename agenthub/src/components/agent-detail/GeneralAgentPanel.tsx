"use client";

import { useRef, useState } from "react";
import { ModelSelector } from "@/components/playground/ModelSelector";
import { ToolPanel } from "@/components/playground/ToolPanel";
import { PromptInput } from "@/components/playground/PromptInput";
import { ResponseArea, type ResponseAreaHandle } from "@/components/playground/ResponseArea";
import { ErrorCard } from "@/components/playground/ErrorCard";
import { CopyJsonButton } from "@/components/playground/CopyJsonButton";
import { getApiKeyForModel, DEFAULT_MODEL } from "@/lib/models";
import { saveAgentSession } from "@/lib/playground-session";
import { useRetryCountdown } from "@/hooks/useRetryCountdown";
import { useRunRecorder } from "@/hooks/useRunRecorder";
import type { Agent } from "@/lib/mock-data";
import type { ModelId } from "@/shared/schemas/playgroundResponse";
import type { ToolName } from "@/shared/schemas/agentStream";
import type { AgentExecutionState } from "@/hooks/useAgentStream";

interface GeneralAgentPanelProps {
  agent: Agent;
}

export function GeneralAgentPanel({ agent }: GeneralAgentPanelProps) {
  const [selectedModel, setSelectedModel] = useState<ModelId>(
    (agent.defaultModel as ModelId | undefined) ?? DEFAULT_MODEL
  );
  const [selectedTools, setSelectedTools] = useState<ToolName[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<(Error & Record<string, unknown>) | null>(null);

  const responseRef = useRef<ResponseAreaHandle>(null);
  const recorder = useRunRecorder(agent.name, agent.id);

  const retryAfterMs =
    error && (error as Record<string, unknown>).tier === "retryable"
      ? ((error as Record<string, unknown>).retryAfterMs as number | undefined)
      : undefined;
  const { secondsLeft, isActive: isRetryActive } = useRetryCountdown(retryAfterMs);

  const apiKey = getApiKeyForModel(selectedModel) ?? "";

  const handleAgentFinish = (state: AgentExecutionState) => {
    saveAgentSession({
      thinking: state.thinking || undefined,
      toolCalls: state.toolCalls,
      toolResults: state.toolResults,
      answer: state.answer,
      usage: state.usage,
      model: selectedModel,
      selectedTools,
      prompt,
      savedAt: Date.now(),
    });
    recorder.finishAgentRun(state, state.error ? "failed" : "success");
  };

  const handleSubmit = () => {
    setError(null);
    recorder.startRun(selectedModel, prompt);
    responseRef.current?.submit(prompt, selectedModel, apiKey);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 控制栏 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <ModelSelector
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isLoading}
        />
        <span className="text-xs text-muted-foreground">
          {isLoading ? "生成中…" : "就绪"}
        </span>
      </div>

      {/* 工具选择 */}
      <div className="rounded-lg border border-border bg-card p-3">
        <ToolPanel
          selectedTools={selectedTools}
          onChange={setSelectedTools}
          disabled={isLoading}
        />
      </div>

      {/* 响应区 */}
      <div className="flex-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">响应</span>
          <CopyJsonButton data={responseRef.current?.currentObject} />
        </div>
        <ResponseArea
          ref={responseRef}
          selectedTools={selectedTools}
          onLoadingChange={setIsLoading}
          onErrorChange={(err) => setError(err)}
          onAgentFinish={handleAgentFinish}
          onAgentStop={(state) => recorder.interruptAgentRun(state)}
        />
      </div>

      {/* 错误展示 */}
      {error && !isLoading && (
        <ErrorCard
          error={error as unknown as Parameters<typeof ErrorCard>[0]["error"]}
        />
      )}

      {/* 输入区 */}
      <div className="rounded-lg border border-border bg-card p-3">
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          onStop={() => responseRef.current?.stop()}
          isLoading={isLoading}
          disabled={isRetryActive}
        />
      </div>
    </div>
  );
}
