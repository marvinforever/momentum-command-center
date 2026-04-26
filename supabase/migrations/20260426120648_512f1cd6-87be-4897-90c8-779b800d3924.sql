ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_lead_source_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_lead_source_check
  CHECK (lead_source = ANY (ARRAY[
    'YouTube'::text,
    'Facebook Ad'::text,
    'LinkedIn'::text,
    'Instagram'::text,
    'Podcast'::text,
    'Outreach'::text,
    'Client Referral'::text,
    'Direct/Other'::text,
    'Kajabi'::text
  ]));