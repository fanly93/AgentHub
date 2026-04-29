"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Github, Twitter, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/gallery", label: "商店" },
  { href: "/runs", label: "运行记录" },
  { href: "/pipeline", label: "编排" },
  { href: "/pricing", label: "定价" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-[14px] transition-colors hover:bg-accent ${
        isActive ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export function TopNav() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("agenthub-theme") as "dark" | "light") || "dark";
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "agenthub-theme" && (e.newValue === "dark" || e.newValue === "light")) {
        setTheme(e.newValue);
        document.documentElement.classList.toggle("dark", e.newValue === "dark");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try { localStorage.setItem("agenthub-theme", next); } catch {}
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="text-[15px]">AgentHub</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((it) => (
            <NavLink key={it.href} href={it.href} label={it.label} />
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" asChild><Link href="/settings">设置</Link></Button>
          <Button size="sm" asChild><Link href="/gallery">登录</Link></Button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const cols = [
    { title: "产品", items: ["Agent 商店", "Playground", "编排 Pipeline", "运行记录"] },
    { title: "资源", items: ["开发者文档", "API 参考", "示例库", "更新日志"] },
    { title: "公司", items: ["关于我们", "招聘", "博客", "联系方式"] },
    { title: "法律", items: ["服务条款", "隐私政策", "使用规范", "数据处理"] },
  ];
  return (
    <footer className="mt-16 border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Boxes className="h-4 w-4" />
              </div>
              <span className="text-[15px]">AgentHub</span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] text-muted-foreground">
              AI Agent 商店与 Playground 平台，让每个开发者都能快速接入并编排智能体。
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" size="icon"><Github className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon"><Twitter className="h-4 w-4" /></Button>
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-[13px] text-foreground">{c.title}</div>
              <ul className="mt-3 space-y-2">
                {c.items.map((i) => (
                  <li key={i} className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-6 text-[12px] text-muted-foreground">
          © 2026 AgentHub. 保留所有权利。
        </div>
      </div>
    </footer>
  );
}
