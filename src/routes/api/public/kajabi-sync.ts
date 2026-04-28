// Kajabi Public API Sync
// Pulls contacts, purchases, and form submissions from Kajabi's REST API and
// upserts them into our DB — same downstream behavior as the webhook handler,
// but pull-based so we can backfill historical data.
//
// Auth: OAuth2 client_credentials flow against /v1/oauth/token, using
// KAJABI_API_KEY (client_id) + KAJABI_API_SECRET (client_secret). The
// resulting bearer token is cached in-memory until ~60s before expiry.
// Triggered from Admin → Integrations.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KAJABI_BASE = "https://api.kajabi.com/v1";
// Kajabi /contacts and /forms endpoints require a site_id filter. We discovered
// the site ID by inspecting form_submission relationships (relationships.site.data.id).
// Override via env if you ever connect a different Kajabi site.
const KAJABI_SITE_ID = process.env.KAJABI_SITE_ID ?? "11016";

type SyncResource = "contacts" | "purchases" | "form_submissions";

// In-memory token cache (per worker instance). Acceptable because tokens are
// cheap to mint and Kajabi's typical TTL is ~1h.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.KAJABI_API_KEY;
  const clientSecret = process.env.KAJABI_API_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing KAJABI_API_KEY / KAJABI_API_SECRET");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${KAJABI_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Kajabi /oauth/token → ${res.status}: ${errBody.slice(0, 400)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error(`Kajabi /oauth/token returned no access_token: ${JSON.stringify(json).slice(0, 300)}`);
  }

  const ttlMs = (json.expires_in ?? 3600) * 1000;
  cachedToken = { token: json.access_token, expiresAt: Date.now() + ttlMs };
  return json.access_token;
}

async function kajabiFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${KAJABI_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let token = await getAccessToken();
  let res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.api+json",
    },
  });

  // Token might have expired between cache check and request — retry once.
  if (res.status === 401) {
    cachedToken = null;
    token = await getAccessToken();
    res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.api+json",
      },
    });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kajabi ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Walk paginated JSON:API responses. Stop at maxPages to avoid runaway loops.
async function fetchAllPages(path: string, pageSize = 100, maxPages = 50): Promise<any[]> {
  return fetchAllPagesWithParams(path, {}, pageSize, maxPages);
}

