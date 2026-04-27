CREATE TABLE public.linkedin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_date date,
  post_type text,
  topic text,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  profile_views integer DEFAULT 0,
  followers_gained integer DEFAULT 0,
  reactions integer DEFAULT 0,
  key_word text,
  link text,
  account_label text DEFAULT 'Christine',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_posts_date ON public.linkedin_posts (post_date DESC);
CREATE INDEX idx_linkedin_posts_type ON public.linkedin_posts (post_type);

ALTER TABLE public.linkedin_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon and auth read linkedin_posts"
  ON public.linkedin_posts FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "auth write linkedin_posts"
  ON public.linkedin_posts FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER linkedin_posts_touch_updated_at
  BEFORE UPDATE ON public.linkedin_posts
  FOR EACH ROW EXECUTE FUNCTION public.meta_touch_updated_at();


CREATE TABLE public.linkedin_weekly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_ending date,
  followers_total integer,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  profile_views integer DEFAULT 0,
  followers_gained numeric DEFAULT 0,
  reactions integer DEFAULT 0,
  account_label text DEFAULT 'Christine',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_weekly_date ON public.linkedin_weekly_metrics (week_ending DESC);

ALTER TABLE public.linkedin_weekly_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon and auth read linkedin_weekly_metrics"
  ON public.linkedin_weekly_metrics FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "auth write linkedin_weekly_metrics"
  ON public.linkedin_weekly_metrics FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER linkedin_weekly_metrics_touch_updated_at
  BEFORE UPDATE ON public.linkedin_weekly_metrics
  FOR EACH ROW EXECUTE FUNCTION public.meta_touch_updated_at();