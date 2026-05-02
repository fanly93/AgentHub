# Implementation Plan: Agent 商店详情页 Playground 实现

**Branch**: `003-store-agent-playground` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)

## Summary

将 `/agent/[id]` 商店详情页右侧 Playground 面板从 setTimeout 模拟流式替换为真实 AI 调用。实现三类面板：① **General Agent**（复用现有 `ResponseArea`+`ToolPanel`+`useAgentStream`）、② **DeepResearch Agent**（新建专用路由，maxSteps=15，强制 web_search，输出结构化研究报告）、③ **Simple Agent**（扩展现有 `/api/playground/stream`，按品类注入系统提示词）。`mock-data.ts` 新增 `agentType` 字段区分三类。

---

## Technical Context

| 项 | 值 |
|---|---|
| 语言 / 版本 | TypeScript 5，strict 模式 |
| 主要依赖 | Next.js **16.2.4** App Router、Vercel AI SDK、shadcn/ui、Tailwind CSS、Zod |
| ⚠️ 破坏性变更 | Next.js 16 中 client component 的 `params` 已变为 `Promise<{id:string}>`，需用 `React.use(params)` 解包；不可同步访问 `params.id` |
| 存储 | sessionStorage（复用现有 `playground-session.ts`，无新增存储层） |
| 目标平台 | 桌面浏览器 ≥ 1024px |
| 项目类型 | Next.js Web 应用（App Router，`src/app/`） |
| 性能目标 | 首个流式 token < 3s（P95，正常网络）；SC-001 |
| 约束 | Edge Runtime 硬上限 60s；DeepResearch 15 步 × P95 3s/步 ≈ 45s，在限制内 |
| 规模 | 24 个 Agent 详情页；2 个真实 Agent；22 个 Simple Agent |

---

## Constitution Check

*GATE：Phase 0 研究前必须通过。Phase 1 设计完成后再次确认。*

| 宪法条款 | 状态 | 说明 |
|---------|------|------|
| Next.js App Router | ✅ PASS | 所有新路由在 `src/app/api/` 下 |
| Vercel AI SDK（唯一 AI 调用层） | ✅ PASS | DeepResearch 路由使用 `streamText({ tools })` |
| Edge Runtime（AI 调用） | ✅ PASS | `/api/deepresearch/stream` 声明 `export const runtime = 'edge'` |
| 无服务端数据库 | ✅ PASS | 对话结果存 sessionStorage，无 DB |
| TypeScript strict 模式 | ✅ PASS | 延续已有项目约束 |
| @theme token，无 hardcoded hex | ✅ PASS | 所有新组件使用语义变量 |
| 骨架屏优先 | ✅ PASS | 流式等待期间展示 loading dots / Skeleton |
| 流式输出（NON-NEGOTIABLE） | ✅ PASS | 三类面板均为流式渲染，无批式加载 |
| 错误中文可读 | ✅ PASS | 分层 ErrorCard，5 类错误各有中文说明 |
| lucide-react 图标 | ✅ PASS | 复用现有图标，无新增图标库 |
| 禁止引入其他 UI 库 | ✅ PASS | 仅使用现有 shadcn/ui 组件 |
| 禁止自由聊天（无结构 schema） | ✅ PASS | Simple Agent 复用 PlaygroundResponse schema（含 answer 字段）；DeepResearch 强制四章节结构 |

### 复杂度跟踪（无新违规）

本期无需新增宪法例外条款。现有已记录的 `write_file` Node.js Runtime 例外（来自 002 期）继续有效，本期不涉及。

---

## Project Structure

### 规格文档（本功能）

```text
specs/003-store-agent-playground/
├── spec.md                          # 功能规格
├── plan.md                          # 本文件
├── research.md                      # Phase 0 研究决策
├── data-model.md                    # 实体定义
├── contracts/
│   ├── playground-stream-extended.md # /api/playground/stream 扩展合约
│   └── deepresearch-stream-api.md    # /api/deepresearch/stream 新接口合约
├── checklists/requirements.md        # 质量检查清单
└── tasks.md                          # 由 /speckit-tasks 生成
```

