# Campaign Automation: Data Sources, Auto-Ingest & Calendly

Enable each campaign to automatically pull leads from a configured data source, auto-tag them at "Lead In", and advance them to "Call Booked" / "Call Attended" via Calendly. Skipping UTM/attribution work for now per your call — we'll layer that on later.

---

## 1. Campaign Edit screen — Data Source picker

Add a new section to the Edit Campaign drawer/page with:

- **Data Source dropdown**: Manual · Kajabi Form · Meta Lead Ads · Calendly · Generic Webhook
- **Source-specific config** (rendered based on selection):
  - **Kajabi Form**: searchable dropdown of all forms (auto-populated from `kajabi_form_submissions` — e.g. "Communication Cheat Sheet (1,008 submissions)")
  - **Meta Lead Ads**: dropdown of Meta campaigns from `meta_campaigns`
  - **Calendly**: paste your event-type URL + display the unique webhook URL to paste into Calendly's developer settings
  - **Generic Webhook**: display unique URL (`/api/public/hooks/campaign-lead/{campaign_id}`) with a copy button + sample payload
- **"Backfill existing leads" button** — for Kajabi and Meta sources, pulls all historical submissions matching the config into the campaign

Pre-configure the **Communication Code** campaign with `data_source = 'kajabi_form'` and form ID `2148947513` (Communication Cheat Sheet) and run the backfill so all 1,008 leads land in the board immediately.

---

## 2. Auto-ingest worker

A server function that, when triggered, scans for new submissions and creates contacts:

- **Kajabi flow**: For each campaign with `data_source = 'kajabi_form'`, find `kajabi_form_submissions` where `kajabi_form_id` matches config and no contact exists yet for that email → create contact (name, email from submission), tag to campaign, set `stage = 'Lead In'`, set `source = 'kajabi'`
- **Meta flow**: same idea, sourced from Meta lead data when present
- **Email-match dedup**: if a contact already exists with that email, just attach the campaign + log activity ("Re-engaged via Communication Cheat Sheet") instead of duplicating

Triggered by:
- Manual "Sync now" button on each campaign
- Hourly pg_cron job calling `/api/public/hooks/campaign-ingest`
- Inline call right after the existing Kajabi webhook fires (so new leads land within seconds, not an hour)

---

## 3. Calendly webhook

New endpoint: `/api/public/hooks/calendly`

- Verify Calendly signing key (header `Calendly-Webhook-Signature`)
- On `invitee.created`:
  - Match contact by email
  - If no match, create a contact tagged to the campaign whose Calendly URL matches the event type
  - Set `stage = 'Call Booked'`, set `next_followup_at` to the event start time
  - Log activity: "Booked call for {date}"
- On `invitee.canceled`:
  - Move back to "Lead In" or "Follow Up" with note logged

For each campaign that selects "Calendly" as the data source, the UI shows the webhook URL + signing key to paste into Calendly → Integrations → Webhooks. (Note: no-show detection isn't fired automatically by Calendly; "Call Attended" stays manual.)

---

## 4. Backfill the 1,008 Communication Code leads

One-time script (also available as the "Backfill existing leads" button) that:
- Reads all `kajabi_form_submissions` where `kajabi_form_id = '2148947513'`
- Creates/matches contacts by email
- Tags them to the Communication Code campaign at "Lead In"
- Sets `last_touch_at` to the submission date so the board sorts naturally

---

## Out of scope (saved for later)

- UTM tracking / source attribution
- Per-platform tracking link generator
- No-show auto-detection
- Email sequences / nurture automation

---

## Technical notes

**Database changes** (single migration):
- `campaigns.data_source_config jsonb` already exists — we'll standardize the shape per source type:
  - Kajabi: `{ "kajabi_form_id": "2148947513" }`
  - Meta: `{ "meta_campaign_id": "..." }`
  - Calendly: `{ "event_type_url": "...", "signing_key": "..." }`
  - Webhook: `{ "webhook_token": "..." }` (random token for URL security)
- Add `contact_activity` rows for each automated stage change so you can see the trail

**Files**:
- `src/routes/campaigns.$id.tsx` (or wherever campaign edit lives) — new Data Source section
- `src/server/campaign-ingest.functions.ts` — sync logic + backfill
- `src/routes/api/public/hooks/calendly.ts` — Calendly webhook
- `src/routes/api/public/hooks/campaign-lead.$token.ts` — generic webhook
- `src/routes/api/public/hooks/campaign-ingest.ts` — cron-triggered batch sync
- Migration: standardize `data_source_config`, seed Communication Code config
- pg_cron job: hourly `campaign-ingest` call
- Hook into existing Kajabi webhook handler to call `campaign-ingest` inline for new submissions

**Secrets needed**:
- `CALENDLY_WEBHOOK_SIGNING_KEY` — you'll generate this in Calendly's webhook setup and I'll prompt for it once we have the endpoint live
