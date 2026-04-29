import { Check, X } from "lucide-react";
import { Button } from "../components/ui/button";

const tiers = [
  { name: "免费版", price: "$0", period: "永久免费", desc: "个人开发者起步使用", cta: "免费开始", popular: false,
    features: ["每月 100 次 Agent 运行", "公开 Agent 全部可用", "基础运行记录（7 天）", "社区支持"] },
  { name: "专业版", price: "$20", period: "/月", desc: "高频使用与小型项目", cta: "升级到专业版", popular: true,
    features: ["每月 5000 次运行", "私有 Agent 上传", "完整 Trace（90 天）", "Pipeline 编排", "优先邮件支持"] },
  { name: "团队版", price: "$50", period: "/月/席", desc: "团队协作与企业接入", cta: "联系销售", popular: false,
    features: ["不限运行次数", "成员与权限管理", "团队级账单与配额", "SSO / 审计日志", "专属客户成功"] },
];

const matrix: { row: string; vals: (boolean | string)[] }[] = [
  { row: "Agent 数量", vals: ["3", "20", "不限"] },
  { row: "Pipeline 编排", vals: [false, true, true] },
  { row: "Trace 保留", vals: ["7 天", "90 天", "1 年"] },
  { row: "团队成员", vals: ["1 人", "3 人", "不限"] },
  { row: "私有部署", vals: [false, false, true] },
  { row: "SLA 保证", vals: [false, "99.5%", "99.9%"] },
];

const faqs = [
  ["运行次数怎么计算？", "每次成功调用 Agent 计 1 次。失败和重试不计费。"],
  ["可以中途升级或降级吗？", "可以，按日计费、按差额结算，操作即时生效。"],
  ["团队版是否支持开票？", "支持增值税专用发票，付款后 3 个工作日寄出。"],
  ["免费版有信用卡限制吗？", "完全无需信用卡，注册即可使用。"],
  ["可以自带 API Key 吗？", "支持，使用自有 Key 时不消耗运行次数额度。"],
  ["数据安全怎么保证？", "默认不用于训练，企业版支持私有部署与数据隔离。"],
];

export function Pricing() {
  return (
    // [Prep-03] 修复 #1: Pricing 同等密度收紧（pt-12 / mt-8 / mt-12）
    <div className="mx-auto max-w-7xl px-6 pt-12 pb-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 style={{ fontSize: 24, lineHeight: 1.25 }}>简单透明的定价</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">按运行次数计费，没有隐藏费用。随时升级、随时取消。</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative rounded-lg border bg-card p-6 shadow-sm ${t.popular ? "border-primary" : "border-border"}`}
          >
            {t.popular && (
              <div className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] text-primary-foreground">
                最受欢迎
              </div>
            )}
            <div className="text-[14px] text-foreground">{t.name}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span style={{ fontSize: 24 }}>{t.price}</span>
              <span className="text-[12px] text-muted-foreground">{t.period}</span>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">{t.desc}</p>
            <Button className="mt-5 w-full" variant={t.popular ? "default" : "outline"}>{t.cta}</Button>
            <ul className="mt-5 space-y-2.5">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px]">
                  <Check className="mt-0.5 h-4 w-4 text-[hsl(160,70%,50%)]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <h2 style={{ fontSize: 20 }}>功能对比</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-card">
              <tr>
                <th className="p-4 text-left text-muted-foreground">特性</th>
                {tiers.map((t) => <th key={t.name} className="p-4 text-left">{t.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.map((m, i) => (
                <tr key={m.row} className={i % 2 ? "bg-card/40" : ""}>
                  <td className="p-4">{m.row}</td>
                  {m.vals.map((v, j) => (
                    <td key={j} className="p-4 text-muted-foreground">
                      {typeof v === "boolean" ? (
                        v ? <Check className="h-4 w-4 text-[hsl(160,70%,50%)]" /> : <X className="h-4 w-4 text-muted-foreground" />
                      ) : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-12">
        <h2 style={{ fontSize: 20 }}>常见问题</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {faqs.map(([q, a]) => (
            <div key={q} className="rounded-lg border border-border bg-card p-5">
              <div className="text-[14px]">{q}</div>
              <p className="mt-2 text-[13px] text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
