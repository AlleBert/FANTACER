-- FANTACER Database Schema
-- Run these in Supabase SQL Editor

-- 1. Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  image_url TEXT,
  description TEXT,
  batch TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies USING gin(to_tsvector('italian', name));
CREATE INDEX IF NOT EXISTS idx_companies_batch ON companies (batch);

ALTER TABLE companies REPLICA IDENTITY FULL;

-- 2. Votes table
CREATE TABLE IF NOT EXISTS votes (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  country TEXT,
  comment TEXT,
  adjective TEXT,
  slider_innovation INT CHECK (slider_innovation BETWEEN 0 AND 100),
  slider_sales INT CHECK (slider_sales BETWEEN 0 AND 100),
  slider_wow INT CHECK (slider_wow BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for votes
CREATE INDEX IF NOT EXISTS idx_votes_company_date ON votes (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_votes_fingerprint ON votes (fingerprint, created_at);

ALTER TABLE votes REPLICA IDENTITY FULL;

-- 3. Analytics raw (for detailed tracking)
CREATE TABLE IF NOT EXISTS analytics_raw (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  fingerprint TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ip_hash TEXT,
  user_agent TEXT,
  country TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  duration_seconds INTEGER,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_raw (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_raw (event_type, created_at);

ALTER TABLE analytics_raw REPLICA IDENTITY FULL;

-- 4. Daily stats (pre-aggregated)
CREATE TABLE IF NOT EXISTS daily_stats (
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  vote_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  PRIMARY KEY (company_id, date)
);

ALTER TABLE daily_stats REPLICA IDENTITY FULL;

-- 5. Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  mfa_secret TEXT,
  auth_id UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 6. Device sessions (for presence tracking and email recovery)
CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_sessions_last_used ON device_sessions (last_used DESC);

-- 7. Audit logs for fraud detection
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs REPLICA IDENTITY FULL;

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Companies: readable by all
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);

-- Admin read policies using auth_id-based check
CREATE POLICY "Admin read votes" ON votes FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);

CREATE POLICY "Admin read analytics" ON analytics_raw FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);
CREATE POLICY "Insert analytics" ON analytics_raw FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin read daily_stats" ON daily_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);

CREATE POLICY "Admin read audit_logs" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);

-- Admin users self-management
CREATE POLICY "Admin read own admin_users" ON admin_users FOR SELECT USING (
  auth.uid() = auth_id
);
CREATE POLICY "Admin update own admin_users" ON admin_users FOR UPDATE USING (
  auth.uid() = auth_id
) WITH CHECK (auth.uid() = auth_id);

-- Function to submit vote securely
CREATE OR REPLACE FUNCTION submit_vote(
  company_id_param UUID,
  fingerprint_param TEXT,
  ip_param TEXT,
  user_agent_param TEXT,
  country_param TEXT DEFAULT 'IT',
  comment_param TEXT DEFAULT NULL,
  adjective_param TEXT DEFAULT NULL,
  slider_innovation_param INT DEFAULT NULL,
  slider_sales_param INT DEFAULT NULL,
  slider_wow_param INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_has_voted BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM votes
    WHERE fingerprint = fingerprint_param
    AND created_at::DATE = v_today
  ) INTO v_has_voted;

  IF v_has_voted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hai già votato oggi');
  END IF;

  INSERT INTO votes (
    company_id, fingerprint, ip_hash, user_agent, country,
    comment, adjective, slider_innovation, slider_sales, slider_wow
  )
  VALUES (
    company_id_param, fingerprint_param, md5(ip_param), user_agent_param, country_param,
    comment_param, adjective_param, slider_innovation_param, slider_sales_param, slider_wow_param
  );

  INSERT INTO daily_stats (company_id, date, vote_count)
  VALUES (company_id_param, v_today, 1)
  ON CONFLICT (company_id, date)
  DO UPDATE SET vote_count = daily_stats.vote_count + 1;

  INSERT INTO audit_logs (event_type, fingerprint, ip_address, user_agent, metadata)
  VALUES (
    'vote_submitted',
    fingerprint_param,
    ip_param,
    user_agent_param,
    jsonb_build_object(
      'company_id', company_id_param,
      'comment', comment_param,
      'adjective', adjective_param,
      'slider_innovation', slider_innovation_param,
      'slider_sales', slider_sales_param,
      'slider_wow', slider_wow_param
    )
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
