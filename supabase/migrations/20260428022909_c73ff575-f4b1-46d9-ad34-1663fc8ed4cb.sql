-- Backfill kajabi_form_submissions.submitted_at from matching lead's first_touch_date
-- (or created_at) since Kajabi's form_submissions API doesn't return a timestamp.
-- Only updates rows that were stamped to today's bulk-import date.
UPDATE public.kajabi_form_submissions f
SET submitted_at = COALESCE(l.first_touch_date::timestamptz, l.created_at)
FROM public.leads l
WHERE f.contact_email IS NOT NULL
  AND lower(f.contact_email) = lower(l.email)
  AND f.submitted_at::date = '2026-04-28'
  AND COALESCE(l.first_touch_date::timestamptz, l.created_at) IS NOT NULL
  AND COALESCE(l.first_touch_date::timestamptz, l.created_at) < '2026-04-28';