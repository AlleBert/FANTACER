-- Robust Voting Protection - Migration
-- This script handles existing objects to avoid "already exists" errors.

-- 1. Companies table (EXISTS, so we skip or update)
-- (Already exists, Skipping)

-- 2. Votes table (EXISTS, so we skip or update)
-- (Already exists, Skipping)

-- 3. Analytics raw (EXISTS, so we skip or update)
-- (Already exists, Skipping)

-- 4. Daily stats (EXISTS, so we skip or update)
-- (Already exists, Skipping)

-- 5. Admin users (EXISTS, so we skip or update)
-- (Already exists, Skipping)

-- 6. Device sessions (EXISTS, so we skip or update)
-- (Already exists, Skipping)

-- 7. Audit logs (New table)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Safe to run multiple times)
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analytics_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- Handle Policies (Drop if exists and recreate to ensure they match the plan)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public read companies" ON companies;
    CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Admin read votes" ON votes;
    CREATE POLICY "Admin read votes" ON votes FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
    
    -- Restrict direct insert on votes (if it was previously allowed)
    DROP POLICY IF EXISTS "Insert votes" ON votes;

    DROP POLICY IF EXISTS "Admin read analytics" ON analytics_raw;
    CREATE POLICY "Admin read analytics" ON analytics_raw FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
    
    DROP POLICY IF EXISTS "Insert analytics" ON analytics_raw;
    CREATE POLICY "Insert analytics" ON analytics_raw FOR INSERT WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Admin read daily_stats" ON daily_stats;
    CREATE POLICY "Admin read daily_stats" ON daily_stats FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
    
    DROP POLICY IF EXISTS "Admin read audit_logs" ON audit_logs;
    CREATE POLICY "Admin read audit_logs" ON audit_logs FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
END $$;

-- RPC submit_vote (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION submit_vote(
  company_id_param UUID, 
  fingerprint_param TEXT,
  ip_param TEXT,
  user_agent_param TEXT,
  country_param TEXT DEFAULT 'IT'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_has_voted BOOLEAN;
BEGIN
  -- 1. Check if voted today
  SELECT EXISTS (
    SELECT 1 FROM votes 
    WHERE fingerprint = fingerprint_param 
    AND created_at::DATE = v_today
  ) INTO v_has_voted;

  IF v_has_voted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hai già votato oggi');
  END IF;

  -- 2. Insert vote
  INSERT INTO votes (company_id, fingerprint, ip_hash, user_agent, country)
  VALUES (company_id_param, fingerprint_param, ip_param, user_agent_param, country_param);

  -- 3. Update stats
  INSERT INTO daily_stats (company_id, date, vote_count)
  VALUES (company_id_param, v_today, 1)
  ON CONFLICT (company_id, date)
  DO UPDATE SET vote_count = daily_stats.vote_count + 1;

  -- 4. Log to audit
  INSERT INTO audit_logs (event_type, fingerprint, ip_address, user_agent, metadata)
  VALUES ('vote_submitted', fingerprint_param, ip_param, user_agent_param, jsonb_build_object('company_id', company_id_param));

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
