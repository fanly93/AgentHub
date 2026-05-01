# Implementation Plan: Playground 页 — 流式结构化 AI 响应

**Branch**: `001-playground` | **Date**: 2026-04-30 | **Spec**: `specs/001-playground/spec.md`  
**Input**: Feature specification from `/specs/001-playground/spec.md`

---

## Summary

实现 AgentHub Playground 页面：用户选择模型（≥5 家供应商）、输入 Prompt、通过 Vercel AI SDK `streamText` 获取流式文本响应，客户端以 `parsePartialJson` 逐步解析为结构化 JSON，并以四种独立卡片（思考过程/工具调用/工具结果/最终答案）逐字段渲染。新增 Edge Runtime API Route、Zod 共用 schema（前后端共用类型，运行时约束改由 system prompt 承担）、sessionStorage 同 Tab 恢复、两档错误处理（fatal/retryable）和 Retry-After 自适应冷却。

---

## Technical Context

**Language/Version**: TypeScript 5，strict 模式  
**Primary Dependencies**: Next.js 16.2.4 (App Router)、React 19.2.4、Vercel AI SDK ai@6（已安装：`ai@6.0.170`、`@ai-sdk/openai@3.0.54`、`@ai-sdk/anthropic`、`@ai-sdk/google`）、Zod 4.x（已安装）、react-markdown（已安装）  
**Storage**: 仅 `sessionStorage`（最后一次完整响应，同 Tab 恢复）；无服务端数据库  
**Testing**: 手工验收（对照 spec AC），CI 类型检查  
**Target Platform**: 桌面浏览器 ≥ 1024px，Next.js Edge Runtime（AI Route）  
**Performance Goals**: 首个 token 出现时间 < 2s（P95）  
**Constraints**: Edge Runtime 单次调用上限 60s；API Key 存客户端 localStorage，不落服务端日志  
**Scale/Scope**: 单用户单 Tab，无并发场景

---

## Constitution Check

| 红线 / 原则 | 状态 | 说明 |
|---|---|---|
| AI 调用必须走 Vercel AI SDK，不得直接 import OpenAI | ✅ 合规 | 所有供应商通过 `@ai-sdk/*` 接入 |
| Edge Runtime，60s 硬上限 | ✅ 合规 | route.ts 声明 `export const runtime = 'edge'` |
| 无服务端数据库 | ✅ 合规 | 仅 sessionStorage，无 Prisma/Redis |
| 无用户认证 | ✅ 合规 | API Key 存 localStorage，无登录系统 |
| 骨架屏优先，禁止批式加载 | ✅ 合规 | useObject 流式填充，骨架屏按字段独立替换 |
| 颜色/间距走 @theme token | ✅ 合规 | 使用 `--destructive`、`--accent` 等 CSS 变量 |
| 禁止 MUI/Ant Design/Chakra | ✅ 合规 | 仅用 shadcn/ui + Radix UI |
| 禁止 `any` 类型无注释 | ✅ 合规 | Zod schema 覆盖所有响应字段 |
| 仅 App Router（src/app/） | ✅ 合规 | 新增 src/app/playground/page.tsx |
| 结构化输出，禁止自由聊天 | ✅ 合规 | streamObject + Zod schema 强制结构化 |

---

## 1. 文件结构

### 规划文档（本 Feature）

```text
specs/001-playground/
├── plan.md              ← 本文件（/speckit-plan 输出）
├── research.md          ← Phase 0 研究结论
├── data-model.md        ← Phase 1 数据模型
├── contracts/
│   └── playground-stream.md   ← API 合约文档
└── tasks.md             ← Phase 2 任务（/speckit-tasks 命令生成）
```

### 源代码（新增 / 修改文件）

