# Tasks: Playground 工具调用增强

**输入文档**：`specs/002-playground-enhanced/`（plan.md + spec.md + data-model.md + contracts/）  
**功能分支**：`002-playground-enhanced`  
**格式**：`[ID] [P?] [Story?] 描述 in 文件路径`

## 格式说明

- **[P]**：可并行执行（不同文件，无前序依赖）
- **[Story]**：所属用户故事（US1–US4）
- **优先级**：P0 = 必须（MVP） / P1 = 应该（重要工具） / P2 = 可选（polish）
- **预估时长**：单次 commit 可完成时间（分钟）

---

## Phase 1：Setup（共享基础设施）

**目的**：初始化 write_file 写入目录（calculate 工具无需第三方依赖，使用内置白名单校验）。

- [X] T002 P0 初始化 write_file 写入目录：在项目根目录创建 `agenthub/downloads/.gitkeep`（空文件占位），并在 `agenthub/.gitignore` 末尾追加两行：`downloads/*.txt`（忽略写入的文件内容，保留目录结构）

---

## Phase 2：Foundational（阻断前置条件）

**目的**：建立 Agent 模式的类型系统和核心 Hook，所有用户故事均依赖此阶段。

**⚠️ 关键**：T003–T005 和 T021 完成前，任何用户故事均不可开始。

- [X] T003 P0 创建 `agenthub/src/shared/schemas/agentStream.ts`：用 Zod 定义 NDJSON 事件联合类型 `AgentStreamEventSchema`（6 种 type：`thinking-delta` / `tool-call` / `tool-result` / `answer-delta` / `done` / `error`），以及 `AgentToolCallSchema`（callId、name、arguments、round 字段）、`AgentToolResultSchema`（callId、name、result、error? 字段）、`ToolNameSchema`（5 个工具名的 z.enum）、`AgentSessionRecordSchema`（含 thinking/toolCalls/toolResults/answer/usage/model/selectedTools/prompt/savedAt）；导出所有 TypeScript 类型（`AgentStreamEvent`、`AgentToolCall`、`AgentToolResult`、`ToolName`、`AgentSessionRecord`）

- [X] T004 P0 创建 `agenthub/src/hooks/useAgentStream.ts`：依赖 T003。实现 `useAgentStream` hook，使用 `useReducer` 管理 `AgentExecutionState`（字段：thinking/toolCalls/toolResults/pendingCallIds/answer/usage/isLoading/error）；reducer 处理 7 种 action（对应 6 种 AgentStreamEvent 类型 + reset）：`reset` → 重置到 initialState；`thinking-delta` → 累加 thinking 字符串；`tool-call` → push 到 toolCalls 并将 callId 加入 pendingCallIds（Set）；`tool-result` → push 到 toolResults 并从 pendingCallIds 移除 callId；`answer-delta` → 累加 answer 字符串；`done` → 设置 usage 并 setIsLoading(false)；`error` → 设置 error 并 setIsLoading(false)。submit 函数接受 `(prompt: string, model: ModelId, apiKey: string, tools: ToolName[], onFinish?: (state: AgentExecutionState) => void)` 参数：①首先 dispatch `{ type: 'reset' }` 重置 state 到 initialState（防止上一次执行残留数据污染新会话）；②POST 到 `/api/agent/stream`，用 lineBuffer 字符串累积 chunk 并按 `\n` 分割后逐行 JSON.parse 再 dispatch；③`done` 事件处理完毕后（设置 usage + setIsLoading(false)），若 onFinish 存在则调用 `onFinish(currentState)`（用于外部持久化）；stop 函数调用 AbortController.abort()。导出 hook 和 `AgentExecutionState` 类型

- [X] T005 P0 [P] 创建 `agenthub/src/components/playground/ToolPanel.tsx`：依赖 T003（ToolName 类型）。使用 shadcn/ui `Collapsible`（`CollapsibleTrigger` + `CollapsibleContent`）实现可折叠工具面板；props 为 `{ selectedTools: ToolName[]; onChange: (tools: ToolName[]) => void; disabled: boolean }`；折叠状态的 trigger 显示「工具」文字 + 已选数量徽标（`selectedTools.length > 0` 时显示数字，如「工具 (2)」）；展开后显示 5 个 `Checkbox` 项（使用 `shadcn/ui checkbox`）：get_current_time（获取当前时间）/ calculate（数学计算）/ web_search（联网检索）/ get_weather（查询天气）/ write_file（写入本地文件）；每个 Checkbox 在 `disabled=true` 时禁用；toggle 逻辑：已选则移除，未选则追加；所有颜色间距使用 `@theme` 语义 token，折叠 icon 使用 `lucide-react ChevronDown / ChevronUp`

