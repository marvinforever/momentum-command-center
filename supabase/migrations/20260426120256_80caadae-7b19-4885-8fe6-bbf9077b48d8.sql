-- Extend leads with Kajabi mapping
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS kajabi_contact_id text,
  ADD COLUMN IF NOT EXISTS kajabi_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS leads_kajabi_contact_id_uq
  ON public.leads(kajabi_contact_id)
  WHERE kajabi_contact_id IS NOT NULL;

-- Extend offers with Kajabi mapping
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS kajabi_offer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS offers_kajabi_offer_id_uq
  ON public.offers(kajabi_offer_id)
  WHERE kajabi_offer_id IS NOT NULL;

-- Purchases
CREATE TABLE IF NOT EXISTS public.kajabi_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kajabi_purchase_id text UNIQUE NOT NULL,
  kajabi_offer_id text,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  buyer_email text,
  buyer_name text,
  offer_name text,
  amount_cents integer DEFAULT 0,
  currency text DEFAULT 'USD',
  status text DEFAULT 'completed', -- completed | refunded
  purchased_at timestamptz,
  refunded_at timestamptz,
  raw jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kajabi_purchases_purchased_at_idx ON public.kajabi_purchases(purchased_at DESC);
CREATE INDEX IF NOT EXISTS kajabi_purchases_buyer_email_idx ON public.kajabi_purchases(buyer_email);

-- Form submissions
CREATE TABLE IF NOT EXISTS public.kajabi_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kajabi_submission_id text UNIQUE NOT NULL,
  form_name text,
  kajabi_form_id text,
  lead_magnet_id uuid REFERENCES public.lead_magnets(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_email text,
  contact_name text,
  submitted_at timestamptz,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kajabi_form_submissions_submitted_at_idx ON public.kajabi_form_submissions(submitted_at DESC);

-- Raw audit log of webhook events
CREATE TABLE IF NOT EXISTS public.kajabi_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  signature_valid boolean NOT NULL,
  processed boolean DEFAULT false,
  error text,
  payload jsonb,
  received_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kajabi_webhook_events_received_at_idx ON public.kajabi_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS kajabi_webhook_events_event_type_idx ON public.kajabi_webhook_events(event_type);

-- RLS: read open (matches the rest of the app), writes only for authenticated.
-- Edge function uses service role and bypasses RLS.
ALTER TABLE public.kajabi_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kajabi_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kajabi_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon and auth read kajabi_purchases" ON public.kajabi_purchases FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write kajabi_purchases" ON public.kajabi_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon and auth read kajabi_form_submissions" ON public.kajabi_form_submissions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write kajabi_form_submissions" ON public.kajabi_form_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon and auth read kajabi_webhook_events" ON public.kajabi_webhook_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write kajabi_webhook_events" ON public.kajabi_webhook_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger for purchases
CREATE OR REPLACE FUNCTION public.kajabi_purchases_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS kajabi_purchases_updated_at ON public.kajabi_purchases;
CREATE TRIGGER kajabi_purchases_updated_at
  BEFORE UPDATE ON public.kajabi_purchases
  FOR EACH ROW EXECUTE FUNCTION public.kajabi_purchases_touch_updated_at();