# 实现计划：Playground 工具调用增强

**分支**: `002-playground-enhanced` | **日期**: 2026-04-30 | **规格**: [spec.md](./spec.md)

## 摘要

增强现有 `/playground` 页面：新增始终展开的工具面板（5 个内置工具，无折叠设计）、Agent 执行模式（Vercel AI SDK `streamText` + `tools` 实现 ReAct 多轮循环，最多 8 步）、NDJSON 实时事件流（ThinkingCard / ToolCallCard / ToolResultCard / AnswerCard 按执行顺序逐步渲染）。无工具勾选时，现有结构化流式模式 100% 不变。

## 技术上下文

| 项 | 值 |
|---|---|
| 语言 / 版本 | TypeScript 5，strict 模式 |
| 主要依赖 | Next.js 15 App Router、Vercel AI SDK、shadcn/ui、Tailwind CSS、Zod |
| 存储 | sessionStorage（Agent 执行结果持久化） |
| 目标平台 | 桌面浏览器 ≥ 1024px |
| 项目类型 | Next.js Web 应用（App Router，src/app/） |
| 性能目标 | 首张 ToolCallCard 出现时间 < 2s（P95，正常网络） |
| 约束 | Edge Runtime 硬上限 60s；write_file 需要 Node.js 运行时；最多 8 步 ReAct 循环 |
| 规模 | 单用户交互，工具串行执行（非并发） |

## 宪法合规检查

*GATE：Phase 0 研究前必须通过。Phase 1 设计完成后再次确认。*

| 宪法条款 | 状态 | 说明 |
|---------|------|------|
| Next.js App Router | ✅ PASS | 所有新路由在 `src/app/api/` 下，App Router 结构 |
| Vercel AI SDK（唯一 AI 调用层） | ✅ PASS | `/api/agent/stream` 使用 `streamText({ tools })` |
| Edge Runtime（AI 调用） | ✅ PASS + 一处例外（见下表） | AI 调用在 Edge；`write_file` 文件 I/O 在独立 Node.js 路由 |
| 无服务端数据库 | ✅ PASS | Agent 执行结果存 sessionStorage，无 DB |
| TypeScript strict 模式 | ✅ PASS | 延续已有项目约束 |
| @theme token，无 hardcoded hex | ✅ PASS | 所有新组件使用语义变量 |
| 骨架屏优先 | ✅ PASS | ToolCallCard 出现后至 ToolResultCard 出现前显示 Skeleton |
| 流式输出（NON-NEGOTIABLE） | ✅ PASS | NDJSON 事件流，逐事件实时渲染 |
| 错误中文可读 | ✅ PASS | 所有工具错误、API Key 缺失均展示中文描述 |
| lucide-react 图标 | ✅ PASS | 图标均使用 lucide-react（ToolPanel 已移除 Collapsible，无折叠图标需求） |
| 禁止引入其他 UI 库 | ✅ PASS | 仅使用 shadcn/ui Checkbox（Collapsible 已移除，工具面板始终展开） |

### 复杂度跟踪（宪法例外）

| 违反点 | 为何需要 | 更简单方案被拒原因 |
|--------|---------|-----------------|
| `write_file` 路由使用 Node.js Runtime | `write_file` 必须访问本地文件系统（`fs.writeFile`），Edge Runtime 不支持 Node.js `fs` 模块 | 将 `/api/agent/stream` 整体改为 Node.js Runtime 会违反宪法"AI 调用 MUST 在 Edge Runtime"约束；职责分离（AI 推理在 Edge，文件 I/O 在 Node.js）是最小偏差方案 |

## 项目结构

### 规格文档（本功能）

```text
specs/002-playground-enhanced/
├── spec.md                    # 功能规格（已完成）
├── plan.md                    # 本文件
├── research.md                # 技术研究结论（Phase 0）
├── data-model.md              # 实体定义（Phase 1）
├── quickstart.md              # 集成场景（Phase 1）
├── contracts/
│   ├── agent-stream-api.md    # NDJSON 事件流协议（Phase 1）
│   └── write-file-api.md      # 文件写入 API 协议（Phase 1）
└── tasks.md                   # 由 /speckit-tasks 生成
```

### 源码（新增 / 修改文件）

```text
agenthub/src/
├── app/
│   ├── api/
│   │   ├── agent/
│   │   │   └── stream/
│   │   │       └── route.ts          [新增] Edge Runtime，AI 工具调用流式路由
│   │   └── tools/
│   │       └── write-file/
│   │           └── route.ts          [新增] Node.js Runtime，文件写入路由
│   └── playground/
│       └── page.tsx                  [修改] 新增 ToolPanel、模式切换逻辑、selectedTools 状态
├── components/
│   └── playground/
│       ├── ToolPanel.tsx             [新增] 可折叠工具选择面板（5 个工具 Checkbox）
│       ├── cards/
│       │   ├── ToolCallCard.tsx      [修改] 接受 AgentToolCall[] 替代旧 ToolCall[]
│       │   └── ToolResultCard.tsx    [修改] 接受 AgentToolResult[] + 展示 callId 配对
│       └── ResponseArea.tsx          [修改] 双模式：无工具走旧路径，有工具走 AgentMode 渲染
├── hooks/
│   └── useAgentStream.ts             [新增] 消费 NDJSON 流的客户端 hook（useReducer）
└── shared/
    └── schemas/
        ├── playgroundResponse.ts     [不变] 无工具模式 schema
        └── agentStream.ts            [新增] NDJSON 事件类型 + AgentExecutionState schema
```

