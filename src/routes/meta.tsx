import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard, CardHeader, StatusPill } from "@/components/mc/Primitives";
import {
  useMetaCampaigns,
  useMetaAdSets,
  useMetaAds,
  useMetaAd,
  useMetaAdsInsightsDaily,
} from "@/lib/queries";
import { fmtNum, fmtUSD, fmtPct, fmtDate } from "@/lib/format";
import { aggregateMetaMetrics, groupMetaMetricsBy } from "@/lib/metaMetrics";
import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChevronRight, ExternalLink, ArrowLeft, ImageOff } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  campaign: z.string().optional(),
  adset: z.string().optional(),
  ad: z.string().optional(),
});

const emptyMetaTotals = {
  spend: 0,
  leads: 0,
  clicks: 0,
  impressions: 0,
  reach: 0,
  cpl: null,
  ctr: null,
};

export const Route = createFileRoute("/meta")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Meta Ads — Momentum" }] }),
  component: MetaPage,
});

function MetaPage() {
  const search = useSearch({ from: "/meta" }) as z.infer<typeof searchSchema>;

  return (
    <PageShell>
      <PageHeader
        title="Meta Ads"
        subtitle="Drill down from campaigns → ad sets → individual ads."
      />
      {search.ad ? (
        <AdDetailView adId={search.ad} backTo={{ campaign: search.campaign, adset: search.adset }} />
      ) : search.adset ? (
        <AdSetView adsetId={search.adset} campaignId={search.campaign} />
      ) : search.campaign ? (
        <CampaignView campaignId={search.campaign} />
      ) : (
        <CampaignList />
      )}
    </PageShell>
  );
}

