-- Migration: Add admin_users.role column (admin | viewer)
-- Date: 20260811

-- Ruolo dell'utente admin: 'admin' (privilegi completi, MFA TOTP obbligatoria)
-- oppure 'viewer' (read-only, nessuna MFA in questa fase).
-- Default 'admin' backfilla automaticamente le righe esistenti.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin'
  CHECK (role IN ('admin', 'viewer'));