// Generic per-campaign webhook for Zapier, Make, Pabbly, or any other tool
// that can POST JSON. Each campaign has a unique webhook_token in its URL,
// so the URL itself acts as the auth token. Sample body:
//
//   POST /api/public/hooks/campaign-lead/abc123def456
//   { "email": "jane@example.com", "name": "Jane Doe", "source": "FB Ad" }
//
// Required: email
// Optional: name, source, phone, company, notes, stage

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LeadSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  stage: z.string().max(100).optional(),
});

export const Route = createFileRoute("/api/public/hooks/campaign-lead/$token")({
  server: {
    handlers: {
      GET: async ({ params }) =>
        new Response(
          JSON.stringify({
            ok: true,
            message: `POST a JSON body with at minimum { "email": "..." } to this URL. Token: ${params.token.slice(0, 6)}…`,
            sample_body: { email: "jane@example.com", name: "Jane Doe", source: "FB Ad" },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      POST: async ({ request, params }) => {
        const token = params.token;
        if (!token || token.length < 8) {
          return new Response(JSON.stringify({ ok: false, error: "Invalid token" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: campaign, error: campErr } = await supabaseAdmin
          .from("campaigns")
          .select("id,name,pipeline_stages")
          .eq("webhook_token", token)
          .eq("archived", false)
          .maybeSingle();

        if (campErr || !campaign) {
          return new Response(JSON.stringify({ ok: false, error: "Unknown webhook token" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = LeadSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ ok: false, error: "Validation failed", issues: parsed.error.issues }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const input = parsed.data;
        const email = input.email.toLowerCase();
        const stages = (campaign.pipeline_stages as unknown as string[] | null) ?? ["Lead In"];
        const stage =
          input.stage && stages.includes(input.stage) ? input.stage : stages[0] ?? "Lead In";

        // Find or create
        const { data: existing } = await supabaseAdmin
          .from("contacts")
          .select("id,campaign_id")
          .ilike("email", email)
          .maybeSingle();

        let contactId: string;
        if (existing) {
          contactId = existing.id;
          const patch: any = { last_touch_at: new Date().toISOString() };
          if (existing.campaign_id !== campaign.id) patch.campaign_id = campaign.id;
          if (input.name) patch.name = input.name;
          if (input.phone) patch.phone = input.phone;
          if (input.company) patch.company = input.company;
          if (input.source) patch.source = input.source;
          await supabaseAdmin.from("contacts").update(patch).eq("id", contactId);

          await supabaseAdmin.from("contact_activity").insert({
            contact_id: contactId,
            type: "campaign_tagged",
            description: `Tagged to ${campaign.name} via webhook`,
            created_by: "webhook",
          });
        } else {
          const { data: created, error: insertErr } = await supabaseAdmin
            .from("contacts")
            .insert({
              name: input.name || email,
              email,
              phone: input.phone ?? null,
              company: input.company ?? null,
              source: input.source ?? "Webhook",
              stage,
              campaign_id: campaign.id,
              last_touch_at: new Date().toISOString(),
              notes_summary: input.notes ?? null,
            })
            .select("id")
            .single();

          if (insertErr) {
            return new Response(JSON.stringify({ ok: false, error: insertErr.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          contactId = created.id;
          await supabaseAdmin.from("contact_activity").insert({
            contact_id: contactId,
            type: "created",
            description: `Auto-created from webhook → ${campaign.name}`,
            created_by: "webhook",
          });
        }

        return new Response(
          JSON.stringify({ ok: true, contact_id: contactId, campaign: campaign.name }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
