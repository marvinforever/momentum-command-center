import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

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

type MetaInsight = {
  campaign_id: string;
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
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
};

function num(v: string | undefined | null): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function extractLeads(insight: MetaInsight): number {
  if (!insight.actions) return 0;
  // Meta's `lead` action_type is the de-duplicated total across pixel/onsite/offline.
  // Prefer it when present; fall back to summing the specific lead types.
  const byType = new Map<string, number>();
  for (const a of insight.actions) {
    byType.set(a.action_type, num(a.value));
  }
  if (byType.has("lead")) return byType.get("lead") ?? 0;
  const fallbackTypes = [
    "leadgen.other",
    "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.lead_grouped",
    "onsite_conversion.lead",
    "onsite_web_lead",
  ];
  return fallbackTypes.reduce((sum, t) => sum + (byType.get(t) ?? 0), 0);
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
  while (next && safety < 50) {
    const page: { data: T[]; paging?: { next?: string } } = await metaFetch(next, token);
    if (page.data?.length) all.push(...page.data);
    next = page.paging?.next;
    safety++;
  }
  return all;
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
          return Response.json(
            { success: false, error: "Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID" },
            { status: 500 }
          );
        }
        if (!supabaseUrl || !serviceKey) {
          return Response.json(
            { success: false, error: "Missing Supabase server credentials" },
            { status: 500 }
          );
        }

        const adAccountId = adAccountIdRaw.startsWith("act_")
          ? adAccountIdRaw
          : `act_${adAccountIdRaw}`;

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Optional triggered_by from body
        let triggeredBy = "cron";
        try {
          const body = (await request.json()) as { triggered_by?: string };
          if (body?.triggered_by) triggeredBy = body.triggered_by;
        } catch {
          // empty body is fine
        }

        const { data: runRow } = await supabase
          .from("meta_sync_runs")
          .insert({ triggered_by: triggeredBy })
          .select("id")
          .single();
        const runId = runRow?.id;

        try {
          // 1) Campaigns
          const campaignFields = [
            "id",
            "name",
            "objective",
            "status",
            "daily_budget",
            "lifetime_budget",
            "start_time",
            "stop_time",
          ].join(",");
          const campaignsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/campaigns?fields=${campaignFields}&limit=100`;
          const campaigns = await fetchAllPages<MetaCampaign>(campaignsUrl, token);

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
              updated_at: new Date().toISOString(),
            }));
            const { error: upErr } = await supabase
              .from("meta_campaigns")
              .upsert(rows, { onConflict: "meta_campaign_id" });
            if (upErr) throw new Error(`Upsert campaigns: ${upErr.message}`);
          }

          // 2) Daily insights — last 30 days, broken down by day + campaign
          const insightFields = [
            "campaign_id",
            "impressions",
            "reach",
            "clicks",
            "spend",
            "cpm",
            "cpc",
            "ctr",
            "frequency",
            "actions",
            "cost_per_action_type",
          ].join(",");
          const insightsUrl =
            `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights` +
            `?level=campaign&fields=${insightFields}` +
            `&time_increment=1&date_preset=last_30d&limit=200`;
          const insights = await fetchAllPages<MetaInsight>(insightsUrl, token);

          let insightsSynced = 0;
          if (insights.length) {
            const rows = insights.map((i) => {
              const impressions = num(i.impressions);
              const clicks = num(i.clicks);
              const spend = num(i.spend);
              const leads = extractLeads(i);
              return {
                meta_campaign_id: i.campaign_id,
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
                updated_at: new Date().toISOString(),
              };
            });

            // Upsert in chunks
            const chunkSize = 100;
            for (let k = 0; k < rows.length; k += chunkSize) {
              const chunk = rows.slice(k, k + chunkSize);
              const { error: insErr } = await supabase
                .from("meta_ads_daily")
                .upsert(chunk, { onConflict: "meta_campaign_id,snapshot_date" });
              if (insErr) throw new Error(`Upsert insights: ${insErr.message}`);
              insightsSynced += chunk.length;
            }
          }

          if (runId) {
            await supabase
              .from("meta_sync_runs")
              .update({
                finished_at: new Date().toISOString(),
                success: true,
                campaigns_synced: campaigns.length,
                insights_synced: insightsSynced,
              })
              .eq("id", runId);
          }

          return Response.json({
            success: true,
            campaigns_synced: campaigns.length,
            insights_synced: insightsSynced,
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
