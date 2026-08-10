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
 * Server-side gate for all admin routes.
 *
 * P0 transition: accepts a Bearer token from the Authorization header (legacy
 * localStorage session). Once P1 lands the cookie session, the Bearer branch is
 * removed and `createClient()` (HttpOnly cookie) is the only source of truth.
 *
 * The service role client (`createAdminClient`) is deliberately NOT exported
 * here: routes must instantiate it only AFTER this gate passes.
 */
export async function requireAdmin(
  request: NextRequest,
  opts?: { minAal: AuthenticatorAssuranceLevels },
): Promise<AdminContext> {
  const adminSupabase = createAdminClient()
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  const { data: { user }, error } = token
    ? await adminSupabase.auth.getUser(token)
    : { data: { user: null }, error: new Error('missing bearer token') }

  if (error || !user) {
    throw new AdminAuthError(401, 'Non autorizzato')
  }

  const { data: adminUser } = await adminSupabase
    .from('admin_users')
    .select('id')
    .eq('auth_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminUser) {
    throw new AdminAuthError(403, 'Accesso negato')
  }

  let aal: AuthenticatorAssuranceLevels = 'aal1'
  if (opts?.minAal) {
    const client = await createClient()
    const { data: level } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    const currentLevel = level?.currentLevel ?? 'aal1'
    aal = currentLevel
    if (currentLevel < opts.minAal) {
      throw new AdminAuthError(403, 'MFA richiesta')
    }
  }

  return { user, aal }
}

export function toAdminError(e: unknown): number {
  if (e instanceof AdminAuthError) return e.status
  return 500
}