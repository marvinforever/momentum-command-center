## What Christine actually wants

Two big things, both anchored in **history over time**:

1. **The Metrics Grid** — a one-screen view that mirrors her Google Sheet: every metric she tracks (email, YouTube, podcast, social, sales, pipeline) as rows, every week as columns, scrolling back to June 2025. Click any row → see that one metric as a chart with notes.
2. **A real CRM** — replace Folk. A drag-and-drop pipeline board (No Status → Prospect → Discovery Booked → Follow Up → Demo → Proposal Sent → Hold Off → Closed Won / Lost), where each card opens a contact page with notes, activity timeline, and follow-up dates.

The current cream/widget dashboard stays available but stops being the centerpiece. The home screen becomes the **Metrics Grid**.

---

## The Metrics Grid (new home page)

```text
                  | 04/10 | 04/17 | 04/24 |  Δ vs prior  | Spark
EMAIL
  Kajabi Subs     | 2,304 | 2,305 | 2,306 |     +1       | ───╱
  Open Rate       | 26.7% | 27.4% | 25.1% |    -2.3pp    | ─╲╱╲
PODCAST
  Downloads (28d) |  969  |  935  |  899  |    -36       | ╲___
  Eps Released    |   1   |   1   |   1   |     0        | ────
SOCIAL
  IG (Mark)       | 8,797 | 8,796 | 8,795 |     -1       | ╲╲╲
  LI (Mark)       | 8,546 | 8,551 | 8,562 |    +11       | ╱╱╱
SALES
  Calls Booked    |   -   |   -   |   -   |              |
PIPELINE (Folk)
  Prospect        |  16   |  16   |  16   |     0        |
  Discovery Bkd   |   1   |   1   |   1   |     0        |
  Closed Won      |   3   |   3   |   3   |     0        |
```

- Sticky left column (metric name) and sticky top row (week dates). Horizontal scroll for older weeks.
- Section headers (EMAIL / YOUTUBE / PODCAST / SOCIAL / SALES / PIPELINE) collapsible.
- Tiny inline sparkline at the right edge of each row.
- Click a row → side panel slides in with: full line chart, weekly table, plain-English commentary, and any week-notes.
- Color cues: green for week-over-week up, red for down, gray for flat. Subtle, not loud.

## CSV backfill

- One-time importer at **Admin → Integrations → Import historical metrics**. She uploads the CSV she already shared; we parse it into the new `weekly_metrics` table.
- Each row in the CSV becomes a `metric_definition` (Kajabi Subs, Open Rate, IG Mark, etc.); each column becomes a `weekly_metric_snapshot` keyed by week-ending date.
- Handles the messy stuff already in her sheet: `-`, blank, `28,7%` (European comma), `8,486` (US comma), `4:11` durations, `0.00%`.

## Going forward

- A Sunday-night cron snapshots everything we have integrations for (Kajabi via webhook totals, YouTube API, Captivate, Meta, LinkedIn followers we already store) into `weekly_metric_snapshot` — same table, so the grid keeps filling itself.
- For metrics no integration covers (Mark's IG/LI count, deals closed manually, calls booked), the grid has inline editable cells — click a number, type a new one, hit enter. Saves immediately.

---

## The CRM

### Pipeline board (default CRM view)
Kanban with columns matching her current Folk stages:
`No Status · Prospect · Discovery Booked · Follow Up · Demo · Proposal Sent · Hold Off · Closed Won · Closed Lost`

Each card shows: name, company, last touch date, a colored dot for source (Podcast guest / LinkedIn / Referral / Inbound). Drag between columns updates the stage and writes an activity log entry.

### Contact detail page
Click any card →
- **Header**: name, company, role, email, phone, source, current stage, owner.
- **Notes** (markdown, append-only with timestamps).
- **Activity timeline**: every stage change, every note, every follow-up created or completed, in reverse chronological order.
- **Follow-ups**: list of upcoming actions with due dates. A follow-up due today shows up on the home screen and on the contact card.

### Other CRM screens
- **Contacts list** — searchable/filterable table view of everyone, regardless of stage.
- **Today** — small panel on the home screen above the metrics grid: "3 follow-ups due today, 1 overdue."

### Existing data
We already have a `discovery_calls` table and a `leads` table. We'll wire the CRM to read/write through those where they fit, and add a new `contacts` table for the broader Folk-style universe (people who aren't yet leads — podcast guests, networking contacts, etc.) plus `contact_notes`, `contact_activity`, `contact_follow_ups`.

---

## Navigation changes

Top nav becomes:
- **Dashboard** (the new metrics grid — replaces current home)
- **CRM** (pipeline board default; sub-tabs for Contacts, Today)
- **Channels** (the existing per-channel detail pages — Captivate, Meta, YouTube, LinkedIn — kept for drill-downs)
- **Admin** (integrations, sync, CSV import)

The current widget-style home is preserved at `/widgets` for anyone who likes it, but the grid is what loads at `/`.

---

## Technical section (skip if not interested)

**New tables**
- `metric_definitions` (id, key, label, section, unit, format, sort_order, source — manual/kajabi/youtube/captivate/meta/linkedin)
- `weekly_metric_snapshots` (id, metric_def_id, week_ending date, value numeric, value_text text, note text) — `value_text` holds non-numeric like "4:11"
- `contacts` (id, name, company, role, email, phone, source, stage, owner, notes_summary, last_touch_at, next_followup_at)
- `contact_notes` (id, contact_id, body, created_by, created_at)
- `contact_activity` (id, contact_id, type, description, metadata jsonb, created_at)
- `contact_follow_ups` (id, contact_id, due_date, description, completed_at)
- All RLS: `auth read/write`, `anon read` for metrics tables only (CRM stays auth-only).

**Build order (rough)**
1. Schema migration + types.
2. CSV parser + importer route (`/admin/import-metrics`) using the file she already uploaded as the seed.
3. Metrics Grid component + drilldown panel → mount at `/`.
4. Move current widget dashboard to `/widgets`.
5. Sunday cron that snapshots integrated metrics into `weekly_metric_snapshots`.
6. CRM: contacts table, pipeline board (`/crm`), contact detail (`/crm/$id`), follow-ups widget.

**Out of scope for this round**
- Email sending from the CRM.
- Bulk import of Folk contacts (we'll do this once she exports a CSV from Folk; the importer pattern from metrics will be reused).
- Permissions per user — single-tenant for now.

---

This is a bigger build than a tweak — probably 2–3 substantial passes. Want me to start with **Phase 1: schema + CSV importer + Metrics Grid** so she can see her historical view working end-to-end first, then layer the CRM on top in a second pass? Or push straight through both?