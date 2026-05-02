# Contract: Run History 数据层接口

## 概述

Run History 数据层为纯客户端 IndexedDB 操作，无 HTTP API。  
所有接口以 TypeScript 函数形式暴露，供 React 组件和 hooks 调用。

---

## 写入接口

### `saveRun(run, spans): Promise<number>`

将一次完整运行保存到 IndexedDB。  
由 `useRunRecorder` hook 在流完成时调用。

```typescript
async function saveRun(
  run: Omit<Run, 'id'>,
  spans: Omit<Span, 'id' | 'runId'>[]
): Promise<number>  // 返回新建 Run 的 id
```

**行为**：
- 使用 Dexie `transaction` 原子写入：先插 Run，再批量插 Spans（附 runId）
- 自动截断超过 10,000 字符的 `input`/`output` 字段，追加 "…内容已截断"
- `promptSummary` 自动取 `prompt` 前 60 字

---

## 读取接口

### `listRuns(options): Promise<{ runs: Run[]; nextCursor: number | null }>`

分页读取运行列表，时间倒序。

```typescript
interface ListRunsOptions {
  cursor?: number        // 上次返回的 nextCursor，首次省略
  limit?: number         // 默认 50，最大 50
  filter?: {
    status?: RunStatus   // "success" | "failed" | "interrupted"
    model?: string       // 精确匹配
    timeRange?: "today" | "7d" | "30d"  // 省略 = 全部
  }
}

async function listRuns(options?: ListRunsOptions): Promise<{
  runs: Run[]
  nextCursor: number | null  // null 表示没有更多记录
}>
```

**行为**：
- cursor 为上一页最后一条 Run 的 `id`，下次查询 `id < cursor`
- 筛选条件取交集（AND 语义）
- timeRange 转换：`today` = 今日 00:00，`7d` = 7 天前，`30d` = 30 天前

---

### `getRun(id): Promise<Run | undefined>`

按 id 读取单条 Run。

```typescript
async function getRun(id: number): Promise<Run | undefined>
```

---

### `getSpans(runId): Promise<Span[]>`

读取某条 Run 的所有 Span，按 order 升序排列。

```typescript
async function getSpans(runId: number): Promise<Span[]>
```

---

## 删除接口

### `deleteRun(id): Promise<void>`

删除单条 Run 及其所有 Span（事务操作）。

```typescript
async function deleteRun(id: number): Promise<void>
```

---

### `clearAllRuns(): Promise<void>`

清空所有 Run 和 Span（事务操作）。

```typescript
async function clearAllRuns(): Promise<void>
```

---

## React Hook 接口

### `useRunRecorder(source, agentId?)`

记录一次 Agent 运行，供各 Panel 和 Playground 页面调用。

```typescript
function useRunRecorder(
  source: string,      // "Playground" | agent 名称
  agentId?: string     // agent id，Playground 传 undefined
): {
  startRun: (model: string, prompt: string) => void
  finishAgentRun: (state: AgentExecutionState, status: RunStatus) => Promise<void>
  finishStructuredRun: (object: PlaygroundResponse | undefined, status: RunStatus) => Promise<void>
}
```

---

### `useRunHistory(options?)`

读取运行列表，供 /runs 页面使用。

```typescript
function useRunHistory(options?: ListRunsOptions): {
  runs: Run[]
  isLoading: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => void  // 重新从头加载
}
```

---

## 错误处理约定

- IndexedDB 写入失败：**静默失败**，不影响 AI 对话主流程（符合 spec edge case 约束）
- IndexedDB 读取失败：返回空列表，展示空状态 UI
- 所有错误通过 `console.error` 记录，不向用户展示技术错误
