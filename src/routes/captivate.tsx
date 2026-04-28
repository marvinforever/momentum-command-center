import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum, fmtDate } from "@/lib/format";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/captivate")({
  head: () => ({ meta: [{ title: "Podcast (Captivate) — Momentum Command Center" }] }),
  component: CaptivatePage,
});

function CaptivatePage() {
  const [showFilter, setShowFilter] = useState<string>("all");

  const shows = useQuery({
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

  const episodes = useQuery({
    queryKey: ["captivate_episodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captivate_episodes")
        .select("*")
        .order("published_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const eps = episodes.data ?? [];
    if (showFilter === "all") return eps;
    return eps.filter((e: any) => e.captivate_show_id === showFilter);
  }, [episodes.data, showFilter]);

  const totals = useMemo(() => {
    const t = { episodes: filtered.length, downloads: 0 };
    for (const e of filtered) t.downloads += Number(e.total_downloads) || 0;
    return t;
  }, [filtered]);

  const subscribers = useMemo(() => {
    return (shows.data ?? []).reduce((s: number, sh: any) => s + (Number(sh.total_subscribers) || 0), 0);
  }, [shows.data]);

  return (
    <PageShell>
      <PageHeader
        title="Podcast"
        subtitle="Captivate · Shows & Episodes"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Podcast" },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPI label="Shows" value={fmtNum(shows.data?.length ?? 0)} />
        <KPI label="Total Subscribers" value={fmtNum(subscribers)} />
        <KPI label="Episodes (filtered)" value={`${fmtNum(totals.episodes)}`} sub={`${fmtNum(totals.downloads)} downloads`} />
      </div>

      <MCCard className="p-5 sm:p-7 lg:p-8 mb-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="serif text-[22px] text-ink">Shows</h2>
        </div>
        {shows.isLoading ? (
          <div className="text-[12px] text-ink-muted py-6 text-center">Loading…</div>
        ) : !shows.data?.length ? (
          <div className="text-[12px] text-ink-muted py-6 text-center bg-cream-deep rounded-lg">
            No shows synced yet. Go to Admin → Integrations → Captivate to run a sync.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shows.data.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setShowFilter(showFilter === s.captivate_show_id ? "all" : s.captivate_show_id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                  showFilter === s.captivate_show_id
                    ? "border-gold bg-cream-deep"
                    : "border-line-soft bg-cream hover:border-gold-soft"
                }`}
              >
                {s.artwork_url && (
                  <img src={s.artwork_url} alt="" className="w-14 h-14 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-ink truncate">{s.title}</div>
                  <div className="text-[11px] text-ink-muted">
                    {fmtNum(s.total_subscribers ?? 0)} subscribers
                    {s.last_synced_at && ` · synced ${fmtDate(s.last_synced_at)}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </MCCard>

      <MCCard className="p-5 sm:p-7 lg:p-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="serif text-[22px] text-ink">
            Episodes {showFilter !== "all" && <span className="text-[13px] text-ink-muted">(filtered)</span>}
          </h2>
          {showFilter !== "all" && (
            <button
              onClick={() => setShowFilter("all")}
              className="text-[12px] text-ink-soft hover:text-ink underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {episodes.isLoading ? (
          <div className="text-[12px] text-ink-muted py-6 text-center">Loading…</div>
        ) : !filtered.length ? (
          <div className="text-[12px] text-ink-muted py-6 text-center bg-cream-deep rounded-lg">
            No episodes yet.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-[12px]">
              <thead className="text-left text-ink-muted border-b border-line-soft">
                <tr>
                  <th className="py-2 pr-3">Published</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} className="border-b border-line-soft last:border-0">
                    <td className="py-2 pr-3 text-ink-soft whitespace-nowrap">
                      {e.published_date ? fmtDate(e.published_date) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-ink">
                      {e.episode_url ? (
                        <a
                          href={e.episode_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {e.title}
                        </a>
                      ) : (
                        e.title
                      )}
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">
                      {e.season_number ? `S${e.season_number}` : ""}
                      {e.episode_number ? `E${e.episode_number}` : ""}
                    </td>
                    <td className="py-2 pr-3 text-right num-serif text-ink">
                      {fmtNum(e.total_downloads ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MCCard>
    </PageShell>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <MCCard className="p-5">
      <div className="label-eyebrow">{label}</div>
      <div className="num-serif text-[32px] text-ink leading-none mt-2">{value}</div>
      {sub && <div className="text-[11px] text-ink-muted mt-1">{sub}</div>}
    </MCCard>
  );
}
