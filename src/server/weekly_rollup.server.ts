// Weekly rollup: reads raw integration tables and writes per-metric weekly values
// into weekly_metric_snapshots. Driven by metric_definitions.source_config.

import type { SupabaseClient } from "@supabase/supabase-js";

type SC = SupabaseClient<any, any, any>;

// Compute the Sunday (week_ending) for any date — matches the CSV-import convention.
function weekEndingFor(d: Date): string {
  const day = d.getUTCDay(); // 0 = Sun
  const diff = (7 - day) % 7;
  const sun = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return sun.toISOString().slice(0, 10);
}

function weeksBack(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(weekEndingFor(d));
  }
  return Array.from(new Set(out)).sort();
}

type MetricRow = {
  id: string;
  key: string;
  client_id: string;
  format: string | null;
  source_config: Record<string, any>;
};

type ComputedValue = {
  value: number | null;
  value_text: string | null;
};

// ------------ Per-source-type computers ------------

async function youtubeMetric(
  supa: SC,
  channelId: string,
  weekEnding: string,
  metric: "subscribers" | "views_28d" | "watch_time_28d" | "avg_watch_time" | "ctr",
): Promise<ComputedValue | null> {
  // Pull the latest channel_metrics snapshot ON OR BEFORE week_ending for this channel.
  // channel_metrics doesn't have channel_id text, so we match by account_label heuristic via youtube_channels.
  const { data: chans } = await supa.from("youtube_channels").select("name").eq("channel_id", channelId).maybeSingle();
  const accountLabelGuess = chans?.name ?? null;

  let q = supa
    .from("channel_metrics")
    .select("*")
    .eq("channel", "YouTube")
    .lte("snapshot_date", weekEnding)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (accountLabelGuess) q = q.ilike("account_label", `%${accountLabelGuess.split(" ")[0]}%`);
  const { data: rows } = await q;
  const row: any = rows?.[0];
  if (!row) return null;
  switch (metric) {
    case "subscribers": return { value: row.followers_subs ?? null, value_text: row.followers_subs?.toString() ?? null };
    case "views_28d": return { value: row.reach_28d ?? null, value_text: row.reach_28d?.toString() ?? null };
    case "watch_time_28d": return { value: Number(row.watch_time_hrs) || null, value_text: row.watch_time_hrs ? `${row.watch_time_hrs}` : null };
    case "avg_watch_time": return { value: null, value_text: row.avg_watch_time ?? null };
    case "ctr": return { value: row.ctr != null ? Number(row.ctr) : null, value_text: row.ctr != null ? `${(Number(row.ctr) * 100).toFixed(1)}%` : null };
  }
}

async function captivateDownloads28d(supa: SC, captivateShowId: string, weekEnding: string): Promise<ComputedValue | null> {
  const end = new Date(weekEnding + "T23:59:59Z");
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 27);
  const { data } = await supa
    .from("captivate_show_metrics_daily")
    .select("snapshot_date,total_downloads")
    .eq("captivate_show_id", captivateShowId)
    .gte("snapshot_date", start.toISOString().slice(0, 10))
    .lte("snapshot_date", weekEnding)
    .order("snapshot_date", { ascending: false });
  if (!data || data.length === 0) return null;
  // captivate_show_metrics_daily.total_downloads is cumulative — diff first vs last.
  const sorted = [...data].sort((a: any, b: any) => a.snapshot_date.localeCompare(b.snapshot_date));
  const first = Number(sorted[0].total_downloads ?? 0);
  const last = Number(sorted[sorted.length - 1].total_downloads ?? 0);
  const delta = Math.max(0, last - first);
  return { value: delta, value_text: delta.toString() };
}

