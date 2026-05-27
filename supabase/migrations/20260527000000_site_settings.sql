-- Site settings table for feature flags (e.g. coming-soon toggle)

CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.site_settings (key, value)
VALUES ('coming_soon_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Policy: public can read (for the public API using anon key)
DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;
CREATE POLICY "Public read site_settings" ON public.site_settings
  FOR SELECT USING (true);

-- Policy: only service role can write (for admin API)
DROP POLICY IF EXISTS "Service role only for site_settings" ON public.site_settings;
CREATE POLICY "Service role only for site_settings" ON public.site_settings
  FOR ALL USING (auth.role() = 'service_role');
