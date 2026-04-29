## Dashboard Auto-Fill: What's Possible & The Process

Right now **every metric on the dashboard is `csv_import`** — meaning it only updates when you import a CSV via `/admin/import-metrics`. Here's the breakdown of what we can flip to auto-fill, what stays manual, and how the auto-fill works.

---

### ✅ Fully automatable (we already have the data syncing)

These have live data flowing into the database from connected APIs. We just need a weekly rollup job that writes into `weekly_metric_snapshots`.

| Metric | Source already in DB | Notes |
|---|---|---|
| **YouTube Subscribers** (both channels) | `youtube-sync` edge function → channel data | Christine + Intentional Ag + Momentum Company |
| **YouTube Views (28 Days)** | YouTube sync | Rolling 28d sum |
| **YouTube Watch Time (28 Days)** | YouTube sync | Rolling 28d sum |
| **Average Watch Time** | YouTube sync | Computed from views ÷ watch time |
| **Click Through Rate** | YouTube sync | From YouTube Analytics |
| **Podcast Captivate Downloads (28 Days)** | `captivate_show_metrics_daily` (syncing daily) | Both shows — Intentional Ag + Breaking Chains |
| **Podcast Episodes Released** | `captivate_episodes` | Count per week from `published_date` |
| **Podcast All Time downloads** | `captivate_shows.total_subscribers` / downloads | Cumulative |
| **LinkedIn Followers** (Christine + Mark) | `linkedin_weekly_metrics` (already weekly) | Direct copy |
| **Total Subscribers — Kajabi** | Kajabi API (we have key) | Need a small sync to pull total contact count |
| **Communication Cheat Sheet opt-ins** | `kajabi_form_submissions` (1,008 rows) | Count per week by `kajabi_form_id` |
| **Other Kajabi opt-ins** (Daily Brief, Applications, Drop the Armor, HPSS) | `kajabi_form_submissions` | Same — once each form ID is mapped |

### 🟡 Partially automatable (need one connection or a manual mapping)

| Metric | What's missing |
|---|---|
| **Email Open Rate (Average Weekly)** | Kajabi's broadcast/email API isn't wired up yet. Doable but needs a new sync. |
| **Instagram Followers** (Christine, Momentum, Mark) | No Instagram integration exists yet. Needs Meta Graph API connection (we have Meta token for ads — extending it to IG profiles is a small lift). |
| **Discovery Calls (7 Days)** | We have a `discovery_calls` table. If you log calls there (or sync from Notion/Calendly), this becomes a `count where call_date >= now() - 7d`. |
| **Deals Closed** | Comes from `kajabi_purchases` (already syncing) OR from CRM contacts moved to "Closed Won". Pick one source of truth and it's automatic. |

### 🔴 Manual forever (no API exists for these)

None on the current dashboard — every row has a plausible automation path. The only true "manual" entries would be qualitative notes or one-off campaign numbers you decide to track later.

---

### How auto-fill will work (the process)

```text
                  ┌─────────────────────────┐
                  │  Existing API syncs     │
                  │  (YouTube, Captivate,   │
                  │   LinkedIn, Kajabi,     │
                  │   Meta)                 │
                  └───────────┬─────────────┘
                              │ writes raw data daily
                              ▼
                  ┌─────────────────────────┐
                  │  Raw tables             │
                  │  (channel_metrics,      │
                  │   captivate_*, kajabi_*)│
                  └───────────┬─────────────┘
                              │ Sunday 11pm pg_cron job
                              ▼
                  ┌─────────────────────────┐
                  │  weekly-rollup function │
                  │  (NEW — to be built)    │
                  │  Reads raw → computes   │
                  │  per-metric weekly value│
                  └───────────┬─────────────┘
                              │ upsert
                              ▼
                  ┌─────────────────────────┐
                  │ weekly_metric_snapshots │
                  │ (what the dashboard     │
                  │  reads)                 │
                  └─────────────────────────┘
```

**Concretely:**
1. Each metric definition gets a `source_config` (e.g. `{ "type": "captivate_downloads_28d", "show_id": "29eb..." }`).
2. A new server function `weekly-rollup` runs every Sunday night via pg_cron. For each auto-source metric, it computes the value for the just-ended week and upserts a row into `weekly_metric_snapshots`.
3. CSV-imported metrics and metrics you click-to-edit in the drilldown panel keep working exactly as today — they just get a `source = 'manual'` and the rollup leaves them alone.
4. Each row in the grid will get a tiny indicator (🔄 auto / ✏️ manual) so you and Christine know at a glance which is which.
5. There'll be a "Run weekly rollup now" button on `/admin/import-metrics` so you don't have to wait until Sunday to backfill or fix a value.

---

### Suggested rollout order

1. **Phase 1 — Wins from data we already have** (nothing new to integrate):
   YouTube (5 metrics × 3 channels), Captivate (3 metrics × 2 shows), LinkedIn (2 metrics), Kajabi opt-ins (5 metrics), Kajabi total subscribers, Deals Closed. **That's ~25 of 37 rows automated immediately.**
2. **Phase 2 — Small new integrations:**
   Instagram followers (extend Meta token), Discovery Calls (point at `discovery_calls` table or Calendly webhook we already built).
3. **Phase 3 — Email open rate:**
   Wire up Kajabi broadcast stats sync.

---

### Open questions before I build

1. For **Deals Closed**, source of truth = Kajabi purchases (auto, exact $) OR CRM "Closed Won" stage (manual, but captures non-Kajabi deals)?
2. For **Discovery Calls (7 Days)**, do you want it pulled from the existing `discovery_calls` table, from Calendly webhooks, or counted from CRM contacts in "Call Attended"?
3. Want me to start with **Phase 1 only** (the 25 instant-win metrics) and ship that this round, then plan Phases 2 & 3 separately?
