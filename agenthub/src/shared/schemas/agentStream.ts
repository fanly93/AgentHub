import { z } from "zod";
import { ModelIdSchema } from "./playgroundResponse";

// ── Tool Names ─────────────────────────────────────────────────────────────

export const ToolNameSchema = z.enum([
  "get_current_time",
  "calculate",
  "web_search",
  "get_weather",
  "write_file",
]);

export type ToolName = z.infer<typeof ToolNameSchema>;

// ── AgentToolCall ──────────────────────────────────────────────────────────

export const AgentToolCallSchema = z.object({
  callId: z.string().min(1),
  name: z.string().min(1).max(100),
  arguments: z.record(z.string(), z.unknown()),
  round: z.number().int().positive(),
});

export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;

// ── AgentToolResult ────────────────────────────────────────────────────────

export const AgentToolResultSchema = z.object({
  callId: z.string().min(1),
  name: z.string().min(1).max(100),
  result: z.unknown(),
  error: z.string().max(500).optional(),
});

export type AgentToolResult = z.infer<typeof AgentToolResultSchema>;

// ── NDJSON Event Union ─────────────────────────────────────────────────────

export const ThinkingDeltaEventSchema = z.object({
  type: z.literal("thinking-delta"),
  delta: z.string().min(1),
});

export const ToolCallEventSchema = z.object({
  type: z.literal("tool-call"),
  callId: z.string().min(1),
  name: z.string().min(1).max(100),
  arguments: z.record(z.string(), z.unknown()),
});

export const ToolResultEventSchema = z.object({
  type: z.literal("tool-result"),
  callId: z.string().min(1),
  name: z.string().min(1).max(100),
  result: z.unknown(),
  error: z.string().max(500).optional(),
});

export const AnswerDeltaEventSchema = z.object({
  type: z.literal("answer-delta"),
  delta: z.string().min(1),
});

export const DoneEventSchema = z.object({
  type: z.literal("done"),
  usage: z
    .object({
      promptTokens: z.number().int().nonnegative().optional(),
      completionTokens: z.number().int().nonnegative().optional(),
      totalTokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string().min(1),
  code: z.string().min(1),
});

export const AgentStreamEventSchema = z.discriminatedUnion("type", [
  ThinkingDeltaEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  AnswerDeltaEventSchema,
  DoneEventSchema,
  ErrorEventSchema,
]);

export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

// ── AgentSessionRecord（sessionStorage 持久化）─────────────────────────────

export const AgentSessionRecordSchema = z.object({
  thinking: z.string().optional(),
  toolCalls: z.array(AgentToolCallSchema),
  toolResults: z.array(AgentToolResultSchema),
  answer: z.string(),
  usage: z
    .object({
      promptTokens: z.number().int().nonnegative().optional(),
      completionTokens: z.number().int().nonnegative().optional(),
      totalTokens: z.number().int().nonnegative().optional(),
    })
    .nullable()
    .optional(),
  model: ModelIdSchema,
  selectedTools: z.array(ToolNameSchema),
  prompt: z.string(),
  savedAt: z.number().int().positive(),
});

export type AgentSessionRecord = z.infer<typeof AgentSessionRecordSchema>;
