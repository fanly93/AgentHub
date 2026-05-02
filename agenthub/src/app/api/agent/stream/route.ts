import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { ModelIdSchema } from "@/shared/schemas/playgroundResponse";
import { ToolNameSchema } from "@/shared/schemas/agentStream";
import { errorResponse, mapProviderError, getProviderModel, ENV_KEY_MAP } from "@/lib/ai-provider";

export const runtime = "edge";
export const maxDuration = 60;

// ── Request Schema ────────────────────────────────────────────────────────
const RequestSchema = z.object({
  model: ModelIdSchema,
  prompt: z.string().min(1).max(50000),
  tools: z.array(ToolNameSchema).min(1).max(5),
});

// ── Calculate: whitelist regex + Function ─────────────────────────────────
// Recursive-descent arithmetic parser — no eval / new Function (Edge-safe)
function safeCalculate(expression: string): string | { error: string } {
  if (!/^[\d\s+\-*/%().]+$/.test(expression)) {
    return { error: `无效的数学表达式：${expression}` };
  }
  const src = expression.replace(/\s+/g, "");
  let pos = 0;

  const peek = () => src[pos] ?? "";
  const consume = () => src[pos++] ?? "";

  function parseFactor(): number {
    if (peek() === "-") { consume(); return -parseFactor(); }
    if (peek() === "(") {
      consume();
      const v = parseExpr();
      if (peek() !== ")") throw new Error("missing )");
      consume();
      return v;
    }
    let s = "";
    while (/[\d.]/.test(peek())) s += consume();
    const n = parseFloat(s);
    if (isNaN(n)) throw new Error("invalid number");
    return n;
  }

  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = consume();
      const r = parseFactor();
      if (op === "*") v *= r;
      else if (op === "/") { if (r === 0) throw new Error("divide by zero"); v /= r; }
      else v %= r;
    }
    return v;
  }

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  try {
    const result = parseExpr();
    if (pos !== src.length) throw new Error("unexpected token");
    if (!isFinite(result)) return { error: "结果无效（除以零）" };
    return String(result);
  } catch {
    return { error: `无效的数学表达式：${expression}` };
  }
}