- [X] T021 P0 提取共享 AI Provider 工具函数到 `agenthub/src/lib/ai-provider.ts`：无依赖（只读取现有文件内容）。将 `agenthub/src/app/api/playground/stream/route.ts` 中的三个工具函数（`errorResponse`、`mapProviderError`、`getProviderModel`）提取到独立模块 `agenthub/src/lib/ai-provider.ts` 并 export；同步更新 `playground/stream/route.ts` 改为从 `@/lib/ai-provider` 导入这三个函数（函数行为零修改，现有功能零回归）；此模块供 T006（agent/stream route.ts）及后续路由共享使用

---

## Phase 3：User Story 1 — 启用工具并观察实时执行过程（Priority: P1 → P0 任务）

**目标**：勾选 get_current_time 或 calculate，发送 Prompt，响应区实时渲染 ToolCallCard → ToolResultCard（含骨架屏过渡）→ AnswerCard。

**独立测试标准**：勾选 `calculate`，输入「请计算 99 × 88 的结果」，能实时看到 ToolCallCard（calculate，表达式参数）→ ToolResultCard（8712）→ AnswerCard，三张卡片按执行顺序先后出现，不同时出现。

- [X] T006 P0 [US1] 创建 `agenthub/src/app/api/agent/stream/route.ts` 骨架：依赖 T003, T004, T021。设置 `export const runtime = "edge"`、`export const maxDuration = 60`；定义请求体 Zod schema（model: ModelIdSchema, prompt: string min1 max50000, tools: z.array(ToolNameSchema).min(1).max(5)）；从 `@/lib/ai-provider` 导入 `errorResponse` / `mapProviderError` / `getProviderModel`；POST handler 流程：解析 request body → 验证 → 读取 X-Provider-Api-Key header + ENV 兜底 → 获取 provider model；定义工具占位对象（暂时空对象，T007 填充）；创建 `ReadableStream`，遍历 `result.fullStream`，将各事件类型映射为 AgentStreamEvent NDJSON 行（每行 `JSON.stringify(event) + '\n'`）：`text-delta` → answer-delta；`tool-call` → tool-call；`tool-result` → tool-result；`reasoning` → thinking-delta；`tool-input-error` → tool-result（callId 取 event.toolCallId，附 `error: "工具参数格式错误：" + (event.error?.message ?? String(event.error))`）；`finish` → done；返回 `new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } })`；错误处理 catch 映射到 NDJSON error 事件

