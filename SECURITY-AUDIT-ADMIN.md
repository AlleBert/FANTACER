# Security Audit — Autenticazione e Autorizzazione Sezione Admin FANTACER

**Tipo**: audit difensivo read-only basato esclusivamente sul codice del repository `fantacer` (branch `master`).
**Data**: 2026-08-09
**Stack rilevato**: Next.js 16 (App Router), React 19, Supabase (Auth + Postgres + RLS + service role), Turnstile (Cloudflare), Sentry, Playwright.

---

## 1. Executive summary

- **Come funziona l'autenticazione in produzione**: il login admin è una pagina client (`/admin/login`) che invia `email+password` a `POST /api/admin/login`. Il server, con la **service role key** (`src/lib/supabase/admin.ts`), (1) verifica l'esistenza di un record in `admin_users` (`email`+`is_active`), (2) chiama `supabase.auth.signInWithPassword` (Supabase Auth) per validare le credenziali, (3) restituisce al frontend l'`access_token` di Supabase. Il token viene salvato in **`localStorage`** sotto la chiave `admin_session`.
- **Come viene determinato l'accesso admin**: la guardia è **solo lato client** in `src/app/admin/dashboard/layout.tsx`, che legge `localStorage.admin_session`, lo invia a `GET /api/admin/login` per validazione e, se tutto ok, mostra la dashboard. L'applicazione **non ha middleware server-side** (`proxy.ts` governa solo il flag coming-soon ed esclude `/admin` e `/api`) e le pagine admin non verificano nulla sul server.
- **Percorso admin**: la sezione admin è **`/admin/dashboard`** (con sottopagine) e il login è **`/admin/login`**. Host di produzione: **`https://fantacer.it`** corrisponde all'`metadataBase`/`siteUrl` dichiarato in `src/app/layout.tsx:4`; l'origine attuale di deployment è `NON DETERMINABILE DAL CODEBASE`.
- **Criticità principali**:
  1. **7 endpoint admin sono completamente non autenticati** e operano su Supabase con la **service role key** (lettura voti/fingerprint/IP, gestione aziende/sponsor/batch/audit log, import CSV/XLSX).
  2. **Auth tutta client-side**: la protezione delle pagine si basa su `localStorage` e su un `fetch` lato client con **fail-open** (`.catch(() => setAuthorized(true))`).
  3. **Bypass dev attivabile da una variabile `NEXT_PUBLIC_`** (quindi visibile nel client bundle): se settata, consente accesso admin senza credenziali.
  4. **Token di sessione in `localStorage`** (XSS-leggibile), senza HttpOnly/Secure.
  5. **Nessun rate limit sul login** — `check_rate_limit` esiste in DB ma è stato **rimosso dal codice** voti.
  6. **Credenziale seed in chiaro** nella migrazione `admin_users` (`password_hash`) e **nessuna MFA/2FA** nonostante il campo `mfa_secret` esista.

---

## 2. Percorso esatto di accesso alla sezione admin

### Mappa generale (flusso di produzione)

```
/ (pubblico)
│  proxy.ts: gestisce solo flag coming-soon, salta admin|api
▼
/admin/login  (client)  ──►  POST /api/admin/login  ──►  Supabase Auth + admin_users
│
│   [access_token → localStorage:admin_session]
▼
/admin/dashboard/layout.tsx (client-only guard)
│   localStorage.getItem('admin_session')  →  GET /api/admin/login (Bearer) → ok?
│   (ok | bypass | errore di rete → authorized=true; altrimenti redirect /admin/login)
▼
/admin/dashboard/{panoramica,voti,aziende,sponsor,impostazioni,import} (client)
│   chiamate alle API admin (NON autenticate, service role)
▼
Supabase (service role)  →  RLS bypassato
```

| Fase | File | Funzione | Route/percorso | Cosa fa | Condizione di accesso |
|---|---|---|---|---|---|
| Entry | `src/app/admin/login/page.tsx` (`AdminLogin`) | client | `GET /admin/login` | Form login, "auto-login" dev se `NEXT_PUBLIC_X7K2M9QS3P` è impostata | pubblica |
| Login API | `src/app/api/admin/login/route.ts` (POST) | route handler | `POST /api/admin/login` | controllo `admin_users` + `signInWithPassword` | credenziali valide + admin_user attivo |
| Token | `src/app/admin/login/page.tsx:47` | client | — | salva `access_token` in `localStorage.admin_session` | dipendente dal login |
| Guard UI | `src/app/admin/dashboard/layout.tsx` (`DashboardLayout`) | client | `/admin/dashboard/*` | legge localStorage, valida via `GET /api/admin/login`, altrimenti redirige | token valido **oppure** bypass/errore di rete |
| Validazione token | `src/app/api/admin/login/route.ts` (GET) | route handler | `GET /api/admin/login` (Bearer) | `supabase.auth.getUser` + controllo `admin_users.auth_id/is_active` | 401 se token assente/errato |
| Dashboard redirect | `src/app/admin/dashboard/page.tsx` | server | `GET /admin/dashboard` | `redirect('/admin/dashboard/panoramica')` | nessuna (client-only) |
| Sottopagine | `src/app/admin/dashboard/{panoramica,voti,aziende,sponsor,impostazioni,import}/page.tsx` | client | `GET /admin/dashboard/*` | dati via API admin | senza controllo server |

