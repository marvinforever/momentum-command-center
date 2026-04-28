// Captivate Public API Sync
// Pulls shows, episodes, and analytics (downloads, geography, sources) from
// Captivate's REST API and upserts them into our DB. Triggered from
// Admin → Integrations → Captivate.
//
// Auth: POST multipart/form-data to /authenticate/token with `username` =
// CAPTIVATE_USER_ID and `token` = CAPTIVATE_API_KEY. Response contains
// user.token used as `Authorization: Bearer <token>` for subsequent calls.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CAPTIVATE_BASE = "https://api.captivate.fm";

type SyncMode = "full" | "shows" | "episodes" | "analytics";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function authenticate(): Promise<string> {
  const userId = process.env.CAPTIVATE_USER_ID;
  const apiKey = process.env.CAPTIVATE_API_KEY;
  if (!userId || !apiKey) {
    throw new Error("Missing CAPTIVATE_USER_ID / CAPTIVATE_API_KEY");
  }

  // Cache for ~50 minutes — Captivate tokens are reasonably long-lived.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const fd = new FormData();
  fd.append("username", userId);
  fd.append("token", apiKey);

  const res = await fetch(`${CAPTIVATE_BASE}/authenticate/token`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Captivate auth failed: ${res.status} ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { user?: { token?: string } };
  const token = json?.user?.token;
  if (!token) {
    throw new Error(`Captivate auth: no token in response: ${JSON.stringify(json).slice(0, 300)}`);
  }
  cachedToken = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

async function capGet<T = any>(path: string, token: string): Promise<T> {
  const res = await fetch(`${CAPTIVATE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

async function capPost<T = any>(path: string, token: string, body: any): Promise<T> {
  const res = await fetch(`${CAPTIVATE_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function durationToSeconds(d: any): number | null {
  if (d == null) return null;
  if (typeof d === "number") return Math.round(d);
  const s = String(d).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // HH:MM:SS or MM:SS
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

async function syncShows(token: string) {
  const userId = process.env.CAPTIVATE_USER_ID!;
  const data = await capGet<{ shows?: any[] }>(`/users/${userId}/shows`, token);
  const shows = data?.shows ?? [];
  const rows = shows.map((s: any) => ({
    captivate_show_id: String(s.id),
    title: s.title ?? s.name ?? "Untitled",
    description: s.description ?? null,
    artwork_url: s.image ?? s.artwork ?? s.artwork_url ?? null,
    link: s.link ?? s.url ?? null,
    itunes_url: s.itunes_url ?? null,
    spotify_url: s.spotify_url ?? null,
    total_subscribers: Number(s.subscribers ?? s.total_subscribers ?? 0) || 0,
    raw: s,
    last_synced_at: new Date().toISOString(),
  }));
  if (rows.length) {
    const { error } = await supabaseAdmin
      .from("captivate_shows")
      .upsert(rows, { onConflict: "captivate_show_id" });
    if (error) throw new Error(`upsert shows: ${error.message}`);
  }
  return rows.map((r) => r.captivate_show_id);
}

async function syncEpisodes(token: string, showId: string) {
  const data = await capGet<any>(`/shows/${showId}/episodes`, token);
  const list: any[] = data?.episodes ?? data?.data ?? data ?? [];
  const eps = Array.isArray(list) ? list : [];

  // Look up our internal show uuid
  const { data: showRow } = await supabaseAdmin
    .from("captivate_shows")
    .select("id")
    .eq("captivate_show_id", showId)
    .maybeSingle();
  const showUuid = showRow?.id ?? null;

  const rows = eps.map((e: any) => ({
    captivate_episode_id: String(e.id),
    captivate_show_id: showId,
    show_uuid: showUuid,
    title: e.title ?? e.itunes_title ?? "Untitled",
    description: e.shownotes ?? e.summary ?? null,
    episode_number: e.episode_number != null ? Number(e.episode_number) : null,
    season_number: e.episode_season != null ? Number(e.episode_season) : null,
    episode_type: e.episode_type ?? null,
    status: e.status ?? null,
    published_date: e.date ?? e.published_date ?? null,
    duration_seconds: durationToSeconds(e.duration ?? e.media?.duration),
    artwork_url: e.episode_art ?? e.image ?? null,
    audio_url: e.media?.url ?? e.media_url ?? null,
    episode_url: e.link ?? null,
    raw: e,
    last_synced_at: new Date().toISOString(),
  }));

  if (rows.length) {
    const { error } = await supabaseAdmin
      .from("captivate_episodes")
      .upsert(rows, { onConflict: "captivate_episode_id" });
    if (error) throw new Error(`upsert episodes (${showId}): ${error.message}`);
  }
  return rows.length;
}

async function syncShowAnalytics(token: string, showId: string, lookbackDays: number) {
  const start = daysAgoISO(lookbackDays);
  const end = todayISO();

  // Total downloads (all time)
  const total = await capGet<any>(`/insights/${showId}/total`, token).catch((e) => ({ error: String(e) }));

  // Range with breakdowns: daily + geography + sources
  const range = await capPost<any>(`/insights/${showId}/range`, token, {
    start,
    end,
    interval: "1d",
    timezone: "America/New_York",
    types: ["byLocation", "byUserAgentApp"],
  }).catch((e) => ({ error: String(e) }));

  // Update show with latest totals
  const totalDownloads =
    Number(
      total?.downloads ??
        total?.total ??
        total?.data?.downloads ??
        range?.totals?.downloads ??
        0,
    ) || 0;

  // Geography + sources snapshot (today)
  const geography = range?.byLocation ?? range?.locations ?? null;
  const sources = range?.byUserAgentApp ?? range?.apps ?? range?.sources ?? null;

  const { error: snapErr } = await supabaseAdmin
    .from("captivate_show_metrics_daily")
    .upsert(
      [
        {
          captivate_show_id: showId,
          snapshot_date: end,
          total_downloads: totalDownloads,
          geography,
          sources,
          raw: { total, range },
        },
      ],
      { onConflict: "captivate_show_id,snapshot_date" },
    );
  if (snapErr) throw new Error(`upsert show metrics: ${snapErr.message}`);

  // Daily download series
  const series: any[] =
    range?.timeline ??
    range?.series ??
    range?.downloads ??
    range?.data?.timeline ??
    [];

  let dlRowsInserted = 0;
  if (Array.isArray(series) && series.length) {
    const dlRows = series
      .map((p: any) => {
        const date = p.date ?? p.day ?? p.timestamp ?? null;
        const downloads = Number(p.downloads ?? p.value ?? p.count ?? 0) || 0;
        if (!date) return null;
        return {
          captivate_episode_id: `__show__:${showId}`, // show-level placeholder
          captivate_show_id: showId,
          snapshot_date: String(date).slice(0, 10),
          downloads,
        };
      })
      .filter(Boolean) as any[];

    if (dlRows.length) {
      const { error: dlErr } = await supabaseAdmin
        .from("captivate_episode_downloads_daily")
        .upsert(dlRows, { onConflict: "captivate_episode_id,snapshot_date" });
      if (!dlErr) dlRowsInserted = dlRows.length;
    }
  }

  // Update per-episode totals (just totals; per-episode daily series would be
  // many extra calls — we can layer that on later).
  const { data: epList } = await supabaseAdmin
    .from("captivate_episodes")
    .select("captivate_episode_id")
    .eq("captivate_show_id", showId);

  let epTotalsUpdated = 0;
  for (const ep of epList ?? []) {
    try {
      const t = await capGet<any>(`/insights/${showId}/total/${ep.captivate_episode_id}`, token);
      const dl = Number(t?.downloads ?? t?.total ?? t?.data?.downloads ?? 0) || 0;
      await supabaseAdmin
        .from("captivate_episodes")
        .update({ total_downloads: dl, last_synced_at: new Date().toISOString() })
        .eq("captivate_episode_id", ep.captivate_episode_id);
      epTotalsUpdated++;
    } catch {
      // ignore per-episode failures, keep going
    }
  }

  await supabaseAdmin
    .from("captivate_shows")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("captivate_show_id", showId);

  return { totalDownloads, dlRowsInserted, epTotalsUpdated };
}

export const Route = createFileRoute("/api/public/captivate-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const mode = (url.searchParams.get("mode") as SyncMode) ?? "full";
        const lookbackDays = Number(url.searchParams.get("days") ?? 90);

        const runStart = new Date().toISOString();
        const { data: runRow } = await supabaseAdmin
          .from("captivate_sync_runs")
          .insert({ started_at: runStart, triggered_by: "manual" })
          .select("id")
          .single();
        const runId = runRow?.id;

        const summary = {
          ok: true as boolean,
          mode,
          shows_synced: 0,
          episodes_synced: 0,
          download_rows_synced: 0,
          per_show: [] as any[],
          errors: [] as { show?: string; error: string }[],
        };

        try {
          const token = await authenticate();

          // Always refresh shows list first
          const showIds = await syncShows(token);
          summary.shows_synced = showIds.length;

          if (mode === "shows") {
            // done
          } else {
            for (const showId of showIds) {
              const perShow: any = { showId };
              try {
                const epCount = await syncEpisodes(token, showId);
                summary.episodes_synced += epCount;
                perShow.episodes = epCount;

                if (mode !== "episodes") {
                  const a = await syncShowAnalytics(token, showId, lookbackDays);
                  summary.download_rows_synced += a.dlRowsInserted;
                  perShow.totalDownloads = a.totalDownloads;
                  perShow.dailyRows = a.dlRowsInserted;
                  perShow.episodeTotalsUpdated = a.epTotalsUpdated;
                }
              } catch (e: any) {
                summary.errors.push({ show: showId, error: String(e?.message ?? e) });
                perShow.error = String(e?.message ?? e);
              }
              summary.per_show.push(perShow);
            }
          }
        } catch (e: any) {
          summary.ok = false;
          summary.errors.push({ error: String(e?.message ?? e) });
        }

        if (runId) {
          await supabaseAdmin
            .from("captivate_sync_runs")
            .update({
              finished_at: new Date().toISOString(),
              success: summary.ok && summary.errors.length === 0,
              shows_synced: summary.shows_synced,
              episodes_synced: summary.episodes_synced,
              download_rows_synced: summary.download_rows_synced,
              error: summary.errors.length ? JSON.stringify(summary.errors).slice(0, 1000) : null,
            })
            .eq("id", runId);
        }

        return Response.json(summary, { status: summary.ok ? 200 : 500 });
      },
    },
  },
});
