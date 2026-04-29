"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Send, Plus, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { agents } from "@/lib/mock-data";
import { AgentCard } from "@/components/AgentCard";

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const agent = agents.find((a) => a.id === params.id) ?? agents[0];
  const similar = agents.filter((a) => a.id !== agent.id).slice(0, 4);
  const [model, setModel] = useState("gpt-5");
  const [temp, setTemp] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2048]);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  const send = () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setOutput("");
    const text = "好的，我来帮你拆解这个任务：\n\n1. 首先理清核心目标\n2. 列出关键产出物\n3. 拆分到可执行的子任务\n4. 估算所需时间与依赖\n\n建议先从最不确定的部分开始，快速验证可行性。";
    let i = 0;
    const tick = () => {
      if (i <= text.length) {
        setOutput(text.slice(0, i));
        i += 4;
        setTimeout(tick, 30);
      } else {
        setRunning(false);
      }
    };
    tick();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <button onClick={() => router.push("/gallery")} className="hover:text-foreground">商店</button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{agent.category}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{agent.name}</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[40%_1fr]">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Zap className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h1 style={{ fontSize: 20 }}>{agent.name}</h1>
              <div className="mt-1 text-[13px] text-muted-foreground">由 {agent.author} 维护 · 基于 {agent.provider}</div>
              <div className="mt-2 flex items-center gap-3 text-[13px]">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-current text-[hsl(38,90%,55%)]" />
                  {agent.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">{agent.runs.toLocaleString()} 次运行</span>
                <span className="text-foreground">{agent.price}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {agent.capabilities.map((c) => <Badge key={c} variant="secondary" className="text-[12px]">{c}</Badge>)}
          </div>

          <h3 className="mt-6" style={{ fontSize: 14 }}>简介</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            一个专注于结构化输出的智能助手，擅长把模糊需求拆解为可执行子任务。支持自定义提示词模板与 JSON 模式输出，便于直接接入下游业务流程。
          </p>

          <h3 className="mt-6" style={{ fontSize: 14 }}>使用场景</h3>
          <ul className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
            <li>· 产品需求拆解为开发任务清单</li>
            <li>· 会议记录整理为结构化纪要</li>
            <li>· 模糊问题逐步澄清并给出建议</li>
          </ul>

          <Button className="mt-6 w-full">
            <Plus className="mr-1 h-4 w-4" />添加到我的 Agent
          </Button>
        </div>

        <div className="flex flex-col rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">模型</span>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-5">GPT-5</SelectItem>
                  <SelectItem value="claude">Claude Opus 4.7</SelectItem>
                  <SelectItem value="gemini">Gemini 2.5 Pro</SelectItem>
                  <SelectItem value="deepseek">DeepSeek V4 Flash</SelectItem>
                  <SelectItem value="qwen3.5-plus">Qwen3.5-Plus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 min-w-[180px] items-center gap-2">
              <span className="text-[12px] text-muted-foreground">温度</span>
              <Slider value={temp} onValueChange={setTemp} max={2} step={0.1} className="flex-1" />
              <span className="w-8 text-right text-[12px] text-muted-foreground">{temp[0].toFixed(1)}</span>
            </div>
            <div className="flex flex-1 min-w-[180px] items-center gap-2">
              <span className="text-[12px] text-muted-foreground">最大输出长度</span>
              <Slider value={maxTokens} onValueChange={setMaxTokens} max={8192} step={128} className="flex-1" />
              <span className="w-12 text-right text-[12px] text-muted-foreground">{maxTokens[0]}</span>
            </div>
          </div>

          <div className="flex-1 p-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span>输出</span>
              {running && (
                <span className="flex items-center gap-1">
                  <span>· 思考中</span>
                  <span className="inline-flex gap-0.5">
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                    <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                  </span>
                </span>
              )}
            </div>
            <div className="min-h-[200px] rounded-md border border-border bg-background p-3 text-[13px] leading-relaxed">
              {output ? (
                <pre className="whitespace-pre-wrap font-sans">{output}{running && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />}</pre>
              ) : (
                <div className="flex h-[180px] flex-col items-center justify-center text-center text-muted-foreground">
                  <Zap className="h-6 w-6" />
                  <div className="mt-2 text-[13px]">试着问点什么…</div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入你想让 Agent 做的事…"
                className="min-h-[72px] flex-1 resize-none"
              />
              <Button onClick={send} disabled={running || !prompt.trim()}>
                <Send className="mr-1 h-4 w-4" />发送
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px] text-muted-foreground">
              <span>已用 token：{prompt.length * 2} / {maxTokens[0]}</span>
              <span>预估成本：${((prompt.length * 2) / 1000 * 0.003).toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 style={{ fontSize: 18 }}>相似 Agent</h2>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {similar.map((a) => (
            <div key={a.id} className="min-w-[280px] flex-1">
              <AgentCard agent={a} onClick={() => router.push(`/agent/${a.id}`)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
