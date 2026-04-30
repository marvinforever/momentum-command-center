import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/audit-queue-build")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { buildAuditQueue } = await import("@/server/optimization.server");
          const result = await buildAuditQueue();
          return Response.json({ success: true, ...result });
        } catch (err: any) {
          console.error("Audit queue build error:", err);
          return Response.json({ success: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
