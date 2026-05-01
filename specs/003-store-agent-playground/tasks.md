# Tasks: Agent 商店详情页 Playground 实现

**Input**: Design documents from `specs/003-store-agent-playground/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: 规格未要求 TDD，本任务清单不包含单独测试任务；每个 Phase 末尾有独立验收标准。

**Organization**: 任务按用户故事分组，每个故事可独立实现和验收。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无相互依赖）
- **[Story]**: 所属用户故事（US1/US2/US3）
- 所有路径相对于 `agenthub/src/`

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 项目已存在，本期 Setup 聚焦于新增 schema 文件和 Hook 参数化改造，这些是所有后续任务的前提。

- [x] T001 将 `hooks/useAgentStream.ts` 中 fetch URL 提取为 **hook 构造参数**（不是 submit 参数），更新函数签名为 `useAgentStream(route = "/api/agent/stream")` in `agenthub/src/hooks/useAgentStream.ts`，默认值保持向后兼容；DeepResearchPanel 调用时传入 `"/api/deepresearch/stream"`
- [x] T002 [P] 新建 `agenthub/src/shared/schemas/deepresearch.ts`，定义 `DeepResearchRequestSchema`（`model: ModelIdSchema, prompt: z.string().min(1).max(50000)`）

---

## Phase 2: Foundational（阻塞性前置条件）

**Purpose**: 数据模型扩展，所有用户故事均依赖 Agent 类型系统。

**⚠️ CRITICAL**: 以下任务必须全部完成后，US1/US2/US3 才能开始。

- [x] T003 在 `agenthub/src/lib/mock-data.ts` 中扩展 `Agent` 类型，新增 `agentType: 'general' | 'deepresearch' | 'simple'` 和 `defaultModel?: ModelId` 字段（同步更新 TypeScript 类型定义）
- [x] T004 在 `agenthub/src/lib/mock-data.ts` 中新增 `CATEGORY_PROMPTS: Record<string, string>` 静态映射，覆盖全部 10 个品类：写作助手 / 代码生成 / 数据分析 / 图像理解 / 客户支持 / 翻译润色 / 研究调研 / 运营营销 / 教育辅导 / 生产力工具
- [x] T005 更新 `agenthub/src/lib/mock-data.ts` 中的 `agents` 数组：① 将数组中的前两个 Agent **替换**为 `agent-general`（通用智能助手，agentType:'general'，category:'生产力工具'，provider:'Anthropic'）和 `agent-deepresearch`（深度研究助手，agentType:'deepresearch'，category:'研究调研'，provider:'DeepSeek'），总数保持 24 个不变；② 将其余所有 Agent 的 `agentType` 设为 `'simple'`
- [x] T006 [P] 新建 `agenthub/src/components/agent-detail/` 目录（仅建目录，为后续组件准备路径）

**Checkpoint**: `mock-data.ts` 类型检查通过，所有 Agent 均有 `agentType` 字段，`CATEGORY_PROMPTS` 覆盖所有品类 → 基础数据层就绪

---

## Phase 3: User Story 1 — 通用 Agent 详情页真实对话（Priority: P1）🎯 MVP

**Goal**: 进入「通用智能助手」详情页，右侧面板展示真实 Agent 模式流式对话（ThinkingCard / ToolCallCard / ToolResultCard / AnswerCard），替换 setTimeout 模拟。

**Independent Test**: 进入 `/agent/agent-general`，勾选 `web_search` 工具，输入"今天北京天气怎么样"，确认 ToolCallCard 出现、AnswerCard 含真实信息，且非固定预设文本。

### Implementation for User Story 1

- [x] T007 [US1] 新建 `agenthub/src/components/agent-detail/GeneralAgentPanel.tsx`：内部组合 `ModelSelector` + `ToolPanel` + `ResponseArea`（均来自 `components/playground/`），通过 `ResponseArea` ref 的 `submit/stop` 接口处理发送/停止，`isLoading` 由 `ResponseArea` 状态驱动（通过回调或 ref 读取）；props: `agent: Agent`
- [x] T008 [US1] 修改 `agenthub/src/app/agent/[id]/page.tsx`：① import `GeneralAgentPanel`；② 在右侧面板区域加 `if (agent.agentType === 'general') return <GeneralAgentPanel agent={agent} />`；③ 暂时保留其余面板为原 setTimeout 实现（US2/US3 阶段替换）
- [ ] T009 验收 US1：访问 `/agent/agent-general`，确认工具面板显示 5 个 Checkbox，勾选工具后发送 Prompt，流式卡片依序渲染，停止按钮有效，刷新后输出清空（sessionStorage）

**Checkpoint**: US1 独立可验收 — 通用 Agent 详情页真实 AI 流式对话正常

---

## Phase 4: User Story 2 — DeepResearch Agent 深度研究报告（Priority: P2）

**Goal**: 进入「深度研究助手」详情页，输入研究主题后，AI 自动执行多轮 web_search（≥5 次），最终输出含四章节的结构化研究报告。

**Independent Test**: 进入 `/agent/agent-deepresearch`，输入"2025年大语言模型发展现状"，确认出现 ≥5 个 ToolCallCard（web_search），AnswerCard 含「执行摘要」「主要发现」「来源与参考」「结论与建议」四个 Markdown 标题。

### Implementation for User Story 2

- [x] T010 [US2] 新建 `agenthub/src/app/api/deepresearch/stream/route.ts`：声明 `export const runtime = 'edge'`，`export const maxDuration = 60`；解析 `DeepResearchRequestSchema`；定义 `DEEPRESEARCH_SYSTEM_PROMPT`（三阶段研究提示词：规划→多轮检索→四章节综合报告）；仅注册 `web_search` 工具（复用 `/api/agent/stream` 中的 Tavily 实现）；`maxSteps: 15`；输出与 `/api/agent/stream` 相同的 NDJSON 事件流格式
- [x] T011 [US2] 新建 `agenthub/src/components/agent-detail/DeepResearchPanel.tsx`：使用 `useAgentStream` hook，将 fetch 路由指向 `/api/deepresearch/stream`（利用 T001 提取的 `route` 参数）；无工具选择面板（web_search 自动开启，对用户不可见）；按序渲染 ThinkingCard / ToolCallCard / ToolResultCard / AnswerCard（复用现有卡片组件）；底部显示已用 token 数量和预估成本（复用现有 token/cost 展示组件）；输入框下方字符计数，超 4000 字显示橙色「内容可能超出模型限制」警告；props: `agent: Agent`
- [x] T012 [US2] 修改 `agenthub/src/app/agent/[id]/page.tsx`：import `DeepResearchPanel`，新增 `else if (agent.agentType === 'deepresearch') return <DeepResearchPanel agent={agent} />`
- [ ] T013 验收 US2：访问 `/agent/agent-deepresearch`，无工具面板显示，发送研究主题后出现 ≥5 个搜索卡片，AnswerCard 含四章节，不超过 60s 完成

**Checkpoint**: US2 独立可验收 — DeepResearch 多轮搜索与结构化报告正常

---

## Phase 5: User Story 3 — 普通 Agent 简单单轮对话（Priority: P3）

**Goal**: 所有其余 22 个 Agent 详情页展示真实单轮对话面板（无工具），按品类预设系统提示词，Markdown 渲染答案。

**Independent Test**: 进入任意普通 Agent 详情页（如 `/agent/agent-3`，CodeReviewer Pro），粘贴一段代码并发送，确认 AI 按代码审查角色回复，输出区 Markdown 渲染，且非固定预设文本。

### Implementation for User Story 3

- [x] T014 [US3] 修改 `agenthub/src/app/api/playground/stream/route.ts`：在现有 `RequestSchema` 中新增 `agentSystemPrompt: z.string().max(2000).optional()`；在 `streamText` 调用前构建 `systemPrompt = agentSystemPrompt ? \`${agentSystemPrompt}\n\n${SYSTEM_PROMPT}\` : SYSTEM_PROMPT`；其余逻辑零修改
- [x] T015 [US3] 新建 `agenthub/src/components/agent-detail/SimpleAgentPanel.tsx`：使用 `useStructuredStream<PlaygroundResponse, { model: ModelId; prompt: string; agentSystemPrompt?: string }>`，调用路由 `/api/playground/stream`，传入 `agentSystemPrompt: CATEGORY_PROMPTS[agent.category]`；**不预检 API Key**，直接传 `apiKey ?? ""` 给后端，401 错误由 ErrorCard 兜底（FR-013 修正）；仅渲染 `response.answer` 为 Markdown（使用 `AnswerCard`）；顶部含 `ModelSelector`；底部含输入框 + 发送按钮 + 字符计数 + token/cost 显示；props: `agent: Agent`
- [x] T016 [US3] 修改 `agenthub/src/app/agent/[id]/page.tsx`：import `SimpleAgentPanel`，在条件渲染链末尾添加 `else return <SimpleAgentPanel agent={agent} />`（即 `simple` 类型的 fallback）；移除原 setTimeout 模拟代码（`send` 函数、`output` state 等）
- [ ] T017 验收 US3：访问 5 个不同品类的普通 Agent 详情页，各输入一个与该品类相关的问题，确认 AI 回复符合品类角色定位，Markdown 正确渲染

