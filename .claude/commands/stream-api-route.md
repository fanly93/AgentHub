---
description: 帮你生成 Next.js 15 流式 AI API 路由，Edge Runtime + streamObject，带完整容错
argument-hint: "[路由路径 + 产出描述，例如：/api/agent/run，生成 Agent 运行记录]"
allowed-tools: Read, Write
---

## 第 1 步：判断你是不是真的需要流式

流式 API 不是越多越好——加了流式，前端复杂度至少翻倍。先回答 3 个问题再决定。

**Q1：你的 AI 响应是否超过 3 秒？**
> 不到 3 秒的话，一个 loading spinner 就够了，用户感知不到差别，流式纯粹是增加麻烦。

**Q2：用户是否需要看到生成过程？**
> 比如边生成边显示思考链、逐条冒出的列表——像 ChatGPT 那样。如果只是"等一下，结果来了"，不需要流式。

**Q3：你的前端是否有能力处理流式数据？**
> 比如已经用了 `useObject` / `useChat` 这类 hook。如果前端只会 `fetch` + `await res.json()`，流式数据会直接变成乱码。

---

**判断规则：**

✅ 3 个都 Y → 你需要流式，继续往下走。

❌ 任何一个 N → 用普通 API Route + loading spinner 就够，不要过度工程化。非流式路径更简单、更好调试、出错了也更好排查。

---

## 第 2 步：告诉我关键信息

> **如果你在调用时已经把路由路径、输入结构、产出形状都说清楚了，我会直接跳过这 4 个问题，用下方默认值帮你生成，并在代码顶部注释里标出每个默认值的位置，方便你改。**

如果没说清楚，我需要了解：

1. **AI provider 是哪家？** OpenAI / Anthropic / DeepSeek / Dashscope / 其他（影响 import 和模型 ID 格式）
2. **模型 ID 是什么？** 例如 `openai/gpt-5.4-mini`（OpenRouter 命名）或 `claude-sonnet-4-6`（原厂）
3. **有没有已经设计好的 Zod schema？** 没有的话，建议先跑 `/schema-design` 把 schema 造好再来，否则我会帮你内嵌一段示范 schema
4. **预估最长响应时间是多少秒？** 用来设 `maxDuration`，Edge Runtime 上限 300 秒

**默认值（只说"帮我造流式 API"时使用）：**
- provider → OpenAI（`@ai-sdk/openai`）
- model → `openai/gpt-5.4-mini`（OpenRouter 命名）
- schema → 根据你描述的产物结构现造一段示范 schema 内嵌进去
- maxDuration → `60`

---

## 第 3 步：4 件套产出

---

### 产出 1：完整的 Next.js API Route

以下是生成代码时严格遵守的 6 条硬性要求，少一条都不行：

1. `export const runtime = "edge"` — Edge Runtime，低延迟、全球分发
2. `export const maxDuration = 60` — 防止 Vercel 默认 10 秒超时截断长响应
3. `streamObject` 必须加 `onError` 回调 — 防止 AI provider 报错时前端收到空流、静默失败
4. 必须用 `toTextStreamResponse()` — 不用已废弃的 `toAIStreamResponse()`
5. system prompt 里显式要求"严格遵守 schema + 不返回纯文本"
6. provider 必须用 `createOpenAI({ apiKey, baseURL })` 工厂函数 — 支持 OpenRouter / 自建代理，不用裸 `import { openai }`

```ts
// app/api/[your-route]/route.ts
//
// ── 默认值说明（按需修改）─────────────────────────────────────
// DEFAULT_MODEL    = "openai/gpt-5.4-mini"   ← OpenRouter 命名；原厂账号去前缀
// DEFAULT_DURATION = 60                       ← 秒，Edge Runtime 上限 300
// DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL ← 未设则走 OpenAI 官方
// ────────────────────────────────────────────────────────────

import { streamObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

// ── Runtime 配置 ──────────────────────────────────────────────
export const runtime = "edge";
export const maxDuration = 60; // DEFAULT_DURATION

// ── Provider 初始化 ──────────────────────────────────────────
// 支持 OpenRouter / 自建代理：设 OPENAI_BASE_URL 即可切换
// OpenRouter 主流模型（2026-04）：
//   openai/gpt-5.4-mini · openai/gpt-5.4-nano
//   anthropic/claude-haiku-4.5 · anthropic/claude-sonnet-4-6
//   google/gemini-2.5-flash · google/gemini-2.5-pro
//   deepseek/deepseek-chat · deepseek/deepseek-v4-flash
//   qwen/qwen3.5-flash · qwen/qwen3.6-plus
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_BASE_URL, // 未设则走 OpenAI 官方
});

// ── Zod Schema（替换为你的 schema，或用 /schema-design 生成）──
const outputSchema = z.object({
  // 示范字段，请替换为你的实际 schema
  summary: z.string().min(10).max(500).describe("生成结果的摘要，10~500字"),
  items: z
    .array(
      z.object({
        title: z.string().min(2).max(80).describe("条目标题"),
        content: z.string().min(5).max(300).describe("条目正文"),
      })
    )
    .min(1)
    .max(10)
    .describe("生成的条目列表，1~10条"),
});

// ── 请求体类型 ────────────────────────────────────────────────
const requestSchema = z.object({
  prompt: z.string().min(1).max(2000),
});

// ── Route Handler ─────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "请求参数有误", detail: parsed.error.format() }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { prompt } = parsed.data;

  const result = streamObject({
    model: openai("openai/gpt-5.4-mini"), // DEFAULT_MODEL
    schema: outputSchema,
    system: `你是一个专业助手，必须严格遵守以下规则：
