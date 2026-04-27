import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard, CardHeader } from "@/components/mc/Primitives";
import { useKajabiPurchases, useKajabiFormSubmissions } from "@/lib/queries";
import { fmtNum, fmtUSD, fmtDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/kajabi")({
  head: () => ({ meta: [{ title: "Kajabi — Momentum Command Center" }] }),
  component: KajabiPage,
});

type Tab = "purchases" | "forms";

function KajabiPage() {
  const { data: purchases = [] } = useKajabiPurchases();
  const { data: forms = [] } = useKajabiFormSubmissions();

  const [tab, setTab] = useState<Tab>("purchases");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"30" | "90" | "365" | "all">("90");

  const cutoff = useMemo(() => {
    if (range === "all") return null;
    return new Date(Date.now() - parseInt(range) * 86400_000).toISOString();
  }, [range]);

  const purchasesFiltered = useMemo(() => {
    let rows = purchases as any[];
    if (cutoff) rows = rows.filter((r) => r.purchased_at && r.purchased_at >= cutoff);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.offer_name ?? "").toLowerCase().includes(s) ||
          (r.buyer_name ?? "").toLowerCase().includes(s) ||
          (r.buyer_email ?? "").toLowerCase().includes(s),
      );
    }
    return rows;
  }, [purchases, cutoff, search]);

  const formsFiltered = useMemo(() => {
    let rows = forms as any[];
    if (cutoff) rows = rows.filter((r) => r.submitted_at && r.submitted_at >= cutoff);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.form_name ?? "").toLowerCase().includes(s) ||
          (r.contact_name ?? "").toLowerCase().includes(s) ||
          (r.contact_email ?? "").toLowerCase().includes(s),
      );
    }
    return rows;
  }, [forms, cutoff, search]);

  const totals = useMemo(() => {
    const revenue = purchasesFiltered.reduce((s, p) => s + (p.amount_cents ?? 0), 0) / 100;
    const refunded = purchasesFiltered.filter((p) => p.refunded_at).length;
    return {
      revenue,
      purchases: purchasesFiltered.length,
      refunded,
      forms: formsFiltered.length,
      avgOrder: purchasesFiltered.length ? revenue / purchasesFiltered.length : 0,
    };
  }, [purchasesFiltered, formsFiltered]);

  const offersBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const p of purchasesFiltered) {
      const k = p.offer_name ?? "Unnamed offer";
      const ex = map.get(k) ?? { count: 0, revenue: 0 };
      ex.count += 1;
      ex.revenue += (p.amount_cents ?? 0) / 100;
      map.set(k, ex);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [purchasesFiltered]);

  const chartData = useMemo(() => {
    const days = range === "all" ? 365 : parseInt(range);
    const map: Record<string, { day: string; revenue: number; purchases: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      map[d] = { day: d, revenue: 0, purchases: 0 };
    }
    for (const p of purchasesFiltered) {
      if (!p.purchased_at) continue;
      const d = String(p.purchased_at).slice(0, 10);
      if (map[d]) {
        map[d].revenue += (p.amount_cents ?? 0) / 100;
        map[d].purchases += 1;
      }
    }
    return Object.values(map);
  }, [purchasesFiltered, range]);

  return (
    <PageShell>
      <PageHeader
        title="Kajabi"
        subtitle={`${(purchases as any[]).length} purchases · ${(forms as any[]).length} form submissions`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Kpi label="Revenue" value={fmtUSD(totals.revenue)} sub={range === "all" ? "All time" : `Last ${range} days`} />
        <Kpi label="Purchases" value={fmtNum(totals.purchases)} sub="Completed orders" />
        <Kpi label="Avg Order Value" value={fmtUSD(totals.avgOrder)} sub="Per purchase" />
        <Kpi label="Refunded" value={fmtNum(totals.refunded)} sub="Orders" />
        <Kpi label="Form Submissions" value={fmtNum(totals.forms)} sub="Lead capture" />
      </div>

      <MCCard className="mb-6">
        <CardHeader title="Revenue Over Time" meta="Daily" />
        <div className="p-6">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E8E2D2" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d: any) => fmtDate(d)} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Bar dataKey="revenue" fill="#C4924A" radius={[2, 2, 0, 0]} />
                <Tooltip
                  contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 11 }}
                  labelFormatter={(d: any) => fmtDate(d)}
                  formatter={(v: any) => fmtUSD(Number(v))}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </MCCard>

      {offersBreakdown.length > 0 && (
        <MCCard className="mb-6 overflow-hidden">
          <CardHeader title="Revenue by Offer" meta={`${offersBreakdown.length} offers`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <Th>Offer</Th>
                  <Th right>Purchases</Th>
                  <Th right>Revenue</Th>
                  <Th right>Avg / Order</Th>
                </tr>
              </thead>
              <tbody>
                {offersBreakdown.map((o) => (
                  <tr key={o.name} className="border-t border-line-soft">
                    <td className="px-4 py-3 text-[13px] text-ink">{o.name}</td>
                    <td className="px-4 py-3 num-serif text-right text-ink">{fmtNum(o.count)}</td>
                    <td className="px-4 py-3 num-serif text-right text-ink">{fmtUSD(o.revenue)}</td>
                    <td className="px-4 py-3 num-serif text-right text-ink">{fmtUSD(o.revenue / o.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MCCard>
      )}

      <MCCard className="overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-line-soft">
          <div className="flex items-center gap-1 rounded-lg bg-cream p-1 border border-line-soft">
            {(["purchases", "forms"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 rounded text-[11px] uppercase tracking-[0.14em] transition-colors",
                  tab === t ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {t === "purchases" ? "Purchases" : "Form Submissions"}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by offer, name, email…"
            className="flex-1 min-w-[200px] rounded-lg border border-line-soft bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold"
          />
          <div className="flex items-center gap-1 rounded-lg bg-cream p-1 border border-line-soft">
            {(["30", "90", "365", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 rounded text-[11px] uppercase tracking-[0.14em] transition-colors",
                  range === r ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {r === "all" ? "All" : `${r}d`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === "purchases" ? (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Offer</Th>
                  <Th>Buyer</Th>
                  <Th right>Amount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {purchasesFiltered.map((p) => (
                  <tr key={p.id} className="border-t border-line-soft">
                    <td className="px-4 py-3 text-[12px] text-ink-soft whitespace-nowrap">{fmtDate(p.purchased_at)}</td>
                    <td className="px-4 py-3 text-[13px] text-ink">{p.offer_name ?? "—"}</td>
                    <td className="px-4 py-3 text-[12px]">
                      <div className="text-ink">{p.buyer_name ?? "—"}</div>
                      <div className="text-ink-muted text-[11px]">{p.buyer_email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 num-serif text-right text-ink">{fmtUSD((p.amount_cents ?? 0) / 100)}</td>
                    <td className="px-4 py-3 text-[11px]">
                      <span className={cn(
                        "inline-block rounded px-2 py-0.5",
                        p.refunded_at ? "bg-burgundy/10 text-burgundy" : "bg-sage-bg text-sage",
                      )}>
                        {p.refunded_at ? "Refunded" : (p.status ?? "completed")}
                      </span>
                    </td>
                  </tr>
                ))}
                {purchasesFiltered.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-ink-muted py-12 text-[13px]">No purchases match these filters.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Form</Th>
                  <Th>Contact</Th>
                </tr>
              </thead>
              <tbody>
                {formsFiltered.map((f) => (
                  <tr key={f.id} className="border-t border-line-soft">
                    <td className="px-4 py-3 text-[12px] text-ink-soft whitespace-nowrap">{fmtDate(f.submitted_at)}</td>
                    <td className="px-4 py-3 text-[13px] text-ink">{f.form_name ?? "—"}</td>
                    <td className="px-4 py-3 text-[12px]">
                      <div className="text-ink">{f.contact_name ?? "—"}</div>
                      <div className="text-ink-muted text-[11px]">{f.contact_email ?? ""}</div>
                    </td>
                  </tr>
                ))}
                {formsFiltered.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-ink-muted py-12 text-[13px]">No form submissions match these filters.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </MCCard>
    </PageShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white border border-line-soft p-4">
      <div className="label-eyebrow text-[9px]">{label}</div>
      <div className="num-serif text-[26px] text-ink leading-none mt-2">{value}</div>
      {sub && <div className="text-[10px] text-ink-muted mt-2 uppercase tracking-[0.14em]">{sub}</div>}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn("label-eyebrow px-4 py-3 bg-cream/60", right ? "text-right" : "text-left")}>{children}</th>
  );
}
