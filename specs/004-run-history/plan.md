# Implementation Plan: 运行记录页（Run History）

**Branch**: `004-run-history` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)

## Summary

为 AgentHub 新增持久化运行历史功能：所有 AI 调用（5 类入口）完成后，客户端自动将 Run + Spans 写入浏览器 IndexedDB（Dexie.js）。`/runs` 页面从 IndexedDB 读取数据，展示时间倒序列表（cursor 分页、三维筛选）+ 右侧 Trace 瀑布图（SVG）。全程纯客户端实现，不引入任何服务端数据库，符合宪法持久化约束。

---

## Technical Context

**Language/Version**: TypeScript 5, strict 模式  
**Primary Dependencies**: Next.js 15 App Router, Dexie.js v4, Vercel AI SDK v6, shadcn/ui, Tailwind CSS 4  
**Storage**: 浏览器 IndexedDB via Dexie.js（数据库名：`run-history`）  
**Testing**: 手动端到端验收（5 类调用入口各验一次）  
**Target Platform**: 桌面浏览器 ≥ 1024px（宪法约束）  
**Project Type**: Next.js Web 应用（App Router）  
**Performance Goals**: 运行记录写入 < 200ms；列表加载 < 300ms；筛选响应 < 500ms  
**Constraints**: 无服务端 DB；IndexedDB 唯一持久化层；所有 AI 路由保持 Edge Runtime 不变  
**Scale/Scope**: 单设备本地存储；千条记录以内的筛选/分页

---

## Constitution Check

| 原则 | 状态 | 说明 |
|------|------|------|
| 持久化：IndexedDB/localStorage only | ✅ 通过 | 使用 Dexie.js IndexedDB，无服务端 DB |
| 新增依赖：Dexie.js v4 | ✅ 通过 | Dexie.js = IndexedDB 封装库，符合宪法持久化原则；非服务端数据库 |
| 禁止引入服务端数据库（Drizzle/Prisma 等） | ✅ 通过 | 无 Drizzle，无 SQLite 服务端方案 |
| Vercel AI SDK 唯一 AI 调用层 | ✅ 通过 | 不涉及新 AI 调用，仅录制现有流 |
| Edge Runtime 保持不变 | ✅ 通过 | 所有 API 路由原封不动 |
| 骨架屏优先 | ✅ 通过 | runs 页加载期间展示 Skeleton |
| 禁止引入其他 UI 组件库 | ✅ 通过 | 仅用 shadcn/ui + lucide-react |
| 间距 4px 阶梯 | ✅ 通过 | 缩进 24px = 6 × 4px，所有间距走 token |
| 颜色用 @theme 变量 | ✅ 通过 | 耗时色阶用 --color-success/warning/destructive |
| 禁止用户认证/鉴权 | ✅ 通过 | 无用户系统，本地共享 |

> ⚠️ **已修正违规**：需求梳理阶段曾提出 `better-sqlite3 + Drizzle + /api/runs（Node runtime）`，此方案违反宪法 Section III 持久化原则和红线"引入服务端数据库"。已于 Phase 0 研究阶段修正为 IndexedDB。

---

## Project Structure

### Documentation（本功能）

```text
specs/004-run-history/
├── plan.md              ← 本文件
├── research.md          ← Phase 0 研究产物
├── data-model.md        ← Phase 1 数据模型
├── contracts/
│   └── run-history-api.md  ← Phase 1 接口契约
└── tasks.md             ← Phase 2（/speckit-tasks 生成）
```

### Source Code（关键路径）