async function captivateTotalDownloads(supa: SC, captivateShowId: string, weekEnding: string): Promise<ComputedValue | null> {
  const { data } = await supa
    .from("captivate_show_metrics_daily")
    .select("total_downloads")
    .eq("captivate_show_id", captivateShowId)
    .lte("snapshot_date", weekEnding)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const v: any = data?.[0];
  if (!v) return null;
  const n = Number(v.total_downloads ?? 0);
  return { value: n, value_text: n.toString() };
}

async function captivateEpisodesReleased(supa: SC, captivateShowId: string, weekEnding: string): Promise<ComputedValue> {
  const end = new Date(weekEnding + "T23:59:59Z");
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6); // Mon-Sun week
  const { data } = await supa
    .from("captivate_episodes")
    .select("id,published_date")
    .eq("captivate_show_id", captivateShowId)
    .gte("published_date", start.toISOString())
    .lte("published_date", end.toISOString());
  const n = data?.length ?? 0;
  return { value: n, value_text: n.toString() };
}

async function linkedinFollowers(supa: SC, accountLabel: string, weekEnding: string): Promise<ComputedValue | null> {
  const { data } = await supa
    .from("linkedin_weekly_metrics")
    .select("followers_total,week_ending")
    .eq("account_label", accountLabel)
    .lte("week_ending", weekEnding)
    .order("week_ending", { ascending: false })
    .limit(1);
  const v: any = data?.[0];
  if (!v?.followers_total) return null;
  return { value: v.followers_total, value_text: v.followers_total.toString() };
}

