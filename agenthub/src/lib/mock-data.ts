import type { ModelId } from "@/shared/schemas/playgroundResponse";

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
  agentType: AgentType;
  defaultModel?: ModelId;
};

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

const categories = ['写作助手', '代码生成', '数据分析', '图像理解', '客户支持', '翻译润色', '研究调研', '运营营销', '教育辅导', '生产力工具'];
const providers = ['OpenAI', 'Anthropic', 'DashScope', 'Google', 'DeepSeek'];
const caps = ['流式输出', '工具调用', '多模态', '长上下文', '函数调用', 'JSON 模式', '中文优化', '代码执行'];
const authors = ['官方', '@linus', '@evan', '@mia', '@kai', '@yuki'];

const simpleNames = [
  'CodeReviewer Pro', 'Notion 写作管家', '数据洞察助手', 'SQL 翻译官', '图像描述师',
  '客服 7×24', 'PR 摘要机', '研报速读', '小红书文案手', '会议纪要官',
  '论文翻译家', '简历优化师', '面试模拟器', '产品需求拆解', 'Bug 复现助理',
  '前端组件生成', '正则表达式师', 'API 文档生成', '邮件润色机', 'Excel 公式手',
  '日报周报生成', '思维导图助手',
];

const simpleAgents: Agent[] = simpleNames.map((name, i) => ({
  id: `agent-${i + 3}`,
  name,
  author: authors[i % authors.length],
  category: categories[i % categories.length],
  provider: providers[i % providers.length],
  capabilities: [caps[i % caps.length], caps[(i + 2) % caps.length], caps[(i + 4) % caps.length]],
  description: '基于大模型的智能助手，能够帮你高效完成日常工作中的繁琐任务，开箱即用。',
  price: i % 4 === 0 ? '免费' : `$${(i % 5) * 2 + 2}/月`,
  runs: 1200 + i * 137,
  rating: 4.2 + (i % 8) * 0.1,
  agentType: 'simple',
}));

export const agents: Agent[] = [
  {
    id: 'agent-general',
    name: '通用智能助手',
    author: '官方',
    category: '生产力工具',
    provider: 'Anthropic',
    capabilities: ['流式输出', '工具调用', '函数调用', '长上下文', 'JSON 模式'],
    description: '支持工具调用的通用智能助手，可联网搜索、计算、查天气、写文件，适合各类复杂任务。',
    price: '免费',
    runs: 8800,
    rating: 4.9,
    emoji: '🤖',
    agentType: 'general',
    defaultModel: 'deepseek-v4-flash',
  },
  {
    id: 'agent-deepresearch',
    name: '深度研究助手',
    author: '官方',
    category: '研究调研',
    provider: 'DeepSeek',
    capabilities: ['流式输出', '工具调用', '长上下文', '中文优化'],
    description: '专业深度研究员，自动规划检索策略，执行多轮联网搜索，输出含执行摘要、主要发现、来源与参考、结论建议的结构化研究报告。',
    price: '免费',
    runs: 3200,
    rating: 4.8,
    emoji: '🔬',
    agentType: 'deepresearch',
    defaultModel: 'deepseek-v4-pro',
  },
  ...simpleAgents,
];

export const featuredAgents = agents.slice(0, 6);

export type RunRecord = {
  id: string;
  agent: string;
  timestamp: string;
  status: 'success' | 'failed' | 'running';
  duration: string;
  cost: string;
  input: string;
  output: string;
};

export const runs: RunRecord[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `run-${i + 1}`,
  agent: agents[i % agents.length].name,
  timestamp: `2026-04-${28 - (i % 10)} ${10 + (i % 10)}:${(i * 7) % 60 < 10 ? '0' : ''}${(i * 7) % 60}`,
  status: i % 5 === 0 ? 'failed' : i % 7 === 0 ? 'running' : 'success',
  duration: `${(0.6 + (i % 9) * 0.3).toFixed(1)}s`,
  cost: `$0.00${(i % 9) + 1}`,
  input: '请帮我把这段会议记录整理成结构化的纪要，并提取出待办事项。',
  output: '# 会议纪要\n\n## 关键结论\n- 下周完成 v2 设计评审\n- 将 SDK 升级到 0.7\n\n## 待办\n- [ ] @linus 整理 API 列表',
}));

export const traceNodes = [
  { id: 1, name: 'router', type: 'router', start: 0, duration: 80, color: 'hsl(220, 90%, 60%)' },
  { id: 2, name: 'retriever.search', type: 'tool', start: 80, duration: 240, color: 'hsl(160, 70%, 50%)' },
  { id: 3, name: 'llm.gpt-5', type: 'llm', start: 320, duration: 620, color: 'hsl(280, 70%, 60%)' },
  { id: 4, name: 'tool.calculator', type: 'tool', start: 940, duration: 90, color: 'hsl(160, 70%, 50%)' },
  { id: 5, name: 'llm.summarize', type: 'llm', start: 1030, duration: 410, color: 'hsl(280, 70%, 60%)' },
  { id: 6, name: 'output.format', type: 'output', start: 1440, duration: 120, color: 'hsl(38, 90%, 55%)' },
];
