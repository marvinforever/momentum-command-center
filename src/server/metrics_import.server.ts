// Pure helpers for parsing the weekly-metrics CSVs that Christine maintains.
// Server-only because the importer touches supabaseAdmin.

export type ParsedRow = {
  section: string;
  label: string;
  key: string;
  values: { weekEnding: string; value: number | null; valueText: string | null }[];
};

export type ParseResult = {
  clientLabel: string | null;
  weekEndings: string[];
  rows: ParsedRow[];
  warnings: string[];
};

const TIME_RE = /^[:;]?\d{1,2}[:;]\d{2}$/;
const US_THOUSANDS_RE = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
const EU_DECIMAL_RE = /^-?\d+,\d+$/;
const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function parseValue(raw: string | undefined | null): { value: number | null; valueText: string | null } {
  if (raw == null) return { value: null, valueText: null };
  const s = String(raw).trim().replace(/^"|"$/g, "");
  if (s === "" || s === "-" || s === "—") return { value: null, valueText: null };

  // Time durations like 4:11, :14, or typo'd 4;57
  if (TIME_RE.test(s)) return { value: null, valueText: s.replace(";", ":") };

  // Percent
  if (s.endsWith("%")) {
    const body = s.slice(0, -1).replace(",", ".").trim();
    const n = Number(body);
    return Number.isFinite(n) ? { value: n / 100, valueText: s } : { value: null, valueText: s };
  }

  // US thousands: 8,486
  if (US_THOUSANDS_RE.test(s)) {
    const n = Number(s.replace(/,/g, ""));
    if (Number.isFinite(n)) return { value: n, valueText: s };
  }

  // European decimal: 28,7
  if (EU_DECIMAL_RE.test(s)) {
    const n = Number(s.replace(",", "."));
    if (Number.isFinite(n)) return { value: n, valueText: s };
  }

  // Plain number (incl. with embedded thousands)
  const n = Number(s.replace(/,/g, ""));
  if (Number.isFinite(n)) return { value: n, valueText: s };

  return { value: null, valueText: s };
}

function isDate(s: string): boolean {
  return DATE_RE.test(s.trim());
}

function parseDate(s: string): string {
  const m = DATE_RE.exec(s.trim());
  if (!m) throw new Error(`Bad date: ${s}`);
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// Minimal CSV row splitter that handles quoted fields containing commas.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

const SECTION_NORMALIZE: Record<string, string> = {
  "EMAIL LIST": "EMAIL",
  EMAIL: "EMAIL",
  YOUTUBE: "YOUTUBE",
  PODCAST: "PODCAST",
  "SOCIAL CHANNELS": "SOCIAL",
  SOCIAL: "SOCIAL",
  SALES: "SALES",
  "OPT INS": "OPT INS",
  FOLK: "PIPELINE",
  PIPELINE: "PIPELINE",
};

export function parseMetricsCsv(csvText: string): ParseResult {
  const warnings: string[] = [];
  const lines = csvText.split(/\r?\n/).map((l) => l).filter((l, i) => l.length > 0 || i === 0);
  const rows = lines.map(splitCsvLine);
  if (rows.length === 0) return { clientLabel: null, weekEndings: [], rows: [], warnings: ["empty file"] };

  // Find header row: pick from the first 5 rows the one with the most date cells.
  let headerIdx = 0;
  let bestCount = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const cnt = rows[i].filter((c) => isDate(c)).length;
    if (cnt > bestCount) { bestCount = cnt; headerIdx = i; }
  }
  const header = rows[headerIdx] ?? [];
  const clientLabel = (header[0] ?? "").trim() || null;
  const dateCols: { idx: number; weekEnding: string }[] = [];
  header.forEach((c, i) => {
    if (isDate(c)) dateCols.push({ idx: i, weekEnding: parseDate(c) });
  });
  if (dateCols.length === 0) {
    return { clientLabel, weekEndings: [], rows: [], warnings: ["no date columns found in header"] };
  }
  const weekEndings = dateCols.map((d) => d.weekEnding);

  const out: ParsedRow[] = [];
  let section = "GENERAL";
  const usedKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    if (i === headerIdx) continue;
    const r = rows[i];
    if (!r || r.every((c) => !c.trim())) continue;
    const first = (r[0] ?? "").trim();
    if (!first) continue;
    if (first === clientLabel) continue;

    // Section header: first cell uppercase letters/spaces only, rest empty
    const restEmpty = r.slice(1).every((c) => !c.trim());
    const looksSection = /^[A-Z][A-Z\s]+$/.test(first);
    if (looksSection && restEmpty) {
      section = SECTION_NORMALIZE[first] ?? first;
      continue;
    }

    // Metric row
    const label = first;
    let key = slugify(label);
    if (usedKeys.has(key)) {
      let n = 2;
      while (usedKeys.has(`${key}_${n}`)) n++;
      key = `${key}_${n}`;
    }
    usedKeys.add(key);

    const values = dateCols.map(({ idx, weekEnding }) => {
      const cell = r[idx];
      const { value, valueText } = parseValue(cell);
      return { weekEnding, value, valueText };
    });
    out.push({ section, label, key, values });
  }

  return { clientLabel, weekEndings, rows: out, warnings };
}

