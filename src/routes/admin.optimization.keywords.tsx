import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/optimization/keywords")({
  head: () => ({ meta: [{ title: "Keyword Tracking — Momentum" }] }),
  component: KeywordTrackingPage,
});

function KeywordTrackingPage() {
  const [brandId, setBrandId] = useState("");

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").eq("status", "Active").order("name");
      return data ?? [];
    },
  });

  const activeBrandId = brandId || brands[0]?.id;

  const { data: targetKeywords = [] } = useQuery({
    queryKey: ["target-keywords-all", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return [];
      const { data } = await (supabase as any)
        .from("seo_keyword_research")
        .select("id, keyword, youtube_video_id, search_volume_estimate, competition_score, relevance_score, is_target, youtube_videos!inner(current_title, brand_id)")
        .eq("is_target", true)
        .eq("youtube_videos.brand_id", activeBrandId)
        .order("keyword");
      return data ?? [];
    },
    enabled: !!activeBrandId,
  });

  const { data: rankings = [] } = useQuery({
    queryKey: ["keyword-rankings-all", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return [];
      const { data } = await (supabase as any)
        .from("keyword_rankings")
        .select("youtube_video_id, keyword, rank_position, checked_at")
        .order("checked_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    enabled: !!activeBrandId,
  });

  // Group by keyword
  const kwMap = new Map<string, { keyword: string; videos: any[]; rankings: any[] }>();
  for (const tk of targetKeywords) {
    const key = tk.keyword.toLowerCase();
    if (!kwMap.has(key)) kwMap.set(key, { keyword: tk.keyword, videos: [], rankings: [] });
    kwMap.get(key)!.videos.push(tk);
  }
  for (const r of rankings) {
    const key = r.keyword.toLowerCase();
    if (kwMap.has(key)) kwMap.get(key)!.rankings.push(r);
  }

  const inputCls = "w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition";

  return (
    <PageShell>
      <PageHeader
        title="Keyword Tracking"
        subtitle="Track ranking positions for target keywords"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Optimization", to: "/admin/optimization" },
          { label: "Keywords" },
        ]}
      />

      <div className="mb-6">
        <select className={inputCls + " max-w-xs"} value={activeBrandId ?? ""} onChange={(e) => setBrandId(e.target.value)}>
          {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {targetKeywords.length === 0 ? (
        <MCCard className="p-8 text-center">
          <p className="text-[13px] text-ink-muted">No target keywords yet. Run keyword research on a video first.</p>
          <Link to="/admin/optimization/new" className="mt-4 inline-block rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors">
            Optimize a Video
          </Link>
        </MCCard>
      ) : (
        <div className="space-y-4">
          {Array.from(kwMap.values()).map((entry) => {
            const latestRank = entry.rankings[0]?.rank_position;
            const prevRank = entry.rankings[1]?.rank_position;
            const trend = latestRank && prevRank ? prevRank - latestRank : 0;

            return (
              <MCCard key={entry.keyword} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] text-ink font-medium">"{entry.keyword}"</h3>
                  <div className="flex items-center gap-2">
                    {latestRank ? (
                      <span className="text-[13px] font-bold text-ink">#{latestRank}</span>
                    ) : (
                      <span className="text-[11px] text-ink-muted">Not ranked</span>
                    )}
                    {trend > 0 && <span className="text-[11px] text-sage font-medium">▲ {trend}</span>}
                    {trend < 0 && <span className="text-[11px] text-burgundy font-medium">▼ {Math.abs(trend)}</span>}
                  </div>
                </div>

                {/* Sparkline */}
                {entry.rankings.length > 1 && (
                  <div className="h-8 flex items-end gap-0.5 mb-2">
                    {entry.rankings.slice(0, 14).reverse().map((r: any, i: number) => {
                      const pos = r.rank_position ?? 50;
                      const height = Math.max(4, ((50 - pos) / 50) * 32);
                      return (
                        <div key={i} className={cn("w-2 rounded-t", pos <= 10 ? "bg-sage" : pos <= 25 ? "bg-gold" : "bg-burgundy")} style={{ height: `${Math.max(4, height)}px` }} title={`#${pos}`} />
                      );
                    })}
                  </div>
                )}

                <div className="text-[11px] text-ink-muted">
                  {entry.videos.map((v: any) => (
                    <span key={v.id} className="mr-2">📺 {(v as any).youtube_videos?.current_title?.slice(0, 40) ?? "Unknown"}</span>
                  ))}
                </div>
              </MCCard>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
