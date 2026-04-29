import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { MCCard } from "@/components/mc/Primitives";
import { cn } from "@/lib/utils";
import {
  buildNotionAuthUrl,
  getNotionStatus,
  listNotionDatabases,
  fetchNotionDatabaseSchema,
  saveNotionConfig,
  disconnectNotion,
  backfillCallsToNotion,
  importCallsFromNotionFn,
  getRecentNotionSyncLog,
} from "@/server/notion.functions";

// Lovable fields available for mapping. `hint` is a plain-English explanation
// shown in the UI; `aliases` are alternative names we'll auto-match against
// the Notion property names (case/punctuation-insensitive).
type FieldDef = { key: string; label: string; hint: string; aliases: string[] };

const CALL_FIELDS: readonly FieldDef[] = [
  { key: "name", label: "Name", hint: "Title of the call (usually the lead's name)", aliases: ["name", "title", "call", "lead"] },
  { key: "call_date", label: "Call Date", hint: "When the call happened", aliases: ["call date", "date", "meeting date", "scheduled", "when"] },
  { key: "fu_date", label: "Follow-up Date", hint: "When to follow up next", aliases: ["follow up date", "followup", "fu date", "next followup", "next touch"] },
  { key: "call_type", label: "Call Type", hint: "e.g. Discovery, Sales, Strategy", aliases: ["call type", "type", "meeting type"] },
  { key: "status", label: "Status", hint: "Pending / Done / No-show / etc.", aliases: ["status", "state", "stage"] },
  { key: "fit_rating", label: "Fit Rating", hint: "Score from 1–5 of how good a fit", aliases: ["fit rating", "fit", "rating", "score", "quality"] },
  { key: "lead_source", label: "Lead Source", hint: "How they found you", aliases: ["lead source", "source", "channel", "where from"] },
  { key: "location", label: "Location", hint: "City / country / region", aliases: ["location", "city", "country", "region", "where"] },
  { key: "role_position", label: "Role / Position", hint: "Their job title", aliases: ["role", "position", "job", "title", "role / position"] },
  { key: "follow_up_actions", label: "Follow-up Actions", hint: "Checklist of next steps (multi-select)", aliases: ["follow up actions", "followup actions", "actions", "next steps", "todo", "to-do"] },
  { key: "notes", label: "Notes", hint: "Free-form notes about the call", aliases: ["notes", "note", "summary", "details"] },
  { key: "offer", label: "Offer name", hint: "Which offer/program was discussed", aliases: ["offer", "offer name", "product", "program"] },
  { key: "lead", label: "Lead name", hint: "Name of the person on the call", aliases: ["lead", "lead name", "contact", "person"] },
  { key: "lead_email", label: "Lead email", hint: "Their email address", aliases: ["lead email", "email", "contact email"] },
  { key: "lovable_id", label: "Sync ID", hint: "Hidden ID we use to update the same Notion page next time (recommended)", aliases: ["lovable id", "sync id", "external id", "id", "uuid"] },
];