```text
agenthub/src/
├── lib/
│   └── run-history/
│       ├── db.ts          # Dexie 数据库实例（新建）
│       ├── types.ts       # Run / Span TypeScript 接口（新建）
│       └── recorder.ts    # saveRun / listRuns / deleteRun 等函数（新建）
│
├── hooks/
│   ├── useRunRecorder.ts  # 录入 hook，包装流完成回调（新建）
│   ├── useRunHistory.ts   # 读取 hook，分页+筛选（新建）
│   ├── useAgentStream.ts  # ✏️ 新增 SpanTimestamps 接口 + 事件级时间戳采集（AgentExecutionState.spanTimestamps）
│   └── useStructuredStream.ts  # ✏️ 无改动
│
├── components/
│   ├── playground/
│   │   └── PromptInput.tsx  # ✏️ 新增 isLoading/onStop props，支持发送/停止按钮切换
│   ├── runs/
│   │   ├── RunList.tsx         # 左侧列表（新建）
│   │   ├── RunListItem.tsx     # 单条记录行（新建）
│   │   ├── RunDetail.tsx       # 右侧详情面板（新建）
│   │   ├── TraceWaterfall.tsx  # SVG 瀑布图（新建）
│   │   ├── SpanRow.tsx         # 单条 span 行（可展开）（新建）
│   │   └── FilterBar.tsx       # 筛选栏（新建）
│   │
│   └── agent-detail/
│       ├── GeneralAgentPanel.tsx   # ✏️ 集成 useRunRecorder；PromptInput 传入 onStop
│       ├── DeepResearchPanel.tsx   # ✏️ 集成 useRunRecorder；onFinish 使用 finishedState 参数（非闭包 state）
│       └── SimpleAgentPanel.tsx    # ✏️ 集成 useRunRecorder
│
└── app/
    ├── playground/page.tsx  # ✏️ 集成 useRunRecorder；PromptInput 传入 onStop/isLoading
    └── runs/page.tsx        # ✏️ 替换 mock 数据，使用 useRunHistory
```

---

## Complexity Tracking

无宪法违规需要在此记录。初始违规已在 Phase 0 修正。

---

## 实现策略

### 数据录入（写路径）

```
用户触发 Agent 调用
  ↓
Panel / Playground 页面调用 recorder.startRun(model, prompt)
  ↓
流式事件逐条到达 → 客户端打 Date.now() 时间戳，积累 spans 数组
  ↓
流结束（onFinish 回调触发）
  ↓
recorder.finishRun(state, status) → saveRun(run, spans) → Dexie IndexedDB
  ↓
静默失败（不影响主流程）或成功写入
```

**时间戳计算规则**：
- `runStart`：`submit()` 调用时记录
- 每个 span 的 `startedAt`：收到对应 NDJSON 事件时的 `Date.now()`
- `tool-call` span 的 `durationMs`：`toolResultAt[callId] - toolCallAt[callId]`（工具实际执行耗时）
- `tool-result` span 的 `durationMs`：下一个 `toolCallAt` 或 `answerStartAt` - `toolResultAt`（LLM 处理间隔）
- `thinking` span 的 `durationMs`：首个 `toolCallAt`（或 `answerStartAt`）- `thinkingStartAt`
- `answer` span 的 `durationMs`：`doneAt` - `answerStartAt`
- Run 的 `durationMs`：`doneAt` - `runStart`

**SpanTimestamps 接口**（存于 `AgentExecutionState.spanTimestamps`，由 `useAgentStream` 在事件循环中采集）：

```typescript
interface SpanTimestamps {
  thinkingStartAt: number | null;   // 首个 thinking-delta 到达时刻
  answerStartAt: number | null;     // 首个 answer-delta 到达时刻
  toolCallAt: Record<string, number>;    // callId → tool-call 事件到达时刻
  toolResultAt: Record<string, number>;  // callId → tool-result 事件到达时刻
}
```

`finishedState.spanTimestamps` 通过 `onFinish(finishedState)` 回调传递给 `useRunRecorder`，**调用方必须使用回调参数 `finishedState`，而非闭包中的 React state**（后者在回调触发时仍为空）。

**span 类型映射**（from NDJSON event type）：

| NDJSON event | Span 类型 | 特殊处理 |
|---|---|---|
| `thinking-delta`（累积完成） | `thinking` | 多个 delta 合并为 1 个 span |
| `tool-call` | `tool-call` | input = JSON.stringify(arguments) |
| `tool-result` | `tool-result` | output = JSON.stringify(result)；error 字段单独存 |
| `answer-delta`（累积完成） | `answer` | 多个 delta 合并为 1 个 span |

**Playground 无工具模式**（useStructuredStream）：
- 只产生 1 个 span（answer），`round: 0`
- `input` = prompt，`output` = answer 文本（截断至 10k）

### 数据读取（读路径）

```
用户导航到 /runs
  ↓
useRunHistory() 调用 listRuns({ limit: 50 })
  ↓
Dexie: db.runs.orderBy('id').reverse().limit(50).toArray()
  ↓
渲染 RunList（Skeleton → 真实列表）
  ↓
用户点击某条 Run
  ↓
getSpans(run.id) → 渲染 TraceWaterfall + Tab 面板
```

### 瀑布图渲染（TraceWaterfall）

