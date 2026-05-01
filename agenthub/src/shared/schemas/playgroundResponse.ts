import { z } from "zod";

// ─── ModelId ────────────────────────────────────────────────────────────────

export const ModelIdSchema = z
  .enum([
    "gpt-4o-mini",
    "claude-sonnet-4-6",
    "gemini-2.0-flash",
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "qwen3.6-plus",
  ])
  .describe(
    "使用的 AI 模型标识符，必须是枚举值之一，默认为 deepseek-v4-flash；" +
    "DeepSeek 旧名（deepseek-chat / deepseek-reasoner）已弃用，不在此枚举中"
  );

// ─── ErrorTier ──────────────────────────────────────────────────────────────

export const ErrorTierSchema = z
  .enum(["fatal", "retryable"])
  .describe(
    "错误类型：fatal 表示需要用户手动修正（如 Key 无效），retryable 表示可稍后重试（如速率限制）"
  );

// ─── ToolCall ───────────────────────────────────────────────────────────────

export const ToolCallSchema = z
  .object({
    name: z
      .string()
      .min(1, "工具名称不能为空")
      .max(100, "工具名称不能超过 100 字")
      .describe("工具名称，使用 snake_case，如 search_docs / run_code / get_weather"),
    arguments: z
      .record(z.string(), z.unknown())
      .describe("工具调用参数，key-value 格式；没有参数时传入空对象 {}，禁止省略此字段"),
  })
  .describe("单次工具调用，name 唯一标识工具，arguments 是调用参数");

// ─── ToolResult ─────────────────────────────────────────────────────────────

export const ToolResultSchema = z
  .object({
    name: z
      .string()
      .min(1, "工具名称不能为空")
      .max(100, "工具名称不能超过 100 字")
      .describe("对应的工具名称，必须与 toolCalls 列表中对应项的 name 完全一致"),
    result: z
      .unknown()
      .describe(
        "工具返回的原始结果，任意合法 JSON 值（字符串、数字、对象、数组均可）；调用成功时填写实际返回值"
      ),
    error: z
      .string()
      .max(500, "错误描述不能超过 500 字")
      .optional()
      .describe(
        "工具调用失败时的错误描述，最多 500 字；调用成功时省略此字段，禁止填写空字符串"
      ),
  })
  .describe(
    "单次工具调用的结果，顺序与 toolCalls 列表一一对应；name 必须与对应 ToolCall.name 一致"
  );

// ─── Metadata ───────────────────────────────────────────────────────────────

export const MetadataSchema = z
  .object({
    model: ModelIdSchema.describe("本次请求实际使用的模型标识符"),
    promptTokens: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Prompt 消耗的 token 数，整数且非负；供应商不返回时省略"),
    completionTokens: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("生成内容消耗的 token 数，整数且非负；供应商不返回时省略"),
    totalTokens: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("总 token 消耗（prompt + completion），整数且非负；供应商不返回时省略"),
  })
  .describe("本次请求的元数据，流完成后由 Edge Route 填入，流式过程中省略");

// ─── PlaygroundResponse（主 schema，流式结构化输出）────────────────────────

export const PlaygroundResponseSchema = z
  .object({
    thinking: z
      .string()
      .max(50000, "思考过程不能超过 50000 字")
      .optional()
      .describe(
        "AI 的思考推理过程，自然语言描述，最多 50000 字；" +
          "模型不支持 extended thinking 时省略此字段，禁止填写空字符串；" +
          "内容超过 10000 字时，前端会默认折叠展示"
      ),

    toolCalls: z
      .array(ToolCallSchema)
      .min(1, "如果有工具调用，至少填写 1 条")
      .max(20, "工具调用列表最多 20 条")
      .optional()
      .describe(
        "AI 发起的工具调用列表，按实际调用顺序排列，最多 20 条；" +
          "没有任何工具调用时省略此字段，禁止返回空数组 []"
      ),

    toolResults: z
      .array(ToolResultSchema)
      .min(1, "如果有工具结果，至少填写 1 条")
      .max(20, "工具结果列表最多 20 条")
      .optional()
      .describe(
        "工具调用的结果列表，顺序与 toolCalls 一一对应，最多 20 条；" +
          "没有工具结果时省略此字段，禁止返回空数组 []；" +
          "条数必须与 toolCalls 一致"
      ),

    answer: z
      .string()
      .min(1, "最终答案不能为空")
      .max(100000, "最终答案不能超过 100000 字")
      .describe(
        "最终回答内容，使用 Markdown 格式，最少 1 字，最多 100000 字；" +
          "必填字段，任何情况下都不能省略或置为空字符串；" +
          "可使用标题、列表、代码块、粗体等 Markdown 语法；" +
          "不要重复 thinking 中的推理过程，直接给出结论"
      ),

    metadata: MetadataSchema.optional(),
  })
  .describe("Playground AI 响应的完整结构，包含思考过程、工具调用、工具结果和最终答案");

// ─── Error Schema（独立，用于 API Route 的错误响应 JSON 体）────────────────

export const PlaygroundErrorSchema = z.object({
  tier: ErrorTierSchema,
  message: z.string().min(1).describe("中文用户可读的错误描述"),
  code: z
    .enum([
      "INVALID_REQUEST",
      "CONTEXT_EXCEEDED",
      "INVALID_KEY",
      "UNSUPPORTED_MODEL",
      "RATE_LIMITED",
      "MODEL_UNAVAILABLE",
      "TIMEOUT",
      "STREAM_INTERRUPTED",
    ])
    .describe("机器可读的错误码"),
  retryAfterMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("速率限制时的等待毫秒数，来自 Retry-After header；仅 RATE_LIMITED 时存在"),
});

// ─── Session Schema（sessionStorage 存储结构）───────────────────────────────

export const PlaygroundSessionSchema = z.object({
  response: PlaygroundResponseSchema,
  model: ModelIdSchema,
  prompt: z.string().min(1),
  savedAt: z.number().int().positive().describe("Date.now() 时间戳"),
});

// ─── 导出类型 ─────────────────────────────────────────────────────────────

export type PlaygroundResponse = z.infer<typeof PlaygroundResponseSchema>;
export type PlaygroundError = z.infer<typeof PlaygroundErrorSchema>;
export type PlaygroundSession = z.infer<typeof PlaygroundSessionSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type ModelId = z.infer<typeof ModelIdSchema>;
export type ErrorTier = z.infer<typeof ErrorTierSchema>;

// ─── 使用示例（非流式路径，如 API Route 错误兜底校验）────────────────────

/*
// 场景：Edge Route 收到 AI 响应后做一次性校验（streamObject 本身不需要这步）
const result = PlaygroundResponseSchema.safeParse(rawJson);
if (!result.success) {
  console.error("[schema] 校验失败:", result.error.format());
  return Response.json({ tier: "retryable", message: "AI 响应格式异常", code: "INVALID_REQUEST" }, { status: 400 });
}
const response = result.data; // 类型安全的 PlaygroundResponse

// 场景：校验 sessionStorage 恢复数据（防止旧版 schema 数据污染）
const session = PlaygroundSessionSchema.safeParse(
  JSON.parse(sessionStorage.getItem("playground:last-response") ?? "null")
);
if (session.success) {
  restoreResponse(session.data.response);
}
*/
