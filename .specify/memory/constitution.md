<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Status: MINOR amendment — added product identity section (is / is-not),
  Vercel AI SDK to locked tech stack, Edge Runtime constraint, IndexedDB persistence rule,
  and expanded red lines with scope-creep guards.

Modified principles:
  II.  Product Scope → added "AgentHub 是什么 / 不是什么" subsections
  III. Tech Stack → added Vercel AI SDK (locked), OpenRouter (default gateway, replaceable)
  V.   Red Lines → added 4 scope-creep red lines (auth, DB, long jobs, mobile)

Added constraints:
  - Edge Runtime hard limit: 60 seconds per AI call
  - Persistence: IndexedDB / localStorage only, no server-side DB
  - Structured output only: no free-chat LLM wrapper

Templates checked:
  ✅ .specify/templates/plan-template.md — Constitution Check aligns.
  ✅ .specify/templates/spec-template.md — aligns; scope-creep signals now explicit.
  ✅ .specify/templates/tasks-template.md — aligns.

Deferred TODOs: none
-->

# AgentHub Constitution

## 一、产品使命与目标用户

AgentHub 是 **浏览器端的 AI Agent 演练场 + 编排平台**。
用户在 Playground 跑流式 Agent，在 RunHistory 回看执行 Trace，
在 Settings 管理 API Key 与模型路由。
核心价值主张：让用户像安装 npm 包一样，找到、试用、接入 AI Agent。

### 目标用户（两类，缺一不可）

**独立开发者 / 个人技术人**
自己动手接入 AI Agent、搭建业务流程，追求快速上线。

**产品经理 / 运营人员**
懂业务、不写代码，但需要将 AI 能力接入自己的工作流，需要成本可见与结果可控。

### 解决的核心痛点

1. **Agent 太散、找不到靠谱的** — 没有统一的浏览、对比、试用入口
2. **接入成本高** — 每个 Agent 接口不同、文档参差不齐，需要大量胶水代码
3. **先买后悔** — 没有 Playground，只能付费部署后才知道效果好不好
4. **成本黑盒** — Token 用了多少、花了多少钱，运营和 PM 根本看不到

## 二、产品范围与 MVP 边界

### AgentHub 是什么

- **Agent 商店**：统一浏览、搜索、对比、试用精选 Agent 的入口
- **Playground**：在线流式运行 Agent，无需注册，实时查看 Token 消耗与费用
- **RunHistory**：回看每次执行的 Trace，追溯每一步工具调用与输出
- **Settings**：管理浏览器本地 API Key 与模型路由配置

### AgentHub 不是什么

以下方向一律不在本项目范围内，**AI 禁止擅自扩展**：

| ❌ 不是 | 说明 |
|---|---|
| 通用 LLM 包装（ChatGPT 套壳） | 只做结构化输出 Agent，拒绝自由聊天 |
| 多租户 SaaS | 无用户系统、无账单、无鉴权，Key 存浏览器 localStorage |
| 服务端长任务平台 | 所有 AI 调用走 Edge Runtime，硬上限 **60 秒** |
| 后端持久化系统 | 无数据库，运行记录只存浏览器 IndexedDB / localStorage |
| 移动端产品 | 只支持桌面浏览器 ≥ 1024px，不适配移动端 |

**Why**：边界不明 AI 会自动引入 Prisma / NextAuth / Redis / 移动端适配，
每个都偏离产品主线。
**How to apply**：看到 spec 里出现「用户登录 / 数据库 / 后台 Job / 移动端」，
MUST 在 `/speckit-clarify` 阶段打回，不得进入实现。

### 现阶段绝对核心（MVP）

- **Agent 商店**：浏览、搜索、按类别/能力/提供商筛选精选 Agent
- **Playground**：在线试用，无需注册，切换模型与参数，实时查看 Token 消耗与费用

### 后续扩展方向（现阶段不得喧宾夺主）

- Pipeline 可视化编排（参考 Dify/Coze 交互）
- 运行记录与 Trace 瀑布图
- 团队协作与预算管控

**凡不属于 MVP 核心的功能，MUST NOT 占用现阶段的架构决策与设计资源。**

## 三、技术栈（绝对锁定）

以下技术选择在本宪法有效期内不得替换。任何引入替代品的 PR 一律拒绝合并，
除非先通过宪法修订流程将对应条目升级为 MINOR 变更。

