# Data Model: 运行记录页（Run History）

## 存储层

**引擎**：浏览器 IndexedDB（Dexie.js v4 封装）  
**数据库名**：`run-history`  
**Schema 版本**：1

---

## 实体定义

### Run（运行记录）

代表一次完整的 AI 调用，从 submit 开始到流关闭结束。

```typescript
interface Run {
  id?: number            // 自增主键（Dexie 自动生成，? 表示写入前可省略）
  source: string         // "Playground" | agent 名称（如"深度研究助手"）
  agentId: string | null // agent-general / agent-deepresearch / etc，Playground 为 null
  model: string          // deepseek-v4-flash / gpt-4o-mini 等
  status: RunStatus      // "success" | "failed" | "interrupted"
  prompt: string         // 完整原始 prompt
  promptSummary: string  // prompt 前 60 字，列表展示用
  answer: string         // 完整最终答案（最多 10,000 字，超出截断）
  totalTokens: number | null
  promptTokens: number | null
  completionTokens: number | null
  durationMs: number     // 总耗时：done 事件时间 - submit 时间
  createdAt: number      // = runStart：submit() 调用时记录的 Date.now()，非 IndexedDB 写入时间；TraceWaterfall 以此为时间轴零点
  // ⚠️ 无 cost 字段：成本估算需要维护各模型单价表，超出本期范围。
  //    UI 顶部第 4 个元信息格显示 model（模型名称），而非成本。
}

type RunStatus = "success" | "failed" | "interrupted"
```

**索引**（Dexie store 声明）：
```
'++id, createdAt, status, model, [status+createdAt], [model+createdAt]'
```

---

### Span（执行片段）

代表一次 Run 中的单个执行阶段，按事件流顺序记录。

```typescript
interface Span {
  id?: number           // 自增主键，同时用作分页 cursor
  runId: number         // 外键，关联 Run.id
  spanType: SpanType    // "thinking" | "tool-call" | "tool-result" | "answer"
  toolName: string | null   // tool-call / tool-result 类型专有（如 "web_search"）
  toolCallId: string | null // 关联 tool-call 与 tool-result 的配对键
  input: string | null  // 输入内容，上限 10,000 字，超出截断并附加 "…内容已截断"
  output: string | null // 输出内容，上限 10,000 字，超出截断并附加 "…内容已截断"
  error: string | null  // 工具执行错误信息（仅 tool-result 可能有值）
  startedAt: number     // 客户端接收到该事件时的 Date.now()
  durationMs: number    // 下一事件 startedAt - 本事件 startedAt（最后一个 span 用 done 时间）
  round: number         // ReAct 轮次（1, 2, 3…）；thinking/answer 为 0
  order: number         // Run 内全局顺序（0-based）
  // depth 不存储，由 spanType 在渲染时动态计算：
  //   thinking / answer → depth = 0（顶层，无缩进）
  //   tool-call / tool-result → depth = 1（缩进 24px = 6 × 4px）
}

type SpanType = "thinking" | "tool-call" | "tool-result" | "answer"
```

**索引**（Dexie store 声明）：
```
'++id, runId, [runId+order]'
```

---

## 实体关系

```
Run (1) ──── (N) Span
  └── id ────── runId
```

一条 Run 包含 0 至多条 Span。Simple Agent（无工具、无 thinking）最少 1 条 Span（answer）。DeepResearch 最多约 46 条 Span（15 轮 × 3 个 span/轮 + 1 answer）。

---

## 各 Agent 类型的 Span 结构示例

### Playground 无工具模式（1 个 span）

```
[0] answer  — round:0  — durationMs: 总耗时
```

### General Agent（含工具，N 轮）

```
[0] thinking      — round:0  — 推理过程（可能为空，取决于模型）
[1] tool-call     — round:1  — name: "web_search", toolCallId: "abc"
[2] tool-result   — round:1  — name: "web_search", toolCallId: "abc"
[3] tool-call     — round:2  — name: "calculate", toolCallId: "def"
[4] tool-result   — round:2  — name: "calculate", toolCallId: "def"
[5] answer        — round:0  — 最终答案
```

### DeepResearch（最多 15 轮）

```
[0]  thinking     — round:0  — 研究规划推理
[1]  tool-call    — round:1  — name: "web_search"
[2]  tool-result  — round:1
[3]  thinking     — round:0  — 评估结果，规划下一步
[4]  tool-call    — round:2
...
[N]  answer       — round:0  — 四章节研究报告
```

### Simple Agent（无工具，1 个 span）

```
[0] answer  — round:0  — 无 thinking，无工具
```

---

## 关键约束

| 约束 | 值 | 来源 |
|------|----|------|
| Span input/output 单字段上限 | 10,000 字符 | Clarify Session Q2 |
| 截断标记 | "…内容已截断" 附加在末尾 | Clarify Session Q2 |
| 列表分页大小 | 每次 50 条 | spec FR-004 |
| 时间范围筛选选项 | 全部/今天/最近7天/最近30天 | Clarify Session Q3 |
| 列表是否实时刷新 | 否，仅页面加载时获取 | Clarify Session Q1 |
| 最大嵌套深度 | 5 层（spec Assumptions） | spec |

---

## Dexie.js 初始化代码结构

```typescript
// src/lib/run-history/db.ts
import Dexie, { type Table } from 'dexie'
import type { Run, Span } from './types'

class RunHistoryDB extends Dexie {
  runs!: Table<Run, number>
  spans!: Table<Span, number>

  constructor() {
    super('run-history')
    this.version(1).stores({
      runs:  '++id, createdAt, status, model, [status+createdAt], [model+createdAt]',
      spans: '++id, runId, [runId+order]',
    })
  }
}

export const db = new RunHistoryDB()
```
