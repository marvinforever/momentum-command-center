
-- Notion OAuth connections (one row per linked workspace)
CREATE TABLE public.notion_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  workspace_name TEXT,
  workspace_icon TEXT,
  bot_id TEXT,
  access_token TEXT NOT NULL,
  owner_info JSONB,
  -- which Notion databases we mirror into
  calls_database_id TEXT,
  leads_database_id TEXT,
  -- cached property mappings { lovable_field: { notion_property_name, notion_type } }
  calls_property_map JSONB DEFAULT '{}'::jsonb,
  leads_property_map JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notion_connections ENABLE ROW LEVEL SECURITY;

-- Authenticated users only (admin dashboard). Anon must NOT read access_token.
CREATE POLICY "auth read notion_connections"
  ON public.notion_connections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth write notion_connections"
  ON public.notion_connections FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- Sync log
CREATE TABLE public.notion_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type TEXT NOT NULL,            -- 'discovery_call' | 'lead'
  resource_id UUID,
  notion_page_id TEXT,
  action TEXT NOT NULL,                   -- 'create' | 'update' | 'skip'
  success BOOLEAN NOT NULL,
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notion_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read notion_sync_log"
  ON public.notion_sync_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth write notion_sync_log"
  ON public.notion_sync_log FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_notion_sync_log_resource ON public.notion_sync_log(resource_type, resource_id);
CREATE INDEX idx_notion_sync_log_created ON public.notion_sync_log(created_at DESC);

-- Tracking columns on discovery_calls and leads
ALTER TABLE public.discovery_calls
  ADD COLUMN IF NOT EXISTS notion_page_id TEXT,
  ADD COLUMN IF NOT EXISTS notion_synced_at TIMESTAMPTZ;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS notion_page_id TEXT,
  ADD COLUMN IF NOT EXISTS notion_synced_at TIMESTAMPTZ;

-- updated_at trigger for notion_connections (reuse existing helper pattern)
CREATE OR REPLACE FUNCTION public.notion_connections_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notion_connections_updated_at
  BEFORE UPDATE ON public.notion_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.notion_connections_touch_updated_at();
