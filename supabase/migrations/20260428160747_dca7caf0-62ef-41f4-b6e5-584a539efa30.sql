-- ============================================================
-- CLIENTS (multi-tenant for metrics, shared CRM)
-- ============================================================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  color text,
  sort_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read clients" ON public.clients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed the two known clients
INSERT INTO public.clients (slug, name, color, sort_order) VALUES
  ('momentum', 'The Momentum Company', '#C4924A', 0),
  ('intentional-ag', 'Intentional Ag', '#6B8E7F', 1),
  ('breaking-chains', 'Breaking Chains', '#8B3A3A', 2);

-- ============================================================
-- METRIC DEFINITIONS  (one per tracked row, per client)
-- ============================================================
CREATE TABLE public.metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  key text NOT NULL,            -- machine key, e.g. "kajabi_subscribers"
  label text NOT NULL,          -- display label, e.g. "Kajabi Subscribers"
  section text NOT NULL,        -- "EMAIL", "YOUTUBE", "PODCAST", "SOCIAL", "SALES", "PIPELINE", "OPT INS"
  unit text,                    -- "count", "percent", "duration", "currency"
  format text,                  -- "number", "percent", "duration_mmss", "currency"
  source text DEFAULT 'manual', -- "manual" | "kajabi" | "youtube" | "captivate" | "meta" | "linkedin" | "csv_import"
  sort_order integer DEFAULT 0,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, key)
);

CREATE INDEX idx_metric_defs_client ON public.metric_definitions(client_id);
CREATE INDEX idx_metric_defs_section ON public.metric_definitions(client_id, section, sort_order);

ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read metric_definitions" ON public.metric_definitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write metric_definitions" ON public.metric_definitions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- WEEKLY METRIC SNAPSHOTS  (one row = one metric, one week)
-- ============================================================
CREATE TABLE public.weekly_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_definition_id uuid NOT NULL REFERENCES public.metric_definitions(id) ON DELETE CASCADE,
  week_ending date NOT NULL,
  value numeric,            -- numeric form when parseable
  value_text text,          -- raw form, used for things like "4:11" durations
  note text,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_definition_id, week_ending)
);

CREATE INDEX idx_snap_metric ON public.weekly_metric_snapshots(metric_definition_id);
CREATE INDEX idx_snap_week ON public.weekly_metric_snapshots(week_ending);

ALTER TABLE public.weekly_metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon and auth read weekly_metric_snapshots" ON public.weekly_metric_snapshots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth write weekly_metric_snapshots" ON public.weekly_metric_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- CRM: CONTACTS  (shared across clients; can optionally tag a client)
-- ============================================================
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  role text,
  email text,
  phone text,
  source text,           -- "Podcast guest" | "LinkedIn" | "Referral" | "Inbound" | etc.
  stage text NOT NULL DEFAULT 'No Status',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  owner text,
  notes_summary text,
  last_touch_at timestamptz,
  next_followup_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  external_source text,  -- e.g. "folk", "manual", "import"
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_stage ON public.contacts(stage);
CREATE INDEX idx_contacts_client ON public.contacts(client_id);
CREATE INDEX idx_contacts_next_fu ON public.contacts(next_followup_at);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- CRM: NOTES
-- ============================================================
CREATE TABLE public.contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_contact ON public.contact_notes(contact_id, created_at DESC);

ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read contact_notes" ON public.contact_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write contact_notes" ON public.contact_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- CRM: ACTIVITY LOG
-- ============================================================
CREATE TABLE public.contact_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type text NOT NULL,          -- "stage_change" | "note" | "followup_created" | "followup_completed" | "created" | "edited"
  description text,
  metadata jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_contact ON public.contact_activity(contact_id, created_at DESC);

ALTER TABLE public.contact_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read contact_activity" ON public.contact_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write contact_activity" ON public.contact_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- CRM: FOLLOW-UPS
-- ============================================================
CREATE TABLE public.contact_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  description text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_followups_due ON public.contact_follow_ups(due_date) WHERE completed_at IS NULL;
CREATE INDEX idx_followups_contact ON public.contact_follow_ups(contact_id);

ALTER TABLE public.contact_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read contact_follow_ups" ON public.contact_follow_ups FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write contact_follow_ups" ON public.contact_follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TIMESTAMP TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_clients_touch BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_metric_defs_touch BEFORE UPDATE ON public.metric_definitions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_snap_touch BEFORE UPDATE ON public.weekly_metric_snapshots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_contacts_touch BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_followups_touch BEFORE UPDATE ON public.contact_follow_ups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();