import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard, SectionTitle, CardHeader, StatusBadge, ChannelBadge, Avatar, KpiTile } from "@/components/mc/Primitives";
import { useLeads, useDiscoveryCalls, useCampaigns, useContent, useKajabiFormSubmissions, useMetaAdsInsightsDaily, monthFilter, last7Filter, last30Filter } from "@/lib/queries";
import { fmtNum, fmtUSD, fmtPct, fmtDate, timeAgo, isoDate, daysAgo } from "@/lib/format";
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Tooltip } from "recharts";
import { useMemo } from "react";
import { YouTubeWidget } from "@/components/mc/YouTubeWidget";
import { MetaAdsWidget } from "@/components/mc/MetaAdsWidget";
import { LinkedInWidget } from "@/components/mc/LinkedInWidget";
import { KajabiWidget } from "@/components/mc/KajabiWidget";
import { PodcastWidget } from "@/components/mc/PodcastWidget";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Momentum Command Center" }] }),
  component: Dashboard,
});

const DONUT_COLORS = ["#C4924A", "#8B3A3A", "#2C3E5C", "#6B8E7F", "#8A8275", "#C5BBA8", "#E3C892"];

function Dashboard() {
  const navigate = useNavigate();
  const leadsQ = useLeads();
  const callsQ = useDiscoveryCalls();
  const campaignsQ = useCampaigns();
  const contentQ = useContent();
  const formsQ = useKajabiFormSubmissions();
  const metaInsightsQ = useMetaAdsInsightsDaily({ days: 14 });

  const month = monthFilter();
  const week = last7Filter();
  const last30 = last30Filter();

  const leads = leadsQ.data ?? [];
  const calls = callsQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];
  const content = contentQ.data ?? [];
  const forms = formsQ.data ?? [];
  const metaInsights = metaInsightsQ.data ?? [];

  const inMonth = (d: string | null) => !!d && d >= month.from && d <= month.to;
  const inWeek = (d: string | null) => !!d && d >= week.from && d <= week.to;
  const in30 = (d: string | null) => !!d && d >= last30.from && d <= last30.to;

  const leadsMTD = leads.filter((l) => inMonth(l.first_touch_date)).length;
  const callsMTD = calls.filter((c) => inMonth(c.call_date));
  const callsBookedMTD = callsMTD.length;
  const heldStatuses = ["Won", "Lost", "Not a Fit"];
  const callsHeldMTD = callsMTD.filter((c) => heldStatuses.includes(c.status ?? "")).length;
  const enrolledMTD = callsMTD.filter((c) => c.status === "Won").length;
  const showRateMTD = callsBookedMTD ? Math.round((callsHeldMTD / callsBookedMTD) * 100) : 0;

  // Channel mix donut: leads by source MTD
  const channelMix = useMemo(() => {
    const map = new Map<string, number>();
    leads.filter((l) => inMonth(l.first_touch_date)).forEach((l) => {
      const k = l.lead_source ?? "Direct/Other";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);
  const totalLeads = channelMix.reduce((s, c) => s + c.value, 0);

  // Week pulse — real data with prev-7d deltas
  const pulse = useMemo(() => {
    const now = Date.now();
    const day = 86400_000;
    const cur7Start = new Date(now - 7 * day).toISOString().slice(0, 10);
    const prev7Start = new Date(now - 14 * day).toISOString().slice(0, 10);
    const prev7End = cur7Start;

    const leadRowsCur = leads.filter((l) => l.first_touch_date && l.first_touch_date >= cur7Start).length;
    const leadRowsPrev = leads.filter((l) => l.first_touch_date && l.first_touch_date >= prev7Start && l.first_touch_date < prev7End).length;
    const formsCur = forms.filter((f: any) => {
      const d = (f.submitted_at ?? f.created_at ?? "").slice(0, 10);
      return d && d >= cur7Start;
    }).length;
    const formsPrev = forms.filter((f: any) => {
      const d = (f.submitted_at ?? f.created_at ?? "").slice(0, 10);
      return d && d >= prev7Start && d < prev7End;
    }).length;
    const newLeadsCur = leadRowsCur + formsCur;
    const newLeadsPrev = leadRowsPrev + formsPrev;

    const callsCur = calls.filter((c) => c.call_date && c.call_date >= cur7Start).length;
    const callsPrev = calls.filter((c) => c.call_date && c.call_date >= prev7Start && c.call_date < prev7End).length;

    let spendCur = 0, spendPrev = 0, metaLeadsCur = 0, metaLeadsPrev = 0;
    for (const r of metaInsights as any[]) {
      const d = r.snapshot_date as string;
      if (!d) continue;
      if (d >= cur7Start) {
        spendCur += Number(r.spend ?? 0);
        metaLeadsCur += Number(r.leads ?? 0);
      } else if (d >= prev7Start && d < prev7End) {
        spendPrev += Number(r.spend ?? 0);
        metaLeadsPrev += Number(r.leads ?? 0);
      }
    }
    const cplCur = metaLeadsCur ? spendCur / metaLeadsCur : 0;
    const cplPrev = metaLeadsPrev ? spendPrev / metaLeadsPrev : 0;

    const pctDelta = (cur: number, prev: number) => {
      if (!prev) return cur > 0 ? "New" : "—";
      const pct = Math.round(((cur - prev) / prev) * 100);
      return `${pct >= 0 ? "+" : ""}${pct}% vs prev 7d`;
    };
    const absDelta = (cur: number, prev: number) => {
      const diff = cur - prev;
      return `${diff >= 0 ? "+" : ""}${diff} vs prev`;
    };

    return {
      newLeads: newLeadsCur,
      newLeadsDelta: pctDelta(newLeadsCur, newLeadsPrev),
      callsBooked: callsCur,
      callsBookedDelta: absDelta(callsCur, callsPrev),
      adSpend: spendCur,
      adSpendDelta: pctDelta(spendCur, spendPrev),
      cpl: cplCur,
      cplDelta: cplPrev ? pctDelta(cplCur, cplPrev) : "—",
      cplTone: (cplPrev && cplCur <= cplPrev ? "sage" : undefined) as "sage" | undefined,
    };
  }, [leads, forms, calls, metaInsights]);

  const sparkData = useMemo(() => {
    const days: { day: string; leads: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = isoDate(daysAgo(i));
      const leadCount = leads.filter((l) => l.first_touch_date === d).length;
      const formCount = forms.filter((f: any) => (f.submitted_at ?? f.created_at ?? "").slice(0, 10) === d).length;
      days.push({ day: d, leads: leadCount + formCount });
    }
    return days;
  }, [leads, forms]);

  // Active campaigns list (top 4, Live first)
  const activeCampaigns = useMemo(() => {
    const live = campaigns.filter((c) => c.status === "Live");
    const warming = campaigns.filter((c) => c.status === "Warming");
    const others = campaigns.filter((c) => !["Live", "Warming"].includes(c.status ?? ""));
    return [...live, ...warming, ...others].slice(0, 4);
  }, [campaigns]);

  const topContent = useMemo(() => {
    return content
      .filter((c) => in30(c.publish_date) || (c.publish_date == null && (c.leads_attributed ?? 0) > 0))
      .sort((a, b) => (b.leads_attributed ?? 0) - (a.leads_attributed ?? 0))
      .slice(0, 5);
  }, [content]);

  const recentLeads = leads.slice(0, 6);
  const recentBookings = calls.slice(0, 6);

  return (
    <PageShell>
      <PageHeader
        title="Momentum Command Center"
        subtitle="Marketing Operations · April 2026"
        rightStatus="All channels reporting"
        rightDate={`${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · Last sync 6 min ago`}
        rightSlot={
          <Link
            to="/admin"
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-ink-muted hover:text-gold transition-colors"
          >
            <Settings className="h-3 w-3" />
            Admin
          </Link>
        }
      />

      {/* The Funnel */}
      <SectionTitle title="The Funnel" meta="Month to date · Click any stage" />
      <MCCard className="p-3 sm:p-6 mb-6 lg:mb-9 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 divide-y divide-line-soft sm:divide-y-0 sm:divide-x">
          <FunnelStage label="Leads Captured" value={fmtNum(leadsMTD)} trend="Month to date" tone="gold" />
          <FunnelStage
            label="Calls Booked"
            value={fmtNum(callsBookedMTD)}
            trend="Month to date"
            tone="sage"
            highlighted
            onClick={() => navigate({ to: "/campaigns" })}
          />
          <FunnelStage label="Calls Held" value={fmtNum(callsHeldMTD)} trend={`${showRateMTD}% show rate`} tone="amber" />
          <FunnelStage label="RIC Enrolled" value={fmtNum(enrolledMTD)} trend="Month to date" tone="burgundy" />
        </div>
      </MCCard>

      {/* Three column row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_1.1fr] gap-4 lg:gap-6 mb-6 lg:mb-9">
        {/* Channel Mix */}
        <MCCard>
          <CardHeader title="Channel Mix" meta="Where leads came from" />
          <div className="p-6">
            <div className="relative h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelMix.length ? channelMix : [{ name: "—", value: 1 }]}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {channelMix.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1F2937",
                      border: "none",
                      borderRadius: 8,
                      color: "#F7F3EC",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="num-serif text-[28px] text-ink leading-none">{totalLeads}</div>
                <div className="label-eyebrow mt-1">Leads MTD</div>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {channelMix.length === 0 && <div className="text-[12px] text-ink-muted">No leads yet this month.</div>}
              {channelMix.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="text-ink-soft">{c.name}</span>
                  </div>
                  <div className="text-ink">
                    {c.value}
                    <span className="text-ink-muted ml-2">{Math.round((c.value / totalLeads) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </MCCard>

        {/* Week Pulse */}
        <MCCard>
          <CardHeader title="Week Pulse" meta="7d trend" />
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3">
              <SmallTile label="New Leads" value={fmtNum(pulse.newLeads)} delta={pulse.newLeadsDelta} />
              <SmallTile label="Calls Booked" value={fmtNum(pulse.callsBooked)} delta={pulse.callsBookedDelta} />
              <SmallTile label="Ad Spend" value={fmtUSD(pulse.adSpend)} delta={pulse.adSpendDelta} />
              <SmallTile label="Cost / Lead" value={`$${pulse.cpl.toFixed(2)}`} delta={pulse.cplDelta} tone={pulse.cplTone} />
            </div>
            <div className="mt-5 h-[60px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <Line type="monotone" dataKey="leads" stroke="#C4924A" strokeWidth={2} dot={false} />
                  <Tooltip contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              <span>7d ago</span>
              <span>Today</span>
            </div>
          </div>
        </MCCard>

        {/* Active Campaigns */}
        <MCCard hoverable onClick={() => navigate({ to: "/campaigns" })}>
          <CardHeader title="Active Campaigns" meta="Click to drill in →" />
          <div className="p-3">
            {activeCampaigns.map((c) => (
              <div
                key={c.id}
                onClick={(e) => { e.stopPropagation(); navigate({ to: "/campaigns/$id", params: { id: c.id } }); }}
                className="flex items-center justify-between rounded-lg px-3 py-3 mc-row-hover"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={c.status ?? "Live"} />
                  </div>
                  <div className="text-[13px] font-medium text-ink truncate">{c.name}</div>
                  <div className="text-[11px] text-ink-muted truncate">
                    {c.start_date ? `${fmtDate(c.start_date)} → ${c.end_date ? fmtDate(c.end_date) : "ongoing"}` : c.primary_channel}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="num-serif text-[22px] text-ink leading-none">
                    {c.spend_to_date ? fmtUSD(Number(c.spend_to_date)) : (c.lead_goal ?? "—")}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted mt-1">
                    {c.spend_to_date ? "Spend" : "Lead goal"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MCCard>
      </div>

      {/* Channels — YouTube, Meta, LinkedIn, Kajabi */}
      <SectionTitle title="Channels" meta="Click any widget to drill down" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-9">
        <YouTubeWidget />
        <MetaAdsWidget />
        <LinkedInWidget account="Christine" />
        <LinkedInWidget account="Mark" />
        <KajabiWidget />
        <PodcastWidget />
      </div>

      {/* Recent activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-9">
        <MCCard>
          <CardHeader
            title="Recent Leads"
            meta={
              <Link to="/leads" className="text-gold hover:underline">
                Manage all leads →
              </Link>
            }
          />
          <div className="p-2">
            {recentLeads.map((l, i) => (
              <Link
                key={l.id}
                to="/leads"
                className="flex items-center gap-3 px-4 py-3 mc-row-hover rounded-lg"
              >
                <Avatar name={l.name} idx={i} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink font-medium truncate">{l.name}</div>
                  <div className="text-[11px] text-ink-muted">
                    {l.lead_source ? (
                      <>{l.lead_source} · {l.opt_in}</>
                    ) : (
                      <span className="text-burgundy font-medium">⚠ No source set</span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-ink-muted">{timeAgo(l.created_at)}</div>
              </Link>
            ))}
          </div>
        </MCCard>
        <MCCard>
          <CardHeader title="Recent Bookings" meta="Calls on calendar" />
          <div className="p-2">
            {recentBookings.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 mc-row-hover rounded-lg">
                <Avatar name={c.name} idx={i} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-ink-muted">
                    {c.call_type ?? "Discovery Call"} · {fmtDate(c.call_date)} · {c.lead_source}
                  </div>
                </div>
                <StatusBadge status={c.status ?? "Pending"} />
              </div>
            ))}
          </div>
        </MCCard>
      </div>

      <div className="mc-card border-dashed border-2 border-line bg-transparent shadow-none p-5 text-center">
        <p className="text-[12px] text-ink-muted">
          Top-level dashboard. Click <span className="text-gold font-medium">Calls Booked</span> in the funnel,
          or <span className="text-gold font-medium">Active Campaigns</span>, to drill into the Campaign Performance view.
        </p>
      </div>
    </PageShell>
  );
}

function FunnelStage({
  label, value, trend, tone, highlighted, onClick,
}: { label: string; value: string; trend: string; tone: "gold" | "sage" | "amber" | "burgundy"; highlighted?: boolean; onClick?: () => void }) {
  const colors: Record<string, string> = { gold: "var(--gold)", sage: "var(--sage)", amber: "var(--amber)", burgundy: "var(--burgundy)" };
  return (
    <div
      onClick={onClick}
      className={`px-3 py-3 sm:px-6 sm:py-4 ${highlighted ? "bg-cream-deep" : ""} ${onClick ? "cursor-pointer hover:bg-cream-deep transition-colors" : ""}`}
    >
      <div className="label-eyebrow flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors[tone] }} />
        {label}
      </div>
      <div className="num-serif text-[26px] sm:text-[32px] lg:text-[38px] mt-1.5 sm:mt-2 leading-none text-ink">{value}</div>
      <div className="text-[10px] sm:text-[11px] text-ink-muted mt-1.5 sm:mt-2">{trend}</div>
    </div>
  );
}

function SmallTile({ label, value, delta, tone = "gold" }: { label: string; value: string; delta: string; tone?: "gold" | "sage" }) {
  return (
    <div className="rounded-lg bg-cream px-3 py-3 border border-line-soft">
      <div className="label-eyebrow text-[9px]">{label}</div>
      <div className="num-serif text-[26px] leading-none text-ink mt-1.5">{value}</div>
      <div className={`text-[10px] mt-1.5 ${tone === "sage" ? "text-sage" : "text-ink-muted"}`}>{delta}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`label-eyebrow px-6 py-3 ${right ? "text-right" : "text-left"} bg-cream/60`}>
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-6 py-4 num-serif text-[17px] text-ink ${right ? "text-right" : ""}`}>
      {children}
    </td>
  );
}

function EffectText({ effect }: { effect: string }) {
  const tones: Record<string, string> = {
    High: "text-sage",
    Medium: "text-gold",
    Low: "text-burgundy",
    Untracked: "text-ink-muted",
  };
  return <span className={`text-[12px] font-semibold uppercase tracking-[0.1em] ${tones[effect] ?? "text-ink-muted"}`}>{effect}</span>;
}
