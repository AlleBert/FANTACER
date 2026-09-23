# P0-4 — Identità server-side (design)

> **Stato: design. Nessuna migration applicata, nessun cutover.**
> L'implementazione e le migration partono solo dopo approvazione di questo
> documento e della compatibilità con chi ha **già votato**.

## Obiettivo

Rendere l'identità di voto **server-side**: il client non può rigenerarla per
votare una seconda volta. Fino a P0-4 il sistema è *mitigato* (Turnstile,
rate limit, ACL) ma un utente può ancora rigenerare l'UUID e rivotare.

## Non-obiettivi

- Non eliminare il dedup legacy `(fingerprint, vote_day)` finché il backfill e
  il dual-read non sono verificati.
- Non modificare gli input Admin (`site_settings`, `batch_settings`).
- Non introdurre fail-open: in caso di errore di lookup si ricade sul legacy,
  **mai** si consente un nuovo voto.

## Perché dual-read/dual-write

Il deploy di P0-4 **non deve azzerare l'identità** dei browser che hanno già
votato: se un browser con fingerprint pregresso non venisse agganciato al suo
principal, il solo deploy consentirebbe un secondo voto. Da qui l'obbligo di
dual-read/dual-write e backfill prima di qualsiasi cutover.

## Modello dati (additivo)

### `events`
| colonna | tipo | note |
|---|---|---|
| `id` | uuid pk | |
| `slug` | text unique | |
| `name` | text | |
| `batch` | text unique | mappa su `batch_settings.active_batch` |
| `starts_at` / `ends_at` | timestamptz | finestra voto |
| `status` | text | `draft`/`active`/`archived` |

L'evento attivo = `events.batch = batch_settings.active_batch AND status='active'`.
Nessuna nuova UI Admin in P0-4a.

### `event_principals`
| colonna | tipo | note |
|---|---|---|
| `id` | uuid pk | |
| `event_id` | uuid fk `events` | |
| `legacy_fingerprint` | text nullable | `v1:<uuid>` (identità attuale) |
| `created_at` | timestamptz | |
| — | unique(`event_id`, `legacy_fingerprint`) | idempotenza backfill |

### `voter_sessions`
| colonna | tipo | note |
|---|---|---|
| `id` | uuid pk | |
| `event_id` | uuid fk | |
| `principal_id` | uuid fk `event_principals` | |
| `token_hash` | text | **solo hash**, mai il token |
| `key_id` | text | rotazione |
| `created_at` / `last_seen_at` | timestamptz | |
| `expires_at` | timestamptz | |
| `revoked_at` | timestamptz nullable | |
| — | unique(`event_id`, `token_hash`) | |

### `vote_sessions` (estensioni)
- `event_id uuid` (nullable → poi NOT NULL)
- `principal_id uuid` (nullable → poi NOT NULL)
- `fingerprint` **mantenuto** per compatibilità e rollback.

## Cookie di sessione

- Nome: `fantacer_session`.
- Valore: `key_id.token` (token = 32 byte random base64url).
- `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` entro la fine evento.
- Server salva `token_hash = HMAC-SHA256(SESSION_HMAC_KEY, key_id || token)`
  (keyring con più `key_id` per la rotazione; le sessioni nuove usano il corrente).

## Risoluzione identità (dual-read)

Ordine:
1. Cookie sessione valido → `voter_sessions` → `principal`.
2. Altrimenti **fingerprint legacy** (cookie `fantacer_voter_id` o payload
   `voterId`, UUID validato) → trova/crea `event_principal` per
   (`event_id`, `legacy_fingerprint`) → emette sessione **agganciata a quello**.
3. Altrimenti → nuovo principal + sessione (bootstrap).

Il passo 2 è il punto critico di compatibilità: un browser che ha già votato
oggi (riga in `vote_sessions`) viene mappato allo **stesso** principal, quindi
il dedup legacy continua a rifiutare il secondo voto.

## Dual-write

Al submit voto:
- si continua a scrivere `vote_sessions.fingerprint` (invariato);
- si valorizzano anche `event_id` e `principal_id`;
- upsert idempotente del principal.

## Dedup durante la transizione

- Primario: indice unico esistente `(fingerprint, vote_day)`.
- P1 (dopo backfill verificato): aggiungere unique
  `(event_id, principal_id, vote_day)` e quarantena per i bucket
  `md5('unknown')`/segnali non attendibili. Nessuna cancellazione.

## Backfill

- Per l'evento attivo: per ogni `fingerprint` distinto nelle `vote_sessions`
  del batch, crea `event_principals(event_id, legacy_fingerprint)`.
- Idempotente, a batch, connessione **diretta `pg`** (non PostgREST),
  `set local statement_timeout = 0`. Nessuna DELETE.

## Bootstrap / rinnovo

- `/api/identity/bootstrap` (Turnstile fail-closed) e `/renew` rate-limited sui
  segnali attendibili di P0-2/P0-3 (IP trusted + segnale pre-principal).
- Modalità `observe` prima di `enforce`, come P0-3.
- CSRF: double-submit token legato alla sessione sulle rotte di stato.

## Fasi di rollout e rollback

| Fase | Contenuto | Flag | Rollback |
|---|---|---|---|
| 0 | questo design | — | — |
| 1 | migration additive + **dual-write** | `SESSION_IDENTITY_MODE=off` | flag→off |
| 2 | **dual-read** con fallback legacy (shadow compare, nessun doppio voto) | `dual` | flag→off |
| 3 | backfill + lettura sessione primaria, fallback legacy attivo | `dual` | flag→off |
| 4 (P1) | unique `(event_id, principal_id, vote_day)` + quarantena | — | indice rimosso |

Rollback non fail-open in ogni fase: si torna alla modalità precedente; se il
lookup sessione fallisce si usa il fingerprint legacy, mai un nuovo voto.

## Piano di compatibilità (da approvare prima dell'implementazione)

Fixture e test:
- votante esistente con riga `vote_sessions` (fingerprint F, oggi) e **senza**
  sessione → bootstrap con F → principal mappato su F → nuovo voto → **409 già
  votato**, nessuna nuova riga.
- due schede, cookie cancellato, solo localStorage, cookie valido+localStorage
  assente, sessione scaduta/revocata.
- concorrenza sullo stesso fingerprint e sullo stesso token.

## Domande aperte

1. Mappatura evento: solo `events.batch` ↔ `active_batch`, o introdurre un
   `active_event_id` dedicato (senza toccare gli input Admin)?
2. TTL sessione e politica di rinnovo (per-evento vs rolling).
3. Per quanto mantenere `fingerprint` come fallback dopo P1.
