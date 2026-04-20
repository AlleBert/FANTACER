-- FANTACER Database Schema
-- Run these in Supabase SQL Editor

-- 1. Companies table (readonly during fiera)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for search
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies USING gin(to_tsvector('italian', name));

-- 2. Votes table (partitioned by day for performance)
CREATE TABLE IF NOT EXISTS votes (
  id BIGSERIAL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ranking queries
CREATE INDEX IF NOT EXISTS idx_votes_company_date ON votes (company_id, created_at);

-- Index for duplicate vote check
CREATE INDEX IF NOT EXISTS idx_votes_fingerprint ON votes (fingerprint, created_at);

-- 3. Analytics raw (for detailed tracking)
CREATE TABLE IF NOT EXISTS analytics_raw (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  fingerprint TEXT,
  company_id UUID REFERENCES companies(id),
  ip_hash TEXT,
  user_agent TEXT,
  country TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  duration_seconds INTEGER,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_raw (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_raw (event_type, created_at);

-- 4. Daily stats (pre-aggregated)
CREATE TABLE IF NOT EXISTS daily_stats (
  company_id UUID REFERENCES companies(id),
  date DATE NOT NULL,
  vote_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  PRIMARY KEY (company_id, date)
);

-- 5. Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  mfa_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 6. Device sessions (for optional email recovery)
CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Companies: readable by all
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);

-- Votes: readable by admin only
CREATE POLICY "Admin read votes" ON votes FOR SELECT USING (
  auth.jwt() ->> 'role' = 'admin'
);
CREATE POLICY "Insert votes" ON votes FOR INSERT WITH CHECK (true);

-- Analytics: readable by admin only
CREATE POLICY "Admin read analytics" ON analytics_raw FOR SELECT USING (
  auth.jwt() ->> 'role' = 'admin'
);
CREATE POLICY "Insert analytics" ON analytics_raw FOR INSERT WITH CHECK (true);

-- Daily stats: admin only
CREATE POLICY "Admin read daily_stats" ON daily_stats FOR SELECT USING (
  auth.jwt() ->> 'role' = 'admin'
);
CREATE POLICY "Admin update daily_stats" ON daily_stats FOR UPDATE USING (
  auth.jwt() ->> 'role' = 'admin'
);

-- Admin users: no public access
CREATE POLICY "Admin manage admins" ON admin_users FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);

-- Device sessions
CREATE POLICY "Manage own sessions" ON device_sessions FOR ALL USING (true);

-- Function to increment vote
CREATE OR REPLACE FUNCTION increment_vote(company_id_param UUID, date_param DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO daily_stats (company_id, date, vote_count)
  VALUES (company_id_param, date_param, 1)
  ON CONFLICT (company_id, date)
  DO UPDATE SET vote_count = daily_stats.vote_count + 1;
END;
$$;