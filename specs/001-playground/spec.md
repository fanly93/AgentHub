# Feature Specification: Playground 页 — 流式结构化 AI 响应

**Feature Branch**: `001-playground`  
**Created**: 2026-04-30  
**Status**: Draft  
**Input**: User description: "Playground 页 - 流式结构化 UI 卡片渲染"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — 发送 Prompt 并看到流式结构化响应 (Priority: P1)

作为一个同时使用多个 AI 模型的开发者，
我在 Playground 页面选择模型、输入 Prompt，然后按 Cmd+Enter 提交，
AI 的响应不是等全部完成后才出现，而是**逐卡片流式渲染**（思考过程卡 → 工具调用卡 → 工具结果卡 → 最终答案卡）。

**Why this priority**: 这是 Playground 的核心价值主张。没有流式结构化渲染，功能本身不成立。

**Independent Test**: 用 DeepSeek-v4-flash 发送一条简单 Prompt，在响应区能看到至少一张骨架屏立即出现，随后文字逐步填充；最终答案区以 Markdown 格式呈现。

**Acceptance Scenarios**:

1. **Given** 页面已加载、选择了 deepseek-v4-flash，**When** 输入框有内容并按 Cmd+Enter，**Then** 输入框禁用（防二次提交），响应区立即出现骨架屏，首个 token 出现时间 < 2s。
2. **Given** AI 正在流式响应，**When** "思考过程" block 数据开始到来，**Then** 在"思考过程"卡区域逐字渲染文字，而"最终答案卡"仍显示骨架屏。
3. **Given** AI 响应完成，**When** 流关闭，**Then** 所有骨架屏消失，显示完整的结构化卡片；"发送"按钮恢复可用。

---

### User Story 2 — 切换模型（≥5 个供应商）并重新发送 (Priority: P2)

作为开发者，我希望能在 Playground 顶部快速切换不同供应商的模型，
不需要离开页面即可对比不同模型对同一 Prompt 的响应结构。

**Why this priority**: 多模型切换是区分 Playground 与单一 AI Chat 的核心差异点，优先级仅次于流式渲染本身。

**Independent Test**: 选择列表中至少能看到 5 个模型选项，切换到 Claude 4.6 后发送一条 Prompt，响应正常流式渲染。

**Acceptance Scenarios**:

1. **Given** 页面加载，**When** 查看模型选择器，**Then** 显示至少以下 5 个选项：`gpt-4o-mini`（OpenAI）、`claude-sonnet-4-6`（Anthropic）、`gemini-2.0-flash`（Google）、`deepseek-v4-flash`（DeepSeek）、`qwen3.6-plus`（Alibaba），默认选中 `deepseek-v4-flash`。
2. **Given** 当前模型为 deepseek-v4-flash，**When** 切换为 claude-sonnet-4-6 并发送 Prompt，**Then** 请求使用 Anthropic 渠道，响应正常流式渲染。
3. **Given** 切换模型后，**When** 发送 Prompt，**Then** 之前的响应区内容清空，展示新一次的响应。

---

### User Story 3 — 查看原始结构化 JSON (Priority: P3)

作为开发者，我希望看到 AI 返回的完整结构化 JSON 数据，
以便调试 Zod schema 字段映射是否正确。

**Why this priority**: 开发调试辅助功能；核心流式渲染不依赖它，但对技术用户有重要价值。

**Independent Test**: 点击"复制原始 JSON"按钮后，剪贴板内容是 JSON 字符串，包含 `thinking`、`toolCalls`、`toolResults`、`answer` 字段。

**Acceptance Scenarios**:

1. **Given** AI 响应已完成，**When** 点击"复制原始 JSON"按钮，**Then** 剪贴板中复制的内容是完整的结构化 JSON，包含本次响应的所有字段。
2. **Given** AI 正在流式响应（尚未完成），**When** 点击"复制原始 JSON"按钮，**Then** 复制当前已接收的部分 JSON 数据（非阻塞）。
3. **Given** 复制成功，**When** 按钮被点击，**Then** 按钮文案短暂变为"已复制 ✓"并在 2s 后恢复。

