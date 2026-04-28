import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/mc/PageShell";
import { useContacts, useUpdateContactStage, useCreateContact, PIPELINE_STAGES, type Contact } from "@/lib/queries-v2";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/crm")({
  head: () => ({ meta: [{ title: "CRM — Momentum" }] }),
  component: CrmBoard,
});

function CrmBoard() {
  const navigate = useNavigate();
  const contactsQ = useContacts();
  const updateStage = useUpdateContactStage();
  const create = useCreateContact();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newStage, setNewStage] = useState<string>("Prospect");

  const contacts = contactsQ.data ?? [];
  const byStage = new Map<string, Contact[]>();
  for (const s of PIPELINE_STAGES) byStage.set(s, []);
  for (const c of contacts) {
    const arr = byStage.get(c.stage) ?? byStage.get("No Status")!;
    arr.push(c);
  }

  const handleDrop = async (stage: string) => {
    if (!draggingId) return;
    const card = contacts.find((c) => c.id === draggingId);
    if (!card || card.stage === stage) { setDraggingId(null); return; }
    try {
      await updateStage.mutateAsync({ id: card.id, stage, previous: card.stage });
      toast.success(`Moved to ${stage}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
    setDraggingId(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await create.mutateAsync({ name: newName.trim(), company: newCompany.trim() || null, stage: newStage });
      toast.success("Contact created");
      setShowNew(false); setNewName(""); setNewCompany(""); setNewStage("Prospect");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <PageShell fullBleed>
      <div className="px-4 sm:px-6 lg:px-10 pt-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="serif text-[32px] lg:text-[40px] leading-none text-ink">CRM</h1>
            <p className="mt-1.5 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
              Pipeline · Drag cards between stages
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gold text-white rounded-md text-sm hover:bg-gold/90"
          >
            <Plus className="h-4 w-4" /> New contact
          </button>
        </div>

        {showNew && (
          <div className="mc-card p-4 mb-4 max-w-xl">
            <h3 className="serif text-lg text-ink mb-3">New contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name *" className="px-3 py-2 border border-line rounded text-sm" />
              <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company" className="px-3 py-2 border border-line rounded text-sm" />
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

      <div className="overflow-x-auto px-4 sm:px-6 lg:px-10 pb-10">
        <div className="flex gap-3 min-w-max">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
              className="w-[260px] shrink-0 bg-cream-deep/40 rounded-lg border border-line-soft p-2"
            >
              <div className="px-2 py-1.5 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.16em] text-ink-soft font-medium">{stage}</span>
                <span className="text-[11px] text-ink-muted">{(byStage.get(stage) ?? []).length}</span>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {(byStage.get(stage) ?? []).map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggingId(c.id)}
                    onClick={() => navigate({ to: "/crm/$id", params: { id: c.id } })}
                    className={
                      "bg-paper border border-line-soft rounded-md p-2.5 cursor-grab active:cursor-grabbing hover:border-gold transition-colors " +
                      (draggingId === c.id ? "opacity-40" : "")
                    }
                  >
                    <div className="text-[13px] text-ink font-medium truncate">{c.name}</div>
                    {c.company && <div className="text-[11px] text-ink-muted truncate">{c.company}</div>}
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-ink-muted">
                      <span>{c.source ?? ""}</span>
                      <span>{c.last_touch_at ? fmtDate(c.last_touch_at) : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
