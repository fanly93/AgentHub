# API Contract: POST /api/playground/stream（扩展）

**Feature**: 003-store-agent-playground | **Date**: 2026-05-01  
**变更类型**: 向后兼容扩展（现有调用不受影响）

## 变更摘要

在现有 RequestSchema 新增 **可选字段** `agentSystemPrompt`。服务端将其拼接至 SYSTEM_PROMPT 的角色定义前，用于 Simple Agent 注入品类专属角色描述。

## Request

### Method & URL
```
POST /api/playground/stream
```

### Headers
```
Content-Type: application/json
X-Provider-Api-Key: <optional, 覆盖环境变量中的 Key>
```

### Body Schema

```typescript
{
  model: ModelId;                    // 必填，同现有
  prompt: string;                    // 必填，1-50000 字，同现有
  agentSystemPrompt?: string;        // 新增可选，最多 2000 字
}
```

### 字段说明

| 字段 | 必填 | 类型 | 约束 | 说明 |
|------|------|------|------|------|
| `model` | ✅ | `ModelId` | 枚举值 | 同现有 |
| `prompt` | ✅ | `string` | 1–50000 字 | 同现有 |
| `agentSystemPrompt` | ❌ | `string` | 最多 2000 字 | Simple Agent 品类角色描述，缺省时行为与现有完全一致 |

## Response

响应格式 **完全不变**：text/plain 流，内容为递增 JSON 字符串（`parsePartialJson` 解析）。

```typescript
// PlaygroundResponse（现有，不变）
{
  thinking?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  answer: string;           // Markdown，Simple Agent 只展示此字段
  metadata?: { ... };
}
```

## 服务端处理逻辑（伪代码）

```typescript
// 现有 SYSTEM_PROMPT 结构
const systemPrompt = agentSystemPrompt
  ? `${agentSystemPrompt}\n\n${SYSTEM_PROMPT}`   // 角色描述拼接在 JSON 格式约束前
  : SYSTEM_PROMPT;                                 // 缺省：行为完全不变
```

## 错误响应（不变）

| HTTP 状态 | tier | code | 中文说明 |
|-----------|------|------|---------|
| 400 | fatal | INVALID_REQUEST | 请求参数无效 |
| 400 | fatal | CONTEXT_EXCEEDED | 输入内容过长，请缩短后重试 |
| 401/403 | fatal | INVALID_KEY | API Key 无效，请前往设置重新配置 |
| 422 | fatal | UNSUPPORTED_MODEL | 不支持的模型 |
| 429 | retryable | RATE_LIMITED | 已触发速率限制，X 秒后可重试 |
| 503/502 | retryable | MODEL_UNAVAILABLE | 模型暂时不可用，请稍后重试 |

## 向后兼容保证

- 现有 `/playground` 页面的所有调用不传 `agentSystemPrompt` → 行为 100% 不变
- `agentSystemPrompt` 字段的 Zod `.optional()` 声明确保额外字段不触发验证错误
