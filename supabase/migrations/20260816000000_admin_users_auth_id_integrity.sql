-- Repair dangling admin_users.auth_id links and enforce referential integrity.
--
-- Background: auth users were re-provisioned (new ids), leaving admin_users.auth_id
-- pointing to non-existent auth.users rows. The login route and provisioning script
-- only relinked when auth_id was NULL, so stale values persisted.
--
-- Steps:
-- 1. Null out any auth_id that no longer references a valid auth user.
-- 2. Relink by email match (idempotent) — restores known good links immediately.
-- 3. Add FK constraint ON UPDATE CASCADE ON DELETE SET NULL so future auth user
--    deletions/re-provisionings clear the link instead of leaving a dangling ref.
--    The login route (code fix) then heals the NULL at next login.
-- 4. Index on auth_id for the join used by requireAdmin/middleware.

-- 1. Repair dangling links
UPDATE admin_users au
SET auth_id = NULL
WHERE auth_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = au.auth_id);

-- 2. Relink by email (idempotent, no-op when already correct)
UPDATE admin_users au
SET auth_id = u.id
FROM auth.users u
WHERE au.email = u.email
  AND au.auth_id IS DISTINCT FROM u.id;

-- 3. Referential integrity
ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_auth_id_fkey
  FOREIGN KEY (auth_id) REFERENCES auth.users(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- 4. Index for the admin_users(auth_id) join
CREATE INDEX IF NOT EXISTS idx_admin_users_auth_id ON admin_users(auth_id);
