-- Migration: Add vote fields, update submit_vote RPC, update RLS policies
-- Date: 20260508

-- 1. Add new columns to votes table (assumed slider1/slider2/slider3, adjust if plan specifies otherwise)
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS comment TEXT,
ADD COLUMN IF NOT EXISTS adjective TEXT,
ADD COLUMN IF NOT EXISTS slider1 INT,
ADD COLUMN IF NOT EXISTS slider2 INT,
ADD COLUMN IF NOT EXISTS slider3 INT;

-- 2. Update submit_vote RPC to accept new parameters and use md5 for ip_hash
CREATE OR REPLACE FUNCTION submit_vote(
  company_id_param UUID,
  fingerprint_param TEXT,
  ip_param TEXT,
  user_agent_param TEXT,
  country_param TEXT DEFAULT 'IT',
  comment_param TEXT DEFAULT NULL,
  adjective_param TEXT DEFAULT NULL,
  slider1_param INT DEFAULT NULL,
  slider2_param INT DEFAULT NULL,
  slider3_param INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_has_voted BOOLEAN;
BEGIN
  -- Check if voted today
  SELECT EXISTS (
    SELECT 1 FROM votes 
    WHERE fingerprint = fingerprint_param 
    AND created_at::DATE = v_today
  ) INTO v_has_voted;

  IF v_has_voted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hai già votato oggi');
  END IF;

  -- Insert vote with new fields, use md5 for ip_hash as per plan
  INSERT INTO votes (
    company_id, fingerprint, ip_hash, user_agent, country,
    comment, adjective, slider1, slider2, slider3
  )
  VALUES (
    company_id_param, fingerprint_param, md5(ip_param), user_agent_param, country_param,
    comment_param, adjective_param, slider1_param, slider2_param, slider3_param
  );

  -- Update daily stats
  INSERT INTO daily_stats (company_id, date, vote_count)
  VALUES (company_id_param, v_today, 1)
  ON CONFLICT (company_id, date)
  DO UPDATE SET vote_count = daily_stats.vote_count + 1;

  -- Log audit entry
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
      'slider1', slider1_param,
      'slider2', slider2_param,
      'slider3', slider3_param
    )
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_votes_created_at_date ON votes (created_at::DATE);
CREATE INDEX IF NOT EXISTS idx_votes_fingerprint ON votes (fingerprint);
CREATE INDEX IF NOT EXISTS idx_votes_company_id ON votes (company_id);

-- 4. Drop old RLS policies using JWT role check
DROP POLICY IF EXISTS "Admin read votes" ON votes;
DROP POLICY IF EXISTS "Admin read analytics" ON analytics_raw;
DROP POLICY IF EXISTS "Admin read daily_stats" ON daily_stats;
DROP POLICY IF EXISTS "Admin read audit_logs" ON audit_logs;

-- 5. Create new RLS policies using auth.uid() + admin_users
-- Assumes admin_users has user_id column referencing auth.users.id
CREATE POLICY "Admin read votes" ON votes FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

CREATE POLICY "Admin read analytics" ON analytics_raw FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

CREATE POLICY "Admin read daily_stats" ON daily_stats FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

CREATE POLICY "Admin read audit_logs" ON audit_logs FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Remove direct insert policy for votes (only RPC can insert)
DROP POLICY IF EXISTS "Insert votes" ON votes;
