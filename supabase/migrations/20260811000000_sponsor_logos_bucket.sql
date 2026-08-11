-- Migration: sponsor logos storage bucket
-- Date: 20260811

-- Public bucket for sponsor logo uploads (read via unauthenticated URL).
-- Writes are done by a service-role client which bypasses RLS.
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor-logos', 'sponsor-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sponsor_logos_public_select" ON storage.objects;
CREATE POLICY "sponsor_logos_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'sponsor-logos');
