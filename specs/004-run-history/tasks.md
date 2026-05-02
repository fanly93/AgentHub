# Tasks: 运行记录页（Run History）

**Input**: `specs/004-run-history/`（spec.md + plan.md + data-model.md + contracts/）  
**Branch**: `004-run-history`  
**Total tasks**: 30  

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可并行执行（不同文件，无未完成依赖）
- **[Story]**: 对应 spec.md 中的 User Story（US1–US4）
- 所有路径相对于 `agenthub/` 目录

---

## Phase 1: Setup（共享基础设施）

**目的**：安装依赖，创建数据层基础文件

- [x] T001 在 `agenthub/package.json` 中添加 `dexie@^4.0.0` 依赖，执行 `pnpm install`
- [x] T002 创建 `src/lib/run-history/types.ts`，定义 `Run`、`Span`、`RunStatus`、`SpanType` TypeScript 接口（参考 data-model.md 中的完整字段定义）
- [x] T003 创建 `src/lib/run-history/db.ts`，初始化 Dexie 数据库实例（数据库名 `run-history`，版本 1），声明 runs 和 spans 两张表及其索引（参考 data-model.md Dexie 初始化代码结构）

---

## Phase 2: Foundational（阻塞性前置）

**目的**：数据 CRUD 函数 + React Hooks — 所有 User Story 均依赖此阶段

**⚠️ CRITICAL**：此阶段完成前，任何 User Story 均不可开始

- [x] T004 创建 `src/lib/run-history/recorder.ts`，实现以下函数（参考 contracts/run-history-api.md）：
  - `saveRun(run, spans)`: 事务写入 Run + Spans；自动截断 input/output 超 10,000 字符的字段并附加 "…内容已截断"；自动生成 promptSummary（prompt 前 60 字）
  - `listRuns(options?)`: cursor-based 分页，orderBy id 降序，支持 status/model/timeRange 筛选
  - `getRun(id)`: 按 id 读取单条 Run
  - `getSpans(runId)`: 读取某 Run 的所有 Span，按 order 升序
  - `deleteRun(id)`: 事务删除 Run 及其所有 Span
  - `clearAllRuns()`: 事务清空所有 Run 和 Span
  - `getDistinctModels()`: 查询 runs 表中所有不重复的 model 值，返回 `string[]`，供 FilterBar 模型下拉动态填充
- [x] T005 创建 `src/hooks/useRunRecorder.ts`，实现 `useRunRecorder(source, agentId?)` hook，暴露四个函数：
  - `startRun(model, prompt)`: 记录 runStart 时间戳，初始化 spans 收集数组
  - `finishAgentRun(state: AgentExecutionState, status)`: 从 AgentExecutionState 构建 Span 数组（thinking/tool-call/tool-result/answer），计算各 span 耗时（client-side Date.now() 差值），调用 saveRun；失败时静默处理
  - `finishStructuredRun(object, status)`: 从 Playground 无工具响应构建单条 answer Span，调用 saveRun；失败时静默处理
  - `interruptAgentRun(state: AgentExecutionState)`: 用户主动停止 agent 流时调用，以当前已收到的 spans 和 status="interrupted" 调用 saveRun；失败时静默处理；**注意**：useAgentStream.stop() 会 abort 流并跳过 onFinish，因此中断场景必须通过此函数而非 finishAgentRun 触发写入
  - `interruptStructuredRun(object)`: 用户主动停止无工具流时调用，逻辑同上
- [x] T006 [P] 创建 `src/hooks/useRunHistory.ts`，实现 `useRunHistory(options?)` hook，暴露：
  - `runs: Run[]`、`isLoading: boolean`、`hasMore: boolean`
  - `loadMore()`: 追加下一页（cursor 取最后一条 id）
  - `refresh()`: 重置 cursor，重新从头加载

**Checkpoint**：数据层完整，可开始 User Story 并行实现

---

## Phase 3: User Story 1 — 查看运行历史列表（Priority: P1）🎯 MVP

