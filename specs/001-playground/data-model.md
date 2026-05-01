# Data Model: Playground 流式结构化响应

**Phase**: 1 | **Date**: 2026-04-30 | **Feature**: 001-playground

---

## 实体概览

```
PlaygroundRequest ──sends──► Edge Route ──calls──► Provider
                                                       │
                                                       ▼
PlaygroundSession ◄──saves── PlaygroundResponse ◄─── stream
       │
PlaygroundError ─── (on failure, replaces response)
```

---

## PlaygroundRequest

前端发送到 Edge Route 的请求体。

| 字段 | 类型 | Required | 约束 |
|---|---|---|---|
| `model` | `ModelId` | ✅ | 必须是 ModelId enum 中的值 |
| `prompt` | `string` | ✅ | min: 1，trim 后非空 |

**Header**: `X-Provider-Api-Key: string` — 对应供应商的 API Key

---

## PlaygroundResponse（Zod schema，前后端共用）

流式结构化响应主体，对应 `src/shared/schemas/playgroundResponse.ts`。

| 字段 | 类型 | Required | 流式行为 | 约束 |
|---|---|---|---|---|
| `thinking` | `string` | optional | 最先到达（若支持） | 无上限；>10000字卡片默认折叠 |
| `toolCalls` | `ToolCall[]` | optional | 思考后到达 | max: 20 |
| `toolResults` | `ToolResult[]` | optional | toolCalls 之后到达 | max: 20 |
| `answer` | `string` | **required** | 最后到达 | min: 1（流完成后） |
| `metadata` | `Metadata` | optional | 流关闭后写入 | — |

---

## ToolCall

| 字段 | 类型 | Required | 约束 |
|---|---|---|---|
| `name` | `string` | ✅ | min: 1 |
| `arguments` | `Record<string, unknown>` | ✅ | 任意 JSON object |

---

## ToolResult

| 字段 | 类型 | Required | 约束 |
|---|---|---|---|
| `name` | `string` | ✅ | min: 1，与对应 ToolCall.name 一致 |
| `result` | `unknown` | ✅ | 任意 JSON 值 |
| `error` | `string` | optional | 工具调用失败时的错误描述 |

---

## Metadata

| 字段 | 类型 | Required | 约束 |
|---|---|---|---|
| `model` | `ModelId` | ✅ | 实际使用的模型 |
| `promptTokens` | `number` | optional | int ≥ 0 |
| `completionTokens` | `number` | optional | int ≥ 0 |
| `totalTokens` | `number` | optional | int ≥ 0 |

---

## PlaygroundError（独立 schema，用于错误响应 JSON 体）

| 字段 | 类型 | Required | 约束 |
|---|---|---|---|
| `tier` | `ErrorTier` | ✅ | `"fatal"` \| `"retryable"` |
| `message` | `string` | ✅ | 中文用户可读描述 |
| `code` | `string` | ✅ | 机器可读错误码（见 API 合约） |
| `retryAfterMs` | `number` | optional | int > 0；仅 retryable 且来自 429 时存在 |

---

## Enum: ModelId

```
"gpt-4o-mini"        → OpenAI
"claude-sonnet-4-6"  → Anthropic（route 内部调用 "claude-sonnet-4-6-20251020"）
"gemini-2.0-flash"   → Google
"deepseek-v4-flash"  → DeepSeek（OpenAI-compatible），默认值
"deepseek-v4-pro"    → DeepSeek（OpenAI-compatible）
"qwen3.6-plus"       → Alibaba dashscope（OpenAI-compatible；旧名 qwen-turbo 已弃用）
```
注：旧名 `"deepseek-chat"` / `"deepseek-reasoner"` 已弃用，不在枚举内。
注：`"claude-sonnet-4-6"` 是前端 ModelId 抽象；Edge Route 实际透传给 Anthropic API 的模型名含日期后缀，见 `route.ts` `getProviderModel()`。

---

## Enum: ErrorTier

```
"fatal"      → 需要用户手动修正（401/400），红色卡片，无自动重试
"retryable"  → 可稍后自动恢复（429/503/流中断），橙色卡片，含倒计时
```

---

## PlaygroundSession（sessionStorage 结构）

存储在 `sessionStorage['playground:last-response']`，同 Tab 刷新后恢复。

| 字段 | 类型 | 说明 |
|---|---|---|
| `response` | `PlaygroundResponse` | 完整的结构化响应 JSON |
| `model` | `ModelId` | 发送该请求时使用的模型 |
| `prompt` | `string` | 发送该请求时的 prompt（用于回显） |
| `savedAt` | `number` | `Date.now()` 时间戳 |

**读取时机**: `useEffect` on mount（避免 SSR hydration mismatch）  
**写入时机**: `onFinish` 回调（仅完整响应，中断/错误不写入）  
**清除时机**: Tab 关闭（sessionStorage 原生行为），或下次请求开始时覆盖

---

## 状态机：PlaygroundPage UI 状态

```
idle ──► loading ──► streaming ──► complete
  │          │                        │
  │          └──► error-fatal          │
  │          └──► error-retryable     │
  │                    │              │
  └────────────────────┘              │
  ◄───────────────────────────────────┘
```

| 状态 | 描述 | 输入框 | 模型选择器 | 发送按钮 |
|---|---|---|---|---|
| `idle` | 初始或上次完成后 | 可用 | 可用 | 可用（非空时） |
| `loading` | 请求已发出，等待首个 token | 禁用 | 禁用 | 禁用 |
| `streaming` | 首个 token 已到达，流进行中 | 禁用 | 禁用 | 禁用 |
| `complete` | 流关闭，响应完整 | 可用 | 可用 | 可用 |
| `error-fatal` | 401/400 类错误 | 可用 | 可用 | 可用 |
| `error-retryable` | 429/503/流中断 | 可用 | 可用 | 倒计时结束前禁用 |
