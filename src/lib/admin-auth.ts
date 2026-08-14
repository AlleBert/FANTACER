import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AuthenticatorAssuranceLevels, User } from '@supabase/auth-js'

export class AdminAuthError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

export type AdminRole = 'admin' | 'viewer'

export interface AdminContext {
  user: User
  aal: AuthenticatorAssuranceLevels
  role: AdminRole
}

// MFA validity duration: 24 hours
const MFA_VALIDITY_MS = 24 * 60 * 60 * 1000

/**
 * Server-side gate for all admin routes — cookie-based session only.
 *
 * 1. `getUser()` (never `getSession()`): validates the JWT against GoTrue
 *    and refreshes the session cookie if possible.
 * 2. `admin_users` authorization: `auth_id` must match the authenticated
 *    user and `is_active` must be true.
 * 3. AAL enforcement depending on role: `admin` must be at `aal2` (MFA
 *    TOTP obbligatoria); `viewer` is allowed at `aal1` (nessuna MFA).
 * 4. MFA expiry: for `admin` role, MFA verification must be within 24h.
 *
 * The service role client must be instantiated by the caller only AFTER
 * this gate passes.
 */
export async function requireAdmin(
  _request: NextRequest,
  opts?: { minAal?: AuthenticatorAssuranceLevels },
): Promise<AdminContext> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AdminAuthError(401, 'Non autorizzato')
  }

  const adminSupabase = createAdminClient()
  const { data: adminUser } = await adminSupabase
    .from('admin_users')
    .select('id, role, mfa_verified_at')
    .eq('auth_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminUser) {
    throw new AdminAuthError(403, 'Accesso negato')
  }

  const role: AdminRole = adminUser.role === 'viewer' ? 'viewer' : 'admin'
  const minAal = opts?.minAal ?? (role === 'admin' ? 'aal2' : 'aal1')
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const aal: AuthenticatorAssuranceLevels = level?.currentLevel ?? 'aal1'

  if (aal < minAal) {
    throw new AdminAuthError(403, 'MFA richiesta')
  }

  // Check MFA expiry for admin role requiring AAL2
  if (role === 'admin' && minAal === 'aal2' && aal >= 'aal2') {
    const mfaVerifiedAt = adminUser.mfa_verified_at
    if (!mfaVerifiedAt) {
      // MFA never verified or timestamp missing - require re-verification
      throw new AdminAuthError(403, 'MFA scaduta', 'mfa_expired')
    }
    
    const verifiedTime = new Date(mfaVerifiedAt).getTime()
    const now = Date.now()
    
    if (now - verifiedTime > MFA_VALIDITY_MS) {
      // MFA expired - require re-verification
      throw new AdminAuthError(403, 'MFA scaduta', 'mfa_expired')
    }
  }

  return { user, aal, role }
}

/**
 * Role-aware gate for admin-only operations (writes, privileged export).
 * Requires a valid `admin` role AND its MFA level (`aal2`); `viewer` is
 * rejected before any privileged access.
 */
export async function requireRoleAdmin(
  request: NextRequest,
): Promise<AdminContext> {
  const ctx = await requireAdmin(request)
  if (ctx.role !== 'admin') {
    throw new AdminAuthError(403, 'Operazione consentita solo agli admin')
  }
  return ctx
}

export function toAdminError(e: unknown): number {
  if (e instanceof AdminAuthError) return e.status
  return 500
}

export function getAdminErrorCode(e: unknown): string | undefined {
  if (e instanceof AdminAuthError) return e.code
  return undefined
}