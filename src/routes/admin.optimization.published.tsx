import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/optimization/published")({
  head: () => ({ meta: [{ title: "Published Optimizations — Momentum" }] }),
  component: PublishedPage,
});

function PublishedPage() {
  const [brandId, setBrandId] = useState("");

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").eq("status", "Active").order("name");
      return data ?? [];
    },
  });

  const activeBrandId = brandId || brands[0]?.id;

  const { data: published = [] } = useQuery({
    queryKey: ["published-optimizations", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return [];
      const { data } = await supabase
        .from("optimization_runs")
        .select("*, youtube_videos(id, current_title, current_thumbnail_url, views), optimization_performance(*)")
        .eq("brand_id", activeBrandId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!activeBrandId,
  });

  const inputCls = "rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition";

  return (
    <PageShell>
      <PageHeader
        title="Published Optimizations"
        subtitle="Before/after performance tracking"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Optimization", to: "/admin/optimization" },
          { label: "Published" },
        ]}
      />

      <div className="mb-6">
        <select className={inputCls + " max-w-xs"} value={activeBrandId ?? ""} onChange={(e) => setBrandId(e.target.value)}>
          {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {published.length === 0 ? (
        <MCCard className="p-8 text-center">
          <p className="text-[14px] text-ink-muted">No published optimizations yet.</p>
        </MCCard>
      ) : (
        <MCCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-cream-deep">
                  <th className="px-4 py-3 text-left label-eyebrow">Video</th>
                  <th className="px-4 py-3 text-left label-eyebrow">Published</th>
                  <th className="px-4 py-3 text-right label-eyebrow">Baseline CTR</th>
                  <th className="px-4 py-3 text-right label-eyebrow">7d CTR</th>
                  <th className="px-4 py-3 text-right label-eyebrow">30d CTR</th>
                  <th className="px-4 py-3 text-right label-eyebrow">Views Δ</th>
                  <th className="px-4 py-3 text-center label-eyebrow">Result</th>
                </tr>
              </thead>
              <tbody>
                {published.map((run: any) => {
                  const video = run.youtube_videos;
                  const perf = Array.isArray(run.optimization_performance) ? run.optimization_performance[0] : run.optimization_performance;
                  const won = perf?.optimization_won;

                  return (
                    <tr key={run.id} className="border-b border-line-soft mc-row-hover">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {video?.current_thumbnail_url && (
                            <img src={video.current_thumbnail_url} alt="" className="w-16 h-10 rounded object-cover" />
                          )}
                          <span className="text-ink truncate max-w-[250px]">{video?.current_title ?? "Unknown"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {run.published_at ? new Date(run.published_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-ink">{perf?.baseline_ctr != null ? `${perf.baseline_ctr}%` : "—"}</td>
                      <td className="px-4 py-3 text-right text-ink">{perf?.after_7d_ctr != null ? `${perf.after_7d_ctr}%` : "—"}</td>
                      <td className="px-4 py-3 text-right text-ink">{perf?.after_30d_ctr != null ? `${perf.after_30d_ctr}%` : "—"}</td>
                      <td className="px-4 py-3 text-right text-ink">
                        {perf?.views_delta_pct != null ? (
                          <span className={perf.views_delta_pct > 0 ? "text-sage" : "text-burgundy"}>
                            {perf.views_delta_pct > 0 ? "+" : ""}{perf.views_delta_pct}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {won === true && <span className="text-sage text-[16px]">✓</span>}
                        {won === false && <span className="text-burgundy text-[16px]">✕</span>}
                        {won == null && <span className="text-ink-muted text-[12px]">pending</span>}
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
