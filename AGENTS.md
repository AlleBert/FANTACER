# Fantacer — Agent Instructions

## TOTP / Google Authenticator

- **Google Authenticator (inserimento manuale)** accetta il secret base32 **solo in minuscolo**. Se incollato in MAIUSCOLO rifiuta con "carattere non valido nel valore del codice".
- I secret TOTP generati da `npm run provision:e2e:admin` sono salvati in `.env.local` come `E2E_ADMIN_TOTP_SECRET` in maiuscolo: convertire in minuscolo prima di suggerirne l'inserimento in GA.
- Per gli utenti `admin` il provisioning genera anche il file **QR SVG** in `./.qr/` (gitignored) con URI `otpauth://`: suggerire di **scansionarlo con l'app authenticator** (carica label + secret senza digitazione, bypassa la regola minuscole).
- Il secret è visibile un'unica volta al provisioning; se perso si rigenera con `npm run provision:e2e:admin -- --force`.
- `--role=viewer` crea un utente **read-only senza TOTP** (AAL1): niente `E2E_ADMIN_TOTP_SECRET` nel relativo blocco `.env.local`.
- In `.env.local` vale l'**ultima** occorrenza di una chiave (il fattore attivo è la più recente). Tenere un solo blocco E2E per evitare ambiguità.

## E2E: rate limit e sessione admin

- Il login admin (`/api/admin/login`) e la verify MFA (`/api/admin/mfa/verify`) hanno **rate limit DB-backed** (finestra 15min): default **10** tentativi login, **5** verify per factorId. Overridabili via env `ADMIN_LOGIN_RATE_MAX` / `ADMIN_MFA_VERIFY_RATE_MAX` (vedi `.env.example`).
- Le suite E2E autenticate (visual-audit, accessibility, admin, viewer) **riusano la sessione admin a livello di modulo** (`cachedAdminCookies` in `tests/e2e/helpers/auth.ts`): il primo test esegue il login MFA completo, i successivi riutilizzano i cookie. Non duplicare il login: ogni MFA login consuma una verify nel rate limit.
- In `.env.local` sono già presenti `ADMIN_LOGIN_RATE_MAX=100` e `ADMIN_MFA_VERIFY_RATE_MAX=100` per le suite E2E. Se il server dev era già avviato prima di una modifica a `.env.local`, **riavviarlo** (le env sono lette allo startup da `next dev`).
- I counter del rate limit vivono in DB (`public.rate_limits`): un run fallito lascia tentativi conteggiati per 15min. In caso di "ratelimited" inspiegabile, svuotare le righe con key `admin:login:*` / `admin:mfa:*` o attendere la finestra.