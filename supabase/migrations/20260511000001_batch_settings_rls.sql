-- Enable RLS on batch_settings table
-- This migration creates the table if it doesn't exist and enables RLS

-- Create table if it doesn't exist (for fresh setups)
CREATE TABLE IF NOT EXISTS public.batch_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  active_batch TEXT DEFAULT 'TEST',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO public.batch_settings (id, active_batch)
VALUES ('default', 'TEST')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.batch_settings ENABLE ROW LEVEL SECURITY;

-- Policy: only service role (admin) can access
DROP POLICY IF EXISTS "Service role only for batch_settings" ON public.batch_settings;
CREATE POLICY "Service role only for batch_settings" ON public.batch_settings
  FOR ALL USING (auth.role() = 'service_role');