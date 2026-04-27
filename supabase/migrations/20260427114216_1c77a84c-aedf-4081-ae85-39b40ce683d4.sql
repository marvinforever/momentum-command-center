-- Ad Sets
CREATE TABLE IF NOT EXISTS public.meta_adsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_adset_id text NOT NULL UNIQUE,
  meta_campaign_id text NOT NULL,
  name text NOT NULL,
  status text,
  optimization_goal text,
  billing_event text,
  bid_strategy text,
  daily_budget numeric,
  lifetime_budget numeric,
  start_time timestamptz,
  end_time timestamptz,
  targeting jsonb,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON public.meta_adsets(meta_campaign_id);

ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read meta_adsets" ON public.meta_adsets
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write meta_adsets" ON public.meta_adsets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_meta_adsets_touch
  BEFORE UPDATE ON public.meta_adsets
  FOR EACH ROW EXECUTE FUNCTION public.meta_touch_updated_at();

-- Ads (with creative)
CREATE TABLE IF NOT EXISTS public.meta_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_ad_id text NOT NULL UNIQUE,
  meta_adset_id text NOT NULL,
  meta_campaign_id text NOT NULL,
  name text NOT NULL,
  status text,
  effective_status text,
  -- creative fields
  creative_id text,
  creative_name text,
  title text,
  body text,
  cta_type text,
  link_url text,
  display_url text,
  thumbnail_url text,
  image_url text,
  video_id text,
  permalink_url text,
  instagram_permalink_url text,
  object_type text,
  -- quality rankings (from insights)
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  raw jsonb,
  creative_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON public.meta_ads(meta_adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON public.meta_ads(meta_campaign_id);

ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read meta_ads" ON public.meta_ads
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write meta_ads" ON public.meta_ads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_meta_ads_touch
  BEFORE UPDATE ON public.meta_ads
  FOR EACH ROW EXECUTE FUNCTION public.meta_touch_updated_at();

-- Daily insights at AdSet level
CREATE TABLE IF NOT EXISTS public.meta_adsets_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_adset_id text NOT NULL,
  meta_campaign_id text NOT NULL,
  snapshot_date date NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  clicks integer DEFAULT 0,
  spend numeric DEFAULT 0,
  leads integer DEFAULT 0,
  cpm numeric,
  cpc numeric,
  ctr numeric,
  cpl numeric,
  frequency numeric,
  post_reactions integer DEFAULT 0,
  post_comments integer DEFAULT 0,
  post_shares integer DEFAULT 0,
  video_views integer DEFAULT 0,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_adset_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_daily_campaign ON public.meta_adsets_daily(meta_campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_daily_date ON public.meta_adsets_daily(snapshot_date);

ALTER TABLE public.meta_adsets_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read meta_adsets_daily" ON public.meta_adsets_daily
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write meta_adsets_daily" ON public.meta_adsets_daily
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_meta_adsets_daily_touch
  BEFORE UPDATE ON public.meta_adsets_daily
  FOR EACH ROW EXECUTE FUNCTION public.meta_touch_updated_at();

-- Daily insights at Ad level
CREATE TABLE IF NOT EXISTS public.meta_ads_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_ad_id text NOT NULL,
  meta_adset_id text NOT NULL,
  meta_campaign_id text NOT NULL,
  snapshot_date date NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  clicks integer DEFAULT 0,
  spend numeric DEFAULT 0,
  leads integer DEFAULT 0,
  cpm numeric,
  cpc numeric,
  ctr numeric,
  cpl numeric,
  frequency numeric,
  post_reactions integer DEFAULT 0,
  post_comments integer DEFAULT 0,
  post_shares integer DEFAULT 0,
  video_views integer DEFAULT 0,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_ad_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_meta_ads_insights_daily_adset ON public.meta_ads_insights_daily(meta_adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_insights_daily_campaign ON public.meta_ads_insights_daily(meta_campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_insights_daily_date ON public.meta_ads_insights_daily(snapshot_date);

ALTER TABLE public.meta_ads_insights_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read meta_ads_insights_daily" ON public.meta_ads_insights_daily
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write meta_ads_insights_daily" ON public.meta_ads_insights_daily
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_meta_ads_insights_daily_touch
  BEFORE UPDATE ON public.meta_ads_insights_daily
  FOR EACH ROW EXECUTE FUNCTION public.meta_touch_updated_at();

-- Track sync counts at finer levels
ALTER TABLE public.meta_sync_runs ADD COLUMN IF NOT EXISTS adsets_synced integer DEFAULT 0;
ALTER TABLE public.meta_sync_runs ADD COLUMN IF NOT EXISTS ads_synced integer DEFAULT 0;
ALTER TABLE public.meta_sync_runs ADD COLUMN IF NOT EXISTS adset_insights_synced integer DEFAULT 0;
ALTER TABLE public.meta_sync_runs ADD COLUMN IF NOT EXISTS ad_insights_synced integer DEFAULT 0;