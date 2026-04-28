// Edit Campaign drawer — name, color, data source picker per-source config,
// Sync now / Backfill buttons, and copy-to-clipboard for webhook URLs.

import { useState, useEffect, useMemo } from "react";
import { useUpdateCampaign, useKajabiForms, useMetaCampaignsForPicker, type Campaign } from "@/lib/queries-v2";
import { useServerFn } from "@tanstack/react-start";
import { ingestCampaign } from "@/server/campaign-ingest.functions";
import { toast } from "sonner";
import { X, Copy, RefreshCw, Megaphone } from "lucide-react";

type Props = {
  campaign: Campaign;
  onClose: () => void;
};

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manual entry only", desc: "You'll add contacts by hand." },
  { value: "kajabi_form", label: "Kajabi form", desc: "Auto-tag everyone who fills a specific opt-in form." },
  { value: "meta_ads", label: "Meta Lead Ads", desc: "Pull leads from a specific Meta campaign." },
  { value: "calendly", label: "Calendly", desc: "Auto-advance to Call Booked when a call is scheduled." },
  { value: "webhook", label: "Generic webhook (Zapier, etc.)", desc: "We give you a unique URL to paste anywhere." },
];

const CHANNELS = ["Other", "Meta Ads", "LinkedIn", "YouTube", "Email", "Podcast", "Multi-Channel"];