- [X] T007 P0 [US1] 向 `agenthub/src/app/api/agent/stream/route.ts` 添加 get_current_time 和 calculate 工具定义：依赖 T006。在 tools 对象中添加两个条目：`get_current_time`（description: "获取当前时间（ISO 8601 格式）"，parameters: z.object({})，execute: async () => new Date().toISOString()）；`calculate`（description: "执行基础数学运算，支持 +、-、*、/、% 和括号"，parameters: z.object({ expression: z.string().min(1).max(500).describe("数学表达式，如 '99 * 88'、'(10 + 5) * 3'"）})，execute: 先用正则 `/^[\d\s+\-*/%().]+$/` 白名单校验 expression，不通过则返回 `{ error: "无效的数学表达式：" + expression }`；通过后 `Function('"use strict"; return (' + expression + ')()')()` 执行，用 try/catch 包裹异常，成功返回结果字符串）；同时更新 streamText 调用加入 `tools` 和 `maxSteps: 8` 参数

- [X] T008 P0 [P] [US1] 更新 `agenthub/src/components/playground/cards/ToolCallCard.tsx`：依赖 T003。在现有 props 基础上新增可选 prop `agentCall?: AgentToolCall`（from agentStream.ts）；当 `agentCall` 存在时，渲染单条工具调用样式（圆角边框卡片，显示工具名 badge + 参数 pre-json）而不是 Table；现有 `toolCalls: ToolCall[] | undefined` prop 保持不变，旧路径渲染逻辑不修改（向后兼容）；新增 pending 状态：当 `agentCall` 存在且 `isPending=true` 时显示"正在执行…"骨架屏占位；所有新样式使用 `@theme` 语义 token

- [X] T009 P0 [P] [US1] 更新 `agenthub/src/components/playground/cards/ToolResultCard.tsx`：依赖 T003。新增可选 prop `agentResult?: AgentToolResult`；当 `agentResult` 存在时，渲染单条结果样式：成功时展示 `JSON.stringify(result, null, 2)` in pre 块；`agentResult.error` 存在时用红色文字展示中文错误（如「web_search 工具未配置 API Key…」）；现有 `toolResults: ToolResult[] | undefined` prop 保持不变（向后兼容）；新增 isLoading prop 用于骨架屏（当对应工具 callId 在 pendingCallIds 中时，外部传 isLoading=true）；所有新样式使用 `@theme` 语义 token

- [X] T010 P0 [US1] 更新 `agenthub/src/components/playground/ResponseArea.tsx`：依赖 T004、T008、T009。新增 prop `selectedTools: ToolName[]`（from agentStream.ts）；`ResponseAreaProps` 新增 selectedTools；`ResponseAreaHandle.submit` 签名不变，内部根据 `selectedTools.length > 0` 分支：无工具 → 现有 useStructuredStream 路径（零修改）；有工具 → 使用 useAgentStream，agentState 包含 thinking/toolCalls/toolResults/pendingCallIds/answer；agent 模式渲染逻辑：遍历 agentState.toolCalls 数组，每条渲染：`<ToolCallCard agentCall={tc} />` + 在 pendingCallIds 中时紧跟骨架屏 Skeleton，否则找到对应 toolResult（按 callId）渲染 `<ToolResultCard agentResult={tr} />`；所有工具结束后，有 answer 时渲染 `<AnswerCard content={agentState.answer} isStreaming={isLoading} />`；isLoading/error/stop 透传到 onLoadingChange/onErrorChange 回调；currentObject 在 agent 模式下返回 agentState（for CopyJsonButton）

- [X] T011 P0 [US1] 更新 `agenthub/src/app/playground/page.tsx`：依赖 T005、T010。新增 state：`const [selectedTools, setSelectedTools] = useState<ToolName[]>([])`；在输入区的 `<ModelSelector>` 下方（`<PromptInput>` 之前）插入 `<ToolPanel selectedTools={selectedTools} onChange={setSelectedTools} disabled={isLoading} />`；更新 ResponseArea props：增加 `selectedTools={selectedTools}`；更新 sendDisabled 逻辑不变（已有 `!prompt.trim()` 判断，无工具也可发送）；在页面标题描述文字根据 selectedTools.length 动态切换：无工具→「选择模型、输入 Prompt，查看流式结构化响应」；有工具→「选择模型和工具，输入 Prompt，查看 Agent 实时执行过程」

**Checkpoint**：完成 T001–T011 后，US1 可独立验收：勾选 calculate，输入计算 Prompt，能看到实时 ToolCallCard → ToolResultCard → AnswerCard。

---

## Phase 4：User Story 2 — web_search 工具（Priority: P2）

**目标**：勾选 web_search 后 AI 自动调用 Tavily API 联网搜索，ToolResultCard 展示搜索结果；KEY 缺失时展示中文错误。

**独立测试标准**：勾选 web_search，输入「今年最新发布的 Claude 模型是什么版本」，能看到 ToolCallCard（web_search + query 参数）+ ToolResultCard（Tavily 返回的 results 列表）+ AnswerCard。

- [X] T012 P1 [US2] 向 `agenthub/src/app/api/agent/stream/route.ts` 添加 web_search 工具：依赖 T007。在 tools 对象中新增 `web_search`（description: "使用 Tavily 搜索引擎获取实时信息"，parameters: z.object({ query: z.string().min(1).max(200).describe("搜索关键词") })，execute: 检查 process.env.TAVILY_API_KEY，缺失时返回 `{ error: "web_search 工具未配置 API Key，请在 .env.local 中添加 TAVILY_API_KEY" }`；存在时 `fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: TAVILY_API_KEY, query, max_results: 5, search_depth: 'basic' }) })`，返回 `{ results: data.results.map(r => ({ title: r.title, url: r.url, snippet: r.content })) }`；网络异常时返回 `{ error: "web_search 调用失败：" + e.message }`）

**Checkpoint**：完成 T012 后，US2 可独立验收（需配置 TAVILY_API_KEY）。

---

## Phase 5：User Story 3 — get_weather 工具（Priority: P2）

**目标**：勾选 get_weather 后 AI 调用 OpenWeatherMap API，ToolResultCard 展示温度、天气状况等数据。

**独立测试标准**：勾选 get_weather，输入「北京今天天气怎么样」，能看到 ToolCallCard（get_weather + city 参数）+ ToolResultCard（温度、天气状况）+ AnswerCard。

- [X] T013 P1 [US3] 向 `agenthub/src/app/api/agent/stream/route.ts` 添加 get_weather 工具：依赖 T007。在 tools 对象中新增 `get_weather`（description: "获取指定城市的实时天气信息"，parameters: z.object({ city: z.string().min(1).max(100).describe("城市名称，英文，如 Beijing、Shanghai") })，execute: 检查 process.env.OPENWEATHER_API_KEY，缺失时返回 `{ error: "get_weather 工具未配置 API Key，请在 .env.local 中添加 OPENWEATHER_API_KEY" }`；存在时 `fetch('https://api.openweathermap.org/data/2.5/weather?q={city}&appid={KEY}&units=metric&lang=zh_cn')` ，返回 `{ city: data.name, country: data.sys.country, temp: data.main.temp, feelsLike: data.main.feels_like, humidity: data.main.humidity, description: data.weather[0].description, windSpeed: data.wind.speed }`；网络异常返回 `{ error: "get_weather 调用失败：" + e.message }`）

**Checkpoint**：完成 T013 后，US3 可独立验收（需配置 OPENWEATHER_API_KEY）。

---

## Phase 6：User Story 3b — write_file 工具（Priority: P2）

**目标**：勾选 write_file 后 AI 将生成内容写入 downloads/ 目录的 .txt 文件，ToolResultCard 显示绝对文件路径；非法文件名返回中文错误。

**独立测试标准**：勾选 write_file，输入「生成 AI 工具调用介绍并保存为文件 ai_intro」，ToolResultCard 显示文件绝对路径，本地 `downloads/ai_intro.txt` 实际存在。

- [X] T014 P1 [US3b] 创建 `agenthub/src/app/api/tools/write-file/route.ts`：Node.js Runtime（无 `export const runtime` 声明，使用默认 Node.js）；导入 `fs/promises`（mkdir、writeFile、access）和 `path`；定义请求体 Zod schema（filename: z.string().regex(/^[a-zA-Z0-9_\-]+$/).max(100)，content: z.string()）；POST handler 流程：①解析并校验请求体，filename 不匹配返回 400 `{ success: false, error: "文件名不合法，仅允许字母、数字、下划线和连字符", code: "INVALID_FILENAME" }`；②校验 content UTF-8 字节数 `Buffer.byteLength(content, 'utf-8') <= 1_048_576`，超限返回 400 `{ success: false, error: "文件内容超出 1MB 限制", code: "CONTENT_TOO_LARGE" }`；③构造 `downloadsDir = path.resolve(process.cwd(), 'downloads')`，`targetPath = path.resolve(downloadsDir, filename + '.txt')`，校验 `targetPath.startsWith(downloadsDir + path.sep)`（防 resolve 逃逸，失败返回 400 INVALID_FILENAME）；④`await fs.mkdir(downloadsDir, { recursive: true })`；⑤检查文件是否已存在（用 access 捕获 ENOENT）；⑥`await fs.writeFile(targetPath, content, 'utf-8')`；⑦返回 200 `{ success: true, path: targetPath, overwritten: boolean }`；writeFile 失败返回 500 `{ success: false, error: "文件写入失败：" + e.message, code: "WRITE_FAILED" }`

- [X] T015 P1 [US3b] 向 `agenthub/src/app/api/agent/stream/route.ts` 添加 write_file 工具：依赖 T007、T014。在 tools 对象中新增 `write_file`（description: "将文本内容写入本地 .txt 文件，保存到 downloads/ 目录"，parameters: z.object({ filename: z.string().describe("文件名，不含路径和扩展名，仅允许字母/数字/下划线/连字符"), content: z.string().describe("要写入文件的文本内容") })，execute: 从 req.url 获取 origin，`fetch(origin + '/api/tools/write-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, content }) })`，成功返回 `{ message: "文件已保存到 " + data.path + (data.overwritten ? "（已覆盖原有文件）" : "") }`，失败返回 `{ error: data.error }`；网络异常返回 `{ error: "write_file 调用失败：" + e.message }`)；**注意**：execute 函数需能访问 request 的 origin，需在 route handler 中将 `new URL(req.url).origin` 闭包传入工具定义

