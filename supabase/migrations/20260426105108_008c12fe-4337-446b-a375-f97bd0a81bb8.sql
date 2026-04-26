
-- Allow anon (and authenticated) to READ all 8 dashboard tables.
-- Writes remain restricted to authenticated users only.

DROP POLICY IF EXISTS "auth read lead_magnets" ON public.lead_magnets;
CREATE POLICY "anon and auth read lead_magnets" ON public.lead_magnets
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read offers" ON public.offers;
CREATE POLICY "anon and auth read offers" ON public.offers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read campaigns" ON public.campaigns;
CREATE POLICY "anon and auth read campaigns" ON public.campaigns
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read content" ON public.content;
CREATE POLICY "anon and auth read content" ON public.content
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read leads" ON public.leads;
CREATE POLICY "anon and auth read leads" ON public.leads
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read lead_content" ON public.lead_content;
CREATE POLICY "anon and auth read lead_content" ON public.lead_content
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read discovery_calls" ON public.discovery_calls;
CREATE POLICY "anon and auth read discovery_calls" ON public.discovery_calls
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth read channel_metrics" ON public.channel_metrics;
CREATE POLICY "anon and auth read channel_metrics" ON public.channel_metrics
  FOR SELECT TO anon, authenticated USING (true);
