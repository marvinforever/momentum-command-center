import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard, CardHeader, KpiTile, ChannelBadge } from "@/components/mc/Primitives";
import { useCampaigns, useDiscoveryCalls, useLeads, monthFilter } from "@/lib/queries";
import { fmtNum, fmtUSD, fmtPct } from "@/lib/format";
import { useMemo } from "react";

export const Route = createFileRoute("/campaigns/")({
  head: () => ({ meta: [{ title: "Campaign Performance — Momentum" }] }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const navigate = useNavigate();
  const { data: campaigns = [] } = useCampaigns();
  const { data: leads = [] } = useLeads();
  const { data: calls = [] } = useDiscoveryCalls();

  const month = monthFilter();
  const inMonth = (d: string | null) => !!d && d >= month.from && d <= month.to;

  const rows = useMemo(() => campaigns.map((c) => {
    const cLeads = leads.filter((l) => l.campaign_id === c.id);
    const optIns = cLeads.length;
    const cLeadIds = new Set(cLeads.map((l) => l.id));
    const cCalls = calls.filter((dc) => dc.lead_id && cLeadIds.has(dc.lead_id));
    const booked = cCalls.length;
    const attended = cCalls.filter((dc) => ["Won", "Lost", "Not a Fit"].includes(dc.status ?? "")).length;
    const closed = cCalls.filter((dc) => dc.status === "Won").length;
    const followUp = cCalls.filter((dc) => (dc.follow_up_actions ?? []).some((a: string) => /F\/U Call/i.test(a))).length;
    const noSale = cCalls.filter((dc) => dc.status === "Lost").length;
    const showRate = booked ? (attended / booked) * 100 : 0;
    const closeRate = attended ? (closed / attended) * 100 : 0;
    const spend = Number(c.spend_to_date ?? 0);
    const cpl = optIns && spend ? spend / optIns : null;
    return {
      id: c.id,
      name: c.name,
      channel: c.primary_channel ?? "Other",
      optIns,
      clickRate: 3.4, // hardcoded for v1
      spend,
      booked,
      attended,
      closed,
      followUp,
      noSale,
      showRate,
      closeRate,
      cpl,
    };
  }), [campaigns, leads, calls]);

  const totals = rows.reduce((t, r) => ({
    optIns: t.optIns + r.optIns,
    spend: t.spend + r.spend,
    booked: t.booked + r.booked,
    attended: t.attended + r.attended,
    closed: t.closed + r.closed,
    followUp: t.followUp + r.followUp,
    noSale: t.noSale + r.noSale,
  }), { optIns: 0, spend: 0, booked: 0, attended: 0, closed: 0, followUp: 0, noSale: 0 });

  const tShow = totals.booked ? (totals.attended / totals.booked) * 100 : 0;
  const tClose = totals.attended ? (totals.closed / totals.attended) * 100 : 0;
  const tCpl = totals.optIns ? totals.spend / totals.optIns : 0;

  // KPIs MTD
  const leadsMTD = leads.filter((l) => inMonth(l.first_touch_date)).length;
  const callsMTD = calls.filter((c) => inMonth(c.call_date));
  const bookedMTD = callsMTD.length;
  const attendedMTD = callsMTD.filter((c) => ["Won", "Lost", "Not a Fit"].includes(c.status ?? "")).length;
  const closedMTD = callsMTD.filter((c) => c.status === "Won").length;
  const showMTD = bookedMTD ? (attendedMTD / bookedMTD) * 100 : 0;
  const closeMTD = attendedMTD ? (closedMTD / attendedMTD) * 100 : 0;
  const activeCount = campaigns.filter((c) => c.status === "Live" || c.status === "Warming").length;

  return (
    <PageShell>
      <PageHeader
        title="Campaign Performance"
        subtitle="All Campaigns · Live Overview · April 2026"
        rightStatus={`${activeCount} active campaigns`}
        rightDate="Updated 6 min ago"
        breadcrumbs={[{ label: "Command Center", to: "/" }, { label: "Campaign Performance" }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 mb-6 lg:mb-9">
        <KpiTile label="Total Opt-Ins" value={fmtNum(leadsMTD)} trend="+22.6% vs March" tone="gold" />
        <KpiTile label="Total Clicks" value="2,142" trend="+15.4% vs March" tone="gold" />
        <KpiTile label="Calls Booked" value={fmtNum(bookedMTD)} trend="+10.7% vs March" tone="sage" />
        <KpiTile label="Calls Attended" value={fmtNum(attendedMTD)} trend="On pace" tone="sage" />
        <KpiTile label="Show Rate" value={fmtPct(showMTD, 0)} trend="+3.2 pts" tone="amber" />
        <KpiTile label="Total Closed" value={fmtNum(closedMTD)} trend="+1 vs March" tone="burgundy" />
        <KpiTile label="Close Rate" value={fmtPct(closeMTD, 0)} trend="Strong" tone="burgundy" />
      </div>

      <MCCard className="mb-9 overflow-x-auto">
        <CardHeader title="Active Campaign Snapshot" meta="Click any row to drill in" />
        <table className="w-full min-w-[1280px]">
          <thead>
            <tr>
              {["Campaign Name", "Channel", "Opt-Ins", "Click Rate", "Ad Spend", "Calls Booked", "Calls Attended", "Closed", "Follow Up", "No Sale", "Show Rate", "Close Rate", "Cost / Lead"].map((h, i) => (
                <th key={h} className={`label-eyebrow px-4 py-3 sticky top-0 bg-cream ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => navigate({ to: "/campaigns/$id", params: { id: r.id } })}
                className="border-t border-line-soft mc-row-hover"
              >
                <td className="px-4 py-4 text-[13px] font-medium text-ink">{r.name}</td>
                <td className="px-4 py-4"><ChannelBadge channel={r.channel} /></td>
                <NumCell v={fmtNum(r.optIns)} />
                <NumCell v={fmtPct(r.clickRate)} colored={r.clickRate} />
                <NumCell v={r.spend ? fmtUSD(r.spend) : "—"} />
                <NumCell v={fmtNum(r.booked)} />
                <NumCell v={fmtNum(r.attended)} />
                <NumCell v={fmtNum(r.closed)} />
                <NumCell v={fmtNum(r.followUp)} />
                <NumCell v={fmtNum(r.noSale)} />
                <NumCell v={fmtPct(r.showRate, 0)} colored={r.showRate} />
                <NumCell v={fmtPct(r.closeRate, 0)} colored={r.closeRate} />
                <NumCell v={r.cpl !== null ? `$${r.cpl.toFixed(2)}` : "—"} />
              </tr>
            ))}
            <tr className="border-t border-line bg-cream-deep font-semibold">
              <td className="px-4 py-4 text-[13px]">TOTALS</td>
              <td className="px-4 py-4" />
              <NumCell v={fmtNum(totals.optIns)} bold />
              <NumCell v={fmtPct(rows.length ? rows.reduce((s, r) => s + r.clickRate, 0) / rows.length : 0)} bold />
              <NumCell v={fmtUSD(totals.spend)} bold />
              <NumCell v={fmtNum(totals.booked)} bold />
              <NumCell v={fmtNum(totals.attended)} bold />
              <NumCell v={fmtNum(totals.closed)} bold />
              <NumCell v={fmtNum(totals.followUp)} bold />
              <NumCell v={fmtNum(totals.noSale)} bold />
              <NumCell v={fmtPct(tShow, 0)} bold />
              <NumCell v={fmtPct(tClose, 0)} bold />
              <NumCell v={tCpl ? `$${tCpl.toFixed(2)}` : "—"} bold />
            </tr>
          </tbody>
        </table>
      </MCCard>

      <MCCard className="border-l-4 border-l-gold p-7">
        <h3 className="serif text-[22px] text-ink">Notes &amp; Next Steps</h3>
        <p className="label-eyebrow mt-1">Christine + Mark · Tuesday review</p>
        <p className="text-[14px] text-ink-soft mt-4 leading-relaxed">
          Strong month for the RIC April Cohort Push. Five enrollments out of fourteen booked calls is a strong close rate even with a partial cohort. Multi-channel attribution working as designed.
        </p>
        <ul className="mt-4 space-y-2 text-[13.5px] text-ink-soft leading-relaxed list-disc pl-5 marker:text-gold">
          <li>Connection Code Promo CPL ($23) is below target ($25). Continue current ad creative through May.</li>
          <li>Q2 Podcast Tour driving high-intent leads. Faith &amp; Marriage appearance attribution exceeded forecast. Christine should green-light 2 more bookings for May.</li>
          <li>LinkedIn Daily Posting converting at expected rate. Word swap carousels outperforming text-only 3:1. Lean into carousel format.</li>
          <li>YouTube Evergreen is the long tail. Low immediate conversion but compounds over months. Keep producing.</li>
          <li>RIC May cohort push begins May 5. Need to confirm Three Thieves VSL refresh by May 2.</li>
        </ul>
      </MCCard>
    </PageShell>
  );
}

function NumCell({ v, colored, bold }: { v: string; colored?: number; bold?: boolean }) {
  let cls = "text-ink";
  if (typeof colored === "number") {
    if (colored > 60) cls = "text-sage";
    else if (colored >= 40) cls = "text-amber";
    else cls = "text-burgundy";
  }
  return <td className={`px-4 py-4 text-right num-serif text-[16px] ${cls} ${bold ? "font-semibold" : ""}`}>{v}</td>;
}