```text
agenthub/
├── package.json                          ← 修改：新增 ai / zod / @ai-sdk/* / react-markdown
│
├── src/
│   ├── shared/
│   │   └── schemas/
│   │       └── playgroundResponse.ts     ← 新增：Zod schema，前后端共用（AC-9）
│   │
│   ├── lib/
│   │   ├── models.ts                     ← 新增：ModelId 枚举 + 供应商路由配置 + localStorage Key 名映射
│   │   └── playground-session.ts         ← 新增：sessionStorage 读写工具（同 Tab 恢复，Clarification-5B）
│   │
│   ├── hooks/
│   │   └── useRetryCountdown.ts          ← 新增：Retry-After 倒计时 hook（FR-015）
│   │
│   ├── app/
│   │   ├── playground/
│   │   │   └── page.tsx                  ← 新增：Playground 页面，Client Component，编排所有子组件
│   │   │
│   │   └── api/
│   │       └── playground/
│   │           └── stream/
│   │               └── route.ts          ← 新增：POST /api/playground/stream，Edge Runtime（FR-004/FR-005）
│   │
│   └── components/
│       └── playground/
│           ├── ModelSelector.tsx          ← 新增：模型下拉选择器，流式中禁用（FR-013）
│           ├── PromptInput.tsx            ← 新增：多行输入框，字符计数，Cmd+Enter，清空按钮（FR-002/FR-014）
│           ├── ResponseArea.tsx           ← 新增：响应区容器，管理骨架屏与卡片切换（FR-007/FR-008）
│           ├── ErrorCard.tsx              ← 新增：fatal=红色 / retryable=橙色，含 Retry-After 倒计时（FR-010/FR-015）
│           ├── CopyJsonButton.tsx         ← 新增：复制原始 JSON，2s 反馈（FR-009）
│           └── cards/
│               ├── ThinkingCard.tsx       ← 新增：思考过程卡，Collapsible，>10000字默认收起（FR-007）
│               ├── ToolCallCard.tsx       ← 新增：工具调用卡，Table 布局（FR-007）
│               ├── ToolResultCard.tsx     ← 新增：工具调用结果卡，Table 布局（FR-007）
│               └── AnswerCard.tsx         ← 新增：最终答案卡，react-markdown 渲染（FR-007）
```

---

## 2. 数据流

```text
用户操作
  │
  ├─ ModelSelector → selectedModel: ModelId（state）
  │    └─ 流式中禁用（isLoading === true 时，FR-013）
  │
  ├─ PromptInput → prompt: string（state）
  │    ├─ charCount 实时计算 → >4000 显示橙色警告（FR-014）
  │    └─ Cmd+Enter / 点击"发送" → handleSubmit()
  │
  └─ handleSubmit()
       │
       ▼
  useObject<PlaygroundResponse>({             ← Vercel AI SDK v5 hook
    api: '/api/playground/stream',
    schema: PlaygroundResponseSchema,          ← 共用 Zod schema（AC-9）
    onFinish: ({ object }) =>
      sessionStorage.write(object),           ← 完整响应持久化（FR-016）
    onError: (err) =>
      setError(parseErrorTier(err))           ← 两档错误（FR-010）
  })
       │
       │  POST /api/playground/stream
       │  body: { model, prompt }
       │  header: X-Provider-Api-Key: <localStorage key>
       ▼
  Edge Route (route.ts)  ← export const runtime = 'edge'
       │
       ├─ 验证 body（Zod）
       ├─ 根据 model 路由 provider：
       │    gpt-4o-mini        → @ai-sdk/openai
       │    claude-sonnet-4-6  → @ai-sdk/anthropic
       │    gemini-2.0-flash   → @ai-sdk/google
       │    deepseek-*/qwen-*  → createOpenAI({ baseURL, compatibility:'compatible' })（openai-compatible endpoint）
       │
       ├─ streamObject({
       │    model: providerModel,
       │    schema: PlaygroundResponseSchema,  ← 同一 schema 实例
       │    prompt,
       │    system: '以 JSON 格式输出，严格遵守 schema...'
       │  })
       │
       ├─ 捕获 provider 错误 → 映射到 ErrorTier → 返回 JSON 错误响应
       │    401 → fatal / 400 → fatal / 429 → retryable + Retry-After header
       │    503/timeout → retryable
       │
       └─ 返回 AI data stream（text/event-stream）
              │
              ▼
       useObject 逐步填充 object: Partial<PlaygroundResponse>
              │
              ▼
       ResponseArea 监听 object + isLoading
              │
       ┌──────┴──────────────────────────────────────────────┐
       │ thinking 有值 → ThinkingCard（timeline，流式 shimmer）│
       │ toolCalls 有值 → ToolCallCard（table）               │
       │ toolResults 有值 → ToolResultCard（table）           │
       │ answer 有值 → AnswerCard（react-markdown）           │
       │ 字段未到 + isLoading → 对应卡片位置显示 Skeleton     │
       │ error 有值 → ErrorCard（fatal=红 / retryable=橙）    │
       └──────────────────────────────────────────────────────┘
              │
       流关闭（isLoading = false）
              │
       ├─ 解锁 PromptInput + ModelSelector
       └─ sessionStorage 写入完整 JSON（playground-session.ts）

页面刷新（同 Tab）
       │
       └─ useEffect mount → sessionStorage.read() → 恢复上次完整响应（FR-016）
```

