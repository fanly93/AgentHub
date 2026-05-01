import { streamText } from "ai";
import { z } from "zod";
import { ModelIdSchema } from "@/shared/schemas/playgroundResponse";
import { errorResponse, mapProviderError, getProviderModel, ENV_KEY_MAP } from "@/lib/ai-provider";

// ── Runtime ───────────────────────────────────────────────────────────────
export const runtime = "edge";
export const maxDuration = 60;

// ── Request Schema ────────────────────────────────────────────────────────
const RequestSchema = z.object({
  model: ModelIdSchema,
  prompt: z.string().min(1).max(50000),
  agentSystemPrompt: z.string().max(2000).optional(),
});

// ── System Prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `你是一个专业的 AI 助手，必须严格按照以下 JSON schema 格式返回响应。

【输出格式要求，不可违反】
- 你的所有输出必须是符合下方结构的合法 JSON 对象
- 不要在 JSON 外添加任何说明文字或 Markdown 代码块标记（如 \`\`\`json）

【Schema 结构】
{
  "thinking": "（可选）你的推理过程，自然语言，最多 50000 字；不支持时省略，禁止填空字符串",
  "toolCalls": [],    // （可选）工具调用列表，最多 20 条；没有则省略，禁止返回空数组 []
  "toolResults": [],  // （可选）工具结果，顺序与 toolCalls 一一对应；没有则省略，禁止返回空数组 []
  "answer": "最终回答（必填，Markdown 格式，最少 1 字，最多 100000 字）"
}

【不可违反的规则】
1. answer 是唯一必填字段，任何情况下不能省略或置为空字符串
2. toolCalls / toolResults 没有内容时，直接省略字段，禁止返回空数组 []
3. toolResults 的条数必须与 toolCalls 的条数完全一致
4. answer 使用 Markdown 格式，可用标题、列表、代码块
5. 不要在 answer 里重复 thinking 的推理过程，直接给结论`;

// ── POST Handler ──────────────────────────────────────────────────────────
export async function POST(req: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse(400, "fatal", "请求体格式错误，需要 JSON", "INVALID_REQUEST");
  }

  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(400, "fatal", "请求参数错误，请检查 model 和 prompt 字段", "INVALID_REQUEST");
  }
  const { model, prompt, agentSystemPrompt } = parsed.data;

  const headerKey = req.headers.get("X-Provider-Api-Key")?.trim();
  const apiKey = headerKey || ENV_KEY_MAP[model];
  if (!apiKey?.trim()) {
    return errorResponse(401, "fatal", "API Key 未提供，请前往设置页配置", "INVALID_KEY");
  }

  let providerModel: ReturnType<typeof getProviderModel>;
  try {
    providerModel = getProviderModel(model, apiKey);
  } catch {
    return errorResponse(422, "fatal", "不支持的模型，请重新选择", "UNSUPPORTED_MODEL");
  }

  try {
    const systemPrompt = agentSystemPrompt
      ? `${agentSystemPrompt}\n\n${SYSTEM_PROMPT}`
      : SYSTEM_PROMPT;

    const result = streamText({
      model: providerModel,
      system: systemPrompt,
      prompt,
      onError: (error) => {
        const safeErr = error as { status?: number; statusCode?: number; message?: string };
        console.error("[playground/stream] streamText error", {
          model,
          status: safeErr.status ?? safeErr.statusCode,
          message: safeErr.message,
        });
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return mapProviderError(error);
  }
}
