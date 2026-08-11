-- Migration: Add auth_id column to admin_users
-- Date: 20260511

-- Add auth_id column to link with Supabase Auth
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- Update RLS policies to use auth_id instead of id
DROP POLICY IF EXISTS "Admin read votes" ON votes;
CREATE POLICY "Admin read votes" ON votes FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin read analytics" ON analytics_raw;
CREATE POLICY "Admin read analytics" ON analytics_raw FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin read daily_stats" ON daily_stats;
CREATE POLICY "Admin read daily_stats" ON daily_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin read audit_logs" ON audit_logs;
CREATE POLICY "Admin read audit_logs" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);