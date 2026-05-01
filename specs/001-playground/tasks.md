# Tasks: Playground 页 — 流式结构化 AI 响应

**Input**: `specs/001-playground/plan.md` + `spec.md`  
**Branch**: `001-playground` | **Generated**: 2026-04-30

**优先级说明**:
- `[P0]` 必须 — 阻塞性任务，缺失无法演示核心功能
- `[P1]` 应该 — 重要功能，应在首次 PR 前完成
- `[P2]` 可选 — 锦上添花，可延迟到下个迭代

**标记说明**:
- `[PAR]` 可并行执行（不同文件，无未完成的前置依赖）
- `[DONE]` 已实现，跳过
- `→ 依赖: Txxx` 必须在指定任务完成后才能开始

---

## Phase 1: Setup — 依赖安装

**目标**: 让项目能编译，为所有后续任务解除阻塞

- [x] T001 [P0] 安装 AI SDK 和 Zod 依赖：`pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod react-markdown`，在 `agenthub/package.json` 中验证新增条目 (~10min)
- [x] T002 [P0] 运行 `pnpm build` 验证类型检查通过，无 TS 编译错误（~5min） → 依赖: T001

**Checkpoint**: `pnpm build` 绿色通过 → 后续所有任务可并行启动

---

## Phase 2: Foundation — 已完成基础层

**目标**: 记录已完成的核心基础设施，确认可作为后续任务的输入

- [x] T003 [P0] [DONE] 实现 Zod 共用 schema `agenthub/src/shared/schemas/playgroundResponse.ts`：PlaygroundResponseSchema / PlaygroundErrorSchema / PlaygroundSessionSchema / ModelIdSchema (~0min，已完成)
- [x] T004 [P0] [DONE] 实现 Edge Route `agenthub/src/app/api/playground/stream/route.ts`：多供应商路由、两档错误映射、Retry-After 透传、API Key header 读取 (~0min，已完成)
- [x] T005 [P0] [DONE] 实现模型配置 `agenthub/src/lib/models.ts`：MODEL_LIST、DEFAULT_MODEL、getApiKeyForModel() (~0min，已完成)

**Checkpoint**: 基础层就绪 → US-1 实现可开始

---

## Phase 3: US-1 — 发送 Prompt 并看到流式结构化响应 (P1 in spec) 🎯 MVP

**目标**: 用 DeepSeek V4 Flash 发送一条 Prompt，响应区出现 4 种结构化卡片流式渲染

**独立验收**: 发送"用一句话解释 TCP"，首个 token 出现时间 < 2s，响应区逐步出现思考过程卡和答案卡（如模型支持），无控制台报错

### 3.1 工具层

- [x] T006 [PAR] [P0] [US1] 实现 `agenthub/src/lib/playground-session.ts`：saveSession() / restoreSession() 封装 sessionStorage 读写，含 `typeof window` guard 防 SSR 报错，用 PlaygroundSessionSchema.safeParse 校验读取结果 (~15min) → 依赖: T002

### 3.2 卡片组件层（可全部并行）

- [x] T007 [PAR] [P0] [US1] 实现 `agenthub/src/components/playground/cards/AnswerCard.tsx`：接收 `content: string` 和 `isStreaming: boolean`，用 `react-markdown` 渲染 Markdown；content 为空且 isStreaming 时显示 `<Skeleton className="h-48 w-full" />`；streaming 时答案末尾追加光标动效 `▋` (~20min) → 依赖: T002
- [x] T008 [PAR] [P0] [US1] 实现 `agenthub/src/components/playground/cards/ThinkingCard.tsx`：用 `<Collapsible>` 包裹，`content.length > 10000` 时 `defaultOpen={false}`；content 为空且 isStreaming 时显示 `<Skeleton className="h-24 w-full" />`；有内容时实时追加 streaming 光标 (~25min) → 依赖: T002
- [x] T009 [PAR] [P0] [US1] 实现 `agenthub/src/components/playground/cards/ToolCallCard.tsx`：接收 `toolCalls: ToolCall[] | undefined`，用 shadcn `<Table>` 渲染 name / arguments 两列；undefined 且 isStreaming 时显示 `<Skeleton className="h-16 w-full" />`；toolCalls 为空则不渲染组件 (~15min) → 依赖: T002
- [x] T010 [PAR] [P0] [US1] 实现 `agenthub/src/components/playground/cards/ToolResultCard.tsx`：接收 `toolResults: ToolResult[] | undefined`，`<Table>` 渲染 name / result / error 三列；error 列用 `text-destructive` 标红；undefined 且 isStreaming 时显示 Skeleton (~15min) → 依赖: T002

