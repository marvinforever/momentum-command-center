// Calendly webhook receiver.
//
// Calendly fires:
//   - invitee.created   → move contact to "Call Booked", set next_followup_at
//   - invitee.canceled  → move back to previous stage with note
//
// We match the campaign by the event-type URI saved on the campaign's
// data_source_config.event_type_url. If there's no matching campaign, we
// still log the contact so nothing is lost.
//
// SECURITY: Calendly signs requests with HMAC-SHA256 using your signing key.
// Set CALENDLY_WEBHOOK_SIGNING_KEY in secrets to enable verification. We will
// refuse unsigned requests if the secret is set.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function verifyCalendlySignature(rawBody: string, headerValue: string | null, secret: string): boolean {
  if (!headerValue) return false;
  // Calendly format: t=<unix_ts>,v1=<signature>
  const parts = Object.fromEntries(
    headerValue.split(",").map((p) => {
      const [k, v] = p.trim().split("=");
      return [k, v];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const data = `${t}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(data).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

async function findCampaignForEventType(eventTypeUri: string | null): Promise<any | null> {
  if (!eventTypeUri) return null;
  const { data } = await supabaseAdmin
    .from("campaigns")
    .select("id,name,pipeline_stages,data_source,data_source_config")
    .eq("data_source", "calendly")
    .eq("archived", false);

  return (
    (data ?? []).find((c: any) => {
      const url = c.data_source_config?.event_type_url ?? "";
      return url && (eventTypeUri.includes(url) || url.includes(eventTypeUri));
    }) ?? null
  );
}

function findStage(stages: string[] | null | undefined, needle: RegExp, fallback: string): string {
  return (stages ?? []).find((s) => needle.test(s)) ?? fallback;
}

export const Route = createFileRoute("/api/public/hooks/calendly")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message:
              "Calendly webhook endpoint. Configure this URL in Calendly → Integrations → Webhooks.",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

        if (signingKey) {
          const sig = request.headers.get("calendly-webhook-signature");
          if (!verifyCalendlySignature(rawBody, sig, signingKey)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = payload?.event as string;
        const data = payload?.payload ?? {};
        const invitee = data;
        const email: string | undefined = invitee?.email?.toLowerCase();
        const name: string | undefined = invitee?.name;
        const eventStartTime: string | undefined = invitee?.scheduled_event?.start_time;
        const eventTypeUri: string | undefined = invitee?.scheduled_event?.event_type;

        if (!email) {
          return new Response(JSON.stringify({ ok: false, error: "Missing email in payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const campaign = await findCampaignForEventType(eventTypeUri ?? null);

        // Find or create the contact
        let contactId: string | null = null;
        const { data: existing } = await supabaseAdmin
          .from("contacts")
          .select("id,stage,campaign_id")
          .ilike("email", email)
          .maybeSingle();

        if (existing) {
          contactId = existing.id;
        } else {
          const stage = campaign
            ? findStage(campaign.pipeline_stages, /booked/i, campaign.pipeline_stages?.[0] ?? "Lead In")
            : "Lead In";
          const { data: created, error: cErr } = await supabaseAdmin
            .from("contacts")
            .insert({
              name: name || email,
              email,
              source: "Calendly",
              stage,
              campaign_id: campaign?.id ?? null,
              last_touch_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (cErr) {
            return new Response(JSON.stringify({ ok: false, error: cErr.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          contactId = created.id;
          await supabaseAdmin.from("contact_activity").insert({
            contact_id: contactId,
            type: "created",
            description: `Auto-created from Calendly booking${campaign ? ` (${campaign.name})` : ""}`,
            created_by: "calendly",
          });
        }

        if (!contactId) return new Response("ok"); // shouldn't happen

        if (event === "invitee.created") {
          const stages = campaign?.pipeline_stages ?? ["Lead In", "Call Booked"];
          const bookedStage = findStage(stages, /booked/i, stages[1] ?? "Call Booked");
          const patch: any = {
            stage: bookedStage,
            last_touch_at: new Date().toISOString(),
          };
          if (eventStartTime) patch.next_followup_at = eventStartTime;
          if (campaign?.id && (!existing || existing.campaign_id !== campaign.id)) {
            patch.campaign_id = campaign.id;
          }

          await supabaseAdmin.from("contacts").update(patch).eq("id", contactId);
          await supabaseAdmin.from("contact_activity").insert({
            contact_id: contactId,
            type: "stage_change",
            description: `Booked Calendly call${eventStartTime ? ` for ${new Date(eventStartTime).toLocaleString()}` : ""}`,
            created_by: "calendly",
            metadata: { event_start_time: eventStartTime, event_type_uri: eventTypeUri },
          });
        } else if (event === "invitee.canceled") {
          const stages = campaign?.pipeline_stages ?? ["Lead In", "Follow Up"];
          const followUpStage = findStage(stages, /follow/i, stages[0] ?? "Lead In");
          await supabaseAdmin
            .from("contacts")
            .update({ stage: followUpStage, last_touch_at: new Date().toISOString() })
            .eq("id", contactId);
          await supabaseAdmin.from("contact_activity").insert({
            contact_id: contactId,
            type: "stage_change",
            description: `Calendly call canceled — moved to ${followUpStage}`,
            created_by: "calendly",
          });
        }

        return new Response(JSON.stringify({ ok: true, contact_id: contactId }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