**Checkpoint**: US3 独立可验收 — 所有 22 个普通 Agent 详情页真实对话正常

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 错误处理、控件禁用、字符预警、持久化——影响全部三种面板的横切关注点。

- [ ] T018 [P] 在 `agenthub/src/components/agent-detail/SimpleAgentPanel.tsx` 中完善分层 ErrorCard 渲染：从 `useStructuredStream` 获取 error 对象，按 code（INVALID_KEY / RATE_LIMITED / CONTEXT_EXCEEDED / STREAM_INTERRUPTED）展示对应中文 ErrorCard；429 错误复用现有 `useRetryCountdown` hook 驱动倒计时；发送按钮在倒计时期间禁用
- [ ] T019 [P] 在 `agenthub/src/components/agent-detail/DeepResearchPanel.tsx` 和 `GeneralAgentPanel.tsx` 中确认 `useAgentStream` 已处理分层 ErrorCard（ResponseArea 已实现）；若未覆盖 429 倒计时，补充 `useRetryCountdown` 集成
- [ ] T020 [P] 在 `agenthub/src/components/agent-detail/SimpleAgentPanel.tsx` 中实现流式期间控件禁用：`isLoading` 为 true 时 `ModelSelector` 加 `disabled` prop，发送按钮切换为停止按钮（调用 `useStructuredStream` 的 `abort()`）
- [ ] T021 [P] 在 `agenthub/src/components/agent-detail/GeneralAgentPanel.tsx` 中确认流式期间 `ModelSelector` 和工具面板的禁用态已由 `ResponseArea` 内部驱动；若未覆盖，在 `GeneralAgentPanel` 层读取 `isLoading` 并传 `disabled` prop
- [ ] T026 [P] 在 `agenthub/src/components/agent-detail/DeepResearchPanel.tsx` 中实现流式期间控件禁用（FR-015）：`isLoading` 为 true 时 `ModelSelector` 加 `disabled` prop，发送按钮切换为停止按钮（调用 `useAgentStream` 的 `stop()`），流式结束后全部恢复可交互
- [ ] T022 在 `agenthub/src/components/agent-detail/SimpleAgentPanel.tsx` 中实现字符计数预警：输入框下方展示 `{charCount} / {maxTokens}` 计数，超过 4000 字时文字变为橙色并显示「内容可能超出模型限制」badge
- [ ] T023 验证三种面板的 sessionStorage 持久化：Simple 面板刷新后输出清空、General 面板结束后 `agent:last-execution` 写入、DeepResearch 面板结束后 `agent:last-execution` 写入（均通过 DevTools Application 标签验证）
- [ ] T024 回归验证：访问 `/playground` 独立页面，完整走一遍无工具模式和 Agent 模式，确认现有功能 100% 不受影响（JSON 复制、工具面板、思考链折叠等）
- [ ] T025 [P] 布局响应性检查：在 1024px、1280px、1440px 三个视口宽度下，分别访问 General / DeepResearch / Simple 三种详情页，确认右侧面板无溢出或截断
- [x] T027 [P] 在 `agenthub/src/components/playground/cards/AnswerCard.tsx` 中集成 GFM 表格渲染（FR-018）：安装 `remark-gfm`，在 `<ReactMarkdown>` 传入 `remarkPlugins={[remarkGfm]}`；在全局 CSS 注册 `@plugin "@tailwindcss/typography"`；输出区加 `overflow-x-auto` + `break-words` 防 Markdown 表格横向溢出
- [x] T028 [P] 在 `agenthub/src/components/agent-detail/DeepResearchPanel.tsx` 中新增工具调用次数统计 badge（FR-019）：在工具调用列表末尾与 `AnswerCard` 之间，当 `!isLoading && toolCalls.length > 0 && answer` 时渲染"共执行 N 次工具调用，研究完成"提示条

