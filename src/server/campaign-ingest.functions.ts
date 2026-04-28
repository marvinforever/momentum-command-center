// Campaign auto-ingest worker.
//
// For every non-archived campaign that has a data_source configured (kajabi_form,
// meta_ads), this scans the relevant raw-data table and creates/matches a contact
// for each unique email, tagging it to the campaign at "Lead In".
//
// Triggered by:
//   1. Manual "Sync now" button on the Edit Campaign drawer
//   2. Hourly pg_cron job calling /api/public/hooks/campaign-ingest
//   3. Inline call right after the Kajabi webhook fires (low latency for new leads)

import { createServerFn } from "@tanstack/react-start";
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

  // Pull all submissions for this form. ~1k rows is fine in one shot;
  // if this grows, we can paginate by submitted_at later.
  const { data: subs, error } = await supabaseAdmin
    .from("kajabi_form_submissions")
    .select("contact_email,contact_name,submitted_at,kajabi_form_id")
    .eq("kajabi_form_id", String(formId));

  if (error) {
    result.errors.push(`Fetch submissions: ${error.message}`);
    return result;
  }

  // Dedup by lowercased email so we don't process the same person 5 times.
  const seen = new Map<string, { name: string | null; submitted_at: string | null }>();
  for (const s of subs ?? []) {
    const email = s.contact_email?.trim().toLowerCase();
    if (!email) continue;
    const existing = seen.get(email);
    // Keep the earliest submission timestamp as their first touch.
    if (!existing || (s.submitted_at && existing.submitted_at && s.submitted_at < existing.submitted_at)) {
      seen.set(email, { name: s.contact_name ?? existing?.name ?? null, submitted_at: s.submitted_at ?? existing?.submitted_at ?? null });
    } else if (!existing) {
      seen.set(email, { name: s.contact_name, submitted_at: s.submitted_at });
    }
  }

  const stage = campaign.pipeline_stages?.[0] ?? "Lead In";

  for (const [email, info] of seen) {
    try {
      const existingId = await findContactByEmail(email);

      if (existingId) {
        // Update tag if not already on this campaign
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
          description: `Tagged to ${campaign.name} via Kajabi form (${campaign.data_source_config?.form_name ?? formId})`,
          created_by: "auto-ingest",
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
          description: `Auto-created from Kajabi form (${campaign.data_source_config?.form_name ?? formId})`,
          created_by: "auto-ingest",
        });

        result.created++;
      }
    } catch (e: any) {
      result.errors.push(`${email}: ${e.message ?? String(e)}`);
    }
  }

  return result;
}

async function ingestMetaCampaign(campaign: any): Promise<IngestResult> {
  // Meta Lead Ads ingestion is a placeholder for now — the Meta sync currently
  // pulls insights/spend, not individual lead form submissions. When we add
  // /leads endpoint sync, this is where we'll match by meta_campaign_id.
  return {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    source: "meta_ads",
    matched: 0,
    created: 0,
    skipped: 0,
    errors: ["Meta Lead Ads ingestion coming soon — Meta sync currently captures spend/impressions, not individual leads. Use a Kajabi form or Calendly webhook to capture leads from your Meta ads in the meantime."],
  };
}

export const ingestCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: { campaign_id: string }) => data)
  .handler(async ({ data }) => {
    const { data: campaign, error } = await supabaseAdmin
      .from("campaigns")
      .select("id,name,data_source,data_source_config,pipeline_stages")
      .eq("id", data.campaign_id)
      .maybeSingle();

    if (error || !campaign) {
      return { ok: false, error: error?.message ?? "Campaign not found" };
    }

    let result: IngestResult;
    if (campaign.data_source === "kajabi_form") {
      result = await ingestKajabiCampaign(campaign);
    } else if (campaign.data_source === "meta_ads") {
      result = await ingestMetaCampaign(campaign);
    } else {
      return {
        ok: false,
        error: `Data source "${campaign.data_source}" doesn't support auto-ingest. Use Kajabi Form, Meta Ads, Calendly, or Generic Webhook.`,
      };
    }

    return { ok: true, result };
  });

export const ingestAllCampaigns = createServerFn({ method: "POST" }).handler(async () => {
  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,name,data_source,data_source_config,pipeline_stages")
    .eq("archived", false)
    .in("data_source", ["kajabi_form", "meta_ads"]);

  if (error) return { ok: false, error: error.message, results: [] };

  const results: IngestResult[] = [];
  for (const c of campaigns ?? []) {
    if (c.data_source === "kajabi_form") {
      results.push(await ingestKajabiCampaign(c));
    } else if (c.data_source === "meta_ads") {
      results.push(await ingestMetaCampaign(c));
    }
  }

  return { ok: true, results };
});
