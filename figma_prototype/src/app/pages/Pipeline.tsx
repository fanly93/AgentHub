import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Play, Save, Trash2, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Sparkles, BookOpen, Code as CodeIcon, Globe, GitBranch, CircleStop, Workflow,
  Square, Trash, Layers,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Slider } from "../components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";

// ===== 类型定义 =====
type NodeKind = "start" | "llm" | "knowledge" | "code" | "http" | "condition" | "end";

type NodeData = {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  config: Record<string, any>;
};

type EdgeData = {
  id: string;
  source: string;
  sourceHandle: string; // "out" | "true" | "false"
  target: string;
  targetHandle: string; // "in"
};

type Graph = { nodes: NodeData[]; edges: EdgeData[] };

const NODE_W = 200;
const NODE_H = 76;

const KIND_META: Record<NodeKind, { label: string; icon: typeof Sparkles; color: string; outs: { id: string; label: string }[]; ins: number }> = {
  start:     { label: "开始",      icon: Play,        color: "hsl(220, 90%, 60%)", outs: [{ id: "out", label: "" }],                       ins: 0 },
  llm:       { label: "大模型",    icon: Sparkles,    color: "hsl(280, 70%, 60%)", outs: [{ id: "out", label: "" }],                       ins: 1 },
  knowledge: { label: "知识库",    icon: BookOpen,    color: "hsl(160, 70%, 50%)", outs: [{ id: "out", label: "" }],                       ins: 1 },
  code:      { label: "代码块",    icon: CodeIcon,    color: "hsl(38, 90%, 55%)",  outs: [{ id: "out", label: "" }],                       ins: 1 },
  http:      { label: "HTTP 请求", icon: Globe,       color: "hsl(195, 80%, 55%)", outs: [{ id: "out", label: "" }],                       ins: 1 },
  condition: { label: "条件分支",  icon: GitBranch,   color: "hsl(45, 90%, 55%)",  outs: [{ id: "true", label: "是" }, { id: "false", label: "否" }], ins: 1 },
  end:       { label: "结束",      icon: CircleStop,  color: "hsl(220, 10%, 55%)", outs: [],                                               ins: 1 },
};

const STORAGE_KEY = "agenthub-pipeline-v1";

const defaultGraph: Graph = {
  nodes: [
    { id: "n1", kind: "start", label: "开始", x: 80, y: 200, config: {} },
    { id: "n2", kind: "llm", label: "意图分类", x: 340, y: 200, config: { model: "gpt-5", temperature: 0.3, prompt: "判断用户问题属于哪一类。" } },
    { id: "n3", kind: "condition", label: "判断类型", x: 600, y: 200, config: { expr: "{{n2.output}} == '查询'" } },
    { id: "n4", kind: "knowledge", label: "检索知识", x: 860, y: 100, config: { topK: 5, library: "default" } },
    { id: "n5", kind: "llm", label: "生成回答", x: 860, y: 320, config: { model: "claude", temperature: 0.7, prompt: "基于上下文回答。" } },
    { id: "n6", kind: "end", label: "结束", x: 1120, y: 220, config: {} },
  ],
  edges: [
    { id: "e1", source: "n1", sourceHandle: "out", target: "n2", targetHandle: "in" },
    { id: "e2", source: "n2", sourceHandle: "out", target: "n3", targetHandle: "in" },
    { id: "e3", source: "n3", sourceHandle: "true", target: "n4", targetHandle: "in" },
    { id: "e4", source: "n3", sourceHandle: "false", target: "n5", targetHandle: "in" },
    { id: "e5", source: "n4", sourceHandle: "out", target: "n6", targetHandle: "in" },
    { id: "e6", source: "n5", sourceHandle: "out", target: "n6", targetHandle: "in" },
  ],
};

function loadFromStorage(): { graph: Graph; viewport: { x: number; y: number; z: number } } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.graph?.nodes && parsed.graph?.edges) return parsed;
  } catch {}
  return null;
}

// 节点端口的画布坐标（节点本地坐标 + 端口偏移）
function portPos(n: NodeData, side: "in" | "out", handleId: string): { x: number; y: number } {
  const meta = KIND_META[n.kind];
  if (side === "in") return { x: n.x, y: n.y + NODE_H / 2 };
  if (meta.outs.length <= 1) return { x: n.x + NODE_W, y: n.y + NODE_H / 2 };
  const idx = Math.max(0, meta.outs.findIndex((o) => o.id === handleId));
  const step = NODE_H / (meta.outs.length + 1);
  return { x: n.x + NODE_W, y: n.y + step * (idx + 1) };
}

function bezierPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.4);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function Pipeline() {
  // [Prep-05] 持久化 graph 与视口；初值从 localStorage 读取
  const initial = useMemo(() => loadFromStorage(), []);
  const [graph, setGraph] = useState<Graph>(initial?.graph ?? defaultGraph);
  const [viewport, setViewport] = useState(initial?.viewport ?? { x: 0, y: 0, z: 1 });

  // [Prep-05] undo + redo 双栈
  const [history, setHistory] = useState<Graph[]>([]);
  const [future, setFuture] = useState<Graph[]>([]);

  const commit = useCallback((next: Graph) => {
    setHistory((h) => [...h.slice(-49), graph]);
    setFuture([]);
    setGraph(next);
  }, [graph]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [graph, ...f.slice(0, 49)]);
      setGraph(prev);
      return h.slice(0, -1);
    });
  }, [graph]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setHistory((h) => [...h.slice(-49), graph]);
      setGraph(next);
      return f.slice(1);
    });
  }, [graph]);

  // 选中状态：节点 or 边
  const [selected, setSelected] = useState<{ type: "node" | "edge"; id: string } | null>({ type: "node", id: "n2" });
  const [running, setRunning] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offX: number; offY: number; moved: boolean; startX: number; startY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);
  const [pendingEdge, setPendingEdge] = useState<{ from: { x: number; y: number }; to: { x: number; y: number }; source: string; sourceHandle: string } | null>(null);

  // 持久化
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ graph, viewport })); } catch {}
  }, [graph, viewport]);

  // 屏幕坐标 → 画布坐标
  const toCanvas = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewport.x) / viewport.z,
      y: (clientY - rect.top - viewport.y) / viewport.z,
    };
  };

  // 节点拖拽
  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const n = graph.nodes.find((x) => x.id === id)!;
    const p = toCanvas(e.clientX, e.clientY);
    dragRef.current = { id, offX: p.x - n.x, offY: p.y - n.y, moved: false, startX: n.x, startY: n.y };
    setSelected({ type: "node", id });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMoveGlobal = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const p = toCanvas(e.clientX, e.clientY);
      const x = p.x - d.offX;
      const y = p.y - d.offY;
      d.moved = true;
      setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)) }));
    }
    if (panRef.current) {
      const pp = panRef.current;
      setViewport((v) => ({ ...v, x: pp.vx + (e.clientX - pp.startX), y: pp.vy + (e.clientY - pp.startY) }));
    }
    if (pendingEdge) {
      const p = toCanvas(e.clientX, e.clientY);
      setPendingEdge({ ...pendingEdge, to: p });
    }
  };

  const onNodePointerUp = (e: React.PointerEvent, id: string) => {
    const d = dragRef.current;
    if (d && d.moved) {
      // 拖拽结束入历史栈：把"拖拽前坐标"压栈
      setHistory((h) => [
        ...h.slice(-49),
        { nodes: graph.nodes.map((n) => (n.id === d.id ? { ...n, x: d.startX, y: d.startY } : n)), edges: graph.edges },
      ]);
      setFuture([]);
    }
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    void id;
  };

  // 画布平移
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    // 节点 / 端口 / 边都做了 stopPropagation，能到这里说明点的是空白处
    setSelected(null);
    panRef.current = { startX: e.clientX, startY: e.clientY, vx: viewport.x, vy: viewport.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCanvasPointerUp = (e: React.PointerEvent) => {
    panRef.current = null;
    if (pendingEdge) setPendingEdge(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // 滚轮缩放（以鼠标为锚点）
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 30) return;
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    setViewport((v) => {
      const nz = Math.max(0.4, Math.min(2, v.z * (1 + delta)));
      const k = nz / v.z;
      return { x: mx - (mx - v.x) * k, y: my - (my - v.y) * k, z: nz };
    });
  };

  // 端口拖出新连线
  const onPortPointerDown = (e: React.PointerEvent, source: string, sourceHandle: string) => {
    e.stopPropagation();
    const n = graph.nodes.find((x) => x.id === source)!;
    const from = portPos(n, "out", sourceHandle);
    const to = toCanvas(e.clientX, e.clientY);
    setPendingEdge({ from, to, source, sourceHandle });
  };

  const finishPendingEdge = (target: string) => {
    if (!pendingEdge) return;
    if (target === pendingEdge.source) { setPendingEdge(null); return; }
    // 同一对端不允许重复
    const dup = graph.edges.some(
      (ed) => ed.source === pendingEdge.source && ed.sourceHandle === pendingEdge.sourceHandle && ed.target === target,
    );
    if (dup) { setPendingEdge(null); return; }
    const newEdge: EdgeData = {
      id: `e${Date.now()}`,
      source: pendingEdge.source,
      sourceHandle: pendingEdge.sourceHandle,
      target,
      targetHandle: "in",
    };
    commit({ ...graph, edges: [...graph.edges, newEdge] });
    setPendingEdge(null);
  };

  // 节点库 -> 添加节点
  const addNodeOfKind = (kind: NodeKind) => {
    const id = `n${Date.now()}`;
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = (rect.width / 2 - viewport.x) / viewport.z - NODE_W / 2;
    const cy = (rect.height / 2 - viewport.y) / viewport.z - NODE_H / 2;
    const newNode: NodeData = {
      id,
      kind,
      label: KIND_META[kind].label,
      x: cx + Math.random() * 40,
      y: cy + Math.random() * 40,
      config: defaultConfig(kind),
    };
    commit({ ...graph, nodes: [...graph.nodes, newNode] });
    setSelected({ type: "node", id });
  };

  const removeSelected = () => {
    if (!selected) return;
    if (selected.type === "edge") {
      commit({ ...graph, edges: graph.edges.filter((e) => e.id !== selected.id) });
    } else {
      if (graph.nodes.length <= 1) return;
      commit({
        nodes: graph.nodes.filter((n) => n.id !== selected.id),
        edges: graph.edges.filter((e) => e.source !== selected.id && e.target !== selected.id),
      });
    }
    setSelected(null);
  };

  const updateSelectedNode = (patch: Partial<NodeData> & { config?: Record<string, any> }) => {
    if (!selected || selected.type !== "node") return;
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === selected.id ? { ...n, ...patch, config: { ...n.config, ...(patch.config ?? {}) } } : n,
      ),
    }));
  };

  // 模拟运行：拓扑顺序高亮节点
  const runWorkflow = () => {
    if (running) return;
    setRunning(true);
    const order: string[] = [];
    const visited = new Set<string>();
    const start = graph.nodes.find((n) => n.kind === "start") ?? graph.nodes[0];
    const dfs = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      order.push(id);
      graph.edges.filter((e) => e.source === id).forEach((e) => dfs(e.target));
    };
    dfs(start.id);
    let i = 0;
    const tick = () => {
      if (i >= order.length) {
        setActiveNodeId(null);
        setRunning(false);
        return;
      }
      setActiveNodeId(order[i]);
      i++;
      setTimeout(tick, 600);
    };
    tick();
  };

  const resetGraph = () => {
    if (!confirm("确定清空当前编排？此操作可撤销。")) return;
    commit({ nodes: [defaultGraph.nodes[0]], edges: [] });
    setSelected({ type: "node", id: defaultGraph.nodes[0].id });
  };

  const fitView = () => setViewport({ x: 0, y: 0, z: 1 });
  const zoomIn = () => setViewport((v) => ({ ...v, z: Math.min(2, v.z + 0.1) }));
  const zoomOut = () => setViewport((v) => ({ ...v, z: Math.max(0.4, v.z - 0.1) }));

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); return; }
      if (e.key === "=" || e.key === "+") { zoomIn(); return; }
      if (e.key === "-") { zoomOut(); return; }
      if (e.key === "0") { fitView(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const node = selected?.type === "node" ? graph.nodes.find((n) => n.id === selected.id) : null;
  const edge = selected?.type === "edge" ? graph.edges.find((e) => e.id === selected.id) : null;

  return (
    <div className="mx-auto max-w-7xl px-6 pt-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22 }}>编排 Pipeline</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">把多个 Agent 与���具串成一条工作流（参考 Dify / Coze 交互）</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={undo} disabled={!history.length} title="撤销 (Ctrl/Cmd+Z)">
            <Undo2 className="mr-1 h-4 w-4" />撤销
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!future.length} title="重做 (Ctrl/Cmd+Shift+Z)">
            <Redo2 className="mr-1 h-4 w-4" />重做
          </Button>
          <Button variant="outline" size="sm" onClick={removeSelected} disabled={!selected || (selected.type === "node" && graph.nodes.length <= 1)} title="删除 (Delete)">
            <Trash2 className="mr-1 h-4 w-4" />删除
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button variant="outline" size="icon" onClick={zoomOut} title="缩小 (-)">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-[12px] text-muted-foreground tabular-nums">{Math.round(viewport.z * 100)}%</span>
          <Button variant="outline" size="icon" onClick={zoomIn} title="放大 (+)">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={fitView} title="重置视图 (0)">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={resetGraph} title="清空画布">
            <Trash className="mr-1 h-4 w-4" />清空
          </Button>
          <Button variant="outline" size="sm" title="保存到本地">
            <Save className="mr-1 h-4 w-4" />存好
          </Button>
          <Button size="sm" onClick={runWorkflow} disabled={running}>
            <Play className="mr-1 h-4 w-4" />{running ? "跑着…" : "跑一下"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr_300px]">
        {/* 节点库 */}
        <aside className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 px-1 pb-2 text-[12px] text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />节点库
          </div>
          <div className="space-y-1.5">
            {(Object.keys(KIND_META) as NodeKind[]).map((k) => {
              const m = KIND_META[k];
              const Icon = m.icon;
              return (
                <button
                  key={k}
                  onClick={() => addNodeOfKind(k)}
                  className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left text-[13px] transition-colors hover:border-[hsl(220,15%,30%)]"
                  title={`添加${m.label}节点`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: m.color + "26", color: m.color }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{m.label}</span>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-md border border-border bg-background p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <div className="text-foreground text-[12px] mb-1">快捷键</div>
            <div>拖动空白：平移画布</div>
            <div>滚轮 / Ctrl+滚轮：缩放</div>
            <div>Ctrl/Cmd+Z：撤销</div>
            <div>Ctrl/Cmd+Shift+Z：重做</div>
            <div>Delete：删除选中</div>
          </div>
        </aside>

        {/* 画布 */}
        <div
          ref={canvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMoveGlobal}
          onPointerUp={onCanvasPointerUp}
          onWheel={onWheel}
          className="relative h-[640px] overflow-hidden rounded-lg border border-border bg-card touch-none select-none"
          style={{
            backgroundImage: 'radial-gradient(hsl(220, 15%, 22%) 1px, transparent 1px)',
            backgroundSize: `${20 * viewport.z}px ${20 * viewport.z}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            cursor: panRef.current ? "grabbing" : "grab",
          }}
        >
          {/* 内层应用 transform，承载节点与连线 */}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.z})` }}
          >
            {/* 连线 SVG */}
            <svg className="pointer-events-none absolute" style={{ width: 4000, height: 2000, overflow: "visible" }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(220, 15%, 45%)" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(220, 90%, 60%)" />
                </marker>
              </defs>

              {graph.edges.map((ed) => {
                const a = graph.nodes.find((n) => n.id === ed.source);
                const b = graph.nodes.find((n) => n.id === ed.target);
                if (!a || !b) return null;
                const from = portPos(a, "out", ed.sourceHandle);
                const to = portPos(b, "in", ed.targetHandle);
                const isSel = selected?.type === "edge" && selected.id === ed.id;
                return (
                  <g key={ed.id} className="pointer-events-auto cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); setSelected({ type: "edge", id: ed.id }); }}>
                    <path d={bezierPath(from, to)} stroke="transparent" strokeWidth={14} fill="none" />
                    <path
                      d={bezierPath(from, to)}
                      stroke={isSel ? "hsl(220, 90%, 60%)" : "hsl(220, 15%, 45%)"}
                      strokeWidth={isSel ? 2 : 1.5}
                      fill="none"
                      markerEnd={isSel ? "url(#arrow-active)" : "url(#arrow)"}
                    />
                  </g>
                );
              })}

              {pendingEdge && (
                <path
                  d={bezierPath(pendingEdge.from, pendingEdge.to)}
                  stroke="hsl(220, 90%, 60%)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  fill="none"
                />
              )}
            </svg>

            {/* 节点 */}
            {graph.nodes.map((n) => {
              const meta = KIND_META[n.kind];
              const Icon = meta.icon;
              const isSel = selected?.type === "node" && selected.id === n.id;
              const isActive = activeNodeId === n.id;
              return (
                <div
                  key={n.id}
                  onPointerDown={(e) => onNodePointerDown(e, n.id)}
                  onPointerUp={(e) => onNodePointerUp(e, n.id)}
                  className={`absolute rounded-lg border bg-background shadow-sm transition-shadow ${
                    isSel ? "border-primary" : "border-border hover:border-[hsl(220,15%,30%)]"
                  } ${isActive ? "ring-2 ring-primary/60" : ""}`}
                  style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H, cursor: "grab" }}
                >
                  <div className="flex h-full items-center gap-2.5 px-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: meta.color + "26", color: meta.color }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">{n.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{meta.label}</div>
                    </div>
                  </div>

                  {/* 入端口 */}
                  {meta.ins > 0 && (
                    <div
                      onPointerUp={(e) => { e.stopPropagation(); finishPendingEdge(n.id); }}
                      className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-border bg-background hover:border-primary"
                      title="输入"
                    />
                  )}

                  {/* 出端口（可能多个） */}
                  {meta.outs.map((o, idx) => {
                    const top = meta.outs.length <= 1 ? "50%" : `${(100 / (meta.outs.length + 1)) * (idx + 1)}%`;
                    return (
                      <div key={o.id} className="absolute -right-1.5" style={{ top, transform: "translateY(-50%)" }}>
                        <div
                          onPointerDown={(e) => onPortPointerDown(e, n.id, o.id)}
                          className="h-3 w-3 cursor-crosshair rounded-full border-2 border-border bg-background hover:border-primary"
                          title={`输出${o.label ? "·" + o.label : ""}`}
                        />
                        {o.label && (
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] text-muted-foreground">{o.label}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* 状态条 */}
          <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">{graph.nodes.length} 节点</Badge>
            <Badge variant="secondary" className="text-[10px]">{graph.edges.length} 连线</Badge>
            {running && <span className="flex items-center gap-1 text-[hsl(160,70%,50%)]"><Workflow className="h-3 w-3" />运行中…</span>}
          </div>
        </div>

        {/* 属性面板 */}
        <aside className="rounded-lg border border-border bg-card p-4">
          {node ? (
            <NodeForm node={node} onChange={updateSelectedNode} onDelete={removeSelected} canDelete={graph.nodes.length > 1} />
          ) : edge ? (
            <EdgeForm edge={edge} graph={graph} onDelete={removeSelected} />
          ) : (
            <EmptyPanel />
          )}
        </aside>
      </div>
    </div>
  );
}

function defaultConfig(kind: NodeKind): Record<string, any> {
  switch (kind) {
    case "llm": return { model: "gpt-5", temperature: 0.7, prompt: "" };
    case "knowledge": return { topK: 3, library: "default" };
    case "code": return { language: "python", code: "# 在这里写代码\nreturn input" };
    case "http": return { method: "GET", url: "https://", headers: "" };
    case "condition": return { expr: "{{prev.output}} == 1" };
    default: return {};
  }
}

function NodeForm({ node, onChange, onDelete, canDelete }: { node: NodeData; onChange: (p: any) => void; onDelete: () => void; canDelete: boolean }) {
  const meta = KIND_META[node.kind];
  const Icon = meta.icon;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: meta.color + "26", color: meta.color }}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-[13px] text-muted-foreground">{meta.label}</div>
      </div>

      <Field label="名称">
        <Input value={node.label} onChange={(e) => onChange({ label: e.target.value })} />
      </Field>

      {node.kind === "llm" && (
        <>
          <Field label="模型">
            <Select value={node.config.model} onValueChange={(v) => onChange({ config: { model: v } })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-5">GPT-5</SelectItem>
                <SelectItem value="claude">Claude Opus 4.7</SelectItem>
                <SelectItem value="gemini">Gemini 2.5 Pro</SelectItem>
                <SelectItem value="deepseek">DeepSeek V4 Flash</SelectItem>
                <SelectItem value="qwen3.5-plus">Qwen3.5-Plus</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`温度 ${Number(node.config.temperature ?? 0.7).toFixed(1)}`}>
            <Slider
              value={[node.config.temperature ?? 0.7]}
              onValueChange={(v) => onChange({ config: { temperature: v[0] } })}
              max={2}
              step={0.1}
            />
          </Field>
          <Field label="提示词">
            <Textarea
              value={node.config.prompt ?? ""}
              onChange={(e) => onChange({ config: { prompt: e.target.value } })}
              rows={4}
              placeholder="可使用 {{node.output}} 引用上游变量…"
            />
          </Field>
        </>
      )}

      {node.kind === "knowledge" && (
        <>
          <Field label="知识库">
            <Select value={node.config.library} onValueChange={(v) => onChange({ config: { library: v } })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认知识库</SelectItem>
                <SelectItem value="docs">产品文档</SelectItem>
                <SelectItem value="faq">常见问题</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Top K：${node.config.topK ?? 3}`}>
            <Slider value={[node.config.topK ?? 3]} onValueChange={(v) => onChange({ config: { topK: v[0] } })} min={1} max={10} step={1} />
          </Field>
        </>
      )}

      {node.kind === "code" && (
        <>
          <Field label="语言">
            <Select value={node.config.language} onValueChange={(v) => onChange({ config: { language: v } })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="代码">
            <Textarea
              value={node.config.code ?? ""}
              onChange={(e) => onChange({ config: { code: e.target.value } })}
              rows={6}
              className="font-mono text-[12px]"
            />
          </Field>
        </>
      )}

      {node.kind === "http" && (
        <>
          <Field label="方法">
            <Select value={node.config.method} onValueChange={(v) => onChange({ config: { method: v } })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="URL">
            <Input value={node.config.url ?? ""} onChange={(e) => onChange({ config: { url: e.target.value } })} placeholder="https://api.example.com/v1/..." />
          </Field>
          <Field label="请求头">
            <Textarea value={node.config.headers ?? ""} onChange={(e) => onChange({ config: { headers: e.target.value } })} rows={3} placeholder={`Authorization: Bearer ...\nContent-Type: application/json`} />
          </Field>
        </>
      )}

      {node.kind === "condition" && (
        <Field label="判断表达式" hint="支持 {{node.output}} 引用">
          <Textarea value={node.config.expr ?? ""} onChange={(e) => onChange({ config: { expr: e.target.value } })} rows={3} className="font-mono text-[12px]" />
        </Field>
      )}

      {(node.kind === "start" || node.kind === "end") && (
        <p className="text-[12px] text-muted-foreground">{node.kind === "start" ? "工作流的入口节点。" : "工作流的出口节点。"}</p>
      )}

      <div className="flex gap-2 pt-2">
        <Button className="flex-1">应用</Button>
        <Button
          variant="outline"
          className="text-[hsl(0,70%,60%)] hover:text-[hsl(0,70%,60%)]"
          onClick={onDelete}
          disabled={!canDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EdgeForm({ edge, graph, onDelete }: { edge: EdgeData; graph: Graph; onDelete: () => void }) {
  const a = graph.nodes.find((n) => n.id === edge.source);
  const b = graph.nodes.find((n) => n.id === edge.target);
  return (
    <div className="space-y-4">
      <div className="text-[13px] text-muted-foreground">连线</div>
      <div className="rounded-md border border-border bg-background p-3 text-[13px]">
        <div className="flex items-center gap-2">
          <Square className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">从</span>
          <span>{a?.label ?? "?"}</span>
          {edge.sourceHandle !== "out" && <Badge variant="secondary" className="text-[10px]">{edge.sourceHandle === "true" ? "是" : edge.sourceHandle === "false" ? "否" : edge.sourceHandle}</Badge>}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Square className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">到</span>
          <span>{b?.label ?? "?"}</span>
        </div>
      </div>
      <Button variant="outline" className="w-full text-[hsl(0,70%,60%)] hover:text-[hsl(0,70%,60%)]" onClick={onDelete}>
        <Trash2 className="mr-1 h-4 w-4" />删除连线
      </Button>
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center text-[12px] text-muted-foreground">
      <Layers className="h-6 w-6" />
      <div className="mt-2">点选画布上的节点或连线</div>
      <div className="mt-0.5">从左侧节点库往画布拖也行</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}