**Checkpoint**：完成 T014–T015 后，US3b 可独立验收（无需 API Key）。

---

## Phase 7：User Story 4 + Polish — 向后兼容 & 完整体验

**目标**：推理模型 ThinkingCard 正确渲染；Agent 执行结果可 sessionStorage 持久化；CopyJsonButton 包含完整工具调用数据；工具 execute 有 10s 超时防护。

- [X] T016 P2 [US4] 在 `agenthub/src/components/playground/ResponseArea.tsx` 添加 ThinkingCard 条件渲染逻辑（agent 模式）：依赖 T010。在 agent 模式渲染块最顶部添加：`{agentState.thinking && <ThinkingCard content={agentState.thinking} isStreaming={isLoading && !agentState.toolCalls.length} />}`——即有 thinking 内容时渲染 ThinkingCard，放在第一个 ToolCallCard 之前；非推理模型不产生 thinking-delta 事件，thinking 永远是空字符串，条件自然不触发，无需维护模型白名单

- [X] T017 P2 向 `agenthub/src/lib/playground-session.ts` 添加 Agent 模式持久化函数：依赖 T003。新增常量 `AGENT_SESSION_KEY = "agent:last-execution"`；新增 `saveAgentSession(state: AgentSessionRecord): void`（参数类型来自 agentStream.ts，写入 sessionStorage，静默忽略异常）；新增 `restoreAgentSession(): AgentSessionRecord | null`（读取 sessionStorage，用 AgentSessionRecordSchema.safeParse 校验，校验失败返回 null）；现有 saveSession / restoreSession 函数不变

