import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/mc/PageShell";
import {
  useContacts, useUpdateContactStage, useCreateContact,
  useCampaigns, useCreateCampaign, DEFAULT_CAMPAIGN_STAGES,
  type Contact, type Campaign,
} from "@/lib/queries-v2";
import { Plus, Search, List as ListIcon, Megaphone, Settings, ChevronRight, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { fmtDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EditCampaignDrawer } from "@/components/mc/EditCampaignDrawer";

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

// Tints for any stage label — falls through gracefully for custom stage names.
function stageAccent(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("won")) return "border-l-sage";
  if (s.includes("no sale") || s.includes("lost")) return "border-l-burgundy";
  if (s.includes("follow")) return "border-l-gold";
  if (s.includes("call") || s.includes("demo") || s.includes("booked")) return "border-l-sage";
  if (s.includes("opt")) return "border-l-gold";
  if (s.includes("lead") || s.includes("prospect")) return "border-l-ink-soft";
  if (s.includes("hold")) return "border-l-ink-muted";
  if (s.includes("proposal")) return "border-l-burgundy";
  return "border-l-ink-muted";
}

const DATA_SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "kajabi", label: "Kajabi (Email)" },
  { value: "youtube", label: "YouTube" },
  { value: "podcast", label: "Podcast" },
];

