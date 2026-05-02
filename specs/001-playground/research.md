# Research: Playground 流式结构化响应

**Phase**: 0 | **Date**: 2026-04-30 | **Feature**: 001-playground

---

## 决策 1：供应商接入策略

**Decision**: 使用 `@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/google` 各自的官方 AI SDK provider；DeepSeek 和 Qwen（dashscope）使用 `createOpenAI({ baseURL, compatibility: 'compatible' })()` 接入 OpenAI-compatible endpoint。

**Rationale**: 宪法要求所有 AI 调用走 Vercel AI SDK，不得直接 import OpenAI/Anthropic SDK。各 `@ai-sdk/*` provider 已封装好 Edge Runtime 兼容性和 `streamObject` 支持。DeepSeek 和 Qwen 提供 OpenAI-compatible API，可通过 `createOpenAI({ baseURL, compatibility: 'compatible' })` 直接接入，无需额外 SDK。

**Alternatives considered**: OpenRouter 统一网关（避免多 provider 依赖）—— 被拒绝，因为多 provider 直连可让错误信息更精确（各供应商返回不同的 HTTP 状态码和错误体），便于两档错误分类（fatal/retryable）。

---

## 决策 2：`thinking` 字段处理策略

**Decision**: Edge Route 中按模型分支：支持 native structured output 的模型（OpenAI、Anthropic claude-3.x+）直接使用 `streamObject` 的 JSON mode；DeepSeek 系列通过 `mode: 'json'` + system prompt 引导；同时实现 `extractThinkingFromTags()` 预处理函数提取 `<think>...</think>` 内容映射到 `thinking` 字段。

**Rationale**: DeepSeek R1 和部分模型的思维链是 `<think>` 标签流，不是 JSON 字段。若不预处理，`streamObject` 会因非法 JSON 解析失败，`thinking` 卡片永远无法渲染。提取函数在 Edge Route 层处理，前端无需感知差异。

**Alternatives considered**: 将 `thinking` 改为 optional 且直接依赖模型的结构化输出 —— 被拒绝，因为 DeepSeek R1 不稳定输出结构化 JSON；Anthropic Extended Thinking 需要特殊 API 参数，统一处理更安全。

---

## 决策 3：API Key 传输方式

**Decision**: 客户端将对应供应商 API Key 放在自定义请求头 `X-Provider-Api-Key` 中发送给 Edge Route；Edge Route 读取后透传给供应商，MUST NOT 写入任何日志。

**Rationale**: HTTPS 保障传输安全；自定义 header 在 Vercel 的默认 Access Log 中不被记录（request body 偶有记录风险）；命名 `X-Provider-Api-Key` 与未来可能引入的 `Authorization`（用于 AgentHub 自身鉴权）区分开。

**Alternatives considered**: Request body 传 Key —— 被拒绝，body 可能进日志；URL query param —— 绝对拒绝，明文暴露在服务器日志和浏览器历史中。

---

## 决策 4：sessionStorage 读取的 SSR 安全策略

**Decision**: `playground-session.ts` 所有读写用 `typeof window !== 'undefined'` guard；`PlaygroundPage` 在 `useEffect` 中读取，初始渲染为空白态（无内容，无骨架），避免 hydration mismatch。

**Rationale**: Next.js App Router 的 Server Components 在 Node.js 环境执行，`sessionStorage` 不存在。Client Component 的首次 SSR 和 CSR hydration 需要初始状态一致，才能避免 React 的 hydration warning。

**Alternatives considered**: 整个 `PlaygroundPage` 加 `dynamic('only-client')`（禁用 SSR）—— 被拒绝，会增加页面 FCP 时间，且 Next.js 不建议对整个页面禁用 SSR；更细粒度的 `useEffect` 方案收益更好。

---

## 需要安装的新依赖

| 包 | 版本范围 | 用途 |
|---|---|---|
| `ai` | `^4.x` | Vercel AI SDK core（streamObject、useObject） |
| `@ai-sdk/openai` | `^1.x` | OpenAI provider |
| `@ai-sdk/anthropic` | `^1.x` | Anthropic provider |
| `@ai-sdk/google` | `^1.x` | Google Gemini provider |
| `zod` | `^3.x` | Schema 定义与验证 |
| `react-markdown` | `^9.x` | AnswerCard Markdown 渲染 |
