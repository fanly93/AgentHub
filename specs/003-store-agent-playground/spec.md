# Feature Specification: Agent 商店详情页 Playground 实现

**Feature Branch**: `003-store-agent-playground`  
**Created**: 2026-05-01  
**Status**: Draft  
**Input**: User description: "Agent 商店详情页 Playground 实现：通用 Agent、DeepResearch Agent、其他普通 Agent 三类真实 AI 调用"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 通用 Agent 详情页真实对话 (Priority: P1)

用户在商店浏览，点击「通用智能助手」进入详情页，右侧 Playground 面板显示模型选择器和工具面板（5 个内置工具），输入 Prompt 后发起真实 AI 调用，实时看到思考链、工具调用、工具结果和最终答案依次渲染。

**Why this priority**: 这是核心功能演示路径，替换当前完全虚假的 setTimeout 模拟，是整个商店 Playground 功能的基础。

**Independent Test**: 在详情页输入任意 Prompt 并发送，可以看到真实流式响应（而非固定预设文本），即交付价值。

**Acceptance Scenarios**:

1. **Given** 用户进入通用 Agent 详情页，**When** 输入 Prompt 并点击发送，**Then** 右侧输出区实时渲染流式响应（ThinkingCard、ToolCallCard、ToolResultCard、AnswerCard）
2. **Given** 用户勾选了 web_search 工具，**When** 提问需要联网的问题，**Then** 可看到 ToolCallCard 展示搜索过程，AnswerCard 包含来自搜索的信息
3. **Given** 用户未配置 localStorage API Key，**When** 点击发送，**Then** 请求正常发出（后端通过 ENV_KEY_MAP 使用环境变量中预置的 Key）；若环境变量也无对应 Key，后端返回 401，前端展示 ErrorCard 提示"API Key 无效"
4. **Given** 用户发送请求中，**When** 点击停止，**Then** 流式输出立即终止

---

### User Story 2 - DeepResearch Agent 深度研究报告 (Priority: P2)

用户点击「深度研究助手」详情页，右侧 Playground 面板无工具勾选区（web_search 自动开启），输入研究主题后，AI 自动规划检索策略，执行多轮搜索（最多 15 步），最终输出结构化研究报告（执行摘要 / 主要发现 / 来源 / 结论与建议）。

**Why this priority**: DeepResearch 是差异化核心功能，展示比普通 Agent 更深度的 AI 能力，是商店的亮点 Agent。

**Independent Test**: 输入研究主题，可以看到多轮 web_search 调用以及结构化 Markdown 报告输出，即交付价值。

**Acceptance Scenarios**:

1. **Given** 用户进入 DeepResearch 详情页，**When** 输入研究主题并发送，**Then** 依次呈现规划思考（ThinkingCard）→ 多轮搜索卡片 → 结构化研究报告（AnswerCard，Markdown 含标题分节）
2. **Given** AI 执行多轮 web_search，**When** 每次搜索完成，**Then** 对应 ToolCallCard 和 ToolResultCard 实时追加到输出区
3. **Given** 研究报告生成完毕，**When** 用户查看 AnswerCard，**Then** 报告包含「执行摘要」「主要发现」「来源与参考」「结论与建议」四个章节
4. **Given** 搜索 API 不可用，**When** 工具调用失败，**Then** ToolResultCard 展示中文错误说明，AI 继续基于已有信息完成报告

---

### User Story 3 - 普通 Agent 简单单轮对话 (Priority: P3)

用户进入其他普通 Agent（如「CodeReviewer Pro」、「SQL 翻译官」等）详情页，右侧展示简单单轮对话面板：模型选择器 + 输出区（Markdown 渲染）+ 输入框。发送后调用真实 AI，按该 Agent 品类预设的系统提示词生成回答，无工具面板。

**Why this priority**: 覆盖商店中绝大多数 Agent（22 个），统一替换假数据，确保所有详情页可用。

**Independent Test**: 任意进入一个普通 Agent 详情页，发送任意问题，可收到真实 AI 响应（而非固定预设文本），即交付价值。

**Acceptance Scenarios**:

1. **Given** 用户进入 CodeReviewer Pro 详情页，**When** 粘贴代码并发送，**Then** AI 按代码审查角色回复，输出区 Markdown 渲染
2. **Given** 用户进入 SQL 翻译官详情页，**When** 输入自然语言查询需求，**Then** AI 回复对应 SQL 语句
3. **Given** 普通 Agent 详情页流式响应**未进行**中，**When** 用户切换模型选择器，**Then** 下次请求使用新选择的模型
4. **Given** 普通 Agent 详情页流式响应**进行中**，**When** 用户尝试切换模型选择器，**Then** 模型选择器处于禁用态，不可交互，流式结束后恢复

