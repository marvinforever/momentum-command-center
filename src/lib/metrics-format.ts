// Format a snapshot value based on a metric definition's `format`.
import type { MetricDef, Snapshot } from "./queries-v2";

export function formatMetricValue(
  snap: { value: number | null; value_text: string | null } | undefined,
  def: { format: string | null },
): string {
  if (!snap) return "—";
  const fmt = def.format ?? "number";
  if (snap.value == null && (snap.value_text == null || snap.value_text === "")) return "—";
  if (fmt === "duration_mmss") return snap.value_text ?? "—";
  if (fmt === "percent") {
    if (snap.value != null) return `${(snap.value * 100).toFixed(1)}%`;
    return snap.value_text ?? "—";
  }
  if (fmt === "currency") {
    if (snap.value != null) return `$${snap.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    return snap.value_text ?? "—";
  }
  // number
  if (snap.value != null) {
    const abs = Math.abs(snap.value);
    if (abs >= 100 && Number.isInteger(snap.value)) {
      return snap.value.toLocaleString("en-US");
    }
    return snap.value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return snap.value_text ?? "—";
}

export function deltaForRow(
  values: { week_ending: string; value: number | null }[],
): { delta: number | null; pct: number | null } {
  const numeric = values.filter((v) => v.value != null);
  if (numeric.length < 2) return { delta: null, pct: null };
  const last = numeric[numeric.length - 1].value!;
  const prev = numeric[numeric.length - 2].value!;
  const delta = last - prev;
  const pct = prev !== 0 ? (delta / prev) * 100 : null;
  return { delta, pct };
}

export function formatDelta(d: number | null, fmt: string | null): string {
  if (d == null) return "—";
  if (fmt === "percent") {
    const pp = d * 100;
    return `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`;
  }
  if (Math.abs(d) >= 1 && Number.isInteger(d)) {
    return `${d >= 0 ? "+" : ""}${d.toLocaleString("en-US")}`;
  }
  return `${d >= 0 ? "+" : ""}${d.toFixed(2)}`;
}

export function weekShort(iso: string): string {
  // 2026-04-24 -> "Apr 24"
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Group definitions by section in a stable order.
const SECTION_ORDER = ["EMAIL", "YOUTUBE", "PODCAST", "SOCIAL", "OPT INS", "SALES", "PIPELINE"];

export function groupBySection(defs: MetricDef[]): { section: string; defs: MetricDef[] }[] {
  const byKey = new Map<string, MetricDef[]>();
  for (const d of defs) {
    const arr = byKey.get(d.section) ?? [];
    arr.push(d);
    byKey.set(d.section, arr);
  }
  const ordered: { section: string; defs: MetricDef[] }[] = [];
  for (const s of SECTION_ORDER) {
    if (byKey.has(s)) ordered.push({ section: s, defs: byKey.get(s)!.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) });
  }
  for (const [s, arr] of byKey) {
    if (!SECTION_ORDER.includes(s)) ordered.push({ section: s, defs: arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) });
  }
  return ordered;
}

// Build a snapshot lookup keyed by `${defId}|${week}`.
export function buildSnapshotIndex(snaps: Snapshot[]) {
  const m = new Map<string, Snapshot>();
  for (const s of snaps) m.set(`${s.metric_definition_id}|${s.week_ending}`, s);
  return m;
}

// Get the unique sorted list of week_endings present in any snapshot.
export function uniqueWeeks(snaps: Snapshot[]): string[] {
  const set = new Set<string>();
  for (const s of snaps) set.add(s.week_ending);
  return Array.from(set).sort();
}
