-- Add MFA verification timestamp for 24h session expiry
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;