---

### User Story 4 — 错误状态明确展示（两档容错）(Priority: P4)

作为用户，当 AI 调用失败时（API key 错误、速率限制、模型不可用、流中断），
我希望看到清晰的中文错误提示，并能区分"可重试"与"需修正"两类错误。

**Why this priority**: 错误处理是健壮性底线；若错误被静默，用户无法判断是否需要重试。

**Independent Test**: 使用无效的 API Key 发送一条 Prompt，响应区显示红色错误卡片（fatal 类型）；使用有效 Key 但触发 429 时，显示橙色卡片并在 Retry-After 时间后自动恢复。

**Acceptance Scenarios**:

1. **Given** API Key 无效（HTTP 401），**When** 发送 Prompt，**Then** 响应区显示**红色** fatal 错误卡片，文案"API Key 无效，请前往设置页更新"，发送按钮恢复可用。
2. **Given** Prompt 超出模型上下文限制（HTTP 400），**When** 发送 Prompt，**Then** 显示**红色** fatal 错误卡片，文案"输入内容过长，请缩短 Prompt 后重试"。
3. **Given** 供应商速率限制（HTTP 429），**When** 发送 Prompt，**Then** 显示**橙色** retryable 错误卡片，文案"请求过于频繁"；发送按钮进入 Retry-After 倒计时禁用态，倒计时结束后自动恢复。
4. **Given** 模型暂时不可用（HTTP 503）或网络超时（>60s），**When** 发送 Prompt，**Then** 显示**橙色** retryable 错误卡片，文案"模型暂时不可用，请稍后重试"。
5. **Given** 流式传输过程中网络断开，**When** 已有部分 token 渲染，**Then** 已渲染内容保留，响应区顶部追加黄色警告条"传输中断，以下为部分结果"，发送按钮恢复可用。
6. **Given** 有错误信息显示，**When** 再次发送新请求，**Then** 错误信息清空，展示新请求的响应。

---

### Edge Cases

