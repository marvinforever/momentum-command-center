import { MCCard, CardHeader } from "@/components/mc/Primitives";
import { useMetaAdsDaily, useMetaCampaigns, useMetaSyncRuns } from "@/lib/queries";
import { fmtNum, fmtUSD, timeAgo } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis } from "recharts";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

export function MetaAdsWidget() {
  const dailyQ = useMetaAdsDaily(30);
  const campaignsQ = useMetaCampaigns();
  const runsQ = useMetaSyncRuns();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const daily = dailyQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];
  const lastRun = runsQ.data?.[0];

  // Aggregate last 30 days vs prev 30 days (matches drill-down totals)
  const totals = useMemo(() => {
    const byDay = new Map<string, { spend: number; leads: number; clicks: number; impressions: number }>();
    for (const r of daily) {
      const cur = byDay.get(r.snapshot_date) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0 };
      cur.spend += Number(r.spend ?? 0);
      cur.leads += Number(r.leads ?? 0);
      cur.clicks += Number(r.clicks ?? 0);
      cur.impressions += Number(r.impressions ?? 0);
      byDay.set(r.snapshot_date, cur);
    }
    const sorted = Array.from(byDay.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const last7 = sorted.slice(-7);
    const prev7 = sorted.slice(-14, -7);
    const sum = (arr: typeof sorted, k: "spend" | "leads" | "clicks" | "impressions") =>
      arr.reduce((s, r) => s + (r[k] as number), 0);

    const spend30 = sum(sorted, "spend");
    const leads30 = sum(sorted, "leads");
    const spend7 = sum(last7, "spend");
    const leads7 = sum(last7, "leads");
    const spendPrev = sum(prev7, "spend");
    const leadsPrev = sum(prev7, "leads");

    return {
      sorted,
      spend30,
      leads30,
      cpl30: leads30 ? spend30 / leads30 : 0,
      clicks30: sum(sorted, "clicks"),
      impressions30: sum(sorted, "impressions"),
      deltaSpend: spendPrev ? ((spend7 - spendPrev) / spendPrev) * 100 : 0,
      deltaLeads: leadsPrev ? ((leads7 - leadsPrev) / leadsPrev) * 100 : 0,
    };
  }, [daily]);

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

  async function runSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sess?.session?.access_token) {
        headers["Authorization"] = `Bearer ${sess.session.access_token}`;
      }
      const res = await fetch("/api/public/hooks/meta-sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ triggered_by: "manual" }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; campaigns_synced?: number; insights_synced?: number };
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSyncMsg(`Synced ${json.campaigns_synced} campaigns, ${json.insights_synced} days`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["meta_ads_daily"] }),
        qc.invalidateQueries({ queryKey: ["meta_campaigns"] }),
        qc.invalidateQueries({ queryKey: ["meta_sync_runs"] }),
      ]);
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <MCCard>
      <CardHeader
        title="Meta Ads"
        meta={
          <div className="flex items-center gap-3">
            <Link
              to="/meta"
              className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-ink-muted hover:text-gold"
            >
              Drill down <ArrowUpRight className="h-3 w-3" />
            </Link>
            <button
              onClick={runSync}
              disabled={syncing}
              className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-gold hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        }
      />
      <div className="p-6">
        {daily.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-[13px] text-ink-muted mb-3">No Meta Ads data yet.</div>
            <div className="text-[11px] text-ink-muted">
              Click <span className="text-gold">Sync now</span> to pull your first batch from Facebook & Instagram Ads.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Tile
                label="Spend (30d)"
                value={fmtUSD(totals.spend30)}
                delta={`${totals.deltaSpend >= 0 ? "+" : ""}${totals.deltaSpend.toFixed(0)}% (last 7d vs prev 7d)`}
              />
              <Tile
                label="Leads (30d)"
                value={fmtNum(totals.leads30)}
                delta={`${totals.deltaLeads >= 0 ? "+" : ""}${totals.deltaLeads.toFixed(0)}% (last 7d vs prev 7d)`}
                tone={totals.deltaLeads >= 0 ? "sage" : undefined}
              />
              <Tile
                label="Cost / Lead (30d)"
                value={totals.leads30 ? `$${totals.cpl30.toFixed(2)}` : "—"}
                delta={`${activeCampaigns} active campaign${activeCampaigns === 1 ? "" : "s"}`}
              />
              <Tile
                label="Clicks (30d)"
                value={fmtNum(totals.clicks30)}
                delta={`${fmtNum(totals.impressions30)} impressions`}
              />
            </div>

            <div className="mt-5 h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={totals.sorted}>
                  <XAxis dataKey="date" hide />
                  <Line type="monotone" dataKey="spend" stroke="#C4924A" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="leads" stroke="#6B8E7F" strokeWidth={2} dot={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1F2937",
                      border: "none",
                      borderRadius: 8,
                      color: "#F7F3EC",
                      fontSize: 11,
                    }}
                    formatter={(value: number, name: string) =>
                      name === "spend" ? [fmtUSD(value), "Spend"] : [value, "Leads"]
                    }
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              <span>30d ago</span>
              <span>Today</span>
            </div>
          </>
        )}

        <div className="mt-4 pt-3 border-t border-line-soft text-[10px] text-ink-muted flex items-center justify-between">
          <span>
            {lastRun
              ? lastRun.success
                ? `Last sync ${timeAgo(lastRun.started_at)}`
                : `Last sync failed ${timeAgo(lastRun.started_at)}`
              : "Never synced"}
          </span>
          <span>Auto-syncs daily 5am ET</span>
        </div>
        {syncMsg && (
          <div className="mt-2 text-[11px] text-ink-soft">{syncMsg}</div>
        )}
      </div>
    </MCCard>
  );
}

function Tile({ label, value, delta, tone }: { label: string; value: string; delta: string; tone?: "sage" }) {
  return (
    <div className="rounded-lg bg-cream px-3 py-3 border border-line-soft">
      <div className="label-eyebrow text-[9px]">{label}</div>
      <div className="num-serif text-[24px] leading-none text-ink mt-1.5">{value}</div>
      <div className={`text-[10px] mt-1.5 ${tone === "sage" ? "text-sage" : "text-ink-muted"}`}>{delta}</div>
    </div>
  );
}