### Endpoint API relativi all'admin e stato dell'autorizzazione

- `POST|GET /api/admin/login` — **con auth** (login + validazione token).
- `GET /api/admin/votes` — **SENZA auth**.
- `GET /api/admin/companies` — **SENZA auth**.
- `POST /api/admin/companies/import` — **SENZA auth**.
- `GET /api/admin/companies/template` — **SENZA auth** (non sensibile).
- `GET|POST|PUT|DELETE /api/admin/sponsors` — **SENZA auth**.
- `GET|POST|DELETE /api/admin/batch` — **SENZA auth**.
- `GET /api/admin/audit-logs` — **SENZA auth**.
- `GET|PUT /api/admin/settings/coming-soon` — **con auth** (salvo bypass env-dev attivo).
- `GET /api/analytics` — **con auth** (Bearer, con eccezione `dev-bypass-token` con env dev).

### Redirect e rewrite

- `src/proxy.ts` (Next 16 `proxy`, ex-middleware): `matcher: ['/((?!_next/static|_next/image|favicon.ico|api|admin).*)']` — **`/admin` e `/api` sono esclusi**: il proxy non applica il flag coming-soon né alcuna logica auth alla sezione admin.
- `src/app/admin/dashboard/page.tsx:4` → `redirect('/admin/dashboard/panoramica')`.
- Logout: `src/components/admin/sidebar.tsx:31` rimuove `localStorage.admin_session` e naviga a `/admin/login`.

### Host/base path / metodi HTTP

- Solo percorso relativo `/admin/...`. Nessuna sottodominio o requirement host. Nessun `basePath` in `next.config.ts`.
- Metodi HTTP: `POST`/`GET` per login; GET/POST/PUT/DELETE per gli altri endpoint.
- Cookie: **nessun cookie di sessione admin**. Unico cookie: `fantacer_consent` (GDPR, non auth, `SameSite=Lax`, senza HttpOnly/Secure — vedi `src/lib/cookie.ts:34`).

### Stato di sessione / token necessari (senza valori)

- Header `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>` richiesto solo da `/api/admin/login` (GET), `/api/analytics`, `/api/admin/settings/coming-soon`.
- **Tutti gli altri endpoint admin non richiedono alcun header di autorizzazione.**
- L'accesso alla UI della dashboard dipende solo dalla presenza di `localStorage.admin_session`.

---

## 3. Architettura dell'autenticazione in produzione

- **Provider**: Supabase Auth (GoTrue) — confermato da `@supabase/ssr`, `@supabase/supabase-js`, chiamate `signInWithPassword`/`getUser`.
- **Flusso di verifica credenziali**: lettura di `admin_users.email` + `is_active=true` con service role, quindi `signInWithPassword` per validare la password contro Supabase Auth. Nota: la colonna `password_hash` di `admin_users` **non viene usata nel login** (il percorso ufficiale passa da Supabase Auth); il campo appare legacy/inusato.
- **Sessione/token**: access token Supabase (JWT), restituito al client e salvato in **`localStorage`** (chiave `admin_session`). Nessun refresh token gestito dal frontend; `autoRefreshToken: false` sui client creati.
- **Conservazione stato**: client-only (localStorage). Nessun cookie `HttpOnly`.
- **Validazione**: richiamato `supabase.auth.getUser(token)` server-side solo su `/api/admin/login` (GET), `/api/analytics`, `/api/admin/settings/coming-soon`. Tutti gli altri endpoint vanno "alla cieca".
- **Scadenza/refresh**: default Supabase (~1h). Nessun refresh automatico nel codice.
- **CSRF**: rischio basso/nullo per le API protette perché usano `Authorization` header (non cookie). Nessuna protezione session-cookie.
- **Cookie**: solo `fantacer_consent`, senza attributi di sicurezza (HttpOnly/Secure), non auth.
- **CORS**: nessuna configurazione CORS specifica lato Next; same-origin di default.
- **MFA/2FA**: **assente**. Esiste la colonna `mfa_secret` in `admin_users` (vedi migrazioni) ma non è utilizzata in alcun percorso.
- **Reset password**: assente nel repository.
- **Rate limiting / lockout**: `check_rate_limit` RPC presente nelle migration ma **non invocato** da nessun endpoint. Il rate limit IP sulla votazione è stato rimosso (documentato in `docs/superpowers/specs/2026-08-07-vote-validation-pipeline-design.md:24`). **Il login non ha rate limiting né lockout.**

