import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/mc/PageShell";
import { PageHeader } from "@/components/mc/PageHeader";
import { MCCard } from "@/components/mc/Primitives";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

      <MCCard className="p-8 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="serif text-[26px] text-ink">YouTube Data Sync</h2>
            <p className="text-[13px] text-ink-soft mt-1">
              Pull subscriber counts, 28-day reach, and the most recent 50 videos from each channel.
              Auto-runs daily at 6:30 AM UTC.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
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

      {lastResult && (
        <MCCard className="p-6">
          <div className="label-eyebrow mb-3">Last Sync Result</div>
          {lastResult.channels?.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              {lastResult.channels.map((c: any) => (
                <div key={c.channel} className="rounded-lg bg-cream border border-line-soft p-4">
                  <div className="text-[14px] font-medium text-ink">{c.channel}</div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
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
