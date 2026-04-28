ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_campaign_id ON public.contacts(campaign_id);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS pipeline_stages jsonb NOT NULL DEFAULT '["Lead In","Opt-In","Call Booked","Call Attended","Follow Up","Closed Won","No Sale"]'::jsonb,
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS data_source_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color text;

INSERT INTO public.campaigns (name, type, primary_channel, status, data_source, color)
VALUES
  ('Paid Ads Facebook',  'Evergreen', 'Meta Ads', 'Live', 'meta_ads', '#1877F2'),
  ('Communication Code', 'Evergreen', 'YouTube',  'Live', 'manual',   '#DC2626'),
  ('LinkedIn Boosted',   'Evergreen', 'LinkedIn', 'Live', 'linkedin', '#0A66C2'),
  ('LinkedIn Organic',   'Outreach',  'LinkedIn', 'Live', 'linkedin', '#0EA5E9'),
  ('Email Campaign',     'Promo',     'Email',    'Live', 'kajabi',   '#7C3AED')
ON CONFLICT DO NOTHING;