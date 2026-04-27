import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard, CardHeader } from "@/components/mc/Primitives";
import { useLinkedinPosts, useLinkedinWeekly } from "@/lib/queries";
import { fmtNum, fmtDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/linkedin")({
  head: () => ({ meta: [{ title: "LinkedIn — Christine — Momentum Command Center" }] }),
  component: LinkedInPage,
});

type SortKey = "post_date" | "impressions" | "reach" | "reactions" | "profile_views" | "followers_gained" | "topic";
type SortDir = "asc" | "desc";

function LinkedInPage() {
  const { data: posts = [] } = useLinkedinPosts();
  const { data: weekly = [] } = useLinkedinWeekly();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [range, setRange] = useState<"30" | "90" | "365" | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("post_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => (posts as any[]).find((p) => p.id === selectedId) ?? null,
    [posts, selectedId],
  );

  const types = useMemo(() => {
    const set = new Set<string>();
    (posts as any[]).forEach((p) => p.post_type && set.add(p.post_type));
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    let rows = posts as any[];
    if (range !== "all") {
      const cutoff = new Date(Date.now() - parseInt(range) * 86400_000).toISOString().slice(0, 10);
      rows = rows.filter((r) => r.post_date && r.post_date >= cutoff);
    }
    if (typeFilter !== "all") rows = rows.filter((r) => r.post_type === typeFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) => (r.topic ?? "").toLowerCase().includes(s) || (r.key_word ?? "").toLowerCase().includes(s),
      );
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? (typeof a[sortKey] === "string" ? "" : 0);
      const bv = b[sortKey] ?? (typeof b[sortKey] === "string" ? "" : 0);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [posts, range, typeFilter, search, sortKey, sortDir]);

  const totals = useMemo(
    () => ({
      posts: filtered.length,
      impressions: filtered.reduce((s, p) => s + (p.impressions ?? 0), 0),
      reach: filtered.reduce((s, p) => s + (p.reach ?? 0), 0),
      reactions: filtered.reduce((s, p) => s + (p.reactions ?? 0), 0),
      profileViews: filtered.reduce((s, p) => s + (p.profile_views ?? 0), 0),
      followersGained: filtered.reduce((s, p) => s + (p.followers_gained ?? 0), 0),
    }),
    [filtered],
  );

  const followersChart = useMemo(() => {
    return [...(weekly as any[])]
      .filter((w) => w.week_ending && w.followers_total != null)
      .sort((a, b) => (a.week_ending as string).localeCompare(b.week_ending as string))
      .map((w) => ({ day: w.week_ending, followers: w.followers_total, impressions: w.impressions ?? 0 }));
  }, [weekly]);

  const latestFollowers = followersChart[followersChart.length - 1]?.followers ?? null;
  const earliestFollowers = followersChart[0]?.followers ?? null;
  const followersDelta =
    latestFollowers != null && earliestFollowers != null ? latestFollowers - earliestFollowers : null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  return (
    <PageShell>
      <PageHeader
        title="LinkedIn — Christine"
        subtitle={`${(posts as any[]).length} posts · ${(weekly as any[]).length} weekly snapshots`}
        rightSlot={
          <Link to="/" className="text-[11px] uppercase tracking-[0.16em] text-ink-muted hover:text-gold transition-colors">
            ← Dashboard
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <Kpi label="Followers" value={latestFollowers != null ? fmtNum(latestFollowers) : "—"}
          sub={followersDelta != null ? `${followersDelta >= 0 ? "+" : ""}${fmtNum(followersDelta)} since first snapshot` : ""} />
        <Kpi label="Posts" value={fmtNum(totals.posts)} sub={range === "all" ? "All time" : `Last ${range} days`} />
        <Kpi label="Impressions" value={fmtNum(totals.impressions)} sub="Total" />
        <Kpi label="Reach" value={fmtNum(totals.reach)} sub="Unique" />
        <Kpi label="Reactions" value={fmtNum(totals.reactions)} sub="Engagement" />
        <Kpi label="Profile Views" value={fmtNum(totals.profileViews)} sub="From posts" />
      </div>

      {/* Followers chart */}
      <MCCard className="mb-6">
        <CardHeader title="Followers Over Time" meta="Weekly snapshots" />
        <div className="p-6">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={followersChart} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E8E2D2" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d: any) => fmtDate(d)} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Line type="monotone" dataKey="followers" stroke="#C4924A" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Tooltip
                  contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 11 }}
                  labelFormatter={(d: any) => fmtDate(d)}
                  formatter={(v: any) => fmtNum(v)}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </MCCard>

      {/* Filters */}
      <MCCard className="mb-6 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-line-soft">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topic or keyword…"
            className="flex-1 min-w-[200px] rounded-lg border border-line-soft bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-gold"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-line-soft bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-gold"
          >
            <option value="all">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex items-center gap-1 rounded-lg bg-cream p-1 border border-line-soft">
            {(["30", "90", "365", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 rounded text-[11px] uppercase tracking-[0.14em] transition-colors",
                  range === r ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink",
                )}
              >
                {r === "all" ? "All" : `${r}d`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <SortableTh label="Date" k="post_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Topic" k="topic" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="label-eyebrow px-4 py-3 text-left bg-cream/60">Type</th>
                <SortableTh label="Impressions" k="impressions" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right />
                <SortableTh label="Reach" k="reach" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right />
                <SortableTh label="Reactions" k="reactions" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right />
                <SortableTh label="Profile Views" k="profile_views" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right />
                <SortableTh label="Followers +" k="followers_gained" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right />
                <th className="label-eyebrow px-4 py-3 text-left bg-cream/60">Keyword</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="border-t border-line-soft mc-row-hover cursor-pointer"
                >
                  <td className="px-4 py-3 text-[12px] text-ink-soft whitespace-nowrap">{fmtDate(p.post_date)}</td>
                  <td className="px-4 py-3 text-[13px] text-ink max-w-[420px]">
                    <div className="truncate">{p.topic ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-[11px]">
                    {p.post_type ? (
                      <span className="inline-block rounded px-2 py-0.5 bg-cream-deep text-ink-soft">{p.post_type}</span>
                    ) : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 num-serif text-right text-ink">{fmtNum(p.impressions)}</td>
                  <td className="px-4 py-3 num-serif text-right text-ink">{fmtNum(p.reach)}</td>
                  <td className="px-4 py-3 num-serif text-right text-ink">{fmtNum(p.reactions)}</td>
                  <td className="px-4 py-3 num-serif text-right text-ink">{fmtNum(p.profile_views)}</td>
                  <td className="px-4 py-3 num-serif text-right text-ink">{fmtNum(p.followers_gained)}</td>
                  <td className="px-4 py-3 text-[11px] text-ink-muted">{p.key_word ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center text-ink-muted py-12 text-[13px]">No posts match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </MCCard>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-ink/40 z-40 flex justify-end"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-[560px] bg-white h-full overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-line-soft p-5 flex items-start justify-between gap-3">
              <div>
                <div className="label-eyebrow mb-1">Post Detail</div>
                <div className="text-[13px] text-ink-soft">{fmtDate(selected.post_date)} · {selected.post_type ?? "—"}</div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-ink-muted hover:text-ink text-[18px] leading-none px-2"
              >×</button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="label-eyebrow mb-2">Topic</div>
                <div className="text-[15px] text-ink leading-relaxed whitespace-pre-wrap">{selected.topic ?? "—"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailStat label="Impressions" value={fmtNum(selected.impressions)} />
                <DetailStat label="Reach" value={fmtNum(selected.reach)} />
                <DetailStat label="Reactions" value={fmtNum(selected.reactions)} />
                <DetailStat label="Profile Views" value={fmtNum(selected.profile_views)} />
                <DetailStat label="Followers Gained" value={fmtNum(selected.followers_gained)} />
                <DetailStat
                  label="Engagement Rate"
                  value={selected.impressions ? `${((selected.reactions / selected.impressions) * 100).toFixed(2)}%` : "—"}
                />
              </div>

              {selected.key_word && (
                <div>
                  <div className="label-eyebrow mb-2">Keyword</div>
                  <span className="inline-block rounded px-2 py-1 bg-cream-deep text-[12px] text-ink-soft">{selected.key_word}</span>
                </div>
              )}

              {selected.link && (
                <a
                  href={selected.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors"
                >
                  View on LinkedIn →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white border border-line-soft p-4">
      <div className="label-eyebrow text-[9px]">{label}</div>
      <div className="num-serif text-[26px] text-ink leading-none mt-2">{value}</div>
      {sub && <div className="text-[10px] text-ink-muted mt-2 uppercase tracking-[0.14em]">{sub}</div>}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-cream border border-line-soft p-3">
      <div className="label-eyebrow text-[9px]">{label}</div>
      <div className="num-serif text-[20px] text-ink leading-none mt-1.5">{value}</div>
    </div>
  );
}

function SortableTh({
  label, k, sortKey, sortDir, onClick, right,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onClick(k)}
      className={cn(
        "label-eyebrow px-4 py-3 bg-cream/60 cursor-pointer select-none hover:text-ink",
        right ? "text-right" : "text-left",
      )}
    >
      {label}
      {active && <span className="ml-1 text-gold">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