// ---------- Database write ----------

export type ImportSummary = {
  client_id: string;
  client_label_in_csv: string | null;
  metrics_created: number;
  metrics_existing: number;
  snapshots_written: number;
  weeks_covered: number;
  warnings: string[];
};

export async function importMetricsToDb(opts: {
  supabaseAdmin: any;
  clientId: string;
  csvText: string;
}): Promise<ImportSummary> {
  const { supabaseAdmin, clientId, csvText } = opts;
  const parsed = parseMetricsCsv(csvText);

  // Pull existing definitions for this client
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("metric_definitions")
    .select("id, key, section, label, sort_order")
    .eq("client_id", clientId);
  if (exErr) throw exErr;

  const byKey = new Map<string, { id: string; sort_order: number }>(
    (existing ?? []).map((d: any) => [d.key, { id: d.id, sort_order: d.sort_order ?? 0 }]),
  );

  let created = 0;
  let nextSort = (existing ?? []).reduce((m: number, d: any) => Math.max(m, d.sort_order ?? 0), 0) + 1;

  // Insert any new metric_definitions
  const toInsert: any[] = [];
  for (const row of parsed.rows) {
    if (byKey.has(row.key)) continue;
    toInsert.push({
      client_id: clientId,
      key: row.key,
      label: row.label,
      section: row.section,
      source: "csv_import",
      format: guessFormat(row),
      sort_order: nextSort++,
    });
  }
  if (toInsert.length) {
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("metric_definitions")
      .insert(toInsert)
      .select("id, key");
    if (insErr) throw insErr;
    for (const d of inserted ?? []) {
      byKey.set(d.key, { id: d.id, sort_order: 0 });
      created++;
    }
  }

  // Build snapshot upserts — dedupe by (metric_definition_id, week_ending).
  // Postgres rejects upserts that hit the same conflict target twice in one
  // batch, so duplicate week columns in the CSV (e.g. two "03/06/2026" cols)
  // would otherwise blow up the entire chunk and silently write nothing.
  const snapshotMap = new Map<string, any>();
  let dupeCount = 0;
  for (const row of parsed.rows) {
    const def = byKey.get(row.key);
    if (!def) continue;
    for (const v of row.values) {
      if (v.value == null && (v.valueText == null || v.valueText === "")) continue;
      const k = `${def.id}__${v.weekEnding}`;
      if (snapshotMap.has(k)) dupeCount++;
      // Last value wins — typically the rightmost column is the most recent edit.
      snapshotMap.set(k, {
        metric_definition_id: def.id,
        week_ending: v.weekEnding,
        value: v.value,
        value_text: v.valueText,
        source: "csv_import",
      });
    }
  }
  const snapshots = Array.from(snapshotMap.values());
  if (dupeCount > 0) {
    parsed.warnings.push(`${dupeCount} duplicate (metric, week) cells were collapsed — check the CSV header for repeated dates`);
  }

  // Chunk upserts (Supabase has payload limits)
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < snapshots.length; i += CHUNK) {
    const chunk = snapshots.slice(i, i + CHUNK);
    const { error: upErr } = await supabaseAdmin
      .from("weekly_metric_snapshots")
      .upsert(chunk, { onConflict: "metric_definition_id,week_ending" });
    if (upErr) throw upErr;
    written += chunk.length;
  }

  return {
    client_id: clientId,
    client_label_in_csv: parsed.clientLabel,
    metrics_created: created,
    metrics_existing: parsed.rows.length - created,
    snapshots_written: written,
    weeks_covered: parsed.weekEndings.length,
    warnings: parsed.warnings,
  };
}

function guessFormat(row: ParsedRow): string {
  const sample = row.values.find((v) => v.valueText)?.valueText ?? "";
  if (sample.includes(":") || sample.includes(";")) return "duration_mmss";
  if (sample.endsWith("%")) return "percent";
  return "number";
}
