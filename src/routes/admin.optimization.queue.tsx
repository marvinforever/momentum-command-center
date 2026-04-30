import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { buildAuditQueueFn } from "@/server/optimization.functions";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/optimization/queue")({
  head: () => ({ meta: [{ title: "Audit Queue — Momentum" }] }),
  component: AuditQueuePage,
});

function AuditQueuePage() {
  const [brandId, setBrandId] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  const qc = useQueryClient();
  const buildQueueFn = useServerFn(buildAuditQueueFn);

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").eq("status", "Active").order("name");
      return data ?? [];
    },
  });

  const activeBrandId = brandId || brands[0]?.id;

  const { data: queue = [] } = useQuery({
    queryKey: ["audit-queue", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return [];
      const { data } = await supabase
        .from("audit_queue")
        .select("*, youtube_videos(id, youtube_video_id, current_title, current_thumbnail_url, views, impressions, ctr)")
        .eq("brand_id", activeBrandId)
        .eq("status", "queued")
        .order("priority_rank");
      return data ?? [];
    },
    enabled: !!activeBrandId,
  });

  async function handleRebuild() {
    setRebuilding(true);
    try {
      const result = await buildQueueFn({ data: { brandId: activeBrandId } });
      toast.success(`Queue rebuilt: ${result.queued} videos queued`);
      qc.invalidateQueries({ queryKey: ["audit-queue"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRebuilding(false);
    }
  }

  const inputCls = "rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition";

  return (
    <PageShell>
      <PageHeader
        title="Audit Queue"
        subtitle="Videos ranked by optimization opportunity"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Optimization", to: "/admin/optimization" },
          { label: "Queue" },
        ]}
      />

      <div className="flex items-center gap-3 mb-6">
        <select className={inputCls + " max-w-xs"} value={activeBrandId ?? ""} onChange={(e) => setBrandId(e.target.value)}>
          {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          className="rounded-lg bg-gold px-4 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60"
        >
          {rebuilding ? "Rebuilding…" : "Rebuild Queue"}
        </button>
      </div>

      {queue.length === 0 ? (
        <MCCard className="p-8 text-center">
          <p className="text-[14px] text-ink-muted">No videos in the queue. Click "Rebuild Queue" to scan for optimization opportunities.</p>
        </MCCard>
      ) : (
        <MCCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-cream-deep">
                  <th className="px-4 py-3 text-left label-eyebrow">#</th>
                  <th className="px-4 py-3 text-left label-eyebrow">Video</th>
                  <th className="px-4 py-3 text-right label-eyebrow">Impressions</th>
                  <th className="px-4 py-3 text-right label-eyebrow">CTR</th>
                  <th className="px-4 py-3 text-right label-eyebrow">Score</th>
                  <th className="px-4 py-3 text-left label-eyebrow">Reasons</th>
                  <th className="px-4 py-3 text-right label-eyebrow">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item: any) => {
                  const video = item.youtube_videos;
                  return (
                    <tr key={item.id} className="border-b border-line-soft mc-row-hover">
                      <td className="px-4 py-3 text-ink-muted">{item.priority_rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {video?.current_thumbnail_url && (
                            <img src={video.current_thumbnail_url} alt="" className="w-16 h-10 rounded object-cover" />
                          )}
                          <div className="min-w-0">
                            <p className="text-ink truncate max-w-[300px]">{video?.current_title ?? "Unknown"}</p>
                            <p className="text-[11px] text-ink-muted">{video?.views ?? 0} views</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-ink">{(video?.impressions ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-ink">{video?.ctr != null ? `${video.ctr}%` : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-gold">{item.opportunity_score}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(item.reasons as string[])?.map((r: string, i: number) => (
                            <span key={i} className="mc-tag bg-amber-bg text-amber">{r}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/admin/optimization/new"
                          search={{ videoId: video?.id, brandId: activeBrandId }}
                          className="rounded-md bg-gold px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gold/90 transition-colors"
                        >
                          Optimize
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </MCCard>
      )}
    </PageShell>
  );
}