### 源码（新增 / 修改文件）

```text
agenthub/src/
├── app/
│   ├── agent/[id]/
│   │   └── page.tsx                  [修改] 条件渲染三种面板；移除 setTimeout 模拟
│   └── api/
│       ├── playground/stream/
│       │   └── route.ts              [修改] 新增可选 agentSystemPrompt 字段
│       └── deepresearch/stream/
│           └── route.ts              [新增] Edge Runtime，DeepResearch 专用路由
├── components/
│   └── agent-detail/
│       ├── GeneralAgentPanel.tsx     [新增] 包装现有 ResponseArea+ModelSelector+ToolPanel
│       ├── DeepResearchPanel.tsx     [新增] 研究专属 UI，复用 useAgentStream
│       └── SimpleAgentPanel.tsx      [新增] 单轮对话面板，复用 useStructuredStream
└── lib/
    └── mock-data.ts                  [修改] 新增 agentType/defaultModel 字段；新增 CATEGORY_PROMPTS
```

**实际修改的文件（实现阶段更新）**：

| 文件 | 修改内容 |
|------|---------|
| `src/hooks/useAgentStream.ts` | 提取 `route` 为 hook 构造参数（`useAgentStream(route?)`），默认 `/api/agent/stream`，向后兼容 |
| `src/components/playground/cards/AnswerCard.tsx` | 新增 `remark-gfm` 插件支持 GFM 表格；添加 `overflow-x-auto` + `break-words` 防溢出 |
| `src/components/playground/cards/ToolResultCard.tsx` | agent 模式 `pre` 改 `whitespace-pre-wrap break-words` 防横向溢出 |
| `src/app/page.tsx` | "打开 Playground" 链接从 `/agent/agent-1` 改为 `/agent/agent-general` |

**完全不变的文件（向后兼容保障）**：

| 文件 | 保持不变原因 |
|------|------------|
| `src/hooks/useStructuredStream.ts` | 泛型设计，SimpleAgentPanel 透传 agentSystemPrompt 字段无需改动 |
| `src/app/api/agent/stream/route.ts` | General Agent 直接调用，零修改 |
| `src/components/playground/ResponseArea.tsx` | GeneralAgentPanel 内嵌使用，接口不变 |
| `src/components/playground/ToolPanel.tsx` | GeneralAgentPanel 内嵌使用 |
| `src/components/playground/ModelSelector.tsx` | 三种面板均复用 |
| `src/lib/playground-session.ts` | 三种面板均复用，接口不变 |
| `src/shared/schemas/playgroundResponse.ts` | 现有 schema，不变 |
| `src/shared/schemas/agentStream.ts` | DeepResearch 复用相同事件类型，不变 |

---

## Data Flow

### Simple Agent（普通 Agent 详情页）

```
用户进入 /agent/[id]（agentType='simple'）
  → page.tsx 渲染 <SimpleAgentPanel agent={agent} />
  → 用户输入 prompt，点击发送
  → useStructuredStream.submit(
      { model, prompt, agentSystemPrompt: CATEGORY_PROMPTS[agent.category] },
      { "X-Provider-Api-Key": apiKey }
    )
  → POST /api/playground/stream（扩展版）
    → Zod 解析（含可选 agentSystemPrompt）
    → systemPrompt = agentSystemPrompt + "\n\n" + SYSTEM_PROMPT
    → streamText({ model, system: systemPrompt, messages: [{role:'user', content: prompt}] })
    → toTextStreamResponse()
  → useStructuredStream: parsePartialJson → PlaygroundResponse
  → SimpleAgentPanel 仅渲染 response.answer（Markdown）
  → onFinish → saveSession(response, model, prompt)
```

### General Agent（通用 Agent 详情页）