```
输入：spans[]，run.durationMs
计算：
  totalMs = run.durationMs（横轴 = 100% 宽度）
  xPct(ms) = (ms / totalMs) * 100
  每条 bar：
    x = xPct(span.startedAt - runStart)%（工具类 span 额外加 depth * 2% 左缩进）
    width = xPct(span.durationMs)%
    y = spanIndex * (BAR_HEIGHT + GAP)（depth 仅影响 x 偏移，不影响 y）
颜色：
  spanType 颜色（4 种）× 耗时色阶（3 级）= 复合样式
  耗时 < 200ms → --color-success
  耗时 200-1000ms → --color-warning
  耗时 > 1000ms → --color-destructive
输出：SVG 元素数组（React JSX）
```

### 删除操作

- 单条删除：确认 Dialog（shadcn AlertDialog）→ `deleteRun(id)` → 列表刷新
- 清空全部：确认 Dialog → `clearAllRuns()` → 列表清空，进入空状态

---

## 关键文件变更清单

| 文件路径 | 操作 | 说明 |
|---|---|---|
| `src/lib/run-history/db.ts` | 新建 | Dexie 数据库实例 |
| `src/lib/run-history/types.ts` | 新建 | Run / Span TypeScript 接口 |
| `src/lib/run-history/recorder.ts` | 新建 | CRUD 函数（saveRun, listRuns, getRun, getSpans, deleteRun, clearAllRuns, getDistinctModels） |
| `src/hooks/useRunRecorder.ts` | 新建 | 录入 hook（startRun, finishAgentRun, finishStructuredRun） |
| `src/hooks/useRunHistory.ts` | 新建 | 读取 hook（分页、筛选、loadMore） |
| `src/components/runs/RunList.tsx` | 新建 | 左侧列表 + Skeleton |
| `src/components/runs/RunListItem.tsx` | 新建 | 单行记录 |
| `src/components/runs/RunDetail.tsx` | 新建 | 右侧详情：瀑布图 + Tab |
| `src/components/runs/TraceWaterfall.tsx` | 新建 | SVG 瀑布图 |
| `src/components/runs/SpanRow.tsx` | 新建 | 可展开 span 行 |
| `src/components/runs/FilterBar.tsx` | 新建 | 三维筛选（shadcn Select） |
| `src/app/runs/page.tsx` | 修改 | 替换 mock，集成 useRunHistory |
| `src/app/playground/page.tsx` | 修改 | 集成 useRunRecorder；PromptInput 传入 onStop/isLoading |
| `src/components/playground/PromptInput.tsx` | 修改 | 新增 isLoading/onStop props，支持发送/停止按钮切换 |
| `src/components/playground/ResponseArea.tsx` | 修改 | 新增 onAgentStop/onStructuredStop 回调，供 recorder 中断写入 |
| `src/hooks/useAgentStream.ts` | 修改 | 新增 SpanTimestamps 接口 + 事件级时间戳采集（AgentExecutionState.spanTimestamps） |
| `src/components/agent-detail/GeneralAgentPanel.tsx` | 修改 | 集成 useRunRecorder；PromptInput 传入 onStop/isLoading |
| `src/components/agent-detail/DeepResearchPanel.tsx` | 修改 | 集成 useRunRecorder；onFinish 使用 finishedState 参数（非闭包 state） |
| `src/components/agent-detail/SimpleAgentPanel.tsx` | 修改 | 集成 useRunRecorder |

**不需要修改的文件**：
- `src/hooks/useStructuredStream.ts`（外挂 recorder，不改内部）
- 所有 `src/app/api/` 路由文件（保持 Edge Runtime 不变）

---

## 依赖新增

```json
{
  "dexie": "^4.0.0"
}
```

仅需 1 个新依赖，无其他引入。

---

## 验收验证

按 spec 中 SC-001 至 SC-005 逐条验收：

1. **SC-001**：Playground 发一次对话，流完成后切换到 /runs，3 秒内列表顶部出现新记录
2. **SC-002**：5 类入口各运行一次（Playground 无工具、有工具、通用 Agent、DeepResearch、Simple Agent），均可在 /runs 看到对应记录
3. **SC-003**：DeepResearch 搜索 15 轮，/runs 中瀑布图完整显示所有 span，无截断
4. **SC-004**：数据库有 100+ 条记录时，筛选操作 < 500ms 响应
5. **SC-005**：删除单条记录：1 次触发 + 1 次确认弹窗，共 2 次点击完成