**完全不变的文件（向后兼容保障）**：

- `src/app/api/playground/stream/route.ts` — 无工具模式，零修改
- `src/hooks/useStructuredStream.ts` — 无工具模式，零修改
- `src/components/playground/cards/ThinkingCard.tsx` — props 接口不变
- `src/components/playground/cards/AnswerCard.tsx` — props 接口不变
- `src/shared/schemas/playgroundResponse.ts` — 无工具模式 schema，不改

## 技术决策

### TD-001：Vercel AI SDK `streamText({ tools, maxSteps: 8 })` 实现 ReAct 循环

**选择**：`streamText` with `tools` + `maxSteps: 8`，SDK 自动管理多轮工具调用循环。

**理由**：宪法要求通过 Vercel AI SDK；`maxSteps` 参数直接对应 FR-007（最多 8 轮）；SDK 处理消息历史拼接、工具结果注入，无需手写 ReAct 状态机。

**备选被拒**：手写 while 循环管理 messages 数组 — 需要维护完整消息历史、处理 provider 差异，复杂且易出错。

---

### TD-002：NDJSON 事件流协议（每行一个 AgentStreamEvent JSON）

**选择**：`Content-Type: application/x-ndjson`，`ReadableStream` 逐行 enqueue JSON 对象。

**理由**：Vercel AI SDK `fullStream` 是 AsyncIterable，天然支持逐事件遍历；NDJSON 比 SSE 解析更简单（无 `data:` 前缀）；前端 `useAgentStream` 按 `\n` 分割即可处理完整事件；与现有 `useStructuredStream`（text stream）格式差异明显，不混淆。

**事件类型映射**（SDK → NDJSON）：

| Vercel AI SDK fullStream 事件 | AgentStreamEvent type |
|---|---|
| `reasoning` | `thinking-delta` |
| `tool-call` | `tool-call` |
| `tool-result` | `tool-result` |
| `text-delta` | `answer-delta` |
| `finish` | `done` |
| `error` | `error` |

---

### TD-003：`write_file` 通过内部 fetch 调用独立 Node.js 路由

**选择**：`/api/agent/stream`（Edge）的 `write_file.execute()` 内部调用 `fetch(new URL('/api/tools/write-file', req.url))`（Node.js）。

**理由**：Edge Runtime 支持 `fetch`（含内部 API 调用）；AI 推理保持在 Edge Runtime（宪法合规）；文件 I/O 职责隔离在独立路由（安全校验集中管理）。

**备选被拒**：将整个 `/api/agent/stream` 改为 Node.js Runtime — 违反宪法"AI 调用 MUST 在 Edge Runtime"。

---

### TD-004：`useReducer` 管理 Agent 执行状态

**选择**：`useAgentStream` 内部使用 `useReducer(agentStreamReducer, initialState)` 管理 `{ thinking, toolCalls, toolResults, answer, pendingCallIds, isLoading, error }`。

**理由**：工具调用 / 结果是有序的追加操作，useReducer action dispatch 保证原子性更新；`pendingCallIds` 集合管理"已调用但未返回结果"的工具，驱动骨架屏显示；比多个 useState 更不容易产生竞态渲染。

---

### TD-005：ToolPanel 使用 shadcn/ui `Checkbox`（始终展开，无折叠）

**选择**：工具面板始终展开，直接显示 5 个工具 Checkbox，无 Collapsible 组件；顶部描述文字随选中数量变化（如「工具（已选 2 个，启用 Agent 模式）」）；AI 执行期间 `disabled` 整体禁用。

**理由**：用户测试发现折叠面板导致工具难以被发现（默认折叠 = 工具功能实质上不可见）；始终展开的设计符合"零点击到达核心功能"原则；移除 `Collapsible` 组件减少依赖，降低复杂度；`Checkbox` 天然支持禁用态。

---

### TD-006：DeepSeek Agent 模式下的模型替换策略

**选择**：`getProviderModel(model, apiKey, { agentMode: true })` 在 `agentMode: true` 时，将 DeepSeek V4 Flash / DeepSeek V4 Pro 静默替换为 `deepseek-chat`（非推理版本）。

