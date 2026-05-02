# Research: 运行记录页（Run History）

## 决策总览

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 持久化层 | IndexedDB via Dexie.js | 宪法强制：运行记录 MUST 存储在浏览器 IndexedDB/localStorage |
| IDB 封装库 | Dexie.js v4 | 最成熟的 IDB 封装，TypeScript 原生支持，Next.js 兼容 |
| 计时来源 | 客户端 Date.now() | 无需改动服务端路由，符合宪法 Edge Runtime 约束 |
| 数据捕获位置 | 扩展现有 hooks | useAgentStream / useStructuredStream 已有 onFinish 回调，直接复用 |
| 瀑布图渲染 | SVG + React | 宪法锁定 recharts（仅图表），SVG 手写更轻量；无障碍访问；文本可复制 |
| 筛选实现 | Dexie WhereClause | 纯客户端，无需 API 调用，索引覆盖 status/model/createdAt |
| 分页方式 | Dexie cursor（id 降序） | cursor-based 避免 offset 跳页问题；runs.id 自增天然有序 |

---

## Decision 1：持久化层

**选择**：IndexedDB via Dexie.js v4

**宪法约束**：
> Section III 持久化原则：运行记录 MUST 存储在浏览器 IndexedDB 或 localStorage。  
> Red Line：引入 Drizzle、Prisma、Redis、PostgreSQL 等服务端数据库。

**为何不用 localStorage**：localStorage 5MB 上限不足，单条 DeepResearch 运行（15 轮搜索 + 思考链）可能超过 500KB。IndexedDB 上限通常 ≥ 500MB。

**为何选 Dexie.js 而非裸 IDB API**：
- IDB 原生 API 为 callback 风格，无 Promise，代码冗余
- Dexie.js 提供 Promise/async 接口，TypeScript 泛型，复合索引，where 链式查询
- Dexie v4 支持 React 的 `useLiveQuery`（可选，本期不用）

**已评估的替代方案**：
- `idb`（Jake Archibald）：轻量但 API 较低层，筛选需手写
- `localForage`：面向 key-value，不适合关系型查询
- SQLite WASM（wa-sqlite）：性能好但引入 WASM bundle，首屏影响大

---

## Decision 2：计时数据来源

**选择**：客户端 `Date.now()` 在接收每条 NDJSON 事件时打时间戳

**背景**：当前 NDJSON 流事件无时间戳字段，服务端路由均为 Edge Runtime，不宜修改。

**实现方式**：
```
runStart = Date.now()                    // submit() 调用时
eventTimestamps[eventIndex] = Date.now() // 每条流事件解析后

span.startedAt = eventTimestamps[i]
span.durationMs = eventTimestamps[i+1] - eventTimestamps[i]
// 最后一个 span 的 durationMs = doneTimestamp - eventTimestamps[last]
```

**精度说明**：反映客户端接收时延，非服务端精确执行时间。对于"排查哪个阶段慢"的用途已足够（误差 < 50ms，受 JS 单线程事件循环影响）。

---

## Decision 3：数据捕获集成点

**选择**：在现有 hook 的 onFinish 回调中触发录入

**现有 hook 接口**：
- `useAgentStream.submit(prompt, model, apiKey, tools, onFinish?)` — onFinish 传入最终 state
- `useStructuredStream({ onFinish? })` — onFinish 传入 `{ object }`

**实现策略**：
- 新增 `useRunRecorder(source, agentId?)` hook，返回 `{ startRun, finishRun }` 两个函数
- 各 Panel 和 Playground 页面在 `submit` 前调用 `startRun()`，在 `onFinish` 里调用 `finishRun(state)`
- recorder 内部持有 `runStart` 时间戳和事件时间戳数组，自动计算各 span 耗时
- 不侵入 useAgentStream / useStructuredStream 内部逻辑，保持现有 hook 稳定

**为何不直接改 hooks 内部**：useAgentStream 和 useStructuredStream 已被多处使用，改动内部会带来意外副作用。外挂 recorder 更符合单一职责原则，也符合宪法"不为假想需求提前抽象"原则。

---

## Decision 4：瀑布图技术选型

**选择**：手写 SVG（React JSX 内联）

**宪法约束**：宪法锁定 recharts 用于图表，但瀑布图是自定义时间轴可视化，不是标准图表类型，recharts 无法直接实现。

**SVG vs Canvas**：
- SVG：无障碍（aria 属性）、文本可复制、CSS 可控、React 原生支持
- Canvas：性能更好但无障碍差，对 15 条以内的 span 无性能优势

**实现方式**：
```
totalDuration = runs.durationMs
xScale = (ms: number) => (ms / totalDuration) * SVG_WIDTH
bar.x = xScale(span.startedAt - runStart)
bar.width = xScale(span.durationMs)
bar.y = spanIndex * (BAR_HEIGHT + GAP) + depth * INDENT
```

---

## Decision 5：IndexedDB Schema 与索引

**选择**：两张表（runs + spans），扁平结构，非递归

**Dexie 索引策略**：
```
runs:  '++id, createdAt, status, model, [status+createdAt]'
spans: '++id, runId, [runId+order]'
```

**游标分页**：`db.runs.orderBy('id').reverse().filter(predicate).limit(50).toArray()`  
**筛选**：多条件时用 `.where('status').equals(s)` + `.filter()` 组合  
**cursor token**：最后一条记录的 `id`，下次查询 `.where('id').below(lastId)`

---

## Decision 6：runs 页面架构

**选择**：整页 Client Component（`"use client"`）

**理由**：
- IndexedDB 只在浏览器环境可用，无法在 Server Component 中访问
- 宪法约束：无服务端数据库，无 Server Component 读 DB 的场景
- 页面交互（选中记录、筛选、展开 span）均需客户端状态
- 骨架屏优先（宪法 Section IV）：Skeleton 占位符在 loading 期间显示

**SEO 考量**：运行记录页是私有工具页，无 SEO 需求，Client Component 无代价。
