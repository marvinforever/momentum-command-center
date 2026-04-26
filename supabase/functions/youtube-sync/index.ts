// YouTube Sync Edge Function
// Pulls channel-level stats and per-video metadata for our two YouTube channels
// (Christine Jewell, Intentional Ag Leader) into Supabase.
//
// - Optional query param `?channel=christine` or `?channel=intentional_ag` to sync just one.
// - No param = sync both.
// - Uses `verify_jwt = false` (configured in supabase/config.toml) so it can be called
//   from pg_cron and from authenticated UI alike.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ---------- channel registry ----------
type ChannelKey = "christine" | "intentional_ag";

interface ChannelDef {
  key: ChannelKey;
  rowId: string;            // FK in public.youtube_channels
  name: string;             // human label, also account_label in channel_metrics
  envVar: string;           // env var name holding the YouTube channel UC...
}

const CHANNELS: ChannelDef[] = [
  {
    key: "christine",
    rowId: "aaaaaaaa-0000-0000-0000-000000000001",
    name: "Christine Jewell",
    envVar: "YOUTUBE_CHANNEL_ID_CHRISTINE",
  },
  {
    key: "intentional_ag",
    rowId: "aaaaaaaa-0000-0000-0000-000000000002",
    name: "Intentional Ag Leader",
    envVar: "YOUTUBE_CHANNEL_ID_INTENTIONAL_AG",
  },
];

// ---------- ISO 8601 duration parser (PT#H#M#S) ----------
function parseDurationSeconds(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return h * 3600 + min * 60 + s;
}

// YouTube treats anything <=60s in vertical aspect as a Short. We use duration
// as a proxy: <=60s = Short, otherwise Long-form Video.
function classifyVideo(durationIso: string): { channel: string; format: string } {
  const seconds = parseDurationSeconds(durationIso);
  if (seconds > 0 && seconds <= 60) return { channel: "YouTube Short", format: "Short" };
  return { channel: "YouTube", format: "Long-form Video" };
}

// ---------- HTTP helper with quota handling ----------
async function ytFetch(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 && body.includes("quotaExceeded")) {
      throw new Error(
        `YouTube API daily quota exceeded (10,000 units/day on free tier). Try again after midnight Pacific. Body: ${body}`
      );
    }
    throw new Error(`YouTube API ${res.status}: ${body}`);
  }
  return res.json();
}