**理由**：DeepSeek 推理模型（`deepseek-v4-flash`、`deepseek-v4-pro`）在 Agent 多步工具调用时会失败——第 1 步返回的 Assistant 消息包含 `reasoning_content` 字段，但 Vercel AI SDK 的 OpenAI 兼容层在构建第 2 步请求时不会将该字段透传，导致 DeepSeek API 返回 400（`"The 'reasoning_content' in the thinking mode must be passed back to the API."`）。使用 `deepseek-chat` 绕过推理模式，多步工具调用恢复正常；单步（无工具）模式不受影响，仍使用原始模型 ID。

**副作用**：DeepSeek 在 Agent 模式下不输出思考链，ThinkingCard 不出现（已在 FR-014 / SC-008 记录）。

**备选被拒**：
- 修改 AI SDK 以透传 `reasoning_content` — 需 fork SDK，维护成本过高
- 让 DeepSeek 用户改用 Playground 无工具模式看思考链 — 体验割裂，用户需要手动切换

## 数据流

### 无工具模式（现有，不变）

```
PlaygroundPage
  → ResponseArea (useStructuredStream)
  → POST /api/playground/stream (Edge)
  → streamText → text stream → parsePartialJson
  → PlaygroundResponse → 渲染 ThinkingCard / ToolCallCard / ToolResultCard / AnswerCard
```

### Agent 模式（新增，selectedTools.length > 0）

```
PlaygroundPage
  → useAgentStream → POST /api/agent/stream (Edge, with tools)
  → streamText({ tools, maxSteps: 8 }) → fullStream
  → 逐事件转换 NDJSON → ReadableStream response

useAgentStream 前端：
  lineBuffer 累积 → 按 \n 分割 → JSON.parse → dispatch(action)
  → agentStreamReducer → state 更新 → ResponseArea 渲染

工具执行链路（在 route.ts tool.execute 中）：
  get_current_time → new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })（inline，返回北京时间）
  calculate        → 递归下降解析器 parseFactor/parseTerm/parseExpr（inline，无动态代码执行，Edge-safe）
  web_search       → fetch Tavily API（HTTP）
  get_weather      → fetch OpenWeatherMap API（HTTP）
  write_file       → fetch /api/tools/write-file（内部 HTTP）
```

### Agent 执行状态变化序列

```
事件到达               state 变化                    渲染
─────────────────────────────────────────────────────────────────
thinking-delta "..."   thinking += delta             ThinkingCard 流式更新（推理模型）
tool-call (round 1)    toolCalls.push({id, name, args})  ToolCallCard 1 出现
                       pendingCallIds.add(id)         ToolResultCard 1 骨架屏
tool-result (round 1)  toolResults.push({id, result})    ToolResultCard 1 显示结果
                       pendingCallIds.delete(id)
tool-call (round 2)    toolCalls.push(...)           ToolCallCard 2 出现
...（最多 8 轮）
answer-delta "..."     answer += delta               AnswerCard 流式更新
done                   isLoading = false             所有卡片最终态
```

## 风险分析

### R-001：write_file 路径穿越攻击（高）

**场景**：AI 生成的 filename 含 `../`，文件写入项目目录外。

**缓解**：`/api/tools/write-file` 严格校验 filename：禁止 `/`、`\`、`..`、`:`；仅允许 `^[a-zA-Z0-9_\-]+$`；写入路径为 `path.resolve(cwd, 'downloads', filename + '.txt')`，使用前缀校验确认在 `downloads/` 内。

**残余风险**：低。

---

### R-002：Edge Runtime 60s 限制（中）

**场景**：8 步 ReAct 循环 × 平均单步耗时（AI + 工具）可能接近 60s 上限。

**缓解**：单工具超时 10s（spec Edge Case），Tavily / OpenWeatherMap P95 < 3s，DeepSeek 单次 P95 < 8s；实测超时后可将 maxSteps 调整为 5（需 spec 变更）。当前按 8 步实现，监控超时率。

---

### R-003：AI 工具参数格式不合规（中）

**场景**：模型输出的 tool arguments 不符合工具 Zod schema，execute 函数报错。

**缓解**：所有 execute 函数内部 try/catch；错误通过 `tool-result` 事件的 `error` 字段返回，不中断流；ToolResultCard 展示中文错误（FR-008）。

---

### R-004：NDJSON chunk 边界问题（低）

**场景**：ReadableStream chunk 不按行对齐，前端 split('\n') 切割不完整 JSON。

**缓解**：`useAgentStream` 维护 `lineBuffer` 字符串，accumulate 后按 `\n` 分割，不完整行保留到下一个 chunk 拼接。

---

### R-005：推理模型 reasoning token 兼容性（低）

**场景**：Vercel AI SDK 版本升级后 `reasoning` 事件类型名称变更，ThinkingCard 不渲染。

**缓解**：ThinkingCard 由事件驱动渲染（有 `thinking-delta` 就显示），不维护硬编码推理模型白名单；SDK 升级后只需更新事件类型映射。
