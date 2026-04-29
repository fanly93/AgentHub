import { useEffect, useState } from "react";
import { TopNav, Footer, type NavKey } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Pricing } from "./pages/Pricing";
import { Gallery } from "./pages/Gallery";
import { Detail } from "./pages/Detail";
import { RunHistory } from "./pages/RunHistory";
import { Settings } from "./pages/Settings";
import { Pipeline } from "./pages/Pipeline";

// [Prep-02] 新增功能：暗/亮模式切换
export default function App() {
  const [route, setRoute] = useState<NavKey>("home");
  // [Prep-03] 主题持久化到 localStorage
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("agenthub-theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("agenthub-theme", theme); } catch {}
  }, [theme]);

  // [Prep-04] 监听 storage 事件做多标签页主题联动
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "agenthub-theme" && (e.newValue === "dark" || e.newValue === "light")) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <div className={`${theme === "dark" ? "dark" : ""} min-h-screen bg-background text-foreground`}>
      <TopNav current={route} onNav={setRoute} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      <main>
        {route === "home" && <Landing onNav={setRoute} />}
        {route === "gallery" && <Gallery onNav={setRoute} />}
        {route === "detail" && <Detail onNav={setRoute} />}
        {route === "runs" && <RunHistory onNav={setRoute} />}
        {route === "pipeline" && <Pipeline />}
        {route === "pricing" && <Pricing />}
        {route === "settings" && <Settings />}
      </main>
      <Footer />
    </div>
  );
}
