---
description: 用 Zod 校验环境变量，让配错 key 在 pnpm build 时就报错，不等 runtime 崩给你看
argument-hint: "[可选：直接列出变量名，例如：OPENAI_API_KEY, NEXT_PUBLIC_APP_URL]"
allowed-tools: Read, Write, Bash
---

## 第 1 步：扫描项目现状

先让我看看你的项目里用了哪些环境变量，不用你手动整理。

我会依次做以下 3 件事：

1. **读 `.env` / `.env.local` / `.env.example`** — 找出所有已声明的变量
2. **读 `next.config.ts`** — 找出里面的 `process.env.XXX` 引用
3. **grep 全项目代码** — 找出所有 `process.env.` 的访问位置，包括 server / client 侧

扫描完成后，我会告诉你：

> 你的项目用到了 **N** 个环境变量，其中 **M** 个是 server-only（机密，不能进 bundle），**K** 个是 `NEXT_PUBLIC_` 前缀（会打包进前端代码）。

如果你已经在调用时直接列出了变量名，我会跳过扫描，直接用你给的列表进入第 2 步。

---

## 第 2 步：分类与校验规则

> **如果你已经告诉我 server 端和 client 端各有哪些变量，我会直接按变量名套默认规则生成，不再停下来问。所有默认决策都会在 `env.ts` 里写行内注释标明，方便你改。**

我会按变量名自动判断校验规则：

| 变量名特征 | 默认处理 |
|-----------|---------|
| 含 `_API_KEY` / `_SECRET` / `_TOKEN` | 必填 + `startsWith` 前缀校验（OpenAI→`sk-`，Anthropic→`sk-ant-`，DeepSeek→`sk-`，不认识的 provider 用 `.min(10)`） |
| 含 `_URL` | 必填 + `z.string().url()` |
| 含 `_PORT` / `_TIMEOUT` / `_LIMIT` | `z.coerce.number()`（环境变量天然是字符串，coerce 自动转数字） |
| 以 `NEXT_PUBLIC_` 开头 | 放 client schema，不进 server schema |
| 来自 `.env.example` 但你没提 | 带进 schema，行内注释标"来自 .env.example" |
| 没说必选/可选 | 一律当必填（宁严勿松；注释标"如需可选改为 .optional()"） |

只有你只说"帮我做 env 校验"一句什么都没给，我才停下来问你变量列表。

---

## 第 3 步：4 件套产出

---

### 产出 1：`src/env.ts` 文件

严格遵守以下 4 条硬性要求：

1. **分 server / client / shared 三个 schema**（T3 Stack 经典模式）
   - `server`：机密变量，绝对不能进 bundle（API_KEY / SECRET / DATABASE_URL）
   - `client`：`NEXT_PUBLIC_` 前缀，打包进前端代码，不放机密
   - `shared`：两端都要读的非敏感变量（NODE_ENV 等）；若当前项目没有这类变量，**保留 `z.object({})` 占位**，不要删（注释标明原因）
2. **build 时执行校验**：文件末尾直接调用 parse，不是 export 一个函数让别人调
3. **API Key 用 `startsWith` 校验前缀**：校验前缀比 `.min(1)` 更早暴露"填错了 key"
4. **解析失败给友好错误**：自定义 `formatErrors`，告诉用户"哪个变量错了、应该是什么格式"

```ts
// src/env.ts
// 由 /zod-env 生成 — 修改时注意保持 server/client/shared 三段结构

import { z } from "zod";

// ── 工具函数：友好错误格式 ────────────────────────────────────
function formatErrors(errors: Record<string, string[]>) {
  return Object.entries(errors)
    .map(([key, msgs]) => `  ❌ ${key}: ${msgs.join(", ")}`)
    .join("\n");
}

// ── Server Schema（机密，绝对不能进 bundle）──────────────────
const serverSchema = z.object({
  // AI Provider — 填你实际用的，没用到的可以删
  OPENAI_API_KEY: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("sk-"), {
      message: '必须以 "sk-" 开头（OpenAI 或 OpenRouter 的 key）',
    })
    .describe("OpenAI / OpenRouter API Key"), // 如需可选改为 .optional()

  // ANTHROPIC_API_KEY: z
  //   .string()
  //   .min(1)
  //   .refine((v) => v.startsWith("sk-ant-"), {
  //     message: '必须以 "sk-ant-" 开头',
  //   })
  //   .describe("Anthropic API Key"), // 如需可选改为 .optional()

  // DEEPSEEK_API_KEY: z
  //   .string()
  //   .min(10)
  //   .refine((v) => v.startsWith("sk-"), {
  //     message: '必须以 "sk-" 开头',
  //   })
  //   .describe("DeepSeek API Key"), // 如需可选改为 .optional()

  OPENAI_BASE_URL: z
    .string()
    .url()
    .optional() // 未设则走 OpenAI 官方，合理可选
    .describe("自定义 base URL，填 OpenRouter 或自建代理时使用"),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .describe("运行环境，Next.js 自动设置，无需手动配"),
});

// ── Client Schema（NEXT_PUBLIC_ 前缀，会进 bundle，不放机密）──
const clientSchema = z.object({
  // 示例，按你的实际变量替换：
  // NEXT_PUBLIC_APP_URL: z.string().url().describe("前端应用的公开 URL"),
  // NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).describe("PostHog 分析 Key"),
});
// 当前项目暂无 NEXT_PUBLIC_ 变量，保留空对象占位

// ── Shared Schema（两端都要读的非敏感变量）──────────────────
const sharedSchema = z.object({
  // 千万别删这个对象，保持 server/client/shared 三段代码形状统一
  // 当你有两端都要用的非敏感配置时，加在这里
  // 示例：APP_NAME: z.string().default("AgentHub")
});

// ── Build-time 校验（文件被 import 时立刻执行）──────────────
function validateEnv() {
  const serverResult = serverSchema.safeParse(process.env);
  const clientResult = clientSchema.safeParse(process.env);
  const sharedResult = sharedSchema.safeParse(process.env);

  const errors: string[] = [];

  if (!serverResult.success) {
    const flat = serverResult.error.flatten().fieldErrors as Record<string, string[]>;
    errors.push("[Server 环境变量]\n" + formatErrors(flat));
  }
  if (!clientResult.success) {
    const flat = clientResult.error.flatten().fieldErrors as Record<string, string[]>;
    errors.push("[Client 环境变量]\n" + formatErrors(flat));
  }
  if (!sharedResult.success) {
    const flat = sharedResult.error.flatten().fieldErrors as Record<string, string[]>;
    errors.push("[Shared 环境变量]\n" + formatErrors(flat));
  }

  if (errors.length > 0) {
    console.error("\n🚨 环境变量校验失败，请检查以下配置：\n");
    console.error(errors.join("\n\n"));
    console.error('\n💡 提示：复制 .env.example → .env.local，填入真实值后重新 build。\n');
    throw new Error("环境变量校验失败，build 已中止");
  }
}

validateEnv();

// ── 导出类型安全的 env 对象（可选，替代直接用 process.env）──
export const env = {
  ...serverSchema.parse(process.env),
  ...clientSchema.parse(process.env),
  ...sharedSchema.parse(process.env),
};
```

