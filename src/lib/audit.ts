import { createAdminClient } from '@/lib/supabase/admin'

interface AuditEventInput {
  eventType: string
  fingerprint?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Best-effort audit trail write. Errors are logged but never propagated:
 * auth flows must not fail because logging failed.
 */
export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_logs').insert({
      event_type: input.eventType,
      fingerprint: input.fingerprint ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    })
    if (error) {
      console.error('Audit write error:', error.message)
    }
  } catch (err) {
    console.error('Audit write exception:', err)
  }
}