function CrmBoard() {
  const navigate = useNavigate();
  const contactsQ = useContacts();
  const campaignsQ = useCampaigns();
  const updateStage = useUpdateContactStage();
  const create = useCreateContact();
  const createCampaign = useCreateCampaign();

  const campaigns = campaignsQ.data ?? [];
  const allContacts = contactsQ.data ?? [];

  // "all" or campaign id
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const selectedCampaign: Campaign | null = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  // Stages depend on selected campaign; "all" view shows the Lead-In funnel by default.
  const stages: string[] = selectedCampaign?.pipeline_stages?.length
    ? selectedCampaign.pipeline_stages
    : DEFAULT_CAMPAIGN_STAGES;

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // New contact
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newSource, setNewSource] = useState<string>("");
  const [newStage, setNewStage] = useState<string>(stages[0] ?? "Lead In");

  // New campaign
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campName, setCampName] = useState("");
  const [campSource, setCampSource] = useState("manual");
  const [campChannel, setCampChannel] = useState("Other");

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allContacts.filter((c: any) => {
      // Campaign filter
      if (selectedCampaignId !== "all" && c.campaign_id !== selectedCampaignId) return false;
      if (sourceFilter !== "all" && (c.source ?? "") !== sourceFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [allContacts, search, sourceFilter, selectedCampaignId]);

  const byStage = new Map<string, Contact[]>();
  for (const s of stages) byStage.set(s, []);
  const orphanStage = stages[0]; // contacts with stages outside the current campaign's set land in column 1
  for (const c of filtered) {
    if (byStage.has(c.stage)) byStage.get(c.stage)!.push(c);
    else byStage.get(orphanStage)!.push(c);
  }

  const wonCount = filtered.filter((c) => /won/i.test(c.stage)).length;
  const activeCount = filtered.filter((c) => !/won|lost|no sale/i.test(c.stage)).length;

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
        campaign_id: selectedCampaignId !== "all" ? selectedCampaignId : null,
      } as any);
      toast.success("Contact created");
      setShowNew(false); setNewName(""); setNewCompany(""); setNewSource(""); setNewStage(stages[0]);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const handleCreateCampaign = async () => {
    if (!campName.trim()) return;
    try {
      const c = await createCampaign.mutateAsync({
        name: campName.trim(),
        data_source: campSource,
        primary_channel: campChannel,
      });
      toast.success(`Campaign "${c.name}" created`);
      setSelectedCampaignId(c.id);
      setShowNewCampaign(false); setCampName(""); setCampSource("manual"); setCampChannel("Other");
    } catch (e: any) { toast.error(e.message ?? "Failed to create campaign"); }
  };

  return (
    <PageShell fullBleed>
      <div className="px-4 sm:px-6 lg:px-10 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="serif text-[32px] lg:text-[40px] leading-none text-ink">CRM</h1>
            <p className="mt-1.5 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
              {selectedCampaign ? selectedCampaign.name : "All campaigns"} · {filtered.length} contacts · {activeCount} active · {wonCount} won
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedCampaign && (
              <button
                onClick={() => setEditCampaign(selectedCampaign)}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-line text-ink rounded-md text-sm hover:bg-cream-deep"
                title="Edit campaign & data source"
              >
                <Settings className="h-4 w-4" /> Edit campaign
              </button>
            )}
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

        {/* Campaign selector */}
        <div className="mb-4 -mx-1 flex items-center gap-2 overflow-x-auto pb-1 px-1">
          <button
            onClick={() => setSelectedCampaignId("all")}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors",
              selectedCampaignId === "all"
                ? "bg-ink text-cream border-ink"
                : "bg-paper text-ink border-line hover:border-ink-soft",
            )}
          >
            All campaigns
            <span className="text-[10px] opacity-70 tabular-nums">({allContacts.length})</span>
          </button>
          {campaigns.map((camp) => {
            const count = allContacts.filter((c: any) => c.campaign_id === camp.id).length;
            const active = selectedCampaignId === camp.id;
            return (
              <button
                key={camp.id}
                onClick={() => setSelectedCampaignId(camp.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors",
                  active
                    ? "text-cream border-transparent"
                    : "bg-paper text-ink border-line hover:border-ink-soft",
                )}
                style={active && camp.color ? { background: camp.color, borderColor: camp.color } : active ? { background: "var(--color-ink)" } : undefined}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: camp.color ?? "var(--color-ink-muted)" }}
                />
                {camp.name}
                <span className="text-[10px] opacity-70 tabular-nums">({count})</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowNewCampaign(true)}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] border border-dashed border-line text-ink-soft hover:border-gold hover:text-gold"
          >
            <Plus className="h-3.5 w-3.5" /> New campaign
          </button>
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

        {showNewCampaign && (
          <div className="mc-card p-4 mb-4 max-w-2xl">
            <h3 className="serif text-lg text-ink mb-1 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-gold" /> New campaign
            </h3>
            <p className="text-[11px] text-ink-muted mb-3">
              Pick where this campaign's data lives. Manual = you'll log it yourself; the others will pull metrics from connected integrations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                placeholder="Campaign name *"
                className="px-3 py-2 border border-line rounded text-sm sm:col-span-1"
              />
              <select
                value={campSource}
                onChange={(e) => setCampSource(e.target.value)}
                className="px-3 py-2 border border-line rounded text-sm"
              >
                {DATA_SOURCES.map((d) => <option key={d.value} value={d.value}>Source: {d.label}</option>)}
              </select>
              <select
                value={campChannel}
                onChange={(e) => setCampChannel(e.target.value)}
                className="px-3 py-2 border border-line rounded text-sm"
              >
                <option value="Other">Channel: Other</option>
                <option value="Meta Ads">Channel: Meta Ads</option>
                <option value="LinkedIn">Channel: LinkedIn</option>
                <option value="YouTube">Channel: YouTube</option>
                <option value="Email">Channel: Email</option>
                <option value="Podcast">Channel: Podcast</option>
                <option value="Multi-Channel">Channel: Multi-Channel</option>
              </select>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreateCampaign} className="px-3 py-1.5 bg-ink text-cream rounded text-sm">Create campaign</button>
              <button onClick={() => setShowNewCampaign(false)} className="px-3 py-1.5 border border-line rounded text-sm">Cancel</button>
            </div>
          </div>
        )}

        {showNew && (
          <div className="mc-card p-4 mb-4 max-w-2xl">
            <h3 className="serif text-lg text-ink mb-3">
              New contact
              {selectedCampaign && <span className="text-[12px] text-ink-muted font-normal ml-2">→ {selectedCampaign.name}</span>}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name *" className="px-3 py-2 border border-line rounded text-sm" />
              <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company" className="px-3 py-2 border border-line rounded text-sm" />
              <select value={newSource} onChange={(e) => setNewSource(e.target.value)} className="px-3 py-2 border border-line rounded text-sm">
                <option value="">— Source —</option>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={newStage} onChange={(e) => setNewStage(e.target.value)} className="px-3 py-2 border border-line rounded text-sm">
                {stages.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreate} className="px-3 py-1.5 bg-ink text-cream rounded text-sm">Create</button>
              <button onClick={() => setShowNew(false)} className="px-3 py-1.5 border border-line rounded text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {(contactsQ.isLoading || campaignsQ.isLoading) && (
        <div className="px-4 sm:px-6 lg:px-10 text-ink-muted text-sm">Loading pipeline…</div>
      )}

      {selectedCampaignId !== "all" && filtered.length === 0 && !contactsQ.isLoading && (
        <div className="px-4 sm:px-6 lg:px-10 mb-4">
          <div className="mc-card p-6 text-center text-ink-muted text-sm max-w-2xl">
            No contacts in <strong className="text-ink">{selectedCampaign?.name}</strong> yet.
            Add a contact and they'll be tagged to this campaign automatically, or open an existing
            contact to assign them.
          </div>
        </div>
      )}

      <div className="overflow-x-auto px-4 sm:px-6 lg:px-10 pb-10">
        <div className="flex gap-3 min-w-max">
          {stages.map((stage) => {
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
                        title="Click to open · Drag to move"
                        className={cn(
                          "group bg-paper border border-line-soft border-l-2 rounded-md p-2.5 cursor-pointer hover:border-gold hover:shadow-sm transition-all",
                          stageAccent(stage),
                          draggingId === c.id && "opacity-40",
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical
                            className="h-3 w-3 text-ink-muted/40 mt-1 shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                          <span
                            className={cn(
                              "mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0",
                              SOURCE_DOT[c.source ?? "Other"] ?? "bg-ink-muted",
                            )}
                            title={c.source ?? "No source"}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] text-ink font-medium truncate group-hover:text-gold group-hover:underline underline-offset-2 decoration-gold/40">{c.name}</div>
                            {c.company && <div className="text-[11px] text-ink-muted truncate">{c.company}</div>}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-gold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
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
      {editCampaign && (
        <EditCampaignDrawer campaign={editCampaign} onClose={() => setEditCampaign(null)} />
      )}
    </PageShell>
  );
}