### 3.3 响应区容器

- [x] T011 [P0] [US1] 实现 `agenthub/src/components/playground/ResponseArea.tsx`：用 Vercel AI SDK `useObject<PlaygroundResponse>({ api: '/api/playground/stream', schema: PlaygroundResponseSchema })` 管理流状态；按 `object` 字段是否有值决定渲染卡片还是骨架屏；卡片间距 `gap-6`（24px）；`onFinish` 回调调用 `saveSession()`；`onError` 回调 parse 错误 tier 并更新 error state；暴露 `submit` 方法供父组件调用 (~40min) → 依赖: T006, T007, T008, T009, T010

### 3.4 页面入口

- [x] T012 [P0] [US1] 创建 `agenthub/src/app/playground/page.tsx`：顶层 Client Component，声明 `selectedModel`、`prompt`、`isLoading` state；渲染 ResponseArea；`useEffect` on mount 调用 `restoreSession()` 但结果只打印 console.log，不注入 state（state 注入由 T022 完成）；页面布局两栏（输入区上 / 响应区下）或单栏，max-w-4xl 居中 (~30min) → 依赖: T011

**Checkpoint**: 在浏览器打开 `/playground`，硬编码一个 DeepSeek API Key 临时测试，发送 Prompt 后看到流式渲染 → US-1 验收通过

---

## Phase 4: US-2 — 切换模型并重新发送 (P2 in spec)

**目标**: 顶部模型选择器能切换 6 个供应商，流式中禁用，切换后发送使用新模型

**独立验收**: 从 deepseek-v4-flash 切换到 claude-sonnet-4-6，发送 Prompt，Network 面板请求 body 中 model 字段为 `claude-sonnet-4-6`

### 4.1 输入控件（可并行）

- [x] T013 [PAR] [P0] [US2] 实现 `agenthub/src/components/playground/ModelSelector.tsx`：用 shadcn `<Select>` 渲染 MODEL_LIST，默认值 DEFAULT_MODEL；`isLoading` 为 true 时 disabled；供应商分组（DeepSeek / OpenAI / Anthropic / Google / Alibaba）用 `<SelectGroup>` 标注；onChange 回调更新父组件 selectedModel (~20min) → 依赖: T002
- [x] T014 [PAR] [P0] [US2] 实现 `agenthub/src/components/playground/PromptInput.tsx`：shadcn `<Textarea>` 多行输入，`onKeyDown` 监听 Cmd+Enter（Mac）/ Ctrl+Enter（Win）触发 onSubmit；实时计算 `charCount = value.length`；`charCount > 4000` 时输入框下方显示橙色警告文案"内容可能超出模型上限"，用 `text-[--warning]` CSS token（@theme 要求，禁止裸 Tailwind 色阶如 `text-orange-500`）；"清空"按钮清空输入；isLoading 时 disabled；底部显示字符计数 `{charCount} 字` (~30min) → 依赖: T002

### 4.2 接入页面

- [x] T015 [P0] [US2] 将 ModelSelector + PromptInput 接入 `agenthub/src/app/playground/page.tsx`：ModelSelector onChange 更新 selectedModel state；PromptInput onSubmit 读取 `getApiKeyForModel(selectedModel)` 组装请求头，调用 ResponseArea 的 submit；isLoading 与两个控件的 disabled 状态同步 (~20min) → 依赖: T012, T013, T014

**Checkpoint**: 切换模型后发送 Prompt，Network 请求 body 中 model 字段与选择器一致 → US-2 验收通过

---

## Phase 5: US-4 — 错误状态明确展示（两档容错）(P4 in spec)

**目标**: fatal 类错误显示红色卡片，retryable 类错误显示橙色卡片并倒计时