const LEAD_FIELDS: readonly FieldDef[] = [
  { key: "name", label: "Name", hint: "The lead's name", aliases: ["name", "title", "contact", "lead"] },
  { key: "email", label: "Email", hint: "Their email address", aliases: ["email", "e-mail"] },
  { key: "phone", label: "Phone", hint: "Their phone number", aliases: ["phone", "mobile", "tel", "telephone"] },
  { key: "first_touch_date", label: "First Touch Date", hint: "When they first came in", aliases: ["first touch date", "first touch", "created", "date added", "joined"] },
  { key: "lead_source", label: "Lead Source", hint: "How they found you", aliases: ["lead source", "source", "channel"] },
  { key: "status", label: "Status", hint: "New / Working / Closed / etc.", aliases: ["status", "stage", "state"] },
  { key: "utm_source", label: "UTM Source", hint: "Marketing tracking — which platform", aliases: ["utm source", "utm_source", "source"] },
  { key: "utm_medium", label: "UTM Medium", hint: "Marketing tracking — type of traffic", aliases: ["utm medium", "utm_medium", "medium"] },
  { key: "utm_campaign", label: "UTM Campaign", hint: "Marketing tracking — campaign name", aliases: ["utm campaign", "utm_campaign", "campaign"] },
  { key: "how_did_you_hear", label: "How they heard", hint: "Their answer to 'how did you hear about us'", aliases: ["how did you hear", "how heard", "referral", "referred by"] },
  { key: "notes", label: "Notes", hint: "Free-form notes", aliases: ["notes", "note", "summary"] },
  { key: "lovable_id", label: "Sync ID", hint: "Hidden ID we use to update the same Notion page next time (recommended)", aliases: ["lovable id", "sync id", "external id", "id", "uuid"] },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Score how well a Notion property name matches a Lovable field. Higher = better.
function matchScore(field: FieldDef, propName: string): number {
  const np = normalize(propName);
  if (!np) return 0;
  // Exact match on label or any alias
  for (const alias of [field.label, ...field.aliases]) {
    if (normalize(alias) === np) return 100;
  }
  // Substring containment
  for (const alias of [field.label, ...field.aliases]) {
    const na = normalize(alias);
    if (np === na) return 100;
    if (np.includes(na) || na.includes(np)) {
      return Math.max(60, 100 - Math.abs(np.length - na.length));
    }
  }
  return 0;
}

function autoMatchMap(
  fields: readonly FieldDef[],
  schema: Record<string, { name: string; type: string }>,
): PropMap {
  const props = Object.values(schema);
  const map: PropMap = {};
  const used = new Set<string>();
  // Greedy: for each field, pick the highest-scoring unused prop above threshold.
  for (const f of fields) {
    let best: { name: string; type: string; score: number } | null = null;
    for (const p of props) {
      if (used.has(p.name)) continue;
      const s = matchScore(f, p.name);
      if (s > 0 && (!best || s > best.score)) best = { ...p, score: s };
    }
    if (best && best.score >= 60) {
      map[f.key] = { name: best.name, type: best.type };
      used.add(best.name);
    }
  }
  return map;
}

type PropMap = Record<string, { name: string; type: string }>;

export function NotionCard() {
  const qc = useQueryClient();
  const buildAuth = useServerFn(buildNotionAuthUrl);

  const status = useQuery({
    queryKey: ["notion_status"],
    queryFn: () => getNotionStatus(),
    refetchInterval: 30000,
  });

  // Show "connected" toast if redirected back from OAuth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("notion") === "connected") {
      toast.success("Notion connected");
      params.delete("notion");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      qc.invalidateQueries({ queryKey: ["notion_status"] });
      qc.invalidateQueries({ queryKey: ["notion_databases"] });
    }
  }, [qc]);

  async function startConnect() {
    try {
      const { url } = await buildAuth({ data: { origin: window.location.origin } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Notion auth");
    }
  }

  return (
    <MCCard className="p-5 sm:p-7 lg:p-8 mb-6">
      <div className="flex items-start justify-between mb-5 sm:mb-6">
        <div>
          <h2 className="serif text-[22px] sm:text-[26px] text-ink">Notion (Sales Board Sync)</h2>
          <p className="text-[12px] sm:text-[13px] text-ink-soft mt-1">
            Mirror discovery calls and leads from this dashboard into your Momentum Sales board so the Notion view stays current.
          </p>
        </div>
        {status.data?.connected ? (
          <DisconnectButton />
        ) : (
          <button
            onClick={startConnect}
            className="rounded-lg bg-gold px-4 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors whitespace-nowrap"
          >
            Connect Notion
          </button>
        )}
      </div>

      {!status.data?.connected ? (
        <div className="text-[12px] text-ink-muted py-6 text-center bg-cream-deep rounded-lg">
          Click <strong>Connect Notion</strong> to authorize the integration. You'll pick which Notion workspace and pages to grant access to.
        </div>
      ) : (
        <ConnectedPanel
          workspaceName={status.data.workspace_name ?? "(unnamed workspace)"}
          workspaceIcon={status.data.workspace_icon}
          callsDbId={status.data.calls_database_id}
          leadsDbId={status.data.leads_database_id}
          callsMap={(status.data.calls_property_map ?? {}) as PropMap}
          leadsMap={(status.data.leads_property_map ?? {}) as PropMap}
        />
      )}
    </MCCard>
  );
}

function DisconnectButton() {
  const qc = useQueryClient();
  const disconnect = useServerFn(disconnectNotion);
  const m = useMutation({
    mutationFn: async () => disconnect(),
    onSuccess: () => {
      toast.success("Notion disconnected");
      qc.invalidateQueries({ queryKey: ["notion_status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Disconnect failed"),
  });
  return (
    <button
      onClick={() => { if (confirm("Disconnect Notion? Mirroring will stop.")) m.mutate(); }}
      className="rounded-lg border border-line text-ink px-3 py-1.5 text-[11px] hover:bg-cream-deep"
    >
      {m.isPending ? "…" : "Disconnect"}
    </button>
  );
}

function ConnectedPanel(props: {
  workspaceName: string;
  workspaceIcon: string | null;
  callsDbId: string | null;
  leadsDbId: string | null;
  callsMap: PropMap;
  leadsMap: PropMap;
}) {
  const qc = useQueryClient();
  const listDbs = useServerFn(listNotionDatabases);
  const fetchSchema = useServerFn(fetchNotionDatabaseSchema);
  const saveCfg = useServerFn(saveNotionConfig);
  const backfill = useServerFn(backfillCallsToNotion);
  const importFromNotion = useServerFn(importCallsFromNotionFn);
  const buildAuth = useServerFn(buildNotionAuthUrl);

  const dbs = useQuery({
    queryKey: ["notion_databases"],
    queryFn: () => listDbs(),
  });

  const [callsDb, setCallsDb] = useState<string>(props.callsDbId ?? "");
  const [leadsDb, setLeadsDb] = useState<string>(props.leadsDbId ?? "");
  const [callsMap, setCallsMap] = useState<PropMap>(props.callsMap);
  const [leadsMap, setLeadsMap] = useState<PropMap>(props.leadsMap);

  // Cache fetched schemas (id -> properties)
  const [schemas, setSchemas] = useState<Record<string, Record<string, { name: string; type: string }>>>({});

  async function loadSchema(id: string) {
    if (!id || schemas[id]) return;
    try {
      const s = await fetchSchema({ data: { databaseId: id } });
      setSchemas((prev) => ({ ...prev, [id]: s.properties }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load schema");
    }
  }

  useEffect(() => { if (callsDb) loadSchema(callsDb); /* eslint-disable-next-line */ }, [callsDb]);
  useEffect(() => { if (leadsDb) loadSchema(leadsDb); /* eslint-disable-next-line */ }, [leadsDb]);

  const callsSchema = callsDb ? schemas[callsDb] : undefined;
  const leadsSchema = leadsDb ? schemas[leadsDb] : undefined;

  const save = useMutation({
    mutationFn: async () =>
      saveCfg({
        data: {
          calls_database_id: callsDb || null,
          leads_database_id: leadsDb || null,
          calls_property_map: callsMap,
          leads_property_map: leadsMap,
        },
      }),
    onSuccess: () => {
      toast.success("Notion configuration saved");
      qc.invalidateQueries({ queryKey: ["notion_status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const backfillM = useMutation({
    mutationFn: async () => backfill(),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.error ?? "Backfill failed");
      else toast.success(`Backfill complete: ${r.synced} synced, ${r.failed} failed`);
      qc.invalidateQueries({ queryKey: ["notion_sync_log"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Backfill failed"),
  });

  const importM = useMutation({
    mutationFn: async () => importFromNotion(),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.errors?.[0] ?? "Import failed");
      else
        toast.success(
          `Imported from Notion — ${r.fetched} pages: ${r.inserted} new, ${r.updated} updated, ${r.skipped} skipped, ${r.failed} failed`,
        );
      qc.invalidateQueries({ queryKey: ["notion_sync_log"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  const databases = dbs.data?.databases ?? [];

  async function reconnectNotion() {
    try {
      const { url } = await buildAuth({ data: { origin: window.location.origin } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Notion auth");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-cream border border-line-soft p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-[13px]">
          <div className="flex items-center gap-2">
          {props.workspaceIcon && <span className="text-[18px]">{props.workspaceIcon}</span>}
          <div>
            <div className="font-medium text-ink">Connected to {props.workspaceName}</div>
            <div className="text-[11px] text-ink-muted">
              {dbs.isFetching ? "Checking shared Notion databases…" : `${databases.length} database(s) shared with this integration`}
            </div>
          </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => dbs.refetch()}
              disabled={dbs.isFetching}
              className="rounded-lg border border-line text-ink px-3 py-1.5 text-[11px] hover:bg-cream-deep disabled:opacity-50"
            >
              {dbs.isFetching ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={reconnectNotion}
              className="rounded-lg border border-line text-ink px-3 py-1.5 text-[11px] hover:bg-cream-deep"
            >
              Reconnect access
            </button>
          </div>
        </div>
      </div>

      {dbs.error && (
        <div className="rounded-lg border border-line-soft bg-cream-deep p-4 text-[12px] text-ink-muted">
          Couldn’t load Notion databases: {dbs.error instanceof Error ? dbs.error.message : "unknown error"}
        </div>
      )}

      {!dbs.isFetching && !dbs.error && databases.length === 0 && (
        <div className="rounded-lg border border-line-soft bg-cream-deep p-4 text-[12px] text-ink-muted">
          No Notion databases are available yet. Reconnect access and choose the Notion page or database you want Momentum to write to, then refresh this list.
        </div>
      )}

      <PlainEnglishHelp />

      <DbMappingSection
        title="Calls database"
        subtitle="Each new discovery call in Lovable will become a page in this Notion database."
        databases={databases}
        selectedDbId={callsDb}
        onSelectDb={(id) => { setCallsDb(id); setCallsMap({}); }}
        schema={callsSchema}
        fields={CALL_FIELDS}
        map={callsMap}
        onMapChange={setCallsMap}
      />

      <DbMappingSection
        title="Leads database (optional)"
        subtitle="Each new lead in Lovable will become a page in this Notion database. Skip this section if you only want to sync calls."
        databases={databases}
        selectedDbId={leadsDb}
        onSelectDb={(id) => { setLeadsDb(id); setLeadsMap({}); }}
        schema={leadsSchema}
        fields={LEAD_FIELDS}
        map={leadsMap}
        onMapChange={setLeadsMap}
      />

      <div className="flex items-center gap-3 pt-2 border-t border-line-soft">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-lg bg-gold px-4 py-2 text-[12px] font-medium text-white hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save mapping"}
        </button>
        <button
          onClick={() => backfillM.mutate()}
          disabled={backfillM.isPending || !callsDb}
          className="rounded-lg border border-line text-ink px-4 py-2 text-[12px] hover:bg-cream-deep disabled:opacity-50"
        >
          {backfillM.isPending ? "Syncing…" : "Sync unsynced calls now"}
        </button>
      </div>

      <SyncLogSection />
    </div>
  );
}

function PlainEnglishHelp() {
  return (
    <div className="rounded-lg border border-gold-soft bg-cream p-4 text-[12px] text-ink-soft leading-relaxed">
      <div className="font-medium text-ink mb-1">How this works (in plain English)</div>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Pick a Notion database below — that's <em>where</em> your calls/leads will land in Notion.</li>
        <li>For each Lovable field on the left, tell us which column in your Notion database it should go into. (We'll auto-match the easy ones.)</li>
        <li>Anything left as <strong>“— skip —”</strong> just won't be sent to Notion. That's fine.</li>
        <li>Hit <strong>Save mapping</strong>, then <strong>Sync unsynced calls now</strong> to backfill.</li>
      </ol>
    </div>
  );
}

function DbMappingSection(props: {
  title: string;
  subtitle: string;
  databases: { id: string; title: string; icon: string | null }[];
  selectedDbId: string;
  onSelectDb: (id: string) => void;
  schema: Record<string, { name: string; type: string }> | undefined;
  fields: readonly FieldDef[];
  map: PropMap;
  onMapChange: (m: PropMap) => void;
}) {
  const propEntries = useMemo(() => {
    if (!props.schema) return [] as { name: string; type: string }[];
    return Object.values(props.schema).sort((a, b) => a.name.localeCompare(b.name));
  }, [props.schema]);

  // Auto-match the first time a schema loads while the map is empty —
  // saves the user from staring at 15 dropdowns full of "skip".
  useEffect(() => {
    if (props.schema && Object.keys(props.map).length === 0) {
      const auto = autoMatchMap(props.fields, props.schema);
      if (Object.keys(auto).length > 0) props.onMapChange(auto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.schema]);

  function setField(fieldKey: string, propName: string) {
    const next = { ...props.map };
    if (!propName) {
      delete next[fieldKey];
    } else {
      const meta = props.schema?.[propName];
      if (!meta) return;
      next[fieldKey] = { name: meta.name, type: meta.type };
    }
    props.onMapChange(next);
  }

  function runAutoMatch() {
    if (!props.schema) return;
    const auto = autoMatchMap(props.fields, props.schema);
    props.onMapChange(auto);
    const matched = Object.keys(auto).length;
    toast.success(`Auto-matched ${matched} of ${props.fields.length} fields. Review and adjust below.`);
  }

  function clearAll() {
    props.onMapChange({});
  }

  const mappedCount = Object.keys(props.map).length;
  const totalFields = props.fields.length;

  return (
    <div className="rounded-lg border border-line-soft p-4">
      <div className="mb-3">
        <div className="text-[14px] font-medium text-ink">{props.title}</div>
        <div className="text-[11px] text-ink-muted">{props.subtitle}</div>
      </div>

      <label className="block text-[11px] font-medium text-ink-soft mb-1">
        1. Which Notion database?
      </label>
      <select
        value={props.selectedDbId}
        onChange={(e) => props.onSelectDb(e.target.value)}
        className="w-full text-[12px] bg-cream-deep rounded px-3 py-2 border border-line-soft focus:border-gold outline-none mb-3"
      >
        <option value="">— pick one —</option>
        {props.databases.map((d) => (
          <option key={d.id} value={d.id}>{d.icon ? `${d.icon} ` : ""}{d.title}</option>
        ))}
      </select>

      {props.selectedDbId && !props.schema && (
        <div className="text-[11px] text-ink-muted py-3 text-center bg-cream-deep rounded">Loading database columns…</div>
      )}

      {props.schema && (
        <>
          <div className="flex items-center justify-between mb-2 mt-1">
            <label className="text-[11px] font-medium text-ink-soft">
              2. Match each Lovable field to a Notion column
              <span className="text-ink-muted font-normal ml-2">({mappedCount}/{totalFields} mapped)</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={runAutoMatch}
                className="rounded border border-gold-soft bg-cream text-ink px-2.5 py-1 text-[11px] hover:bg-gold/10"
                title="Match Lovable fields to Notion columns by name"
              >
                ✨ Auto-match
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={mappedCount === 0}
                className="rounded border border-line text-ink-soft px-2.5 py-1 text-[11px] hover:bg-cream-deep disabled:opacity-40"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_1fr] gap-3 text-[10px] uppercase tracking-wide text-ink-muted px-1 pb-1 border-b border-line-soft">
              <div>Lovable field</div>
              <div>Notion column</div>
            </div>
            {props.fields.map((f) => {
              const current = props.map[f.key];
              return (
                <div key={f.key} className="grid grid-cols-[1fr_1fr] gap-3 items-start py-1">
                  <div className="text-[12px] text-ink leading-tight pt-1.5">
                    <div className="font-medium">{f.label}</div>
                    <div className="text-[10.5px] text-ink-muted">{f.hint}</div>
                  </div>
                  <select
                    value={current?.name ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className={cn(
                      "text-[12px] rounded px-2 py-1.5 border outline-none w-full",
                      current ? "bg-cream border-gold-soft" : "bg-cream-deep border-line-soft text-ink-muted",
                    )}
                  >
                    <option value="">— don't sync this —</option>
                    {propEntries.map((p) => (
                      <option key={p.name} value={p.name}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SyncLogSection() {
  const getLog = useServerFn(getRecentNotionSyncLog);
  const log = useQuery({
    queryKey: ["notion_sync_log"],
    queryFn: () => getLog(),
    refetchInterval: 15000,
  });
  const entries = log.data?.entries ?? [];

  return (
    <div className="border-t border-line-soft pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="label-eyebrow">Recent sync activity</div>
        <div className="text-[10px] text-ink-muted">Auto-refreshing every 15s</div>
      </div>
      {entries.length === 0 ? (
        <div className="text-[12px] text-ink-muted py-6 text-center bg-cream-deep rounded-lg">
          No sync activity yet.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[280px] overflow-auto">
          {entries.map((e: {
            id: string; resource_type: string; action: string; success: boolean;
            error: string | null; created_at: string; notion_page_id: string | null;
          }) => (
            <div key={e.id} className="flex items-center gap-3 text-[12px] py-2 px-3 rounded-lg bg-cream border border-line-soft">
              <span className={cn(
                "inline-block w-2 h-2 rounded-full shrink-0",
                e.success ? "bg-green-600" : "bg-burgundy",
              )} />
              <span className="font-mono text-ink min-w-[140px]">{e.resource_type}</span>
              <span className="text-ink-soft min-w-[60px]">{e.action}</span>
              <span className="text-ink-muted text-[11px] flex-1">
                {new Date(e.created_at).toLocaleString()}
              </span>
              {e.error && <span className="text-burgundy text-[11px] truncate max-w-[280px]" title={e.error}>{e.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