async function fetchAllPagesWithParams(
  path: string,
  extraParams: Record<string, string>,
  pageSize = 100,
  maxPages = 50,
): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const json = await kajabiFetch(path, {
      ...extraParams,
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
  firstTouch: string | null = null,
): Promise<string | null> {
  if (!email && !kajabiContactId) return null;

  const firstTouchDate = firstTouch ? firstTouch.slice(0, 10) : null;

  if (kajabiContactId) {
    const { data: byKajabi } = await supabaseAdmin
      .from("leads")
      .select("id, first_touch_date")
      .eq("kajabi_contact_id", kajabiContactId)
      .maybeSingle();
    if (byKajabi?.id) {
      const patch: { kajabi_synced_at: string; first_touch_date?: string } = { kajabi_synced_at: new Date().toISOString() };
      // Only overwrite first_touch_date if we have a better (earlier) one.
      if (firstTouchDate && (!byKajabi.first_touch_date || firstTouchDate < byKajabi.first_touch_date)) {
        patch.first_touch_date = firstTouchDate;
      }
      await supabaseAdmin.from("leads").update(patch).eq("id", byKajabi.id);
      return byKajabi.id;
    }
  }

  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from("leads")
      .select("id, kajabi_contact_id, first_touch_date")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail?.id) {
      const patch: { kajabi_contact_id?: string; kajabi_synced_at?: string; first_touch_date?: string } = {};
      if (kajabiContactId && !byEmail.kajabi_contact_id) {
        patch.kajabi_contact_id = kajabiContactId;
        patch.kajabi_synced_at = new Date().toISOString();
      }
      if (firstTouchDate && (!byEmail.first_touch_date || firstTouchDate < byEmail.first_touch_date)) {
        patch.first_touch_date = firstTouchDate;
      }
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("leads").update(patch).eq("id", byEmail.id);
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
      first_touch_date: firstTouchDate ?? new Date().toISOString().slice(0, 10),
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
  // /contacts requires filter[site_id].
  const rows = await fetchAllPagesWithParams("/contacts", { "filter[site_id]": KAJABI_SITE_ID });
  for (const row of rows) {
    try {
      const a = row.attributes ?? {};
      const email = a.email ?? null;
      const name = a.name ?? ([a.first_name, a.last_name].filter(Boolean).join(" ") || null);
      const id = String(row.id ?? "");
      const createdAt = a.created_at ?? a.first_seen_at ?? null;
      const before = await supabaseAdmin.from("leads").select("id").eq("kajabi_contact_id", id).maybeSingle();
      const leadId = await findOrCreateLead(email, name, id, createdAt);
      if (leadId && !before.data?.id) created++;
      synced++;
    } catch (e) {
      console.error("contact sync error", e);
      errors++;
    }
  }
  return { resource: "contacts" as const, synced, created, errors };
}

// Cache so we don't refetch the same customer/offer/form/contact for every row.
const customerCache = new Map<string, { email: string | null; name: string | null }>();
const offerCache = new Map<string, { name: string | null }>();
const formCache = new Map<string, { name: string | null }>();
const contactCache = new Map<string, { created_at: string | null; email: string | null; name: string | null }>();

async function getForm(id: string): Promise<{ name: string | null }> {
  if (!id) return { name: null };
  if (formCache.has(id)) return formCache.get(id)!;
  try {
    const json = await kajabiFetch(`/forms/${id}`);
    const a = json?.data?.attributes ?? {};
    const name = a.title ?? a.name ?? null;
    const result = { name };
    formCache.set(id, result);
    return result;
  } catch (e) {
    console.error(`getForm(${id}) failed`, e);
    formCache.set(id, { name: null });
    return { name: null };
  }
}

async function getContact(id: string): Promise<{ created_at: string | null; email: string | null; name: string | null }> {
  if (!id) return { created_at: null, email: null, name: null };
  if (contactCache.has(id)) return contactCache.get(id)!;
  try {
    const json = await kajabiFetch(`/contacts/${id}`);
    const a = json?.data?.attributes ?? {};
    const result = {
      created_at: a.created_at ?? a.first_seen_at ?? null,
      email: a.email ?? null,
      name: a.name ?? [a.first_name, a.last_name].filter(Boolean).join(" ") ?? null,
    };
    contactCache.set(id, result);
    return result;
  } catch (e) {
    console.error(`getContact(${id}) failed`, e);
    contactCache.set(id, { created_at: null, email: null, name: null });
    return { created_at: null, email: null, name: null };
  }
}

async function getCustomer(id: string): Promise<{ email: string | null; name: string | null }> {
  if (!id) return { email: null, name: null };
  if (customerCache.has(id)) return customerCache.get(id)!;
  try {
    const json = await kajabiFetch(`/customers/${id}`);
    const a = json?.data?.attributes ?? {};
    const email = a.email ?? null;
    const name =
      a.name ??
      [a.first_name, a.last_name].filter(Boolean).join(" ") ??
      null;
    const result = { email, name: name || null };
    customerCache.set(id, result);
    return result;
  } catch (e) {
    console.error(`getCustomer(${id}) failed`, e);
    customerCache.set(id, { email: null, name: null });
    return { email: null, name: null };
  }
}

async function getOffer(id: string): Promise<{ name: string | null }> {
  if (!id) return { name: null };
  if (offerCache.has(id)) return offerCache.get(id)!;
  try {
    const json = await kajabiFetch(`/offers/${id}`);
    const a = json?.data?.attributes ?? {};
    const name = a.title ?? a.name ?? null;
    const result = { name };
    offerCache.set(id, result);
    return result;
  } catch (e) {
    console.error(`getOffer(${id}) failed`, e);
    offerCache.set(id, { name: null });
    return { name: null };
  }
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

      const kajabiCustomerId = String(r?.customer?.data?.id ?? r?.member?.data?.id ?? r?.contact?.data?.id ?? "") || null;
      const kajabiOfferId = String(r?.offer?.data?.id ?? "") || null;

      // Enrich from related resources (cached) so we get email/name/offer-name.
      const customer = kajabiCustomerId ? await getCustomer(kajabiCustomerId) : { email: null, name: null };
      const offerInfo = kajabiOfferId ? await getOffer(kajabiOfferId) : { name: null };

      const email = a.member_email ?? a.buyer_email ?? a.email ?? customer.email ?? null;
      const name = a.member_name ?? a.buyer_name ?? a.cardholder_name ?? customer.name ?? null;
      const offerName = a.offer_title ?? a.offer_name ?? offerInfo.name ?? null;

      // Kajabi's real field is `amount_in_cents`. Keep legacy fallbacks in case.
      const amount = Number(a.amount_in_cents ?? a.amount_cents ?? a.total_cents ?? a.price_cents ?? 0);
      const currency = a.currency ?? "USD";
      const purchasedAt = a.effective_start_at ?? a.purchased_at ?? a.created_at ?? new Date().toISOString();
      const refunded = !!a.deactivated_at || String(a.status ?? "").toLowerCase().includes("refund");

      const leadId = await findOrCreateLead(email, name, kajabiCustomerId);

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
        refunded_at: refunded ? (a.deactivated_at ?? a.refunded_at ?? new Date().toISOString()) : null,
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
  const rows = await fetchAllPages("/form_submissions");
  for (const row of rows) {
    try {
      const a = row.attributes ?? {};
      const r = row.relationships ?? {};
      const submissionId = String(row.id ?? "");
      if (!submissionId) continue;

      const kajabiFormId = (String(r?.form?.data?.id ?? "")) || null;
      const kajabiContactId = (String(r?.contact?.data?.id ?? "")) || null;

      // Kajabi's form_submissions API does NOT return a submission timestamp
      // or form title — we have to enrich from /forms/{id} and /contacts/{id}.
      // The contact's created_at is the closest proxy for when they submitted.
      const formInfo = kajabiFormId ? await getForm(kajabiFormId) : { name: null };
      const contactInfo = kajabiContactId
        ? await getContact(kajabiContactId)
        : { created_at: null, email: null, name: null };

      const email = a.email ?? a.contact_email ?? contactInfo.email ?? null;
      const name = a.name ?? a.contact_name ?? contactInfo.name ?? null;
      const formName = a.form_title ?? a.form_name ?? formInfo.name ?? null;
      const submittedAt =
        a.submitted_at ?? a.created_at ?? contactInfo.created_at ?? null;

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
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: "Kajabi sync endpoint. Trigger from Admin → Integrations → 'Kajabi Direct API Sync'. POST to this URL with ?resource=contacts|purchases|form_submissions|all to run a sync.",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        ),
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