- 用户连续快速点击"发送"时，第二次点击在第一次响应完成前无效（防抖 / 禁用状态）。
- Prompt 为空字符串或仅含空格时，"发送"按钮禁用，不发起请求。
- AI 响应 JSON 缺少某个卡片字段（如没有 `toolCalls`）时，对应卡片不渲染，不报错。
- `thinking` 字段超长（>10000 字符）时，思考过程卡可折叠，默认收起，不撑破布局。
- 模型供应商的 API 返回 `thinking` 为空时，思考过程卡不渲染（不显示空卡片）。
- 视口宽度 < 1024px 时（符合宪法最小宽度），展示"请在桌面浏览器使用"提示。
- **模型切换锁定**：流式响应进行中，模型选择器与输入框同步禁用；响应完成（流关闭）后恢复可操作。
- **上下文长度软警告**：输入框字符数超过 4000 时，输入框下方显示橙色警告文案"内容可能超出模型上限"，不阻断提交；低于 4000 时警告消失。
- **速率限制自适应冷却**：收到供应商 429 响应时，客户端读取 `Retry-After` 响应头（默认 30s 若无此 header），发送按钮在对应时长内显示倒计时（如"29s 后可重试"）并禁用，超时后自动恢复。
- **流式中断保留内容**：流传输中途断开时，已渲染的卡片内容保留，不清空；响应区顶部追加黄色警告条"传输中断，以下为部分结果"。
- 同一 Tab 内刷新页面后，`sessionStorage` 中保存的最后一次完整响应自动恢复并展示；关闭 Tab 后不保留。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 在页面顶部渲染模型选择器，包含 ≥5 个模型选项，默认选中 `deepseek-v4-flash`。
- **FR-002**: 系统 MUST 提供 multiline 输入框，支持 Cmd+Enter 提交（Mac）/ Ctrl+Enter 提交（Windows）。
- **FR-003**: 系统 MUST 提供"清空"与"发送"按钮；输入框为空时"发送"按钮 disabled。
- **FR-004**: API Route MUST 使用 Edge Runtime，单次调用不超过 60 秒。
- **FR-005**: 系统 MUST 使用 Vercel AI SDK 的 `streamObject` 进行流式结构化输出，禁止自行解析 SSE。
- **FR-006**: Zod response schema MUST 定义在 `shared/schemas/playgroundResponse.ts`，前后端共用同一 schema 文件。
- **FR-007**: 响应区 MUST 根据 schema 字段独立渲染 4 种卡片：思考过程卡（timeline）、工具调用卡（table）、工具调用结果卡（table）、最终答案卡（markdown）。
- **FR-008**: 每张卡片字段数据未就绪时 MUST 显示骨架屏，有数据后立即替换渲染。
- **FR-009**: 系统 MUST 提供"复制原始 JSON"按钮，点击后将当前已接收的结构化 JSON 复制到剪贴板。
- **FR-010**: 错误处理 MUST 走 `onError` 回调，禁止静默失败；错误分两档：`fatal`（401/400，红色卡片）和 `retryable`（429/503/超时/流中断，橙色卡片）；流中断时保留已有内容并追加黄色警告条。
- **FR-011**: 所有颜色与间距 MUST 使用 `@theme` token，禁止硬编码 hex 值或裸 Tailwind 色阶。
- **FR-012**: 卡片间距 MUST 为 24px（遵守视觉宪法第 #15 条）。
- **FR-013**: 模型选择器 MUST 在流式响应期间与输入框同步禁用，流关闭后恢复。
- **FR-014**: 输入框 MUST 实时显示字符计数；字符数 > 4000 时在输入框下方展示橙色软警告，不阻断提交。
- **FR-015**: 收到 HTTP 429 时，系统 MUST 读取 `Retry-After` 响应头（默认 30s），在该时长内禁用发送按钮并显示剩余秒数倒计时。
- **FR-016**: 每次流式响应**完整**结束后，系统 MUST 将结构化 JSON 结果存入 `sessionStorage`；同 Tab 刷新后自动读取并恢复展示；不跨 Tab、不跨 Session 持久化。

### Key Entities

- **PlaygroundRequest**: `{ model: ModelId; prompt: string }`
- **PlaygroundResponse** (Zod schema in `shared/schemas/playgroundResponse.ts`):
  ```
  {
    thinking?:    string            // 思考过程，可选
    toolCalls?:   ToolCall[]        // 工具调用列表，可选
    toolResults?: ToolResult[]      // 工具调用结果列表，可选
    answer:       string            // 最终答案，Markdown 格式
    metadata?:    Metadata          // token用量，可选，流完成后填入
  }
  ```