---

## 3. Schema 设计（描述，不含代码）

> 具体 Zod 代码由 `/schema-design` 命令生成，路径：`src/shared/schemas/playgroundResponse.ts`

### 顶层字段

| 字段 | 类型 | Required | 说明 |
|---|---|---|---|
| `thinking` | `string` | optional | 思考过程；模型不支持时缺失；>10000字时卡片默认折叠 |
| `toolCalls` | `ToolCall[]` | optional | 工具调用列表；无工具调用时缺失；**max: 20** |
| `toolResults` | `ToolResult[]` | optional | 工具调用结果；与 toolCalls 长度对应；**max: 20** |
| `answer` | `string` | **required** | 最终答案，Markdown 格式；流式过程中最后到达 |
| `metadata` | `Metadata` | optional | token 用量；流完成后填入 |

### 嵌套结构

**ToolCall**: `{ name: string(min:1), arguments: Record<string, unknown> }`

**ToolResult**: `{ name: string(min:1), result: unknown, error?: string }`

**Metadata**: `{ model: ModelIdEnum, promptTokens?: int≥0, completionTokens?: int≥0, totalTokens?: int≥0 }`

### Enum 字段

**ModelId enum**（6个值）: `gpt-4o-mini | claude-sonnet-4-6 | gemini-2.0-flash | deepseek-v4-flash | deepseek-v4-pro | qwen3.6-plus`（旧名 `deepseek-chat` / `deepseek-reasoner` 已弃用；`qwen-turbo` 已替换为 `qwen3.6-plus`）

**ErrorTier enum**: `fatal | retryable`

### 独立错误 Schema（不在流式响应内，用于错误 JSON 响应体）

**PlaygroundError**: `{ tier: ErrorTier, message: string, code: string, retryAfterMs?: int>0 }`

### 流式行为规则

- `answer` 是唯一必须字段；流式过程中可先以空字符串占位，逐步填充
- `thinking` / `toolCalls` / `toolResults` 在流到达前保持 `undefined`，对应卡片显示骨架屏
- `metadata` 在流完全关闭后写入，不参与流式渲染

---

## 4. API 边界

### `POST /api/playground/stream`

```
export const runtime = 'edge'
export const maxDuration = 60  // Edge Runtime 上限
```

**Request**

```json
// Body (application/json)
{ "model": "deepseek-v4-flash", "prompt": "解释 TCP 三次握手" }

// Headers
X-Provider-Api-Key: sk-...   // 对应供应商的 API Key，来自客户端 localStorage
```

**Success Response**: `Content-Type: text/event-stream`  
AI SDK data stream，逐步携带符合 `PlaygroundResponseSchema` 的 JSON 分块。

**Error Responses** (application/json)

| HTTP | code | tier | 场景 |
|---|---|---|---|
| `400` | `CONTEXT_EXCEEDED` | `fatal` | Prompt 超出模型上下文窗口 |
| `400` | `INVALID_REQUEST` | `fatal` | 请求体字段缺失或类型错误 |
| `401` | `INVALID_KEY` | `fatal` | API Key 无效或未提供 |
| `429` | `RATE_LIMITED` | `retryable` | 供应商速率限制，附 `Retry-After` header（秒） |
| `503` | `MODEL_UNAVAILABLE` | `retryable` | 模型暂时不可用或维护中 |
| `504` | `TIMEOUT` | `retryable` | Edge Runtime 60s 超时 |