```
用户进入 /agent/[id]（agentType='general'）
  → page.tsx 渲染 <GeneralAgentPanel agent={agent} />
  → GeneralAgentPanel 内部组合：
      <ModelSelector /> + <ToolPanel /> + <ResponseArea ref={responseRef} />
  → 用户选择工具、输入 prompt、点击发送
  → responseRef.current.submit(prompt, model, apiKey, selectedTools)
  → ResponseArea（现有逻辑完全不变）：
      有工具 → useAgentStream → POST /api/agent/stream（不变）
      无工具 → useStructuredStream → POST /api/playground/stream（不变）
  → 卡片式实时渲染（ThinkingCard/ToolCallCard/ToolResultCard/AnswerCard）
  → onAgentFinish → saveAgentSession(state)
```

### DeepResearch Agent（深度研究详情页）

```
用户进入 /agent/[id]（agentType='deepresearch'）
  → page.tsx 渲染 <DeepResearchPanel agent={agent} />
  → 用户输入研究主题，点击发送
  → useAgentStream.submit(
      { model, prompt },
      route: '/api/deepresearch/stream',
      headers: { "X-Provider-Api-Key": apiKey }
    )
  → POST /api/deepresearch/stream（新建）
    → Zod 解析（model, prompt）
    → streamText({
        model,
        system: DEEPRESEARCH_SYSTEM_PROMPT,   // 三阶段研究提示词
        tools: { web_search },                 // 唯一工具，硬编码
        maxSteps: 15,
        messages: [{role:'user', content: prompt}]
      })
    → fullStream 事件 → NDJSON 逐行输出（同 /api/agent/stream 协议）
  → useAgentStream（复用现有 hook）：
      NDJSON 按行解析 → dispatch → agentStreamReducer → state 更新
  → DeepResearchPanel 渲染：
      ThinkingCard（规划阶段）
      ToolCallCard × N（搜索查询卡片，标注"深度搜索"）
      ToolResultCard × N（来源卡片）
      AnswerCard（结构化研究报告，Markdown 含四章节）
  → onFinish → saveAgentSession({ thinking, toolCalls, toolResults, answer, usage, model })
```

---

## Schema 设计

### 1. 扩展后的 `/api/playground/stream` RequestSchema

```typescript
const RequestSchema = z.object({
  model: ModelIdSchema,
  prompt: z.string().min(1).max(50000),
  agentSystemPrompt: z.string().max(2000).optional(),   // 新增
});
```

### 2. DeepResearch RequestSchema（新建）

```typescript
// src/shared/schemas/deepresearch.ts
export const DeepResearchRequestSchema = z.object({
  model: ModelIdSchema,
  prompt: z.string().min(1).max(50000),
});
```

响应类型：复用 `AgentStreamEvent`（`src/shared/schemas/agentStream.ts`）

### 3. 扩展后的 Agent 类型

```typescript
// src/lib/mock-data.ts
export type AgentType = 'general' | 'deepresearch' | 'simple';

export type Agent = {
  // ... 现有字段不变 ...
  agentType: AgentType;       // 新增，必填
  defaultModel?: ModelId;     // 新增，可选
};
```

---

## API 边界

| 路由 | 方法 | 输入 | 输出 | 变更类型 |
|------|------|------|------|---------|
| `/api/playground/stream` | POST | `{ model, prompt, agentSystemPrompt? }` | text/plain JSON 流 | **向后兼容扩展** |
| `/api/agent/stream` | POST | `{ model, prompt, tools[] }` | NDJSON | **不变** |
| `/api/deepresearch/stream` | POST | `{ model, prompt }` | NDJSON（同 agent/stream）| **新增** |
| `/api/tools/write-file` | POST | `{ filename, content }` | JSON | **不变** |

---

## 技术决策

### TD-001：Simple Agent 复用 `/api/playground/stream`，扩展 `agentSystemPrompt`

