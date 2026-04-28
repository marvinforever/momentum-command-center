CREATE OR REPLACE FUNCTION public.analyst_run_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  lower_q text := lower(btrim(query));
BEGIN
  IF lower_q !~ '^(select|with)\s' THEN
    RAISE EXCEPTION 'Only SELECT/WITH queries are allowed';
  END IF;
  IF lower_q ~ '\m(insert|update|delete|drop|alter|truncate|create|grant|revoke)\M' THEN
    RAISE EXCEPTION 'Mutations are not allowed';
  END IF;

  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query || ') t'
    INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.analyst_run_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analyst_run_sql(text) TO service_role;