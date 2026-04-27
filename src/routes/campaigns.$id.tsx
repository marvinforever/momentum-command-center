import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard, CardHeader, KpiTile, StatusBadge, ChannelBadge } from "@/components/mc/Primitives";
import { useCampaign, useLeads, useDiscoveryCalls, useContent } from "@/lib/queries";
import { fmtNum, fmtUSD, fmtPct, fmtDate, isoDate } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/campaigns/$id")({
  head: () => ({ meta: [{ title: "Campaign Detail — Momentum" }] }),
  component: CampaignDetail,
});

function CampaignDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id);
  const { data: leads = [] } = useLeads();
  const { data: calls = [] } = useDiscoveryCalls();
  const { data: content = [] } = useContent();

  const cLeads = useMemo(() => leads.filter((l) => l.campaign_id === id), [leads, id]);
  const cLeadIds = useMemo(() => new Set(cLeads.map((l) => l.id)), [cLeads]);
  const cCalls = useMemo(() => calls.filter((dc) => dc.lead_id && cLeadIds.has(dc.lead_id)), [calls, cLeadIds]);
  const cContent = useMemo(() => content.filter((c) => c.campaign_id === id), [content, id]);

  const optIns = cLeads.length;
  const booked = cCalls.length;
  const held = cCalls.filter((c) => ["Won", "Lost", "Not a Fit"].includes(c.status ?? "")).length;
  const closed = cCalls.filter((c) => c.status === "Won").length;
  const showRate = booked ? (held / booked) * 100 : 0;
  const closeRate = held ? (closed / held) * 100 : 0;
  const spend = Number(campaign?.spend_to_date ?? 0);
  const offerPrice = Number((campaign as any)?.offers?.price ?? 0);
  const revenue = closed * offerPrice;

  const dailyData = useMemo(() => {
    if (!campaign?.start_date) return [];
    const start = new Date(campaign.start_date as string);
    const today = new Date();
    const out: { day: string; leads: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const k = isoDate(cursor);
      out.push({ day: k.slice(5), leads: cLeads.filter((l) => l.first_touch_date === k).length });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [cLeads, campaign?.start_date]);

  if (isLoading) {
    return <PageShell><div className="text-ink-muted serif text-xl">Loading campaign…</div></PageShell>;
  }
  if (!campaign) {
    return <PageShell><div className="text-ink-muted serif text-xl">Campaign not found.</div></PageShell>;
  }

  const shortId = "CAMP-" + (id.slice(0, 4).toUpperCase());

  return (
    <PageShell>
      <PageHeader
        title="Campaign Detail"
        subtitle={(campaign.primary_channel ?? "—") + " · " + (campaign.type ?? "")}
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Campaign Performance", to: "/campaigns" },
          { label: campaign.name },
        ]}
      />

      <MCCard className="mb-6 lg:mb-7">
        <div className="h-[5px]" style={{ background: "linear-gradient(90deg, var(--gold), var(--sage), var(--burgundy))" }} />
        <div className="p-4 sm:p-6 lg:p-7">
          <h2 className="serif text-[24px] sm:text-[30px] lg:text-[36px] text-ink leading-tight">{campaign.name}</h2>
          <div className="mt-3 flex items-center gap-2 sm:gap-3 text-[12px] text-ink-muted flex-wrap">
            <span>{shortId}</span><span className="hidden sm:inline">·</span>
            <StatusBadge status={campaign.status ?? "Live"} />
            <span className="hidden sm:inline">·</span>
            <ChannelBadge channel={campaign.primary_channel ?? "Other"} />
            <span className="hidden sm:inline">·</span>
            <span>{campaign.start_date ? fmtDate(campaign.start_date) : "—"} → {campaign.end_date ? fmtDate(campaign.end_date) : "ongoing"}</span>
          </div>
          <div className="border-t border-line-soft mt-5 pt-5 text-[13px] sm:text-[14px] text-ink-soft leading-relaxed">
            {campaign.goal ?? `Driving ${campaign.lead_goal ?? "—"} qualified opt-ins toward ${(campaign as any).offers?.name ?? "the offer"} via ${campaign.primary_channel?.toLowerCase() ?? "multi-channel"} efforts.`}
          </div>
        </div>
      </MCCard>

      <div className="grid grid-cols-7 gap-3 mb-9">
        <KpiTile label="Opt-Ins" value={fmtNum(optIns)} trend={campaign.lead_goal ? `vs goal of ${campaign.lead_goal}` : ""} tone="gold" />
        <KpiTile label="Click Rate" value="3.4%" trend="—" tone="gold" />
        <KpiTile label="Calls Booked" value={fmtNum(booked)} trend={campaign.booking_goal ? `vs goal of ${campaign.booking_goal}` : ""} tone="sage" />
        <KpiTile label="Calls Held" value={fmtNum(held)} trend={`${booked - held} pending`} tone="sage" />
        <KpiTile label="Show Rate" value={fmtPct(showRate, 0)} trend="—" tone="amber" />
        <KpiTile label="Closed" value={fmtNum(closed)} trend={campaign.enrollment_goal ? `vs goal of ${campaign.enrollment_goal}` : ""} tone="burgundy" />
        <KpiTile label="Close Rate" value={fmtPct(closeRate, 0)} trend="—" tone="burgundy" />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-6 mb-9">
        <MCCard>
          <CardHeader title="Daily Lead Acquisition" meta="Opt-Ins by day · campaign to date" />
          <div className="p-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid stroke="#F0EAE0" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#8A8275", fontSize: 11 }} axisLine={{ stroke: "#E5DFD3" }} tickLine={false} />
                <YAxis tick={{ fill: "#8A8275", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 12 }} />
                <Bar dataKey="leads" fill="#C4924A" radius={[6, 6, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MCCard>

        <MCCard>
          <CardHeader title="Campaign Snapshot" />
          <div className="p-6">
            <SnapRow label="Budget" v={campaign.budget ? fmtUSD(Number(campaign.budget)) : "—"} />
            <SnapRow label="Spend to date" v={fmtUSD(spend)} />
            <SnapRow label="Cost / Lead" v={optIns && spend ? `$${(spend / optIns).toFixed(2)}` : "—"} />
            <SnapRow label="Cost / Booked Call" v={booked && spend ? `$${(spend / booked).toFixed(2)}` : "—"} />
            <SnapRow label="Cost / Enrollment" v={closed && spend ? `$${(spend / closed).toFixed(2)}` : "—"} />
            <SnapRow label="Revenue Generated" v={revenue ? fmtUSD(revenue) : "—"} last />
          </div>
        </MCCard>
      </div>

      <MCCard className="mb-9">
        <CardHeader title="Content Driving This Campaign" meta="Attribution by piece" />
        <table className="w-full">
          <thead>
            <tr className="bg-cream/60">
              <th className="label-eyebrow px-6 py-3 text-left">Content</th>
              <th className="label-eyebrow px-6 py-3 text-left">Channel</th>
              <th className="label-eyebrow px-6 py-3 text-right">Reach</th>
              <th className="label-eyebrow px-6 py-3 text-right">Leads Attributed</th>
              <th className="label-eyebrow px-6 py-3 text-right">Calls</th>
            </tr>
          </thead>
          <tbody>
            {cContent.map((c) => (
              <tr key={c.id} className="border-t border-line-soft mc-row-hover">
                <td className="px-6 py-4">
                  <div className="text-[14px] text-ink font-medium">{c.title}</div>
                  <div className="text-[11px] text-ink-muted mt-0.5">{c.publish_date ? fmtDate(c.publish_date) : "Evergreen"} · {c.format ?? "—"}</div>
                </td>
                <td className="px-6 py-4"><ChannelBadge channel={c.channel ?? "Other"} /></td>
                <td className="px-6 py-4 text-right num-serif text-[17px] text-ink">{fmtNum(c.reach)}</td>
                <td className="px-6 py-4 text-right num-serif text-[17px] text-ink">{fmtNum(c.leads_attributed)}</td>
                <td className="px-6 py-4 text-right num-serif text-[17px] text-ink-muted">—</td>
              </tr>
            ))}
            {cContent.length === 0 && <tr><td colSpan={5} className="text-center text-ink-muted py-12 text-[13px]">No content attributed yet.</td></tr>}
          </tbody>
        </table>
      </MCCard>

      <MCCard className="mb-9">
        <CardHeader title="Booked Calls from This Campaign" meta={`${cCalls.length} call${cCalls.length === 1 ? "" : "s"}`} />
        <table className="w-full">
          <thead>
            <tr className="bg-cream/60">
              <th className="label-eyebrow px-6 py-3 text-left">Lead</th>
              <th className="label-eyebrow px-6 py-3 text-left">Booked</th>
              <th className="label-eyebrow px-6 py-3 text-left">Source</th>
              <th className="label-eyebrow px-6 py-3 text-left">Outcome</th>
              <th className="label-eyebrow px-6 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {cCalls.map((c) => (
              <tr key={c.id} className="border-t border-line-soft">
                <td className="px-6 py-4 text-[13px] text-ink font-medium">{c.name}</td>
                <td className="px-6 py-4 text-[13px] text-ink-soft">{fmtDate(c.call_date)}</td>
                <td className="px-6 py-4"><ChannelBadge channel={c.lead_source ?? "Other"} /></td>
                <td className="px-6 py-4 text-[13px] text-ink-soft">{c.notes ?? "—"}</td>
                <td className="px-6 py-4 text-right"><StatusBadge status={c.status ?? "Pending"} /></td>
              </tr>
            ))}
            {cCalls.length === 0 && <tr><td colSpan={5} className="text-center text-ink-muted py-12 text-[13px]">No calls booked through this campaign yet.</td></tr>}
          </tbody>
        </table>
      </MCCard>

      <MCCard className="border-l-4 border-l-gold p-7">
        <div className="flex items-end justify-between">
          <h3 className="serif text-[22px] text-ink">Campaign Notes</h3>
          <span className="label-eyebrow">Updated {fmtDate(campaign.created_at)}</span>
        </div>
        <p className="text-[14px] text-ink-soft mt-4 leading-relaxed whitespace-pre-wrap">
          {campaign.notes ?? "No notes yet. Add context, decisions, and follow-ups in the admin form."}
        </p>
      </MCCard>
    </PageShell>
  );
}

function SnapRow({ label, v, last }: { label: string; v: string; last?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-3 ${last ? "" : "border-b border-line-soft"}`}>
      <div className="text-[12px] text-ink-muted">{label}</div>
      <div className="num-serif text-[22px] text-ink">{v}</div>
    </div>
  );
}
