# CI Pipeline

## What it checks

The CI pipeline runs on every pull request and push to `main` and `develop`:

1. **Install** — `npm ci` (deterministic install from `package-lock.json`)
2. **Lint** — ESLint with Next.js core-web-vitals + TypeScript rules
3. **TypeScript** — `tsc --noEmit` (strict mode)
4. **Unit tests** — Jest with jsdom, ts-jest
5. **Build** — `next build` (production bundle)
6. **E2E tests** — Playwright with 4 projects (Chromium, Firefox, Mobile Chrome, Mobile WebKit)
   - Responsive layout validation (6 viewports)
   - Accessibility scans (axe-core, WCAG 2.1 AA)
   - Visual regression screenshots
   - Voting flow and scroll-blocking regression tests

## When it runs

- On `push` to `main` or `develop`
- On `pull_request` targeting `main` or `develop`

## How to reproduce locally

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

For faster local iteration, start the dev server separately:

```bash
# Terminal 1
NEXT_PUBLIC_X7K2M9QS3P=hx7k2m9Qs3P npm run dev

# Terminal 2
npm run test:e2e
```

The Playwright `webServer` config auto-detects a running server on port 3000 and reuses it (no rebuild needed). For production-accurate results, use `npm run build && npm run start` instead of `npm run dev`.

> **E2E isolato:** per i test E2E Playwright avvia il proprio server (`.env.e2e`
> → progetto Supabase `fantacer-e2e`) con `reuseExistingServer: false`: non
> riusare mai un `next dev` avviato a mano (potrebbe puntare a production). Per
> lo sviluppo manuale puntato a production usare `.env`/`.env.local` come sempre.

## Required GitHub Secrets

Il job CI usa **solo** secrets del progetto E2E `fantacer-e2e` (prefisso `_TEST`).
Impostarli in **Settings → Secrets and variables → Actions**:

| Secret | Valore |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL_TEST` | URL progetto `fantacer-e2e` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST` | anon key progetto E2E |
| `SUPABASE_SERVICE_ROLE_KEY_TEST` | service role key progetto E2E |
| `E2E_ADMIN_EMAIL_TEST` / `E2E_ADMIN_PASSWORD_TEST` / `E2E_ADMIN_TOTP_SECRET_TEST` | credenziali admin E2E (TOTP lowercase) |
| `E2E_VIEWER_EMAIL_TEST` / `E2E_VIEWER_PASSWORD_TEST` | credenziali viewer E2E |

Le `NEXT_PUBLIC_*` devono essere presenti già alla `next build` (inline a
build-time). Le chiavi di production NON devono mai comparire nel job.

## Setup progetto E2E (Supabase `fantacer-e2e`)

1. Creare il progetto (org `xrfuwixpevswnqmnnlxz`, regione `eu-west-1`).
2. `supabase link --project-ref <ref>` + `supabase db push` (23 migrazioni:
   storage bucket sponsor, realtime, rate_limits, site_settings).
3. Dashboard progetto test: **Authentication → Multi-factor → TOTP** abilitato.
4. `npm run provision:e2e:admin:test` (admin + viewer, `--verify`).
5. `.env.e2e` completo di `E2E_VIEWER_*` (lo script scrive solo `E2E_ADMIN_*`).

Regole: TOTP in lowercase (Google Authenticator); riavviare `next dev` quando
cambiano le env; canary manuale su production dopo un run E2E:
`SELECT key, value FROM site_settings; SELECT active_batch FROM batch_settings
WHERE id='default';` — devono essere invariati.

## Common failures

| Failure | Likely cause |
|---|---|
| `npm ci` fails | `package-lock.json` is out of sync with `package.json`. Run `npm install` locally and commit the updated lockfile. |
| Lint fails | ESLint rules are violated. Run `npm run lint` locally to see errors. |
| Typecheck fails | TypeScript strict mode errors. Run `npm run typecheck` locally. |
| Tests fail | Jest tests are failing. Run `npm test` locally to debug. |
| Build fails | Usually missing environment variables (check GitHub Secrets) or a compilation error. |
| E2E tests fail | Playwright tests are failing. Run `npm run test:e2e` locally. Check screenshot diffs, responsive overflow, or accessibility violations. |
