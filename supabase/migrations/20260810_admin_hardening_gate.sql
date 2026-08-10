-- Hardening Security Admin — P0: credentials legacy e seed
-- Date: 20260810

-- FINDING 6: default credential seed (admin123) — remove if present
DELETE FROM public.admin_users
WHERE email = 'admin@fantacer.it'
  AND password_hash = 'admin123';

-- Colonne legacy non usate dal percorso login (password_hash) e MFA
-- non operativa sul client custom (mfa_secret). La MFA viene gestita da
-- Supabase Auth (enroll/challenge/verify, trustee TOTP), non più qui.
ALTER TABLE public.admin_users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.admin_users DROP COLUMN IF EXISTS mfa_secret;