# API Contract: POST /api/deepresearch/stream

**Feature**: 003-store-agent-playground | **Date**: 2026-05-01  
**类型**: 新增路由

## 概述

DeepResearch 专用流式路由。采用与 `/api/agent/stream` **完全相同的 NDJSON 事件协议**，前端可直接复用 `useAgentStream` hook。差异仅在于：
- `web_search` 工具硬编码为唯一工具（用户不可选）
- `maxSteps: 15`（vs 通用 Agent 的 8）
- 使用深度研究专属系统提示词

## Request

### Method & URL
```
POST /api/deepresearch/stream
```

### Headers
```
Content-Type: application/json
X-Provider-Api-Key: <optional>
```

### Body Schema

```typescript
{
  model: ModelId;    // 必填
  prompt: string;    // 必填，1-50000 字，研究主题
}
```

> 无 `tools` 字段——`web_search` 由服务端强制注入，用户无需也无法控制。

## Response: NDJSON 事件流

```
Content-Type: application/x-ndjson
```

每行一个 JSON 对象，类型为 `AgentStreamEvent`（复用现有定义）：

```typescript
// 事件序列示例（一次完整研究流程）
{"type":"thinking-delta","delta":"分析研究主题：XXX。制定检索策略..."}
{"type":"tool-call","callId":"call_1","name":"web_search","arguments":{"query":"关键词A"}}
{"type":"tool-result","callId":"call_1","name":"web_search","result":[...]}
{"type":"tool-call","callId":"call_2","name":"web_search","arguments":{"query":"关键词B"}}
{"type":"tool-result","callId":"call_2","name":"web_search","result":[...]}
// ... 多轮（最多 15 步）
{"type":"answer-delta","delta":"## 执行摘要\n"}
{"type":"answer-delta","delta":"本次研究发现..."}
{"type":"done","usage":{"promptTokens":2000,"completionTokens":800,"totalTokens":2800}}
```

### 事件类型（与 `/api/agent/stream` 完全一致）

| 事件 type | 说明 | 触发条件 |
|-----------|------|---------|
| `thinking-delta` | 思考链增量 | 推理模型产生 reasoning token |
| `tool-call` | 工具调用 | AI 决定调用 web_search |
| `tool-result` | 工具结果 | web_search 返回 |
| `answer-delta` | 最终答案增量 | AI 开始输出研究报告 |
| `done` | 完成 | 所有步骤结束，携带 usage |
| `error` | 错误 | 发生致命错误 |

## 系统提示词（服务端，用户不可见）

```
你是一名专业深度研究员。收到研究主题后，必须按三阶段工作：

**阶段一：研究规划**
在思考中制定检索策略：分析核心议题、列出 4-6 个具体搜索关键词、确定多角度研究方向。

**阶段二：多轮检索**
使用 web_search 工具执行多轮搜索（至少 5 次）：
- 每次搜索后评估结果，决定下一个搜索方向
- 对不同角度、不同时期、不同来源进行交叉验证
- 记录重要来源的标题和 URL

**阶段三：综合报告**
基于所有搜索结果，输出以下四章节结构的研究报告：

## 执行摘要
[2-3 句话概括核心发现]

## 主要发现
[分点列出 5-8 个关键发现，每点附简要说明]

## 来源与参考
[列出 5-10 个重要来源，格式：标题 — URL]

## 结论与建议
[基于研究给出 3-5 条可行建议]

重要：最终回答必须包含上述四个章节；所有主张必须有来源支撑；不得编造事实。
```

## 错误响应（与 `/api/agent/stream` 一致）

同 `playground-stream-extended.md` 错误表，额外增加：

| HTTP 状态 | tier | code | 中文说明 |
|-----------|------|------|---------|
| 504/Edge Timeout | retryable | STREAM_INTERRUPTED | 研究过程超时，请尝试更简短的研究主题 |

## 运行时约束

| 参数 | 值 | 说明 |
|------|-----|------|
| Runtime | Edge | 60s 硬上限 |
| maxSteps | 15 | 最多 15 轮工具迭代 |
| 工具 | web_search only | Tavily API，5条结果/次 |
| 工具超时 | 10s | 单次 web_search 超时后 tool-result 返回错误，继续后续步骤 |
