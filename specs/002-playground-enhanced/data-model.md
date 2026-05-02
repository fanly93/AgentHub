# 数据模型：Playground 工具调用增强

**日期**：2026-04-30 | **功能分支**：`002-playground-enhanced`

---

## 实体 1：AgentStreamEvent（NDJSON 事件联合类型）

Agent 流式接口的单个事件，每行一个 JSON 对象，共 6 种类型。

### ThinkingDeltaEvent
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| type | `"thinking-delta"` | 必填 | 事件类型标识 |
| delta | `string` | 必填，≥1 字 | 思考链增量文本 |

### ToolCallEvent
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| type | `"tool-call"` | 必填 | 事件类型标识 |
| callId | `string` | 必填 | 工具调用唯一 ID（由 SDK 生成） |
| name | `string` | 必填，≤100 字 | 工具名称（snake_case） |
| arguments | `Record<string, unknown>` | 必填 | AI 传入的工具调用参数 |

### ToolResultEvent
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| type | `"tool-result"` | 必填 | 事件类型标识 |
| callId | `string` | 必填 | 对应 ToolCallEvent 的 callId |
| name | `string` | 必填 | 对应工具名称 |
| result | `unknown` | 必填 | 工具返回值（任意合法 JSON） |
| error | `string` | 可选，≤500 字 | 工具执行失败时的中文错误描述 |

### AnswerDeltaEvent
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| type | `"answer-delta"` | 必填 | 事件类型标识 |
| delta | `string` | 必填，≥1 字 | 最终答案增量文本（Markdown） |

### DoneEvent
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| type | `"done"` | 必填 | 事件类型标识 |
| usage | `object` | 可选 | Token 用量 |
| usage.promptTokens | `number` | 可选，非负整数 | Prompt token 数 |
| usage.completionTokens | `number` | 可选，非负整数 | 生成 token 数 |
| usage.totalTokens | `number` | 可选，非负整数 | 总 token 数 |

### ErrorEvent
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| type | `"error"` | 必填 | 事件类型标识 |
| message | `string` | 必填，≥1 字 | 中文用户可读错误描述 |
| code | `string` | 必填 | 机器可读错误码（见下表） |

**ErrorCode 枚举**：

| 值 | 含义 |
|---|---|
| `INVALID_REQUEST` | 请求参数校验失败 |
| `INVALID_KEY` | API Key 无效或未配置 |
| `RATE_LIMITED` | 速率限制 |
| `MODEL_UNAVAILABLE` | 模型暂不可用 |
| `TOOL_EXECUTION_FAILED` | 工具执行失败（通过 tool-result.error 也会报告，此处为流级别错误） |
| `TIMEOUT` | 超过 Edge Runtime 60s 限制 |
| `STREAM_INTERRUPTED` | 流中断（网络问题） |

---

## 实体 2：AgentExecutionState（前端运行时状态）

`useAgentStream` hook 维护的客户端状态，驱动 ResponseArea 渲染。

| 字段 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| thinking | `string` | `""` | 累积的思考链文本（ThinkingCard 数据源） |
| toolCalls | `AgentToolCall[]` | `[]` | 按到达顺序排列的工具调用列表 |
| toolResults | `AgentToolResult[]` | `[]` | 工具执行结果列表 |
| pendingCallIds | `Set<string>` | `new Set()` | 已发起但未返回结果的调用 ID（驱动骨架屏） |
| answer | `string` | `""` | 累积的最终答案文本（AnswerCard 数据源） |
| usage | `Usage \| null` | `null` | 执行完成后的 token 用量 |
| isLoading | `boolean` | `false` | 流式执行中标志 |
| error | `AgentStreamError \| null` | `null` | 流级别错误 |

### AgentToolCall（嵌套实体）
| 字段 | 类型 | 说明 |
|------|------|------|
| callId | `string` | 唯一调用 ID |
| name | `string` | 工具名称 |
| arguments | `Record<string, unknown>` | 调用参数 |
| round | `number` | 所属 ReAct 轮次（1 起）|

