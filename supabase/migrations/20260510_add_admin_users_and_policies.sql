-- Migration: Add admin_users table and RLS policies
-- Date: 20260510

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  mfa_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  auth_id UUID UNIQUE
);

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 2. Update RLS policies to use admin_users.auth_id instead of id
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

-- 3. Create a test admin user (password: 'admin123' - CHANGE IN PRODUCTION)
-- This is a placeholder - in production you would use proper password hashing
INSERT INTO admin_users (email, password_hash, is_active)
VALUES ('admin@fantacer.it', 'admin123', true)
ON CONFLICT (email) DO NOTHING;