---

### Edge Cases

- DeepResearch 达到 15 步上限时，AI 基于已收集信息直接输出综合报告，不再发起新搜索
- 用户在流式输出过程中导航离开当前详情页，AbortController 自动取消请求，不产生悬挂连接
- 用户输入超过 4000 字时，输入框下方显示橙色预警「内容可能超出模型限制」，仍可发送；实际 400 错误由 ErrorCard 兜底

### Error Handling

不同错误类型在输出区显示对应的红色 ErrorCard，按错误根因展示不同中文说明，指引用户采取正确行动：

- **401 / 403 API Key 无效**：「API Key 无效，请前往设置重新配置」
- **429 速率限制**：「已触发速率限制，X 秒后可重试」，显示倒计时，倒计时结束前发送按钮禁用
- **400 上下文超限**：「输入内容过长，请缩短后重试」
- **5xx / 网络断连**：「网络异常，请检查连接后重试」
- **工具调用失败**（DeepResearch web_search 超时）：在 ToolResultCard 显示中文错误说明，AI 继续基于已有信息完成报告

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 将 `/agent/[id]` 详情页右侧 Playground 的模拟 setTimeout 流式替换为真实 API 调用
- **FR-002**: 系统 MUST 根据 agent 的 `agentType` 字段（`general` / `deepresearch` / `simple`）渲染不同的 Playground 面板
- **FR-003**: 通用 Agent 面板 MUST 包含模型选择器、5 个工具 Checkbox 面板、实时卡片式响应区（ThinkingCard / ToolCallCard / ToolResultCard / AnswerCard）
- **FR-004**: 通用 Agent 面板 MUST 复用现有 `/api/agent/stream` 路由、`useAgentStream` Hook 和现有卡片组件
- **FR-005**: DeepResearch Agent 面板 MUST 使用新建专用路由，自动开启 web_search，maxSteps 为 15，用户无需手动勾选工具
- **FR-006**: DeepResearch Agent MUST 使用面向深度研究优化的系统提示词，引导 AI 执行「规划 → 多轮搜索 → 综合分析」流程
- **FR-007**: DeepResearch Agent 最终答案 MUST 包含结构化研究报告（执行摘要 / 主要发现 / 来源与参考 / 结论与建议）
- **FR-008**: 普通 Agent 面板 MUST 调用现有 `/api/playground/stream` 路由，按 agent 品类注入对应系统提示词
- **FR-009**: 普通 Agent 面板 MUST 包含模型选择器和 Markdown 渲染的输出区，无工具面板
- **FR-010**: `mock-data.ts` MUST 新增 `agentType` 字段，明确区分三类 Agent
- **FR-011**: 所有面板 MUST 展示已用 Token 数量和预估成本信息
- **FR-012**: 流式响应过程中 MUST 提供停止按钮，用户可随时中断
- **FR-013**: 三种面板 MUST 直接发起请求（传入 `apiKey ?? ""`），由后端 ENV_KEY_MAP 兜底；若 Key 无效后端返回 401，前端 ErrorCard 展示"API Key 无效，请前往设置重新配置"；不得在前端预检 localStorage API Key 后禁止发送按钮（以免阻断内置 ENV Key 的使用路径）
- **FR-014**: 系统 MUST 按错误类型展示分层 ErrorCard（401→Key 无效提示、429→倒计时重试、400→内容过长、5xx/网络→网络异常），429 错误倒计时结束前发送按钮保持禁用
- **FR-015**: 流式响应进行期间，发送按钮 MUST 变为「停止」按钮（不可重复发送），模型选择器和工具面板 MUST 变为禁用态；流式结束后全部恢复可交互
- **FR-016**: 输入框下方 MUST 实时显示字符计数；超过 4000 字时显示橙色警告「内容可能超出模型限制」，不阻止发送
- **FR-017**: 三种面板（General / DeepResearch / Simple）MUST 复用现有 `playground-session.ts`，在同一浏览器 session 期间保留最后一次对话结果；刷新或关闭标签后清空，不支持跨 session 恢复
- **FR-018**: `AnswerCard` 的 Markdown 渲染 MUST 支持 GFM 表格（GitHub Flavored Markdown），使用 `remark-gfm` 插件；`@tailwindcss/typography` 提供 `prose` 样式，输出区宽度溢出时允许水平滚动（`overflow-x-auto`）
- **FR-019**: DeepResearch 研究完成后（`isLoading=false && answer 存在`），在工具调用列表末尾与最终答案之间 MUST 显示调用次数统计 badge，格式为"共执行 N 次工具调用，研究完成"