**独立验收**: 将 ModelSelector 切到 gpt-4o-mini 并输入一个假 Key 发送，响应区出现红色错误卡片，文案"API Key 无效"

### 5.1 倒计时 hook

- [x] T016 [P0] [US4] 实现 `agenthub/src/hooks/useRetryCountdown.ts`：接收 `retryAfterMs: number | undefined`，使用 `setInterval` 每秒倒数，返回 `{ secondsLeft: number; isActive: boolean }`；ms 为 undefined 时返回 `{ secondsLeft: 0, isActive: false }` (~15min) → 依赖: T002

### 5.2 错误卡片

- [x] T017 [P0] [US4] 实现 `agenthub/src/components/playground/ErrorCard.tsx`：接收 `error: PlaygroundError | null`；`tier === 'fatal'` → 红色边框 `border-destructive`，图标 `XCircle`；`tier === 'retryable'` → 橙色边框用 `border-[--warning]`（@theme semantic token；禁止使用 `--chart-1` 图表色），图标 `AlertTriangle`；retryable 且有 `retryAfterMs` 时调用 `useRetryCountdown`，发送按钮文案显示"29s 后可重试"倒计时；error 为 null 时不渲染 (~25min) → 依赖: T016

### 5.3 接入响应区

- [x] T018 [P0] [US4] 更新 `agenthub/src/components/playground/ResponseArea.tsx` 和 `agenthub/src/app/playground/page.tsx`：将 `ErrorCard` 渲染在响应区顶部；流中断检测：`useObject` 的 `onError` 触发时，若 `object` 已有部分内容（即流中断），则构造 `{ tier:'retryable', code:'STREAM_INTERRUPTED', message:'传输中断，以下为部分结果' }` 并以黄色警告条展示，已渲染卡片内容保留不清空；若 `object` 为空（从未收到 token），视为普通 retryable 错误走 ErrorCard；新请求开始时清空 error state (~20min) → 依赖: T011, T017

**Checkpoint**: 各类错误场景均有对应颜色卡片展示，retryable 错误有倒计时 → US-4 验收通过

---

## Phase 6: US-3 — 查看原始结构化 JSON (P3 in spec)

**目标**: 响应完成后用户可复制完整结构化 JSON

**独立验收**: 发送 Prompt 后点击"复制原始 JSON"，粘贴到编辑器，内容是包含 `answer` 字段的合法 JSON

- [x] T019 [PAR] [P1] [US3] 实现 `agenthub/src/components/playground/CopyJsonButton.tsx`：接收 `data: PlaygroundResponse | undefined`；点击后调用 `navigator.clipboard.writeText(JSON.stringify(data, null, 2))`；按钮文案 2s 内变为"已复制"再恢复"复制原始 JSON"；data 为 undefined 时 disabled (~15min) → 依赖: T002
- [x] T020 [P1] [US3] 将 CopyJsonButton 接入 `agenthub/src/app/playground/page.tsx`：渲染在响应区右上角，`data` prop 传入 `useObject` 的 `object` 当前值 (~10min) → 依赖: T012, T019

**Checkpoint**: 复制内容可粘贴并通过 `PlaygroundResponseSchema.safeParse()` 验证 → US-3 验收通过

---

## Phase 7: Polish — 跨切面完善

**目标**: 导航可达、安全加固、sessionStorage 恢复、最终可视化验收

- [x] T021 [P0] 在 `agenthub/src/components/layout.tsx` 的 `navItems` 数组中添加 `{ href: "/playground", label: "Playground" }`，使顶部导航出现 Playground 入口 (~5min) → 依赖: T001
- [x] T022 [P1] 更新 `agenthub/src/app/playground/page.tsx`：将 T012 中 restoreSession() 的返回值注入 response/model/prompt state；若 safeParse 校验失败则静默忽略（防旧 schema 数据污染）(~15min) → 依赖: T012
- [x] T023 [P1] 安全加固 `agenthub/src/app/api/playground/stream/route.ts`：将 `onError` 内的 `console.error` 替换为只打印 `{ model, status, message }` 的精简对象，确保 `X-Provider-Api-Key` 值不出现在任何日志中 (~10min) → 依赖: T002
- [ ] T024 [P2] 对照 spec AC 逐条手工验收：AC-1 模型选择器 6 个选项 / AC-2 Cmd+Enter 提交 / AC-3 流式卡片 / AC-4 四种卡片结构 / AC-5 骨架屏 / AC-6 JSON 复制 / AC-7 Edge Runtime / AC-8 streamObject / AC-9 schema 共用 / AC-10 错误显示 / AC-11 @theme token / AC-12 loading 态 / AC-13 24px 间距，逐条在 spec.md 中标注通过/未通过 (~30min) → 依赖: T021

