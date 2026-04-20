# FANTACER - Piano Implementazione

## Requisiti
- 350 aziende votabili
- Top 3/10 realtime
- Mobile-first (99%)
- 1 voto per dispositivo/giorno
- No login - device fingerprint
- Analytics monetizzabili
- 5 giorni fiera (IT)
- Post-fiera: readonly

## Stack
- Next.js 14 + TypeScript + TailwindCSS
- shadcn/ui
- Supabase (PostgreSQL + Realtime)
- LocalStorage + Canvas fingerprint
- Cloudflare Turnstile

---

## FASE 1: SETUP PROGETTO (6 task)

| # | Task |
|---|------|
| 1.1 | Next.js 14 + TypeScript + Tailwind |
| 1.2 | shadcn/ui components |
| 1.3 | Supabase client setup |
| 1.4 | Env vars + .env.example |
| 1.5 | Code-splitting config |
| 1.6 | Build verification |

---

## FASE 2: DATABASE & API (14 task)

| # | Task |
|---|------|
| 2.1 | Schema companies |
| 2.2 | Schema votes (partitioning) |
| 2.3 | Schema analytics_raw |
| 2.4 | Schema daily_stats |
| 2.5 | Schema admin_users |
| 2.6 | RLS policies |
| 2.7 | API GET /api/aziende |
| 2.8 | API PUT /api/aziende/:id |
| 2.9 | API POST /api/vota |
| 2.10 | API GET /api/ranking |
| 2.11 | API GET /api/analytics |
| 2.12 | Geo-blocking middleware |
| 2.13 | Rate limiting server-side |
| 2.14 | Turnstile + fingerprint server |

---

## FASE 3: DEVICE FINGERPRINT (6 task)

| # | Task |
|---|------|
| 3.1 | LocalStorage + optional JWT |
| 3.2 | Canvas fingerprint client |
| 3.3 | Server-side telemetry |
| 3.4 | Behavioral scoring |
| 3.5 | Daily vote check |
| 3.6 | Optional email recovery |

---

## FASE 4: UI VOTAZIONE (12 task)

| # | Task |
|---|------|
| 4.1 | Layout mobile-first |
| 4.2 | Header + search bar |
| 4.3 | Virtualizzazione liste |
| 4.4 | Pagination iniziale 20 |
| 4.5 | Lazy loading immagini |
| 4.6 | Card azienda placeholder |
| 4.7 | Top 3 bar realtime |
| 4.8 | Top 10 / classifica |
| 4.9 | Trend indicator |
| 4.10 | Thank you post-voto |
| 4.11 | Banner GDPR + Cookie |
| 4.12 | Skeleton loaders |

---

## FASE 5: ADMIN DASHBOARD (10 task)

| # | Task |
|---|------|
| 5.1 | Login con MFA obbligatorio |
| 5.2 | IP whitelist |
| 5.3 | Dashboard realtime |
| 5.4 | Grafici analytics |
| 5.5 | Tabella dettagliata |
| 5.6 | Export CSV monetizzazione |
| 5.7 | Export Excel |
| 5.8 | Import CSV aziende |
| 5.9 | Gestione manuale aziende |
| 5.10 | Session timeout |

---

## FASE 6: STORICO & REALTIME (6 task)

| # | Task |
|---|------|
| 6.1 | Grafico 5 giorni |
| 6.2 | Supabase subscriptions |
| 6.3 | Redis cache ranking |
| 6.4 | Debounced writes batch |
| 6.5 | Post-fiera readonly |
| 6.6 | Backup automatico S3 |

---

## FASE 7: TEST & DEPLOY (8 task)

| # | Task |
|---|------|
| 7.1 | Test fingerprinting |
| 7.2 | Test geo-blocking |
| 7.3 | Test votazione flow |
| 7.4 | Test bot protection |
| 7.5 | Test admin security |
| 7.6 | Performance audit |
| 7.7 | Deploy Vercel |
| 7.8 | Smoke test prod |

---

## TOTALE: 62 task

---

## Correzioni integrate da analisi agenti

1. **GDPR + Cookie Banner** - obbligatorio per analytics vendibili
2. **Server-side fingerprint** - telemetry + behavioral scoring
3. **Virtualizzazione** - tanstack virtual per 350 aziende
4. **Rate limiting server-side** --edge function
5. **MFA admin** - obbligatorio
6. **Redis caching** - per Top 10 realtime
7. **Partitioning votes** - per giorno
8. **Email recovery** - opzionale per cambio device
9. **Backup S3** - export automatico