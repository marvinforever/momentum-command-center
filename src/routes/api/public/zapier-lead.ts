import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PayloadSchema = z.object({
  email: z.string().email().max(320),
  first_name: z.string().max(120).optional().nullable(),
  last_name: z.string().max(120).optional().nullable(),
  name: z.string().max(240).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  form_name: z.string().max(240).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
  utm_content: z.string().max(240).optional().nullable(),
  how_did_you_hear: z.string().max(240).optional().nullable(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/zapier-lead")({
  server: {
    handlers: {
      GET: async () => {
        // Friendly response for browser/Zapier URL validation
        return jsonResponse({ ok: true, message: "Zapier lead webhook is live. POST JSON to this URL." });
      },
      POST: async ({ request }) => {
        // 1. Auth — secret in URL query param
        const url = new URL(request.url);
        const providedSecret = url.searchParams.get("secret") ?? "";
        const expectedSecret = process.env.ZAPIER_LEAD_WEBHOOK_SECRET ?? "";

        if (!expectedSecret) {
          console.error("[zapier-lead] ZAPIER_LEAD_WEBHOOK_SECRET not configured");
          return jsonResponse({ error: "Server not configured" }, 500);
        }
        if (providedSecret !== expectedSecret) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }

        // 2. Parse + validate
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) {
          return jsonResponse(
            { error: "Validation failed", details: parsed.error.flatten() },
            400,
          );
        }
        const data = parsed.data;

        // 3. Build the lead row — create new entry every time (no dedupe)
        const fullName =
          data.name?.trim() ||
          [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
          data.email;

        const leadRow = {
          name: fullName,
          email: data.email,
          phone: data.phone ?? null,
          lead_source: data.source ?? "Kajabi (Zapier)",
          how_did_you_hear: data.how_did_you_hear ?? data.form_name ?? null,
          utm_source: data.utm_source ?? null,
          utm_medium: data.utm_medium ?? null,
          utm_campaign: data.utm_campaign ?? null,
          utm_content: data.utm_content ?? null,
          status: "New",
          first_touch_date: new Date().toISOString().slice(0, 10),
          notes: data.form_name ? `Form: ${data.form_name}` : null,
        };

        const { data: inserted, error } = await supabaseAdmin
          .from("leads")
          .insert(leadRow)
          .select("id")
          .single();

        if (error) {
          console.error("[zapier-lead] Insert failed:", error);
          return jsonResponse({ error: "Failed to save lead", details: error.message }, 500);
        }

        return jsonResponse({ ok: true, lead_id: inserted?.id });
      },
    },
  },
});
