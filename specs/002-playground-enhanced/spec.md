# Feature Specification: Playground 工具调用增强

**Feature Branch**: `002-playground-enhanced`  
**Created**: 2026-04-30  
**Status**: Draft  
**Input**: User description: "增强现有 /playground 页面，使其支持真实工具调用（工具面板 + ReAct 循环 + 实时工具调用卡片展示），与 Agent 商店的 agent 详情页 playground 完全独立"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 启用工具并观察实时执行过程 (Priority: P1)

作为一个正在调试 AI 工具调用能力的开发者，  
我在 Playground 页面展开「工具」面板，勾选一个或多个工具，然后输入需要使用工具才能回答的 Prompt（如「现在几点？」「计算 1234 × 5678」），  
AI 的执行过程**实时**以卡片形式逐步渲染：先出现工具调用卡，调用完成后出现工具结果卡，最终出现答案卡——而不是等待全部完成才出现。

**Why this priority**: 这是本次增强的核心价值：让开发者亲眼看到「AI 如何使用工具」的完整过程，而不是把过程藏在 loading 状态里。没有实时渲染，与普通聊天界面无区别。

**Independent Test**: 在工具面板勾选 `calculate`，输入「请计算 99 × 88 的结果」，在 AI 执行过程中能实时看到 ToolCallCard（工具名：calculate，参数：表达式）出现，随后 ToolResultCard（结果：8712）出现，最后 AnswerCard 出现最终回答。

**Acceptance Scenarios**:

1. **Given** 工具面板已展开，勾选了 `get_current_time`，**When** 用户输入「现在是几点？」并发送，**Then** 响应区域先出现 ToolCallCard（工具名 get_current_time），接着出现 ToolResultCard（包含当前时间），最后出现 AnswerCard，三张卡片按执行顺序依次出现（不是同时）。
2. **Given** AI 正在调用工具（ToolCallCard 已出现但 ToolResultCard 尚未出现），**When** 用户观察页面，**Then** ToolCallCard 显示工具名和传入参数，ToolResultCard 所在区域显示骨架屏。
3. **Given** AI 完成所有工具调用并生成答案，**When** 流式响应结束，**Then** 所有卡片显示完整内容，发送按钮恢复可用，工具面板取消禁用。

---

### User Story 2 — 使用 web_search 回答实时性问题 (Priority: P2)

作为开发者，我想验证 AI 是否能通过搜索工具获取最新信息，  
我勾选 `web_search` 工具，输入需要联网才能准确回答的问题（如「最近的 AI 新闻」），  
AI 自动决定调用搜索工具，将搜索结果卡片和最终基于搜索内容的答案都展示给我。

**Why this priority**: web_search 是最能体现「工具调用价值」的工具，让 AI 从静态知识扩展到实时信息。

**Independent Test**: 勾选 `web_search`，输入「今年最新发布的 Claude 模型是什么版本」，能看到 ToolCallCard（工具名 web_search，含搜索关键词）+ ToolResultCard（搜索结果摘要）+ AnswerCard（基于搜索结果的回答）。

**Acceptance Scenarios**:

1. **Given** 勾选 `web_search`，**When** 发送「最新的 AI 大模型有哪些」，**Then** ToolCallCard 显示 web_search 工具和搜索 query，ToolResultCard 显示返回的搜索结果（标题 + 摘要），AnswerCard 的内容基于搜索结果。
2. **Given** AI 决定多次搜索（多步 ReAct），**When** 观察响应区，**Then** 多个 ToolCallCard + ToolResultCard 依次出现，保留所有步骤记录，最终一张 AnswerCard 总结全部结果。
3. **Given** `TAVILY_API_KEY` 未配置，**When** 勾选 web_search 并发送 Prompt，**Then** ToolResultCard 显示明确的中文错误信息说明 API Key 未配置，AI 继续基于已有知识给出答案，不静默失败。

---

### User Story 3 — 使用 get_weather 查询天气 (Priority: P2)

作为开发者，我想测试 AI 调用外部天气 API 的能力，  
我勾选 `get_weather` 工具，询问某个城市的天气，  
AI 调用天气工具获取实时数据并展示调用过程和最终结果。

**Why this priority**: 与 web_search 同级，展示接入外部数据源的完整工具调用链路。

**Independent Test**: 勾选 `get_weather`，输入「北京今天天气怎么样」，能看到 ToolCallCard（工具名 get_weather，含城市参数）+ ToolResultCard（温度、天气状况）+ AnswerCard。

**Acceptance Scenarios**:

