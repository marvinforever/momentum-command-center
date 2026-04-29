-- Add source_config to metric_definitions for auto-rollup mapping
ALTER TABLE public.metric_definitions
  ADD COLUMN IF NOT EXISTS source_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add unique constraint on (metric_definition_id, week_ending) so upserts work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weekly_metric_snapshots_def_week_uniq'
  ) THEN
    ALTER TABLE public.weekly_metric_snapshots
      ADD CONSTRAINT weekly_metric_snapshots_def_week_uniq
      UNIQUE (metric_definition_id, week_ending);
  END IF;
END $$;

-- Track rollup runs for visibility/debugging
CREATE TABLE IF NOT EXISTS public.weekly_rollup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  weeks_processed int DEFAULT 0,
  snapshots_written int DEFAULT 0,
  metrics_processed int DEFAULT 0,
  triggered_by text DEFAULT 'cron',
  success boolean,
  error text,
  details jsonb
);

ALTER TABLE public.weekly_rollup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon and auth read weekly_rollup_runs" ON public.weekly_rollup_runs;
CREATE POLICY "anon and auth read weekly_rollup_runs"
  ON public.weekly_rollup_runs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "auth write weekly_rollup_runs" ON public.weekly_rollup_runs;
CREATE POLICY "auth write weekly_rollup_runs"
  ON public.weekly_rollup_runs FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);