---

## Dependencies & Execution Order

### Phase 依赖关系

```
Phase 1 (Setup)
  └── Phase 2 (Foundational) ← BLOCKS all user stories
        ├── Phase 3 (US1 - General Agent)   ← P1，最优先
        ├── Phase 4 (US2 - DeepResearch)    ← P2，可与 US1 并行
        └── Phase 5 (US3 - Simple Agent)    ← P3，可与 US1/US2 并行
              └── Phase 6 (Polish)          ← 所有 US 完成后
```

### 任务内部依赖

| 任务 | 依赖 |
|------|------|
| T003, T004, T005 | 顺序执行（均修改 mock-data.ts，避免冲突） |
| T007 (GeneralAgentPanel) | T003-T006 完成（无需 T001，General 使用 ResponseArea 内部默认路由） |
| T008 (page.tsx US1) | T007 完成 |
| T010 (deepresearch route) | T001, T002 完成 |
| T011 (DeepResearchPanel) | T001, T010 完成（T001 是 DeepResearch 路由参数化的前提） |
| T012 (page.tsx US2) | T011 完成 |
| T014 (playground/stream 扩展) | 独立，可在 Phase 2 后任意时刻执行 |
| T015 (SimpleAgentPanel) | T014 完成 |
| T016 (page.tsx US3) | T015 完成 |
| T018–T025 (Polish) | Phase 3+4+5 全部完成 |