- [X] T018 P2 [US4] 更新 `agenthub/src/app/playground/page.tsx` 支持 Agent 会话恢复：依赖 T011、T017。在 mount useEffect 中补充 agent session 恢复逻辑：若 `restoreAgentSession()` 返回非 null，且其 savedAt > restoreSession()?.savedAt（或无普通 session），则恢复 agent 模式数据（setSelectedTools、设置响应区 agent state）；更新 CopyJsonButton 的 `data` prop：当 selectedTools.length > 0 时传入 `responseRef.current?.currentObject`（此时 currentObject 为 agentState，包含 toolCalls/toolResults/answer），否则传旧 object；同时在 agent 执行完成时（onFinish 回调）调用 saveAgentSession

- [X] T019 P2 向 `agenthub/src/app/api/agent/stream/route.ts` 的每个工具 execute 函数添加 10s 超时：依赖 T015。封装 `withTimeout<T>(fn: () => Promise<T>, ms: number, toolName: string): Promise<T>` 工具函数（用 Promise.race：fn() vs `new Promise((_, reject) => setTimeout(() => reject(new Error("工具执行超时")), ms))`）；将 web_search / get_weather / write_file 的 execute 函数内部调用包裹在 `withTimeout(..., 10_000, toolName)` 中；超时时 execute 返回 `{ error: toolName + " 工具执行超时（10s），请稍后重试" }`；get_current_time 和 calculate 不需要超时（纯内存/同步操作）

- [X] T020 P2 [P] 视觉合规审查：依赖 T011。检查以下 3 个新文件的所有样式：`ToolPanel.tsx`、`ToolCallCard.tsx`（新增 agentCall 渲染部分）、`ToolResultCard.tsx`（新增 agentResult 渲染部分）；逐行确认：①无 hardcoded hex（如 `#xxx`）；②无裸 Tailwind 色阶（如 `bg-blue-500`、`text-gray-400`），替换为语义 token（`bg-primary`、`text-muted-foreground`、`bg-card`、`border-border` 等）；③间距值均为 4px 倍数（p-4、gap-6、space-y-6 等）；④所有可交互元素有完整 5 态（`hover:bg-accent`、`focus-visible:ring`、`disabled:opacity-50 disabled:cursor-not-allowed` 等）；⑤图标全部来自 lucide-react；修复所有违规项