**目标**：任意 AI 调用完成后，运行记录自动出现在 /runs 列表顶部

**独立测试**：在 Playground 发起一次对话，流结束后进入 /runs，验证列表顶部出现来源标识为"Playground"的记录，包含状态图标、prompt 摘要、耗时和 token 总数

- [x] T007 [US1] 修改 `src/app/playground/page.tsx`：引入 `useRunRecorder("Playground")`，在 submit 前调用 `startRun`；在 `useStructuredStream.onFinish` 中调用 `finishStructuredRun`；在 `useAgentStream` 的 `onFinish` 中调用 `finishAgentRun`；在停止按钮 handler 中先调用 `interruptAgentRun(state)` / `interruptStructuredRun(obj)` 再调用 `stop()`（stop 会 abort 流并跳过 onFinish，中断写入必须在 stop 之前完成）
- [x] T008 [P] [US1] 修改 `src/components/agent-detail/GeneralAgentPanel.tsx`：引入 `useRunRecorder(agentName, agentId)`，在 submit 前调用 `startRun`；在 `onFinish` 中调用 `finishAgentRun`；在停止按钮 handler 中先调用 `interruptAgentRun(state)` 再调用 `stop()`
- [x] T009 [P] [US1] 修改 `src/components/agent-detail/DeepResearchPanel.tsx`：引入 `useRunRecorder(agentName, agentId)`，在 submit 前调用 `startRun`；在 `onFinish(finishedState)` 中使用回调参数 `finishedState`（而非闭包 state，闭包此时为空）调用 `finishAgentRun(finishedState, ...)`；在停止按钮 handler 中先调用 `interruptAgentRun(state)` 再调用 `stop()`
- [x] T010 [P] [US1] 修改 `src/components/agent-detail/SimpleAgentPanel.tsx`：引入 `useRunRecorder(agentName, agentId)`，在 submit 前调用 `startRun`；在 `onFinish` 中调用 `finishStructuredRun`；若该 panel 有停止功能则先调用 `interruptStructuredRun(obj)` 再调用 `stop()`
- [x] T011 [US1] 创建 `src/components/runs/RunListItem.tsx`：单条记录行，展示状态图标（CheckCircle2/XCircle/Loader2，分别对应 success/failed/interrupted）、来源标识、prompt 摘要（前 60 字截断）、总耗时、token 总数；选中时高亮（`bg-accent/60`）；实现完整 5 态（default/hover/active/focus/disabled）
- [x] T012 [US1] 创建 `src/components/runs/RunList.tsx`：左侧列表容器，加载时展示 Skeleton 占位符（宪法骨架屏优先原则）；列表渲染 RunListItem；滚动到底部自动触发 `loadMore()`；空状态显示"空空如也，先去 Playground 聊一次吧"并提供跳转按钮
- [x] T013 [US1] 重写 `src/app/runs/page.tsx`：移除 mock-data 导入，改为 `"use client"` 组件，引入 `useRunHistory`，左栏渲染 `RunList`，右栏暂时展示选中 Run 的基本信息（agent 名、状态、耗时、模型名称）；选中 Run 时 URL 不变（client state 维护 selectedId）

---

## Phase 4: User Story 2 — 查看单次运行详情与 Trace 瀑布图（Priority: P1）

**目标**：点击某条 Run，右侧展示完整 Trace 瀑布图 + 三 Tab 详情面板

**独立测试**：选中一条含工具调用的记录，验证瀑布图各 span bar 可见（颜色区分类型）、耗时色阶正确（绿/黄/红）、点击 bar 展开显示 input/output、Tab 切换正确显示完整 prompt 和最终答案

