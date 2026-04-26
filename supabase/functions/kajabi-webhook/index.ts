// Kajabi Webhook Receiver
// Listens for Kajabi events (contact.created, purchase.created, purchase.refunded,
// form_submission.created) and writes them into our DB.
//
// Security: every request body is HMAC-SHA256 signed with KAJABI_WEBHOOK_SECRET.
// We compare signatures with timing-safe equals before doing anything.
//
// verify_jwt = false (configured in supabase/config.toml) so Kajabi can call this
// without an auth header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-kajabi-signature, x-kajabi-event",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- crypto helpers ----------
async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Kajabi sends signatures as raw hex; some configs prefix with "sha256=". Strip both.
function normalizeSignature(raw: string | null): string {
  if (!raw) return "";
  return raw.trim().replace(/^sha256=/i, "").toLowerCase();
}

// ---------- types ----------
type SB = any;

// ---------- handlers per event type ----------
async function findOrCreateLead(
  sb: SB,
  email: string | null,
  name: string | null,
  kajabiContactId: string | null,
): Promise<string | null> {
  if (!email && !kajabiContactId) return null;

  // 1. Try by kajabi_contact_id
  if (kajabiContactId) {
    const { data: byKajabi } = await sb
      .from("leads")
      .select("id")
      .eq("kajabi_contact_id", kajabiContactId)
      .maybeSingle();
    if (byKajabi?.id) {
      // touch sync time
      await sb.from("leads").update({ kajabi_synced_at: new Date().toISOString() }).eq("id", byKajabi.id);
      return byKajabi.id as string;
    }
  }

  // 2. Try by email
  if (email) {
    const { data: byEmail } = await sb
      .from("leads")
      .select("id, kajabi_contact_id")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail?.id) {
      // attach kajabi id if we have one and the row didn't
      if (kajabiContactId && !byEmail.kajabi_contact_id) {
        await sb.from("leads").update({
          kajabi_contact_id: kajabiContactId,
          kajabi_synced_at: new Date().toISOString(),
        }).eq("id", byEmail.id);
      }
      return byEmail.id as string;
    }
  }

  // 3. Create new
  const { data: created, error } = await sb
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
  return created.id as string;
}

