import { useMemo, useState } from "react";
import { useClients, useMetricDefinitions, useSnapshotsForClient, useUpsertSnapshot, type MetricDef, type Client } from "@/lib/queries-v2";
import {
  formatMetricValue, deltaForRow, formatDelta, weekShort,
  groupBySection, buildSnapshotIndex, uniqueWeeks,
} from "@/lib/metrics-format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ChevronDown, ChevronRight, Pencil, X, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
import { toast } from "sonner";

export function MetricsGrid() {
  const clientsQ = useClients();
  const clients = clientsQ.data ?? [];
  const [clientId, setClientId] = useState<string | null>(null);
  const activeClientId = clientId ?? clients[0]?.id ?? null;

  const defsQ = useMetricDefinitions(activeClientId ?? undefined);
  const snapsQ = useSnapshotsForClient(activeClientId ?? undefined);
  const defs = defsQ.data ?? [];
  const snaps = snapsQ.data ?? [];

  const sections = useMemo(() => groupBySection(defs), [defs]);
  const allWeeks = useMemo(() => uniqueWeeks(snaps), [snaps]);
  const idx = useMemo(() => buildSnapshotIndex(snaps), [snaps]);

  // Show only the most recent N weeks in the grid by default; user can scroll older.
  const [weeksToShow, setWeeksToShow] = useState(12);
  const visibleWeeks = useMemo(() => allWeeks.slice(-weeksToShow), [allWeeks, weeksToShow]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleSection = (s: string) => {
    const next = new Set(collapsed);
    next.has(s) ? next.delete(s) : next.add(s);
    setCollapsed(next);
  };

  const [drilldown, setDrilldown] = useState<MetricDef | null>(null);

  const loading = clientsQ.isLoading || defsQ.isLoading || snapsQ.isLoading;

  return (
    <div>
      {/* Client picker */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="label-eyebrow mr-2">Focus Area</span>
        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => setClientId(c.id)}
            className={
              "px-3 py-1.5 rounded-full text-[12px] transition-all border " +
              (activeClientId === c.id
                ? "border-ink bg-ink text-cream"
                : "border-line text-ink-soft hover:border-ink hover:text-ink")
            }
            style={activeClientId === c.id && c.color ? { background: c.color, borderColor: c.color, color: "white" } : undefined}
          >
            {c.name}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-[11px] text-ink-muted">
          <span>Show:</span>
          {[8, 12, 26, 52, 999].map((n) => (
            <button
              key={n}
              onClick={() => setWeeksToShow(n)}
              className={
                "px-2 py-0.5 rounded " +
                (weeksToShow === n ? "bg-ink text-cream" : "hover:bg-cream-deep")
              }
            >
              {n === 999 ? "All" : `${n}w`}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-ink-muted text-sm">Loading…</div>}
      {!loading && defs.length === 0 && (
        <EmptyState />
      )}
      {!loading && defs.length > 0 && (
        <div className="mc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="sticky left-0 z-10 bg-paper text-left px-4 py-2.5 label-eyebrow border-r border-line min-w-[220px] w-[220px]">
                    Metric
                  </th>
                  {visibleWeeks.map((w) => (
                    <th key={w} className="text-right px-3 py-2.5 label-eyebrow whitespace-nowrap min-w-[72px]">
                      {weekShort(w)}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2.5 label-eyebrow whitespace-nowrap min-w-[80px]">Δ</th>
                  <th className="text-right px-3 py-2.5 label-eyebrow whitespace-nowrap min-w-[100px]">Trend</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(({ section, defs }) => (
                  <SectionGroup
                    key={section}
                    section={section}
                    defs={defs}
                    visibleWeeks={visibleWeeks}
                    allWeeks={allWeeks}
                    idx={idx}
                    collapsed={collapsed.has(section)}
                    toggleSection={() => toggleSection(section)}
                    onOpen={(d) => setDrilldown(d)}
                    clientId={activeClientId!}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drilldown && (
        <DrilldownPanel
          def={drilldown}
          allWeeks={allWeeks}
          idx={idx}
          clientId={activeClientId!}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}

function SectionGroup({
  section, defs, visibleWeeks, allWeeks, idx, collapsed, toggleSection, onOpen, clientId,
}: {
  section: string; defs: MetricDef[]; visibleWeeks: string[]; allWeeks: string[];
  idx: Map<string, any>; collapsed: boolean; toggleSection: () => void;
  onOpen: (d: MetricDef) => void; clientId: string;
}) {
  return (
    <>
      <tr className="bg-gold border-b border-line-soft cursor-pointer hover:bg-gold/90 transition-colors" onClick={toggleSection}>
        <td colSpan={visibleWeeks.length + 3} className="sticky left-0 bg-gold px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white font-semibold">
          <span className="inline-flex items-center gap-1.5">
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {section}
          </span>
        </td>
      </tr>
      {!collapsed && defs.map((def) => (
        <MetricRow
          key={def.id}
          def={def}
          visibleWeeks={visibleWeeks}
          allWeeks={allWeeks}
          idx={idx}
          onOpen={() => onOpen(def)}
          clientId={clientId}
        />
      ))}
    </>
  );
}

function MetricRow({
  def, visibleWeeks, allWeeks, idx, onOpen, clientId,
}: {
  def: MetricDef; visibleWeeks: string[]; allWeeks: string[];
  idx: Map<string, any>; onOpen: () => void; clientId: string;
}) {
  const allRowValues = allWeeks.map((w) => ({
    week_ending: w,
    value: idx.get(`${def.id}|${w}`)?.value ?? null,
  }));
  const { delta, pct } = deltaForRow(allRowValues);

  // sparkline data
  const sparkData = allRowValues.filter((v) => v.value != null).slice(-12);

  return (
    <tr className="border-b border-line-soft hover:bg-cream-deep/40 transition-colors cursor-pointer" onClick={onOpen}>
      <td className="sticky left-0 bg-paper hover:bg-cream-deep/40 transition-colors px-4 py-2.5 text-[13px] text-ink border-r border-line-soft">
        <div className="flex items-center gap-1.5 max-w-[200px]">
          {def.source === "auto" && (
            <span title="Auto-filled weekly from connected source" className="inline-flex shrink-0">
              <Zap className="h-3 w-3 text-gold" fill="currentColor" />
            </span>
          )}
          <span className="truncate" title={def.label}>{def.label}</span>
        </div>
      </td>
      {visibleWeeks.map((w) => {
        const snap = idx.get(`${def.id}|${w}`);
        const cellText = formatMetricValue(snap, def);
        return (
          <td key={w} className="text-right px-3 py-2.5 text-[12.5px] text-ink-soft tabular-nums whitespace-nowrap">
            {cellText}
          </td>
        );
      })}
      <td className="text-right px-3 py-2.5 text-[12px] tabular-nums whitespace-nowrap">
        {delta == null ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <span className={
            delta > 0 ? "text-sage" : delta < 0 ? "text-burgundy" : "text-ink-muted"
          }>
            {delta > 0 ? <TrendingUp className="inline h-3 w-3 mr-0.5" /> : delta < 0 ? <TrendingDown className="inline h-3 w-3 mr-0.5" /> : <Minus className="inline h-3 w-3 mr-0.5" />}
            {formatDelta(delta, def.format)}
            {pct != null && Math.abs(pct) >= 0.5 && (
              <span className="text-ink-muted ml-1">({pct > 0 ? "+" : ""}{pct.toFixed(0)}%)</span>
            )}
          </span>
        )}
      </td>
      <td className="px-3 py-2 w-[100px]">
        <div className="h-6 w-[90px]">
          {sparkData.length >= 2 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={delta != null && delta >= 0 ? "#6B8E7F" : "#8B3A3A"}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="mc-card p-10 text-center">
      <h3 className="serif text-2xl text-ink mb-2">No historical metrics yet</h3>
      <p className="text-ink-muted text-sm mb-4">
        Import your existing tracking sheet to see every metric as a weekly trend.
      </p>
      <a href="/admin/import-metrics" className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-md text-sm hover:bg-gold/90">
        Import metrics CSV →
      </a>
    </div>
  );
}

function DrilldownPanel({
  def, allWeeks, idx, clientId, onClose,
}: {
  def: MetricDef; allWeeks: string[]; idx: Map<string, any>;
  clientId: string; onClose: () => void;
}) {
  const series = allWeeks.map((w) => {
    const snap = idx.get(`${def.id}|${w}`);
    return {
      week: w,
      label: weekShort(w),
      value: snap?.value ?? null,
      raw: snap?.value_text ?? "",
      note: snap?.note ?? "",
    };
  });
  const numericSeries = series.filter((s) => s.value != null);
  const hasNumeric = numericSeries.length > 0;

  const upsert = useUpsertSnapshot();
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleSave = async (week: string) => {
    const trimmed = editValue.trim();
    let value: number | null = null;
    let valueText: string | null = trimmed || null;
    if (def.format === "duration_mmss") {
      value = null;
      valueText = trimmed || null;
    } else if (def.format === "percent") {
      const n = Number(trimmed.replace("%", ""));
      if (Number.isFinite(n)) { value = n / 100; valueText = `${n}%`; }
    } else {
      const n = Number(trimmed.replace(/,/g, ""));
      if (Number.isFinite(n)) { value = n; valueText = trimmed; }
    }
    try {
      await upsert.mutateAsync({
        metric_definition_id: def.id,
        week_ending: week,
        value,
        value_text: valueText,
        clientId,
      });
      toast.success("Saved");
      setEditingWeek(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/30" />
      <div className="relative w-full max-w-2xl bg-paper border-l border-line h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-start justify-between">
          <div>
            <div className="label-eyebrow">{def.section}</div>
            <h2 className="serif text-2xl text-ink mt-1">{def.label}</h2>
            <div className="text-[11px] text-ink-muted mt-1">
              Source: {def.source ?? "manual"} · Format: {def.format ?? "number"}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-cream-deep">
            <X className="h-5 w-5 text-ink-muted" />
          </button>
        </div>

        {/* Chart */}
        <div className="px-6 py-5">
          {hasNumeric ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={numericSeries}>
                  <CartesianGrid stroke="#E5DFD2" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8A8275" }} stroke="#E5DFD2" />
                  <YAxis tick={{ fontSize: 10, fill: "#8A8275" }} stroke="#E5DFD2" />
                  <Tooltip contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8, color: "#F7F3EC", fontSize: 12 }} />
                  <Line type="monotone" dataKey="value" stroke="#C4924A" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-ink-muted text-sm py-8 text-center border border-dashed border-line rounded">
              No numeric history yet — only text values like durations.
            </div>
          )}
        </div>

        {/* Weekly table — editable */}
        <div className="px-6 pb-8">
          <h3 className="label-eyebrow mb-2">Weekly values · click to edit</h3>
          <div className="border border-line-soft rounded">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-soft text-left text-ink-muted text-[11px] uppercase tracking-wider">
                  <th className="px-3 py-2">Week ending</th>
                  <th className="px-3 py-2 text-right">Value</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((s) => (
                  <tr key={s.week} className="border-b border-line-soft last:border-0 hover:bg-cream-deep/40">
                    <td className="px-3 py-2 text-ink-soft">{s.week}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {editingWeek === s.week ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave(s.week);
                            if (e.key === "Escape") setEditingWeek(null);
                          }}
                          onBlur={() => handleSave(s.week)}
                          className="w-32 text-right px-2 py-1 border border-gold rounded text-ink bg-paper"
                        />
                      ) : (
                        formatMetricValue({ value: s.value, value_text: s.raw }, def)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editingWeek !== s.week && (
                        <button
                          onClick={() => { setEditingWeek(s.week); setEditValue(s.raw || (s.value?.toString() ?? "")); }}
                          className="p-1 rounded hover:bg-cream-deep text-ink-muted hover:text-ink"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
