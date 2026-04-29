import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runWeeklyRollup } from "@/server/weekly_rollup.server";

export const Route = createFileRoute("/api/public/hooks/weekly-rollup")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runWeeklyRollup({
            supa: supabaseAdmin,
            weeksBack: 4, // cron only re-rolls the last 4 weeks
            triggeredBy: "cron",
          });
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
