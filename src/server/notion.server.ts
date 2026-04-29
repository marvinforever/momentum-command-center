// Server-only Notion client helpers. NEVER import from client code.
// Uses the OAuth access_token stored on the notion_connections row.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export type NotionConnection = {
  id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  bot_id: string | null;
  access_token: string;
  calls_database_id: string | null;
  leads_database_id: string | null;
  calls_property_map: Record<string, { name: string; type: string }> | null;
  leads_property_map: Record<string, { name: string; type: string }> | null;
  enabled: boolean;
};

export async function getActiveConnection(): Promise<NotionConnection | null> {
  const { data, error } = await supabaseAdmin
    .from("notion_connections")
    .select("*")
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Notion connection: ${error.message}`);
  return (data as unknown as NotionConnection) ?? null;
}

async function notionFetch(
  conn: NotionConnection,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.access_token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: unknown }).message)
        : `HTTP ${res.status}`;
    throw new Error(`Notion API ${res.status}: ${msg}`);
  }
  return body;
}

// ---------- OAuth token exchange ----------
export async function exchangeOAuthCode(
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  workspace_id: string;
  workspace_name?: string;
  workspace_icon?: string;
  bot_id?: string;
  owner?: unknown;
}> {
  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Notion OAuth credentials are not configured");
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${NOTION_API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `Notion token exchange failed: ${JSON.stringify(json)}`,
    );
  }
  return json as never;
}

// ---------- Database discovery ----------
export type NotionDatabaseSummary = {
  id: string;
  title: string;
  icon: string | null;
  properties: Record<string, { name: string; type: string }>;
};

export async function listAccessibleDatabases(
  conn: NotionConnection,
): Promise<NotionDatabaseSummary[]> {
  const out: NotionDatabaseSummary[] = [];
  let cursor: string | undefined;
  do {
    const body = (await notionFetch(conn, "/search", {
      method: "POST",
      body: JSON.stringify({
        filter: { property: "object", value: "database" },
        page_size: 100,
        start_cursor: cursor,
      }),
    })) as { results?: unknown[]; has_more?: boolean; next_cursor?: string };

    for (const r of body.results ?? []) {
      const db = r as {
        id: string;
        title?: { plain_text?: string }[];
        icon?: { emoji?: string; external?: { url?: string }; file?: { url?: string } };
        properties?: Record<string, { type: string }>;
      };
      const title = (db.title ?? [])
        .map((t) => t.plain_text ?? "")
        .join("")
        .trim() || "(untitled)";
      const icon =
        db.icon?.emoji ??
        db.icon?.external?.url ??
        db.icon?.file?.url ??
        null;
      const properties: Record<string, { name: string; type: string }> = {};
      for (const [name, p] of Object.entries(db.properties ?? {})) {
        properties[name] = { name, type: p.type };
      }
      out.push({ id: db.id, title, icon, properties });
    }
    cursor = body.has_more ? body.next_cursor : undefined;
  } while (cursor);
  return out;
}

export async function getDatabaseSchema(
  conn: NotionConnection,
  databaseId: string,
): Promise<NotionDatabaseSummary> {
  const db = (await notionFetch(conn, `/databases/${databaseId}`)) as {
    id: string;
    title?: { plain_text?: string }[];
    icon?: { emoji?: string; external?: { url?: string }; file?: { url?: string } };
    properties: Record<string, { type: string }>;
  };
  const title = (db.title ?? [])
    .map((t) => t.plain_text ?? "")
    .join("")
    .trim() || "(untitled)";
  const icon =
    db.icon?.emoji ??
    db.icon?.external?.url ??
    db.icon?.file?.url ??
    null;
  const properties: Record<string, { name: string; type: string }> = {};
  for (const [name, p] of Object.entries(db.properties ?? {})) {
    properties[name] = { name, type: p.type };
  }
  return { id: db.id, title, icon, properties };
}

// ---------- Property value builders ----------
// Build a Notion property value from a Lovable field, given the target Notion type.
// Returns null when the value should be skipped (empty + non-required).
function buildProperty(
  notionType: string,
  value: unknown,
): unknown | null {
  if (value === null || value === undefined || value === "") return null;
  const str = typeof value === "string" ? value : String(value);
  switch (notionType) {
    case "title":
      return { title: [{ type: "text", text: { content: str.slice(0, 2000) } }] };
    case "rich_text":
      return { rich_text: [{ type: "text", text: { content: str.slice(0, 2000) } }] };
    case "number": {
      const n = typeof value === "number" ? value : Number(str);
      return Number.isFinite(n) ? { number: n } : null;
    }
    case "select":
      return { select: { name: str.slice(0, 100) } };
    case "status":
      return { status: { name: str.slice(0, 100) } };
    case "multi_select": {
      const arr = Array.isArray(value) ? value : [str];
      return {
        multi_select: arr
          .filter((v) => v !== null && v !== undefined && v !== "")
          .map((v) => ({ name: String(v).slice(0, 100) })),
      };
    }
    case "date":
      return { date: { start: str } };
    case "checkbox":
      return { checkbox: Boolean(value) };
    case "url":
      return { url: str };
    case "email":
      return { email: str };
    case "phone_number":
      return { phone_number: str };
    default:
      // Unsupported type — skip silently
      return null;
  }
}

// Apply a mapping: { lovable_field: { name, type } } against a record of values.
function applyMap(
  map: Record<string, { name: string; type: string }> | null,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!map) return out;
  for (const [field, meta] of Object.entries(map)) {
    if (!meta?.name || !meta?.type) continue;
    const v = values[field];
    const built = buildProperty(meta.type, v);
    if (built !== null) out[meta.name] = built;
  }
  return out;
}

// ---------- Upsert helpers ----------
async function upsertPage(
  conn: NotionConnection,
  databaseId: string,
  existingPageId: string | null,
  properties: Record<string, unknown>,
): Promise<{ pageId: string; action: "create" | "update" }> {
  if (existingPageId) {
    try {
      await notionFetch(conn, `/pages/${existingPageId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      });
      return { pageId: existingPageId, action: "update" };
    } catch (e) {
      // If the page was deleted/archived in Notion, fall through to create
      const msg = e instanceof Error ? e.message : String(e);
      if (!/404|not found|archived/i.test(msg)) throw e;
    }
  }
  const created = (await notionFetch(conn, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  })) as { id: string };
  return { pageId: created.id, action: "create" };
}

