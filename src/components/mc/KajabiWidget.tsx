import { MCCard, CardHeader } from "@/components/mc/Primitives";
import { useKajabiPurchases, useKajabiFormSubmissions } from "@/lib/queries";
import { fmtNum, fmtUSD, fmtDate } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";

export function KajabiWidget() {
  const purchasesQ = useKajabiPurchases();
  const formsQ = useKajabiFormSubmissions();

  const purchases = purchasesQ.data ?? [];
  const forms = formsQ.data ?? [];

  const last30 = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
    const recentPurchases = purchases.filter((p: any) => p.purchased_at && p.purchased_at >= cutoff);
    const recentForms = forms.filter((f: any) => f.submitted_at && f.submitted_at >= cutoff);
    const revenue = recentPurchases.reduce((s: number, p: any) => s + (p.amount_cents ?? 0), 0) / 100;
    return {
      purchases: recentPurchases.length,
      revenue,
      forms: recentForms.length,
    };
  }, [purchases, forms]);

  // Daily revenue chart, last 30 days
  const chartData = useMemo(() => {
    const days: Record<string, { day: string; revenue: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days[d] = { day: d, revenue: 0 };
    }
    for (const p of purchases) {
      if (!p.purchased_at) continue;
      const d = String(p.purchased_at).slice(0, 10);
      if (days[d]) days[d].revenue += (p.amount_cents ?? 0) / 100;
    }
    return Object.values(days);
  }, [purchases]);

  const recentPurchase = purchases[0];

  if (purchases.length === 0 && forms.length === 0) {
    return (
      <MCCard className="border-dashed">
        <CardHeader title="Kajabi" meta="No data yet" />
        <div className="p-8 text-center">
          <p className="text-[13px] text-ink-muted mb-4">
            Connect your Kajabi webhook to start tracking purchases and form submissions.
          </p>
          <Link
            to="/admin/integrations"
            className="inline-block rounded-lg bg-gold px-5 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors"
          >
            Set up integration →
          </Link>
        </div>
      </MCCard>
    );
  }

  return (
    <MCCard>
      <CardHeader
        title="Kajabi"
        meta={
          <Link to="/kajabi" className="text-gold hover:underline">
            Drill down →
          </Link>
        }
      />
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-lg bg-cream border border-line-soft p-3">
            <div className="label-eyebrow text-[9px]">Revenue (30d)</div>
            <div className="num-serif text-[24px] text-ink leading-none mt-1.5">
              {fmtUSD(last30.revenue)}
            </div>
            <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">
              {last30.purchases} purchase{last30.purchases === 1 ? "" : "s"}
            </div>
          </div>
          <div className="rounded-lg bg-cream border border-line-soft p-3">
            <div className="label-eyebrow text-[9px]">Form Submissions (30d)</div>
            <div className="num-serif text-[24px] text-ink leading-none mt-1.5">
              {fmtNum(last30.forms)}
            </div>
            <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">Lead capture</div>
          </div>
        </div>

        <div className="h-[100px] mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Bar dataKey="revenue" fill="#C4924A" radius={[2, 2, 0, 0]} />
              <Tooltip
                contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 11 }}
                labelFormatter={(d: any) => fmtDate(d)}
                formatter={(v: any) => fmtUSD(Number(v))}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {recentPurchase && (
          <div className="border-t border-line-soft pt-4">
            <div className="label-eyebrow text-[9px] mb-2">Most Recent Purchase</div>
            <div className="text-[13px] font-medium text-ink leading-snug line-clamp-2">
              {recentPurchase.offer_name ?? "Untitled offer"}
            </div>
            <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
              <span>{fmtDate(recentPurchase.purchased_at)}</span>
              <span>·</span>
              <span>{fmtUSD((recentPurchase.amount_cents ?? 0) / 100)}</span>
              {recentPurchase.buyer_name && (<><span>·</span><span>{recentPurchase.buyer_name}</span></>)}
            </div>
          </div>
        )}
      </div>
    </MCCard>
  );
}