export function EditCampaignDrawer({ campaign, onClose }: Props) {
  const update = useUpdateCampaign();
  const kajabiForms = useKajabiForms();
  const metaCamps = useMetaCampaignsForPicker();
  const ingestFn = useServerFn(ingestCampaign);

  const [name, setName] = useState(campaign.name);
  const [color, setColor] = useState(campaign.color ?? "#C4924A");
  const [primaryChannel, setPrimaryChannel] = useState(campaign.primary_channel ?? "Other");
  const [dataSource, setDataSource] = useState(campaign.data_source);
  const [config, setConfig] = useState<Record<string, any>>(campaign.data_source_config ?? {});
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setName(campaign.name);
    setColor(campaign.color ?? "#C4924A");
    setPrimaryChannel(campaign.primary_channel ?? "Other");
    setDataSource(campaign.data_source);
    setConfig(campaign.data_source_config ?? {});
  }, [campaign.id]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = useMemo(
    () => (campaign.webhook_token ? `${baseUrl}/api/public/hooks/campaign-lead/${campaign.webhook_token}` : ""),
    [baseUrl, campaign.webhook_token],
  );
  const calendlyUrl = `${baseUrl}/api/public/hooks/calendly`;

  async function handleSave() {
    try {
      await update.mutateAsync({
        id: campaign.id,
        name: name.trim(),
        color,
        primary_channel: primaryChannel,
        data_source: dataSource,
        data_source_config: config,
      });
      toast.success("Campaign updated");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      // Save first so the worker reads the latest config
      await update.mutateAsync({
        id: campaign.id,
        data_source: dataSource,
        data_source_config: config,
      });
      const res: any = await ingestFn({ data: { campaign_id: campaign.id } });
      if (!res.ok) {
        toast.error(res.error ?? "Sync failed");
        return;
      }
      const r = res.result;
      toast.success(`Synced: ${r.created} created, ${r.matched} re-tagged, ${r.skipped} already in campaign`);
      if (r.errors?.length) console.error("Sync errors:", r.errors);
    } catch (e: any) {
      toast.error(e.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-ink/40" onClick={onClose} />
      <div className="w-full max-w-xl bg-paper overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-paper border-b border-line-soft p-5 flex items-center justify-between z-10">
          <h2 className="serif text-2xl text-ink flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-gold" /> Edit campaign
          </h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basics */}
          <section>
            <label className="label-eyebrow mb-1 block">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded text-sm bg-paper" />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label-eyebrow mb-1 block">Color</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                  className="w-full h-10 border border-line rounded cursor-pointer" />
              </div>
              <div>
                <label className="label-eyebrow mb-1 block">Primary channel</label>
                <select value={primaryChannel} onChange={(e) => setPrimaryChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded text-sm bg-paper">
                  {CHANNELS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Data source */}
          <section className="border-t border-line-soft pt-5">
            <label className="label-eyebrow mb-2 block">Data source</label>
            <p className="text-[12px] text-ink-muted mb-3">Where do leads for this campaign come from?</p>
            <div className="space-y-2">
              {SOURCE_OPTIONS.map((opt) => (
                <label key={opt.value}
                  className={`flex items-start gap-2 p-3 border rounded cursor-pointer transition-colors ${dataSource === opt.value ? "border-gold bg-gold/5" : "border-line hover:border-ink-soft"}`}>
                  <input type="radio" name="ds" value={opt.value} checked={dataSource === opt.value}
                    onChange={() => { setDataSource(opt.value); setConfig({}); }}
                    className="mt-1" />
                  <div className="flex-1">
                    <div className="text-[13px] text-ink font-medium">{opt.label}</div>
                    <div className="text-[11px] text-ink-muted mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Source-specific config */}
            <div className="mt-4">
              {dataSource === "kajabi_form" && (
                <div>
                  <label className="label-eyebrow mb-1 block">Kajabi form</label>
                  <select
                    value={config.kajabi_form_id ?? ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const f = kajabiForms.data?.find((x) => x.id === id);
                      setConfig({ kajabi_form_id: id, form_name: f?.name ?? "" });
                    }}
                    className="w-full px-3 py-2 border border-line rounded text-sm bg-paper">
                    <option value="">— Pick a form —</option>
                    {kajabiForms.data?.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.count} submissions)</option>
                    ))}
                  </select>
                </div>
              )}

              {dataSource === "meta_ads" && (
                <div>
                  <label className="label-eyebrow mb-1 block">Meta campaign</label>
                  <select
                    value={config.meta_campaign_id ?? ""}
                    onChange={(e) => setConfig({ meta_campaign_id: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded text-sm bg-paper">
                    <option value="">— Pick a Meta campaign —</option>
                    {metaCamps.data?.map((m) => (
                      <option key={m.meta_campaign_id} value={m.meta_campaign_id}>{m.name}{m.status ? ` · ${m.status}` : ""}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-ink-muted mt-2">
                    Note: Meta lead-form ingestion is coming soon. For now use Kajabi or a webhook to capture leads from your ads.
                  </p>
                </div>
              )}

              {dataSource === "calendly" && (
                <div>
                  <label className="label-eyebrow mb-1 block">Calendly event-type URL</label>
                  <input
                    type="url"
                    placeholder="https://calendly.com/you/discovery-call"
                    value={config.event_type_url ?? ""}
                    onChange={(e) => setConfig({ ...config, event_type_url: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded text-sm bg-paper" />
                  <div className="mt-3 p-3 bg-cream/60 border border-line-soft rounded">
                    <div className="label-eyebrow mb-1">Webhook URL — paste into Calendly → Integrations → Webhooks</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] text-ink-soft break-all">{calendlyUrl}</code>
                      <button onClick={() => copy(calendlyUrl, "URL")} className="p-1.5 border border-line rounded hover:bg-paper"><Copy className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              )}

              {dataSource === "webhook" && (
                <div className="p-3 bg-cream/60 border border-line-soft rounded">
                  <div className="label-eyebrow mb-1">Your unique webhook URL</div>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="flex-1 text-[11px] text-ink-soft break-all">{webhookUrl}</code>
                    <button onClick={() => copy(webhookUrl, "URL")} className="p-1.5 border border-line rounded hover:bg-paper"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    POST JSON: <code className="text-ink-soft">{`{"email":"jane@example.com","name":"Jane","source":"FB Ad"}`}</code>
                  </div>
                </div>
              )}
            </div>

            {(dataSource === "kajabi_form" || dataSource === "meta_ads") && (
              <button
                onClick={handleSync}
                disabled={syncing || !config.kajabi_form_id && !config.meta_campaign_id}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-ink text-cream rounded text-sm disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync now / backfill"}
              </button>
            )}
          </section>

          {/* Footer */}
          <div className="border-t border-line-soft pt-4 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-line rounded text-sm">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-gold text-cream rounded text-sm font-medium">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