---

## 依赖关系 & 执行顺序

### Phase 依赖链

```
Phase 1 (T002)
  └─→ Phase 2 (T003-T005, T021)
        └─→ Phase 3 (T006-T011) [US1 MVP]
              ├─→ Phase 4 (T012) [US2]
              ├─→ Phase 5 (T013) [US3]
              └─→ Phase 6 (T014-T015) [US3b]
                    └─→ Phase 7 (T016-T020) [US4 + Polish]
```

### 任务级依赖

| 任务 | 依赖 | 可并行于 |
|------|------|---------|
| T002 | 无 | — |
| T003 | 无 | T002 |
| T004 | T003 | T005 |
| T005 | T003 | T004 |
| T006 | T003, T004, T021 | T002, T005, T008, T009 |
| T021 | 无 | T002, T004, T005 |
| T007 | T006 | T008, T009, T014 |
| T008 | T003 | T006, T007, T009 |
| T009 | T003 | T006, T007, T008 |
| T010 | T004, T008, T009 | — |
| T011 | T005, T010 | — |
| T012 | T007 | T014 |
| T013 | T007, T012 | T014 |
| T014 | T002（downloads 目录）| T012, T013 |
| T015 | T007, T014 | — |
| T016 | T010 | T017 |
| T017 | T003 | T016 |
| T018 | T011, T017 | T019, T020 |
| T019 | T015 | T016, T020 |
| T020 | T011 | T019 |

---

## 并行执行示例

### Phase 2（Foundational）可同时开始的任务

```
并行启动：
  任务 A：T004 创建 useAgentStream.ts hook
  任务 B：T005 创建 ToolPanel.tsx 组件
（两者都依赖 T003，但文件不同，可并行）
```

### Phase 3（US1）部分并行

```
T006 创建 agent/stream route.ts 骨架
  同时：
  任务 C：T008 更新 ToolCallCard.tsx（只依赖 T003，文件不同）
  任务 D：T009 更新 ToolResultCard.tsx（只依赖 T003，文件不同）

T007 添加工具实现（依赖 T006 完成后才能开始）
T010 更新 ResponseArea（依赖 T004+T008+T009 全部完成）
T011 更新 page.tsx（依赖 T005+T010 完成）
```

### Phase 4-6 部分并行

```
T007 完成后同时启动：
  任务 E：T012 添加 web_search 工具（修改 route.ts）
  任务 F：T013 添加 get_weather 工具（修改 route.ts，需等 T012 完成后串行）
  任务 G：T014 创建 write-file/route.ts（独立新文件，可与 T012/T013 并行）

T014 完成后启动 T015
```

---

## 实现策略

### MVP 优先（仅 US1）

1. 完成 Phase 1：T002（5 分钟）
2. 完成 Phase 2：T003–T005（~90 分钟）
3. 完成 Phase 3：T006–T011（~200 分钟）
4. **停下来验收**：勾选 calculate/get_current_time，验证端到端流程
5. 部署 / 演示

### 增量交付

| 里程碑 | 完成任务 | 验收点 |
|--------|---------|--------|
| MVP | T002–T011 | US1：inline 工具实时渲染 |
| +web_search | T012 | US2：联网搜索 |
| +weather | T013 | US3：天气查询 |
| +write_file | T014–T015 | US3b：本地文件写入 |
| 完整体 | T016–T020 | US4：ThinkingCard + sessionStorage + 超时防护 |

---

## 任务统计

| 优先级 | 任务数 | 预估时长 |
|--------|--------|---------|
| P0（US1 MVP） | 11 | ~305 分钟 |
| P1（US2/3/3b） | 4 | ~105 分钟 |
| P2（US4 + Polish） | 5 | ~90 分钟 |
| **合计** | **20** | **~500 分钟** |

**每个用户故事任务数**：

| 用户故事 | 任务 | 数量 |
|---------|------|------|
| US1（核心 Agent 模式）| T006–T011 | 6 |
| US2（web_search）| T012 | 1 |
| US3（get_weather）| T013 | 1 |
| US3b（write_file）| T014–T015 | 2 |
| US4（向后兼容 + Polish）| T016–T020 | 5 |
| Foundational | T003–T005, T021 | 4 |
| Setup | T002 | 1 |
