import { useState } from "react";
import { User, Key, CreditCard, Users, Plug, Copy, Plus } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";

const tabs = [
  { key: "profile", label: "个人资料", icon: User },
  { key: "keys", label: "API 密钥", icon: Key },
  { key: "billing", label: "账单", icon: CreditCard },
  { key: "team", label: "团队", icon: Users },
  { key: "integrations", label: "集成", icon: Plug },
] as const;

export function Settings() {
  const [tab, setTab] = useState<typeof tabs[number]["key"]>("profile");

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 style={{ fontSize: 24 }}>账户设置</h1>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[14px] transition-colors hover:bg-accent ${
                tab === t.key ? "bg-accent text-foreground" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </aside>

        <div className="rounded-lg border border-border bg-card p-6">
          {tab === "profile" && <ProfileForm />}
          {tab === "keys" && <KeysPanel />}
          {tab === "billing" && <BillingPanel />}
          {tab === "team" && <TeamPanel />}
          {tab === "integrations" && <IntegrationsPanel />}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px]">{label}</label>
      {children}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ProfileForm() {
  return (
    <div className="space-y-5">
      <h2 style={{ fontSize: 18 }}>个人资料</h2>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary text-[20px]">L</div>
        <Button variant="outline" size="sm">更换头像</Button>
      </div>
      <Field label="昵称"><Input defaultValue="Linus 张" /></Field>
      <Field label="邮箱" hint="用于登录与重要通知"><Input defaultValue="linus@agenthub.dev" type="email" /></Field>
      <Field label="个人简介"><Textarea defaultValue="独立开发者，关注开发者工具与 AI 应用。" rows={3} /></Field>
      <div className="flex gap-2">
        <Button>保存更改</Button>
        <Button variant="outline">取消</Button>
      </div>
    </div>
  );
}

// [Prep-02] 修复 #3: API 密钥页空态 + 钥匙线条插画
function KeysEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-card/40 py-14 text-center">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
        <circle cx="20" cy="28" r="9" />
        <path d="M29 28h22M44 28v8M51 28v6" strokeLinecap="round" />
      </svg>
      <div className="mt-4 text-[13px] text-foreground">还没有 API Key</div>
      <p className="mt-1 text-[12px] text-muted-foreground">创建一把就能开始调用</p>
      <Button className="mt-4" size="sm" onClick={onCreate}><Plus className="mr-1 h-4 w-4" />生成新 Key</Button>
    </div>
  );
}

function KeysPanel() {
  const [keys, setKeys] = useState([
    { name: "默认 Key", value: "ah_live_••••••••a93f", created: "2026-02-11" },
    { name: "线上服务", value: "ah_live_••••••••71c2", created: "2026-04-02" },
  ]);
  const create = () => setKeys([...keys, { name: `新 Key ${keys.length + 1}`, value: `ah_live_••••••••${Math.random().toString(16).slice(2, 6)}`, created: "2026-04-28" }]);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 18 }}>API 密钥</h2>
        <Button size="sm" onClick={create}><Plus className="mr-1 h-4 w-4" />创建新密钥</Button>
      </div>
      {keys.length === 0 ? <KeysEmpty onCreate={create} /> : (
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3 text-left text-muted-foreground">名称</th>
              <th className="p-3 text-left text-muted-foreground">密钥</th>
              <th className="p-3 text-left text-muted-foreground">创建时间</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.name} className="border-t border-border">
                <td className="p-3">{k.name}</td>
                <td className="p-3" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{k.value}</td>
                <td className="p-3 text-muted-foreground">{k.created}</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon"><Copy className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function BillingPanel() {
  return (
    <div className="space-y-5">
      <h2 style={{ fontSize: 18 }}>账单</h2>
      <div className="rounded-md border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] text-muted-foreground">当前套餐</div>
            <div className="mt-1 text-[16px]">专业版 · $20/月</div>
          </div>
          <Button variant="outline" size="sm">管理订阅</Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4 text-[13px]">
          <div><div className="text-muted-foreground">本月已用</div><div className="mt-1">2,184 次</div></div>
          <div><div className="text-muted-foreground">额度</div><div className="mt-1">5,000 次</div></div>
          <div><div className="text-muted-foreground">下次扣款</div><div className="mt-1">2026-05-12</div></div>
        </div>
      </div>
    </div>
  );
}

function TeamPanel() {
  const members = [
    { name: "Linus 张", email: "linus@agenthub.dev", role: "拥有者" },
    { name: "Evan 王", email: "evan@agenthub.dev", role: "管理员" },
    { name: "Mia 刘", email: "mia@agenthub.dev", role: "成员" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 18 }}>团队</h2>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />邀请成员</Button>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        {members.map((m, i) => (
          <div key={m.email} className={`flex items-center justify-between p-4 ${i ? "border-t border-border" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-[13px]">{m.name[0]}</div>
              <div>
                <div className="text-[14px]">{m.name}</div>
                <div className="text-[12px] text-muted-foreground">{m.email}</div>
              </div>
            </div>
            <Badge variant="secondary">{m.role}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsPanel() {
  const list = [
    { name: "Slack", desc: "运行结果通知到频道", on: true },
    { name: "GitHub", desc: "把 PR 摘要写回评论", on: true },
    { name: "飞书", desc: "推送日报与运行汇总", on: false },
    { name: "Webhook", desc: "自定义 HTTP 回调", on: false },
  ];
  return (
    <div className="space-y-5">
      <h2 style={{ fontSize: 18 }}>集成</h2>
      <div className="space-y-3">
        {list.map((it) => (
          <div key={it.name} className="flex items-center justify-between rounded-md border border-border bg-background p-4">
            <div>
              <div className="text-[14px]">{it.name}</div>
              <div className="text-[12px] text-muted-foreground">{it.desc}</div>
            </div>
            <Switch defaultChecked={it.on} />
          </div>
        ))}
      </div>
    </div>
  );
}
