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
};

const categories = ['写作助手', '代码生成', '数据分析', '图像理解', '客户支持', '翻译润色', '研究调研', '运营营销', '教育辅导', '生产力工具'];
const providers = ['OpenAI', 'Anthropic', 'DashScope', 'Google', 'DeepSeek'];
const caps = ['流式输出', '工具调用', '多模态', '长上下文', '函数调用', 'JSON 模式', '中文优化', '代码执行'];
const authors = ['官方', '@linus', '@evan', '@mia', '@kai', '@yuki'];

const names = [
  'CodeReviewer Pro', 'Notion 写作管家', '数据洞察助手', 'SQL 翻译官', '图像描述师',
  '客服 7×24', 'PR 摘要机', '研报速读', '小红书文案手', '会议纪要官',
  '论文翻译家', '简历优化师', '面试模拟器', '产品需求拆解', 'Bug 复现助理',
  '前端组件生成', '正则表达式师', 'API 文档生成', '邮件润色机', 'Excel 公式手',
  '日报周报生成', '思维导图助手', '术语对照器', '播客纲要生成',
];

export const agents: Agent[] = names.map((name, i) => ({
  id: `agent-${i + 1}`,
  name,
  author: authors[i % authors.length],
  category: categories[i % categories.length],
  provider: providers[i % providers.length],
  capabilities: [caps[i % caps.length], caps[(i + 2) % caps.length], caps[(i + 4) % caps.length]],
  description: '基于大模型的智能助手，能够帮你高效完成日常工作中的繁琐任务，开箱即用。',
  price: i % 4 === 0 ? '免费' : `$${(i % 5) * 2 + 2}/月`,
  runs: 1200 + i * 137,
  rating: 4.2 + (i % 8) * 0.1,
}));

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
