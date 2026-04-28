import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/mc/PageShell";
import {
  useContact, useContactNotes, useContactActivity, useContactFollowUps,
  useAddContactNote, useAddFollowUp, useCompleteFollowUp, useUpdateContactStage,
  useUpdateContact, useCampaigns, PIPELINE_STAGES,
} from "@/lib/queries-v2";
import { fmtDate, fmtDateShort, timeAgo, initials } from "@/lib/format";
import { toast } from "sonner";
import { Check, Mail, Phone, Archive, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crm/$id")({
  head: () => ({ meta: [{ title: "Contact — Momentum" }] }),
  component: ContactDetail,
});

const SOURCES = ["Podcast", "LinkedIn", "Referral", "Inbound", "Outreach", "Event", "Other"];

function ContactDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  if (contactQ.isLoading) {
    return <PageShell><div className="text-ink-muted">Loading…</div></PageShell>;
  }
  if (!c) {
    return (
      <PageShell>
        <div className="text-ink-muted">
          Contact not found. <Link to="/crm" className="text-gold">Back to CRM</Link>
        </div>
      </PageShell>
    );
  }

  const handleArchive = async () => {
    if (!confirm(`Archive ${c.name}? They'll be removed from the pipeline.`)) return;
    const { error } = await supabase.from("contacts").update({ archived: true }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Contact archived");
    qc.invalidateQueries({ queryKey: ["contacts"] });
    navigate({ to: "/crm" });
  };

  const openFollowUps = (fuQ.data ?? []).filter((f: any) => !f.completed_at);
  const doneFollowUps = (fuQ.data ?? []).filter((f: any) => f.completed_at);

  return (
    <PageShell>
      <div className="mb-4 flex items-center justify-between">
        <Link to="/crm" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-ink-muted hover:text-gold">
          <ArrowLeft className="h-3 w-3" /> CRM
        </Link>
        <button
          onClick={handleArchive}
          className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-burgundy"
        >
          <Archive className="h-3 w-3" /> Archive
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details + notes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="mc-card p-5">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-gold/15 text-gold flex items-center justify-center serif text-xl shrink-0">
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="serif text-3xl text-ink leading-tight">{c.name}</h1>
                {(c.company || c.role) && (
                  <div className="text-ink-soft mt-0.5">
                    {c.company}{c.role ? ` · ${c.role}` : ""}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={c.stage}
                    onChange={async (e) => {
                      try {
                        await updateStage.mutateAsync({ id: c.id, stage: e.target.value, previous: c.stage });
                        toast.success("Stage updated");
                      } catch (err: any) { toast.error(err.message); }
                    }}
                    className="px-2 py-1 border border-line rounded text-sm bg-paper"
                  >
                    {PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 px-2 py-1 border border-line rounded text-xs text-ink-soft hover:bg-cream-deep">
                      <Mail className="h-3 w-3" /> Email
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 px-2 py-1 border border-line rounded text-xs text-ink-soft hover:bg-cream-deep">
                      <Phone className="h-3 w-3" /> Call
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Company" value={c.company} onSave={(v) => updateContact.mutate({ id: c.id, company: v || null })} />
              <Field label="Role" value={c.role} onSave={(v) => updateContact.mutate({ id: c.id, role: v || null })} />
              <Field label="Email" value={c.email} onSave={(v) => updateContact.mutate({ id: c.id, email: v || null })} />
              <Field label="Phone" value={c.phone} onSave={(v) => updateContact.mutate({ id: c.id, phone: v || null })} />
              <SelectField
                label="Source"
                value={c.source}
                options={["", ...SOURCES]}
                onSave={(v) => updateContact.mutate({ id: c.id, source: v || null })}
              />
              <Field label="Owner" value={c.owner} onSave={(v) => updateContact.mutate({ id: c.id, owner: v || null })} />
            </div>

            <div className="mt-4 pt-3 border-t border-line-soft text-[11px] text-ink-muted flex flex-wrap gap-x-4 gap-y-1">
              <span>Created {fmtDate(c.created_at)}</span>
              {c.last_touch_at && <span>Last touch {timeAgo(c.last_touch_at)}</span>}
            </div>
          </div>

          <div className="mc-card p-5">
            <h2 className="serif text-xl text-ink mb-3">Notes</h2>
            <div className="flex flex-col gap-2 mb-4">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note… (Cmd+Enter to save)"
                rows={3}
                onKeyDown={async (e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && noteBody.trim()) {
                    await addNote.mutateAsync({ contact_id: c.id, body: noteBody.trim() });
                    setNoteBody(""); toast.success("Note added");
                  }
                }}
                className="w-full px-3 py-2 border border-line rounded text-sm bg-paper focus:outline-none focus:border-gold-soft"
              />
              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    if (!noteBody.trim()) return;
                    await addNote.mutateAsync({ contact_id: c.id, body: noteBody.trim() });
                    setNoteBody(""); toast.success("Note added");
                  }}
                  disabled={!noteBody.trim()}
                  className="px-4 py-1.5 bg-ink text-cream rounded text-sm disabled:opacity-40"
                >Add note</button>
              </div>
            </div>
            <div className="space-y-3">
              {(notesQ.data ?? []).map((n: any) => (
                <div key={n.id} className="border-l-2 border-gold pl-3 py-1">
                  <div className="text-sm text-ink whitespace-pre-wrap">{n.body}</div>
                  <div className="text-[11px] text-ink-muted mt-1">{timeAgo(n.created_at)}</div>
                </div>
              ))}
              {(notesQ.data ?? []).length === 0 && (
                <div className="text-ink-muted text-sm italic">No notes yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: follow-ups + activity */}
        <div className="space-y-4">
          <div className="mc-card p-5">
            <h2 className="serif text-xl text-ink mb-3">Follow-ups</h2>
            <div className="space-y-2 mb-3">
              <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} className="w-full px-3 py-2 border border-line rounded text-sm bg-paper" />
              <input value={fuDesc} onChange={(e) => setFuDesc(e.target.value)} placeholder="What's the action?" className="w-full px-3 py-2 border border-line rounded text-sm bg-paper" />
              <button
                onClick={async () => {
                  if (!fuDate || !fuDesc.trim()) return;
                  await addFu.mutateAsync({ contact_id: c.id, due_date: fuDate, description: fuDesc.trim() });
                  setFuDate(""); setFuDesc(""); toast.success("Follow-up added");
                }}
                disabled={!fuDate || !fuDesc.trim()}
                className="w-full px-3 py-2 bg-gold text-white rounded text-sm disabled:opacity-40"
              >Schedule</button>
            </div>
            {openFollowUps.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {openFollowUps.map((f: any) => {
                  const overdue = f.due_date <= new Date().toISOString().slice(0, 10);
                  return (
                    <div key={f.id} className="flex items-start gap-2 text-sm">
                      <button
                        onClick={() => completeFu.mutate({ id: f.id, contact_id: c.id })}
                        className="mt-0.5 p-0.5 border border-line rounded hover:bg-sage hover:text-white hover:border-sage"
                        title="Mark complete"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-ink">{f.description}</div>
                        <div className={cn("text-[11px]", overdue ? "text-burgundy font-medium" : "text-ink-muted")}>
                          {overdue ? "Due " : ""}{fmtDateShort(f.due_date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {doneFollowUps.length > 0 && (
              <details className="text-[12px] text-ink-muted">
                <summary className="cursor-pointer hover:text-ink">Completed ({doneFollowUps.length})</summary>
                <div className="mt-1.5 space-y-1">
                  {doneFollowUps.map((f: any) => (
                    <div key={f.id} className="line-through opacity-60">
                      {fmtDateShort(f.due_date)} · {f.description}
                    </div>
                  ))}
                </div>
              </details>
            )}
            {(fuQ.data ?? []).length === 0 && (
              <div className="text-ink-muted text-sm italic">No follow-ups.</div>
            )}
          </div>

          <div className="mc-card p-5">
            <h2 className="serif text-xl text-ink mb-3">Activity</h2>
            <div className="space-y-3">
              {(actQ.data ?? []).map((a: any) => (
                <div key={a.id} className="text-[12px] border-l border-line-soft pl-3">
                  <div className="text-ink">{a.description}</div>
                  <div className="text-ink-muted text-[10px] uppercase tracking-wider mt-0.5">
                    {a.type.replace(/_/g, " ")} · {timeAgo(a.created_at)}
                  </div>
                </div>
              ))}
              {(actQ.data ?? []).length === 0 && (
                <div className="text-ink-muted text-sm italic">No activity yet.</div>
              )}
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
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setV(value ?? ""); setEditing(false); }
          }}
          className="w-full px-2 py-1 border border-gold rounded text-sm mt-0.5 bg-paper"
        />
      ) : (
        <div onClick={() => { setV(value ?? ""); setEditing(true); }} className="text-ink cursor-pointer hover:bg-cream-deep rounded px-1 -mx-1 truncate">
          {value || <span className="text-ink-muted italic">— add —</span>}
        </div>
      )}
    </div>
  );
}

function SelectField({ label, value, options, onSave }: { label: string; value: string | null; options: string[]; onSave: (v: string) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{label}</div>
      <select
        value={value ?? ""}
        onChange={(e) => onSave(e.target.value)}
        className="w-full px-1 py-0.5 -mx-1 bg-transparent text-ink text-sm hover:bg-cream-deep rounded focus:outline-none focus:bg-cream-deep"
      >
        {options.map((o) => <option key={o} value={o}>{o || "— add —"}</option>)}
      </select>
    </div>
  );
}