---

## 依赖关系图

```
T001 (安装依赖)
  └─ T002 (pnpm build 验证)
       ├─ T006 (playground-session.ts)     [PAR]
       ├─ T007 (AnswerCard)                [PAR]
       ├─ T008 (ThinkingCard)              [PAR]
       ├─ T009 (ToolCallCard)              [PAR]
       ├─ T010 (ToolResultCard)            [PAR]
       ├─ T013 (ModelSelector)             [PAR]
       ├─ T014 (PromptInput)               [PAR]
       ├─ T016 (useRetryCountdown)         [PAR]
       └─ T019 (CopyJsonButton)            [PAR]
            │
            ├─ T011 (ResponseArea) ←── T006, T007, T008, T009, T010
            │    └─ T012 (page.tsx)
            │         ├─ T015 (接入 ModelSelector+PromptInput) ←── T013, T014
            │         ├─ T018 (ErrorCard 接入) ←── T017 ←── T016
            │         ├─ T020 (CopyJsonButton 接入) ←── T019
            │         └─ T022 (sessionStorage 恢复)
            │
            └─ T021 (导航链接)

T023 (安全加固) ←── T002（独立可随时做）
T024 (手工验收) ←── T021 (依赖所有功能完成)

[DONE]: T003, T004, T005（无需执行）
```

---

## 并行执行示例

### Phase 1 完成后，以下任务可同时启动（单人顺序执行或多人并行）

```
并行批次 A（卡片组件，互相无依赖）:
  T007 AnswerCard
  T008 ThinkingCard
  T009 ToolCallCard
  T010 ToolResultCard

并行批次 B（其他基础层，互相无依赖）:
  T006 playground-session.ts
  T013 ModelSelector
  T014 PromptInput
  T016 useRetryCountdown
  T019 CopyJsonButton
```

---

## 实施策略

### MVP（最小可演示版本）

完成 **T001 → T002 → T006-T010（并行）→ T011 → T012 → T013 → T014 → T015 → T021**

即：Phase 1 + Phase 2（已完成）+ Phase 3 + Phase 4 主线 + T021 导航链接

**预计时长（单人顺序）**: ~270min（约 4.5 小时）

### 完整版（含错误处理 + JSON 复制）

在 MVP 基础上追加 **T016 → T017 → T018 → T019 → T020**

**追加时长**: ~85min

### 全部任务预估

| Phase | 任务数 | 预估时长 |
|---|---|---|
| Phase 1 Setup | 2 | ~15min |
| Phase 2 Foundation | 3 | 0（已完成） |
| Phase 3 US-1 MVP 核心 | 7 | ~145min |
| Phase 4 US-2 模型切换 | 3 | ~70min |
| Phase 5 US-4 错误处理 | 3 | ~60min |
| Phase 6 US-3 JSON 复制 | 2 | ~25min |
| Phase 7 Polish | 4 | ~60min |
| **合计** | **24（含3已完成）** | **~375min（约 6.25h）** |

---

## Notes

- `[DONE]` 任务跳过，但其输出文件是后续任务的真实输入
- 每个 Checkpoint 是一个自然 commit 节点，完成后可独立演示
- `getApiKeyForModel()` 在 T015 首次使用；Settings 页 API Key 管理由另一 spec 负责，本 feature 直接读 localStorage
- `react-markdown` 引入后检查是否需要 `@tailwindcss/typography` 插件来获得正确 prose 样式
- DeepSeek V4 Pro（推理模型）的 `thinking` 字段测试需单独验证 `<think>` 标签提取逻辑