### Key Entities

- **Agent**：商店中的智能助手，新增 `agentType`（`general` | `deepresearch` | `simple`）、`defaultModel`（可选，预设模型）；品类系统提示词通过 `CATEGORY_PROMPTS[agent.category]` 运行时查找，不存储在 Agent 实体中
- **GeneralAgentPanel**：通用 Agent 专属面板组件，包含工具选择和 Agent 模式流式渲染
- **DeepResearchPanel**：DeepResearch 专属面板组件，无工具选择，强制 web_search，输出结构化报告
- **SimpleAgentPanel**：普通 Agent 通用面板组件，单轮对话，Markdown 渲染输出

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 进入任意 Agent 详情页并发送 Prompt 后，首个响应内容（第一个流式 token）在 3 秒内出现（正常网络，P95）
- **SC-002**: 商店所有 24 个 Agent 详情页均可发起真实 AI 对话（不再有固定预设文本）
- **SC-003**: DeepResearch Agent 平均执行 5 轮以上 web_search，最终输出覆盖 4 个规定章节
- **SC-004**: 通用 Agent 工具调用卡片（ThinkingCard / ToolCallCard / ToolResultCard / AnswerCard）在触发工具时实时出现，无明显延迟
- **SC-005**: 普通 Agent 详情页加载后，用户无需任何配置即可直接发送 Prompt 并获得响应（使用环境变量中预置的 API Key）

## Clarifications

### Session 2026-05-01

- Q: 错误状态展示策略 → A: 分层错误卡片（按 401/429/400/5xx 错误类型显示不同中文 ErrorCard，429 带倒计时重试）
- Q: 速率限制/防连击策略 → A: 流式中禁用发送（变为停止按钮）+ 429 倒计时兜底，无额外节流逻辑
- Q: 上下文长度超限处理 → A: 发送前字符预警（超 4000 字显示橙色提示，不阻止发送，400 错误由 ErrorCard 兜底）
- Q: 流式过程中切换模型 → A: 流式期间模型选择器禁用，流式结束后恢复
- Q: 数据持久化策略 → A: sessionStorage（同 session 保留最后一次结果，刷新清空，复用现有 playground-session.ts）

### Session 2026-05-01（实现阶段更新）

- FR-013 行为变更：实现阶段发现后端 ENV_KEY_MAP 已内置 API Key 兜底，前端预检并禁用发送按钮会阻断合法使用路径。修正为：不预检，传空串给后端，401 ErrorCard 兜底
- GeneralAgentPanel 默认模型：改为 `deepseek-v4-flash`（与平台默认模型对齐）
- DeepResearch 模型：`deepseek-v4-pro`
- AnswerCard 新增 GFM 表格支持（remark-gfm + @tailwindcss/typography），解决研究报告中 Markdown 表格无法渲染问题
- DeepResearch 完成后新增工具调用次数统计 badge（FR-019）
- 主页「打开 Playground」按钮链接更新为 `/agent/agent-general`（原为硬编码 `/agent/agent-1`）
- Next.js 版本实际为 16.2.4（plan.md 记录为 15），`params` 在 client component 已变为 `Promise`，使用 `React.use(params)` 解包

## Assumptions

- 用户已在环境变量或 localStorage 中配置至少一个 Provider 的 API Key
- 通用 Agent 和 DeepResearch Agent 各一个，其余 22 个 Agent 全部为 `simple` 类型
- DeepResearch 专用路由与现有 `/api/agent/stream` 采用相同的 NDJSON 事件流协议，可复用 `useAgentStream` Hook
- DeepResearch 的 15 步上限在 Edge Runtime 60 秒硬限制内可完成（单步 web_search P95 < 3s）
- 普通 Agent 系统提示词按 agent 品类（`categories` 数组）静态配置，不支持用户自定义
- 商店页（`/gallery`）的 Agent 列表和卡片展示无需修改，只改详情页逻辑
- 桌面浏览器（≥1024px）为目标平台，移动端不在本期范围内
- 对话不跨 session 持久化，复用现有 `playground-session.ts`（sessionStorage），无需新增存储层
