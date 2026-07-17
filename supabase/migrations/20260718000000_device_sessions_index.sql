-- Migration: Add index on device_sessions.last_used for presence queries
-- Date: 20260718

-- Add unique constraint on fingerprint for upsert
ALTER TABLE device_sessions ADD CONSTRAINT device_sessions_fingerprint_key UNIQUE (fingerprint);

-- Index for presence queries
CREATE INDEX IF NOT EXISTS idx_device_sessions_last_used ON device_sessions (last_used DESC);