### AgentToolResult（嵌套实体）
| 字段 | 类型 | 说明 |
|------|------|------|
| callId | `string` | 对应 AgentToolCall.callId |
| name | `string` | 工具名称 |
| result | `unknown` | 工具返回值 |
| error | `string \| undefined` | 执行失败时的中文错误 |

---

## 实体 3：ToolDefinition（内置工具定义）

描述 ToolPanel 中展示的 5 个内置工具的元数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| name | `ToolName` | 工具标识符（snake_case） |
| label | `string` | 面板展示名称（中文） |
| description | `string` | 功能描述（中文，展示给用户） |
| requiresApiKey | `string \| null` | 需要的环境变量名（如 `TAVILY_API_KEY`）；无需 Key 时为 `null` |
| runtime | `"edge" \| "nodejs"` | 执行运行时 |

**内置工具列表**：

| name | label | requiresApiKey | runtime |
|------|-------|----------------|---------|
| `get_current_time` | 获取当前时间 | `null` | `edge` |
| `calculate` | 数学计算 | `null` | `edge` |
| `web_search` | 联网检索 | `TAVILY_API_KEY` | `edge` |
| `get_weather` | 查询天气 | `OPENWEATHER_API_KEY` | `edge` |
| `write_file` | 写入本地文件 | `null` | `nodejs` |

### ToolName 枚举

```
"get_current_time" | "calculate" | "web_search" | "get_weather" | "write_file"
```

---

## 实体 4：AgentSessionRecord（sessionStorage 持久化结构）

存储于 `sessionStorage('agent:last-execution')`，同 Tab 刷新后可恢复。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| thinking | `string` | 可选 | 思考链内容 |
| toolCalls | `AgentToolCall[]` | 必填 | 工具调用记录 |
| toolResults | `AgentToolResult[]` | 必填 | 工具结果记录 |
| answer | `string` | 必填 | 最终答案 |
| usage | `Usage \| null` | 可选 | Token 用量 |
| model | `ModelId` | 必填 | 使用的模型 |
| selectedTools | `ToolName[]` | 必填 | 本次勾选的工具列表 |
| prompt | `string` | 必填 | 用户输入的 Prompt |
| savedAt | `number` | 必填，Unix timestamp ms | 保存时间戳 |

---

## 实体 5：WriteFileRequest / WriteFileResponse（内部 API 数据结构）

### WriteFileRequest（POST /api/tools/write-file 请求体）
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| filename | `string` | 必填，仅 `[a-zA-Z0-9_\-]+` | 文件名（不含路径、不含扩展名） |
| content | `string` | 必填，≤1MB（UTF-8） | 要写入的文本内容 |

### WriteFileResponse（成功响应体）
| 字段 | 类型 | 说明 |
|------|------|------|
| success | `true` | 写入成功标志 |
| path | `string` | 写入文件的绝对路径 |
| overwritten | `boolean` | 是否覆盖了已有文件 |

### WriteFileErrorResponse（失败响应体）
| 字段 | 类型 | 说明 |
|------|------|------|
| success | `false` | 写入失败标志 |
| error | `string` | 中文错误描述 |
| code | `"INVALID_FILENAME" \| "CONTENT_TOO_LARGE" \| "WRITE_FAILED"` | 错误码 |

---

## 实体关系

```
AgentExecutionState
  ├── thinking: string                    → ThinkingCard.content
  ├── toolCalls: AgentToolCall[]          → ToolCallCard（每条一个卡片行）
  ├── toolResults: AgentToolResult[]      → ToolResultCard（与 toolCalls 按 callId 配对）
  ├── pendingCallIds: Set<string>         → 对应 toolCall 位置显示骨架屏
  └── answer: string                      → AnswerCard.content

AgentStreamEvent (NDJSON)
  → useAgentStream reducer
  → AgentExecutionState

AgentExecutionState (完成后)
  → AgentSessionRecord
  → sessionStorage('agent:last-execution')
```
