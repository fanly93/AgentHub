# API 契约：Agent 流式执行接口

**端点**：`POST /api/agent/stream`  
**运行时**：Edge Runtime（`export const runtime = "edge"`）  
**最大执行时间**：60s（宪法硬上限）

---

## 请求

### Headers

| Header | 必填 | 说明 |
|--------|------|------|
| `Content-Type` | 是 | `application/json` |
| `X-Provider-Api-Key` | 否 | 模型 API Key（客户端 localStorage 传入）；缺失时服务端回退到环境变量 |

### Body（JSON）

```json
{
  "model": "deepseek-v4-flash",
  "prompt": "用户输入的文本",
  "tools": ["get_current_time", "web_search"]
}
```

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| model | `ModelId` | 必填 | `"gpt-4o-mini" \| "claude-sonnet-4-6" \| "gemini-2.0-flash" \| "deepseek-v4-flash" \| "deepseek-v4-pro" \| "qwen3.6-plus"` |
| prompt | `string` | 必填，1–50000 字 | 用户输入 |
| tools | `ToolName[]` | 必填，1–5 项 | 勾选的工具列表；空数组时请求应被拒绝（改用 /api/playground/stream） |

---

## 响应

### 成功：200 OK — NDJSON 事件流

```
Content-Type: application/x-ndjson
Transfer-Encoding: chunked
```

每行一个 JSON 对象，行末以 `\n` 结尾。前端按 `\n` 分割后逐行 `JSON.parse`。

**事件序列示例**（推理模型 + 2 步工具调用）：

```ndjson
{"type":"thinking-delta","delta":"用户想知道当前时间，我需要调用 get_current_time 工具"}
{"type":"tool-call","callId":"call_abc","name":"get_current_time","arguments":{}}
{"type":"tool-result","callId":"call_abc","name":"get_current_time","result":"2026/04/30 18:23:45"}
{"type":"tool-call","callId":"call_def","name":"web_search","arguments":{"query":"今日 AI 新闻"}}
{"type":"tool-result","callId":"call_def","name":"web_search","result":{"results":[{"title":"...","snippet":"..."}]}}
{"type":"answer-delta","delta":"根据搜索结果，今日 AI 新闻包括：\n\n"}
{"type":"answer-delta","delta":"1. ..."}
{"type":"done","usage":{"promptTokens":450,"completionTokens":312,"totalTokens":762}}
```

**事件类型规范**：

| type | 触发时机 | 关键字段 |
|------|---------|---------|
| `thinking-delta` | 推理模型产生思考链增量时 | `delta: string` |
| `tool-call` | AI 请求调用工具时 | `callId`, `name`, `arguments` |
| `tool-result` | 工具 execute() 返回后 | `callId`, `name`, `result`, `error?` |
| `answer-delta` | AI 输出最终答案增量时 | `delta: string` |
| `done` | 流正常结束时 | `usage?: { promptTokens, completionTokens, totalTokens }` |
| `error` | 流级别错误时 | `message: string`, `code: string` |

**ToolResultEvent 错误示例**（工具执行失败，流不中断）：

```ndjson
{"type":"tool-result","callId":"call_xyz","name":"web_search","result":null,"error":"web_search 工具未配置 API Key，请在 .env.local 中添加 TAVILY_API_KEY"}
```

### 失败：4xx / 5xx — JSON 错误响应

```
Content-Type: application/json
```

```json
{
  "tier": "fatal",
  "message": "API Key 未提供，请前往设置页配置",
  "code": "INVALID_KEY"
}
```

| status | tier | code | 场景 |
|--------|------|------|------|
| 400 | fatal | `INVALID_REQUEST` | 请求体格式错误或参数非法 |
| 401 | fatal | `INVALID_KEY` | API Key 缺失或无效 |
| 422 | fatal | `UNSUPPORTED_MODEL` | 不支持的模型 ID |
| 429 | retryable | `RATE_LIMITED` | 速率限制（含 `Retry-After` header） |
| 503 | retryable | `MODEL_UNAVAILABLE` | 模型暂不可用 |

---

## 工具执行规范

### get_current_time

- **参数**：无
- **执行**：`new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", ... })`（inline，无外部依赖）
- **返回**：北京时间（Asia/Shanghai）字符串，格式为 `"YYYY/MM/DD HH:mm:ss"`，如 `"2026/04/30 18:23:45"`

### calculate

- **参数**：`{ expression: string }` — 数学表达式，≤500 字
- **执行**：先用正则 `/^[\d\s+\-*/%().]+$/` 白名单校验，通过后由递归下降解析器（`parseFactor / parseTerm / parseExpr`）求值（不使用 `Function()` / `eval()`，Edge Runtime 合规）；仅支持 `+`、`-`、`*`、`/`、`%`、括号、小数（无 sqrt/abs 等）
- **返回**：计算结果数值或字符串，如 `8712`
- **错误**：表达式含非法字符或计算失败时返回 `"无效的数学表达式：{expression}"`

### web_search

- **参数**：`{ query: string }` — 搜索关键词，≤200 字
- **执行**：`fetch('https://api.tavily.com/search', { method: 'POST', body: { api_key: TAVILY_API_KEY, query, max_results: 5 } })`
- **返回**：`{ results: [{ title, url, snippet }] }`（最多 5 条）
- **Key 缺失错误**：`"web_search 工具未配置 API Key，请在 .env.local 中添加 TAVILY_API_KEY"`

### get_weather

- **参数**：`{ city: string }` — 城市名，英文，≤100 字
- **执行**：`fetch('https://api.openweathermap.org/data/2.5/weather?q={city}&appid={OPENWEATHER_API_KEY}&units=metric&lang=zh_cn')`
- **返回**：`{ city, temp, feelsLike, description, humidity, windSpeed }`
- **Key 缺失错误**：`"get_weather 工具未配置 API Key，请在 .env.local 中添加 OPENWEATHER_API_KEY"`

### write_file

- **参数**：`{ filename: string, content: string }` — 文件名（不含路径/扩展名）+ 文本内容
- **执行**：`fetch(new URL('/api/tools/write-file', req.url), { method: 'POST', body: JSON.stringify({ filename, content }) })`
- **返回**：`{ success: true, path: "/absolute/path/to/downloads/filename.txt", overwritten: boolean }`
- **错误**：文件名非法时返回 `"文件名不合法，不允许包含路径分隔符"`；内容 > 1MB 时返回 `"文件内容超出 1MB 限制"`

---

## 前端消费规范

### 调用条件

- 仅当 `selectedTools.length > 0` 时调用此接口
- `selectedTools` 为空时，调用 `/api/playground/stream`（现有接口）

### lineBuffer 实现要求

```typescript
// 前端解析时必须实现 lineBuffer 防止 chunk 边界问题
let lineBuffer = '';
const lines = (lineBuffer + chunk).split('\n');
lineBuffer = lines.pop() ?? '';  // 最后一行可能不完整，保留到下一个 chunk
```

### 骨架屏触发条件

- `tool-call` 事件到达 → 将 `callId` 加入 `pendingCallIds` → 对应位置显示骨架屏
- `tool-result` 事件到达 → 将 `callId` 从 `pendingCallIds` 移除 → 骨架屏替换为结果内容