- [x] T014 [US2] 创建 `src/components/runs/SpanRow.tsx`：单条 span 可展开行，展示 span 类型色块、工具名（tool 类型）、耗时 badge（使用 `--color-success/warning/destructive` 色阶）；展开后显示 input/output/error 内容（带"…内容已截断"提示）；按 depth 动态计算左缩进（每层 24px = 6 × 4px 阶梯）；实现完整 5 态
- [x] T015 [P] [US2] 创建 `src/components/runs/TraceWaterfall.tsx`：SVG 瀑布图组件，输入 `spans[]` 和 `run.durationMs`；横轴时间轴（totalDuration = 100% 宽）；每条 bar 颜色由 spanType 决定（thinking 紫/tool-call 蓝/tool-result 绿/answer 橙）；bar 宽度 = `durationMs / totalDuration * 100%`；bar 左偏 = `(span.startedAt - runStart) / totalDuration * 100%`；横轴刻度线清晰（4 条等分线）；图例显示 4 种类型色块；SVG 宽度自适应容器；整体可垂直滚动（DeepResearch 15 轮场景）
- [x] T016 [US2] 创建 `src/components/runs/RunDetail.tsx`：右侧详情面板，顶部展示 4 个元信息（Agent/状态/耗时/模型名称）；中部 TraceWaterfall（span 行列表，点击调 SpanRow 展开）；底部三 Tab（输入/输出/元数据），元数据 Tab 显示模型、inputTokens/outputTokens/totalTokens（null 时显示"—"）、总耗时；Simple Agent 无 span 时瀑布图区域仅显示 answer 单条 bar；spans 加载中瀑布图区域和 Tab 内容区显示 Skeleton 占位（宪法骨架屏原则）
- [x] T017 [US2] 更新 `src/app/runs/page.tsx`：右栏替换为完整 `RunDetail` 组件，传入选中 Run 及其 spans（调用 `getSpans(selectedId)` 获取）；未选中时右栏显示"选择一条记录查看详情"占位提示

---

## Phase 5: User Story 3 — 筛选运行记录（Priority: P2）

**目标**：三维筛选（状态/模型/时间范围）快速定位记录

**独立测试**：选择"状态：失败"，验证列表仅显示 failed 记录；同时选"最近 7 天"，验证两个条件取交集

- [x] T018 [US3] 创建 `src/components/runs/FilterBar.tsx`：三个 shadcn `Select` 组件**竖排一列**（`flex-col`，`w-full`，适配 320px 左侧边栏），选项如下：
  - 状态：全部 / 成功 / 失败 / 中断
  - 模型：全部 / （从已有记录中动态读取去重模型列表）
  - 时间范围：全部 / 今天 / 最近 7 天 / 最近 30 天
  - 任意筛选变化时触发 `onFilterChange(filter)` 回调
- [x] T019 [US3] 更新 `src/hooks/useRunHistory.ts`：接收 `filter` 参数；filter 变化时重置 cursor 并重新查询；将 filter 透传给 `listRuns()`（timeRange → createdAt 范围转换已在 T004 的 `listRuns` 中实现，此处无需重复）
- [x] T020 [US3] 更新 `src/app/runs/page.tsx`：在列表顶部渲染 `FilterBar`，将 filter state 传入 `useRunHistory`；筛选无结果时显示"没有符合条件的记录"提示

---

## Phase 6: User Story 4 — 删除运行记录（Priority: P3）

**目标**：删除单条 Run 或一键清空全部

**独立测试**：删除一条记录，确认该记录从列表消失、右侧详情区域重置；清空全部后页面进入空状态

- [x] T021 [US4] 更新 `src/components/runs/RunListItem.tsx`：添加删除触发按钮（hover 时显示，lucide-react `Trash2` 图标）；点击后弹出 shadcn `AlertDialog` 确认弹窗（"确认删除这条记录？"）；确认后调用 `deleteRun(id)`，通知父组件刷新列表并重置 selectedId
- [x] T022 [US4] 更新 `src/app/runs/page.tsx` 或 `RunList.tsx`：列表顶部添加"清空全部"按钮（仅在有记录时显示）；点击后弹出 shadcn `AlertDialog`（"确认清空所有运行记录？此操作不可撤销"）；确认后调用 `clearAllRuns()`，列表重置进入空状态

