import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/mc/PageShell";
import {
  useContacts, useUpdateContactStage, useCreateContact,
  PIPELINE_STAGES, type Contact,
} from "@/lib/queries-v2";
import { Plus, Search, List as ListIcon } from "lucide-react";
import { toast } from "sonner";
import { fmtDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crm")({
  head: () => ({ meta: [{ title: "CRM — Momentum" }] }),
  component: CrmBoard,
});

const SOURCES = ["Podcast", "LinkedIn", "Referral", "Inbound", "Outreach", "Event", "Other"];

const SOURCE_DOT: Record<string, string> = {
  Podcast: "bg-burgundy",
  LinkedIn: "bg-sage",
  Referral: "bg-gold",
  Inbound: "bg-ink",
  Outreach: "bg-ink-soft",
  Event: "bg-burgundy/70",
  Other: "bg-ink-muted",
};

const STAGE_ACCENT: Record<string, string> = {
  "No Status": "border-l-ink-muted",
  Prospect: "border-l-ink-soft",
  "Discovery Booked": "border-l-sage",
  "Follow Up": "border-l-gold",
  Demo: "border-l-gold",
  "Proposal Sent": "border-l-burgundy",
  "Hold Off": "border-l-ink-muted",
  "Closed Won": "border-l-sage",
  "Closed Lost": "border-l-burgundy",
};

function CrmBoard() {
  const navigate = useNavigate();
  const contactsQ = useContacts();
  const updateStage = useUpdateContactStage();
  const create = useCreateContact();

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newSource, setNewSource] = useState<string>("");
  const [newStage, setNewStage] = useState<string>("Prospect");

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const allContacts = contactsQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allContacts.filter((c) => {
      if (sourceFilter !== "all" && (c.source ?? "") !== sourceFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [allContacts, search, sourceFilter]);

  const byStage = new Map<string, Contact[]>();
  for (const s of PIPELINE_STAGES) byStage.set(s, []);
  for (const c of filtered) {
    const arr = byStage.get(c.stage) ?? byStage.get("No Status")!;
    arr.push(c);
  }

  const wonCount = (byStage.get("Closed Won") ?? []).length;
  const activeCount = filtered.filter(
    (c) => c.stage !== "Closed Won" && c.stage !== "Closed Lost",
  ).length;

  const handleDrop = async (stage: string) => {
    setDragOverStage(null);
    if (!draggingId) return;
    const card = allContacts.find((c) => c.id === draggingId);
    setDraggingId(null);
    if (!card || card.stage === stage) return;
    try {
      await updateStage.mutateAsync({ id: card.id, stage, previous: card.stage });
      toast.success(`Moved to ${stage}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await create.mutateAsync({
        name: newName.trim(),
        company: newCompany.trim() || null,
        source: newSource || null,
        stage: newStage,
      });
      toast.success("Contact created");
      setShowNew(false); setNewName(""); setNewCompany(""); setNewSource(""); setNewStage("Prospect");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <PageShell fullBleed>
      <div className="px-4 sm:px-6 lg:px-10 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="serif text-[32px] lg:text-[40px] leading-none text-ink">CRM</h1>
            <p className="mt-1.5 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
              Pipeline · {filtered.length} contacts · {activeCount} active · {wonCount} won
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/contacts"
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-line text-ink rounded-md text-sm hover:bg-cream-deep"
            >
              <ListIcon className="h-4 w-4" /> List view
            </Link>
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gold text-white rounded-md text-sm hover:bg-gold/90"
            >
              <Plus className="h-4 w-4" /> New contact
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, email…"
              className="w-full pl-8 pr-3 py-2 border border-line rounded-md text-sm bg-paper focus:outline-none focus:border-gold-soft"
            />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-line rounded-md text-sm bg-paper"
          >
            <option value="all">All sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {showNew && (
          <div className="mc-card p-4 mb-4 max-w-2xl">
            <h3 className="serif text-lg text-ink mb-3">New contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name *" className="px-3 py-2 border border-line rounded text-sm" />
              <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company" className="px-3 py-2 border border-line rounded text-sm" />
              <select value={newSource} onChange={(e) => setNewSource(e.target.value)} className="px-3 py-2 border border-line rounded text-sm">
                <option value="">— Source —</option>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={newStage} onChange={(e) => setNewStage(e.target.value)} className="px-3 py-2 border border-line rounded text-sm">
                {PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} className="px-3 py-1.5 bg-ink text-cream rounded text-sm">Create</button>
              <button onClick={() => setShowNew(false)} className="px-3 py-1.5 border border-line rounded text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {contactsQ.isLoading && (
        <div className="px-4 sm:px-6 lg:px-10 text-ink-muted text-sm">Loading pipeline…</div>
      )}

      <div className="overflow-x-auto px-4 sm:px-6 lg:px-10 pb-10">
        <div className="flex gap-3 min-w-max">
          {PIPELINE_STAGES.map((stage) => {
            const cards = byStage.get(stage) ?? [];
            const isOver = dragOverStage === stage;
            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); if (dragOverStage !== stage) setDragOverStage(stage); }}
                onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
                onDrop={() => handleDrop(stage)}
                className={cn(
                  "w-[270px] shrink-0 rounded-lg border p-2 transition-colors",
                  isOver
                    ? "bg-gold/10 border-gold"
                    : "bg-cream-deep/40 border-line-soft",
                )}
              >
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-ink-soft font-medium">{stage}</span>
                  <span className="text-[11px] text-ink-muted tabular-nums">{cards.length}</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {cards.length === 0 && (
                    <div className="text-[11px] text-ink-muted/70 italic px-2 py-4 text-center">
                      Drop here
                    </div>
                  )}
                  {cards.map((c) => {
                    const overdue = c.next_followup_at && c.next_followup_at <= new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDraggingId(c.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
                        onClick={() => navigate({ to: "/crm/$id", params: { id: c.id } })}
                        className={cn(
                          "bg-paper border border-line-soft border-l-2 rounded-md p-2.5 cursor-grab active:cursor-grabbing hover:border-gold transition-colors",
                          STAGE_ACCENT[stage],
                          draggingId === c.id && "opacity-40",
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <span
                            className={cn(
                              "mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0",
                              SOURCE_DOT[c.source ?? "Other"] ?? "bg-ink-muted",
                            )}
                            title={c.source ?? "No source"}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] text-ink font-medium truncate">{c.name}</div>
                            {c.company && <div className="text-[11px] text-ink-muted truncate">{c.company}</div>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-ink-muted">
                          <span className="truncate">
                            {c.last_touch_at ? `Last: ${fmtDateShort(c.last_touch_at)}` : "—"}
                          </span>
                          {c.next_followup_at && (
                            <span className={cn(
                              "shrink-0 ml-2 px-1.5 py-0.5 rounded",
                              overdue ? "bg-burgundy text-white" : "bg-cream-deep text-ink-soft",
                            )}>
                              ⏰ {fmtDateShort(c.next_followup_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
