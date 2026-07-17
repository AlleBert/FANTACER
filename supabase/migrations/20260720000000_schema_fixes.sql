-- Migration: Comprehensive schema fixes
-- Fixes: votes PK, REPLICA IDENTITY, CASCADE, indexes, batch column, RLS policies
-- Date: 20260720

-- 1. VOTES: Add PRIMARY KEY and REPLICA IDENTITY
-- id is BIGSERIAL, already unique, just need to declare it as PK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'votes'::regclass AND conname = 'votes_pkey'
  ) THEN
    ALTER TABLE votes ADD PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE votes REPLICA IDENTITY FULL;

-- Drop redundant indexes on votes
DROP INDEX IF EXISTS idx_votes_company_id;
-- Keep idx_votes_company_date (company_id, created_at) and idx_votes_fingerprint (fingerprint, created_at)

-- 2. ANALYTICS_RAW: Add ON DELETE CASCADE to company_id FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'analytics_raw'::regclass
    AND confrelid = 'companies'::regclass
    AND confdeltype = 'a' -- NO ACTION
  ) THEN
    ALTER TABLE analytics_raw
      DROP CONSTRAINT analytics_raw_company_id_fkey,
      ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE analytics_raw REPLICA IDENTITY FULL;

-- 3. DAILY_STATS: Add ON DELETE CASCADE to company_id FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'daily_stats'::regclass
    AND confrelid = 'companies'::regclass
    AND confdeltype = 'a' -- NO ACTION
  ) THEN
    ALTER TABLE daily_stats
      DROP CONSTRAINT daily_stats_company_id_fkey,
      ADD FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE daily_stats REPLICA IDENTITY FULL;

-- 4. COMPANIES: Add batch column if missing
ALTER TABLE companies ADD COLUMN IF NOT EXISTS batch TEXT;

-- Add index for batch queries
CREATE INDEX IF NOT EXISTS idx_companies_batch ON companies (batch);

-- Also add REPLICA IDENTITY for companies
ALTER TABLE companies REPLICA IDENTITY FULL;

-- 5. AUDIT_LOGS: REPLICA IDENTITY
ALTER TABLE audit_logs REPLICA IDENTITY FULL;

-- 6. RLS POLICIES: Ensure admin policies exist for admin_users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'Admin read own admin_users'
  ) THEN
    CREATE POLICY "Admin read own admin_users" ON admin_users
      FOR SELECT USING (auth.uid() = auth_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'Admin update own admin_users'
  ) THEN
    CREATE POLICY "Admin update own admin_users" ON admin_users
      FOR UPDATE USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);
  END IF;
END $$;

-- 7. Update RLS policies to use auth_id-based admin check consistently
-- Drop old JWT-based policies if they exist
DROP POLICY IF EXISTS "Admin read votes" ON votes;
DROP POLICY IF EXISTS "Admin read analytics" ON analytics_raw;
DROP POLICY IF EXISTS "Admin read daily_stats" ON daily_stats;
DROP POLICY IF EXISTS "Admin read audit_logs" ON audit_logs;

-- Recreate with auth_id-based check
CREATE POLICY "Admin read votes" ON votes FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);
CREATE POLICY "Admin read analytics" ON analytics_raw FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);
CREATE POLICY "Admin read daily_stats" ON daily_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);
CREATE POLICY "Admin read audit_logs" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())
);
