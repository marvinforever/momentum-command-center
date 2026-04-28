import { MCCard, CardHeader } from "@/components/mc/Primitives";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum, fmtDate } from "@/lib/format";
import { useMemo } from "react";

export function PodcastWidget() {
  const showsQ = useQuery({
    queryKey: ["captivate_shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captivate_shows")
        .select("*")
        .order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

  const episodesQ = useQuery({
    queryKey: ["captivate_episodes_recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captivate_episodes")
        .select("*")
        .order("published_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const shows = showsQ.data ?? [];
  const episodes = episodesQ.data ?? [];

  const totalDownloads = useMemo(
    () => episodes.reduce((s: number, e: any) => s + (Number(e.total_downloads) || 0), 0),
    [episodes]
  );
  const avgDownloads = useMemo(() => {
    const withDl = episodes.filter((e: any) => Number(e.total_downloads) > 0);
    if (!withDl.length) return 0;
    return Math.round(
      withDl.reduce((s: number, e: any) => s + Number(e.total_downloads), 0) / withDl.length
    );
  }, [episodes]);
  const mostRecent = episodes[0];

  if (!showsQ.isLoading && shows.length === 0) {
    return (
      <MCCard className="border-dashed">
        <CardHeader title="Podcast Performance" meta="No data yet" />
        <div className="p-8 text-center">
          <p className="text-[13px] text-ink-muted mb-4">
            Run your first Captivate sync to populate this widget.
          </p>
          <Link
            to="/admin/integrations"
            className="inline-block rounded-lg bg-gold px-5 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors"
          >
            Run Sync →
          </Link>
        </div>
      </MCCard>
    );
  }

  return (
    <MCCard>
      <CardHeader
        title="Podcast Performance"
        meta={
          <Link to="/captivate" className="text-gold hover:underline">
            View all episodes →
          </Link>
        }
      />
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Link
            to="/captivate"
            className="rounded-lg bg-cream border border-line-soft p-3 hover:border-gold-soft hover:shadow-sm transition-all"
          >
            <div className="text-[11px] text-ink-soft font-medium mb-2">Avg downloads / episode</div>
            <div className="num-serif text-[24px] text-ink leading-none">{fmtNum(avgDownloads)}</div>
            <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">
              across {episodes.length} eps
            </div>
          </Link>
          <Link
            to="/captivate"
            className="rounded-lg bg-cream border border-line-soft p-3 hover:border-gold-soft hover:shadow-sm transition-all"
          >
            <div className="text-[11px] text-ink-soft font-medium mb-2">Total downloads</div>
            <div className="num-serif text-[24px] text-ink leading-none">{fmtNum(totalDownloads)}</div>
            <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.14em]">
              {shows.length} show{shows.length === 1 ? "" : "s"}
            </div>
          </Link>
        </div>

        {shows.length > 0 && (
          <div className="space-y-2 mb-4">
            {shows.slice(0, 3).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3">
                {s.artwork_url && (
                  <img src={s.artwork_url} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-ink truncate">{s.title}</div>
                  <div className="text-[10px] text-ink-muted">
                    {fmtNum(s.total_subscribers ?? 0)} subscribers
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {mostRecent && (
          <div className="border-t border-line-soft pt-4">
            <div className="label-eyebrow text-[9px] mb-2">Most Recent Episode</div>
            <a
              href={mostRecent.episode_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="block group"
            >
              <div className="text-[13px] font-medium text-ink leading-snug line-clamp-2 group-hover:text-gold transition-colors">
                {mostRecent.title}
              </div>
              <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
                {mostRecent.published_date && <span>{fmtDate(mostRecent.published_date)}</span>}
                <span>·</span>
                <span>{fmtNum(mostRecent.total_downloads ?? 0)} downloads</span>
              </div>
            </a>
          </div>
        )}
      </div>
    </MCCard>
  );
}
