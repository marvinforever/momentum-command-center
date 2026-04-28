import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { importMetricsToDb, parseMetricsCsv } from "@/server/metrics_import.server";

export const previewMetricsCsv = createServerFn({ method: "POST" })
  .inputValidator((data: { csvText: string }) => data)
  .handler(async ({ data }) => {
    const parsed = parseMetricsCsv(data.csvText);
    return {
      clientLabel: parsed.clientLabel,
      weekCount: parsed.weekEndings.length,
      firstWeek: parsed.weekEndings[0] ?? null,
      lastWeek: parsed.weekEndings[parsed.weekEndings.length - 1] ?? null,
      rows: parsed.rows.map((r) => ({
        section: r.section,
        label: r.label,
        key: r.key,
        nonEmptyCount: r.values.filter((v) => v.value != null || v.valueText).length,
      })),
      warnings: parsed.warnings,
    };
  });

export const importMetricsCsv = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId: string; csvText: string }) => data)
  .handler(async ({ data }) => {
    return importMetricsToDb({
      supabaseAdmin,
      clientId: data.clientId,
      csvText: data.csvText,
    });
  });
