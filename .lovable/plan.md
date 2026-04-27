# Sales pipeline: Lovable ↔ Notion

## Direction
Lovable is the source of truth. Christine logs calls and leads in Lovable; we mirror to Notion so her existing board stays populated.

## Phase 1 — Connect Notion & inspect

1. Trigger the Notion connector picker (`standard_connectors--connect`, connector_id `notion`). You authorize the integration on the **Momentum Sales and Marketing Board** page so it gets access to every database on it.
2. I list databases on that page, dump each schema (property names + types), and confirm with you which database = "calls", which = "leads/contacts", and any others worth syncing (deals, follow-ups, etc.).
3. I show you a proposed field map before any writes happen — e.g.:

```text
Lovable discovery_calls         →  Notion "Calls" DB
─────────────────────────────────────────────────────
name                            →  Name (title)
call_date                       →  Date Booked
call_type                       →  Call Type (select)
status (Pending/Booked/...)     →  Status (status)
fit_rating (1-5)                →  Fit (number)
lead_source                     →  Source (select)
location                        →  Location (text)
role_position                   →  Role (text)
follow_up_actions[]             →  Next Actions (multi-select)
fu_date                         →  Follow-up Date (date)
notes                           →  Notes (text)
offer_id → offer.name           →  Offer (select)
lead_id  → lead.name/email      →  Lead (text/relation)
id (uuid)                       →  Lovable ID (text, hidden — used for upsert key)
```

I'll do the same for `leads` ↔ Notion contacts DB.

## Phase 2 — Mirror engine (Lovable → Notion)

- **Schema add**: `notion_page_id text` and `notion_synced_at timestamptz` columns on `discovery_calls` and `leads`. These let us upsert (update an existing Notion page if we've synced it before, otherwise create a new one).
- **Server function** `mirrorDiscoveryCallToNotion(callId)`:
  - Reads the row from `discovery_calls` (with joined offer/lead names).
  - If `notion_page_id` exists → `PATCH /v1/pages/{id}` (update properties).
  - Otherwise → `POST /v1/pages` (create), then save returned `page_id` + timestamp.
  - All calls go through the connector gateway (`https://connector-gateway.lovable.dev/notion/...`) using `LOVABLE_API_KEY` + `NOTION_API_KEY` env vars (auto-injected when connector is linked).
- **Sync trigger**: called from the form's submit handler in `admin.tsx` after the Supabase insert succeeds. Same pattern for any future edits.
- **Resilience**: Notion failure does NOT block the Supabase save. We toast a soft warning ("Saved locally; Notion sync failed — will retry") and log to a small `notion_sync_log` table for visibility.

## Phase 3 — Sales widget on the dashboard

Add a `SalesWidget` to the home dashboard's Channels grid (alongside YouTube/LinkedIn/Meta/Kajabi), so calls are visible at a glance:

- **Header KPIs**: Calls booked (last 30d) · Calls completed · Avg fit rating · Bookings → purchase conversion (joined to `kajabi_purchases` via `lead_id`)
- **Mini chart**: Calls per week (last 8 weeks), bar chart
- **List**: Next 5 upcoming calls (status=Pending, call_date ≥ today) with name, date, offer
- **CTA**: "Log a call" → opens the existing form in `/admin` (or we promote it into a dialog on the dashboard for one-click logging)

## Phase 4 — Backfill + retry tooling (admin page)

Small panel in `/admin/integrations`:
- "Sync all unsynced calls to Notion" button (loops rows where `notion_page_id IS NULL`)
- Last sync status / errors
- Toggle to disable Notion mirroring entirely (kill switch)

## Open questions for you (I'll ask after connecting & seeing the actual DB)
1. Is there ONE Notion DB for both leads + calls, or separate ones?
2. Should leads from Kajabi form submissions also mirror to Notion automatically, or only manually-entered leads?
3. Any Notion properties I should preserve/not-overwrite if Christine edits them in Notion (e.g., she adds a note in Notion — do we keep it on next sync)?

## Technical notes
- Notion is gateway-enabled, so token refresh is automatic — no API key management for you.
- All Notion writes happen server-side via `createServerFn`, never from the browser.
- Upsert key = `notion_page_id` stored on our row (avoids duplicate pages if Christine deletes/recreates).
- We do NOT pull from Notion in this phase — strictly one-way out. If you ever need to bring Notion edits back, that's a separate phase 5 (and where two-way sync gets gnarly — happy to design it then if needed).