---

## Phase 7: Polish（跨切面完善）

**目的**：验收前统一检查宪法合规、视觉一致性和边界条件

- [x] T023 [P] 检查所有新建/修改文件中的颜色使用：确认无硬编码 hex 或裸 Tailwind 色阶（如 `bg-blue-500`），瀑布图耗时色阶使用 `--color-success`/`--color-warning`/`--color-destructive`，span 类型颜色使用 `hsl(var(--...))` 形式
- [x] T024 [P] 检查所有间距值走 4px 阶梯（4/8/12/16/20/24/32...），特别验证 SpanRow 24px 缩进、TraceWaterfall bar 高度和间距
- [x] T025 [P] 在 `src/app/runs/page.tsx` 中验证三类边界条件 UI：空状态（无记录）、Skeleton（加载中）、筛选无结果；确认空状态文案为"空空如也，先去 Playground 聊一次吧"
- [x] T026 [P] 验证 `useRunRecorder` 的静默失败逻辑：IndexedDB 写入异常时只 `console.error`，不向用户展示错误，不中断 AI 对话主流程
- [x] T027 [P] 验证用户中断流式响应（点击停止）时的记录行为：Run.status 标记为"interrupted"，已收到的部分 spans 保留，记录正常写入 IndexedDB
- [ ] T028 检查 RunListItem、SpanRow、FilterBar 所有交互组件的完整 5 态（default/hover/active/focus/disabled）是否覆盖（宪法 Section IV 交互组件规则）
- [ ] T029 手动验收 SC-003：输入一个复杂研究主题触发 DeepResearch 运行（确保产生 ≥ 10 轮 web_search），完成后在 /runs 中查看该记录，验证瀑布图完整显示所有 span（无截断、无渲染错误）、垂直滚动正常、各 span 耗时色阶正确
- [ ] T030 手动验收 SC-004：在 IndexedDB 已有 100+ 条记录的情况下，切换筛选条件（状态/模型/时间范围），用浏览器 DevTools Performance 面板计时或手动掐秒，验证筛选结果响应时间 < 500ms

---

## 依赖关系

```
T001 → T002 → T003 → T004 → T005 → T007 → T011 → T012 → T013
                           ↘ T006 ↗
                           T005 → T008 (P)
                           T005 → T009 (P)
                           T005 → T010 (P)
T013 完成后 →
  T014 → T016 → T017
  T015 (P) ↗
T017 完成后 →
  T018 → T019 → T020
T020 完成后 →
  T021 → T022
T022 完成后 → T023(P) T024(P) T025(P) T026(P) T027(P) → T028 → T029 T030(P)
```

---

## 并行执行机会

| 并行组 | 任务 | 前置条件 |
|--------|------|----------|
| 数据采集集成 | T008, T009, T010 | T005 完成 |
| 详情组件 | T014, T015 | T006 完成 |
| Polish 检查 | T023, T024, T025, T026, T027 | T022 完成 |

---

## MVP 范围建议

**最小可验收增量**：Phase 1 + Phase 2 + Phase 3（T001–T013）

完成后可独立验收 SC-001（记录在 3 秒内出现）和 SC-002（5 类入口均可产生记录）。
瀑布图（US2）和筛选（US3）作为后续增量追加。

---

## 实现策略

1. **先数据后 UI**：Phase 1/2 完成后，用浏览器 DevTools → IndexedDB 面板直接验证数据写入正确性，再开始 UI 开发
2. **先有工具后有 Playground**：US1 优先集成 GeneralAgentPanel（工具最多，覆盖最复杂场景），再集成 Playground 和其他 Panel
3. **瀑布图先静态后交互**：TraceWaterfall 先实现静态渲染正确，再添加 SpanRow 点击展开交互
4. **筛选先 UI 后逻辑**：FilterBar 先渲染三个 Select，再接入 useRunHistory 查询逻辑
