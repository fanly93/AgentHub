# 技术研究：Playground 工具调用增强

**日期**：2026-04-30 | **功能分支**：`002-playground-enhanced`

---

## 研究结论 1：Vercel AI SDK `streamText` 多步工具调用模式

**决策**：使用 `streamText({ model, tools, maxSteps: 8, system, messages })` 实现 ReAct 多轮循环。

**核心 API**：
- `tools` 参数接受 `{ [toolName]: { description, parameters: ZodSchema, execute: async fn } }` 对象
- `maxSteps` 控制最大工具调用轮数，防止无限循环（直接对应 FR-007）
- `fullStream` 是 `AsyncIterable<StreamPart>`，按事件顺序 yield：
  - `{ type: 'reasoning', reasoning: string }` — 推理模型思考链（DeepSeek V4）
  - `{ type: 'tool-call', toolCallId, toolName, args }` — AI 请求调用工具
  - `{ type: 'tool-result', toolCallId, toolName, result }` — execute 函数返回结果后
  - `{ type: 'text-delta', textDelta }` — 最终文字答案流式输出
  - `{ type: 'finish', finishReason, usage }` — 流结束，含 token 用量
  - `{ type: 'error', error }` — 执行错误
- SDK 自动管理多步消息历史（tool-call / tool-result 注入），无需手工拼接

**理由**：宪法锁定 Vercel AI SDK；`maxSteps` 参数语义直接映射 spec 约束；SDK 处理 provider 差异（OpenAI / Anthropic / Google / DeepSeek），减少跨模型兼容性代码。

**备选被拒**：手写 while 循环 + messages 数组 — 需要手动处理每个 provider 的 tool_call 消息格式差异，复杂且不稳定。

---

## 研究结论 2：NDJSON 流式响应设计

**决策**：`/api/agent/stream` 返回 `ReadableStream`，Content-Type `application/x-ndjson`，每行一个 `AgentStreamEvent` JSON 对象。

**实现模式**：

```typescript
// route.ts 伪代码（描述结构，非最终代码）
const stream = new ReadableStream({
  async start(controller) {
    const enqueue = (event: AgentStreamEvent) =>
      controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));

    for await (const part of result.fullStream) {
      if (part.type === 'reasoning') enqueue({ type: 'thinking-delta', delta: part.reasoning });
      if (part.type === 'tool-call') enqueue({ type: 'tool-call', callId: part.toolCallId, name: part.toolName, arguments: part.args });
      if (part.type === 'tool-result') enqueue({ type: 'tool-result', callId: part.toolCallId, name: part.toolName, result: part.result });
      if (part.type === 'text-delta') enqueue({ type: 'answer-delta', delta: part.textDelta });
      if (part.type === 'finish') enqueue({ type: 'done', usage: part.usage });
    }
    controller.close();
  }
});
return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
```

**前端解析模式**：

```typescript
// useAgentStream 伪代码（描述结构，非最终代码）
let lineBuffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  lineBuffer += decoder.decode(value, { stream: true });
  const lines = lineBuffer.split('\n');
  lineBuffer = lines.pop() ?? ''; // 保留不完整的最后一行
  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as AgentStreamEvent;
    dispatch({ type: 'event', event });
  }
}
```

**理由**：NDJSON 比 SSE 解析更简单（无 `data:` 前缀）；不需要 EventSource API；与现有 `useStructuredStream` 的 text stream 格式明确区分，不混淆。

---

## 研究结论 3：write_file 安全校验策略

**决策**：`/api/tools/write-file` 使用三层防护：正则白名单 + `path.basename` + 路径前缀校验。

**校验流程**：

```text
1. 正则白名单：filename 必须匹配 /^[a-zA-Z0-9_\-]+$/（仅允许字母、数字、下划线、连字符）
2. path.basename：去除任何路径部分，仅保留文件名
3. 构造目标路径：targetPath = path.resolve(process.cwd(), 'downloads', filename + '.txt')
4. 前缀校验：确认 targetPath.startsWith(downloadsDir)，防止 resolve 后逃逸
```

**文件大小限制**：读取 content 后校验 `Buffer.byteLength(content, 'utf-8') <= 1_048_576`（1MB）。

**目录创建**：`fs.mkdir(downloadsDir, { recursive: true })` 在写入前确保目录存在。

**理由**：path traversal 是文件写入操作的最高优先级安全风险；三层防护形成纵深防御；白名单正则优于黑名单，更安全。

---

## 研究结论 4：calculate 工具安全执行策略

**决策**：使用 `mathjs` 库的 `evaluate()` 函数，禁止使用 `Function()` 或 `eval()`。

**支持的表达式**：四则运算（+、-、×、÷）、乘方（^）、常用函数（`sqrt`、`abs`、`round`、`sin`、`cos`、`log`）、括号优先级。

**安全约束**：
- `mathjs.evaluate()` 在沙箱环境中运行，不访问全局变量、不执行任意代码
- 表达式长度限制 500 字符
- 执行超时：使用 Promise.race + setTimeout 实现 5s 超时

**理由**：直接使用 `eval()` 是严重安全漏洞；mathjs 是专为数学表达式求值设计的库，安全且功能完整。

---

## 研究结论 5：DeepSeek reasoning token 兼容性

**决策**：`fullStream` 中 `reasoning` 类型事件对应 DeepSeek V4 的 thinking chain；ThinkingCard 由事件驱动，不维护模型白名单。

**兼容策略**：
- DeepSeek V4 Flash / Pro 通过 `@ai-sdk/openai` + `baseURL: 'https://api.deepseek.com/v1'` 接入
- `reasoning` 事件在其他模型不会出现（OpenAI、Anthropic、Google、Qwen 均不产生）
- 前端仅检查"是否有 thinking-delta 事件到达"，而非"当前模型是否在推理模型列表"
- 好处：SDK 升级后只需更新事件类型映射，不需要维护模型列表

**理由**：事件驱动比模型白名单更健壮；新增推理模型时无需改前端代码。

---

## 研究结论 6：sessionStorage Agent 执行状态持久化

**决策**：Agent 模式执行完成后，将完整执行状态存入 `sessionStorage('agent:last-execution')`，key 格式与现有 `playground:last-response` 平行。

**存储内容**：`{ thinking, toolCalls, toolResults, answer, model, selectedTools, prompt, savedAt }`

**恢复逻辑**：`playground/page.tsx` mount 时检测 sessionStorage，若存在则同时检查是否有 `agent:last-execution`（Agent 模式）或 `playground:last-response`（普通模式），按最后保存时间决定恢复哪个。

**理由**：FR-012 要求 sessionStorage 持久化；与现有 `playground-session.ts` 的模式保持一致，不引入新的 service 层（宪法禁止过早抽象）。