1. **Given** 勾选 `get_weather`，**When** 发送「上海明天需要带伞吗」，**Then** ToolCallCard 显示 get_weather + 城市参数，ToolResultCard 显示天气数据（含降水概率），AnswerCard 给出是否需要带伞的建议。
2. **Given** `OPENWEATHER_API_KEY` 未配置，**When** 勾选 get_weather 并询问天气，**Then** ToolResultCard 显示明确的中文错误说明 Key 未配置，不静默失败。

---

### User Story 3b — 使用 write_file 将 AI 输出写入本地文件 (Priority: P2)

作为开发者，我想测试 AI 能否将生成内容自动写入本地文件，  
我勾选 `write_file` 工具，要求 AI 生成一份报告并保存到本地，  
AI 调用 write_file 工具将内容写入 `downloads/` 目录，ToolResultCard 显示保存成功及文件路径。

**Why this priority**: 展示 AI 对本地文件系统的操控能力，是"AI 作为自动化助手"场景的重要演示。

**Independent Test**: 勾选 `write_file`，输入「生成一份 AI 工具调用介绍并保存为文件 ai_intro」，能看到 ToolCallCard（工具名 write_file，含 filename: ai_intro，content: 文章内容）+ ToolResultCard（显示绝对文件路径）+ AnswerCard（确认文件已保存）。本地 `downloads/ai_intro.txt` 文件实际存在且内容正确。

**Acceptance Scenarios**:

1. **Given** 勾选 `write_file`，**When** 发送「生成 AI 简介并保存为文件 summary」，**Then** ToolCallCard 显示 write_file + filename + content 参数，ToolResultCard 显示「文件已保存到 /path/to/downloads/summary.txt」，本地文件实际存在。
2. **Given** AI 传入的 filename 包含「../」，**When** write_file 执行，**Then** ToolResultCard 显示「文件名不合法，不允许包含路径分隔符」，不创建任何文件。

---

### User Story 4 — 工具与无工具模式无缝共存 (Priority: P3)

作为开发者，我有时想对比模型原生回答与借助工具的回答，  
不勾选任何工具时，Playground 的行为与增强前完全一致；  
勾选工具后才进入 Agent 执行模式。

**Why this priority**: 向后兼容是底线，不应因增加工具功能而破坏现有的模型对比使用场景。

**Independent Test**: 不勾选任何工具，发送一条 Prompt，行为与现有 001-playground 实现完全相同，响应区仅展示 AnswerCard，无 ToolCallCard。

**Acceptance Scenarios**:

1. **Given** 工具面板未勾选任何工具，**When** 发送 Prompt，**Then** 调用现有的结构化流式接口，响应区与现在完全相同，不显示任何 ToolCallCard。
2. **Given** 已勾选工具并看到工具调用卡，**When** 取消所有工具勾选并重新发送，**Then** 恢复无工具模式，响应区无 ToolCallCard。

---

### Edge Cases

