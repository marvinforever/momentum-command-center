
-- 1. Add a per-campaign webhook token so generic webhooks have a stable URL
ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS webhook_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill existing rows that came in before the default
UPDATE public.campaigns 
  SET webhook_token = encode(gen_random_bytes(16), 'hex')
  WHERE webhook_token IS NULL;

-- 2. Pre-configure Communication Code with Kajabi data source
UPDATE public.campaigns
  SET data_source = 'kajabi_form',
      data_source_config = jsonb_build_object('kajabi_form_id', '2148947513', 'form_name', 'Communication Cheat Sheet'),
      primary_channel = COALESCE(primary_channel, 'Meta Ads')
  WHERE name ILIKE 'Communication Code'
     OR name ILIKE 'Communication%Code%';

-- 3. Index for fast token lookups (used by webhook endpoint)
CREATE INDEX IF NOT EXISTS idx_campaigns_webhook_token ON public.campaigns(webhook_token);

-- 4. Index for Kajabi form-id lookup (used by ingest worker)
CREATE INDEX IF NOT EXISTS idx_kajabi_submissions_form_id ON public.kajabi_form_submissions(kajabi_form_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON public.contacts(LOWER(email)) WHERE email IS NOT NULL;
