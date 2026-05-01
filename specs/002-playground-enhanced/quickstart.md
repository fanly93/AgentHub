# 快速上手：Playground 工具调用增强

**功能分支**：`002-playground-enhanced`

---

## 环境配置

在 `agenthub/.env.local` 中添加以下环境变量（非必填，缺失时对应工具在 ToolResultCard 报错）：

```bash
# 联网搜索工具（web_search）
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxx

# 天气查询工具（get_weather）
OPENWEATHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 模型 API Keys（至少配置一个）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
```

> `get_current_time`、`calculate`、`write_file` 不需要额外的 API Key。

---

## 集成场景 1：工具调用基本流程验证

**目的**：验证 ToolCallCard + ToolResultCard + AnswerCard 按顺序实时渲染。

**操作**：
1. 打开 `/playground`，展开「工具」面板
2. 勾选 `calculate`
3. 输入 Prompt：「请计算 99 × 88 的结果，并解释计算过程」
4. 点击「发送」

**预期结果**：
- 响应区先出现 `ToolCallCard`（工具名：calculate，参数：`{ expression: "99 * 88" }` 或类似）
- 随后出现 `ToolResultCard`（结果：8712）
- 最后出现 `AnswerCard`（包含计算过程解释）

**不应出现**：ThinkingCard（非推理模型时）、多余的空白卡片

---

## 集成场景 2：推理模型 ThinkingCard 渲染

**目的**：验证 DeepSeek V4 的 thinking chain 触发 ThinkingCard 显示。

**操作**：
1. 选择模型：`deepseek-v4-flash` 或 `deepseek-v4-pro`
2. 勾选 `get_current_time`
3. 输入 Prompt：「现在是几点？请详细说明你的推理过程」
4. 点击「发送」

**预期结果**：
- 首先出现 `ThinkingCard`（流式渲染思考内容）
- 随后出现 `ToolCallCard`（get_current_time）
- 再出现 `ToolResultCard`（当前时间）
- 最后出现 `AnswerCard`

---

## 集成场景 3：API Key 缺失时的错误处理

**目的**：验证工具执行失败时 ToolResultCard 展示中文错误，流不中断。

**前提**：`.env.local` 中不配置 `TAVILY_API_KEY`。

**操作**：
1. 勾选 `web_search`
2. 输入 Prompt：「搜索最新的 AI 新闻」
3. 点击「发送」

**预期结果**：
- `ToolCallCard` 正常出现（web_search + 搜索关键词）
- `ToolResultCard` 显示：「web_search 工具未配置 API Key，请在 .env.local 中添加 TAVILY_API_KEY」
- `AnswerCard` 出现（AI 基于已有知识给出答案，不静默失败）

---

## 集成场景 4：write_file 写入本地文件

**目的**：验证 write_file 工具写入 downloads/ 目录，ToolResultCard 显示文件路径。

**操作**：
1. 勾选 `write_file`
2. 输入 Prompt：「生成一份关于 AI Agent 的 300 字介绍，并将内容保存为文件 ai_agent_intro」
3. 点击「发送」

**预期结果**：
- `ToolCallCard`：工具名 write_file，参数包含 filename 和 content
- `ToolResultCard`：显示「文件已保存到 .../downloads/ai_agent_intro.txt」
- `AnswerCard`：确认文件已保存
- 本地文件 `agenthub/downloads/ai_agent_intro.txt` 实际存在且内容正确

---

## 集成场景 5：无工具模式向后兼容

**目的**：验证不勾选工具时，行为与 001-playground 实现完全一致，零回归。

**操作**：
1. 确保工具面板折叠且所有 Checkbox 未勾选
2. 输入 Prompt：「用三句话介绍一下量子计算」
3. 点击「发送」

**预期结果**：
- 仅出现 `AnswerCard`（无 ToolCallCard / ToolResultCard / ThinkingCard）
- 响应调用 `/api/playground/stream`（非 `/api/agent/stream`）
- 行为与当前 playground 页完全相同

---

## 集成场景 6：多步 ReAct 循环

**目的**：验证 AI 连续多步工具调用时，卡片按顺序追加渲染。

**操作**：
1. 同时勾选 `web_search` + `get_weather`
2. 输入 Prompt：「查询今天北京的天气，并搜索本周北京的户外活动推荐，综合两个信息给出周末活动建议」
3. 点击「发送」

**预期结果**：
- 多个 ToolCallCard + ToolResultCard 依次出现（可能 2–3 轮）
- 每张 ToolResultCard 在对应 ToolCallCard 之后出现
- 最终 AnswerCard 综合所有工具结果给出建议
- 所有步骤记录保留在响应区（不清除）

---

## 集成场景 7：执行期间工具面板禁用

**目的**：验证 AI 执行期间 ToolPanel 和 ModelSelector 均禁用。

**操作**：
1. 勾选 `web_search`
2. 发送 Prompt
3. 在 AI 执行过程中（流未结束），尝试勾选/取消其他工具复选框

**预期结果**：
- 工具面板所有 Checkbox 处于禁用态（无法交互）
- ModelSelector 同样处于禁用态
- 流结束后，工具面板和 ModelSelector 恢复可用

---

## 集成场景 8：sessionStorage 恢复

**目的**：验证 Agent 执行结果在同 Tab 刷新后可恢复。

**操作**：
1. 完成一次 Agent 执行（含 ToolCallCard）
2. 刷新页面（同 Tab）

**预期结果**：
- 响应区恢复上一次的完整执行内容（ThinkingCard / ToolCallCard / ToolResultCard / AnswerCard）
- Prompt 输入框恢复上一次的 Prompt 内容
- 模型选择器恢复上一次选择的模型
