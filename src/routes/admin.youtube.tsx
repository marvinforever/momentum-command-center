import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { useYoutubeContent, useYoutubeChannels } from "@/lib/queries";
import { fmtNum, fmtDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/youtube")({
  head: () => ({ meta: [{ title: "YouTube Videos — Momentum Command Center" }] }),
  component: YouTubeVideosPage,
});

type SortKey = "publish_date" | "reach" | "engagement" | "leads_attributed" | "title";
type SortDir = "asc" | "desc";

function YouTubeVideosPage() {
  const { data: videos = [], isLoading } = useYoutubeContent();
  const { data: channels = [] } = useYoutubeChannels();

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("publish_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // channel id -> name lookup
  const channelNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of channels as any[]) m.set(c.id, c.name);
    return m;
  }, [channels]);

  const filtered = useMemo(() => {
    let rows = (videos as any[]).map((v) => ({
      ...v,
      channel_name: v.youtube_channel_id ? channelNameById.get(v.youtube_channel_id) ?? v.channel : v.channel,
    }));
    if (channelFilter !== "all") rows = rows.filter((r) => r.youtube_channel_id === channelFilter);
    if (formatFilter !== "all") rows = rows.filter((r) => r.format === formatFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.title ?? "").toLowerCase().includes(q) ||
          (r.topic ?? "").toLowerCase().includes(q) ||
          (r.key_word ?? "").toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => {
      const av = a[sortKey] ?? (typeof b[sortKey] === "number" ? 0 : "");
      const bv = b[sortKey] ?? (typeof a[sortKey] === "number" ? 0 : "");
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [videos, channelNameById, channelFilter, formatFilter, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    const t = { count: filtered.length, views: 0, engagement: 0, leads: 0 };
    for (const r of filtered) {
      t.views += Number(r.reach) || 0;
      t.engagement += Number(r.engagement) || 0;
      t.leads += Number(r.leads_attributed) || 0;
    }
    return t;
  }, [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "title" ? "asc" : "desc");
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="YouTube Videos"
        subtitle="All synced videos · Both channels"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Admin", to: "/admin" },
          { label: "YouTube" },
        ]}
        actions={
          <Link
            to="/admin/integrations"
            className="rounded-lg border border-line bg-cream px-4 py-2 text-[12px] font-medium text-ink-soft hover:bg-cream-deep transition-colors"
          >
            Run Sync →
          </Link>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryTile label="Videos" value={fmtNum(totals.count)} />
        <SummaryTile label="Total Views" value={fmtNum(totals.views)} />
        <SummaryTile label="Total Engagement" value={fmtNum(totals.engagement)} />
        <SummaryTile label="Leads Attributed" value={fmtNum(totals.leads)} />
      </div>

      {/* Filters */}
      <MCCard className="p-4 mb-4">
        <div className="grid grid-cols-[1fr_200px_200px] gap-3">
          <input
            placeholder="Search title, topic, keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30"
          />
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-gold-soft"
          >
            <option value="all">All channels</option>
            {(channels as any[]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-gold-soft"
          >
            <option value="all">All formats</option>
            <option value="Short">Shorts</option>
            <option value="Long-form">Long-form</option>
          </select>
        </div>
      </MCCard>

      {/* Table */}
      <MCCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-cream-deep text-left">
                <Th onClick={() => toggleSort("publish_date")} active={sortKey === "publish_date"} dir={sortDir} className="w-[110px]">
                  Date
                </Th>
                <Th onClick={() => toggleSort("title")} active={sortKey === "title"} dir={sortDir}>
                  Title
                </Th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium w-[160px]">
                  Channel
                </th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium w-[90px]">
                  Format
                </th>
                <Th onClick={() => toggleSort("reach")} active={sortKey === "reach"} dir={sortDir} className="w-[100px] text-right">
                  Views
                </Th>
                <Th onClick={() => toggleSort("engagement")} active={sortKey === "engagement"} dir={sortDir} className="w-[110px] text-right">
                  Engagement
                </Th>
                <Th onClick={() => toggleSort("leads_attributed")} active={sortKey === "leads_attributed"} dir={sortDir} className="w-[90px] text-right">
                  Leads
                </Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-muted">
                    Loading videos…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-muted">
                    No videos match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((v) => (
                <tr key={v.id} className="border-t border-line-soft hover:bg-cream-deep/40 transition-colors">
                  <td className="px-3 py-3 text-ink-soft whitespace-nowrap">{v.publish_date ? fmtDate(v.publish_date) : "—"}</td>
                  <td className="px-3 py-3">
                    {v.link ? (
                      <a href={v.link} target="_blank" rel="noreferrer" className="text-ink hover:text-gold transition-colors line-clamp-2">
                        {v.title}
                      </a>
                    ) : (
                      <span className="text-ink line-clamp-2">{v.title}</span>
                    )}
                    {v.topic && <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-1">{v.topic}</div>}
                  </td>
                  <td className="px-3 py-3 text-ink-soft text-[12px] truncate">{v.channel_name ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        v.format === "Short" ? "bg-sage/20 text-sage-deep" : "bg-gold/20 text-gold-deep",
                      )}
                    >
                      {v.format ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right num-serif text-ink">{fmtNum(v.reach ?? 0)}</td>
                  <td className="px-3 py-3 text-right num-serif text-ink-soft">{fmtNum(v.engagement ?? 0)}</td>
                  <td className="px-3 py-3 text-right num-serif text-ink-soft">{fmtNum(v.leads_attributed ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MCCard>
    </PageShell>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <MCCard className="p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{label}</div>
      <div className="num-serif text-[28px] text-ink mt-1 leading-none">{value}</div>
    </MCCard>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: SortDir;
  className?: string;
}) {
  return (
    <th className={cn("px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium", className)}>
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-ink transition-colors", active && "text-ink")}>
        {children}
        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