// ---------- Mirror discovery_call ----------
export async function mirrorDiscoveryCall(callId: string): Promise<{
  ok: boolean;
  pageId?: string;
  action?: string;
  error?: string;
}> {
  const conn = await getActiveConnection();
  if (!conn || !conn.enabled || !conn.calls_database_id) {
    return { ok: false, error: "Notion not connected or calls database not configured" };
  }

  const { data: call, error } = await supabaseAdmin
    .from("discovery_calls")
    .select("*, lead:lead_id(name,email), offer:offer_id(name)")
    .eq("id", callId)
    .maybeSingle();
  if (error || !call) {
    return { ok: false, error: error?.message ?? "Call not found" };
  }

  const c = call as Record<string, unknown> & {
    lead?: { name?: string; email?: string } | null;
    offer?: { name?: string } | null;
  };

  const values: Record<string, unknown> = {
    name: c.name,
    call_date: c.call_date,
    fu_date: c.fu_date,
    call_type: c.call_type,
    status: c.status,
    fit_rating: c.fit_rating,
    lead_source: c.lead_source,
    location: c.location,
    role_position: c.role_position,
    follow_up_actions: c.follow_up_actions,
    notes: c.notes,
    offer: c.offer?.name ?? null,
    lead: c.lead?.name ?? null,
    lead_email: c.lead?.email ?? null,
    lovable_id: c.id,
  };

  const properties = applyMap(conn.calls_property_map, values);

  // Sanity: must have at least the title property
  const hasTitle = Object.values(properties).some(
    (p) => typeof p === "object" && p !== null && "title" in (p as object),
  );
  if (!hasTitle) {
    const errMsg =
      "Notion sync skipped: no title property mapped (map at least one Lovable field to your Notion title column).";
    await supabaseAdmin.from("notion_sync_log").insert({
      resource_type: "discovery_call",
      resource_id: callId,
      action: "skip",
      success: false,
      error: errMsg,
    });
    return { ok: false, error: errMsg };
  }

  try {
    const { pageId, action } = await upsertPage(
      conn,
      conn.calls_database_id,
      (c.notion_page_id as string | null) ?? null,
      properties,
    );
    await supabaseAdmin
      .from("discovery_calls")
      .update({ notion_page_id: pageId, notion_synced_at: new Date().toISOString() })
      .eq("id", callId);
    await supabaseAdmin.from("notion_sync_log").insert({
      resource_type: "discovery_call",
      resource_id: callId,
      notion_page_id: pageId,
      action,
      success: true,
    });
    return { ok: true, pageId, action };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("notion_sync_log").insert({
      resource_type: "discovery_call",
      resource_id: callId,
      action: "create",
      success: false,
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

// ---------- Mirror lead ----------
export async function mirrorLead(leadId: string): Promise<{
  ok: boolean;
  pageId?: string;
  action?: string;
  error?: string;
}> {
  const conn = await getActiveConnection();
  if (!conn || !conn.enabled || !conn.leads_database_id) {
    return { ok: false, error: "Notion not connected or leads database not configured" };
  }

  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !lead) {
    return { ok: false, error: error?.message ?? "Lead not found" };
  }

  const l = lead as Record<string, unknown>;

  const values: Record<string, unknown> = {
    name: l.name,
    email: l.email,
    phone: l.phone,
    first_touch_date: l.first_touch_date,
    lead_source: l.lead_source,
    status: l.status,
    utm_source: l.utm_source,
    utm_medium: l.utm_medium,
    utm_campaign: l.utm_campaign,
    how_did_you_hear: l.how_did_you_hear,
    notes: l.notes,
    lovable_id: l.id,
  };

  const properties = applyMap(conn.leads_property_map, values);
  const hasTitle = Object.values(properties).some(
    (p) => typeof p === "object" && p !== null && "title" in (p as object),
  );
  if (!hasTitle) {
    const errMsg = "Notion sync skipped: no title property mapped for leads.";
    await supabaseAdmin.from("notion_sync_log").insert({
      resource_type: "lead",
      resource_id: leadId,
      action: "skip",
      success: false,
      error: errMsg,
    });
    return { ok: false, error: errMsg };
  }

  try {
    const { pageId, action } = await upsertPage(
      conn,
      conn.leads_database_id,
      (l.notion_page_id as string | null) ?? null,
      properties,
    );
    await supabaseAdmin
      .from("leads")
      .update({ notion_page_id: pageId, notion_synced_at: new Date().toISOString() })
      .eq("id", leadId);
    await supabaseAdmin.from("notion_sync_log").insert({
      resource_type: "lead",
      resource_id: leadId,
      notion_page_id: pageId,
      action,
      success: true,
    });
    return { ok: true, pageId, action };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("notion_sync_log").insert({
      resource_type: "lead",
      resource_id: leadId,
      action: "create",
      success: false,
      error: msg,
    });
    return { ok: false, error: msg };
  }
}


// ---------- Notion → Lovable: read property values ----------
function readProperty(prop: unknown): unknown {
  if (!prop || typeof prop !== "object") return null;
  const p = prop as { type?: string } & Record<string, unknown>;
  switch (p.type) {
    case "title":
    case "rich_text": {
      const arr = (p[p.type] as { plain_text?: string }[] | undefined) ?? [];
      const txt = arr.map((t) => t.plain_text ?? "").join("").trim();
      return txt || null;
    }
    case "number":
      return (p.number as number | null) ?? null;
    case "select": {
      const s = p.select as { name?: string } | null;
      return s?.name ?? null;
    }
    case "status": {
      const s = p.status as { name?: string } | null;
      return s?.name ?? null;
    }
    case "multi_select": {
      const arr = (p.multi_select as { name?: string }[] | undefined) ?? [];
      return arr.map((s) => s.name).filter(Boolean);
    }
    case "date": {
      const d = p.date as { start?: string } | null;
      return d?.start ?? null;
    }
    case "checkbox":
      return Boolean(p.checkbox);
    case "url":
      return (p.url as string | null) ?? null;
    case "email":
      return (p.email as string | null) ?? null;
    case "phone_number":
      return (p.phone_number as string | null) ?? null;
    case "people": {
      const arr = (p.people as { name?: string }[] | undefined) ?? [];
      return arr.map((u) => u.name).filter(Boolean).join(", ") || null;
    }
    case "formula": {
      const f = p.formula as { type?: string } & Record<string, unknown>;
      if (!f) return null;
      return (f[f.type ?? ""] as unknown) ?? null;
    }
    default:
      return null;
  }
}

async function queryAllDatabasePages(
  conn: NotionConnection,
  databaseId: string,
): Promise<Array<{ id: string; properties: Record<string, unknown>; last_edited_time?: string }>> {
  const out: Array<{ id: string; properties: Record<string, unknown>; last_edited_time?: string }> = [];
  let cursor: string | undefined;
  do {
    const body = (await notionFetch(conn, `/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    })) as { results?: unknown[]; has_more?: boolean; next_cursor?: string };
    for (const r of body.results ?? []) {
      const page = r as { id: string; properties?: Record<string, unknown>; last_edited_time?: string };
      out.push({ id: page.id, properties: page.properties ?? {}, last_edited_time: page.last_edited_time });
    }
    cursor = body.has_more ? body.next_cursor : undefined;
  } while (cursor);
  return out;
}

// Coerce an arbitrary Notion-derived value to the right shape for a
// discovery_calls column. Returns null if the value is empty/unusable.
function coerceForCallColumn(field: string, value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  switch (field) {
    case "fit_rating": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? Math.round(n) : null;
    }
    case "call_date":
    case "fu_date": {
      const s = String(value);
      // Notion gives ISO date or datetime; store DATE
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
      return m ? m[1] : null;
    }
    case "follow_up_actions": {
      if (Array.isArray(value)) return value.map(String);
      return [String(value)];
    }
    default:
      return typeof value === "string" ? value : String(value);
  }
}

// ---------- Import calls FROM Notion INTO discovery_calls ----------
export async function importCallsFromNotion(): Promise<{
  ok: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const conn = await getActiveConnection();
  if (!conn || !conn.calls_database_id) {
    return {
      ok: false,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: ["Notion not connected or calls database not configured"],
    };
  }
  const map = conn.calls_property_map ?? {};
  // Ensure 'name' is mapped (required title)
  if (!map.name?.name) {
    return {
      ok: false,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: ["The 'Name' field is not mapped — cannot import without a title."],
    };
  }

  let pages: Awaited<ReturnType<typeof queryAllDatabasePages>>;
  try {
    pages = await queryAllDatabasePages(conn, conn.calls_database_id);
  } catch (e) {
    return {
      ok: false,
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [e instanceof Error ? e.message : String(e)],
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  // Find the title property name from the page (Notion always has exactly one)
  const findTitlePropName = (props: Record<string, unknown>): string | null => {
    for (const [k, v] of Object.entries(props)) {
      if (v && typeof v === "object" && (v as { type?: string }).type === "title") return k;
    }
    return null;
  };

  for (const page of pages) {
    try {
      // Build a row from the mapping
      const row: Record<string, unknown> = { notion_page_id: page.id };
      for (const [field, meta] of Object.entries(map)) {
        if (!meta?.name) continue;
        const raw = readProperty(page.properties[meta.name]);
        const coerced = coerceForCallColumn(field, raw);
        if (coerced !== null) row[field] = coerced;
      }

      // Always derive `name` (NOT NULL) from the Notion title property,
      // regardless of how the user mapped fields.
      if (!row.name) {
        const titleProp = findTitlePropName(page.properties);
        const titleVal = titleProp ? readProperty(page.properties[titleProp]) : null;
        if (titleVal) row.name = String(titleVal);
      }
      if (!row.name) {
        skipped++;
        continue;
      }
      row.notion_synced_at = new Date().toISOString();

      // ----- CRM mirror: upsert a contact for this call -----
      const contactPayload: Record<string, unknown> = {
        name: row.name,
        source: "Notion",
        external_source: "notion",
        external_id: page.id,
        stage: (row.status as string) || "Call Booked",
        last_touch_at: new Date().toISOString(),
      };
      if (row.lead_source) contactPayload.notes_summary = `Lead source: ${row.lead_source}`;
      // Try to match an existing contact by external_id first, then by name
      const { data: existingContact } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("external_source", "notion")
        .eq("external_id", page.id)
        .maybeSingle();
      let contactId: string | null = (existingContact as { id?: string } | null)?.id ?? null;
      if (contactId) {
        await supabaseAdmin.from("contacts").update(contactPayload as never).eq("id", contactId);
      } else {
        const { data: ins } = await supabaseAdmin
          .from("contacts")
          .insert(contactPayload as never)
          .select("id")
          .maybeSingle();
        contactId = (ins as { id?: string } | null)?.id ?? null;
      }

      // Look up existing by notion_page_id
      const { data: existing } = await supabaseAdmin
        .from("discovery_calls")
        .select("id")
        .eq("notion_page_id", page.id)
        .maybeSingle();

      if (existing) {
        const { error: upErr } = await supabaseAdmin
          .from("discovery_calls")
          .update(row as never)
          .eq("id", (existing as { id: string }).id);
        if (upErr) throw new Error(upErr.message);
        updated++;
      } else {
        const { error: insErr } = await supabaseAdmin
          .from("discovery_calls")
          .insert(row as never);
        if (insErr) throw new Error(insErr.message);
        inserted++;
      }
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      if (errors.length < 5) errors.push(msg);
      await supabaseAdmin.from("notion_sync_log").insert({
        resource_type: "discovery_call",
        resource_id: null,
        notion_page_id: page.id,
        action: "import",
        success: false,
        error: msg,
      });
    }
  }

  await supabaseAdmin.from("notion_sync_log").insert({
    resource_type: "discovery_call",
    action: "import_batch",
    success: failed === 0,
    error: errors.length ? errors.join(" | ") : null,
    payload: { fetched: pages.length, inserted, updated, skipped, failed },
  });

  return {
    ok: true,
    fetched: pages.length,
    inserted,
    updated,
    skipped,
    failed,
    errors,
  };
}
