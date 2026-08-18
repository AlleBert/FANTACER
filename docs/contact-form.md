# Contact Form (Vercel + Resend)

Documentazione del sistema di invio email del modulo di contatto della sezione
«PARLA CON NOI». Non contiene segreti: tutti i valori reali sono configurati
come environment variables, mai nel repository.

## Architettura

```
React (contact-section.tsx)
        │  POST /api/contact  { name, email, message, website (honeypot) }
        ▼
Vercel Serverless Function (src/app/api/contact/route.ts)
        │  1. origin check (no Origin → ok)
        │  2. payload size limit (16 KB, content-length)
        │  3. JSON parsing (malformato → 400)
        │  4. honeypot (valorizzato → 200 "success" silenzioso, nessuna email)
        │  5. rate limit per IP (5 / 10 min, DB `check_rate_limit`)
        │  6. validazione campi (server-side, mai fidarsi del client)
        │  7. rate limit per email (3 / 1 h)
        │  8. costruzione email (From/To/Subject lato server)
        ▼
Resend API (SDK `resend`)
        ▼
Tua casella email (CONTACT_TO_EMAIL)
```

Il browser comunica **solo** con `/api/contact`: non possiede `RESEND_API_KEY`
né altri secret, e non può controllare destinatario, mittente, subject o header.

### File

| Componente | File |
|---|---|
| Route handler | `src/app/api/contact/route.ts` |
| Validazione + limiti + costruzione email (logica pura) | `src/lib/contact.ts` |
| Frontend form + honeypot | `src/components/sections/contact-section.tsx` |
| Test unitari | `tests/contact-route.test.ts` |
| Rate limiting DB (RPC Supabase) | `src/lib/rate-limit.ts`, `supabase/migrations/20260717000000_rate_limits.sql` |

## Environment variables

| Variabile | Scopo | Secret | Dove recuperarla |
|---|---|---|---|
| `RESEND_API_KEY` | API key Resend per l'invio | Sì | Dashboard Resend → API Keys → «Create API Key» (permesso *Sending access*) |
| `CONTACT_TO_EMAIL` | Destinatario delle email | No (ma non è pubblico) | La tua casella di ricezione |
| `CONTACT_FROM_EMAIL` | Mittente, **deve** appartenere al dominio verificato su Resend (es. `website@fantacer.com`) | No | Indirizzo sul dominio verificato |
| `CONTACT_RATE_IP_MAX` *(opzionale)* | Override rate limit per IP (default 5/10min) | No | — |
| `CONTACT_RATE_EMAIL_MAX` *(opzionale)* | Override rate limit per email (default 3/1h) | No | — |

Nel repository esiste solo `.env.example` con placeholder. `RESEND_API_KEY` è
server-only: il prefisso `NEXT_PUBLIC_` **non** va usato, altrimenti finirebbe
nel bundle client.

### Configurazione su Vercel

Project → **Settings → Environment Variables**, poi **Redeploy**:

- `RESEND_API_KEY` — Production / Preview / Development (valori separati se vuoi)
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`

## Configurazione dominio su Resend

1. Dashboard Resend → **Domains** → **Add Domain** (es. `fantacer.com`).
2. Aggiungi i **record DNS** indicati dalla dashboard:
   - **SPF**: record `TXT` che include il servizio di invio Resend (include `amazonses.com`).
   - **DKIM**: 3 record (CNAME o TXT) per la firma del dominio, es. `resend._domainkey.*`.
   - **DMARC** *(consigliato)*: `TXT` su `_dmarc` per la policy di autenticazione.
3. Attendi la verifica (lo stato del dominio passa a **Verified**).
4. `CONTACT_FROM_EMAIL` deve essere un indirizzo su quel dominio (es. `website@fantacer.com`), altrimenti Resend rifiuta l'invio.

> Senza dominio verificato la mail non parte (deliverability → spam/rifiuto). È un
> prerequisito del deploy production.

## Come funziona l'anti-spam

1. **Honeypot** — campo `website` nascosto (fuori schermo, `aria-hidden`, `tabIndex={-1}`,
   `autoComplete="off"`). Se valorizzato → risposta `200 {success:true}` coerente,
   nessuna email, nessun reveal del controllo. Non interferisce con a11y né autofill.
2. **Rate limiting DB-backed** — sliding window su Postgres condiviso (`check_rate_limit`):
   funziona con istanze serverless multiple (niente stato in memoria).
   - Per **IP**: 5 richieste / 10 min.
   - Per **email**: 3 / 1 h (impedisce di aggirare il limite IP cambiando indirizzo/device).
   - Risposta `429 {success:false, error:'too_many_requests'}`.
3. **Origin check** — richieste con header `Origin` esplicito diverso dal dominio
   dell'app → `403`. Fail-open su Origin assente/`null`.
4. **Limiti di payload/validazione** — body max 16 KB; campi validati server-side
   (nome 1–80, email ≤254 con formato valido, messaggio 10–4000 caratteri, dopo trim).

I limiti sono scelti per non penalizzare utenti reali: un visitatore umano invia
1–2 messaggi.

## Test

```bash
npx jest tests/contact-route.test.ts   # 16 casi, Resend e rate-limit mockati
```

Casi coperti: invio valido (to/from server, reply-to utente), email/nome/messaggio
non validi, messaggio troppo lungo, honeypot, rate limit IP ed email (429), errore
Resend (500 senza dettagli), API key mancante (500 senza secret), `to`/`from`/`subject`
dal client ignorati, JSON malformato (400), payload oltre limite (413), origin
cross-site (403), campi extra ignorati, escaping HTML dei dati utente.

## Test locale

1. Configura `.env.local` con `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`
   (usa un dominio verificato; in dev puoi usare l'email di prova `onboarding@resend.dev`
   come `CONTACT_FROM_EMAIL`).
2. `npm run dev`
3. Apri il sito, compila il form nella sezione «PARLA CON NOI» e invia.
4. Verifica la mail. Il rate limit usa lo stesso DB di produzione: per test ripetuti
   valuta di svuotare le righe `contact:ip:*` / `contact:email:*` in `public.rate_limits`
   o alzare i limiti con `CONTACT_RATE_IP_MAX` / `CONTACT_RATE_EMAIL_MAX`.

## Deploy

1. Verifica il dominio su Resend (sopra).
2. Imposta le env in Vercel (sopra).
3. Push del branch → il workflow CI passa (lint, typecheck, test, build).
4. Vercel deploya automaticamente; `/api/contact` è una Serverless Function.

## Aggiungere Cloudflare Turnstile in futuro

L'endpoint è strutturato per aggiungere Turnstile senza stravolgere il flusso:

1. Il client invia `turnstile_token` nel body del form (l'infrastruttura
   `@marsidev/react-turnstile` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` è già presente).
2. In `route.ts`, dopo l'honeypot e prima/insieme al rate limit, verifica il token
   server-side con la `secret` (`TURNSTILE_SECRET_KEY`, mai esposta al client),
   ricalcando il pattern di `src/app/api/vota/route.ts` (`POST https://challenges.cloudflare.com/turnstile/v0/siteverify`).
3. Token assente/invalido → `400`; la secret sta esclusivamente nelle env server-side.
