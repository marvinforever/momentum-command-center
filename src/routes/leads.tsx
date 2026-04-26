import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { useLeads } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Leads — Momentum Command Center" }] }),
  component: LeadsPage,
});

const LEAD_SOURCES = [
  "YouTube",
  "Facebook Ad",
  "LinkedIn",
  "Instagram",
  "Podcast",
  "Outreach",
  "Client Referral",
  "Direct/Other",
];

const STATUS_OPTIONS = ["New", "Nurturing", "Booked", "Enrolled", "Disqualified", "Lost"];

type SortKey = "first_touch_date" | "name" | "lead_source" | "status";
type SortDir = "asc" | "desc";

function LeadsPage() {
  const { data: leads = [], isLoading } = useLeads();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [missingOnly, setMissingOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("first_touch_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    let rows = [...(leads as any[])];
    if (sourceFilter !== "all") rows = rows.filter((l) => l.lead_source === sourceFilter);
    if (statusFilter !== "all") rows = rows.filter((l) => (l.status ?? "New") === statusFilter);
    if (missingOnly) rows = rows.filter((l) => !l.lead_source);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (l) =>
          (l.name ?? "").toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.how_did_you_hear ?? "").toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [leads, search, sourceFilter, statusFilter, missingOnly, sortKey, sortDir]);

  const missingCount = useMemo(
    () => (leads as any[]).filter((l) => !l.lead_source).length,
    [leads],
  );

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  }

  async function updateLead(id: string, patch: Record<string, any>) {
    const { error } = await supabase.from("leads").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <PageShell>
      <div className="flex items-start justify-between">
        <PageHeader
          title="Leads"
          subtitle="Every lead · Source attribution required"
          breadcrumbs={[{ label: "Command Center", to: "/" }, { label: "Leads" }]}
        />
        <Link
          to="/admin"
          className="mt-2 rounded-lg bg-gold px-4 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors"
        >
          + Add Lead
        </Link>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryTile label="Total Leads" value={String(leads.length)} />
        <SummaryTile
          label="Missing Source"
          value={String(missingCount)}
          tone={missingCount > 0 ? "alert" : "default"}
        />
        <SummaryTile
          label="YouTube"
          value={String((leads as any[]).filter((l) => l.lead_source === "YouTube").length)}
        />
        <SummaryTile
          label="LinkedIn"
          value={String((leads as any[]).filter((l) => l.lead_source === "LinkedIn").length)}
        />
      </div>

      {/* Filters */}
      <MCCard className="p-4 mb-4">
        <div className="grid grid-cols-[1fr_180px_180px_auto] gap-3 items-center">
          <input
            placeholder="Search name, email, how-did-you-hear…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-gold-soft"
          >
            <option value="all">All sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-line bg-cream px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-gold-soft"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[12px] text-ink-soft cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
              className="rounded border-line"
            />
            Missing source only
          </label>
        </div>
      </MCCard>

      {/* Table */}
      <MCCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-cream-deep text-left">
                <Th onClick={() => toggleSort("first_touch_date")} active={sortKey === "first_touch_date"} dir={sortDir} className="w-[110px]">
                  Date
                </Th>
                <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                  Name / Email
                </Th>
                <Th onClick={() => toggleSort("lead_source")} active={sortKey === "lead_source"} dir={sortDir} className="w-[180px]">
                  Source
                </Th>
                <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir} className="w-[150px]">
                  Status
                </Th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium w-[200px]">
                  How did you hear
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-ink-muted">
                    Loading leads…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-ink-muted">
                    No leads match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((l) => {
                const missing = !l.lead_source;
                return (
                  <tr key={l.id} className={cn("border-t border-line-soft hover:bg-cream-deep/40 transition-colors", missing && "bg-burgundy-bg/30")}>
                    <td className="px-3 py-3 text-ink-soft whitespace-nowrap">
                      {l.first_touch_date ? fmtDate(l.first_touch_date) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-ink font-medium">{l.name}</div>
                      {l.email && <div className="text-[11px] text-ink-muted">{l.email}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={l.lead_source ?? ""}
                        onChange={(e) => updateLead(l.id, { lead_source: e.target.value || null })}
                        className={cn(
                          "w-full rounded-md border px-2 py-1.5 text-[12px] focus:outline-none focus:border-gold-soft",
                          missing
                            ? "border-burgundy bg-burgundy-bg/50 text-burgundy font-medium"
                            : "border-line bg-cream text-ink",
                        )}
                      >
                        <option value="">⚠ Set source…</option>
                        {LEAD_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={l.status ?? "New"}
                        onChange={(e) => updateLead(l.id, { status: e.target.value })}
                        className="w-full rounded-md border border-line bg-cream px-2 py-1.5 text-[12px] text-ink focus:outline-none focus:border-gold-soft"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-ink-soft text-[12px] truncate" title={l.how_did_you_hear ?? ""}>
                      {l.how_did_you_hear ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </MCCard>
    </PageShell>
  );
}

function SummaryTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "alert" }) {
  return (
    <MCCard className="p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{label}</div>
      <div
        className={cn(
          "num-serif text-[28px] mt-1 leading-none",
          tone === "alert" ? "text-burgundy" : "text-ink",
        )}
      >
        {value}
      </div>
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
