-- Rate limiting table for API route protection

CREATE TABLE IF NOT EXISTS public.rate_limits (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_time TIMESTAMPTZ NOT NULL
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service_role can access rate limits
DROP POLICY IF EXISTS "Service role only for rate_limits" ON public.rate_limits;
CREATE POLICY "Service role only for rate_limits" ON public.rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- Atomic rate limit check + increment
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  ip_param TEXT,
  window_ms INTEGER DEFAULT 3600000,
  max_requests INTEGER DEFAULT 100
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  record_count INTEGER;
  record_reset TIMESTAMPTZ;
BEGIN
  SELECT count, reset_time INTO record_count, record_reset
  FROM public.rate_limits
  WHERE ip = ip_param
  FOR UPDATE;

  IF NOT FOUND OR now_ts > record_reset THEN
    INSERT INTO public.rate_limits (ip, count, reset_time)
    VALUES (ip_param, 1, now_ts + (window_ms || ' milliseconds')::INTERVAL)
    ON CONFLICT (ip) DO UPDATE
    SET count = 1, reset_time = now_ts + (window_ms || ' milliseconds')::INTERVAL;
    RETURN TRUE;
  END IF;

  IF record_count >= max_requests THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limits
  SET count = count + 1
  WHERE ip = ip_param;
  RETURN TRUE;
END;
$$;
