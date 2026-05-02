# Feature Specification: 运行记录页（Run History）

**Feature Branch**: `004-run-history`  
**Created**: 2026-05-02  
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看运行历史列表 (Priority: P1)

用户在完成一次或多次 AI 对话后，进入"运行记录"页面，能看到所有历史调用按时间倒序排列，每行显示关键摘要信息，方便快速扫描。

**Why this priority**: 这是页面的核心入口，没有列表就没有后续功能。任何入口（Playground 或 Agent 详情页）的调用完成后，记录都应自动出现在此列表。

**Independent Test**: 在 Playground 发起一次对话，流式响应结束后，进入"运行记录"页，验证列表顶部出现该次调用记录，包含来源、状态、prompt 摘要、耗时和 token 总数。

**Acceptance Scenarios**:

1. **Given** 用户完成了一次 Playground 调用，**When** 进入运行记录页，**Then** 列表顶部显示该条记录，来源标识为"Playground"，状态为"成功"，显示 prompt 前 60 字、总耗时和 token 总数
2. **Given** 用户完成了一次 Agent 详情页调用（如深度研究助手），**When** 进入运行记录页，**Then** 列表显示来源标识为"深度研究助手"
3. **Given** 列表已有超过 50 条记录，**When** 用户滚动到底部，**Then** 自动加载下一页记录（cursor-based 分页）
4. **Given** 一次调用因错误中止，**When** 查看列表，**Then** 该记录显示失败状态图标（红色 X）
5. **Given** 从未发起过任何调用，**When** 进入运行记录页，**Then** 显示空状态提示："空空如也，先去 Playground 聊一次吧"，并提供跳转按钮

---

### User Story 2 - 查看单次运行详情与 Trace 瀑布图 (Priority: P1)

用户点击某条运行记录，右侧展示该次调用的完整执行过程：Trace 瀑布图展示各阶段耗时，Tab 面板分别显示原始输入、最终输出和元数据。

**Why this priority**: 这是"排查某次调用为什么慢""某个工具调用失败了"的核心诉求，与列表同等重要。

**Independent Test**: 选中一条含工具调用的运行记录，验证瀑布图显示 thinking / tool-call / tool-result / answer 各阶段 bar，点击 bar 展开显示该 span 的 input/output 详情，Tab 切换正确显示原始 prompt 和最终答案。

**Acceptance Scenarios**:

1. **Given** 用户选中一条通用 Agent 运行记录，**When** 查看右侧详情，**Then** 瀑布图按时间轴显示所有 span，多轮工具调用按 round 分组，子 span 相对父 round 缩进显示
2. **Given** 某条记录有 3 次 web_search 调用，**When** 查看瀑布图，**Then** 每个 tool-call 和对应的 tool-result 配对显示，颜色区分 span 类型
3. **Given** 某 span 的耗时 < 200ms，**When** 显示瀑布图，**Then** 该 bar 使用绿色；200–1000ms 用黄色；> 1000ms 用红色
4. **Given** 用户点击一个 tool-call span，**When** 展开，**Then** 显示工具名称、输入参数和返回结果（或错误信息）
5. **Given** 是一次 Simple Agent 调用（无工具、无 thinking），**When** 查看瀑布图，**Then** 仅显示一条 answer span，缺失的 span 类型不显示（不显示空行）
6. **Given** 用户切换到"输入"Tab，**When** 查看，**Then** 显示完整的原始 prompt 文本
7. **Given** 用户切换到"元数据"Tab，**When** 查看，**Then** 显示模型名称、总 token 数（输入/输出分列）、总耗时

---

### User Story 3 - 筛选运行记录 (Priority: P2)

用户可以按状态、模型或时间范围过滤记录，快速定位特定类型的调用。

**Why this priority**: 当记录积累较多时，筛选是快速找到目标记录的关键手段。

**Independent Test**: 使用"状态：失败"筛选，验证列表只显示失败状态的记录；切换到"状态：全部"，验证所有记录重新出现。

**Acceptance Scenarios**:

1. **Given** 用户选择状态筛选"失败"，**When** 应用筛选，**Then** 列表只显示 status 为 failed 的记录
2. **Given** 用户选择特定模型（如"deepseek-v4-pro"），**When** 应用筛选，**Then** 列表只显示使用该模型的记录
3. **Given** 用户选择时间范围"最近 7 天"，**When** 应用筛选，**Then** 列表只显示 7 天内的记录
4. **Given** 多个筛选条件同时选中，**When** 应用，**Then** 取交集展示结果
5. **Given** 筛选后无匹配记录，**When** 显示列表，**Then** 显示"没有符合条件的记录"提示

---

### User Story 4 - 删除运行记录 (Priority: P3)

用户可以删除不需要的历史记录，包括单条删除和一键清空全部。

**Why this priority**: 数据管理能力，优先级低于核心浏览功能，但本地存储积累后有必要。

**Independent Test**: 对一条记录执行删除操作，验证该记录从列表消失且不可通过 URL 直接访问；执行清空全部，验证列表进入空状态。

**Acceptance Scenarios**:

1. **Given** 用户在某条记录上触发删除，**When** 确认删除，**Then** 该记录从列表移除，右侧详情区域重置
2. **Given** 用户点击"清空全部"，**When** 二次确认后，**Then** 所有记录删除，页面进入空状态
3. **Given** 用户误触删除，**When** 取消确认弹窗，**Then** 记录保持不变

---

### Edge Cases