---

### 产出 2：`.env.example` 自动生成

基于 schema 自动生成，提交进仓库，让团队成员知道要配什么、格式要求是什么、去哪里获取：

```bash
# ══════════════════════════════════════════════════════════════
# AgentHub 环境变量模板
# 使用方法：cp .env.example .env.local，然后填入真实值
# ══════════════════════════════════════════════════════════════

# ── Server-only（机密，绝对不要提交真实值到 git）─────────────

# OpenAI / OpenRouter API Key
# 格式：以 "sk-" 开头
# 获取：https://platform.openai.com/api-keys 或 https://openrouter.ai/keys
OPENAI_API_KEY=sk-replace-me

# 自定义 Base URL（可选）
# 不填则走 OpenAI 官方；填 OpenRouter 地址则可调用多家模型
# 格式：必须是合法 URL
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# Anthropic API Key（按需启用）
# 格式：以 "sk-ant-" 开头
# 获取：https://console.anthropic.com/settings/keys
# ANTHROPIC_API_KEY=sk-ant-replace-me

# DeepSeek API Key（按需启用）
# 格式：以 "sk-" 开头
# 获取：https://platform.deepseek.com/api_keys
# DEEPSEEK_API_KEY=sk-replace-me

# ── Client-side（NEXT_PUBLIC_ 前缀，会打包进前端代码）────────
# 注意：这里不要放任何机密！
# （当前项目暂无 NEXT_PUBLIC_ 变量，按需添加）

# ── Node 环境（Next.js 自动设置，通常不需要手动配）──────────
# NODE_ENV=development
```

---

### 产出 3：`next.config.ts` 修改

在 `next.config.ts` 顶部加一行 import，让 build 时自动触发 `env.ts` 的校验。

**⚠️ 重要：只在 `.env.local` 里的 key 是真实值时才取消注释。**
如果还是 `sk-replace-me` 这样的占位符，而 `env.ts` 用了 `startsWith` 校验，`next build` 会直接挂掉。

```ts
// next.config.ts

// ── 环境变量 build-time 校验 ─────────────────────────────────
// 等你把 .env.local 的 API key 换成真实值后，取消下面这行注释：
// import "./src/env";
// 取消注释后，每次 `pnpm build` 会自动校验所有必填环境变量。
// ─────────────────────────────────────────────────────────────

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 你现有的 next.config 配置保持不变，只加上面那行 import
};

export default nextConfig;
```

---

### 产出 4：判断力检查

`env.ts` 能跑，但还可以更健壮：

| 现在的做法 | 更好的做法 | 为什么 |
|-----------|-----------|--------|
| server / client 用同一个 `process.env` 对象 | 加 `typeof window !== "undefined"` guard，client schema 只在浏览器侧解析 | 防止 server-only 变量意外被 client 代码引用，下一步进 bundle |
| 本地用 `.env.local`，prod 在 Vercel 控制台手动填 | 接入 [Doppler](https://doppler.com) 或 [dotenv-vault](https://dotenv.org)，统一管理 dev/staging/prod 三套变量 | 手动填 prod 变量是配置漂移的重灾区，团队大了必翻车 |
| dev 和 prod 用同一份 schema | 按 `NODE_ENV` 拆两份 schema：prod 严格必填，dev 允许部分可选 | 本地调试时不想配齐所有 key，但 prod 要强制校验 |
| 只校验变量存在 | 对 `DATABASE_URL` 加 `z.string().url().includes("postgresql")` | 防止误把 MySQL 的 URL 填进去，这种错误 runtime 才崩，非常难查 |
| 报错只打 console.error | 报错时同时写 `process.exitCode = 1`，确保 CI 管道感知到 build 失败 | 某些 CI 环境不把 throw Error 当 build failure，需要明确设退出码 |
