import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { useYoutubeContent, useYoutubeChannels } from "@/lib/queries";
import { fmtNum, fmtDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/youtube")({
  head: () => ({ meta: [{ title: "YouTube Videos — Momentum Command Center" }] }),
  component: YouTubeVideosPage,
});

type SortKey = "publish_date" | "reach" | "engagement" | "leads_attributed" | "title";
type SortDir = "asc" | "desc";

function YouTubeVideosPage() {
  const { data: videos = [], isLoading } = useYoutubeContent();
  const { data: channels = [] } = useYoutubeChannels();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("publish_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedVideo = useMemo(
    () => (videos as any[]).find((v) => v.id === selectedId) ?? null,
    [videos, selectedId],
  );

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
      <div className="flex items-start justify-between">
        <PageHeader
          title="YouTube Videos"
          subtitle="All synced videos · Both channels"
          breadcrumbs={[
            { label: "Command Center", to: "/" },
            { label: "YouTube Videos" },
          ]}
        />
        <Link
          to="/admin/integrations"
          className="mt-2 rounded-lg border border-line bg-cream px-4 py-2 text-[12px] font-medium text-ink-soft hover:bg-cream-deep transition-colors"
        >
          Run Sync →
        </Link>
      </div>

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
            <option value="Long-form Video">Long-form</option>
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
                <tr
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={cn(
                    "border-t border-line-soft hover:bg-cream-deep/40 transition-colors cursor-pointer",
                    selectedId === v.id && "bg-gold/10",
                  )}
                >
                  <td className="px-3 py-3 text-ink-soft whitespace-nowrap">{v.publish_date ? fmtDate(v.publish_date) : "—"}</td>
                  <td className="px-3 py-3">
                    {v.link ? (
                      <a
                        href={v.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-ink hover:text-gold transition-colors line-clamp-2"
                      >
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
                  <td className="px-3 py-3 text-right num-serif text-ink-soft">
                    {(v.leads_attributed ?? 0) > 0 ? (
                      <span className="text-gold font-medium">{fmtNum(v.leads_attributed)}</span>
                    ) : (
                      <span className="text-ink-muted">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MCCard>

      {selectedVideo && (
        <VideoEditPanel
          video={selectedVideo}
          onClose={() => setSelectedId(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["content"] })}
        />
      )}
    </PageShell>
  );
}

const EFFECT_OPTIONS = ["Untracked", "High Impact", "Solid Performer", "Low Impact", "Underperforming"];

function VideoEditPanel({
  video,
  onClose,
  onSaved,
}: {
  video: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [leads, setLeads] = useState(String(video.leads_attributed ?? 0));
  const [topic, setTopic] = useState(video.topic ?? "");
  const [notes, setNotes] = useState(video.notes ?? "");
  const [effect, setEffect] = useState(video.effect_rating ?? "Untracked");
  const [busy, setBusy] = useState(false);

  // Reset when video changes
  useMemo(() => {
    setLeads(String(video.leads_attributed ?? 0));
    setTopic(video.topic ?? "");
    setNotes(video.notes ?? "");
    setEffect(video.effect_rating ?? "Untracked");
  }, [video.id]);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("content")
      .update({
        leads_attributed: Number(leads) || 0,
        topic: topic || null,
        notes: notes || null,
        effect_rating: effect,
      })
      .eq("id", video.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Video updated");
    onSaved();
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-ink/30 z-40" onClick={onClose} />
      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[460px] bg-cream z-50 shadow-2xl overflow-y-auto border-l border-line">
        <div className="sticky top-0 bg-cream border-b border-line-soft px-6 py-4 flex items-center justify-between">
          <div>
            <div className="label-eyebrow text-[9px]">Edit Video</div>
            <div className="text-[12px] text-ink-soft mt-1">{video.publish_date ? fmtDate(video.publish_date) : "—"}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg w-8 h-8 flex items-center justify-center text-ink-muted hover:bg-cream-deep transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h3 className="serif text-[18px] text-ink leading-tight">{video.title}</h3>
            {video.link && (
              <a
                href={video.link}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 text-[11px] text-gold hover:underline"
              >
                Open on YouTube →
              </a>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 py-3 border-y border-line-soft">
            <ReadStat label="Views" value={fmtNum(video.reach ?? 0)} />
            <ReadStat label="Engagement" value={fmtNum(video.engagement ?? 0)} />
            <ReadStat label="Format" value={video.format ?? "—"} />
          </div>

          <Field label="Leads Attributed">
            <input
              type="number"
              min="0"
              value={leads}
              onChange={(e) => setLeads(e.target.value)}
              className="w-full rounded-lg border border-line bg-cream-deep px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30"
            />
            <p className="text-[10px] text-ink-muted mt-1">
              Manual entry — increment when a lead tells you they came from this video.
            </p>
          </Field>

          <Field label="Topic">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Calving season prep"
              className="w-full rounded-lg border border-line bg-cream-deep px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30"
            />
          </Field>

          <Field label="Effect Rating">
            <select
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              className="w-full rounded-lg border border-line bg-cream-deep px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft"
            >
              {EFFECT_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-line bg-cream-deep px-3 py-2.5 text-[13px] text-ink min-h-[100px] focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30"
            />
          </Field>

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-line bg-cream px-4 py-2 text-[12px] font-medium text-ink-soft hover:bg-cream-deep transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-gold px-5 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="border-t border-line-soft pt-4 mt-2">
            <Link
              to="/leads"
              className="text-[11px] text-ink-soft hover:text-gold transition-colors"
            >
              → Manage all leads
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted block mb-1.5 font-medium">{label}</span>
      {children}
    </label>
  );
}

function ReadStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-ink-muted">{label}</div>
      <div className="num-serif text-[16px] text-ink mt-0.5">{value}</div>
    </div>
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
