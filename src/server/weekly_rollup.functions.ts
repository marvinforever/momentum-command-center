import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runWeeklyRollup } from "./weekly_rollup.server";

export const runWeeklyRollupNow = createServerFn({ method: "POST" })
  .inputValidator((data: { weeksBack?: number } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    return runWeeklyRollup({
      supa: supabaseAdmin,
      weeksBack: data.weeksBack ?? 12,
      triggeredBy: "manual",
    });
  });

export const getRecentRollupRuns = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("weekly_rollup_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
});
