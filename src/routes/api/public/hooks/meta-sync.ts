import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const META_API_VERSION = "v21.0";

type MetaCampaign = {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
};

type MetaAdSet = {
  id: string;
  name: string;
  campaign_id: string;
  status?: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  targeting?: Record<string, unknown>;
};

type MetaAdCreative = {
  id?: string;
  name?: string;
  title?: string;
  body?: string;
  call_to_action_type?: string;
  link_url?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  object_type?: string;
  object_story_spec?: {
    link_data?: {
      message?: string;
      name?: string;
      description?: string;
      link?: string;
      caption?: string;
      picture?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
    video_data?: {
      message?: string;
      title?: string;
      video_id?: string;
      image_url?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
  };
  effective_object_story_id?: string;
};

type MetaAd = {
  id: string;
  name: string;
  adset_id: string;
  campaign_id: string;
  status?: string;
  effective_status?: string;
  preview_shareable_link?: string;
  creative?: MetaAdCreative;
};

type MetaInsight = {
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  date_start: string;
  date_stop: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  frequency?: string;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  video_30_sec_watched_actions?: Array<{ action_type: string; value: string }>;
};

function num(v: string | undefined | null): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function actionMap(actions?: Array<{ action_type: string; value: string }>): Map<string, number> {
  const m = new Map<string, number>();
  if (!actions) return m;
  for (const a of actions) m.set(a.action_type, num(a.value));
  return m;
}

function extractLeads(insight: MetaInsight): number {
  const m = actionMap(insight.actions);
  if (m.has("lead")) return m.get("lead") ?? 0;
  const fallback = [
    "leadgen.other",
    "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.lead_grouped",
    "onsite_conversion.lead",
    "onsite_web_lead",
  ];
  return fallback.reduce((s, t) => s + (m.get(t) ?? 0), 0);
}

function engagementCounts(insight: MetaInsight) {
  const m = actionMap(insight.actions);
  return {
    post_reactions: m.get("post_reaction") ?? 0,
    post_comments: m.get("comment") ?? 0,
    post_shares: m.get("post") ?? 0,
    video_views: m.get("video_view") ?? 0,
  };
}

async function metaFetch<T>(url: string, token: string): Promise<T> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllPages<T>(initialUrl: string, token: string): Promise<T[]> {
  const all: T[] = [];
  let next: string | undefined = initialUrl;
  let safety = 0;
  while (next && safety < 200) {
    const page: { data: T[]; paging?: { next?: string } } = await metaFetch(next, token);
    if (page.data?.length) all.push(...page.data);
    next = page.paging?.next;
    safety++;
  }
  return all;
}

function flattenCreative(ad: MetaAd) {
  const c = ad.creative ?? {};
  const link = c.object_story_spec?.link_data;
  const video = c.object_story_spec?.video_data;
  return {
    creative_id: c.id ?? null,
    creative_name: c.name ?? null,
    title: c.title ?? link?.name ?? video?.title ?? null,
    body: c.body ?? link?.message ?? video?.message ?? null,
    cta_type: c.call_to_action_type ?? link?.call_to_action?.type ?? video?.call_to_action?.type ?? null,
    link_url: c.link_url ?? link?.link ?? link?.call_to_action?.value?.link ?? video?.call_to_action?.value?.link ?? null,
    display_url: link?.caption ?? null,
    thumbnail_url: c.thumbnail_url ?? null,
    image_url: c.image_url ?? link?.picture ?? video?.image_url ?? null,
    video_id: c.video_id ?? video?.video_id ?? null,
    object_type: c.object_type ?? null,
  };
}

async function chunkUpsert<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
  size = 100
) {
  let total = 0;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`Upsert ${table}: ${error.message}`);
    total += chunk.length;
  }
  return total;
}

