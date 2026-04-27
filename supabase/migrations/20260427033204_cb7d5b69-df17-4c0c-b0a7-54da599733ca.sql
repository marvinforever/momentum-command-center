
-- Meta campaigns (mirrors campaigns from Meta Ads)
CREATE TABLE public.meta_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_campaign_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  daily_budget NUMERIC,
  lifetime_budget NUMERIC,
  start_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_campaigns_campaign_id ON public.meta_campaigns(campaign_id);

ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon and auth read meta_campaigns"
  ON public.meta_campaigns FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "auth write meta_campaigns"
  ON public.meta_campaigns FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Daily insights snapshot
CREATE TABLE public.meta_ads_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_campaign_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  leads INTEGER DEFAULT 0,
  cpm NUMERIC,
  cpc NUMERIC,
  ctr NUMERIC,
  cpl NUMERIC,
  frequency NUMERIC,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meta_campaign_id, snapshot_date)
);

CREATE INDEX idx_meta_ads_daily_date ON public.meta_ads_daily(snapshot_date DESC);
CREATE INDEX idx_meta_ads_daily_campaign ON public.meta_ads_daily(meta_campaign_id);

ALTER TABLE public.meta_ads_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon and auth read meta_ads_daily"
  ON public.meta_ads_daily FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "auth write meta_ads_daily"
  ON public.meta_ads_daily FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Sync run log
CREATE TABLE public.meta_sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  success BOOLEAN,
  campaigns_synced INTEGER DEFAULT 0,
  insights_synced INTEGER DEFAULT 0,
  error TEXT,
  triggered_by TEXT DEFAULT 'cron'
);

ALTER TABLE public.meta_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon and auth read meta_sync_runs"
  ON public.meta_sync_runs FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "auth write meta_sync_runs"
  ON public.meta_sync_runs FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Touch updated_at trigger
CREATE OR REPLACE FUNCTION public.meta_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_campaigns_touch
  BEFORE UPDATE ON public.meta_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.meta_touch_updated_at();

CREATE TRIGGER trg_meta_ads_daily_touch
  BEFORE UPDATE ON public.meta_ads_daily
  FOR EACH ROW EXECUTE FUNCTION public.meta_touch_updated_at();
