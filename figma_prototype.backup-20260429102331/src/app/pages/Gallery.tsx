import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { agents } from "../lib/mock-data";
import { AgentCard } from "../components/AgentCard";
import { AgentCardSkeleton } from "../components/AgentCardSkeleton";
import type { NavKey } from "../components/Layout";

const categories = ["写作助手", "代码生成", "数据分析", "图像理解", "客户支持", "翻译润色", "研究调研", "运营营销", "教育辅导", "生产力工具"];
const providers = ["OpenAI", "Anthropic", "DashScope", "Google", "DeepSeek"];
const caps = ["流式输出", "工具调用", "多模态", "长上下文", "函数调用", "JSON 模式", "中文优化", "代码执行"];

export function Gallery({ onNav }: { onNav: (k: NavKey) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string[]>([]);
  const [prov, setProv] = useState<string[]>([]);
  const [cap, setCap] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  // [Prep-02] 修复 #3: Gallery 首次加载显示骨架屏
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (q && !a.name.includes(q) && !a.description.includes(q)) return false;
      if (cat.length && !cat.includes(a.category)) return false;
      if (prov.length && !prov.includes(a.provider)) return false;
      if (cap.length && !cap.some((c) => a.capabilities.includes(c))) return false;
      return true;
    });
  }, [q, cat, prov, cap]);

  const pageSize = 9;
  const total = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, total);
  const items = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="搜索 Agent 名称、能力、作者…"
            className="h-11 pl-9"
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-6">
          <FilterGroup title="分类" options={categories} values={cat} onToggle={(v) => toggle(cat, v, setCat)} />
          <FilterGroup title="提供商" options={providers} values={prov} onToggle={(v) => toggle(prov, v, setProv)} />
          <div>
            <div className="mb-2 text-[13px] text-muted-foreground">能力</div>
            <div className="flex flex-wrap gap-1.5">
              {caps.map((c) => (
                <Badge
                  key={c}
                  variant={cap.includes(c) ? "default" : "secondary"}
                  className="cursor-pointer text-[12px]"
                  onClick={() => toggle(cap, c, setCap)}
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </aside>

        <div>
          <div className="mb-3 text-[13px] text-muted-foreground">
            {loading ? "马上好…" : `共 ${filtered.length} 个 Agent`}
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState onClear={() => { setQ(""); setCat([]); setProv([]); setCap([]); setPage(1); }} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((a) => <AgentCard key={a.id} agent={a} onClick={() => onNav("detail")} />)}
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: total }).map((_, i) => (
                <Button
                  key={i}
                  variant={currentPage === i + 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(i + 1)}
                  className="h-9 w-9 p-0"
                >
                  {i + 1}
                </Button>
              ))}
              <Button variant="outline" size="icon" disabled={currentPage === total} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, options, values, onToggle }: { title: string; options: string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <div className="mb-2 text-[13px] text-muted-foreground">{title}</div>
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 text-[13px]">
            <Checkbox checked={values.includes(o)} onCheckedChange={() => onToggle(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// [Prep-02] 修复 #3: 空态使用线条风格"望远镜"插画 + 清除筛选 CTA
function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 py-16 text-center">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
        <circle cx="26" cy="26" r="14" />
        <path d="m36 36 18 18" strokeLinecap="round" />
        <path d="M20 20l4-4M20 32l-4 4" strokeLinecap="round" />
      </svg>
      <div className="mt-4 text-[13px] text-foreground">没找到匹配的 Agent</div>
      <p className="mt-1 text-[12px] text-muted-foreground">换个关键词，或者清掉筛选试试</p>
      <Button className="mt-4" variant="outline" size="sm" onClick={onClear}>清除筛选</Button>
    </div>
  );
}