export const Route = createFileRoute("/api/public/hooks/meta-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.META_ACCESS_TOKEN;
        const adAccountIdRaw = process.env.META_AD_ACCOUNT_ID;
        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!token || !adAccountIdRaw) {
          return Response.json({ success: false, error: "Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID" }, { status: 500 });
        }
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ success: false, error: "Missing Supabase server credentials" }, { status: 500 });
        }

        const adAccountId = adAccountIdRaw.startsWith("act_") ? adAccountIdRaw : `act_${adAccountIdRaw}`;
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        let triggeredBy = "cron";
        try {
          const body = (await request.json()) as { triggered_by?: string };
          if (body?.triggered_by) triggeredBy = body.triggered_by;
        } catch {
          // empty body ok
        }

        const { data: runRow } = await supabase
          .from("meta_sync_runs")
          .insert({ triggered_by: triggeredBy })
          .select("id")
          .single();
        const runId = runRow?.id;

        const nowIso = new Date().toISOString();

        try {
          // ============ 1. CAMPAIGNS ============
          const campaignFields = "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time";
          const campaigns = await fetchAllPages<MetaCampaign>(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/campaigns?fields=${campaignFields}&limit=100`,
            token
          );

          if (campaigns.length) {
            const rows = campaigns.map((c) => ({
              meta_campaign_id: c.id,
              name: c.name,
              objective: c.objective ?? null,
              status: c.status ?? null,
              daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
              lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
              start_time: c.start_time ?? null,
              stop_time: c.stop_time ?? null,
              raw: c as unknown as Record<string, unknown>,
              updated_at: nowIso,
            }));
            await chunkUpsert(supabase, "meta_campaigns", rows, "meta_campaign_id");
          }

          // ============ 2. AD SETS ============
          // Meta defaults to filtering by effective_status, so explicitly include all states we care about.
          const allStatuses = encodeURIComponent(
            JSON.stringify(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "IN_PROCESS", "WITH_ISSUES"])
          );
          const adsetFields = "id,name,campaign_id,status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,start_time,end_time,targeting";
          const adsets = await fetchAllPages<MetaAdSet>(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/adsets?fields=${adsetFields}&effective_status=${allStatuses}&limit=100`,
            token
          );
          console.log(`[meta-sync] adsets fetched: ${adsets.length}`);

          let adsetsSynced = 0;
          if (adsets.length) {
            const rows = adsets.map((a) => ({
              meta_adset_id: a.id,
              meta_campaign_id: a.campaign_id,
              name: a.name,
              status: a.status ?? null,
              optimization_goal: a.optimization_goal ?? null,
              billing_event: a.billing_event ?? null,
              bid_strategy: a.bid_strategy ?? null,
              daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
              lifetime_budget: a.lifetime_budget ? Number(a.lifetime_budget) / 100 : null,
              start_time: a.start_time ?? null,
              end_time: a.end_time ?? null,
              targeting: (a.targeting ?? null) as unknown as Record<string, unknown> | null,
              raw: a as unknown as Record<string, unknown>,
              updated_at: nowIso,
            }));
            adsetsSynced = await chunkUpsert(supabase, "meta_adsets", rows, "meta_adset_id");
          }

          // ============ 3. ADS (with creative) ============
          const creativeSubfields =
            "id,name,title,body,call_to_action_type,link_url,thumbnail_url,image_url,video_id,object_type,object_story_spec,effective_object_story_id";
          const adFields = `id,name,adset_id,campaign_id,status,effective_status,preview_shareable_link,creative{${creativeSubfields}}`;
          const ads = await fetchAllPages<MetaAd>(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/ads?fields=${adFields}&effective_status=${allStatuses}&limit=100`,
            token
          );
          console.log(`[meta-sync] ads fetched: ${ads.length}`);

          let adsSynced = 0;
          if (ads.length) {
            const rows = ads.map((a) => {
              const flat = flattenCreative(a);
              return {
                meta_ad_id: a.id,
                meta_adset_id: a.adset_id,
                meta_campaign_id: a.campaign_id,
                name: a.name,
                status: a.status ?? null,
                effective_status: a.effective_status ?? null,
                permalink_url: a.preview_shareable_link ?? null,
                ...flat,
                raw: a as unknown as Record<string, unknown>,
                creative_raw: (a.creative ?? null) as unknown as Record<string, unknown> | null,
                updated_at: nowIso,
              };
            });
            adsSynced = await chunkUpsert(supabase, "meta_ads", rows, "meta_ad_id");
          }

          // ============ 4. INSIGHTS — campaign level (existing table) ============
          const baseInsightFields = "impressions,reach,clicks,spend,cpm,cpc,ctr,frequency,actions,cost_per_action_type,date_start,date_stop";
          const campInsightFields = `campaign_id,${baseInsightFields}`;
          const campaignInsights = await fetchAllPages<MetaInsight>(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights?level=campaign&fields=${campInsightFields}&time_increment=1&date_preset=last_30d&limit=200`,
            token
          );

          let insightsSynced = 0;
          if (campaignInsights.length) {
            const rows = campaignInsights.map((i) => {
              const impressions = num(i.impressions);
              const clicks = num(i.clicks);
              const spend = num(i.spend);
              const leads = extractLeads(i);
              return {
                meta_campaign_id: i.campaign_id!,
                snapshot_date: i.date_start,
                impressions,
                reach: num(i.reach),
                clicks,
                spend,
                leads,
                cpm: i.cpm ? num(i.cpm) : impressions ? (spend / impressions) * 1000 : null,
                cpc: i.cpc ? num(i.cpc) : clicks ? spend / clicks : null,
                ctr: i.ctr ? num(i.ctr) : impressions ? (clicks / impressions) * 100 : null,
                cpl: leads ? spend / leads : null,
                frequency: i.frequency ? num(i.frequency) : null,
                raw: i as unknown as Record<string, unknown>,
                updated_at: nowIso,
              };
            });
            insightsSynced = await chunkUpsert(supabase, "meta_ads_daily", rows, "meta_campaign_id,snapshot_date");
          }

          // ============ 5. INSIGHTS — adset level ============
          const adsetInsightFields = `campaign_id,adset_id,${baseInsightFields}`;
          const adsetInsights = await fetchAllPages<MetaInsight>(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights?level=adset&fields=${adsetInsightFields}&time_increment=1&date_preset=last_30d&limit=500`,
            token
          );

          let adsetInsightsSynced = 0;
          if (adsetInsights.length) {
            const rows = adsetInsights.map((i) => {
              const impressions = num(i.impressions);
              const clicks = num(i.clicks);
              const spend = num(i.spend);
              const leads = extractLeads(i);
              const eng = engagementCounts(i);
              return {
                meta_adset_id: i.adset_id!,
                meta_campaign_id: i.campaign_id!,
                snapshot_date: i.date_start,
                impressions,
                reach: num(i.reach),
                clicks,
                spend,
                leads,
                cpm: i.cpm ? num(i.cpm) : impressions ? (spend / impressions) * 1000 : null,
                cpc: i.cpc ? num(i.cpc) : clicks ? spend / clicks : null,
                ctr: i.ctr ? num(i.ctr) : impressions ? (clicks / impressions) * 100 : null,
                cpl: leads ? spend / leads : null,
                frequency: i.frequency ? num(i.frequency) : null,
                ...eng,
                raw: i as unknown as Record<string, unknown>,
                updated_at: nowIso,
              };
            });
            adsetInsightsSynced = await chunkUpsert(supabase, "meta_adsets_daily", rows, "meta_adset_id,snapshot_date");
          }

          // ============ 6. INSIGHTS — ad level (with quality rankings) ============
          const adInsightFields = `campaign_id,adset_id,ad_id,${baseInsightFields},quality_ranking,engagement_rate_ranking,conversion_rate_ranking`;
          const adInsights = await fetchAllPages<MetaInsight>(
            `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights?level=ad&fields=${adInsightFields}&time_increment=1&date_preset=last_30d&limit=500`,
            token
          );

          let adInsightsSynced = 0;
          if (adInsights.length) {
            const rows = adInsights.map((i) => {
              const impressions = num(i.impressions);
              const clicks = num(i.clicks);
              const spend = num(i.spend);
              const leads = extractLeads(i);
              const eng = engagementCounts(i);
              return {
                meta_ad_id: i.ad_id!,
                meta_adset_id: i.adset_id!,
                meta_campaign_id: i.campaign_id!,
                snapshot_date: i.date_start,
                impressions,
                reach: num(i.reach),
                clicks,
                spend,
                leads,
                cpm: i.cpm ? num(i.cpm) : impressions ? (spend / impressions) * 1000 : null,
                cpc: i.cpc ? num(i.cpc) : clicks ? spend / clicks : null,
                ctr: i.ctr ? num(i.ctr) : impressions ? (clicks / impressions) * 100 : null,
                cpl: leads ? spend / leads : null,
                frequency: i.frequency ? num(i.frequency) : null,
                ...eng,
                quality_ranking: i.quality_ranking ?? null,
                engagement_rate_ranking: i.engagement_rate_ranking ?? null,
                conversion_rate_ranking: i.conversion_rate_ranking ?? null,
                raw: i as unknown as Record<string, unknown>,
                updated_at: nowIso,
              };
            });
            adInsightsSynced = await chunkUpsert(supabase, "meta_ads_insights_daily", rows, "meta_ad_id,snapshot_date");

            // Roll the most recent rankings up to the meta_ads row for fast list display
            const latestByAd = new Map<string, MetaInsight>();
            for (const i of adInsights) {
              if (!i.ad_id) continue;
              const prev = latestByAd.get(i.ad_id);
              if (!prev || i.date_start > prev.date_start) latestByAd.set(i.ad_id, i);
            }
            const rankRows = Array.from(latestByAd.entries())
              .filter(([, i]) => i.quality_ranking || i.engagement_rate_ranking || i.conversion_rate_ranking)
              .map(([ad_id, i]) => ({
                meta_ad_id: ad_id,
                quality_ranking: i.quality_ranking ?? null,
                engagement_rate_ranking: i.engagement_rate_ranking ?? null,
                conversion_rate_ranking: i.conversion_rate_ranking ?? null,
                updated_at: nowIso,
              }));
            if (rankRows.length) {
              // upsert only updates the rows already created in step 3
              await chunkUpsert(supabase, "meta_ads", rankRows as unknown as Record<string, unknown>[], "meta_ad_id");
            }
          }

          if (runId) {
            await supabase
              .from("meta_sync_runs")
              .update({
                finished_at: new Date().toISOString(),
                success: true,
                campaigns_synced: campaigns.length,
                adsets_synced: adsetsSynced,
                ads_synced: adsSynced,
                insights_synced: insightsSynced,
                adset_insights_synced: adsetInsightsSynced,
                ad_insights_synced: adInsightsSynced,
              })
              .eq("id", runId);
          }

          return Response.json({
            success: true,
            campaigns_synced: campaigns.length,
            adsets_synced: adsetsSynced,
            ads_synced: adsSynced,
            insights_synced: insightsSynced,
            adset_insights_synced: adsetInsightsSynced,
            ad_insights_synced: adInsightsSynced,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("Meta sync failed:", message);
          if (runId) {
            await supabase
              .from("meta_sync_runs")
              .update({
                finished_at: new Date().toISOString(),
                success: false,
                error: message,
              })
              .eq("id", runId);
          }
          return Response.json({ success: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