- **ToolCall**: `{ name: string; arguments: Record<string, unknown> }`
- **ToolResult**: `{ name: string; result: unknown; error?: string }`
- **ModelId**: `"gpt-4o-mini" | "claude-sonnet-4-6" | "gemini-2.0-flash" | "deepseek-v4-flash" | "deepseek-v4-pro" | "qwen3.6-plus"` （共 6 个；旧名 `deepseek-chat` / `deepseek-reasoner` 已弃用；`qwen-turbo` 已替换为 `qwen3.6-plus`）
- **ErrorTier**: `"fatal"` (401/400，需用户操作修正，红色) | `"retryable"` (429/503/超时/流中断，可自动恢复，橙色)
- **PlaygroundError**: `{ tier: ErrorTier; message: string; code: string; retryAfterMs?: number }` （`code` 为机器可读错误码，见 API 合约错误码表）

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 发送 Prompt 后，首个 token 出现（骨架屏替换为真实内容）时间 < 2s（P95，正常网络条件）。
- **SC-002**: 5 个模型供应商（OpenAI / Anthropic / Google / DeepSeek / Alibaba）均能正常发起调用并流式渲染响应。
- **SC-003**: Prompt 为空时"发送"按钮 100% 处于禁用态，不发起任何网络请求。
- **SC-004**: API 调用失败时，100% 展示中文错误提示，0 个静默失败场景。
- **SC-005**: 所有卡片在部分字段到达时立即渲染可见内容，不等待全部字段到齐（骨架屏策略验证）。
- **SC-006**: 视觉检查确认所有颜色使用语义 token（0 个 hardcoded hex）、卡片间距为 24px。
- **SC-007**: 收到 HTTP 429 后发送按钮 100% 进入倒计时禁用态，Retry-After 结束后自动恢复（0 次需用户手动刷新）。
- **SC-008**: 同 Tab 刷新后，上一次完整响应 100% 从 `sessionStorage` 恢复展示；关闭 Tab 后无任何残留。
- **SC-009**: 输入框字符数超过 4000 时，橙色警告 100% 出现；低于 4000 时 100% 消失。

---

## Assumptions

- API Keys 存储在浏览器 `localStorage`，由 Settings 页管理（不在本 Spec 范围内），Playground 直接读取。
- 本 Spec 不实现历史对话功能，每次发送视为独立请求，无上下文记忆。
- 模型供应商接入：OpenAI / Anthropic / Google 使用各自的 `@ai-sdk/*` native provider；DeepSeek / Qwen 使用 `createOpenAI({ baseURL }).chat(model)` 接入 OpenAI-compatible endpoint（`compatibility:'compatible'` 选项已在 @ai-sdk/openai v3 中移除）。详见 research.md Decision 1。
- `dashscope`（Qwen，当前模型 `qwen3.6-plus`）使用 OpenAI-compatible endpoint，与其他供应商统一处理。
- 最小视口宽度遵守宪法约定为 **1024px**（用户需求提及 768px，但宪法第四条平台目标优先）。
- `thinking` 字段仅在模型支持并返回推理过程时存在，不支持的模型不展示该卡片。
- Markdown 渲染使用已有依赖（如 `react-markdown`），不引入 KaTeX（已明确 Out of Scope）。
- 单次 Edge Runtime AI 调用硬上限 60 秒（宪法第三条）。
- 每次**完整**流式响应结束后，结果存入 `sessionStorage`（同 Tab 内刷新可恢复，关闭 Tab 丢失）。运行记录的长期持久化属于 RunHistory Spec，本 Spec 不实现 `localStorage` 或 IndexedDB 写入。

---

## Clarifications

### Session 2026-04-30

- Q: 错误状态分级策略？→ A: 两档：fatal（401/400 红色）/ retryable（429/503/超时/流中断 橙色）；流中断保留已有内容加黄色警告条
- Q: 供应商 429 速率限制的客户端策略？→ A: 自适应冷却，读取 Retry-After header（无则默认 30s），发送按钮显示倒计时后自动恢复
- Q: 上下文长度超限如何处理？→ A: 输入框字符数 > 4000 时显示橙色软性警告，不阻断提交；400 错误显示 fatal 卡片"输入内容过长"
- Q: 响应流式传输过程中切换模型的行为？→ A: 锁定选择器，与输入框同步禁用，流关闭后恢复
- Q: 页面刷新后响应状态是否恢复？→ A: 最后一次完整响应存入 sessionStorage，同 Tab 刷新可恢复；关闭 Tab 不保留；不写 localStorage/IndexedDB

---

## Out of Scope

- 历史对话功能（下个 Spec: RunHistory 负责）
- 对话分享链接（v2）
- Markdown 数学公式渲染（KaTeX 体积过大）
- 移动端适配（宪法第四条：桌面端专属，最小 1024px）
- 用户认证 / 多租户（宪法红线）
- 服务端数据库持久化（宪法红线）
