# Data Model: Agent 商店详情页 Playground 实现

**Date**: 2026-05-01 | **Feature**: 003-store-agent-playground

## 扩展实体：Agent

### 现有字段（不变）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | `agent-${number}` 格式唯一标识 |
| `name` | `string` | Agent 展示名称 |
| `author` | `string` | 作者（`@username` 或 `"官方"`） |
| `category` | `string` | 品类（10 种之一） |
| `provider` | `string` | 模型提供商 |
| `capabilities` | `string[]` | 能力标签列表 |
| `description` | `string` | 简介文本 |
| `price` | `string` | 价格（`"免费"` 或 `"$X/月"`） |
| `runs` | `number` | 运行次数 |
| `rating` | `number` | 评分 |
| `emoji` | `string?` | 可选表情符号 |

### 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `agentType` | `'general' \| 'deepresearch' \| 'simple'` | `'simple'` | 决定详情页渲染哪种 Playground 面板 |
| `defaultModel` | `ModelId?` | `undefined` | 可选预设模型；`undefined` 时使用 `DEFAULT_MODEL` |

> `categoryPrompt` 不存储在 Agent 实体中，通过 `CATEGORY_PROMPTS[agent.category]` 运行时查找。

### TypeScript 类型定义

```typescript
// src/lib/mock-data.ts

export type AgentType = 'general' | 'deepresearch' | 'simple';

export type Agent = {
  id: string;
  name: string;
  author: string;
  category: string;
  provider: string;
  capabilities: string[];
  description: string;
  price: string;
  runs: number;
  rating: number;
  emoji?: string;
  agentType: AgentType;          // NEW
  defaultModel?: ModelId;         // NEW
};
```

---

## 静态映射：CATEGORY_PROMPTS

```typescript
// src/lib/mock-data.ts

export const CATEGORY_PROMPTS: Record<string, string> = {
  '写作助手':   '你是一个专业的写作助手，擅长帮助用户改善文字表达、润色文章、撰写各类文体内容。请给出清晰、有条理的建议。',
  '代码生成':   '你是一个专业的代码生成工具，擅长根据需求生成高质量、可运行的代码，并提供简洁的实现说明。',
  '数据分析':   '你是一个专业的数据分析助手，擅长解读数据规律、提炼洞察，并给出可执行的行动建议。',
  '图像理解':   '你是一个专业的图像理解助手，擅长描述和分析图像内容，提供精确的视觉信息解读。',
  '客户支持':   '你是一个专业的客户支持助手，擅长耐心解答问题、处理用户反馈，始终保持友好和准确的态度。',
  '翻译润色':   '你是一个专业的翻译和语言润色专家，擅长多语言互译，保持原文风格和语义准确性。',
  '研究调研':   '你是一个专业的研究调研助手，擅长整合信息、总结文献，提供有据可查的深度见解。',
  '运营营销':   '你是一个专业的运营营销助手，擅长撰写营销文案、策划活动方案，提供有效的用户增长建议。',
  '教育辅导':   '你是一个专业的教育辅导助手，擅长以通俗易懂的方式解释复杂概念，帮助学习者掌握知识。',
  '生产力工具': '你是一个专业的生产力助手，擅长任务分解、流程梳理，帮助用户高效完成工作目标。',
};
```

---

## 新增实体：DeepResearch 请求/响应

### DeepResearch API 请求体

```typescript
// src/shared/schemas/deepresearch.ts（新增）

import { z } from 'zod';
import { ModelIdSchema } from './playgroundResponse';

export const DeepResearchRequestSchema = z.object({
  model: ModelIdSchema,
  prompt: z.string().min(1).max(50000),
});

export type DeepResearchRequest = z.infer<typeof DeepResearchRequestSchema>;
```

响应事件类型复用现有 `AgentStreamEvent`（`src/shared/schemas/agentStream.ts`），无需新增。

---

### Extended Playground Stream 请求体

```typescript
// src/app/api/playground/stream/route.ts（修改现有 RequestSchema）

const RequestSchema = z.object({
  model: ModelIdSchema,
  prompt: z.string().min(1).max(50000),
  agentSystemPrompt: z.string().max(2000).optional(),  // NEW
});
```

---

## 面板组件状态模型

### SimpleAgentPanel 本地状态

```typescript
type SimpleAgentState = {
  isLoading: boolean;
  response: PlaygroundResponse | null;  // 复用现有类型
  error: { message: string; code: string; retryAfterMs?: number } | null;
};
```

### GeneralAgentPanel

无独立状态——状态完全由内嵌的 `ResponseArea`（通过 ref）管理，与独立 Playground 页面行为完全一致。

### DeepResearchPanel 本地状态

```typescript
// 复用 AgentExecutionState（来自 useAgentStream hook）
// 无需新定义
```

---

## Session 持久化映射

| 面板类型 | sessionStorage Key | 存储函数 | 恢复函数 |
|---------|-------------------|---------|---------|
| Simple | `"playground:last-response"` | `saveSession(response, model, prompt)` | `restoreSession()` |
| General | `"agent:last-execution"` | `saveAgentSession(record)` | `restoreAgentSession()` |
| DeepResearch | `"agent:last-execution"` | `saveAgentSession(record)` | `restoreAgentSession()` |

> General 和 DeepResearch 共用同一个 key，后写覆盖前写（单 key 设计，符合现有约定）。