// ---------- per-channel sync ----------
async function syncChannel(
  ch: ChannelDef,
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{
  channel: string;
  channel_id: string;
  subscribers: number;
  videos_upserted: number;
  reach_28d: number;
  posts_last_7d: number;
}> {
  const channelId = Deno.env.get(ch.envVar);
  if (!channelId) throw new Error(`Missing env var ${ch.envVar}`);

  // 1) Channel snippet + statistics + uploads playlist
  const channelData = await ytFetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`
  );
  if (!channelData.items?.length) {
    throw new Error(`Channel ${channelId} not found (check ${ch.envVar})`);
  }
  const c = channelData.items[0];
  const subscribers = parseInt(c.statistics?.subscriberCount ?? "0", 10);
  const uploadsPlaylistId = c.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("No uploads playlist found");

  // 2) Most recent 50 videos via uploads playlist
  const playlistData = await ytFetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}`
  );
  const videoIds: string[] = (playlistData.items ?? [])
    .map((it: any) => it.contentDetails?.videoId)
    .filter(Boolean);

  // 3) Detailed stats for those video IDs (1 batch call up to 50 IDs)
  let videosDetail: any[] = [];
  if (videoIds.length) {
    const detailData = await ytFetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${apiKey}`
    );
    videosDetail = detailData.items ?? [];
  }

  // 4) Sync the youtube_channels row with the real channel_id (overwrite placeholder)
  await supabase
    .from("youtube_channels")
    .update({ channel_id: channelId, name: c.snippet?.title ?? ch.name })
    .eq("id", ch.rowId);

  // 5) Upsert each video into content
  // For existing rows, preserve manual fields (topic, key_word, effect_rating,
  // leads_attributed, notes). Use a read-then-write pattern keyed on youtube_video_id.
  const today = new Date();
  const cutoff28 = new Date(today.getTime() - 28 * 24 * 3600 * 1000);
  const cutoff7 = new Date(today.getTime() - 7 * 24 * 3600 * 1000);
  let reach28d = 0;
  let posts7d = 0;
  let upserted = 0;

  // Pre-fetch existing rows in one query
  const { data: existingRows } = await supabase
    .from("content")
    .select("id, youtube_video_id, topic, key_word, effect_rating, leads_attributed, notes")
    .in("youtube_video_id", videoIds.length ? videoIds : ["__none__"]);
  const existingById = new Map<string, any>(
    (existingRows ?? []).map((r: any) => [r.youtube_video_id, r])
  );

  for (const v of videosDetail) {
    const vid: string = v.id;
    const publishedAt: string = v.snippet?.publishedAt ?? new Date().toISOString();
    const publishDate = publishedAt.slice(0, 10);
    const publishedDt = new Date(publishedAt);
    const views = parseInt(v.statistics?.viewCount ?? "0", 10);
    const likes = parseInt(v.statistics?.likeCount ?? "0", 10);
    const comments = parseInt(v.statistics?.commentCount ?? "0", 10);
    const { channel, format } = classifyVideo(v.contentDetails?.duration ?? "");

    if (publishedDt >= cutoff28) reach28d += views;
    // We chose 7-day window for "posts_episodes_released" — matches the dashboard's
    // weekly snapshot cadence and is the most useful "recently published" signal.
    if (publishedDt >= cutoff7) posts7d += 1;

    const existing = existingById.get(vid);
    const base = {
      title: v.snippet?.title ?? "(untitled)",
      channel,
      format,
      publish_date: publishDate,
      reach: views,
      engagement: likes + comments,
      link: `https://www.youtube.com/watch?v=${vid}`,
      youtube_channel_id: ch.rowId,
      youtube_video_id: vid,
    };

    if (existing) {
      // Update — only refresh the auto fields, preserve manual ones
      const { error } = await supabase
        .from("content")
        .update(base)
        .eq("id", existing.id);
      if (!error) upserted++;
    } else {
      const { error } = await supabase.from("content").insert({
        ...base,
        effect_rating: "Untracked",
        leads_attributed: 0,
      });
      if (!error) upserted++;
    }
  }

  // 6) Insert daily channel_metrics snapshot for this channel
  // Net change = subscribers now - subscribers in most recent prior snapshot
  const { data: prevSnap } = await supabase
    .from("channel_metrics")
    .select("followers_subs, snapshot_date")
    .eq("channel", "YouTube")
    .eq("account_label", ch.name)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const netChange = prevSnap ? subscribers - (prevSnap.followers_subs ?? 0) : null;

  const todayIso = today.toISOString().slice(0, 10);
  // Avoid duplicate snapshot for the same day
  const { data: sameDay } = await supabase
    .from("channel_metrics")
    .select("id")
    .eq("channel", "YouTube")
    .eq("account_label", ch.name)
    .eq("snapshot_date", todayIso)
    .maybeSingle();

  const snapshot = {
    channel: "YouTube",
    account_label: ch.name,
    snapshot_date: todayIso,
    followers_subs: subscribers,
    reach_28d: reach28d,
    posts_episodes_released: posts7d,
    net_change: netChange,
    notes: "Auto-sync via youtube-sync function",
  };
  if (sameDay) {
    await supabase.from("channel_metrics").update(snapshot).eq("id", sameDay.id);
  } else {
    await supabase.from("channel_metrics").insert(snapshot);
  }

  return {
    channel: ch.name,
    channel_id: channelId,
    subscribers,
    videos_upserted: upserted,
    reach_28d: reach28d,
    posts_last_7d: posts7d,
  };
}

// ---------- main handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing YOUTUBE_API_KEY env var" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const channelParam = url.searchParams.get("channel") as ChannelKey | null;
  const targets = channelParam
    ? CHANNELS.filter((c) => c.key === channelParam)
    : CHANNELS;

  if (channelParam && targets.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: `Unknown channel: ${channelParam}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: any[] = [];
  const errors: { channel: string; error: string }[] = [];
  let totalUpserted = 0;

  for (const ch of targets) {
    try {
      const r = await syncChannel(ch, apiKey, supabase);
      results.push(r);
      totalUpserted += r.videos_upserted;
    } catch (e) {
      console.error(`Sync failed for ${ch.name}:`, e);
      errors.push({ channel: ch.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      channels: results,
      videos_upserted: totalUpserted,
      errors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
