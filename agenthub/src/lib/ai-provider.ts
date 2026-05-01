import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ModelId } from "@/shared/schemas/playgroundResponse";

// ── Error Response Helper ──────────────────────────────────────────────────

export function errorResponse(
  status: number,
  tier: "fatal" | "retryable",
  message: string,
  code: string,
  retryAfterMs?: number
): Response {
  const body = JSON.stringify({
    tier,
    message,
    code,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  });
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (retryAfterMs !== undefined) {
    (headers as Record<string, string>)["Retry-After"] = String(
      Math.ceil(retryAfterMs / 1000)
    );
  }
  return new Response(body, { status, headers });
}

// ── Provider Error → ErrorResponse Mapping ────────────────────────────────

export function mapProviderError(error: unknown): Response {
  const err = error as {
    status?: number;
    statusCode?: number;
    message?: string;
    responseHeaders?: Record<string, string>;
  };
  const status = err.status ?? err.statusCode ?? 500;
  const msg = (err.message ?? "").toLowerCase();

  if (status === 401 || status === 403) {
    return errorResponse(401, "fatal", "API Key 无效，请前往设置页更新", "INVALID_KEY");
  }

  if (status === 400) {
    if (
      msg.includes("context") ||
      msg.includes("length") ||
      msg.includes("token") ||
      msg.includes("too long") ||
      msg.includes("maximum")
    ) {
      return errorResponse(
        400,
        "fatal",
        "输入内容过长，请缩短 Prompt 后重试",
        "CONTEXT_EXCEEDED"
      );
    }
    return errorResponse(400, "fatal", "请求参数错误，请检查 model 和 prompt 字段", "INVALID_REQUEST");
  }

  if (status === 422) {
    return errorResponse(422, "fatal", "不支持的模型，请重新选择", "UNSUPPORTED_MODEL");
  }

  if (status === 429) {
    const retryAfterSec = err.responseHeaders?.["retry-after"]
      ? parseInt(err.responseHeaders["retry-after"], 10)
      : 30;
    const retryAfterMs = (isNaN(retryAfterSec) ? 30 : retryAfterSec) * 1000;
    return errorResponse(
      429,
      "retryable",
      "请求过于频繁，请稍后重试",
      "RATE_LIMITED",
      retryAfterMs
    );
  }

  if (status === 503 || status === 502) {
    return errorResponse(503, "retryable", "模型暂时不可用，请稍后重试", "MODEL_UNAVAILABLE");
  }

  return errorResponse(503, "retryable", "模型暂时不可用，请稍后重试", "MODEL_UNAVAILABLE");
}

// ── Provider Model Factory ─────────────────────────────────────────────────

export function getProviderModel(model: ModelId, apiKey: string, options?: { agentMode?: boolean }) {
  switch (model) {
    case "gpt-4o-mini": {
      const provider = createOpenAI({ apiKey });
      return provider("gpt-4o-mini");
    }
    case "claude-sonnet-4-6": {
      const provider = createAnthropic({ apiKey });
      return provider("claude-sonnet-4-6-20251020");
    }
    case "gemini-2.0-flash": {
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider("gemini-2.0-flash");
    }
    case "deepseek-v4-flash":
    case "deepseek-v4-pro": {
      const provider = createOpenAI({
        apiKey,
        baseURL: "https://api.deepseek.com/v1",
      });
      // DeepSeek reasoning models embed reasoning_content that the OpenAI-compat layer
      // cannot pass back in multi-step tool calls; use deepseek-chat for agent mode.
      return options?.agentMode ? provider.chat("deepseek-chat") : provider.chat(model);
    }
    case "qwen3.6-plus": {
      const provider = createOpenAI({
        apiKey,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      });
      return provider.chat("qwen3.6-plus");
    }
  }
}

// ── ENV Key Map ────────────────────────────────────────────────────────────

export const ENV_KEY_MAP: Record<string, string | undefined> = {
  "deepseek-v4-flash": process.env.DEEPSEEK_API_KEY,
  "deepseek-v4-pro": process.env.DEEPSEEK_API_KEY,
  "gpt-4o-mini": process.env.OPENAI_API_KEY,
  "claude-sonnet-4-6": process.env.ANTHROPIC_API_KEY,
  "gemini-2.0-flash": process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  "qwen3.6-plus": process.env.DASHSCOPE_API_KEY,
};