// ============================================================================
// LEVEL 1: All campaigns
// ============================================================================
function CampaignList() {
  const { data: campaigns = [], isLoading } = useMetaCampaigns();
  const { data: daily = [] } = useMetaAdsInsightsDaily({ days: 30 });

  const rows = useMemo(() => {
    const totals = groupMetaMetricsBy(daily, "meta_campaign_id");
    return campaigns.map((c) => {
      const t = totals.get(c.meta_campaign_id) ?? emptyMetaTotals;
      return {
        ...c,
        ...t,
      };
    }).sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  }, [campaigns, daily]);

  return (
    <MCCard className="mt-6">
      <CardHeader title="Campaigns" meta={`${rows.length} total · last 30 days`} />
      {isLoading ? (
        <div className="p-6 text-[12px] text-ink-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-[12px] text-ink-muted">No campaigns yet. Run a sync from the dashboard.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-cream-deep text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              <tr>
                <Th>Campaign</Th>
                <Th>Status</Th>
                <Th align="right">Spend</Th>
                <Th align="right">Leads</Th>
                <Th align="right">CPL</Th>
                <Th align="right">CTR</Th>
                <Th align="right">Impressions</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line-soft hover:bg-cream-deep/50">
                  <Td>
                    <Link to="/meta" search={{ campaign: c.meta_campaign_id }} className="font-medium text-ink hover:text-gold">
                      {c.name}
                    </Link>
                    <div className="text-[10px] text-ink-muted mt-0.5">{c.objective ?? "—"}</div>
                  </Td>
                  <Td><CampaignStatus status={c.status} /></Td>
                  <Td align="right">{fmtUSD(c.spend)}</Td>
                  <Td align="right">{fmtNum(c.leads)}</Td>
                  <Td align="right">{c.cpl !== null ? `$${c.cpl.toFixed(2)}` : "—"}</Td>
                  <Td align="right">{c.ctr !== null ? fmtPct(c.ctr, 2) : "—"}</Td>
                  <Td align="right">{fmtNum(c.impressions)}</Td>
                  <Td><ChevronRight className="h-4 w-4 text-ink-muted" /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MCCard>
  );
}

// ============================================================================
// LEVEL 2: Single campaign → ad sets
// ============================================================================
function CampaignView({ campaignId }: { campaignId: string }) {
  const { data: campaigns = [] } = useMetaCampaigns();
  const { data: adsets = [] } = useMetaAdSets(campaignId);
  const { data: ads = [], isLoading: adsLoading } = useMetaAds({ campaignId });
  const { data: campaignInsights = [] } = useMetaAdsInsightsDaily({ campaignId, days: 30 });

  const campaign = campaigns.find((c) => c.meta_campaign_id === campaignId);

  const totals = useMemo(() => {
    return aggregateMetaMetrics(campaignInsights);
  }, [campaignInsights]);

  const adRows = useMemo(() => {
    const tot = groupMetaMetricsBy(campaignInsights, "meta_ad_id");
    return ads
      .map((a) => ({
        ...a,
        ...(tot.get(a.meta_ad_id) ?? emptyMetaTotals),
      }))
      .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  }, [ads, campaignInsights]);

  const adsetRows = useMemo(() => {
    const tot = groupMetaMetricsBy(campaignInsights, "meta_adset_id");
    return adsets
      .map((a) => ({
        ...a,
        ...(tot.get(a.meta_adset_id) ?? emptyMetaTotals),
      }))
      .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  }, [adsets, campaignInsights]);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-2 text-[12px] text-ink-muted">
        <Link to="/meta" search={{}} className="flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> All campaigns
        </Link>
      </div>

      <MCCard>
        <CardHeader
          title={campaign?.name ?? "Campaign"}
          meta={
            <div className="flex items-center gap-3">
              <CampaignStatus status={campaign?.status} />
              {campaign?.objective && <span className="text-[10px] uppercase tracking-[0.14em]">{campaign.objective}</span>}
            </div>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-6">
          <Tile label="Spend (30d)" value={fmtUSD(totals.spend)} />
          <Tile label="Leads (30d)" value={fmtNum(totals.leads)} />
          <Tile label="CPL" value={totals.cpl !== null ? `$${totals.cpl.toFixed(2)}` : "—"} />
          <Tile label="CTR" value={totals.ctr !== null ? fmtPct(totals.ctr, 2) : "—"} />
          <Tile label="Impressions" value={fmtNum(totals.impressions)} />
        </div>
      </MCCard>

      {/* Primary drill-down: individual ads with creative previews */}
      <MCCard>
        <CardHeader
          title="Ads"
          meta={`${adRows.length} total · click any ad to see the creative & performance`}
        />
        {adsLoading ? (
          <div className="p-6 text-[12px] text-ink-muted">Loading…</div>
        ) : adRows.length === 0 ? (
          <div className="p-6 text-[12px] text-ink-muted">No ads found in this campaign.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {adRows.map((ad) => (
              <Link
                key={ad.id}
                to="/meta"
                search={{ campaign: campaignId, adset: ad.meta_adset_id, ad: ad.meta_ad_id }}
                className="block rounded-lg border border-line-soft hover:border-gold/40 hover:shadow-sm overflow-hidden transition bg-white"
              >
                <CreativePreview thumbnail={ad.thumbnail_url} image={ad.image_url} />
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-ink text-[13px] truncate">{ad.name}</div>
                    <CampaignStatus status={ad.effective_status ?? ad.status} small />
                  </div>
                  {ad.body && <div className="text-[11px] text-ink-muted line-clamp-2">{ad.body}</div>}
                  <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.12em] text-ink-muted pt-2 border-t border-line-soft">
                    <Mini label="Spend" value={fmtUSD(ad.spend)} />
                    <Mini label="Leads" value={fmtNum(ad.leads)} />
                    <Mini label="CPL" value={ad.cpl !== null ? `$${ad.cpl.toFixed(2)}` : "—"} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </MCCard>

      {/* Secondary: ad sets breakdown (collapsed by default if only one) */}
      {adsetRows.length > 1 && (
        <MCCard>
          <CardHeader title="Ad Sets" meta={`${adsetRows.length} total`} />
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-cream-deep text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                <tr>
                  <Th>Ad Set</Th>
                  <Th>Status</Th>
                  <Th>Optimization</Th>
                  <Th align="right">Spend</Th>
                  <Th align="right">Leads</Th>
                  <Th align="right">CPL</Th>
                  <Th align="right">CTR</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {adsetRows.map((a) => (
                  <tr key={a.id} className="border-t border-line-soft hover:bg-cream-deep/50">
                    <Td>
                      <Link to="/meta" search={{ campaign: campaignId, adset: a.meta_adset_id }} className="font-medium text-ink hover:text-gold">
                        {a.name}
                      </Link>
                    </Td>
                    <Td><CampaignStatus status={a.status} /></Td>
                    <Td><span className="text-[10px] text-ink-muted">{a.optimization_goal ?? "—"}</span></Td>
                    <Td align="right">{fmtUSD(a.spend)}</Td>
                    <Td align="right">{fmtNum(a.leads)}</Td>
                    <Td align="right">{a.cpl !== null ? `$${a.cpl.toFixed(2)}` : "—"}</Td>
                    <Td align="right">{a.ctr !== null ? fmtPct(a.ctr, 2) : "—"}</Td>
                    <Td><ChevronRight className="h-4 w-4 text-ink-muted" /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MCCard>
      )}
    </div>
  );
}

// ============================================================================
// LEVEL 3: Single ad set → ads
// ============================================================================
function AdSetView({ adsetId, campaignId }: { adsetId: string; campaignId?: string }) {
  const { data: adsets = [] } = useMetaAdSets(campaignId);
  const { data: ads = [], isLoading } = useMetaAds({ adsetId });
  const { data: adInsights = [] } = useMetaAdsInsightsDaily({ adsetId, days: 30 });

  const adset = adsets.find((a) => a.meta_adset_id === adsetId);

  const adRows = useMemo(() => {
    const tot = groupMetaMetricsBy(adInsights, "meta_ad_id");
    return ads
      .map((a) => ({
        ...a,
        ...(tot.get(a.meta_ad_id) ?? emptyMetaTotals),
      }))
      .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  }, [ads, adInsights]);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-2 text-[12px] text-ink-muted">
        <Link to="/meta" search={campaignId ? { campaign: campaignId } : {}} className="flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to campaign
        </Link>
      </div>

      <MCCard>
        <CardHeader
          title={adset?.name ?? "Ad Set"}
          meta={
            <div className="flex items-center gap-3">
              <CampaignStatus status={adset?.status} />
              {adset?.optimization_goal && <span className="text-[10px] uppercase tracking-[0.14em]">{adset.optimization_goal}</span>}
            </div>
          }
        />
      </MCCard>

      <MCCard>
        <CardHeader title="Ads" meta={`${adRows.length} total`} />
        {isLoading ? (
          <div className="p-6 text-[12px] text-ink-muted">Loading…</div>
        ) : adRows.length === 0 ? (
          <div className="p-6 text-[12px] text-ink-muted">No ads found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {adRows.map((ad) => (
              <Link
                key={ad.id}
                to="/meta"
                search={{ campaign: campaignId, adset: adsetId, ad: ad.meta_ad_id }}
                className="block rounded-lg border border-line-soft hover:border-gold/40 hover:shadow-sm overflow-hidden transition bg-white"
              >
                <CreativePreview thumbnail={ad.thumbnail_url} image={ad.image_url} />
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-ink text-[13px] truncate">{ad.name}</div>
                    <CampaignStatus status={ad.effective_status ?? ad.status} small />
                  </div>
                  {ad.body && <div className="text-[11px] text-ink-muted line-clamp-2">{ad.body}</div>}
                  <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.12em] text-ink-muted pt-2 border-t border-line-soft">
                    <Mini label="Spend" value={fmtUSD(ad.spend)} />
                    <Mini label="Leads" value={fmtNum(ad.leads)} />
                    <Mini label="CPL" value={ad.cpl !== null ? `$${ad.cpl.toFixed(2)}` : "—"} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </MCCard>
    </div>
  );
}

// ============================================================================
// LEVEL 4: Single ad detail
// ============================================================================
function AdDetailView({ adId, backTo }: { adId: string; backTo: { campaign?: string; adset?: string } }) {
  const { data: ad, isLoading } = useMetaAd(adId);
  const { data: insights = [] } = useMetaAdsInsightsDaily({ adId, days: 30 });

  const totals = useMemo(() => aggregateMetaMetrics(insights), [insights]);

  if (isLoading) return <div className="mt-6 text-[12px] text-ink-muted">Loading ad…</div>;
  if (!ad) return <div className="mt-6 text-[12px] text-ink-muted">Ad not found.</div>;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-2 text-[12px] text-ink-muted">
        <Link
          to="/meta"
          search={{ campaign: backTo.campaign, adset: backTo.adset }}
          className="flex items-center gap-1 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to ad set
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creative preview */}
        <MCCard className="lg:col-span-1">
          <CardHeader title="Creative" />
          <div className="p-4">
            <CreativePreview thumbnail={ad.thumbnail_url} image={ad.image_url} large />
            <div className="mt-4 space-y-3 text-[12px]">
              <Field label="Ad name" value={ad.name} />
              {ad.title && <Field label="Headline" value={ad.title} />}
              {ad.body && (
                <div>
                  <div className="label-eyebrow text-[9px] mb-1">Primary text</div>
                  <div className="text-ink whitespace-pre-wrap text-[12px] leading-relaxed">{ad.body}</div>
                </div>
              )}
              {ad.cta_type && <Field label="Call to action" value={ad.cta_type.replace(/_/g, " ")} />}
              {ad.link_url && (
                <div>
                  <div className="label-eyebrow text-[9px] mb-1">Destination URL</div>
                  <a href={ad.link_url} target="_blank" rel="noreferrer" className="text-gold hover:underline text-[12px] break-all">
                    {ad.link_url}
                  </a>
                </div>
              )}
              {ad.permalink_url && (
                <a
                  href={ad.permalink_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline mt-2"
                >
                  View on Facebook <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </MCCard>

        {/* Performance */}
        <div className="lg:col-span-2 space-y-6">
          <MCCard>
            <CardHeader title="Performance (last 30 days)" meta={<CampaignStatus status={ad.effective_status ?? ad.status} />} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6">
              <Tile label="Spend" value={fmtUSD(totals.spend)} />
              <Tile label="Leads" value={fmtNum(totals.leads)} />
              <Tile label="CPL" value={totals.cpl !== null ? `$${totals.cpl.toFixed(2)}` : "—"} />
              <Tile label="CTR" value={totals.ctr !== null ? fmtPct(totals.ctr, 2) : "—"} />
              <Tile label="Impressions" value={fmtNum(totals.impressions)} />
              <Tile label="Reach" value={fmtNum(totals.reach)} />
              <Tile label="Clicks" value={fmtNum(totals.clicks)} />
              <Tile label="Frequency" value={totals.reach ? (totals.impressions / totals.reach).toFixed(2) : "—"} />
            </div>
          </MCCard>

          {(ad.quality_ranking || ad.engagement_rate_ranking || ad.conversion_rate_ranking) && (
            <MCCard>
              <CardHeader title="Meta Quality Rankings" />
              <div className="grid grid-cols-3 gap-3 p-6">
                <RankingTile label="Quality" value={ad.quality_ranking} />
                <RankingTile label="Engagement Rate" value={ad.engagement_rate_ranking} />
                <RankingTile label="Conversion Rate" value={ad.conversion_rate_ranking} />
              </div>
            </MCCard>
          )}

          <MCCard>
            <CardHeader title="Daily Spend & Leads" />
            <div className="p-6 h-[260px]">
              {insights.length === 0 ? (
                <div className="text-[12px] text-ink-muted">No daily data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights}>
                    <CartesianGrid stroke="#EAE2D2" strokeDasharray="3 3" />
                    <XAxis dataKey="snapshot_date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => fmtDate(d).slice(0, 6)} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 11 }}
                      formatter={(value: number, name: string) =>
                        name === "spend" ? [fmtUSD(value), "Spend"] : [value, "Leads"]
                      }
                    />
                    <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#C4924A" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="leads" stroke="#6B8E7F" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </MCCard>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// helpers
// ============================================================================
function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return <th className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return <td className={`px-4 py-3 ${align === "right" ? "text-right tabular-nums" : ""}`}>{children}</td>;
}
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-cream px-3 py-3 border border-line-soft">
      <div className="label-eyebrow text-[9px]">{label}</div>
      <div className="num-serif text-[22px] leading-none text-ink mt-1.5">{value}</div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div>{label}</div>
      <div className="text-[12px] text-ink normal-case tracking-normal mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="label-eyebrow text-[9px] mb-1">{label}</div>
      <div className="text-ink text-[12px]">{value}</div>
    </div>
  );
}
function CampaignStatus({ status, small }: { status?: string | null; small?: boolean }) {
  if (!status) return <span className="text-[10px] text-ink-muted">—</span>;
  const s = status.toUpperCase();
  const tone =
    s === "ACTIVE" ? "sage" :
    s === "PAUSED" ? "amber" :
    s.includes("DELETED") || s.includes("ARCHIVED") ? "muted" :
    s.includes("DISAPPROVED") || s.includes("REJECTED") ? "burgundy" :
    "navy";
  if (small) {
    return <span className={`mc-pill text-[9px]`}><StatusPill label={s} tone={tone as never} /></span>;
  }
  return <StatusPill label={s} tone={tone as never} />;
}
function RankingTile({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value ?? "UNKNOWN";
  const good = v.includes("ABOVE") || v.includes("TOP");
  const bad = v.includes("BELOW") || v.includes("BOTTOM");
  const color = good ? "text-sage" : bad ? "text-burgundy" : "text-ink-muted";
  return (
    <div className="rounded-lg bg-cream px-3 py-3 border border-line-soft text-center">
      <div className="label-eyebrow text-[9px]">{label}</div>
      <div className={`text-[13px] font-medium mt-1.5 ${color}`}>{v.replace(/_/g, " ")}</div>
    </div>
  );
}
function CreativePreview({ thumbnail, image, large }: { thumbnail?: string | null; image?: string | null; large?: boolean }) {
  const src = image ?? thumbnail;
  const aspect = large ? "aspect-square" : "aspect-video";
  if (!src) {
    return (
      <div className={`${aspect} bg-cream-deep flex items-center justify-center text-ink-muted`}>
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  return (
    <div className={`${aspect} bg-cream-deep overflow-hidden`}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img src={src} className="w-full h-full object-cover" loading="lazy" />
    </div>
  );
}
