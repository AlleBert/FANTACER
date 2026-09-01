import type { RealtimeChannel } from '@supabase/supabase-js'
import type { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js'
import { REALTIME_LISTEN_TYPES } from '@supabase/realtime-js'
import type {
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
  RealtimePostgresChangesFilter,
} from '@supabase/realtime-js'

type SubscribeCallback = (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void

/**
 * Wraps `RealtimeChannel.subscribe()` in a try/catch so the realtime setup
 * never crashes the page.
 *
 * Su iOS WebKit con site-data bloccati (Safari private browsing, "Prevent
 * Cross-Site Tracking", in-app browser) `new WebSocket()` lancia una
 * SecurityError sincrona ("The operation is insecure.") dentro `subscribe()`.
 * Senza guardia l'eccezione sale ai layout effects della pagina →
 * `global-error.tsx` → `<NextError statusCode={500}/>` fantasma (server 200),
 * identico al bug homepage già tracciato in `tests/e2e/repro-phantom-500.spec.ts`.
 *
 * Il realtime è un enhancement: se non può connettersi (storage bloccati, CSP,
 * rete offline) la pagina continua a funzionare con i fetch; il refresh/polling
 * copre gli aggiornamenti. `safeSubscribe` ritorna il canale (stesso contratto
 * di `.subscribe()`), quindi i cleanup con `removeChannel` restano validi.
 */
export function safeSubscribe(
  channel: RealtimeChannel,
  callback?: SubscribeCallback,
): RealtimeChannel {
  try {
    channel.subscribe(callback)
  } catch {
    // realtime non disponibile: degrada senza crash
  }
  return channel
}

/**
 * Guardia per `RealtimeChannel.on('postgres_changes', ...)`. Con client
 * singleton (`createBrowserClient`) `channel(topic)` deduplica per topic: se
 * un'altra istanza ha già sottoscritto lo stesso topic, la seconda chiamata a
 * `.on()` sul canale già joinato lancia
 * "cannot add `postgres_changes` callbacks for ... after `subscribe()`".
 * Avvolgendo `.on()` in try/catch la pagina degrada senza crash (stessa
 * filosofia di `safeSubscribe`). Ritorna il canale oppure null se il listener
 * non è stato registrato.
 */
export function safeOnPostgresChanges(
  channel: RealtimeChannel,
  filter: RealtimePostgresChangesFilter<`${REALTIME_POSTGRES_CHANGES_LISTEN_EVENT}`>,
  callback: (payload: unknown) => void,
): RealtimeChannel | null {
  try {
    return channel.on(
      `${REALTIME_LISTEN_TYPES.POSTGRES_CHANGES}`,
      filter,
      callback,
    )
  } catch {
    // topic già sottoscritto da un'altra istanza: degrada senza crash
    return null
  }
}