**选择**：在现有 RequestSchema 新增可选 `agentSystemPrompt` 字段，服务端拼接至 SYSTEM_PROMPT 前。

**理由**：`useStructuredStream` 的泛型设计天然透传额外字段；Simple Agent 与 Playground 无工具模式逻辑完全一致，无需新建路由；`agentSystemPrompt` 可选设计确保现有调用零影响。

**备选被拒**：新建 `/api/simple/stream` — 功能重复，维护双份基本相同的路由。

---

### TD-002：DeepResearch 独立路由，复用 NDJSON 协议

**选择**：`/api/deepresearch/stream` 独立路由，`web_search` 硬编码，`maxSteps: 15`，研究专属系统提示词。响应格式与 `/api/agent/stream` 完全一致（NDJSON）。

**理由**：前端直接复用 `useAgentStream` hook，零新增代码；DeepResearch 的 15 步与工具固定是不应暴露给用户的产品决策；独立路由保持职责单一，不与通用 Agent 产生耦合。

**备选被拒**：在 `/api/agent/stream` 加 `agentType` 参数分支 — 路由内部 if/else 增加复杂度；maxSteps=15 可能影响其他 Agent 的超时行为。

---

### TD-003：General Agent 面板直接组合现有组件

**选择**：`GeneralAgentPanel` 内部直接 `import ResponseArea, ToolPanel, ModelSelector from '@/components/playground'`，不新增 hook 或逻辑。

**理由**：现有组件已经过完整测试；`ResponseArea` 通过 `useImperativeHandle` ref 暴露 `submit/stop` 接口；宪法"三处相似才抽象"原则——此组合只在详情页出现一次。

---

### TD-004：DeepResearchPanel 复用 `useAgentStream`，自定义路由端点

**选择**：`useAgentStream` 内部的 fetch URL 通过参数传入（或 DeepResearchPanel 内部直接 fetch `/api/deepresearch/stream`），状态管理复用 hook 的 `agentStreamReducer`。

**理由**：相同 NDJSON 协议意味着 reducer 逻辑 100% 复用；DeepResearch UI 与 General Agent 的卡片渲染相同，只是没有工具选择面板。

**实现细节**：若 `useAgentStream` 当前硬编码了 URL，需将其改为可配置参数（默认 `/api/agent/stream`）；DeepResearchPanel 传入 `/api/deepresearch/stream`。

---

### TD-005：CategoryPrompt 静态映射，不存入 Agent 实体

**选择**：`CATEGORY_PROMPTS: Record<string, string>` 在 `mock-data.ts` 中定义，运行时按 `agent.category` 查找；Agent 实体不存储 prompt 字段。

**理由**：同品类下所有 Agent 角色定位相同；后续若数据 API 化，category 字段必然保留，映射仍然有效；避免 25 个 Agent 手写重复提示词。

---

### TD-006：流式期间控件禁用统一由面板层管理

**选择**：三种面板组件各自管理 `isLoading` 状态，在 `isLoading=true` 时对模型选择器、工具面板、发送按钮统一应用 `disabled` prop。

**理由**：FR-015 要求流式期间所有控件禁用；各面板本身持有 `isLoading`（来自 hook），无需跨组件通信；shadcn/ui 组件的 `disabled` prop 天然处理视觉态。

---

### TD-007：字符预警复用现有 `CHAR_WARN` 常量

**选择**：`SimpleAgentPanel` 和 `GeneralAgentPanel`（detail 版本）复用 playground 页面已定义的 `CHAR_WARN = 4000` 常量（若已提取为常量）或直接使用相同阈值。

**理由**：FR-016 要求超过 4000 字显示预警；与独立 Playground 行为保持一致，避免用户困惑。

---

## 风险评估

### R-001：DeepResearch 15 步接近 Edge Runtime 60s 上限（中）

**场景**：15 步 × 单步 web_search P95 3s = 45s，理论上可行，但若网络异常导致部分请求接近 10s 超时，累计时间可能超出 60s。