// Pluck a value from a payload using a list of possible paths (Kajabi schemas
// vary slightly across event types).
function pick(obj: any, ...paths: string[]): any {
  for (const path of paths) {
    const parts = path.split(".");
    let cur = obj;
    let ok = true;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}

async function handleContactCreated(sb: SB, payload: any) {
  const c = payload.payload ?? payload.data ?? payload.contact ?? payload;
  const email = pick(c, "email", "attributes.email") ?? null;
  const name = pick(c, "name", "full_name", "attributes.name") ?? null;
  const id = String(pick(c, "id", "contact_id", "attributes.id") ?? "") || null;
  await findOrCreateLead(sb, email, name, id);
}

async function handlePurchase(sb: SB, payload: any, refunded: boolean) {
  const p = payload.payload ?? payload.data ?? payload.purchase ?? payload;
  const purchaseId = String(pick(p, "id", "purchase_id", "attributes.id") ?? "");
  if (!purchaseId) throw new Error("purchase event missing id");

  const email = pick(p, "member.email", "buyer.email", "email", "contact.email") ?? null;
  const name = pick(p, "member.name", "buyer.name", "name", "contact.name") ?? null;
  const kajabiContactId = String(
    pick(p, "member.id", "contact.id", "contact_id", "buyer.id") ?? "",
  ) || null;
  const kajabiOfferId = String(pick(p, "offer.id", "offer_id", "attributes.offer_id") ?? "") || null;
  const offerName = pick(p, "offer.title", "offer.name", "offer_name") ?? null;
  const amount = Number(pick(p, "amount_cents", "amount", "price_cents", "total_cents") ?? 0);
  const currency = pick(p, "currency", "currency_code") ?? "USD";
  const purchasedAt = pick(p, "purchased_at", "created_at", "completed_at") ?? new Date().toISOString();

  const leadId = await findOrCreateLead(sb, email, name, kajabiContactId);

  // Map to one of our offers if we know the kajabi offer id
  let offerUuid: string | null = null;
  if (kajabiOfferId) {
    const { data: offer } = await sb
      .from("offers")
      .select("id")
      .eq("kajabi_offer_id", kajabiOfferId)
      .maybeSingle();
    offerUuid = offer?.id ?? null;
  }

  await sb.from("kajabi_purchases").upsert({
    kajabi_purchase_id: purchaseId,
    kajabi_offer_id: kajabiOfferId,
    offer_id: offerUuid,
    lead_id: leadId,
    buyer_email: email,
    buyer_name: name,
    offer_name: offerName,
    amount_cents: Math.round(amount), // Kajabi sometimes sends dollars; safe to round
    currency,
    status: refunded ? "refunded" : "completed",
    purchased_at: purchasedAt,
    refunded_at: refunded ? new Date().toISOString() : null,
    raw: payload,
  }, { onConflict: "kajabi_purchase_id" });
}

async function handleFormSubmission(sb: SB, payload: any) {
  const f = payload.payload ?? payload.data ?? payload.form_submission ?? payload;
  const submissionId = String(pick(f, "id", "submission_id", "attributes.id") ?? "");
  if (!submissionId) throw new Error("form_submission event missing id");

  const email = pick(f, "email", "contact.email", "fields.email") ?? null;
  const name = pick(f, "name", "contact.name", "fields.name") ?? null;
  const formName = pick(f, "form.title", "form.name", "form_title", "form_name") ?? null;
  const kajabiFormId = String(pick(f, "form.id", "form_id") ?? "") || null;
  const kajabiContactId = String(pick(f, "contact.id", "contact_id") ?? "") || null;
  const submittedAt = pick(f, "submitted_at", "created_at") ?? new Date().toISOString();

  const leadId = await findOrCreateLead(sb, email, name, kajabiContactId);

  // Try to match a lead magnet by form name (loose)
  let leadMagnetId: string | null = null;
  if (formName) {
    const { data: magnet } = await sb
      .from("lead_magnets")
      .select("id")
      .ilike("name", `%${String(formName).slice(0, 40)}%`)
      .maybeSingle();
    leadMagnetId = magnet?.id ?? null;
  }

  await sb.from("kajabi_form_submissions").upsert({
    kajabi_submission_id: submissionId,
    form_name: formName,
    kajabi_form_id: kajabiFormId,
    lead_magnet_id: leadMagnetId,
    lead_id: leadId,
    contact_email: email,
    contact_name: name,
    submitted_at: submittedAt,
    raw: payload,
  }, { onConflict: "kajabi_submission_id" });

  // If we matched a lead magnet, bump its total_downloads counter.
  if (leadMagnetId) {
    const { data: lm } = await sb.from("lead_magnets").select("total_downloads").eq("id", leadMagnetId).maybeSingle();
    const cur = Number(lm?.total_downloads ?? 0);
    await sb.from("lead_magnets").update({ total_downloads: cur + 1 }).eq("id", leadMagnetId);
  }
}

// ---------- main handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const secret = Deno.env.get("KAJABI_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceKey) {
    console.error("Missing KAJABI_WEBHOOK_SECRET / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Read raw body BEFORE parsing (signature is over the raw bytes)
  const rawBody = await req.text();
  const sigHeader = normalizeSignature(
    req.headers.get("x-kajabi-signature") ??
      req.headers.get("x-hub-signature-256") ??
      req.headers.get("x-signature"),
  );
  const expected = await hmacSha256Hex(secret, rawBody);
  const sigValid = !!sigHeader && timingSafeEqual(sigHeader, expected);

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { /* keep {} */ }

  const eventType =
    req.headers.get("x-kajabi-event") ??
    payload.event ??
    payload.type ??
    payload.event_type ??
    "unknown";

  // Always log the raw event (whether signature is valid or not) so the user
  // can see what's hitting them on the Integrations page.
  const { data: logRow } = await sb.from("kajabi_webhook_events").insert({
    event_type: String(eventType),
    signature_valid: sigValid,
    payload,
    processed: false,
  }).select("id").single();

  if (!sigValid) {
    return new Response(JSON.stringify({ ok: false, error: "invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    switch (String(eventType)) {
      case "contact.created":
      case "contact.updated":
        await handleContactCreated(sb, payload);
        break;
      case "purchase.created":
      case "purchase.completed":
        await handlePurchase(sb, payload, false);
        break;
      case "purchase.refunded":
      case "purchase.cancelled":
        await handlePurchase(sb, payload, true);
        break;
      case "form_submission.created":
      case "form.submitted":
        await handleFormSubmission(sb, payload);
        break;
      default:
        // Unknown event — already logged, just acknowledge.
        if (logRow?.id) {
          await sb.from("kajabi_webhook_events").update({
            processed: true,
            error: `unhandled event type: ${eventType}`,
          }).eq("id", logRow.id);
        }
        return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (logRow?.id) {
      await sb.from("kajabi_webhook_events").update({ processed: true }).eq("id", logRow.id);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("kajabi-webhook handler error", err);
    if (logRow?.id) {
      await sb.from("kajabi_webhook_events").update({
        processed: false,
        error: String((err as Error)?.message ?? err),
      }).eq("id", logRow.id);
    }
    return new Response(JSON.stringify({ ok: false, error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
