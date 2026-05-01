# Phase 0 Research: Agent 商店详情页 Playground 实现

**Date**: 2026-05-01 | **Feature**: 003-store-agent-playground

## 决策汇总

### Decision 1: Simple Agent — 复用现有路由，扩展 `agentSystemPrompt`

**选择**: 扩展 `/api/playground/stream` 接受可选 `agentSystemPrompt?: string` 字段，服务端将其拼接至现有 SYSTEM_PROMPT 的角色定义前。

**理由**: `useStructuredStream` hook 通过 `body: JSON.stringify(input)` 透传全部输入字段，无需修改 hook 本身。服务端仅需在 RequestSchema 加一个可选字段，现有 Playground 调用不传该字段则行为 100% 不变。零新增路由，零 hook 改动。

**备选被拒**:
- 新建 `/api/simple/stream`：额外路由维护成本，且 simple 模式实质上就是无工具的 playground 模式，功能重复。
- 新建 `useSimpleStream` hook：hook 层逻辑与 `useStructuredStream` 完全一致，重复代码。

---

### Decision 2: DeepResearch — 独立路由 `/api/deepresearch/stream`

**选择**: 新建独立 Edge Runtime 路由，采用与 `/api/agent/stream` 相同的 NDJSON 协议。`web_search` 工具硬编码为唯一工具，`maxSteps: 15`，注入研究专属系统提示词。

**理由**: DeepResearch 的系统提示词与通用 Agent 有本质区别（三阶段研究流程 vs. 通用助手）；强制 15 步与工具固定是产品特性，不应暴露给用户控制；复用相同 NDJSON 协议意味着前端可以直接复用 `useAgentStream` hook，零成本接入。

**备选被拒**:
- 复用 `/api/agent/stream` 加 `agentType` 参数：导致路由内部分支复杂度上升；DeepResearch 的 maxSteps=15 可能拖慢其他 Agent；职责混合不符合单一职责原则。

---

### Decision 3: General Agent 面板 — 包装现有 `ResponseArea`

**选择**: `GeneralAgentPanel` 组件内部直接组合 `ModelSelector` + `ToolPanel` + `ResponseArea`（现有组件），复用全部状态逻辑。

**理由**: 现有 `ResponseArea` 通过 ref 暴露 `submit/stop` 接口，天然支持外部调用；`ToolPanel` 已是独立组件；宪法"三处相似才抽象"原则——该组合仅在详情页出现一次，直接使用无需再封装。

**备选被拒**:
- 重写 General Agent 流式逻辑：与 playground 功能完全重复，违反"不重复"原则。
- 将 playground page.tsx 整体移入详情页：耦合过高，playground 页面有独立状态（selectedTools 等）。

---

### Decision 4: CategoryPrompt 静态映射

**选择**: 在 `mock-data.ts` 定义 `CATEGORY_PROMPTS: Record<string, string>` 映射，10 个品类各一条系统提示词，Agent 数据不直接存储 prompt，运行时按 `agent.category` 查找。

**理由**: 同品类下所有 Agent 的角色定位相同（都是"写作助手"），无需为每个 Agent 单独维护 prompt；后续若 Agent 数据从 API 获取，只需确保 category 字段存在即可复用映射。

**备选被拒**:
- 每个 Agent 存储独立 `categoryPrompt` 字段：25 个 Agent 需手写 25 条提示词，其中大多数重复；维护成本高。

---

### Decision 5: `useStructuredStream` 不修改，由 SimpleAgentPanel 传入完整 input

**选择**: `useStructuredStream<PlaygroundResponse, { model: ModelId; prompt: string; agentSystemPrompt?: string }>` 泛型调用。hook 内部 `JSON.stringify(input)` 会自动携带 `agentSystemPrompt` 字段，API 自动接收。

**理由**: hook 设计为泛型 INPUT，调用方负责定义输入类型；服务端 Zod schema 加 `.optional()` 字段即可，无需改动任何现有调用路径。

---

### Decision 6: DeepResearch 系统提示词结构

研究显示三阶段 CoT 提示是深度研究场景的最佳实践：

```
阶段一：规划（Thinking）→ 阶段二：多轮 web_search（Tools）→ 阶段三：综合报告（Answer）
```

输出格式强制要求四个 Markdown 章节：`## 执行摘要` / `## 主要发现` / `## 来源与参考` / `## 结论与建议`。至少 5 次搜索，最多 15 次（受 maxSteps 约束）。

---

### Decision 7: 字符预警阈值与 sessionStorage 复用

- 字符预警阈值：4000 字（与现有 playground `CHAR_WARN` 常量一致，无需新增配置）
- sessionStorage：三种面板复用现有 `playground-session.ts` 的 `saveSession` / `saveAgentSession` 函数
  - General → `saveAgentSession`
  - DeepResearch → `saveAgentSession`
  - Simple → `saveSession`（仅存最后一次 answer）
