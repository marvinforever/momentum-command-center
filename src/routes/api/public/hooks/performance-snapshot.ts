import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/performance-snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Find all published optimization runs within last 30 days
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

          const { data: runs } = await supabaseAdmin
            .from("optimization_runs")
            .select("id, youtube_video_id, published_at")
            .eq("status", "published")
            .gte("published_at", thirtyDaysAgo);

          if (!runs?.length) {
            return Response.json({ success: true, updated: 0 });
          }

          let updated = 0;
          for (const run of runs) {
            // Get current video stats
            const { data: video } = await supabaseAdmin
              .from("youtube_videos")
              .select("views, impressions, ctr, watch_time_minutes")
              .eq("id", run.youtube_video_id)
              .single();

            if (!video) continue;

            const publishedAt = new Date(run.published_at!).getTime();
            const daysSincePublish = (Date.now() - publishedAt) / 86400000;

            // Get existing performance row
            const { data: perf } = await supabaseAdmin
              .from("optimization_performance")
              .select("*")
              .eq("optimization_run_id", run.id)
              .maybeSingle();

            if (!perf) continue;

            const updates: Record<string, any> = {};

            // 7-day snapshot
            if (daysSincePublish >= 7 && !perf.after_7d_taken_at) {
              updates.after_7d_views = video.views;
              updates.after_7d_impressions = video.impressions;
              updates.after_7d_ctr = video.ctr;
              updates.after_7d_watch_time_minutes = video.watch_time_minutes;
              updates.after_7d_taken_at = new Date().toISOString();
            }

            // 30-day snapshot
            if (daysSincePublish >= 30 && !perf.after_30d_taken_at) {
              updates.after_30d_views = video.views;
              updates.after_30d_impressions = video.impressions;
              updates.after_30d_ctr = video.ctr;
              updates.after_30d_watch_time_minutes = video.watch_time_minutes;
              updates.after_30d_taken_at = new Date().toISOString();

              // Compute deltas
              if (perf.baseline_ctr != null && video.ctr != null) {
                updates.ctr_delta_pct = perf.baseline_ctr > 0
                  ? Math.round(((video.ctr - perf.baseline_ctr) / perf.baseline_ctr) * 10000) / 100
                  : null;
              }
              if (perf.baseline_views != null && video.views != null) {
                updates.views_delta_pct = perf.baseline_views > 0
                  ? Math.round(((video.views - perf.baseline_views) / perf.baseline_views) * 10000) / 100
                  : null;
              }
              if (perf.baseline_watch_time_minutes != null && video.watch_time_minutes != null) {
                updates.watch_time_delta_pct = perf.baseline_watch_time_minutes > 0
                  ? Math.round(((video.watch_time_minutes - perf.baseline_watch_time_minutes) / perf.baseline_watch_time_minutes) * 10000) / 100
                  : null;
              }

              // Determine if optimization won
              const ctrImproved = updates.ctr_delta_pct != null && updates.ctr_delta_pct > 0;
              const viewsImproved = updates.views_delta_pct != null && updates.views_delta_pct > 0;
              updates.optimization_won = ctrImproved || viewsImproved;
            }

            if (Object.keys(updates).length > 0) {
              await supabaseAdmin
                .from("optimization_performance")
                .update(updates as any)
                .eq("id", perf.id);
              updated++;
            }
          }

          return Response.json({ success: true, updated });
        } catch (err: any) {
          console.error("Performance snapshot error:", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
