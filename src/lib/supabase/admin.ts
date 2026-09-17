import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client service-role memoizzato.
 *
 * Il client è stateless per le nostre operazioni (nessuna sessione utente,
 * `persistSession`/`autoRefreshToken` off), quindi può essere riusato tra le
 * richieste di una stessa istanza serverless. Evita di ricostruire l'oggetto
 * (e il suo fetch wrapper) a ogni chiamata — nel path del voto ne venivano
 * creati fino a 3 per richiesta.
 */
let adminClient: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }

  return adminClient
}
