import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { DeepResearchRequestSchema } from "@/shared/schemas/deepresearch";
import { errorResponse, mapProviderError, getProviderModel, ENV_KEY_MAP } from "@/lib/ai-provider";

export const runtime = "edge";
export const maxDuration = 60;

const DEEPRESEARCH_SYSTEM_PROMPT = `你是一名专业深度研究员。收到研究主题后，必须按三阶段工作：

**阶段一：研究规划**
在思考中制定检索策略：分析核心议题、列出 4-6 个具体搜索关键词、确定多角度研究方向。

**阶段二：多轮检索**
使用 web_search 工具执行多轮搜索（至少 5 次）：
- 每次搜索后评估结果，决定下一个搜索方向
- 对不同角度、不同时期、不同来源进行交叉验证
- 记录重要来源的标题和 URL

**阶段三：综合报告**
基于所有搜索结果，输出以下四章节结构的研究报告：

## 执行摘要
[2-3 句话概括核心发现]

## 主要发现
[分点列出 5-8 个关键发现，每点附简要说明]

## 来源与参考
[列出 5-10 个重要来源，格式：标题 — URL]

## 结论与建议
[基于研究给出 3-5 条可行建议]

重要：最终回答必须包含上述四个章节；所有主张必须有来源支撑；不得编造事实。`;

function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`操作超时（${ms / 1000}s）`)), ms)
    ),
  ]);
}

export async function POST(req: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse(400, "fatal", "请求体格式错误，需要 JSON", "INVALID_REQUEST");
  }

  const parsed = DeepResearchRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorResponse(400, "fatal", "请求参数错误，请检查 model 和 prompt 字段", "INVALID_REQUEST");
  }
  const { model, prompt } = parsed.data;

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

  const webSearchTool = tool({
    description: "使用 Tavily 搜索引擎获取实时信息，用于深度研究",
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
          8_000
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
  });

  try {
    const result = streamText({
      model: providerModel,
      system: DEEPRESEARCH_SYSTEM_PROMPT,
      prompt,
      tools: { web_search: webSearchTool },
      stopWhen: stepCountIs(15),
      onError: (error) => {
        console.error("[deepresearch/stream] streamText error", {
          model,
          message: (error as { message?: string }).message,
        });
      },
    });

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
                  error: "搜索超时或失败，AI 将基于已有信息继续研究",
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
                  message: "研究过程中断，请尝试更简短的研究主题",
                  code: "STREAM_INTERRUPTED",
                });
                break;
            }
          }
        } catch (err) {
          enqueue({
            type: "error",
            message: "研究过程超时，请尝试更简短的研究主题",
            code: "STREAM_INTERRUPTED",
          });
          console.error("[deepresearch/stream] fullStream error", err);
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
