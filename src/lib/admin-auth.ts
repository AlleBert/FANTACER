import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AuthenticatorAssuranceLevels, User } from '@supabase/auth-js'

export class AdminAuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

export interface AdminContext {
  user: User
  aal: AuthenticatorAssuranceLevels
}

/**
 * Server-side gate for all admin routes — cookie-based session only.
 *
 * 1. `getUser()` (never `getSession()`): validates the JWT against GoTrue
 *    and refreshes the session cookie if possible.
 * 2. `admin_users` authorization: `auth_id` must match the authenticated
 *    user and `is_active` must be true.
 * 3. AAL enforcement: when `minAal` is requested (default for admin data
 *    routes) the session must already be at `aal2`; a session at `aal1`
 *    (password-only) is rejected before any privileged access.
 *
 * The service role client must be instantiated by the caller only AFTER
 * this gate passes.
 */
export async function requireAdmin(
  request: NextRequest,
  opts?: { minAal: AuthenticatorAssuranceLevels },
): Promise<AdminContext> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AdminAuthError(401, 'Non autorizzato')
  }

  const adminSupabase = createAdminClient()
  const { data: adminUser } = await adminSupabase
    .from('admin_users')
    .select('id')
    .eq('auth_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminUser) {
    throw new AdminAuthError(403, 'Accesso negato')
  }

  const minAal = opts?.minAal ?? 'aal2'
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const aal: AuthenticatorAssuranceLevels = level?.currentLevel ?? 'aal1'

  if (aal < minAal) {
    throw new AdminAuthError(403, 'MFA richiesta')
  }

  return { user, aal }
}

export function toAdminError(e: unknown): number {
  if (e instanceof AdminAuthError) return e.status
  return 500
}