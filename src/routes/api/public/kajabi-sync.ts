// Kajabi Direct API Sync
// Pulls contacts, purchases, and form submissions from Kajabi's REST API and
// upserts them into our DB — same downstream behavior as the webhook handler,
// but pull-based so we can backfill historical data.
//
// Auth: HTTP Basic with KAJABI_API_KEY:KAJABI_API_SECRET.
// Triggered from Admin → Integrations.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KAJABI_BASE = "https://api.kajabi.com/v1";

type SyncResource = "contacts" | "purchases" | "form_submissions";

function authHeader(): string {
  const key = process.env.KAJABI_API_KEY;
  const secret = process.env.KAJABI_API_SECRET;
  if (!key || !secret) throw new Error("Missing KAJABI_API_KEY / KAJABI_API_SECRET");
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

async function kajabiFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${KAJABI_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: authHeader(),
      Accept: "application/vnd.api+json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kajabi ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Walk paginated JSON:API responses. Stop at maxPages to avoid runaway loops.
async function fetchAllPages(path: string, pageSize = 100, maxPages = 50): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const json = await kajabiFetch(path, {
      "page[size]": String(pageSize),
      "page[number]": String(page),
    });
    const data = json?.data ?? [];
    if (Array.isArray(data)) all.push(...data);
    if (!Array.isArray(data) || data.length < pageSize) break;
  }
  return all;
}

// ---------- lead matcher (same logic as webhook handler) ----------
async function findOrCreateLead(
  email: string | null,
  name: string | null,
  kajabiContactId: string | null,
): Promise<string | null> {
  if (!email && !kajabiContactId) return null;

  if (kajabiContactId) {
    const { data: byKajabi } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("kajabi_contact_id", kajabiContactId)
      .maybeSingle();
    if (byKajabi?.id) {
      await supabaseAdmin.from("leads")
        .update({ kajabi_synced_at: new Date().toISOString() })
        .eq("id", byKajabi.id);
      return byKajabi.id;
    }
  }

  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from("leads")
      .select("id, kajabi_contact_id")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail?.id) {
      if (kajabiContactId && !byEmail.kajabi_contact_id) {
        await supabaseAdmin.from("leads").update({
          kajabi_contact_id: kajabiContactId,
          kajabi_synced_at: new Date().toISOString(),
        }).eq("id", byEmail.id);
      }
      return byEmail.id;
    }
  }

  const { data: created, error } = await supabaseAdmin
    .from("leads")
    .insert({
      name: name || email || "Kajabi contact",
      email,
      lead_source: "Kajabi",
      status: "New",
      kajabi_contact_id: kajabiContactId,
      kajabi_synced_at: new Date().toISOString(),
      first_touch_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error) {
    console.error("findOrCreateLead insert error", error);
    return null;
  }
  return created.id;
}

// ---------- per-resource sync ----------
async function syncContacts() {
  let synced = 0, created = 0, errors = 0;
  const rows = await fetchAllPages("/contacts");
  for (const row of rows) {
    try {
      const a = row.attributes ?? {};
      const email = a.email ?? null;
      const name = a.name ?? ([a.first_name, a.last_name].filter(Boolean).join(" ") || null);
      const id = String(row.id ?? "");
      const before = await supabaseAdmin.from("leads").select("id").eq("kajabi_contact_id", id).maybeSingle();
      const leadId = await findOrCreateLead(email, name, id);
      if (leadId && !before.data?.id) created++;
      synced++;
    } catch (e) {
      console.error("contact sync error", e);
      errors++;
    }
  }
  return { resource: "contacts" as const, synced, created, errors };
}