**缓解**：
- 单次 web_search 超时设为 8s（而非 10s），为 AI 计算留出余量
- 若发生 Edge Timeout，返回 `{ type: "error", code: "STREAM_INTERRUPTED" }` 而非静默失败
- 监控实际执行时间，若 P95 超过 50s 则将 maxSteps 降至 10（spec 变更）

**残余风险**：低。

---

### R-002：DeepResearch 系统提示词质量（中）

**场景**：模型未严格遵循四章节结构，最终报告格式不符合 FR-007 要求。

**缓解**：
- 系统提示词中明确标注章节标题模板（`## 执行摘要`等）
- `answer` 字段用 Markdown 渲染，结构由模型输出决定；AnswerCard 不做强制解析
- 若章节缺失，用户仍能看到报告内容，只是可能缺少某些标题（可接受降级）

**残余风险**：低。

---

### R-003：`useAgentStream` URL 硬编码（低）

**场景**：若 `useAgentStream` 当前内部硬编码 `/api/agent/stream`，DeepResearchPanel 无法直接复用。

**缓解**：
- 开发前先检查 `useAgentStream` 的 fetch URL 是否可配置
- 若硬编码，只需将 URL 提取为参数（默认值保持现有，向后兼容）
- 变更量极小：仅修改 hook 函数签名和一处 fetch 调用

**残余风险**：极低。

---

### R-004：General Agent 面板在详情页布局与 Playground 页面不一致（低）

**场景**：详情页右侧面板宽度约 60% 屏幕宽，而独立 Playground 是全宽布局；某些响应式样式可能出现溢出或截断。

**缓解**：
- `GeneralAgentPanel` 使用 `w-full` / `min-w-0` 确保在父容器内自适应
- 工具面板在详情页可能需要紧凑布局（3 列 vs Playground 的 5 列）
- 开发完成后在 1024px、1280px、1440px 三个断点分别目测验证

**残余风险**：低。

---

### R-005：agentType 未设置导致渲染降级（低）

**场景**：若 mock-data 中某个 Agent 缺少 `agentType` 字段，详情页无法确定渲染哪种面板。

**缓解**：
- TypeScript strict 模式下 `agentType` 为必填字段（非 optional），编译期报错
- `page.tsx` 中加防御性 fallback：`agent.agentType ?? 'simple'`

**残余风险**：极低。

---

## 验证方案

### 功能验证

1. **Simple Agent**：进入任一普通 Agent 详情页，输入问题，确认：
   - 输出区流式渲染真实 AI 响应（非固定文本）
   - 输出符合该 Agent 品类角色（如代码生成品类输出代码块）
   - 字符超 4000 时出现橙色预警
   - 发送中模型选择器禁用

2. **General Agent**：进入「通用智能助手」详情页，勾选 `web_search` 工具，询问实时问题，确认：
   - ThinkingCard → ToolCallCard → ToolResultCard → AnswerCard 依次渲染
   - 停止按钮可终止流式
   - 刷新后输出区清空（sessionStorage 验证）

3. **DeepResearch Agent**：进入「深度研究助手」详情页，输入研究主题，确认：
   - 无工具勾选面板（web_search 自动开启）
   - 至少出现 5 个 ToolCallCard（web_search 调用）
   - AnswerCard 包含「执行摘要」「主要发现」「来源与参考」「结论与建议」

4. **错误处理**：使用无效 API Key，确认：
   - 出现红色 ErrorCard，展示中文说明
   - 发送按钮未禁用（下次可重试）

5. **向后兼容**：访问 `/playground` 独立页面，确认现有功能 100% 正常（工具调用、模型切换、JSON 复制等）。

### 性能验证

- SC-001：Simple Agent 首 token < 3s（5 次测试取 P95）
- DeepResearch 完整执行不超过 60s（Edge Timeout 不触发）