async function kajabiFormSubmissionsWeekly(supa: SC, formId: string, weekEnding: string): Promise<ComputedValue> {
  const end = new Date(weekEnding + "T23:59:59Z");
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  const { count } = await supa
    .from("kajabi_form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("kajabi_form_id", formId)
    .gte("submitted_at", start.toISOString())
    .lte("submitted_at", end.toISOString());
  const n = count ?? 0;
  return { value: n, value_text: n.toString() };
}

async function kajabiTotalSubscribers(supa: SC, weekEnding: string): Promise<ComputedValue> {
  // Cumulative count of distinct contact emails who submitted any Kajabi form on or before week_ending.
  const end = new Date(weekEnding + "T23:59:59Z");
  const { data } = await supa
    .from("kajabi_form_submissions")
    .select("contact_email")
    .lte("submitted_at", end.toISOString())
    .not("contact_email", "is", null);
  const unique = new Set((data ?? []).map((r: any) => (r.contact_email ?? "").toLowerCase().trim()).filter(Boolean));
  const n = unique.size;
  return { value: n, value_text: n.toString() };
}

async function discoveryCalls7d(supa: SC, weekEnding: string): Promise<ComputedValue> {
  const end = new Date(weekEnding + "T23:59:59Z");
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  const { count } = await supa
    .from("discovery_calls")
    .select("id", { count: "exact", head: true })
    .gte("call_date", start.toISOString().slice(0, 10))
    .lte("call_date", end.toISOString().slice(0, 10));
  const n = count ?? 0;
  return { value: n, value_text: n.toString() };
}

async function kajabiDealsClosedWeekly(supa: SC, weekEnding: string): Promise<ComputedValue> {
  const end = new Date(weekEnding + "T23:59:59Z");
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  const { count } = await supa
    .from("kajabi_purchases")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("purchased_at", start.toISOString())
    .lte("purchased_at", end.toISOString());
  const n = count ?? 0;
  return { value: n, value_text: n.toString() };
}

// ------------ Dispatcher ------------

async function computeForMetric(supa: SC, m: MetricRow, weekEnding: string): Promise<ComputedValue | null> {
  const cfg = m.source_config ?? {};
  const t = cfg.type;
  if (!t) return null;
  try {
    switch (t) {
      case "youtube_subscribers": return youtubeMetric(supa, cfg.channel_id, weekEnding, "subscribers");
      case "youtube_views_28d": return youtubeMetric(supa, cfg.channel_id, weekEnding, "views_28d");
      case "youtube_watch_time_28d": return youtubeMetric(supa, cfg.channel_id, weekEnding, "watch_time_28d");
      case "youtube_avg_watch_time": return youtubeMetric(supa, cfg.channel_id, weekEnding, "avg_watch_time");
      case "youtube_ctr": return youtubeMetric(supa, cfg.channel_id, weekEnding, "ctr");
      case "captivate_downloads_28d": return captivateDownloads28d(supa, cfg.captivate_show_id, weekEnding);
      case "captivate_total_downloads": return captivateTotalDownloads(supa, cfg.captivate_show_id, weekEnding);
      case "captivate_episodes_released": return captivateEpisodesReleased(supa, cfg.captivate_show_id, weekEnding);
      case "linkedin_followers": return linkedinFollowers(supa, cfg.account_label, weekEnding);
      case "kajabi_form_submissions_weekly": return kajabiFormSubmissionsWeekly(supa, cfg.kajabi_form_id, weekEnding);
      case "kajabi_total_subscribers": return kajabiTotalSubscribers(supa, weekEnding);
      case "discovery_calls_7d": return discoveryCalls7d(supa, weekEnding);
      case "kajabi_deals_closed_weekly": return kajabiDealsClosedWeekly(supa, weekEnding);
      default: return null;
    }
  } catch (e) {
    console.error(`[rollup] failed metric ${m.key} type=${t}`, e);
    return null;
  }
}

// ------------ Main ------------

export async function runWeeklyRollup(opts: {
  supa: SC;
  weeks?: string[]; // explicit list of week_endings
  weeksBack?: number; // default 8
  triggeredBy?: string;
}) {
  const { supa, triggeredBy = "manual" } = opts;
  const weeks = opts.weeks ?? weeksBack(opts.weeksBack ?? 8);

  const { data: runRow, error: runErr } = await supa
    .from("weekly_rollup_runs")
    .insert({ triggered_by: triggeredBy })
    .select()
    .single();
  if (runErr) throw runErr;
  const runId = (runRow as any).id;

  let snapshotsWritten = 0;
  let metricsProcessed = 0;
  const details: Record<string, any> = { weeks, per_type: {} };

  try {
    const { data: defs, error } = await supa
      .from("metric_definitions")
      .select("id,key,client_id,format,source,source_config,active")
      .eq("active", true)
      .eq("source", "auto");
    if (error) throw error;

    for (const def of (defs ?? []) as any[]) {
      const m: MetricRow = def;
      const t = m.source_config?.type ?? "unknown";
      details.per_type[t] = (details.per_type[t] ?? 0) + 1;
      metricsProcessed++;

      for (const week of weeks) {
        const computed = await computeForMetric(supa, m, week);
        if (!computed) continue;
        if (computed.value == null && !computed.value_text) continue;

        const { error: upErr } = await supa
          .from("weekly_metric_snapshots")
          .upsert({
            metric_definition_id: m.id,
            week_ending: week,
            value: computed.value,
            value_text: computed.value_text,
            source: "auto",
          }, { onConflict: "metric_definition_id,week_ending" });
        if (upErr) {
          console.error(`[rollup] upsert failed for ${m.key} ${week}`, upErr);
          continue;
        }
        snapshotsWritten++;
      }
    }

    await supa.from("weekly_rollup_runs").update({
      finished_at: new Date().toISOString(),
      success: true,
      weeks_processed: weeks.length,
      snapshots_written: snapshotsWritten,
      metrics_processed: metricsProcessed,
      details,
    }).eq("id", runId);

    return { success: true, snapshotsWritten, metricsProcessed, weeksProcessed: weeks.length, details };
  } catch (e: any) {
    await supa.from("weekly_rollup_runs").update({
      finished_at: new Date().toISOString(),
      success: false,
      snapshots_written: snapshotsWritten,
      metrics_processed: metricsProcessed,
      error: e?.message ?? String(e),
      details,
    }).eq("id", runId);
    throw e;
  }
}
