# Spec — Nuova pipeline di validazione voto

**Data:** 2026-08-07
**Obiettivo:** sostituire l'intera catena di validazione del voto attuale con la nuova pipeline ordinata: **Turnstile → BotD → FingerprintJS → DB once-per-day**. Rimozione completa delle gate esistenti non richieste; il requisito "un voto/giorno/utente" è ricostruito sulla nuova identità `visitorId`.

## 1. Contesto e stato attuale

Catena attuale (`/api/vota` + `submit_vote`):
1. Rate limit per IP (RPC `check_rate_limit`, 100/ora)
2. Geoblocking (`ALLOWED_COUNTRIES`, whitelist europea via `cf-ipcountry`)
3. Business check: 3 id obbligatori, distinti, batch attivo
4. Turnstile (`verifyTurnstile`)
5. DB once-per-day su `vote_sessions.fingerprint` + `created_at::date = current_date` (RPC `submit_vote`)

Identità utente attuale: fingerprint **custom** (`src/lib/fingerprint.ts`) — hash canvas+screen+timezone+UA; più foglio `localStorage` `canVoteToday`/`markVotedToday` (non autoritativo).

Dipendenze attuali: `@marsidev/react-turnstile`. Nessuna integrazione BotD / FingerprintJS.

## 2. Pipeline nuova (decisioni approvate)

Turnstile (server) → BotD (client) → FingerprintJS (client) → DB once-per-day (server).

Rimozioni approvate:
- **Rate limit IP** — rimosso (`checkRateLimit`, chiamata RPC)
- **Geoblocking** — rimosso (`ALLOWED_COUNTRIES`, blocco `cf-ipcountry`)
- **Fingerprint custom + localStorage once-per-day** — rimossi (`src/lib/fingerprint.ts` eliminato; `canVoteToday`/`markVotedToday` eliminati)
- **DB once-per-day esistente** — la logica resta, ma ricostruita sulla nuova chiave `visitorId`

Decisioni chiave:
- BotD e FingerprintJS sono **open-source** e girano **client-side** (nessuna SDK server). Turnstile e DB check restano quindi server-side; BotD/Fingerprint vengono raccolti nel browser e inviati al server per il record.
- Il **DB once-per-day resta** ma basato su `visitorId` di FingerprintJS (più stabile e non aggirabile del vecchio hash custom).

## 3. Dettaglio tecnico

### 3.1 Dipendenze
Aggiungere a `package.json`:
- `@fingerprintjs/fingerprintjs` (OSS, client-side)
- `@fingerprintjs/botd` (OSS, client-side)

### 3.2 Frontend — `src/components/sections/search-section.tsx`

Riscrivere `handleVoteSubmit` (attualmente a `search-section.tsx:104`):
- Riceve il token Turnstile dall'overlay (invariato)
- Esegue in parallelo:
  - `BotDetect.load()` → `detect()` → risultato `botdResult`
  - `FingerprintJS.load()` → `get()` → `visitorId`
- POST `/api/vota` con body:
  ```ts
  { company1Id, company2Id, company3Id, turnstile_token, botd, visitorId }
  ```
- Handler errori invariato (`MessageOverlay`)

### 3.3 Server — `src/app/api/vota/route.ts`
Nuova sequenza gate (mantenendo parse IP):
1. **Turnstile** — `verifyTurnstile` (invariato)
2. **Business check** — 3 id obbligatori, distinti, batch attivo (invariato)
3. **DB once-per-day** — chiama `submit_vote` RPC aggiornato con `visitorId` → con `fingerprint_param`

Rimuovere: `checkRateLimit`, `ALLOWED_COUNTRIES`, blocco geoblocking, campo `fingerprint` dal body.
Restano: parse IP, `userAgent`, `country` per il record `vote_sessions`.

Nota: `botd` non blocca il voto — è registrato a fini audit (OSS non consente reject server-side). Il fingerprint è la chiave della detenzione once-per-day.

### 3.4 DB — nuova migrazione `supabase/migrations/20260807_vote_validation_pipeline.sql`
```sql
create or replace function submit_vote(
  fingerprint_param text,   -- ora riceve visitorId
  ip_param text,
  user_agent_param text,
  company1_id_param uuid,
  company2_id_param uuid,
  company3_id_param uuid,
  country_param text default 'IT'
) returns jsonb ...   -- logica invariata da 20260721000000
```
- Nessuna colonna nuova: `vote_sessions.fingerprint` riusa la colonna esistente (riceve `visitorId`)
- Opzionale: aggiungere `bot_detection` a `audit_logs.metadata` per completezza audit

### 3.5 Heartbeat / device sessions — NON MODIFICATI
`/api/presence/heartbeat` e `page.tsx:47` usano `getOrCreateDeviceId()`, che dipende da `fingerprint.ts` eliminato. Il heartbeat non è legato alla validazione voto, quindi `getOrCreateDeviceId` DEVE essere conservato.

Piano: spostare `getOrCreateDeviceId` in un nuovo file `src/lib/device.ts` (senza canvas hash), mantenendo il contratto per `page.tsx` heartbeat. La rimozione di `fingerprint.ts` non deve rompere `page.tsx`.

### 3.6 Pulizia file
- Eliminare `src/lib/fingerprint.ts` → split: `getOrCreateDeviceId` in nuovo `src/lib/device.ts`; eliminare `getCanvasFingerprint`, `getCombinedFingerprint`, `canVoteToday`, `markVotedToday`, `hasAlreadyVoted`, `getLastVoteDate`.
- `src/lib/security-bypass.ts` NON è importato da fronToEnd (gitignore/ricerca no match) — verificare; se orfano, rimuovere.
- La variabile `NEXT_PUBLIC_X7K2M9QS3P` resta per bypass dev Turnstile (non modificare).

### 3.7 Test
- `tests/vote-api.test.ts`: aggiornare/verificare lo stub. Il contratto RPC non cambia (già `fingerprint_param`, ecc.) → probabile nessuna modifica.
- Verificare eventuali import di `fingerprint.ts` rotti dalla cancellazione (`page.tsx`, `search-section.tsx`).
- e2e `tests/e2e/fixtures/test-data.ts` usa `fingerprint` per `vote_sessions`/`device_sessions` — indipendente dalla nuova logica; nessuna modifica richiesta.

## 4. Rischi e note
- BotD OSS non consente reject server-side: livello anti-bot solo informativo/audit; Turnstile resta l'unica gate anti-bot server reale.
- `visitorId` OSS può cambiare al cancellamento cookies/storage → DB check aggirabile quanto la soluzione precedente (non peggiore). Turnstile è la protezione principale.
- Rimozione geoblocking: nessuna gate residua sulla fraude geografica; monitorare se necessario.

## 5. Ordine implementazione
1. Nuova migrazione SQL `submit_vote` (nessuna colonna nuova)
2. Installazione BotD + FingerprintJS
3. Split `src/lib/device.ts` + eliminazione `fingerprint.ts` + fix `page.tsx`
4. Riscrittura `handleVoteSubmit` (client)
5. Riscrittura gate `/api/vota` (server)
6. Aggiornamento test (stub invariato; eventuali fix import)
7. Rimozione `security-bypass.ts` se orfano
8. `/voto` e2e verde + typecheck + lint