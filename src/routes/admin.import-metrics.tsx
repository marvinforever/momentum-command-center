import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/mc/PageShell";
import { useClients } from "@/lib/queries-v2";
import { previewMetricsCsv, importMetricsCsv } from "@/server/metrics_import.functions";
import { runWeeklyRollupNow, getRecentRollupRuns } from "@/server/weekly_rollup.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/import-metrics")({
  head: () => ({ meta: [{ title: "Import metrics — Admin" }] }),
  component: ImportMetricsPage,
});

function ImportMetricsPage() {
  const clientsQ = useClients();
  const previewFn = useServerFn(previewMetricsCsv);
  const importFn = useServerFn(importMetricsCsv);
  const rollupFn = useServerFn(runWeeklyRollupNow);
  const recentRollupsFn = useServerFn(getRecentRollupRuns);
  const recentRollups = useQuery({ queryKey: ["weekly_rollup_runs"], queryFn: () => recentRollupsFn({ data: undefined as any }) });
  const [rollupBusy, setRollupBusy] = useState(false);

  const handleRollup = async () => {
    setRollupBusy(true);
    try {
      const r = await rollupFn({ data: { weeksBack: 12 } });
      toast.success(`Auto-fill complete: ${r.snapshotsWritten} values across ${r.metricsProcessed} metrics`);
      recentRollups.refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Auto-fill failed");
    }
    setRollupBusy(false);
  };

  const [clientId, setClientId] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
    setPreview(null); setResult(null);
  };

  const handlePreview = async () => {
    if (!csvText) return;
    setBusy(true);
    try {
      const p = await previewFn({ data: { csvText } });
      setPreview(p);
    } catch (e: any) { toast.error(e.message ?? "Preview failed"); }
    setBusy(false);
  };

  const handleImport = async () => {
    if (!csvText || !clientId) { toast.error("Pick a client and a CSV"); return; }
    setBusy(true);
    try {
      const r = await importFn({ data: { clientId, csvText } });
      setResult(r);
      toast.success(`Imported ${r.snapshots_written} snapshots across ${r.weeks_covered} weeks`);
    } catch (e: any) { toast.error(e.message ?? "Import failed"); }
    setBusy(false);
  };

  return (
    <PageShell>
      <div className="mb-5">
        <h1 className="serif text-[32px] text-ink">Import historical metrics</h1>
        <p className="mt-1.5 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
          Upload a weekly tracking CSV — backfills the dashboard
        </p>
      </div>

      {/* Auto-fill panel */}
      <div className="mc-card p-5 space-y-3 max-w-3xl mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="serif text-xl text-ink">Auto-fill from connected sources</h2>
            <p className="text-[12px] text-ink-muted mt-1">
              Pulls live values from YouTube, Captivate, LinkedIn, Kajabi & discovery calls into every metric marked <strong>auto</strong>. Runs every Sunday at 11pm UTC; click to run now.
            </p>
          </div>
          <button
            onClick={handleRollup}
            disabled={rollupBusy}
            className="px-3 py-2 bg-ink text-cream rounded text-sm whitespace-nowrap disabled:opacity-50"
          >
            {rollupBusy ? "Running…" : "Run auto-fill now"}
          </button>
        </div>
        {(recentRollups.data ?? []).length > 0 && (
          <div className="border-t border-line-soft pt-3">
            <div className="label-eyebrow mb-1">Recent runs</div>
            <ul className="text-[12px] text-ink-soft space-y-0.5">
              {(recentRollups.data ?? []).slice(0, 5).map((r: any) => (
                <li key={r.id} className="flex items-center gap-2 tabular-nums">
                  <span className={r.success ? "text-sage" : r.success === false ? "text-burgundy" : "text-ink-muted"}>
                    {r.success ? "✓" : r.success === false ? "✗" : "…"}
                  </span>
                  <span>{new Date(r.started_at).toLocaleString()}</span>
                  <span className="text-ink-muted">·</span>
                  <span>{r.snapshots_written ?? 0} values</span>
                  <span className="text-ink-muted">· {r.triggered_by}</span>
                  {r.error && <span className="text-burgundy ml-2">{r.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mc-card p-5 space-y-4 max-w-3xl">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full px-3 py-2 border border-line rounded text-sm">
            <option value="">— select —</option>
            {(clientsQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label-eyebrow block mb-1">CSV file</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="text-sm"
          />
          {csvText && <div className="text-[11px] text-ink-muted mt-1">{csvText.length.toLocaleString()} chars loaded</div>}
        </div>

        <div className="flex gap-2">
          <button onClick={handlePreview} disabled={!csvText || busy} className="px-3 py-2 border border-line rounded text-sm disabled:opacity-50">
            Preview
          </button>
          <button onClick={handleImport} disabled={!csvText || !clientId || busy} className="px-3 py-2 bg-gold text-white rounded text-sm disabled:opacity-50">
            {busy ? "Importing…" : "Import"}
          </button>
        </div>

        {preview && (
          <div className="border border-line-soft rounded p-3 text-sm">
            <div className="text-ink-soft mb-2">
              <strong>{preview.clientLabel ?? "?"}</strong> · {preview.weekCount} weekly columns
              {preview.firstWeek && <> ({preview.firstWeek} → {preview.lastWeek})</>}
            </div>
            <div className="text-[12px]">
              {preview.rows.length} metrics detected:
              <ul className="mt-1 max-h-48 overflow-y-auto text-ink-muted text-[11px] list-disc list-inside">
                {preview.rows.map((r: any) => <li key={r.key}>[{r.section}] {r.label} — {r.nonEmptyCount} values</li>)}
              </ul>
            </div>
            {preview.warnings?.length > 0 && (
              <div className="mt-2 text-burgundy text-[11px]">{preview.warnings.join(" · ")}</div>
            )}
          </div>
        )}

        {result && (
          <div className="border border-sage rounded p-3 text-sm bg-sage-bg">
            ✓ Imported successfully — {result.metrics_created} new metrics, {result.snapshots_written} snapshots written across {result.weeks_covered} weeks.
          </div>
        )}
      </div>
    </PageShell>
  );
}
