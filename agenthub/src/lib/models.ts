import type { ModelId } from "@/shared/schemas/playgroundResponse";

// ── 模型展示信息（供 ModelSelector 渲染）────────────────────────────────────
export type ModelMeta = {
  id: ModelId;
  label: string;       // 下拉框显示名
  provider: string;    // 供应商名称（徽标/分组用）
  localStorageKey: string; // 从 localStorage 读取 API Key 时用的 key
};

export const MODEL_LIST: ModelMeta[] = [
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    localStorageKey: "apiKey:deepseek",
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    localStorageKey: "apiKey:deepseek",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "OpenAI",
    localStorageKey: "apiKey:openai",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
    localStorageKey: "apiKey:anthropic",
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    localStorageKey: "apiKey:google",
  },
  {
    id: "qwen3.6-plus",
    label: "Qwen3.6 Plus",
    provider: "Alibaba",
    localStorageKey: "apiKey:dashscope",
  },
];

export const DEFAULT_MODEL: ModelId = "deepseek-v4-flash";

// ── 根据 ModelId 读取对应供应商的 API Key（客户端 localStorage）────────────
export function getApiKeyForModel(modelId: ModelId): string | null {
  if (typeof window === "undefined") return null;
  const meta = MODEL_LIST.find((m) => m.id === modelId);
  if (!meta) return null;
  return localStorage.getItem(meta.localStorageKey);
}