async function syncPurchases() {
  let synced = 0, errors = 0;
  const rows = await fetchAllPages("/purchases");
  for (const row of rows) {
    try {
      const a = row.attributes ?? {};
      const r = row.relationships ?? {};
      const purchaseId = String(row.id ?? "");
      if (!purchaseId) continue;

      const kajabiContactId = String(r?.member?.data?.id ?? r?.contact?.data?.id ?? "") || null;
      const kajabiOfferId = String(r?.offer?.data?.id ?? "") || null;
      const email = a.member_email ?? a.buyer_email ?? a.email ?? null;
      const name = a.member_name ?? a.buyer_name ?? null;
      const offerName = a.offer_title ?? a.offer_name ?? null;
      const amount = Number(a.amount_cents ?? a.total_cents ?? a.price_cents ?? 0);
      const currency = a.currency ?? "USD";
      const purchasedAt = a.purchased_at ?? a.created_at ?? new Date().toISOString();
      const refunded = String(a.status ?? "").toLowerCase().includes("refund");

      const leadId = await findOrCreateLead(email, name, kajabiContactId);

      let offerUuid: string | null = null;
      if (kajabiOfferId) {
        const { data: offer } = await supabaseAdmin
          .from("offers").select("id").eq("kajabi_offer_id", kajabiOfferId).maybeSingle();
        offerUuid = offer?.id ?? null;
      }

      await supabaseAdmin.from("kajabi_purchases").upsert({
        kajabi_purchase_id: purchaseId,
        kajabi_offer_id: kajabiOfferId,
        offer_id: offerUuid,
        lead_id: leadId,
        buyer_email: email,
        buyer_name: name,
        offer_name: offerName,
        amount_cents: Math.round(amount),
        currency,
        status: refunded ? "refunded" : "completed",
        purchased_at: purchasedAt,
        refunded_at: refunded ? (a.refunded_at ?? new Date().toISOString()) : null,
        raw: row,
      }, { onConflict: "kajabi_purchase_id" });
      synced++;
    } catch (e) {
      console.error("purchase sync error", e);
      errors++;
    }
  }
  return { resource: "purchases" as const, synced, errors };
}

async function syncFormSubmissions() {
  let synced = 0, errors = 0;
  for await (const page of paginate("/form_submissions")) {
    for (const row of page.data) {
      try {
        const a = row.attributes ?? {};
        const r = row.relationships ?? {};
        const submissionId = String(row.id ?? "");
        if (!submissionId) continue;

        const email = a.email ?? a.contact_email ?? null;
        const name = a.name ?? a.contact_name ?? null;
        const formName = a.form_title ?? a.form_name ?? null;
        const kajabiFormId = String(r?.form?.data?.id ?? "") || null;
        const kajabiContactId = String(r?.contact?.data?.id ?? "") || null;
        const submittedAt = a.submitted_at ?? a.created_at ?? new Date().toISOString();

        const leadId = await findOrCreateLead(email, name, kajabiContactId);

        let leadMagnetId: string | null = null;
        if (formName) {
          const { data: magnet } = await supabaseAdmin
            .from("lead_magnets").select("id")
            .ilike("name", `%${String(formName).slice(0, 40)}%`).maybeSingle();
          leadMagnetId = magnet?.id ?? null;
        }

        await supabaseAdmin.from("kajabi_form_submissions").upsert({
          kajabi_submission_id: submissionId,
          form_name: formName,
          kajabi_form_id: kajabiFormId,
          lead_magnet_id: leadMagnetId,
          lead_id: leadId,
          contact_email: email,
          contact_name: name,
          submitted_at: submittedAt,
          raw: row,
        }, { onConflict: "kajabi_submission_id" });
        synced++;
      } catch (e) {
        console.error("form sync error", e);
        errors++;
      }
    }
  }
  return { resource: "form_submissions" as const, synced, errors };
}

// ---------- route ----------
export const Route = createFileRoute("/api/public/kajabi-sync")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const resourceParam = (url.searchParams.get("resource") ?? "all") as SyncResource | "all";

        const results: any[] = [];
        const errors: any[] = [];

        const tasks: Array<{ name: SyncResource; fn: () => Promise<any> }> = [];
        if (resourceParam === "contacts" || resourceParam === "all") tasks.push({ name: "contacts", fn: syncContacts });
        if (resourceParam === "purchases" || resourceParam === "all") tasks.push({ name: "purchases", fn: syncPurchases });
        if (resourceParam === "form_submissions" || resourceParam === "all") tasks.push({ name: "form_submissions", fn: syncFormSubmissions });

        for (const t of tasks) {
          try {
            results.push(await t.fn());
          } catch (e: any) {
            console.error(`Kajabi sync ${t.name} failed:`, e);
            errors.push({ resource: t.name, error: String(e?.message ?? e) });
          }
        }

        return new Response(
          JSON.stringify({ ok: errors.length === 0, results, errors }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      },
    },
  },
});
