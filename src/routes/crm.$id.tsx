import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/mc/PageShell";
import {
  useContact, useContactNotes, useContactActivity, useContactFollowUps,
  useAddContactNote, useAddFollowUp, useCompleteFollowUp, useUpdateContactStage,
  useUpdateContact, PIPELINE_STAGES,
} from "@/lib/queries-v2";
import { fmtDate, timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { Check } from "lucide-react";

export const Route = createFileRoute("/crm/$id")({
  head: () => ({ meta: [{ title: "Contact — Momentum" }] }),
  component: ContactDetail,
});

function ContactDetail() {
  const { id } = Route.useParams();
  const contactQ = useContact(id);
  const notesQ = useContactNotes(id);
  const actQ = useContactActivity(id);
  const fuQ = useContactFollowUps(id);

  const addNote = useAddContactNote();
  const addFu = useAddFollowUp();
  const completeFu = useCompleteFollowUp();
  const updateStage = useUpdateContactStage();
  const updateContact = useUpdateContact();

  const [noteBody, setNoteBody] = useState("");
  const [fuDate, setFuDate] = useState("");
  const [fuDesc, setFuDesc] = useState("");

  const c = contactQ.data;
  if (contactQ.isLoading) return <PageShell><div className="text-ink-muted">Loading…</div></PageShell>;
  if (!c) return <PageShell><div className="text-ink-muted">Contact not found. <Link to="/crm" className="text-gold">Back to CRM</Link></div></PageShell>;

  return (
    <PageShell>
      <div className="mb-4 text-[11px] uppercase tracking-[0.16em] text-ink-muted">
        <Link to="/crm" className="hover:text-gold">← CRM</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="mc-card p-5">
            <h1 className="serif text-3xl text-ink">{c.name}</h1>
            {c.company && <div className="text-ink-soft mt-1">{c.company}{c.role ? ` · ${c.role}` : ""}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={c.stage}
                onChange={async (e) => {
                  try {
                    await updateStage.mutateAsync({ id: c.id, stage: e.target.value, previous: c.stage });
                    toast.success("Stage updated");
                  } catch (err: any) { toast.error(err.message); }
                }}
                className="px-2 py-1 border border-line rounded text-sm"
              >
                {PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
              {c.source && <span className="px-2 py-1 bg-cream-deep rounded text-xs text-ink-soft">{c.source}</span>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Field label="Email" value={c.email} onSave={(v) => updateContact.mutate({ id: c.id, email: v })} />
              <Field label="Phone" value={c.phone} onSave={(v) => updateContact.mutate({ id: c.id, phone: v })} />
              <Field label="Source" value={c.source} onSave={(v) => updateContact.mutate({ id: c.id, source: v })} />
              <Field label="Owner" value={c.owner} onSave={(v) => updateContact.mutate({ id: c.id, owner: v })} />
            </div>
          </div>

          <div className="mc-card p-5">
            <h2 className="serif text-xl text-ink mb-3">Notes</h2>
            <div className="flex gap-2 mb-4">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                className="flex-1 px-3 py-2 border border-line rounded text-sm"
              />
              <button
                onClick={async () => {
                  if (!noteBody.trim()) return;
                  await addNote.mutateAsync({ contact_id: c.id, body: noteBody.trim() });
                  setNoteBody(""); toast.success("Note added");
                }}
                className="px-3 py-2 bg-ink text-cream rounded text-sm self-end"
              >Add</button>
            </div>
            <div className="space-y-3">
              {(notesQ.data ?? []).map((n: any) => (
                <div key={n.id} className="border-l-2 border-gold pl-3">
                  <div className="text-sm text-ink whitespace-pre-wrap">{n.body}</div>
                  <div className="text-[11px] text-ink-muted mt-1">{timeAgo(n.created_at)}</div>
                </div>
              ))}
              {(notesQ.data ?? []).length === 0 && <div className="text-ink-muted text-sm">No notes yet.</div>}
            </div>
          </div>
        </div>

        {/* Right: follow-ups + activity */}
        <div className="space-y-4">
          <div className="mc-card p-5">
            <h2 className="serif text-xl text-ink mb-3">Follow-ups</h2>
            <div className="space-y-2 mb-3">
              <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} className="w-full px-3 py-2 border border-line rounded text-sm" />
              <input value={fuDesc} onChange={(e) => setFuDesc(e.target.value)} placeholder="What's the action?" className="w-full px-3 py-2 border border-line rounded text-sm" />
              <button
                onClick={async () => {
                  if (!fuDate || !fuDesc.trim()) return;
                  await addFu.mutateAsync({ contact_id: c.id, due_date: fuDate, description: fuDesc.trim() });
                  setFuDate(""); setFuDesc(""); toast.success("Follow-up added");
                }}
                className="w-full px-3 py-2 bg-gold text-white rounded text-sm"
              >Schedule</button>
            </div>
            <div className="space-y-2">
              {(fuQ.data ?? []).map((f: any) => (
                <div key={f.id} className={"flex items-center gap-2 text-sm " + (f.completed_at ? "opacity-50 line-through" : "")}>
                  {!f.completed_at && (
                    <button onClick={() => completeFu.mutate({ id: f.id, contact_id: c.id })} className="p-0.5 border border-line rounded hover:bg-sage hover:text-white">
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <span className="text-ink-muted text-xs">{f.due_date}</span>
                  <span className="text-ink">{f.description}</span>
                </div>
              ))}
              {(fuQ.data ?? []).length === 0 && <div className="text-ink-muted text-sm">No follow-ups.</div>}
            </div>
          </div>

          <div className="mc-card p-5">
            <h2 className="serif text-xl text-ink mb-3">Activity</h2>
            <div className="space-y-2">
              {(actQ.data ?? []).map((a: any) => (
                <div key={a.id} className="text-[12px]">
                  <div className="text-ink">{a.description}</div>
                  <div className="text-ink-muted text-[11px]">{a.type} · {timeAgo(a.created_at)}</div>
                </div>
              ))}
              {(actQ.data ?? []).length === 0 && <div className="text-ink-muted text-sm">No activity yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Field({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{label}</div>
      {editing ? (
        <input
          autoFocus value={v} onChange={(e) => setV(e.target.value)}
          onBlur={() => { onSave(v); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-full px-2 py-1 border border-gold rounded text-sm mt-0.5"
        />
      ) : (
        <div onClick={() => setEditing(true)} className="text-ink cursor-pointer hover:bg-cream-deep rounded px-1 -mx-1">
          {value || <span className="text-ink-muted italic">—</span>}
        </div>
      )}
    </div>
  );
}
