import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NotionCard } from "@/components/mc/NotionCard";

const KAJABI_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kajabi-webhook`;

export const Route = createFileRoute("/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Momentum Command Center" }] }),
  component: IntegrationsPage,
});

type SyncTarget = "christine" | "intentional_ag" | "both";

function IntegrationsPage() {
  const [busy, setBusy] = useState<SyncTarget | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const qc = useQueryClient();

  async function runSync(target: SyncTarget, label: string) {
    setBusy(target);
    try {
      const path = target === "both" ? "youtube-sync" : `youtube-sync?channel=${target}`;
      const { data, error } = await supabase.functions.invoke(path, { method: "POST" });
      if (error) throw error;
      setLastResult(data);
      const totalVideos = data?.videos_upserted ?? 0;
      const channels = data?.channels?.length ?? 0;
      if (data?.errors?.length) {
        toast.error(`${label}: completed with ${data.errors.length} error(s)`);
      } else {
        toast.success(`${label} synced — ${totalVideos} videos across ${channels} channel(s)`);
      }
      qc.invalidateQueries({ queryKey: ["content"] });
      qc.invalidateQueries({ queryKey: ["channel_metrics"] });
      qc.invalidateQueries({ queryKey: ["youtube_channels"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
      setLastResult({ ok: false, error: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Integrations"
        subtitle="External Data · YouTube · Channel Sync"
        breadcrumbs={[
          { label: "Command Center", to: "/" },
          { label: "Admin", to: "/admin" },
          { label: "Integrations" },
        ]}
      />

      <MCCard className="p-5 sm:p-7 lg:p-8 mb-6">
        <div className="flex items-start justify-between mb-5 sm:mb-6">
          <div>
            <h2 className="serif text-[22px] sm:text-[26px] text-ink">YouTube Data Sync</h2>
            <p className="text-[12px] sm:text-[13px] text-ink-soft mt-1">
              Pull subscriber counts, 28-day reach, and the most recent 50 videos from each channel.
              Auto-runs daily at 6:30 AM UTC.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <SyncButton
            label="Christine Jewell"
            sub="Personal channel"
            disabled={!!busy}
            loading={busy === "christine"}
            onClick={() => runSync("christine", "Christine Jewell")}
          />
          <SyncButton
            label="Intentional Ag Leader"
            sub="Brand channel"
            disabled={!!busy}
            loading={busy === "intentional_ag"}
            onClick={() => runSync("intentional_ag", "Intentional Ag Leader")}
          />
          <SyncButton
            label="Sync Both Channels"
            sub="Run full sync"
            primary
            disabled={!!busy}
            loading={busy === "both"}
            onClick={() => runSync("both", "Both channels")}
          />
        </div>
      </MCCard>

      <NotionCard />

      <KajabiCard />

      <KajabiApiSyncCard />

      <ZapierCard />

      {lastResult && (
        <MCCard className="p-6">
          <div className="label-eyebrow mb-3">Last Sync Result</div>
          {lastResult.channels?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {lastResult.channels.map((c: any) => (
                <div key={c.channel} className="rounded-lg bg-cream border border-line-soft p-4">
                  <div className="text-[14px] font-medium text-ink">{c.channel}</div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
                    <Stat label="Subscribers" value={c.subscribers?.toLocaleString() ?? "—"} />
                    <Stat label="Videos Synced" value={c.videos_upserted ?? 0} />
                    <Stat label="28d Views" value={(c.reach_28d ?? 0).toLocaleString()} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {lastResult.errors?.length > 0 && (
            <div className="rounded-lg bg-burgundy/10 border border-burgundy/30 p-4 mb-3">
              <div className="text-[12px] font-medium text-burgundy mb-2">Errors</div>
              {lastResult.errors.map((e: any, i: number) => (
                <div key={i} className="text-[12px] text-ink">
                  <span className="font-medium">{e.channel}:</span> {e.error}
                </div>
              ))}
            </div>
          )}
          <pre className="text-[11px] text-ink-muted bg-cream-deep rounded-lg p-3 overflow-auto max-h-[200px]">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </MCCard>
      )}
    </PageShell>
  );
}

function SyncButton({
  label, sub, onClick, loading, disabled, primary,
}: { label: string; sub: string; onClick: () => void; loading: boolean; disabled: boolean; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl border p-5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        primary
          ? "bg-gold border-gold text-white hover:bg-gold/90"
          : "bg-cream border-line text-ink hover:border-gold-soft hover:bg-cream-deep",
      )}
    >
      <div className={cn("text-[14px] font-medium", primary ? "text-white" : "text-ink")}>
        {loading ? "Syncing…" : label}
      </div>
      <div className={cn("text-[11px] mt-1", primary ? "text-white/80" : "text-ink-muted")}>
        {sub}
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="label-eyebrow text-[9px]">{label}</div>
      <div className="num-serif text-[20px] text-ink leading-none mt-1">{value}</div>
    </div>
  );
}

// ============================================================
// Kajabi (webhook-only)
// ============================================================
function KajabiCard() {
  const [copied, setCopied] = useState(false);

  const events = useQuery({
    queryKey: ["kajabi_webhook_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kajabi_webhook_events")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000, // poll every 10s so live events appear
  });

  const counts = useQuery({
    queryKey: ["kajabi_counts"],
    queryFn: async () => {
      const [{ count: leadsCount }, { count: purchasesCount }, { count: formsCount }] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("lead_source", "Kajabi"),
        supabase.from("kajabi_purchases").select("id", { count: "exact", head: true }),
        supabase.from("kajabi_form_submissions").select("id", { count: "exact", head: true }),
      ]);
      return { leadsCount: leadsCount ?? 0, purchasesCount: purchasesCount ?? 0, formsCount: formsCount ?? 0 };
    },
    refetchInterval: 15000,
  });

  async function copyUrl() {
    await navigator.clipboard.writeText(KAJABI_WEBHOOK_URL);
    setCopied(true);
    toast.success("Webhook URL copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <MCCard className="p-5 sm:p-7 lg:p-8 mb-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="serif text-[26px] text-ink">Kajabi (Live Webhooks)</h2>
          <p className="text-[13px] text-ink-soft mt-1">
            Listens for new contacts, purchases, refunds, and form submissions. No backfill — events stream in live as they happen in Kajabi.
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-cream border border-line-soft p-4 mb-5">
        <div className="label-eyebrow mb-2">Webhook URL — paste this into Kajabi → Settings → Webhooks</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[12px] text-ink bg-cream-deep rounded px-3 py-2 font-mono break-all">
            {KAJABI_WEBHOOK_URL}
          </code>
          <button
            onClick={copyUrl}
            className="rounded-lg bg-gold px-4 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors whitespace-nowrap"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="text-[11px] text-ink-muted mt-2">
          Use the same signing secret you saved as <code className="bg-cream-deep px-1.5 py-0.5 rounded">KAJABI_WEBHOOK_SECRET</code>.
          Subscribe to: <code>contact.created</code>, <code>purchase.created</code>, <code>purchase.refunded</code>, <code>form_submission.created</code>.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <Stat label="Kajabi Leads" value={counts.data?.leadsCount.toLocaleString() ?? "—"} />
        <Stat label="Purchases Logged" value={counts.data?.purchasesCount.toLocaleString() ?? "—"} />
        <Stat label="Form Submissions" value={counts.data?.formsCount.toLocaleString() ?? "—"} />
      </div>

      <div className="border-t border-line-soft pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="label-eyebrow">Recent webhook activity</div>
          <div className="text-[10px] text-ink-muted">Auto-refreshing every 10s</div>
        </div>
        {!events.data?.length ? (
          <div className="text-[12px] text-ink-muted py-6 text-center bg-cream-deep rounded-lg">
            No webhook events yet. Once you wire the webhook in Kajabi and trigger a test, events will appear here.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[280px] overflow-auto">
            {events.data.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 text-[12px] py-2 px-3 rounded-lg bg-cream border border-line-soft">
                <span className={cn(
                  "inline-block w-2 h-2 rounded-full shrink-0",
                  !e.signature_valid ? "bg-burgundy"
                    : e.error ? "bg-amber-500"
                    : e.processed ? "bg-green-600"
                    : "bg-ink-muted",
                )} />
                <span className="font-mono text-ink min-w-[180px]">{e.event_type}</span>
                <span className="text-ink-muted text-[11px] flex-1">
                  {new Date(e.received_at).toLocaleString()}
                </span>
                {!e.signature_valid && <span className="text-burgundy text-[11px] font-medium">invalid signature</span>}
                {e.error && <span className="text-amber-700 text-[11px] truncate max-w-[200px]" title={e.error}>{e.error}</span>}
                {e.signature_valid && e.processed && !e.error && <span className="text-green-700 text-[11px]">processed</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </MCCard>
  );
}

// ============================================================
// Zapier (for Kajabi form submissions — Kajabi plan limitation workaround)
// ============================================================
function ZapierCard() {
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [secret, setSecret] = useState("");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const zapierUrl = secret
    ? `${baseUrl}/api/public/zapier-lead?secret=${encodeURIComponent(secret)}`
    : `${baseUrl}/api/public/zapier-lead?secret=YOUR_SECRET_HERE`;

  const recentLeads = useQuery({
    queryKey: ["zapier_recent_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, lead_source, how_did_you_hear, created_at")
        .ilike("lead_source", "%Zapier%")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  async function copyUrl() {
    if (!secret) {
      toast.error("Paste your secret first to generate the full URL");
      return;
    }
    await navigator.clipboard.writeText(zapierUrl);
    setCopied(true);
    toast.success("Zapier URL copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <MCCard className="p-5 sm:p-7 lg:p-8 mb-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="serif text-[26px] text-ink">Zapier (Form Submissions)</h2>
          <p className="text-[13px] text-ink-soft mt-1">
            Captures lead-magnet opt-ins from Kajabi forms via Zapier (since Kajabi's plan only exposes purchase webhooks).
            Each Zap fires this URL with form data → new lead row created.
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-cream border border-line-soft p-4 mb-5">
        <div className="label-eyebrow mb-2">1. Paste your secret to generate the full URL</div>
        <div className="flex items-center gap-2 mb-3">
          <input
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value.trim())}
            placeholder="Paste ZAPIER_LEAD_WEBHOOK_SECRET value"
            className="flex-1 text-[12px] bg-cream-deep rounded px-3 py-2 font-mono border border-line-soft focus:border-gold outline-none"
          />
          <button
            onClick={() => setShowSecret((v) => !v)}
            className="rounded-lg bg-cream-deep border border-line-soft px-3 py-2 text-[11px] text-ink-soft hover:text-ink"
          >
            {showSecret ? "Hide" : "Show"}
          </button>
        </div>

        <div className="label-eyebrow mb-2">2. Webhook URL — paste into Zapier "Webhooks by Zapier" POST action</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[12px] text-ink bg-cream-deep rounded px-3 py-2 font-mono break-all">
            {zapierUrl}
          </code>
          <button
            onClick={copyUrl}
            className="rounded-lg bg-gold px-4 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors whitespace-nowrap"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="text-[11px] text-ink-muted mt-3 leading-relaxed">
          <strong className="text-ink-soft">Zap setup:</strong> Trigger = Kajabi "New Form Submission" →
          Action = Webhooks by Zapier "POST". Set <code className="bg-cream-deep px-1 py-0.5 rounded">Payload Type: JSON</code> and
          map these fields: <code className="bg-cream-deep px-1 py-0.5 rounded">email</code>,{" "}
          <code className="bg-cream-deep px-1 py-0.5 rounded">first_name</code>,{" "}
          <code className="bg-cream-deep px-1 py-0.5 rounded">last_name</code>,{" "}
          <code className="bg-cream-deep px-1 py-0.5 rounded">phone</code>,{" "}
          <code className="bg-cream-deep px-1 py-0.5 rounded">form_name</code>,{" "}
          <code className="bg-cream-deep px-1 py-0.5 rounded">source</code>.
        </div>
      </div>

      <div className="border-t border-line-soft pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="label-eyebrow">Recent leads from Zapier</div>
          <div className="text-[10px] text-ink-muted">Auto-refreshing every 10s</div>
        </div>
        {!recentLeads.data?.length ? (
          <div className="text-[12px] text-ink-muted py-6 text-center bg-cream-deep rounded-lg">
            No Zapier leads yet. Send a test from Zapier and they'll appear here.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[280px] overflow-auto">
            {recentLeads.data.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 text-[12px] py-2 px-3 rounded-lg bg-cream border border-line-soft">
                <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-green-600" />
                <span className="font-medium text-ink min-w-[140px] truncate">{l.name}</span>
                <span className="text-ink-soft min-w-[200px] truncate">{l.email}</span>
                {l.how_did_you_hear && <span className="text-ink-muted text-[11px] truncate flex-1">{l.how_did_you_hear}</span>}
                <span className="text-ink-muted text-[11px] whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </MCCard>
  );
}

// ============================================================
// Kajabi Direct API Sync (backfill + on-demand pull)
// ============================================================
type KajabiResource = "contacts" | "purchases" | "form_submissions" | "all";

function KajabiApiSyncCard() {
  const [busy, setBusy] = useState<KajabiResource | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  async function runSync(resource: KajabiResource, label: string) {
    setBusy(resource);
    setLastResult(null);
    try {
      const res = await fetch(`/api/public/kajabi-sync?resource=${resource}`, { method: "POST" });
      const data = await res.json();
      setLastResult(data);
      if (!res.ok || data.errors?.length) {
        toast.error(`${label}: completed with ${data.errors?.length ?? 1} error(s)`);
      } else {
        const total = (data.results ?? []).reduce((s: number, r: any) => s + (r.synced ?? 0), 0);
        toast.success(`${label} synced — ${total} record(s) processed`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
      setLastResult({ ok: false, error: String(e?.message ?? e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <MCCard className="p-5 sm:p-7 lg:p-8 mb-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="serif text-[26px] text-ink">Kajabi Direct API Sync</h2>
          <p className="text-[13px] text-ink-soft mt-1">
            Pulls historical contacts, purchases, and form submissions directly from Kajabi's API
            (no webhook setup needed). Use this for the initial backfill, then let live webhooks handle ongoing events.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <SyncButton
          label="Contacts"
          sub="All contacts → leads"
          disabled={!!busy}
          loading={busy === "contacts"}
          onClick={() => runSync("contacts", "Contacts")}
        />
        <SyncButton
          label="Purchases"
          sub="Order history"
          disabled={!!busy}
          loading={busy === "purchases"}
          onClick={() => runSync("purchases", "Purchases")}
        />
        <SyncButton
          label="Form Submissions"
          sub="Lead-magnet opt-ins"
          disabled={!!busy}
          loading={busy === "form_submissions"}
          onClick={() => runSync("form_submissions", "Form submissions")}
        />
        <SyncButton
          label="Sync Everything"
          sub="Full backfill"
          primary
          disabled={!!busy}
          loading={busy === "all"}
          onClick={() => runSync("all", "Full Kajabi backfill")}
        />
      </div>

      {lastResult && (
        <div className="border-t border-line-soft pt-4">
          <div className="label-eyebrow mb-3">Last Sync Result</div>
          {lastResult.results?.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
              {lastResult.results.map((r: any) => (
                <div key={r.resource} className="rounded-lg bg-cream border border-line-soft p-4">
                  <div className="text-[13px] font-medium text-ink capitalize">{r.resource.replace("_", " ")}</div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Stat label="Synced" value={r.synced ?? 0} />
                    {"created" in r && <Stat label="New" value={r.created ?? 0} />}
                    {r.errors > 0 && <Stat label="Errors" value={r.errors} />}
                  </div>
                </div>
              ))}
            </div>
          )}
          {lastResult.errors?.length > 0 && (
            <div className="rounded-lg bg-burgundy/10 border border-burgundy/30 p-4 mb-3">
              <div className="text-[12px] font-medium text-burgundy mb-2">Errors</div>
              {lastResult.errors.map((e: any, i: number) => (
                <div key={i} className="text-[12px] text-ink">
                  <span className="font-medium">{e.resource}:</span> {e.error}
                </div>
              ))}
            </div>
          )}
          <pre className="text-[11px] text-ink-muted bg-cream-deep rounded-lg p-3 overflow-auto max-h-[200px]">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </div>
      )}
    </MCCard>
  );
}
