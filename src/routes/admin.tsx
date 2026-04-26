import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useLeadMagnets, useOffers, useCampaigns, useLeads } from "@/lib/queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Momentum Command Center" }] }),
  component: AdminPage,
});

const FORMS = [
  { key: "linkedin", label: "Log LinkedIn Post" },
  { key: "podcast", label: "Log Podcast Appearance" },
  { key: "snapshot", label: "Weekly Channel Snapshot" },
  { key: "lead", label: "Add Lead" },
  { key: "campaign", label: "New Campaign" },
  { key: "call", label: "New Discovery Call" },
  { key: "content", label: "New Content" },
  { key: "magnet", label: "New Lead Magnet" },
] as const;

type FormKey = (typeof FORMS)[number]["key"];

function AdminPage() {
  const [active, setActive] = useState<FormKey>("linkedin");
  return (
    <PageShell>
      <PageHeader
        title="Admin"
        subtitle="Data Entry · Internal Operations"
        breadcrumbs={[{ label: "Command Center", to: "/" }, { label: "Admin" }]}
      />
      <div className="grid grid-cols-[260px_1fr] gap-6">
        <MCCard className="p-3 h-fit">
          {FORMS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={cn(
                "w-full text-left rounded-lg px-4 py-3 text-[13px] transition-colors",
                active === f.key ? "bg-cream-deep text-ink font-medium" : "text-ink-soft hover:bg-cream-deep/60",
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="border-t border-line-soft my-2 mx-2" />
          <Link
            to="/admin/integrations"
            className="block w-full text-left rounded-lg px-4 py-3 text-[13px] text-ink-soft hover:bg-cream-deep/60 transition-colors"
          >
            <span className="flex items-center justify-between">
              <span>Integrations</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-gold">YouTube</span>
            </span>
          </Link>
        </MCCard>
        <div>{renderForm(active)}</div>
      </div>
    </PageShell>
  );
}

function renderForm(key: FormKey) {
  switch (key) {
    case "linkedin": return <LinkedInForm />;
    case "podcast": return <PodcastForm />;
    case "snapshot": return <SnapshotForm />;
    case "lead": return <LeadForm />;
    case "campaign": return <CampaignForm />;
    case "call": return <CallForm />;
    case "content": return <ContentForm />;
    case "magnet": return <MagnetForm />;
  }
}

// ---------- shared form pieces ----------
function FormCard({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit: (e: React.FormEvent) => Promise<unknown> | unknown }) {
  const [busy, setBusy] = useState(false);
  return (
    <MCCard className="p-8">
      <h2 className="serif text-[26px] text-ink mb-6">{title}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try { await onSubmit(e); } finally { setBusy(false); }
        }}
        className="space-y-5"
      >
        {children}
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={busy} className="rounded-lg bg-gold px-6 py-2.5 text-[13px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </MCCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-eyebrow block mb-2">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-cream px-3 py-2.5 text-[13px] text-ink focus:outline-none focus:border-gold-soft focus:ring-2 focus:ring-gold-soft/30 transition";

function useReset<T extends Record<string, any>>(initial: T): [T, (k: keyof T, v: any) => void, () => void] {
  const [state, setState] = useState<T>(initial);
  return [state, (k, v) => setState((s) => ({ ...s, [k]: v })), () => setState(initial)];
}

function useInvalidate(keys: string[]) {
  const qc = useQueryClient();
  return () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

// ---------- forms ----------
function LinkedInForm() {
  const initial = { date: new Date().toISOString().slice(0, 10), format: "Image", topic: "", reach: 0, engagement: 0, profile_views: 0, followers_gained: 0, key_word: "CONNECTION", link: "" };
  const [s, set, reset] = useReset(initial);
  const inv = useInvalidate(["content"]);
  return (
    <FormCard title="Log LinkedIn Post" onSubmit={async () => {
      const { error } = await supabase.from("content").insert({
        title: s.topic || "(untitled LinkedIn post)",
        channel: "LinkedIn", format: s.format, publish_date: s.date,
        topic: s.topic, reach: Number(s.reach), engagement: Number(s.engagement),
        profile_views: Number(s.profile_views), followers_gained: Number(s.followers_gained),
        key_word: s.key_word, link: s.link || null,
      });
      if (error) return toast.error(error.message);
      toast.success("LinkedIn post logged."); inv(); reset();
    }}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date"><input type="date" className={inputCls} value={s.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Format">
          <select className={inputCls} value={s.format} onChange={(e) => set("format", e.target.value)}>
            {["Image", "Video", "Carousel", "Reel", "Newsletter"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Topic"><textarea className={inputCls + " min-h-[80px]"} value={s.topic} onChange={(e) => set("topic", e.target.value)} /></Field>
      <div className="grid grid-cols-4 gap-4">
        <Field label="Impressions (Reach)"><input type="number" className={inputCls} value={s.reach} onChange={(e) => set("reach", e.target.value)} /></Field>
        <Field label="Reactions"><input type="number" className={inputCls} value={s.engagement} onChange={(e) => set("engagement", e.target.value)} /></Field>
        <Field label="Profile Views"><input type="number" className={inputCls} value={s.profile_views} onChange={(e) => set("profile_views", e.target.value)} /></Field>
        <Field label="Followers Gained"><input type="number" className={inputCls} value={s.followers_gained} onChange={(e) => set("followers_gained", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Key Word">
          <select className={inputCls} value={s.key_word} onChange={(e) => set("key_word", e.target.value)}>
            {["DIAGNOSE", "CHAMPION", "FREEDOM", "LEGACY", "IDENTITY", "CAPACITY", "CONNECTION", "KINGDOM", "OTHER"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Link"><input className={inputCls} value={s.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" /></Field>
      </div>
    </FormCard>
  );
}

function PodcastForm() {
  const initial = { date: "", show: "", episode: "", format: "Podcast Guest", listens: 0, notes: "", link: "" };
  const [s, set, reset] = useReset(initial);
  const inv = useInvalidate(["content"]);
  return (
    <FormCard title="Log Podcast Appearance" onSubmit={async () => {
      const { error } = await supabase.from("content").insert({
        title: `${s.show} — ${s.episode}`, channel: "Podcast", format: s.format,
        publish_date: s.date || null, reach: Number(s.listens), notes: s.notes, link: s.link || null,
      });
      if (error) return toast.error(error.message);
      toast.success("Podcast logged."); inv(); reset();
    }}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Air Date"><input type="date" className={inputCls} value={s.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Format">
          <select className={inputCls} value={s.format} onChange={(e) => set("format", e.target.value)}>
            <option>Podcast Episode</option><option>Podcast Guest</option>
          </select>
        </Field>
      </div>
      <Field label="Show Name"><input className={inputCls} value={s.show} onChange={(e) => set("show", e.target.value)} /></Field>
      <Field label="Episode Title"><input className={inputCls} value={s.episode} onChange={(e) => set("episode", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Estimated Listens"><input type="number" className={inputCls} value={s.listens} onChange={(e) => set("listens", e.target.value)} /></Field>
        <Field label="Link"><input className={inputCls} value={s.link} onChange={(e) => set("link", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className={inputCls + " min-h-[80px]"} value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </FormCard>
  );
}

function SnapshotForm() {
  const initial = { snapshot_date: new Date().toISOString().slice(0, 10), channel: "YouTube", followers_subs: 0, reach_28d: 0, watch_time_hrs: 0, avg_watch_time: "", ctr: 0, open_rate: 0, posts_episodes_released: 0, notes: "" };
  const [s, set, reset] = useReset(initial);
  const inv = useInvalidate(["channel_metrics"]);
  return (
    <FormCard title="Weekly Channel Snapshot" onSubmit={async () => {
      const { data: prev } = await supabase.from("channel_metrics").select("followers_subs").eq("channel", s.channel).order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
      const net_change = prev ? Number(s.followers_subs) - Number(prev.followers_subs ?? 0) : null;
      const payload: any = {
        channel: s.channel, snapshot_date: s.snapshot_date,
        followers_subs: Number(s.followers_subs), reach_28d: Number(s.reach_28d),
        posts_episodes_released: Number(s.posts_episodes_released), notes: s.notes, net_change,
      };
      if (s.channel === "YouTube") {
        payload.watch_time_hrs = Number(s.watch_time_hrs); payload.avg_watch_time = s.avg_watch_time; payload.ctr = Number(s.ctr);
      }
      if (s.channel === "Email/Kajabi") payload.open_rate = Number(s.open_rate);
      const { error } = await supabase.from("channel_metrics").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Snapshot saved."); inv(); reset();
    }}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Snapshot Date"><input type="date" className={inputCls} value={s.snapshot_date} onChange={(e) => set("snapshot_date", e.target.value)} /></Field>
        <Field label="Channel">
          <select className={inputCls} value={s.channel} onChange={(e) => set("channel", e.target.value)}>
            {["YouTube", "LinkedIn", "Instagram", "Podcast", "Email/Kajabi", "Facebook", "Twitter/X"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Followers / Subs"><input type="number" className={inputCls} value={s.followers_subs} onChange={(e) => set("followers_subs", e.target.value)} /></Field>
        <Field label="Reach 28d"><input type="number" className={inputCls} value={s.reach_28d} onChange={(e) => set("reach_28d", e.target.value)} /></Field>
        <Field label="Posts/Episodes"><input type="number" className={inputCls} value={s.posts_episodes_released} onChange={(e) => set("posts_episodes_released", e.target.value)} /></Field>
      </div>
      {s.channel === "YouTube" && (
        <div className="grid grid-cols-3 gap-4">
          <Field label="Watch Time (hrs)"><input type="number" step="0.1" className={inputCls} value={s.watch_time_hrs} onChange={(e) => set("watch_time_hrs", e.target.value)} /></Field>
          <Field label="Avg Watch Time"><input className={inputCls} placeholder="5:08" value={s.avg_watch_time} onChange={(e) => set("avg_watch_time", e.target.value)} /></Field>
          <Field label="CTR (%)"><input type="number" step="0.1" className={inputCls} value={s.ctr} onChange={(e) => set("ctr", e.target.value)} /></Field>
        </div>
      )}
      {s.channel === "Email/Kajabi" && (
        <Field label="Open Rate (%)"><input type="number" step="0.1" className={inputCls} value={s.open_rate} onChange={(e) => set("open_rate", e.target.value)} /></Field>
      )}
      <Field label="Notes"><textarea className={inputCls + " min-h-[60px]"} value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </FormCard>
  );
}

function LeadForm() {
  const initial = { name: "", email: "", phone: "", first_touch_date: new Date().toISOString().slice(0, 10), lead_source: "YouTube", opt_in: "CCS", how_did_you_hear: "", gender: "Unknown", notes: "", lead_magnet_id: "", campaign_id: "" };
  const [s, set, reset] = useReset(initial);
  const inv = useInvalidate(["leads"]);
  const { data: magnets = [] } = useLeadMagnets();
  const { data: campaigns = [] } = useCampaigns();
  return (
    <FormCard title="Add Lead" onSubmit={async () => {
      const { error } = await supabase.from("leads").insert({
        name: s.name, email: s.email || null, phone: s.phone || null, first_touch_date: s.first_touch_date,
        lead_source: s.lead_source, opt_in: s.opt_in, how_did_you_hear: s.how_did_you_hear,
        gender: s.gender, notes: s.notes,
        lead_magnet_id: s.lead_magnet_id || null, campaign_id: s.campaign_id || null,
      });
      if (error) return toast.error(error.message);
      toast.success("Lead added."); inv(); reset();
    }}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name"><input required className={inputCls} value={s.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Email"><input type="email" className={inputCls} value={s.email} onChange={(e) => set("email", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone"><input className={inputCls} value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="First Touch Date"><input type="date" className={inputCls} value={s.first_touch_date} onChange={(e) => set("first_touch_date", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lead Source">
          <select className={inputCls} value={s.lead_source} onChange={(e) => set("lead_source", e.target.value)}>
            {["YouTube", "Facebook Ad", "LinkedIn", "Instagram", "Podcast", "Outreach", "Client Referral", "Direct/Other"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Opt-In">
          <select className={inputCls} value={s.opt_in} onChange={(e) => set("opt_in", e.target.value)}>
            {["CCS", "Daily Brief", "Applications", "Drop the Armor Free Bonus", "High Performance SS", "Newsletter", "Other"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lead Magnet">
          <select className={inputCls} value={s.lead_magnet_id} onChange={(e) => set("lead_magnet_id", e.target.value)}>
            <option value="">—</option>{magnets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Campaign">
          <select className={inputCls} value={s.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}>
            <option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="How Did You Hear"><input className={inputCls} value={s.how_did_you_hear} onChange={(e) => set("how_did_you_hear", e.target.value)} /></Field>
      <Field label="Notes"><textarea className={inputCls + " min-h-[60px]"} value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </FormCard>
  );
}

function CampaignForm() {
  const initial = { name: "", status: "Planning", type: "Launch", primary_channel: "Multi-Channel", start_date: "", end_date: "", goal: "", lead_goal: 0, booking_goal: 0, enrollment_goal: 0, budget: 0, lead_magnet_id: "", offer_id: "", notes: "" };
  const [s, set, reset] = useReset(initial);
  const inv = useInvalidate(["campaigns"]);
  const { data: magnets = [] } = useLeadMagnets();
  const { data: offers = [] } = useOffers();
  return (
    <FormCard title="New Campaign" onSubmit={async () => {
      const { error } = await supabase.from("campaigns").insert({
        name: s.name, status: s.status, type: s.type, primary_channel: s.primary_channel,
        start_date: s.start_date || null, end_date: s.end_date || null, goal: s.goal,
        lead_goal: Number(s.lead_goal) || null, booking_goal: Number(s.booking_goal) || null,
        enrollment_goal: Number(s.enrollment_goal) || null, budget: Number(s.budget) || null,
        lead_magnet_id: s.lead_magnet_id || null, offer_id: s.offer_id || null, notes: s.notes,
      });
      if (error) return toast.error(error.message);
      toast.success("Campaign created."); inv(); reset();
    }}>
      <Field label="Name"><input required className={inputCls} value={s.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Status"><select className={inputCls} value={s.status} onChange={(e) => set("status", e.target.value)}>{["Planning", "Live", "Warming", "Paused", "Completed"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Type"><select className={inputCls} value={s.type} onChange={(e) => set("type", e.target.value)}>{["Launch", "Promo", "Tour", "Evergreen", "Test", "Outreach", "Other"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Primary Channel"><select className={inputCls} value={s.primary_channel} onChange={(e) => set("primary_channel", e.target.value)}>{["YouTube", "LinkedIn", "Email", "Meta Ads", "Podcast", "Multi-Channel", "Other"].map((o) => <option key={o}>{o}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date"><input type="date" className={inputCls} value={s.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="End Date"><input type="date" className={inputCls} value={s.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
      </div>
      <Field label="Goal"><textarea className={inputCls + " min-h-[60px]"} value={s.goal} onChange={(e) => set("goal", e.target.value)} /></Field>
      <div className="grid grid-cols-4 gap-4">
        <Field label="Lead Goal"><input type="number" className={inputCls} value={s.lead_goal} onChange={(e) => set("lead_goal", e.target.value)} /></Field>
        <Field label="Booking Goal"><input type="number" className={inputCls} value={s.booking_goal} onChange={(e) => set("booking_goal", e.target.value)} /></Field>
        <Field label="Enrollment Goal"><input type="number" className={inputCls} value={s.enrollment_goal} onChange={(e) => set("enrollment_goal", e.target.value)} /></Field>
        <Field label="Budget"><input type="number" className={inputCls} value={s.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lead Magnet"><select className={inputCls} value={s.lead_magnet_id} onChange={(e) => set("lead_magnet_id", e.target.value)}><option value="">—</option>{magnets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Offer"><select className={inputCls} value={s.offer_id} onChange={(e) => set("offer_id", e.target.value)}><option value="">—</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
      </div>
      <Field label="Notes"><textarea className={inputCls + " min-h-[60px]"} value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </FormCard>
  );
}

function CallForm() {
  const initial = { lead_id: "", name: "", call_date: new Date().toISOString().slice(0, 10), fu_date: "", call_type: "Discovery Call", fit_rating: 0, status: "Pending", lead_source: "YouTube", location: "", role_position: "", offer_id: "", notes: "" };
  const [s, set, reset] = useReset(initial);
  const inv = useInvalidate(["discovery_calls"]);
  const { data: leads = [] } = useLeads();
  const { data: offers = [] } = useOffers();
  return (
    <FormCard title="New Discovery Call" onSubmit={async () => {
      const { error } = await supabase.from("discovery_calls").insert({
        lead_id: s.lead_id || null, name: s.name || (leads.find((l) => l.id === s.lead_id)?.name ?? "Unknown"),
        call_date: s.call_date, fu_date: s.fu_date || null, call_type: s.call_type,
        fit_rating: Number(s.fit_rating) || null, status: s.status, lead_source: s.lead_source,
        location: s.location, role_position: s.role_position, offer_id: s.offer_id || null, notes: s.notes,
      });
      if (error) return toast.error(error.message);
      toast.success("Call logged."); inv(); reset();
    }}>
      <Field label="Lead">
        <select className={inputCls} value={s.lead_id} onChange={(e) => { set("lead_id", e.target.value); const l = leads.find((x) => x.id === e.target.value); if (l) set("name", l.name); }}>
          <option value="">— search leads —</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Name (override)"><input className={inputCls} value={s.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Call Date"><input type="date" className={inputCls} value={s.call_date} onChange={(e) => set("call_date", e.target.value)} /></Field>
        <Field label="Follow-up Date"><input type="date" className={inputCls} value={s.fu_date} onChange={(e) => set("fu_date", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Call Type"><select className={inputCls} value={s.call_type} onChange={(e) => set("call_type", e.target.value)}>{["Discovery Call", "Pre Qual", "Reconnection Call"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Status"><select className={inputCls} value={s.status} onChange={(e) => set("status", e.target.value)}>{["Pending", "Won", "Lost", "Not a Fit"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Fit Rating"><input type="number" min="0" max="10" className={inputCls} value={s.fit_rating} onChange={(e) => set("fit_rating", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lead Source"><select className={inputCls} value={s.lead_source} onChange={(e) => set("lead_source", e.target.value)}>{["YouTube", "Facebook Ad", "LinkedIn", "Instagram", "Podcast", "Outreach", "Client Referral", "Direct/Other"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Offer"><select className={inputCls} value={s.offer_id} onChange={(e) => set("offer_id", e.target.value)}><option value="">—</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Location"><input className={inputCls} value={s.location} onChange={(e) => set("location", e.target.value)} /></Field>
        <Field label="Role / Position"><input className={inputCls} value={s.role_position} onChange={(e) => set("role_position", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className={inputCls + " min-h-[80px]"} value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </FormCard>
  );
}

function ContentForm() {
  const initial = { title: "", channel: "YouTube", format: "Long-form Video", publish_date: "", topic: "", key_word: "CONNECTION", reach: 0, engagement: 0, leads_attributed: 0, effect_rating: "Untracked", link: "", campaign_id: "", notes: "" };
  const [s, set, reset] = useReset(initial);
  const inv = useInvalidate(["content"]);
  const { data: campaigns = [] } = useCampaigns();
  return (
    <FormCard title="New Content" onSubmit={async () => {
      const { error } = await supabase.from("content").insert({
        title: s.title, channel: s.channel, format: s.format, publish_date: s.publish_date || null,
        topic: s.topic, key_word: s.key_word, reach: Number(s.reach), engagement: Number(s.engagement),
        leads_attributed: Number(s.leads_attributed), effect_rating: s.effect_rating, link: s.link || null,
        campaign_id: s.campaign_id || null, notes: s.notes,
      });
      if (error) return toast.error(error.message);
      toast.success("Content added."); inv(); reset();
    }}>
      <Field label="Title"><input required className={inputCls} value={s.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Channel"><select className={inputCls} value={s.channel} onChange={(e) => set("channel", e.target.value)}>{["YouTube", "YouTube Short", "LinkedIn", "Instagram", "Podcast", "Newsletter", "Blog", "Other"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Format"><select className={inputCls} value={s.format} onChange={(e) => set("format", e.target.value)}>{["Long-form Video", "Short", "Image", "Carousel", "Video", "Reel", "Newsletter", "Article", "Podcast Episode", "Podcast Guest"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Publish Date"><input type="date" className={inputCls} value={s.publish_date} onChange={(e) => set("publish_date", e.target.value)} /></Field>
      </div>
      <Field label="Topic"><input className={inputCls} value={s.topic} onChange={(e) => set("topic", e.target.value)} /></Field>
      <div className="grid grid-cols-4 gap-4">
        <Field label="Reach"><input type="number" className={inputCls} value={s.reach} onChange={(e) => set("reach", e.target.value)} /></Field>
        <Field label="Engagement"><input type="number" className={inputCls} value={s.engagement} onChange={(e) => set("engagement", e.target.value)} /></Field>
        <Field label="Leads"><input type="number" className={inputCls} value={s.leads_attributed} onChange={(e) => set("leads_attributed", e.target.value)} /></Field>
        <Field label="Effect"><select className={inputCls} value={s.effect_rating} onChange={(e) => set("effect_rating", e.target.value)}>{["High", "Medium", "Low", "Untracked"].map((o) => <option key={o}>{o}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Key Word"><select className={inputCls} value={s.key_word} onChange={(e) => set("key_word", e.target.value)}>{["DIAGNOSE", "CHAMPION", "FREEDOM", "LEGACY", "IDENTITY", "CAPACITY", "CONNECTION", "KINGDOM", "OTHER"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Campaign"><select className={inputCls} value={s.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Link"><input className={inputCls} value={s.link} onChange={(e) => set("link", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className={inputCls + " min-h-[60px]"} value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </FormCard>
  );
}

function MagnetForm() {
  const initial = { name: "", type: "CCS", status: "Active", hosted_on: "Kajabi", url: "", description: "", sequence_days: 0, notes: "" };
  const [s, set, reset] = useReset(initial);
  const inv = useInvalidate(["lead_magnets"]);
  return (
    <FormCard title="New Lead Magnet" onSubmit={async () => {
      const { error } = await supabase.from("lead_magnets").insert({
        name: s.name, type: s.type, status: s.status, hosted_on: s.hosted_on,
        url: s.url || null, description: s.description, sequence_days: Number(s.sequence_days) || null, notes: s.notes,
      });
      if (error) return toast.error(error.message);
      toast.success("Lead magnet added."); inv(); reset();
    }}>
      <Field label="Name"><input required className={inputCls} value={s.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Type"><select className={inputCls} value={s.type} onChange={(e) => set("type", e.target.value)}>{["CCS", "Daily Brief", "Application", "Bonus", "Strategy Session", "Newsletter", "Other"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Status"><select className={inputCls} value={s.status} onChange={(e) => set("status", e.target.value)}>{["Active", "Paused", "Retired"].map((o) => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Hosted On"><select className={inputCls} value={s.hosted_on} onChange={(e) => set("hosted_on", e.target.value)}>{["Kajabi", "ConvertKit", "External"].map((o) => <option key={o}>{o}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="URL"><input className={inputCls} value={s.url} onChange={(e) => set("url", e.target.value)} /></Field>
        <Field label="Sequence Days"><input type="number" className={inputCls} value={s.sequence_days} onChange={(e) => set("sequence_days", e.target.value)} /></Field>
      </div>
      <Field label="Description"><textarea className={inputCls + " min-h-[60px]"} value={s.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <Field label="Notes"><textarea className={inputCls + " min-h-[60px]"} value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </FormCard>
  );
}
