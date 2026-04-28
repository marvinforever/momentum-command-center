
-- Captivate shows
CREATE TABLE public.captivate_shows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captivate_show_id text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  artwork_url text,
  link text,
  itunes_url text,
  spotify_url text,
  total_subscribers integer DEFAULT 0,
  raw jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.captivate_shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read captivate_shows" ON public.captivate_shows FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write captivate_shows" ON public.captivate_shows FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Captivate episodes
CREATE TABLE public.captivate_episodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captivate_episode_id text NOT NULL UNIQUE,
  captivate_show_id text NOT NULL,
  show_uuid uuid REFERENCES public.captivate_shows(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  episode_number integer,
  season_number integer,
  episode_type text,
  status text,
  published_date timestamptz,
  duration_seconds integer,
  artwork_url text,
  audio_url text,
  episode_url text,
  total_downloads integer DEFAULT 0,
  raw jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_captivate_episodes_show ON public.captivate_episodes(captivate_show_id);
CREATE INDEX idx_captivate_episodes_published ON public.captivate_episodes(published_date DESC);

ALTER TABLE public.captivate_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read captivate_episodes" ON public.captivate_episodes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write captivate_episodes" ON public.captivate_episodes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Daily downloads per episode
CREATE TABLE public.captivate_episode_downloads_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captivate_episode_id text NOT NULL,
  captivate_show_id text NOT NULL,
  snapshot_date date NOT NULL,
  downloads integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (captivate_episode_id, snapshot_date)
);

CREATE INDEX idx_captivate_dl_show_date ON public.captivate_episode_downloads_daily(captivate_show_id, snapshot_date DESC);

ALTER TABLE public.captivate_episode_downloads_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read captivate_episode_downloads_daily" ON public.captivate_episode_downloads_daily FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write captivate_episode_downloads_daily" ON public.captivate_episode_downloads_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Show-level daily metrics (subscribers, total downloads, listener geo/source snapshots)
CREATE TABLE public.captivate_show_metrics_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captivate_show_id text NOT NULL,
  snapshot_date date NOT NULL,
  total_subscribers integer,
  total_downloads integer,
  geography jsonb,
  sources jsonb,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (captivate_show_id, snapshot_date)
);

ALTER TABLE public.captivate_show_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read captivate_show_metrics_daily" ON public.captivate_show_metrics_daily FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write captivate_show_metrics_daily" ON public.captivate_show_metrics_daily FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sync run log
CREATE TABLE public.captivate_sync_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  success boolean,
  shows_synced integer DEFAULT 0,
  episodes_synced integer DEFAULT 0,
  download_rows_synced integer DEFAULT 0,
  triggered_by text DEFAULT 'manual',
  error text
);

ALTER TABLE public.captivate_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read captivate_sync_runs" ON public.captivate_sync_runs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write captivate_sync_runs" ON public.captivate_sync_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reuse existing updated_at touch pattern
CREATE OR REPLACE FUNCTION public.captivate_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_captivate_shows_updated BEFORE UPDATE ON public.captivate_shows
  FOR EACH ROW EXECUTE FUNCTION public.captivate_touch_updated_at();
CREATE TRIGGER trg_captivate_episodes_updated BEFORE UPDATE ON public.captivate_episodes
  FOR EACH ROW EXECUTE FUNCTION public.captivate_touch_updated_at();
CREATE TRIGGER trg_captivate_dl_updated BEFORE UPDATE ON public.captivate_episode_downloads_daily
  FOR EACH ROW EXECUTE FUNCTION public.captivate_touch_updated_at();
CREATE TRIGGER trg_captivate_show_metrics_updated BEFORE UPDATE ON public.captivate_show_metrics_daily
  FOR EACH ROW EXECUTE FUNCTION public.captivate_touch_updated_at();