| 层 | 锁定选择 |
|---|---|
| 框架 | Next.js App Router（`src/app/` 目录） |
| AI SDK | **Vercel AI SDK**（唯一 AI 调用层，不得绕过直接调 OpenAI SDK） |
| 语言 | TypeScript 5，strict 模式 |
| UI 组件 | shadcn/ui + Radix UI |
| 图标 | lucide-react（唯一图标库） |
| 样式 | Tailwind CSS（CSS 自定义属性 token 系统） |
| 图表 | recharts |
| 表单 | react-hook-form |
| 日期工具 | date-fns |
| 通知 | sonner |

**AI 网关**：默认使用 **OpenRouter**（OpenAI-compatible 接口）。
允许替换为其他 OpenAI-compatible 网关，但不得引入非兼容协议的 AI 服务。

**运行时**：所有 AI 调用 MUST 使用 **Edge Runtime**，单次调用硬上限 **60 秒**。
禁止在 Node.js Runtime 中发起 AI 长任务。

**持久化**：无服务端数据库。运行记录 MUST 存储在浏览器 **IndexedDB 或 localStorage**。
用户配置（API Key、模型路由）MUST 存储在 **localStorage**。
在此之前 MUST NOT 提前封装 service 层或 repository 层。

## 四、UX 原则（MUST，不可妥协）

### 骨架屏优先

每个异步加载操作 MUST 展示 Skeleton 占位符。
禁止出现空白区域或单独使用旋转 spinner 作为唯一反馈。

### 流式输出（NON-NEGOTIABLE）

所有 AI 推理结果（Playground 发送、Pipeline 执行）MUST 逐字流式展示。
禁止等待推理完成后一次性渲染输出结果（批式加载）。

### 成本前置透明

Token 用量与预估费用 MUST 在用户发送请求之前即可见。
不得仅在请求完成后才告知用量。

### 错误中文可读

所有错误提示 MUST 是用户可理解的中文描述。
禁止将技术报错码、堆栈信息或英文原始错误直接暴露给用户。

### 平台目标：桌面端专属

AgentHub 是桌面端专属产品，**不做移动端适配**。
最小支持视口宽度：**1024px**。
禁止为移动端兼容性引入额外的布局逻辑或断点。

## 五、红线（绝对禁止，无任何例外）

以下行为在任何情况下均不允许出现，无论理由多充分：

| 红线 | 违规示例 |
|---|---|
| 引入锁定技术以外的 UI 组件库 | 引入 MUI、Ant Design、Chakra UI 等 |
| 使用无注释的裸 `any` 类型 | `const x: any = ...`（无说明注释） |
| 在 Pages Router 下创建新页面 | 在 `pages/` 目录新建文件 |
| 无真实需求提前抽象 service/repository 层 | 还在用 mock 时就封装 `AgentService` 类 |
| AI 推理结果批式加载后一次性展示 | `setOutput(await fetchAll())` |
| 引入用户认证 / 鉴权系统 | NextAuth、Clerk、JWT 登录等 |
| 引入服务端数据库 | Prisma、Drizzle、Redis、PostgreSQL 等 |
| 绕过 Vercel AI SDK 直接调用 AI 服务 | 直接 `import OpenAI` 发起调用 |
| 实现自由聊天 / 通用对话界面 | 无结构化 schema 的纯自由文本对话 |

**一旦发现红线违规，PR 审查者有权且有义务拒绝合并，不需说明其他理由。**

## 六、简洁原则

三处相似的代码比过早抽象更好。
只有当某个组件在 **三处或以上不同位置** 实际复用时，才允许提取为独立组件。
不为假想的未来需求设计，不引入不解决当前问题的设计模式。

## 治理

本宪法优先级高于所有其他约定、README 说明和口头共识。当发生冲突时，宪法胜出。

**修订流程**：
1. 开 PR，PR 描述中 MUST 写明修改理由与影响范围
2. 版本号按语义化规则递增：
   - **MAJOR**：删除或重定义现有原则（不兼容变更）
   - **MINOR**：新增原则或实质性扩展指引
   - **PATCH**：措辞澄清、错别字修正、非语义调整
3. PR 合并即生效，`LAST_AMENDED_DATE` 更新为合并日期

所有 PR 的审查者 MUST 验证提交内容不违反本宪法的任何条款。

**Version**: 1.1.0 | **Ratified**: 2026-04-30 | **Last Amended**: 2026-04-30