### 可并行执行示例

```bash
# Phase 1 可并行
T001 (useAgentStream 参数化)  ||  T002 (deepresearch schema)

# Phase 2 顺序执行（同一文件）
T003 → T004 → T005，T006 可并行

# Phase 3/4/5 各自独立，可同时开工（不同组件文件）
T007–T009 (US1)  ||  T010–T013 (US2)  ||  T014–T017 (US3)

# Phase 6 Polish 可并行
T018 || T019 || T020 || T021 || T022 || T026
T023 → T024 → T025（验收需顺序）
```

---

## Implementation Strategy

### MVP First（仅 User Story 1）

1. 完成 Phase 1：T001, T002
2. 完成 Phase 2：T003, T004, T005, T006
3. 完成 Phase 3：T007, T008, T009
4. **STOP & VALIDATE**：通用 Agent 详情页真实对话工作正常
5. 可演示：商店中至少一个 Agent 有真实 Playground

### Incremental Delivery（推荐）

1. Phase 1 + Phase 2 → 数据层就绪
2. Phase 3 (US1) → 通用 Agent 可用 → Demo/验收
3. Phase 4 (US2) → DeepResearch 可用 → Demo/验收
4. Phase 5 (US3) → 所有 22 个普通 Agent 可用 → Demo/验收
5. Phase 6 → 错误处理 + 细节打磨 → 合并

---

## Task Summary

| Phase | 任务数 | 用户故事 | 可并行任务 |
|-------|--------|---------|-----------|
| Phase 1: Setup | 2 | — | T001, T002 |
| Phase 2: Foundational | 4 | — | T006 可并行 |
| Phase 3: US1 (P1) | 3 | 通用 Agent | — |
| Phase 4: US2 (P2) | 4 | DeepResearch | T010 独立 |
| Phase 5: US3 (P3) | 4 | 普通 Agent | T014 独立 |
| Phase 6: Polish | 11 | 全部 | T018-T022, T026-T028 并行 |
| **合计** | **28** | **3 个故事** | **多处并行** |

---

## Notes

- [P] 标记任务操作不同文件，无相互依赖，可在同一会话中并行执行
- 每个 User Story 完成后均有独立验收标准（Checkpoint），可停下来演示
- `agenthub/src/app/agent/[id]/page.tsx` 在 T008、T012、T016 三处被修改，建议单人顺序执行以避免冲突
- DeepResearch `web_search` 工具实现复用 `/api/agent/stream` 中的 Tavily fetch 逻辑，直接拷贝到新路由即可
- Polish 阶段（Phase 6）可以在开发 US2/US3 同时逐步完成，无需等到全部 US 完成
