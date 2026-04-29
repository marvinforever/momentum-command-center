// Server functions for the Notion admin UI and the call-form mirror trigger.
// All Notion API calls happen server-side using the OAuth access_token.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getActiveConnection,
  listAccessibleDatabases,
  getDatabaseSchema,
  mirrorDiscoveryCall,
  mirrorLead,
  importCallsFromNotion,
} from "@/server/notion.server";

// ---------- Build the OAuth start URL ----------
export const buildNotionAuthUrl = createServerFn({ method: "GET" })
  .inputValidator((data: { origin: string }) => data)
  .handler(async ({ data }) => {
    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("NOTION_OAUTH_CLIENT_ID is not configured");
    const redirectUri = `${data.origin}/api/public/notion/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      owner: "user",
      redirect_uri: redirectUri,
    });
    return { url: `https://api.notion.com/v1/oauth/authorize?${params.toString()}`, redirectUri };
  });

// ---------- Connection status ----------
export const getNotionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const conn = await getActiveConnection();
  if (!conn) return { connected: false as const };
  return {
    connected: true as const,
    workspace_name: conn.workspace_name,
    workspace_icon: conn.workspace_icon,
    workspace_id: conn.workspace_id,
    calls_database_id: conn.calls_database_id,
    leads_database_id: conn.leads_database_id,
    calls_property_map: conn.calls_property_map ?? {},
    leads_property_map: conn.leads_property_map ?? {},
    enabled: conn.enabled,
  };
});

// ---------- List databases shared with the integration ----------
export const listNotionDatabases = createServerFn({ method: "GET" }).handler(async () => {
  const conn = await getActiveConnection();
  if (!conn) return { databases: [] };
  const databases = await listAccessibleDatabases(conn);
  return { databases };
});

// ---------- Fetch schema for a single database (refresh on demand) ----------
export const fetchNotionDatabaseSchema = createServerFn({ method: "POST" })
  .inputValidator((data: { databaseId: string }) => data)
  .handler(async ({ data }) => {
    const conn = await getActiveConnection();
    if (!conn) throw new Error("No active Notion connection");
    return getDatabaseSchema(conn, data.databaseId);
  });

// ---------- Save mapping config ----------
type PropertyMap = Record<string, { name: string; type: string }>;

export const saveNotionConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      calls_database_id?: string | null;
      leads_database_id?: string | null;
      calls_property_map?: PropertyMap;
      leads_property_map?: PropertyMap;
      enabled?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const conn = await getActiveConnection();
    if (!conn) throw new Error("No active Notion connection to configure");
    const update: Record<string, unknown> = {};
    if (data.calls_database_id !== undefined) update.calls_database_id = data.calls_database_id;
    if (data.leads_database_id !== undefined) update.leads_database_id = data.leads_database_id;
    if (data.calls_property_map !== undefined) update.calls_property_map = data.calls_property_map;
    if (data.leads_property_map !== undefined) update.leads_property_map = data.leads_property_map;
    if (data.enabled !== undefined) update.enabled = data.enabled;

    const { error } = await supabaseAdmin
      .from("notion_connections")
      .update(update as never)
      .eq("id", conn.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Disconnect ----------
export const disconnectNotion = createServerFn({ method: "POST" }).handler(async () => {
  const conn = await getActiveConnection();
  if (!conn) return { ok: true };
  const { error } = await supabaseAdmin
    .from("notion_connections")
    .delete()
    .eq("id", conn.id);
  if (error) throw new Error(error.message);
  return { ok: true };
});

// ---------- Mirror a single discovery call (called from the form submit) ----------
export const mirrorDiscoveryCallToNotion = createServerFn({ method: "POST" })
  .inputValidator((data: { callId: string }) => data)
  .handler(async ({ data }) => {
    return mirrorDiscoveryCall(data.callId);
  });

// ---------- Mirror a single lead ----------
export const mirrorLeadToNotion = createServerFn({ method: "POST" })
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }) => {
    return mirrorLead(data.leadId);
  });

// ---------- Backfill: sync all unsynced calls ----------
export const backfillCallsToNotion = createServerFn({ method: "POST" }).handler(async () => {
  const conn = await getActiveConnection();
  if (!conn || !conn.calls_database_id) {
    return { ok: false, error: "Notion not connected or calls DB not configured", synced: 0, failed: 0 };
  }
  const { data: calls, error } = await supabaseAdmin
    .from("discovery_calls")
    .select("id")
    .is("notion_page_id", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return { ok: false, error: error.message, synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const c of calls ?? []) {
    const r = await mirrorDiscoveryCall((c as { id: string }).id);
    if (r.ok) synced++;
    else {
      failed++;
      if (errors.length < 5) errors.push(r.error ?? "unknown");
    }
  }
  return { ok: true, synced, failed, errors };
});

// ---------- Recent sync log ----------
export const getRecentNotionSyncLog = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("notion_sync_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);
  return { entries: data ?? [] };
});
