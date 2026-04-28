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

type Tab = "forms" | "purchases";

function KajabiPage() {
  const { data: purchases = [] } = useKajabiPurchases();
  const { data: forms = [] } = useKajabiFormSubmissions();

  const [tab, setTab] = useState<Tab>("forms");
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

  // Lead-gen focused metrics
  const leadMetrics = useMemo(() => {
    const uniqueEmails = new Set<string>();
    for (const f of formsFiltered) {
      const e = (f.contact_email ?? "").toLowerCase().trim();
      if (e) uniqueEmails.add(e);
    }
    const buyerEmails = new Set<string>();
    for (const p of purchasesFiltered) {
      const e = (p.buyer_email ?? "").toLowerCase().trim();
      if (e) buyerEmails.add(e);
    }
    // Conversion: how many lead emails ended up purchasing (in window)
    let converted = 0;
    for (const e of uniqueEmails) if (buyerEmails.has(e)) converted += 1;
    const convRate = uniqueEmails.size ? (converted / uniqueEmails.size) * 100 : 0;
    const revenue = purchasesFiltered.reduce((s, p) => s + (p.amount_cents ?? 0), 0) / 100;
    return {
      formCount: formsFiltered.length,
      uniqueLeads: uniqueEmails.size,
      converted,
      convRate,
      purchases: purchasesFiltered.length,
      revenue,
    };
  }, [formsFiltered, purchasesFiltered]);

  const formsBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; emails: Set<string> }>();
    for (const f of formsFiltered) {
      const k = f.form_name ?? "Unnamed form";
      const ex = map.get(k) ?? { count: 0, emails: new Set<string>() };
      ex.count += 1;
      const e = (f.contact_email ?? "").toLowerCase().trim();
      if (e) ex.emails.add(e);
      map.set(k, ex);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, count: v.count, uniqueLeads: v.emails.size }))
      .sort((a, b) => b.count - a.count);
  }, [formsFiltered]);

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

  // Form submissions over time (lead-gen primary chart)
  const leadsChartData = useMemo(() => {
    const days = range === "all" ? 365 : parseInt(range);
    const map: Record<string, { day: string; submissions: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      map[d] = { day: d, submissions: 0 };
    }
    for (const f of formsFiltered) {
      if (!f.submitted_at) continue;
      const d = String(f.submitted_at).slice(0, 10);
      if (map[d]) map[d].submissions += 1;
    }
    return Object.values(map);
  }, [formsFiltered, range]);

  return (
    <PageShell>
      <PageHeader
        title="Kajabi"
        subtitle={`Lead generation · ${(forms as any[]).length} form submissions · ${(purchases as any[]).length} purchases`}
      />

      {/* Lead-gen KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Kpi label="Form Submissions" value={fmtNum(leadMetrics.formCount)} sub={range === "all" ? "All time" : `Last ${range} days`} />
        <Kpi label="Unique Leads" value={fmtNum(leadMetrics.uniqueLeads)} sub="Distinct emails" />
        <Kpi label="Lead → Buyer" value={fmtNum(leadMetrics.converted)} sub={`${leadMetrics.convRate.toFixed(1)}% conversion`} />
        <Kpi label="Purchases" value={fmtNum(leadMetrics.purchases)} sub="In window" />
        <Kpi label="Revenue" value={fmtUSD(leadMetrics.revenue)} sub="Secondary metric" />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search forms, offers, names, emails…"
          className="flex-1 min-w-[240px] rounded-lg border border-line-soft bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold"
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

      {/* Lead-gen chart */}
      <MCCard className="mb-6">
        <CardHeader title="Form Submissions Over Time" meta="Daily lead capture" />
        <div className="p-6">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsChartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E8E2D2" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d: any) => fmtDate(d)} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} allowDecimals={false} />
                <Bar dataKey="submissions" fill="#5B7553" radius={[2, 2, 0, 0]} />
                <Tooltip
                  contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 11 }}
                  labelFormatter={(d: any) => fmtDate(d)}
                  formatter={(v: any) => [`${v} submissions`, "Leads"]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </MCCard>

      {/* Funnels: Top forms */}
      {formsBreakdown.length > 0 && (
        <MCCard className="mb-6 overflow-hidden">
          <CardHeader title="Lead Capture by Form" meta={`${formsBreakdown.length} funnels`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <Th>Form / Funnel</Th>
                  <Th right>Submissions</Th>
                  <Th right>Unique Leads</Th>
                  <Th right>Share</Th>
                </tr>
              </thead>
              <tbody>
                {formsBreakdown.map((f) => {
                  const share = leadMetrics.formCount ? (f.count / leadMetrics.formCount) * 100 : 0;
                  return (
                    <tr key={f.name} className="border-t border-line-soft">
                      <td className="px-4 py-3 text-[13px] text-ink">{f.name}</td>
                      <td className="px-4 py-3 num-serif text-right text-ink">{fmtNum(f.count)}</td>
                      <td className="px-4 py-3 num-serif text-right text-ink">{fmtNum(f.uniqueLeads)}</td>
                      <td className="px-4 py-3 num-serif text-right text-ink-soft">{share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </MCCard>
      )}

      {/* Note about email opens */}
      <div className="mb-6 rounded-lg border border-line-soft bg-cream/60 px-4 py-3 text-[12px] text-ink-soft leading-relaxed">
        <strong className="text-ink">Note on email open rates:</strong> Kajabi's public API does not expose
        broadcast/email open or click metrics — those live only inside Kajabi's Email Campaigns dashboard.
        We capture every contact email here (under Form Submissions and Purchases), but per-email open
        rates would require a separate ESP (e.g. ConvertKit, Mailchimp) or Kajabi adding it to their API.
      </div>

      {/* Tabs: Forms primary, Purchases secondary */}
      <MCCard className="overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-line-soft">
          <div className="flex items-center gap-1 rounded-lg bg-cream p-1 border border-line-soft">
            {(["forms", "purchases"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 rounded text-[11px] uppercase tracking-[0.14em] transition-colors",
                  tab === t ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {t === "forms" ? "Form Submissions" : "Purchases (Book etc.)"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === "forms" ? (
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Form</Th>
                  <Th>Contact</Th>
                  <Th>Submitted Details</Th>
                </tr>
              </thead>
              <tbody>
                {formsFiltered.map((f) => {
                  const attrs = (f.raw?.attributes ?? {}) as Record<string, any>;
                  const fields = Object.entries(attrs).filter(
                    ([k, v]) =>
                      v != null &&
                      v !== "" &&
                      !["name", "email", "first_name", "last_name"].includes(k),
                  );
                  return (
                    <tr key={f.id} className="border-t border-line-soft align-top">
                      <td className="px-4 py-3 text-[12px] text-ink-soft whitespace-nowrap">{fmtDate(f.submitted_at)}</td>
                      <td className="px-4 py-3 text-[13px] text-ink">{f.form_name ?? "—"}</td>
                      <td className="px-4 py-3 text-[12px]">
                        <div className="text-ink">{f.contact_name ?? "—"}</div>
                        <div className="text-ink-muted text-[11px]">{f.contact_email ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        {fields.length === 0 ? (
                          <span className="text-ink-muted">—</span>
                        ) : (
                          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                            {fields.map(([k, v]) => (
                              <div key={k} className="contents">
                                <dt className="text-ink-muted uppercase tracking-[0.08em] text-[10px]">
                                  {k.replace(/_/g, " ")}
                                </dt>
                                <dd className="text-ink break-words">{String(v)}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {formsFiltered.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-ink-muted py-12 text-[13px]">No form submissions match these filters.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <>
              {offersBreakdown.length > 0 && (
                <div className="border-b border-line-soft bg-cream/30 px-4 py-3">
                  <div className="label-eyebrow text-[9px] mb-2">Revenue by Offer</div>
                  <div className="flex flex-wrap gap-2">
                    {offersBreakdown.map((o) => (
                      <div key={o.name} className="rounded border border-line-soft bg-white px-3 py-1.5 text-[11px]">
                        <span className="text-ink">{o.name}</span>
                        <span className="text-ink-muted ml-2">{fmtNum(o.count)} · {fmtUSD(o.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
            </>
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