1. 严格遵守 schema 结构，不得新增或删减字段
2. 不要返回纯文本，所有内容必须填进 schema 的对应字段
3. 字段长度限制必须遵守，不要超出 describe 中标注的字符上限`,
    prompt,
    onError: (error) => {
      // 防止 AI provider 报错时前端收到空流、静默失败
      console.error("[streamObject error]", error);
    },
  });

  return result.toTextStreamResponse();
}
```

---

### 产出 2：前端 `useObject` hook 调用代码

```tsx
"use client";

import { useObject } from "ai/react";
import { outputSchema } from "@/lib/schemas/your-schema"; // 替换为你的 schema 路径

export function YourComponent() {
  const { object, submit, isLoading, error } = useObject({
    api: "/api/your-route", // 替换为你的路由路径
    schema: outputSchema,
  });

  // 错误展示
  if (error) {
    return (
      <div className="text-destructive text-sm">
        生成失败：{error.message ?? "未知错误，请重试"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => submit({ prompt: "你的 prompt 内容" })}
        disabled={isLoading}
        className="..."
      >
        {isLoading ? "生成中…" : "开始生成"}
      </button>

      {/* 流式过程中字段可能是 undefined，全部加 ?? 兜底 */}
      <p className="text-sm text-muted-foreground">
        {object?.summary ?? (isLoading ? "思考中…" : "—")}
      </p>

      <ul className="space-y-2">
        {(object?.items ?? []).map((item, i) => (
          <li key={i} className="rounded border p-3">
            <p className="font-medium">{item?.title ?? "…"}</p>
            <p className="text-sm text-muted-foreground">{item?.content ?? "…"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### 产出 3：环境变量模板

在项目根目录的 `.env.example` 里追加以下条目，提交进仓库让团队成员知道要配什么：

```bash
# ── AI Provider（必填其一）────────────────────────────────────
OPENAI_API_KEY=sk-...           # OpenAI 官方 或 OpenRouter 的 key

# ── Base URL（可选）─────────────────────────────────────────
# 不设则走 OpenAI 官方；填 OpenRouter 则模型命名加 openai/ 前缀
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# ── 其他 provider（按需）────────────────────────────────────
# ANTHROPIC_API_KEY=sk-ant-...
# DEEPSEEK_API_KEY=sk-...
# DASHSCOPE_API_KEY=sk-...
```

> **建议**：环境变量越多越容易漏配，跑 `/zod-env` 帮你加 build-time 校验，部署前就能发现缺 key，不用等到运行时报错。

---

### 产出 4：判断力检查

这个 API Route 能跑，但还可以更健壮：

| 现在的写法 | 更好的做法 | 为什么 |
|-----------|-----------|--------|
| 没有限流 | 加 `@upstash/ratelimit` 或 Vercel KV 限流，每用户每分钟最多 N 次 | 不限流的流式接口是免费的 GPU 矿机，一个恶意用户就能把你的 API 账单打爆 |
| prompt 只做了长度校验 | 加内容安全过滤（如 OpenAI Moderation API 或自定义关键词黑名单） | 流式接口响应快，用户来不及看到拒绝就已经开始消费 token |
| token 用量无感知 | 在 `onFinish` 回调里记录 `usage.totalTokens`，写进日志或数据库 | 不记录 token 就不知道哪个功能在烧钱，成本优化无从下手 |
| `maxDuration = 60` 写死 | 按场景区分：摘要类 30s / 长文生成 120s / Agent 多步骤 300s | 设太短会截断正常响应；设太长让超时请求白占资源 |
| 没有请求签名 | 加 `Authorization` header 校验或 CSRF token（对公网暴露的接口） | 纯靠 CORS 拦截不了服务端直接调用，任何人都能直接 curl 你的接口 |

