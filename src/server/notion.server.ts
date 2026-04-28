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

