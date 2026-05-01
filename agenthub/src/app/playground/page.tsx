"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor } from "lucide-react";
import { ModelSelector } from "@/components/playground/ModelSelector";
import { PromptInput } from "@/components/playground/PromptInput";
import { ResponseArea, type ResponseAreaHandle } from "@/components/playground/ResponseArea";
import { ToolPanel } from "@/components/playground/ToolPanel";
import { CopyJsonButton } from "@/components/playground/CopyJsonButton";
import { restoreSession, saveAgentSession, restoreAgentSession } from "@/lib/playground-session";
import { getApiKeyForModel } from "@/lib/models";
import { DEFAULT_MODEL } from "@/lib/models";
import { useRetryCountdown } from "@/hooks/useRetryCountdown";
import type { ModelId, PlaygroundError } from "@/shared/schemas/playgroundResponse";
import type { ToolName } from "@/shared/schemas/agentStream";
import type { AgentExecutionState } from "@/hooks/useAgentStream";

export default function PlaygroundPage() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [selectedTools, setSelectedTools] = useState<ToolName[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<(Error & Record<string, unknown>) | null>(null);

  const responseRef = useRef<ResponseAreaHandle>(null);

  const retryAfterMs =
    error && (error as Record<string, unknown>).tier === "retryable"
      ? ((error as Record<string, unknown>).retryAfterMs as number | undefined)
      : undefined;
  const { secondsLeft, isActive: isRetryActive } = useRetryCountdown(retryAfterMs);

  // 恢复 session
  useEffect(() => {
    const agentSession = restoreAgentSession();
    if (agentSession) {
      setPrompt(agentSession.prompt || "");
      setSelectedModel(agentSession.model);
      setSelectedTools(agentSession.selectedTools);
      return;
    }
    const session = restoreSession();
    if (session) {
      setPrompt(session.prompt || "");
      setSelectedModel(session.model);
    }
  }, []);

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
  };

  const handleSubmit = () => {
    const apiKey = getApiKeyForModel(selectedModel) ?? "";
    setError(null);
    responseRef.current?.submit(prompt, selectedModel, apiKey);
  };

  const handleModelChange = (model: ModelId) => {
    setSelectedModel(model);
  };

  const sendButtonLabel = isRetryActive ? `${secondsLeft}s 后可重试` : "发送";
  const sendDisabled = isLoading || isRetryActive || !prompt.trim();

  if (isNarrow) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Monitor className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Playground 仅支持桌面浏览器（≥ 1024px），请在电脑上访问
        </p>
      </div>
    );
  }

  const descText =
    selectedTools.length > 0
      ? "选择模型和工具，输入 Prompt，查看 Agent 实时执行过程"
      : "选择模型、输入 Prompt，查看流式结构化响应";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-medium">Playground</h1>
        <p className="mt-1 text-sm text-muted-foreground">{descText}</p>
      </div>

      {/* 输入区 */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <ModelSelector
            value={selectedModel}
            onChange={handleModelChange}
            disabled={isLoading}
          />
          <span className="text-xs text-muted-foreground">
            {isLoading ? "生成中…" : "就绪"}
          </span>
        </div>

        <ToolPanel
          selectedTools={selectedTools}
          onChange={setSelectedTools}
          disabled={isLoading}
        />

        <PromptInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          disabled={isLoading || isRetryActive}
        />
      </div>

      {/* 响应区 */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">响应</h2>
          <CopyJsonButton data={responseRef.current?.currentObject} />
        </div>

        <ResponseArea
          ref={responseRef}
          selectedTools={selectedTools}
          onLoadingChange={setIsLoading}
          onErrorChange={(err) => setError(err)}
          onAgentFinish={handleAgentFinish}
        />
      </div>
    </div>
  );
}
