import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/mc/PageShell";
import { useContacts, PIPELINE_STAGES, type Contact } from "@/lib/queries-v2";
import { Search, Plus } from "lucide-react";
import { fmtDateShort, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Contacts — Momentum" }] }),
  component: ContactsList,
});

const SOURCES = ["Podcast", "LinkedIn", "Referral", "Inbound", "Outreach", "Event", "Other"];

type SortKey = "name" | "company" | "stage" | "last_touch_at" | "next_followup_at";

function ContactsList() {
  const contactsQ = useContacts();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("last_touch_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const contacts = (contactsQ.data ?? []) as Contact[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = contacts.filter((c) => {
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (sourceFilter !== "all" && (c.source ?? "") !== sourceFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
    rows.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [contacts, search, stageFilter, sourceFilter, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "company" ? "asc" : "desc"); }
  }

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="serif text-[32px] lg:text-[40px] leading-none text-ink">Contacts</h1>
          <p className="mt-1.5 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
            {filtered.length} of {contacts.length} · All stages, all sources
          </p>
        </div>
        <Link to="/crm" className="inline-flex items-center gap-1.5 px-3 py-2 bg-gold text-white rounded-md text-sm hover:bg-gold/90">
          <Plus className="h-4 w-4" /> Pipeline view
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, email…"
            className="w-full pl-8 pr-3 py-2 border border-line rounded-md text-sm bg-paper focus:outline-none focus:border-gold-soft"
          />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="px-3 py-2 border border-line rounded-md text-sm bg-paper">
          <option value="all">All stages</option>
          {PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="px-3 py-2 border border-line rounded-md text-sm bg-paper">
          <option value="all">All sources</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="mc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-cream-deep text-left">
                <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>Name</Th>
                <Th onClick={() => toggleSort("company")} active={sortKey === "company"} dir={sortDir}>Company</Th>
                <Th onClick={() => toggleSort("stage")} active={sortKey === "stage"} dir={sortDir}>Stage</Th>
                <th className="px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium">Source</th>
                <Th onClick={() => toggleSort("last_touch_at")} active={sortKey === "last_touch_at"} dir={sortDir}>Last touch</Th>
                <Th onClick={() => toggleSort("next_followup_at")} active={sortKey === "next_followup_at"} dir={sortDir}>Next follow-up</Th>
              </tr>
            </thead>
            <tbody>
              {contactsQ.isLoading && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-muted">Loading…</td></tr>
              )}
              {!contactsQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-muted">No contacts match these filters.</td></tr>
              )}
              {filtered.map((c) => {
                const overdue = c.next_followup_at && c.next_followup_at <= new Date().toISOString().slice(0, 10);
                return (
                  <tr key={c.id} className="border-t border-line-soft hover:bg-cream-deep/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <Link to="/crm/$id" params={{ id: c.id }} className="flex items-center gap-2 group">
                        <span className="h-7 w-7 rounded-full bg-gold/15 text-gold flex items-center justify-center text-[10px] font-medium shrink-0">
                          {initials(c.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-ink font-medium group-hover:text-gold truncate">{c.name}</div>
                          {c.email && <div className="text-[11px] text-ink-muted truncate">{c.email}</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{c.company ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block px-2 py-0.5 bg-cream-deep rounded text-[11px] text-ink-soft">{c.stage}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft text-[12px]">{c.source ?? "—"}</td>
                    <td className="px-3 py-2.5 text-ink-muted text-[12px] whitespace-nowrap">{c.last_touch_at ? fmtDateShort(c.last_touch_at) : "—"}</td>
                    <td className={cn("px-3 py-2.5 text-[12px] whitespace-nowrap", overdue ? "text-burgundy font-medium" : "text-ink-muted")}>
                      {c.next_followup_at ? fmtDateShort(c.next_followup_at) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}

function Th({ children, onClick, active, dir }: { children: React.ReactNode; onClick: () => void; active: boolean; dir: "asc" | "desc" }) {
  return (
    <th className="px-3 py-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium">
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {children}
        {active && <span>{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
