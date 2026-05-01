# API Contract: POST /api/playground/stream

**Version**: 1.0 | **Runtime**: Edge | **Feature**: 001-playground

---

## Endpoint

```
POST /api/playground/stream
```

```ts
export const runtime = 'edge'
export const maxDuration = 60
```

---

## Request

### Headers

| Header | Required | Description |
|---|---|---|
| `Content-Type` | ✅ | `application/json` |
| `X-Provider-Api-Key` | ✅ | 对应供应商的 API Key（来自客户端 localStorage） |

### Body

```json
{
  "model": "deepseek-v4-flash",
  "prompt": "解释 TCP 三次握手"
}
```

| 字段 | 类型 | Required | 约束 |
|---|---|---|---|
| `model` | `ModelId` | ✅ | 必须是枚举值之一 |
| `prompt` | `string` | ✅ | trim 后 min: 1 |

---

## Success Response

**Status**: `200 OK`  
**Content-Type**: `text/event-stream`（Vercel AI SDK data stream 格式）

流式响应逐步携带符合 `PlaygroundResponseSchema` 的 JSON 分块，由 `useObject` hook 自动解析。最终完整 JSON 结构：

```json
{
  "thinking": "首先分析问题...",
  "toolCalls": [
    { "name": "search_docs", "arguments": { "query": "TCP handshake" } }
  ],
  "toolResults": [
    { "name": "search_docs", "result": { "found": 3 } }
  ],
  "answer": "TCP 三次握手过程如下：\n\n1. **SYN**：...",
  "metadata": {
    "model": "deepseek-v4-flash",
    "promptTokens": 12,
    "completionTokens": 248,
    "totalTokens": 260
  }
}
```

---

## Error Responses

所有错误返回 `application/json`，结构固定：

```json
{
  "tier": "fatal | retryable",
  "message": "中文用户可读描述",
  "code": "ERROR_CODE",
  "retryAfterMs": 30000
}
```

| HTTP | `code` | `tier` | `message` | `retryAfterMs` |
|---|---|---|---|---|
| `400` | `INVALID_REQUEST` | `fatal` | 请求参数错误，请检查 model 和 prompt 字段 | — |
| `400` | `CONTEXT_EXCEEDED` | `fatal` | 输入内容过长，请缩短 Prompt 后重试 | — |
| `401` | `INVALID_KEY` | `fatal` | API Key 无效，请前往设置页更新 | — |
| `422` | `UNSUPPORTED_MODEL` | `fatal` | 不支持的模型，请重新选择 | — |
| `429` | `RATE_LIMITED` | `retryable` | 请求过于频繁，请稍后重试 | 取自 `Retry-After` header（默认 30000） |
| `503` | `MODEL_UNAVAILABLE` | `retryable` | 模型暂时不可用，请稍后重试 | — |
| `504` | `TIMEOUT` | `retryable` | 请求超时，请稍后重试 | — |

### 429 特殊处理

`429` 响应同时携带 response header：
```
Retry-After: 30
```
客户端读取 `retryAfterMs`（来自 response body），启动 `useRetryCountdown` hook，发送按钮显示倒计时（如"29s 后可重试"）。

---

## Mid-stream Error

流式传输中途发生错误（网络断开、模型内部错误）时：
- Stream 关闭，`useObject` 的 `onError` 回调触发
- 错误信息：`{ tier: 'retryable', message: '传输中断', code: 'STREAM_INTERRUPTED' }`
- 客户端行为：保留已渲染的卡片内容，响应区顶部追加黄色警告条"传输中断，以下为部分结果"

---

## 供应商路由映射

| ModelId | Provider | SDK 调用方式 | 实际 API 模型名 |
|---|---|---|---|
| `gpt-4o-mini` | OpenAI | `createOpenAI({ apiKey })` | `gpt-4o-mini` |
| `claude-sonnet-4-6` | Anthropic | `createAnthropic({ apiKey })` | `claude-sonnet-4-6-20251020`（带日期后缀） |
| `gemini-2.0-flash` | Google | `createGoogleGenerativeAI({ apiKey })` | `gemini-2.0-flash` |
| `deepseek-v4-flash` | DeepSeek | `createOpenAI({ baseURL }).chat(model)` | `deepseek-v4-flash` |
| `deepseek-v4-pro` | DeepSeek | `createOpenAI({ baseURL }).chat(model)` | `deepseek-v4-pro` |
| `qwen3.6-plus` | Alibaba dashscope | `createOpenAI({ baseURL }).chat(model)` | `qwen3.6-plus` |

注：旧名 `deepseek-chat` / `deepseek-reasoner` 已弃用，不在支持列表内。

---

## 安全约束

- `X-Provider-Api-Key` header MUST NOT 被写入任何日志、trace、或 Vercel 可观测数据
- API Key MUST NOT 出现在 error response body 中
- Edge Route MUST NOT 缓存任何请求内容