---

## 4. Modello di autorizzazione

- **Rappresentazione privilegio**: tabella `admin_users` (email univoca, `is_active` bool, `auth_id`). Nessun ruolo/grant/permission dinamica.
- **Privilegi admin controllati**: esclusivamente l'esistenza di una riga attiva in `admin_users` collegata all'`auth_id` dell'utente Supabase.
- **Dove si effettuano i controlli**: 
  - **Client**: `src/app/admin/dashboard/layout.tsx` (guard delle pagine).
  - **Server**: solo in 3 API (`/api/admin/login` GET, `/api/analytics`, `/api/admin/settings/coming-soon`).
- **Lato server vs client**: l'autorizzazione **principale è client-side** (nascondere la UI/route all'utente anonimo); sul server è **parziale**.
- **Fail-open evidente**: `src/app/admin/dashboard/layout.tsx:31` — `catch(() => setAuthorized(true))`: un errore di rete nel fetch di validazione autorizza l'utente.
- **API admin che applicano autonomamente l'autorizzazione**: solo `GET/POST /api/admin/login`, `GET|PUT /api/admin/settings/coming-soon`, `GET /api/analytics`. **Tutte le altre no.**
- **Funzionalità admin dipendenti esclusivamente dal frontend**: le pagine `/admin/dashboard/*` non hanno protezione server; il guard client è l'unica barriera UI. Inoltre molte pagine (es. `voti/page.tsx:37-45`, `aziende/page.tsx:24`) chiamano le API admin **senza alcun header**, quindi anche con `localStorage` pulito i dati verrebbero serviti.

---

## 5. Configurazione e deployment di produzione

### Variabili d'ambiente (SOLO NOMI)