// ── Timeout helper ────────────────────────────────────────────────────────
function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`操作超时（${ms / 1000}s）`)), ms)
    ),
  ]);
}

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
    return errorResponse(400, "fatal", "请求参数错误，请检查字段", "INVALID_REQUEST");
  }
  const { model, prompt, tools: selectedTools } = parsed.data;

  const headerKey = req.headers.get("X-Provider-Api-Key")?.trim();
  const apiKey = headerKey || ENV_KEY_MAP[model];
  if (!apiKey?.trim()) {
    return errorResponse(401, "fatal", "API Key 未提供，请前往设置页配置", "INVALID_KEY");
  }

  let providerModel: ReturnType<typeof getProviderModel>;
  try {
    providerModel = getProviderModel(model, apiKey, { agentMode: true });
  } catch {
    return errorResponse(422, "fatal", "不支持的模型，请重新选择", "UNSUPPORTED_MODEL");
  }

  const origin = new URL(req.url).origin;

  // ── Tool Definitions (AI SDK v6: inputSchema + execute(input)) ──────────
  const allTools = {
    get_current_time: tool({
      description: "获取当前北京时间（Asia/Shanghai，格式：YYYY-MM-DD HH:mm:ss）",
      inputSchema: z.object({}),
      execute: async () =>
        new Date().toLocaleString("zh-CN", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
    }),

    calculate: tool({
      description: "执行基础数学运算，支持 +、-、*、/、% 和括号",
      inputSchema: z.object({
        expression: z
          .string()
          .min(1)
          .max(500)
          .describe("数学表达式，如 '99 * 88'、'(10 + 5) * 3'"),
      }),
      execute: async (input: { expression: string }) => safeCalculate(input.expression),
    }),

    web_search: tool({
      description: "使用 Tavily 搜索引擎获取实时信息",
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe("搜索关键词"),
      }),
      execute: async (input: { query: string }) => {
        const key = process.env.TAVILY_API_KEY;
        if (!key) {
          return { error: "web_search 工具未配置 API Key，请在 .env.local 中添加 TAVILY_API_KEY" };
        }
        try {
          const res = await withTimeout(
            () =>
              fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ api_key: key, query: input.query, max_results: 5, search_depth: "basic" }),
              }).then((r) => r.json()),
            10_000
          );
          return {
            results: (res.results ?? []).map((r: { title: string; url: string; content: string }) => ({
              title: r.title,
              url: r.url,
              snippet: r.content,
            })),
          };
        } catch (e) {
          return { error: "web_search 调用失败：" + (e as Error).message };
        }
      },
    }),

    get_weather: tool({
      description: "获取指定城市的实时天气信息",
      inputSchema: z.object({
        city: z
          .string()
          .min(1)
          .max(100)
          .describe("城市名称，英文，如 Beijing、Shanghai"),
      }),
      execute: async (input: { city: string }) => {
        const key = process.env.OPENWEATHER_API_KEY;
        if (!key) {
          return { error: "get_weather 工具未配置 API Key，请在 .env.local 中添加 OPENWEATHER_API_KEY" };
        }
        try {
          const data = await withTimeout(
            () =>
              fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(input.city)}&appid=${key}&units=metric&lang=zh_cn`
              ).then((r) => r.json()),
            10_000
          );
          if (data.cod !== 200) {
            return { error: `城市 "${input.city}" 未找到，请使用英文城市名` };
          }
          return {
            city: data.name,
            country: data.sys.country,
            temp: data.main.temp,
            feelsLike: data.main.feels_like,
            humidity: data.main.humidity,
            description: data.weather[0].description,
            windSpeed: data.wind.speed,
          };
        } catch (e) {
          return { error: "get_weather 调用失败：" + (e as Error).message };
        }
      },
    }),

    write_file: tool({
      description: "将文本内容写入本地 .txt 文件，保存到 downloads/ 目录",
      inputSchema: z.object({
        filename: z
          .string()
          .describe("文件名，不含路径和扩展名，仅允许字母/数字/下划线/连字符"),
        content: z.string().describe("要写入文件的文本内容"),
      }),
      execute: async (input: { filename: string; content: string }) => {
        try {
          const res = await withTimeout(
            () =>
              fetch(`${origin}/api/tools/write-file`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: input.filename, content: input.content }),
              }).then((r) => r.json()),
            10_000
          );
          if (res.success) {
            return {
              message: `文件已保存到 ${res.path}${res.overwritten ? "（已覆盖原有文件）" : ""}`,
            };
          }
          return { error: res.error ?? "文件写入失败" };
        } catch (e) {
          return { error: "write_file 调用失败：" + (e as Error).message };
        }
      },
    }),
  };

  // 只保留用户勾选的工具
  const activeTools = Object.fromEntries(
    selectedTools
      .filter((name) => name in allTools)
      .map((name) => [name, allTools[name as keyof typeof allTools]])
  );

  // ── Stream ────────────────────────────────────────────────────────────────
  try {
    const result = streamText({
      model: providerModel,
      prompt,
      tools: activeTools,
      stopWhen: stepCountIs(8),
      onError: (error) => {
        console.error("[agent/stream] streamText error", {
          model,
          message: (error as { message?: string }).message,
        });
      },
    });

    // Map fullStream TextStreamPart events → NDJSON AgentStreamEvent lines
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueue = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

        try {
          for await (const chunk of result.fullStream) {
            switch (chunk.type) {
              case "reasoning-delta":
                enqueue({ type: "thinking-delta", delta: chunk.text });
                break;
              case "tool-call":
                enqueue({
                  type: "tool-call",
                  callId: chunk.toolCallId,
                  name: chunk.toolName,
                  arguments: chunk.input as Record<string, unknown>,
                });
                break;
              case "tool-result":
                enqueue({
                  type: "tool-result",
                  callId: chunk.toolCallId,
                  name: chunk.toolName,
                  result: chunk.output,
                });
                break;
              case "tool-error":
                enqueue({
                  type: "tool-result",
                  callId: chunk.toolCallId,
                  name: chunk.toolName,
                  result: null,
                  error: "工具执行错误：" + ((chunk.error as Error)?.message ?? String(chunk.error)),
                });
                break;
              case "text-delta":
                enqueue({ type: "answer-delta", delta: chunk.text });
                break;
              case "finish":
                enqueue({
                  type: "done",
                  usage: chunk.totalUsage
                    ? {
                        promptTokens: chunk.totalUsage.inputTokens,
                        completionTokens: chunk.totalUsage.outputTokens,
                        totalTokens: chunk.totalUsage.totalTokens,
                      }
                    : undefined,
                });
                break;
              case "error":
                enqueue({
                  type: "error",
                  message: "流处理失败，请重试",
                  code: "STREAM_INTERRUPTED",
                });
                break;
            }
          }
        } catch (err) {
          enqueue({
            type: "error",
            message: "流处理失败，请重试",
            code: "STREAM_INTERRUPTED",
          });
          console.error("[agent/stream] fullStream error", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  } catch (error) {
    return mapProviderError(error);
  }
}
