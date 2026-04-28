-- Schedule Kajabi syncs at 5:30 AM, 12 PM, and 8 PM Eastern (EDT = UTC-4)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kajabi-sync-morning') THEN
    PERFORM cron.unschedule('kajabi-sync-morning');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kajabi-sync-noon') THEN
    PERFORM cron.unschedule('kajabi-sync-noon');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kajabi-sync-evening') THEN
    PERFORM cron.unschedule('kajabi-sync-evening');
  END IF;
END $$;

SELECT cron.schedule(
  'kajabi-sync-morning',
  '30 9 * * *',
  $$ SELECT net.http_post(
    url:='https://project--3b0f7e18-38a9-40fc-b75b-8eb0dc54ae6d.lovable.app/api/public/kajabi-sync?resource=all',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'kajabi-sync-noon',
  '0 16 * * *',
  $$ SELECT net.http_post(
    url:='https://project--3b0f7e18-38a9-40fc-b75b-8eb0dc54ae6d.lovable.app/api/public/kajabi-sync?resource=all',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'kajabi-sync-evening',
  '0 0 * * *',
  $$ SELECT net.http_post(
    url:='https://project--3b0f7e18-38a9-40fc-b75b-8eb0dc54ae6d.lovable.app/api/public/kajabi-sync?resource=all',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);