**Error Response Body**:
```json
{
  "tier": "retryable",
  "message": "请求过于频繁，请稍后重试",
  "code": "RATE_LIMITED",
  "retryAfterMs": 30000
}
```

**Mid-stream Error**: 流式中断时，stream 关闭并通过 `useStructuredStream` 的 `onError` 回调传递 `STREAM_INTERRUPTED` 错误，客户端检测 `object` 已有部分内容则显示黄色警告条并保留内容（FR-010）。

---

## 5. 技术决策

### 决策 1 — `streamText` + `parsePartialJson`（原计划 `streamObject`，已变更）

**原计划**：使用 `streamObject` 强制 AI 按 Zod schema 输出，支持按字段逐步填充。

**实际变更**：实现时发现 ai@6 中 `streamObject` 默认向 DeepSeek/Qwen 等 OpenAI-compatible 端点发送 `response_format: { type: 'json_schema' }`，这些供应商返回 `"This response_format type is unavailable now"`（HTTP 400）。因此改用 `streamText`，服务端通过 system prompt 要求模型输出合法 JSON，客户端以 `parsePartialJson`（来自 ai@6）逐步累积解析。

**影响**：Zod schema 仍保留，用于前后端类型共享，但运行时约束从"SDK 强制"降级为"system prompt 软引导"——模型输出格式不符时，`parsePartialJson` 解析结果为 `undefined`，对应卡片持续显示骨架屏而非报错。骨架屏按字段 `undefined`/有值决定显示，行为与原方案一致。

### 决策 2 — Edge Runtime

宪法第三条锁定，不可替换。工程收益：冷启动 < 100ms（vs Node.js ~500ms），直接缩短 TTFT；全球边缘节点就近处理流式请求，降低延迟抖动；Vercel AI SDK 所有主流 provider 均支持 Edge Runtime。60s 上限对正常 AI 响应（5–30s）无影响。

### 决策 3 — Schema 放 `shared/schemas/`，前后端共用

`useStructuredStream` hook 消费 Zod schema 的 TypeScript 类型；客户端以 `parsePartialJson` 解析流文本，结果 cast 为 `DeepPartial<PlaygroundResponse>`。共用同一文件保证类型同步——字段变更只改一处，TypeScript 编译器在两侧同时报错。各自维护必然漂移，是 spec AC-9 明确禁止的风险。

### 决策 4 — 自定义 `useStructuredStream` hook（原计划 `useObject`，已变更）

**原计划**：使用 Vercel AI SDK v5 的 `useObject` hook。

**实际变更**：ai@6 完全移除了 `useObject` 和 `ai/react` 子路径。因此实现了自定义 `useStructuredStream<T>` hook：内部使用原生 `fetch` + `ReadableStream` + `TextDecoder` 累积文本，以 `parsePartialJson`（ai@6 提供）逐步解析 `DeepPartial<T>`，提供等价的 `{ object, isLoading, error, submit, stop }` 接口。行为与 `useObject` 一致：流式逐步更新 `object`，`onFinish`/`onError` 生命周期完整，支持 `AbortController` 取消。

### 决策 6 — `metadata` 字段当前永久为 `undefined`

`streamText` 的 `onFinish` 可获取 `usage`（promptTokens/completionTokens），但当前实现未将其写入响应流（Edge Route 返回的是纯文本流，客户端无法从中读取 token 统计）。因此 `PlaygroundResponse.metadata` 在本实现中永远为 `undefined`，schema 中保留该字段仅作类型预留，待后续改用双通道（text stream + metadata stream）时启用。此偏差已知且可接受。

### 决策 7 — 本 Spec 只存 `sessionStorage`，不做长期历史

Out of Scope 明确声明不实现历史功能（RunHistory Spec 负责）。`sessionStorage` 满足 Clarification-5B（同 Tab 刷新恢复），同时：① 关闭 Tab 自动清空，零维护；② 不触碰 IndexedDB，不提前引入 RunHistory 需要的数据层（宪法："MUST NOT 提前封装 service/repository 层"）；③ 不写 `localStorage`，避免残留影响未来的 RunHistory 设计。

---

## 6. 风险预估

### 风险 1 — `thinking` 字段与 `streamObject` 不兼容（高）