- **多步 ReAct 循环上限**：AI 最多执行 8 轮工具调用，超过后强制结束并以现有已渲染内容为准，防止无限循环。
- **推理模型思考链与工具调用并存**：推理模型（如 DeepSeek V4 Flash/Pro）可能在工具调用前输出思考链；ThinkingCard 渲染思考链内容，随后依次出现 ToolCallCard → ToolResultCard → AnswerCard。非推理模型不出现 ThinkingCard，直接从 ToolCallCard 开始渲染。
- **工具调用参数解析失败**：AI 输出的工具参数格式不合法时，ToolResultCard 显示「参数解析错误」，不中断请求，AI 可继续尝试或直接给出答案。
- **工具执行超时**：单个工具调用超过 10 秒未返回，ToolResultCard 显示「工具执行超时」，AI 继续处理。
- **Prompt 为空时勾选了工具**：「发送」按钮保持禁用，不发起请求（与无工具模式行为一致）。
- **流式执行中切换工具勾选**：工具面板在 AI 执行期间整体禁用（与模型选择器同步），执行结束后恢复。
- **API Key 部分缺失**：用户可正常勾选任意工具，AI 执行时若 Key 缺失，在该工具的 ToolResultCard 中显示明确错误，不阻断其他工具的执行，AI 继续生成最终答案。
- **重新发送清空上次结果**：重新发送时，上一次的所有工具卡片和 AnswerCard 全部清空，展示新一次执行过程。
- **视口宽度 < 1024px**：展示「请在桌面浏览器使用」提示（与 001-playground 一致）。
- **write_file 文件名非法**：`filename` 参数包含 `/`、`\`、`..` 等路径穿越字符时，ToolResultCard 显示「文件名不合法，不允许包含路径分隔符」，不创建任何文件。
- **write_file 内容过大**：`content` 超过 1MB 时，ToolResultCard 显示「文件内容超出 1MB 限制」，不写入文件。
- **write_file 同名覆盖**：目标路径已存在同名文件时，直接覆盖，ToolResultCard 显示成功并注明「已覆盖原有文件」。
- **downloads/ 目录不存在**：首次调用 `write_file` 时自动创建 `downloads/` 目录。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 在 Playground 页面的模型选择器下方提供始终展开的「工具」面板（无折叠），直接显示 5 个工具复选框；面板顶部以文字说明当前选中数量及模式（如「工具（已选 2 个，启用 Agent 模式）」）。
- **FR-002**: 工具面板 MUST 包含以下 5 个内置工具的独立复选框：`get_current_time`（获取当前时间）、`calculate`（数学计算）、`web_search`（联网检索）、`get_weather`（查询天气）、`write_file`（写入本地文件）。
- **FR-003**: 工具面板中所有工具复选框均可正常勾选，不预检 API Key 配置状态；若工具执行时 Key 缺失或无效，MUST 在对应 ToolResultCard 中展示明确的中文错误信息（如「web_search 工具未配置 API Key，请在 .env.local 中添加 TAVILY_API_KEY」），不静默失败。
- **FR-004**: 当至少一个工具被勾选时，系统 MUST 切换为 Agent 执行模式；当无工具勾选时，系统 MUST 使用现有的结构化流式模式（100% 向后兼容）。
- **FR-005**: Agent 执行模式下，系统 MUST 在 AI 发起每次工具调用时**立即**在响应区渲染 ToolCallCard（显示工具名 + 调用参数）。
- **FR-006**: Agent 执行模式下，系统 MUST 在工具执行完成后立即渲染 ToolResultCard（显示返回结果或错误信息）；工具执行期间该位置显示骨架屏。
- **FR-007**: 系统 MUST 支持 ReAct 多轮循环，每轮的 ToolCallCard + ToolResultCard 按顺序追加到响应区，最多允许 8 轮。
- **FR-008**: 工具执行失败（API Key 缺失、超时、服务不可用）时，系统 MUST 在 ToolResultCard 中展示明确的中文错误信息，不静默失败，AI 执行流程继续。
- **FR-009**: Agent 执行模式下，AnswerCard MUST 在 AI 生成最终答案时实时流式渲染，位于所有 ToolCallCard / ToolResultCard 之后。
- **FR-014**: Agent 执行模式下，若所选模型为推理模型（会产生思考链输出），ThinkingCard MUST 渲染思考链内容，位于第一张 ToolCallCard 之前；非推理模型不展示 ThinkingCard。  
  **已知兼容性限制（DeepSeek）**：DeepSeek V4 Flash / DeepSeek V4 Pro 在 Agent 模式下会被自动替换为 `deepseek-chat`（非推理版本），原因是 DeepSeek 推理模型在 Assistant 消息中嵌入 `reasoning_content` 字段，而 Vercel AI SDK 的 OpenAI 兼容层在构造第 2 步消息时不会将该字段透传回 API，导致 DeepSeek API 返回 400（"`The 'reasoning_content' in the thinking mode must be passed back to the API.`"）。替换为 `deepseek-chat` 后多步工具调用恢复正常，但 ThinkingCard 将不在 DeepSeek Agent 模式下出现。
- **FR-010**: 工具面板 MUST 在 AI 执行期间与模型选择器同步禁用，响应完成后恢复可操作。
- **FR-011**: 「复制原始 JSON」按钮 MUST 包含本次执行的完整数据（含 toolCalls、toolResults、answer）。
- **FR-012**: 完整执行结束后，系统 MUST 将执行结果（含工具调用链路）存入 sessionStorage，同 Tab 刷新后可恢复展示。
- **FR-013**: 所有颜色与间距 MUST 使用 `@theme` token，禁止硬编码 hex 值，卡片间距遵守视觉宪法（24px）。
- **FR-015**: `write_file` 工具 MUST 接受两个参数：`filename`（文件名，不含路径，不含扩展名）和 `content`（文本内容）；系统自动将内容以 UTF-8 编码写入本地项目根目录下 `downloads/` 子目录，文件名后缀固定为 `.txt`；写入成功后 ToolResultCard 显示文件的绝对路径；若文件名包含路径分隔符（`/` 或 `\`），MUST 返回「文件名不合法」错误，防止路径穿越；`write_file` 使用 Node.js 运行时，不使用 Edge Runtime。

### Key Entities

- **ToolDefinition**：内置工具的描述，包含工具名、功能描述、参数列表、是否需要外部 API Key
- **ToolCallEvent**：AI 发起工具调用时的事件，包含调用 ID、工具名、传入参数
- **ToolResultEvent**：工具执行完成的事件，包含调用 ID、工具名、执行结果或错误信息
- **AgentExecution**：一次完整 Agent 执行的记录，包含多个 ToolCallEvent + ToolResultEvent + 最终文字答案
- **ToolConfigStatus**：工具的 API Key 配置状态（`configured` | `missing`）

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 勾选工具后发送 Prompt，首个 ToolCallCard 出现时间 < 2s（P95，正常网络）。
- **SC-002**: 工具卡片按执行顺序依次出现，每张 ToolCallCard 与其对应的 ToolResultCard 之间有明确的先后顺序（结果在调用之后出现）。
- **SC-003**: 不勾选任何工具时，Playground 行为与 001-playground 实现 100% 一致，零回归。
- **SC-004**: 工具执行失败时，100% 在 ToolResultCard 中显示中文错误信息，0 个静默失败场景。
- **SC-005**: 单次 Agent 执行最多 8 步工具调用，100% 不超出限制。
- **SC-006**: 工具执行中，工具面板复选框 100% 处于禁用态，执行完成后 100% 恢复可用。
- **SC-007**: 视觉检查确认工具面板、ToolCallCard、ToolResultCard 使用语义 token（0 个 hardcoded hex），卡片间距 24px。
- **SC-008**: 非 DeepSeek 推理模型在 Agent 模式下若输出思考链，ThinkingCard 出现率 100%；非推理模型 ThinkingCard 出现率 0%。  
  **例外**：DeepSeek V4 Flash / DeepSeek V4 Pro 在 Agent 模式下因 `reasoning_content` 兼容性问题自动切换为 `deepseek-chat`（见 FR-014 注），ThinkingCard 不出现。

---

## Clarifications

### Session 2026-04-30

- Q: 当用户勾选工具但所选模型不支持工具调用时，系统如何处理？ → A: 所有 6 个模型均支持工具调用，无需在 UI 层做兼容性过滤或错误处理。
- Q: 工具 API Key 配置状态如何传递给前端？ → A: 不预检测，工具面板所有工具始终显示为可用，仅在实际调用失败时通过 ToolResultCard 展示错误信息。
- Q: Agent 模式下 ThinkingCard 是否展示？ → A: 仅对会产生思考链的推理模型（如 DeepSeek V4 Flash/Pro）展示 ThinkingCard，其他模型不展示。
- 补充工具（2026-04-30）：新增第 5 个内置工具 `write_file`，将文本内容写入本地 `.txt` 文件；该工具使用 Node.js 运行时，不使用 Edge Runtime，其余 4 个工具仍走 Edge Runtime。

---

## Assumptions

- 增强版 Playground 与 Agent 商店的 `/agent/[id]` 页面完全独立，不共享执行逻辑（两个功能有各自的 spec）。
- 前 4 个内置工具（`get_current_time`、`calculate`、`web_search`、`get_weather`）均在服务端 Edge Runtime 中执行，工具实现只使用 HTTP 请求，不访问文件系统。`write_file` 是例外，它需要文件系统访问权限，MUST 使用独立的 Node.js 运行时 API 路由（非 Edge Runtime）。
- 所有 6 个模型（deepseek-v4-flash、deepseek-v4-pro、gpt-4o-mini、claude-sonnet-4-6、gemini-2.0-flash、qwen3.6-plus）均原生支持工具调用能力，无需在 UI 层过滤或降级处理。
- `web_search` 使用 Tavily Search API，通过 `TAVILY_API_KEY` 环境变量配置，Key 缺失时在 ToolResultCard 报错（无降级策略）。
- `get_weather` 使用 OpenWeatherMap API，通过 `OPENWEATHER_API_KEY` 环境变量配置，同上。
- `calculate` 工具使用白名单正则校验表达式（仅允许数字、`+`、`-`、`*`、`/`、`%`、括号、小数点、空格），校验通过后由递归下降解析器（`parseFactor / parseTerm / parseExpr`）安全求值——不使用 `Function()` 或 `eval()`，确保在 Edge Runtime 中合法运行；仅支持基础四则运算和取余，不支持 sqrt/abs 等数学函数；无需引入第三方数学库。
- 工具面板不预检 API Key 配置状态，无需专用检测接口；Key 缺失时在工具执行阶段通过 ToolResultCard 反馈错误。
- 单次 Edge Runtime 调用上限 60 秒，8 步工具调用总计耗时在此范围内。
- 工具调用结果不落服务端日志（安全约束）。
- 最小视口宽度 1024px，移动端不支持。

---

## Out of Scope

- Agent 商店中各 Agent 的 Playground 页面（单独 spec：003-agent-playground）
- 用户自定义工具（添加自己的工具 URL / 函数）——v2 功能
- 工具调用历史记录的长期持久化（RunHistory Spec 负责）
- 并发工具调用（当前 ReAct 模型为串行调用）
- 工具参数的前端可视化编辑（参数由 AI 自动生成）
- 移动端适配