- In `.env` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `REDIS_URL` (quest'ultimo risulta presente ma **non referenziato** nel source).
- Bypass dev: `NEXT_PUBLIC_X7K2M9QS3P` — confrontata in `login/page.tsx:9`, `dashboard/layout.tsx:8`, `settings/coming-soon/route.ts:6,52`, `analytics/route.ts:11` contro un valore costante **embedded nel codice client**. Presente anche in `playwright.config.ts:99` e citata in `docs/CI.md:37`, `docs/frontend-quality.md:123,144`.
- Sentry: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` (citati in README; sampling rate 0).
- CI: `.github/workflows/ci.yml` usa i secret `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `REDIS_URL` non risulta usato nel codice.

### File di config production

- `next.config.ts` — nessuna header CSP/security, nessun basePath/rewrite.
- `src/proxy.ts` — unico "middleware" (Next 16). Nessuna regola di auth.
- `.env` è gitignored (`.env*`).

### Database Supabase

- RLS attivo sulle tabelle ma **bypassato dalla service role** nelle route admin/vote (le API usano `createAdminClient()`).
- Le policy admin (`EXISTS (SELECT 1 FROM admin_users WHERE auth_id = auth.uid())`) sono definite in `20260510`, `20260511`, `schema.sql`, `20260720000000`, ma rilevanti **solo se si usasse l'anon/authenticated user**, non nel percorso attuale (service role).

---

## 6. Vulnerabilità e security findings

### FINDING 1 — Endpoint admin non autenticati (con service role) — **CRITICAL**
- **File**: `src/app/api/admin/votes/route.ts` (GET), `companies/route.ts` (GET), `companies/import/route.ts` (POST), `sponsors/route.ts` (GET/POST/PUT/DELETE), `batch/route.ts` (GET/POST/DELETE), `audit-logs/route.ts` (GET).
- **Perché è rilevante**: ogni endpoint usa `createAdminClient()` (service role, **bypassa RLS**) e non ispeziona l'header `AuthenticationValue`. Espongono l'intero dataset `vote_sessions` (fingerprint, ip_hash, user_agent, country), `audit_logs` (incluso IP), e permettono di **modificare/cancellare** aziende, sponsor, di **eliminare commissioni batch** e di cambiare `active_batch`.
- **Condizioni**: qualsiasi richiesta anonima a queste route (nessun token).
- **Confidence**: HIGH.
- **Rimedi suggeriti**: helper server-side `requireAdmin()` centralizzato applicato a **tutti** gli endpoint `/api/admin/*` (validazione `Bearer` + check `admin_users`), con difesa in profondità e non solo client-side.

### FINDING 2 — Bypass dev in variabile `NEXT_PUBLIC_` — **CRITICAL/HIGH**
- **File**: `src/app/admin/login/page.tsx:9,20-26`, `src/app/admin/dashboard/layout.tsx:8,13,16`, `src/app/api/admin/settings/coming-soon/route.ts:6,52`, `src/app/api/analytics/route.ts:11-14`, `playwright.config.ts:99`.
- **Perché è rilevante**: `NEXT_PUBLIC_X9_M2Q` è visibile nel client bundle; il confronto avviene lato client. Se in produzione l'environment è **set** (come nel webServer di Playwright), abilita auto-login, saltava la validazione, ed esegue bypass server su `settings/coming-soon` e `analytics`.
- **Condizioni**: env `NEXT_PUBLIC_X7K2M9QS3P` presente nel build production e conoscenza del valore costante (embedded nel bundle).
- **Rimdeco**: spostare il bypass dietro variabile **non `NEXT_PUBLIC_`** o rimuoverlo completamente; condizionare solo a `NODE_ENV=development`; non usarlo in prod.

### FINDING 3 — Auth UI completamente lato client + fail-open — **HIGH**
- **File**: `src/app/admin/dashboard/layout.tsx`; assenza di `proxy.ts`/middleware per `/admin`; `src/app/admin/layout.tsx` senza logica di controllo.
- **Perché è importane**: l'autorizzazione dipende dal fatto che il client nasconda la pagina. Un utente che accede direttamente a `/admin/dashboard/aziende` ottiene comunque il rendering (client component) e, in caso di errore di rete, il **fail-open** autorizza. Le API dati non richiedono token → il dato è comunque raggiungibile.
- **Rimde**: protezione server-side (layout server con sessione `createServerClient`, o `proxy.ts` per `/admin`); rimuoverr il fail-open.

### FINDING 4 — Token di sessione in `localStorage` — **HIGH/MEDIUM**
- **File**: `src/app/admin/login/page.tsx:47` (salva `access_token`), guard+pages che lo leggono.
- **Perché**: qualsiasi XSS (o estensione malevola) può estrarre il token admin; nessun cookie `HttpOnly`/`Secure`.
- **Condizioni**: presenza vettore XSS sul sito (nessuna CSP configurata in `next.config.ts`).
- **Rimde**: gestione sessione esclusivamente lato server (cookie `HttpOnly` + SameSite), uso di `createServerClient` con `getUser`.

### FINDING 5 — Nessun rate limiting/lockout sul login — **HIGH**
- **File**: `src/app/api/admin/login/route.ts` (POST) non usa `check_rate_limit` (presente in `rate_limits.sql` ma non invocato).
- **Perché**: brute-force illimitato verso il login admin.
- **Rimde**: rate limit per IP+email, lockout temporaneo dopo $k$ tentativi, logging/alerting.

### FINDING 6 — Credenziale/seed in chiaro in migrazione — **HIGH (se in prod)**
- **File**: `supabase/migrations/20260510_add_admin_users_and_policies.sql:40-43` — INSERT di admin seed con `password_hash` in **chiaro** e commento "CHANGE IN PRODUCTION".
- **Perché**: se la riga è rimasta, è una default credential; inoltre `password_hash` non è usata dal login, e una password errata dà falsa sicurezza.
- **Rimde**: rimuovere seed dalle migration; gestire admin via Supabase Dashboard/Auth; rotazione password.

### FINDING 7 — MFA/2FA solo nello schema, non operativa — **MEDIUM**
- **File**: schema `admin_users.mfa_secret` ma nessun flusso TOTP nel login.
- **Rimde**: abilitare MFA (TOTP/WebAuthn) sugli utenti admin via Supabase Auth, o flusso custom.

### FINDING 8 — Altre considerazioni — **LOW/INFORMATIONAL**
- L'`access_token` scade (~1h) ma le API dati restano comunque senza auth → comportamento inconsistente e confusione sugli assunti di sicurezza.
- **`TURNSTILE` fail-open**: `src/app/api/vota/route.ts:6-18` → se `TURNSTILE_SECRET_KEY` non configurata, `verifyTurnstile` torna `true` (rilevante per bots sulla votazione, non per admin).
- `check_rate_limit` e `check_can_vote` sono RPC pubblico definite ma non usate nel path corrente.
- `device_sessions` (heartbeat) scritto pubblicamente e non autenticato → possibile polluption dati.

### Column confidence
- F1, F2, F3, F5: **HIGH** — direttamente verificabili dal codice.
- F4, F7, F8: **MEDIUM/LOW** — richiedono premesse (XSS, esposizione env, configurazione prod).

---

## 7. Meccanismi alternativi di accesso

**Nessun meccanismo admin aggiuntivo** emerge dal codice oltre il flusso principale:

- **Route admin**: `/admin/login`, `/admin/dashboard/*` (unico set).
- **API admin**: solo quelle elencate in §2. Nessuna sotto `/api/_admin`/`_private`/`staff`.
- **CLI / tool admin nel repo**: nessuno.
- **SSO/OAuth/OIDC**: assente.
- **Ruoli/perm permission**: assenti (privilegio binario `is_active`).
- **Sottoutilizzi**: nessuno.
- **Break-glass**: assente (unico "bypass" è il flag dev F1/F2, involontario in prod).
- **Interfacce backend-only**: solo Supabase Dashboard/SQL (esterno al repo).

---

## 8. Handoff per il team cybersecurity

| Elemento | Risultato |
|---|---|
| Percorso login produzione | `https://fantacer.it/admin/login` (host IPERATO da `metadataBase`; path admin dal code) |
| Percorso admin produzione | `/admin/dashboard` e sottopergine (`panoramica`, `voti`, `aziende`, `sponsor`, `impostazioni`, `import`) |
| Percorsi API admin | `/api/admin/*` come in §2, più `/api/analytics` |
| Meccanismo autenticazione | Supabase Auth (GoTrue) via `signInWithPassword` + check `admin_users` (service role) |
| Meccanismo sessione/token | JWT access token in **localStorage** (`admin_session`), senza refresh |
| Meccanismo autorizzazione | Principalment **client-side** (`localStorage` + GET /api/admin/login); solo server parziale (3 endpoint) |
| Ruolo/permission admin | binario `is_active`; nessuna RBAC/permessi; no MFA (campo `mfa_secret`)
| Evidenze host/dominio produzione | `https://fantacer.it` (metadata in `layout.tsx`); **origin di deployment NON DETERMINABILE dal repo** |
| Middleware/guard principali | `proxy.ts` (solo flag coming-soon; escluso admin/api); `dashboard/layout.tsx` (client guard, fail-open) |
| Finding ad alto rischio | Admin API non autenticati (service role) **CRITICAL**; dev-bypass `NEXT_PUBLIC_` **CRITICAL/HIGH** |
| Limiti dell'analisi | Nessun accesso a prod; `.env` giocati; valori/env effettive e dati di prodnon verificabili |

---

## TOP 10 — Verifiche nel production live

1. **Admin API non autenticate**: chiamare ogni `/api/admin/*` senza header `Authorization` → devono restituire 401. Il frontend non è un limite.
2. **Bypass dev**: verificare che `NEXT_PUBLIC_X7K2M9QS3P` sia **assente** dal build prod e dal JS bundle (o non applicata).
3. **Sessione/token** gestita in localStorage: verificare XSS presenti e configurare sessione server-side (HttpOnly cookie).
4. **Rate limiting login**: testare brute-force su `/api/admin/login`; verificare throttling IP a livello proxe/CDN.
5. **Esposizione dati personali**: verificare che `/api/admin/votes`, `/api/admin/audit-logs` ecc. non ritornino fingerprint/IP reali ad anonimi.
6. **Credenziali placeholder**: controllare riga seed `admin_users` in prod e policy password di default.
7. **MFA/2FA**: richiedere MFA sugli account admin.
8. **Scadenza/refresh token**: dopo ~1 ora, ank il comportamento del guard/dashboard; le API restano protette?
9. **Header e CORS**: verificare CSP, `X-Frame-Options`, HSTS, e eventuali config origin permissive.
10. **Audit trail**: verificare che accessi admin e tutte le scritture (sponsor/batch/aziende/coming-soon) siano registrate nei `audit_logs` — oggi le cancellazioni batch/sponsor **non scrivono audit**.

---

**Nota metodologica**: conclusioni derivate da lettura diretta dei file (`git ls-files` + contenuto). Nessun valore/segreto è stato riprodotto nel report; la posizione di ogni riferimento è indicata. Nessuna modifica del repository oltre a questo file documentale.