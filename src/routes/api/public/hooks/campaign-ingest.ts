// Cron-triggered endpoint that runs auto-ingest for every campaign with a
// configured data source. Called hourly by pg_cron — see the matching schedule
// in the Supabase dashboard.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type IngestResult = {
  campaign_id: string;
  campaign_name: string;
  source: string;
  matched: number;
  created: number;
  skipped: number;
  errors: string[];
};

async function findContactByEmail(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

async function ingestKajabiCampaign(campaign: any): Promise<IngestResult> {
  const result: IngestResult = {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    source: "kajabi_form",
    matched: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };

  const formId = campaign.data_source_config?.kajabi_form_id;
  if (!formId) {
    result.errors.push("No kajabi_form_id configured");
    return result;
  }

  const { data: subs, error } = await supabaseAdmin
    .from("kajabi_form_submissions")
    .select("contact_email,contact_name,submitted_at,kajabi_form_id")
    .eq("kajabi_form_id", String(formId));

  if (error) {
    result.errors.push(`Fetch submissions: ${error.message}`);
    return result;
  }

  const seen = new Map<string, { name: string | null; submitted_at: string | null }>();
  for (const s of subs ?? []) {
    const email = s.contact_email?.trim().toLowerCase();
    if (!email) continue;
    const existing = seen.get(email);
    if (!existing) {
      seen.set(email, { name: s.contact_name, submitted_at: s.submitted_at });
    } else if (s.submitted_at && existing.submitted_at && s.submitted_at < existing.submitted_at) {
      seen.set(email, { name: s.contact_name ?? existing.name, submitted_at: s.submitted_at });
    }
  }

  const stage = campaign.pipeline_stages?.[0] ?? "Lead In";

  for (const [email, info] of seen) {
    try {
      const existingId = await findContactByEmail(email);
      if (existingId) {
        const { data: current } = await supabaseAdmin
          .from("contacts")
          .select("campaign_id")
          .eq("id", existingId)
          .maybeSingle();

        if (current?.campaign_id === campaign.id) {
          result.skipped++;
          continue;
        }

        await supabaseAdmin
          .from("contacts")
          .update({
            campaign_id: campaign.id,
            last_touch_at: info.submitted_at ?? new Date().toISOString(),
          })
          .eq("id", existingId);

        await supabaseAdmin.from("contact_activity").insert({
          contact_id: existingId,
          type: "campaign_tagged",
          description: `Tagged to ${campaign.name} via Kajabi form`,
          created_by: "cron",
        });
        result.matched++;
      } else {
        const { data: created, error: insertErr } = await supabaseAdmin
          .from("contacts")
          .insert({
            name: info.name || email,
            email,
            source: "Kajabi",
            stage,
            campaign_id: campaign.id,
            last_touch_at: info.submitted_at ?? new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertErr) {
          result.errors.push(`${email}: ${insertErr.message}`);
          continue;
        }

        await supabaseAdmin.from("contact_activity").insert({
          contact_id: created.id,
          type: "created",
          description: `Auto-created from Kajabi form`,
          created_by: "cron",
        });
        result.created++;
      }
    } catch (e: any) {
      result.errors.push(`${email}: ${e.message ?? String(e)}`);
    }
  }

  return result;
}

export const Route = createFileRoute("/api/public/hooks/campaign-ingest")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({ ok: true, message: "POST to run hourly campaign ingest" }),
          { headers: { "Content-Type": "application/json" } },
        ),
      POST: async () => {
        const { data: campaigns, error } = await supabaseAdmin
          .from("campaigns")
          .select("id,name,data_source,data_source_config,pipeline_stages")
          .eq("archived", false)
          .eq("data_source", "kajabi_form");

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: IngestResult[] = [];
        for (const c of campaigns ?? []) {
          results.push(await ingestKajabiCampaign(c));
        }

        return new Response(
          JSON.stringify({
            ok: true,
            ran_at: new Date().toISOString(),
            campaigns_processed: results.length,
            results,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