- 如果流式响应中途被用户主动停止（点击"停止生成"），记录仍然保存，状态标记为"中断"，已收到的部分输出保留。
- 如果 IndexedDB 写入失败（如存储空间不足或浏览器限制），该次调用不产生历史条目（静默失败，不影响 AI 对话主流程）。
- DeepResearch 最多产生 15 轮工具调用，瀑布图中 span 条目可能较多，需支持垂直滚动。
- 超长 prompt（> 200 字）在列表中只显示前 60 字摘要，详情 Tab 显示完整内容。
- 若某次调用 token 用量数据缺失（部分模型不返回），元数据中对应字段显示"—"。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须在任意 AI 调用（Playground 无工具、Playground 有工具、通用 Agent、DeepResearch Agent、Simple Agent）的流式响应完成后，自动将本次调用记录持久化到本地存储
- **FR-002**: 系统必须记录每条运行的来源标识：来自 Playground 页面标识为"Playground"，来自 Agent 详情页标识为该 Agent 的名称
- **FR-003**: 运行记录列表必须按创建时间倒序展示，每条显示：来源标识、状态图标（成功/失败/中断）、prompt 摘要（前 60 字）、总耗时、token 总数
- **FR-004**: 系统必须支持 cursor-based 分页，每次加载最多 50 条记录，支持无限滚动加载更多；列表数据仅在页面加载/导航时获取，不做实时轮询刷新
- **FR-005**: 系统必须支持按状态（成功/失败/中断/全部）、模型名称、时间范围三个维度筛选记录，多维度取交集；时间范围选项为：全部 / 今天 / 最近 7 天 / 最近 30 天
- **FR-006**: 点击某条运行记录后，右侧必须展示该次调用的 Trace 瀑布图，横轴为时间，按 span 类型用不同颜色区分（thinking / tool-call / tool-result / answer）
- **FR-007**: 瀑布图中每个 span 可点击展开，展开后显示该 span 的输入内容、输出内容（或错误信息）
- **FR-008**: 多轮工具调用必须按 round 顺序排列，同一 round 的子 span 相对缩进展示，每层缩进 24px
- **FR-009**: Span 耗时必须以颜色区分：< 200ms 绿色、200–1000ms 黄色、> 1000ms 红色
- **FR-010**: 右侧详情区域必须提供三个 Tab：「输入」显示完整原始 prompt，「输出」显示完整最终答案，「元数据」显示模型、token 用量（输入/输出/总计）、总耗时
- **FR-011**: 对于无 thinking 或无工具调用的运行（如 Simple Agent），瀑布图只显示存在的 span 类型，不显示空行占位
- **FR-012**: 系统必须支持删除单条运行记录（需二次确认）
- **FR-013**: 系统必须支持一键清空全部运行记录（需二次确认）
- **FR-014**: 无记录时显示空状态提示文案，并提供跳转至 Playground 的快捷入口

### Key Entities

- **Run（运行）**: 代表一次完整的 AI 调用，包含来源、使用模型、状态、总耗时、总 token 数、原始 prompt、最终答案、创建时间
- **Span（执行片段）**: 代表一次调用中的单个执行阶段，归属于某个 Run，包含类型（thinking / tool-call / tool-result / answer）、所属轮次、排列顺序、开始时间、持续时长、输入内容（上限 10,000 字符）、输出内容（上限 10,000 字符）、错误信息（可选）、工具名称（工具类型专有）、工具调用 ID（用于关联 tool-call 与 tool-result）；超出上限的内容在存储时截断并附加"…内容已截断"标记

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 任意 AI 调用完成后，运行记录在 3 秒内出现在列表顶部（正常网络、本地存储环境）
- **SC-002**: 覆盖全部 5 类调用入口（Playground 无工具、Playground 有工具、通用 Agent、DeepResearch Agent、Simple Agent），每类均可产生可查看的运行记录
- **SC-003**: 包含 15 轮工具调用的 DeepResearch 运行记录，瀑布图能完整显示所有 span，无截断或渲染错误
- **SC-004**: 筛选操作响应时间 < 500ms（本地存储、千条记录以内）
- **SC-005**: 用户可在 2 次点击内完成删除单条记录操作（1 次触发删除 + 1 次确认）

## Clarifications

### Session 2026-05-02

- Q: 用户正在浏览运行记录页时，新完成的 AI 调用是否应自动刷新列表？ → A: 否，仅在导航进入页面时加载，不做实时刷新/轮询
- Q: 存储 span 的 input/output 内容时，是否对单个字段设置字符上限？ → A: 上限 10,000 字符，超出截断并标注"…内容已截断"
- Q: 时间范围筛选应提供哪些选项？ → A: 全部 / 今天 / 最近 7 天 / 最近 30 天（四个固定选项，不含自定义日期范围）

## Assumptions

- 本功能不涉及用户认证系统，不存在用户隔离，所有记录在本设备本地共享
- 记录数据存储在本地，不跨设备同步
- 无自动数据保留期限，记录持续积累直到用户手动删除
- 如果流式响应被用户主动中断，仍会产生一条状态为"中断"的记录，保留已收到的部分内容
- 如果前端向本地存储写入失败（极少情况），静默跳过，不影响 AI 对话主流程
- 计时精度依赖客户端时钟，各 span 的开始时间和耗时为客户端接收到对应流式事件的时刻，非服务端精确执行时间
- 移动端响应式适配不在本期范围内
- 瀑布图的最大嵌套深度为 5 层（与 DeepResearch 最多 15 步不矛盾，depth 指 span 类型层次非步骤数）