**问题**：DeepSeek R1、Anthropic Claude Extended Thinking 等模型将思考过程作为独立 token 流（`<think>...</think>` 或 `thinking` content block），而非 JSON schema 字段。`streamObject` 要求模型严格按 JSON 输出，模型不遵守时整个流可能解析失败，`thinking` 卡片无法渲染。

**应对**：  
- 在 Edge Route 对不同模型分支处理：支持 native structured output 的模型（OpenAI gpt-4o、Anthropic claude-3.5）直接用 `streamObject`；  
- DeepSeek R1 系列：在 `streamObject` 的 `system` prompt 中明确要求 JSON 输出格式，并启用 `mode: 'json'`；  
- 实现 `extractThinking()` 预处理函数：检测 `<think>...</think>` 标签，提取内容注入 `thinking` 字段，再交给 schema 验证；  
- tasks.md 中为 DeepSeek 思考链处理单独建 task。

### 风险 2 — AI SDK + Zod 依赖缺失，安装可能有版本冲突（高）

**问题**：当前 `package.json` 中无 `ai`、`zod`、`@ai-sdk/*`、`react-markdown`。Next.js 16.2.4 是较新版本，与 AI SDK v5 的 peer dependency 兼容性需验证。

**应对**：  
- tasks.md 第一个 task 专门安装并验证依赖（`pnpm add ai zod @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google react-markdown`）；  
- 锁定 AI SDK 具体版本号（如 `ai@4.x`）避免 breaking change；  
- 安装完成后立刻跑 `pnpm build` 确认类型检查通过再开始编码。

### 风险 3 — 多供应商 API Key 传输安全（中）

**问题**：用户的 API Key 存在浏览器 localStorage，需传给 Edge Route 才能调用供应商。若误放 request body 或 URL 查询参数，可能被 Vercel Access Log 记录，造成 Key 泄露。

**应对**：  
- API Key 固定放自定义请求头 `X-Provider-Api-Key`（Vercel 默认不记录请求 body，header 需配置排除）；  
- Edge Route MUST NOT 将 Key 写入 `console.log` 或任何可观测数据；  
- tasks.md 中加安全检查 task：代码审查确认无 Key 日志。

### 风险 4 — `sessionStorage` 读取在 SSR 阶段报错（中）

**问题**：Next.js App Router 默认服务端渲染，`sessionStorage` 在 Node.js 环境不存在，直接访问抛 `ReferenceError`；即使加 `typeof window !== 'undefined'` 判断，服务端与客户端首次渲染的初始 state 不一致也会产生 hydration mismatch warning。

**应对**：  
- `playground-session.ts` 所有读写操作包裹 `typeof window !== 'undefined'` guard；  
- `PlaygroundPage` 的 sessionStorage 读取放在 `useEffect`（仅客户端执行）；  
- 响应区初始渲染为"空白等待态"（非骨架屏，非内容），mount 后读取 sessionStorage 填充——两次渲染 DOM 一致，无 mismatch。

### 风险 5 — 字符计数阈值 4000 在中英文混合场景下精度差（低）

**问题**：4000 字符 ≈ 1000 tokens（纯英文）但 ≈ 4000 tokens（纯中文，1 汉字 ≈ 1 token）。中文用户 4000 字符已接近 gpt-4o-mini 的可用输入窗口，但英文用户 4000 字符仅用了 ~800 tokens，警告过早出现。

**应对**：  
- 阈值保持 4000 字符（保守、可量化测试，符合 SC-009 "100% 出现/消失"要求）；  
- 警告文案已定为"**可能**超出模型上限"（非断言性），用户有知情权但不被强制阻断（FR-014 不阻断提交）；  
- 400 错误兜底（fatal 卡片"输入内容过长"）是最终保障；  
- 待 RunHistory 有 token 统计后，可将阈值改为模型感知动态计算（非本 Spec 范围）。

---

## Project Structure

### Documentation

```text
specs/001-playground/
├── plan.md         ← 本文件
├── research.md     ← Phase 0：供应商接入 + streamObject 兼容性研究
├── data-model.md   ← Phase 1：实体与 schema 结构
├── contracts/
│   └── playground-stream.md  ← API 合约
└── tasks.md        ← /speckit-tasks 生成
```
