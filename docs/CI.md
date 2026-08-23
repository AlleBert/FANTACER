# CI Pipeline

## What it checks

The CI pipeline runs on every pull request and push to `main` and `develop`:

1. **Install** — `npm ci` (deterministic install from `package-lock.json`)
2. **Lint** — ESLint with Next.js core-web-vitals + TypeScript rules
3. **TypeScript** — `tsc --noEmit` (strict mode)
4. **Unit tests** — Jest with jsdom, ts-jest
5. **Build** — `next build` (production bundle)
6. **E2E tests** — `npm run test:e2e` (full suite, 11 Playwright projects)
   - Responsive layout validation (6 viewports)
   - Accessibility scans (axe-core, WCAG 2.1 AA)
   - Visual regression screenshots
   - Voting flow and scroll-blocking regression tests
   - Admin / viewer / auth security tests
   - Responsive structural gate (P0)

## When it runs

- On `push` to `main` or `develop`
- On `pull_request` targeting `main` or `develop`

## Playwright projects (11)

Defined in `playwright.config.ts`. Each spec is gated at **runtime** to its
target project(s) via `test.skip(!GATE_PROJECTS.includes(testInfo.project.name))`:

| Project | workers cap | Note |
|---|---|---|
| `chromium` | 2 | Desktop, viewport 1440×900 |
| `mobile-chrome` | 2 | Pixel 5 |
| `firefox` | 1 | Desktop |
| `mobile-webkit` | 1 | iPhone 13 |
| `ios-se` | 1 | iPhone SE (3rd gen) |
| `ios-iphone` | 1 | iPhone 13 |
| `ios-pro-max` | 1 | iPhone 15 Pro Max |
| `ios-ipad-portrait` | 1 | iPad Mini |
| `ios-ipad-landscape` | 1 | iPad Mini landscape |
| `ios-ipad-pro-portrait` | 1 | iPad Pro 11 |
| `ios-ipad-pro-landscape` | 1 | iPad Pro 11 landscape |

- **Global `workers: 2`**; the per-project cap is a **limit**, not a target — a
  project can never use more workers than the global value.
- **Chromium / mobile-chrome** can run with 2 workers (safe because the admin
  rate-limit is raised in CI and the MFA/session reuse is per-worker).
- **WebKit / iOS / Firefox** are capped at 1 and must be kept **serial**: never
  launch two WebKit suites concurrently (connection-refused) and never run a
  WebKit suite in parallel with another run.

### Gating: `--list` vs runtime

- `npx playwright test --list` **still reports 1672 listed tests** (152 tests ×
  11 projects): the gating is evaluated **at runtime**, not at collection time.
- At runtime, each gated spec runs only on its target project(s), so the
  **effective execution count is drastically lower** (target ≈240 vs ~1500
  pre-gating). This is the mechanism that keeps CI fast without editing the
  listed counts.
- Never rely on `--list` numbers to reason about what actually executes.

## E2E test run invariants

- **`reuseExistingServer: false`** — Playwright always boots its own webServer
  (`.env.e2e` → Supabase project `fantacer-e2e`). Never reuse a manually started
  `next dev` (it may point to production). For manual development against
  production, use `.env`/`.env.local` as usual.
- **`globalSetup` / `globalTeardown` per run** — the E2E dataset is seeded at
  the start of every run (`global-setup.ts` → `seedTestData`) and cleaned up at
  the end (`global-teardown.ts` → `cleanupTestData`). Because seed/cleanup is
  not idempotent under concurrency, the CI jobs must be **serialized** (see
  below).
- **Guard fail-fast** — the config throws at startup if
  `NEXT_PUBLIC_SUPABASE_URL` is not the `fantacer-e2e` project. E2E → production
  is prevented by construction.
- **`fullyParallel: true`** — within a project, independent tests can run in
  parallel across workers. Suite-serial specs (`voting-flow`, `scroll-blocking`)
  opt out with `test.describe.configure({ mode: 'serial' })`, so they run
  sequentially in a single worker.

## CI concurrency and rate-limit

- **`concurrency`** in `.github/workflows/ci.yml`:
  `group: e2e-suite`, `cancel-in-progress: false`. This serializes the E2E
  jobs because the shared Supabase `fantacer-e2e` dataset + per-run
  seed/cleanup is not safe under concurrent jobs.
- **Rate-limit CI env** (set in the E2E step):
  - `ADMIN_LOGIN_RATE_MAX: 100`
  - `ADMIN_MFA_VERIFY_RATE_MAX: 100`
  These give headroom for `workers > 1` (parallel workers share IP + factorId)
  and for retries (`retries: 2` in CI).
- **Do NOT set `DEV_BYPASS_VOTE_LIMIT` in CI**: in `next start` /
  production (`NODE_ENV=production`) the guard in `src/lib/vote-dev-bypass.ts`
  makes it **inert**. `DEV_BYPASS_VOTE_LIMIT` is a **local/dev-only** variable.
- In CI the correct mechanism to avoid vote collisions is the **`e2e-voter-*`
  stub**: `stubUniqueVoteFingerprint` (in `tests/e2e/voting.helper.ts`) rewrites
  the `visitorId` of each `/api/vota` payload with a unique UUID per test, so
  every vote simulates a distinct visitor and `submit_vote` never rejects with
  "already voted". This is the invariant that lets parallel/serial voting tests
  coexist on the shared dataset.

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
cambiano le env; canary manuale su production dopo un run E2E (mai automatizzato):
`SELECT key, value FROM site_settings; SELECT active_batch FROM batch_settings
WHERE id='default';` — devono essere invariati.

## Audit visuali in production-mode

Gli audit visuali vanno eseguiti con server production (webServer = `npm run
start`, ~metà RAM di `next dev`) e **sempre con `--workers=1`** per preservare i
report `afterAll` (gli array di report sono per-worker: a più worker il report
finale risulterebbe parziale). Gli script in `package.json` includono già
`--workers=1`:

```bash
CI=true npm run visual:audit        # 27 test, chromium
CI=true npm run visual:audit:admin  # 18 test, chromium
CI=true npm run visual:audit:homepage
CI=true npm run visual:audit:ios
```

### Procedura corretta: build con `.env.e2e`

`NEXT_PUBLIC_SUPABASE_URL` viene **incorporata a build-time** nel bundle server.
Per gli audit/run in modalità produzione **sul progetto E2E**, il build deve
essere fatto con le env E2E, altrimenti il server `next start` combina l'URL
(production inlined) con la service key runtime E2E → "Invalid API key" sui
write admin (rate-limit/audit):

```bash
set -a; source .env.e2e; set +a
rm -rf .next && npm run build   # inlinea l'URL E2E nel bundle
CI=true npm run visual:audit
```

In CI questo è automatico (le `NEXT_PUBLIC_*_TEST` sono già nel workflow `env:`).

## Come riprodurre in locale

La macchina di sviluppo ha RAM limitata (~3.7GiB, WSL2) e **si blocca se la
suite E2E completa viene lanciata tutta insieme**. Per questo:

- **`npm run test:e2e` è un'operazione da CI**, non un run locale raccomandato:
  esegue tutti gli spec × 11 progetti e satura la RAM.
- In locale usare sempre i **batch dedicati** (includono `--workers=1` e
  `NODE_OPTIONS=--max-old-space-size=2560`):
  - `npm run e2e:gate` — `responsive-structural` + `voting-flow` su `chromium` + `mobile-webkit` (gate P0)
  - `npm run e2e:home` — `homepage`, `legal-pages`, `smoke`, `scroll-blocking`, `accessibility` su `chromium`
  - `npm run e2e:admin` — `admin`, `admin-auth`, `admin-sponsor`, `viewer`, `repro-phantom-500` su `chromium`

I batch forzano `--workers=1` (seriali), quindi in locale il gating di STEP B e
il parallelism di STEP C si osservano sul run CI/full, non sui batch.

## Common failures

| Failure | Likely cause |
|---|---|
| `npm ci` fails | `package-lock.json` is out of sync with `package.json`. Run `npm install` locally and commit the updated lockfile. |
| Lint fails | ESLint rules are violated. Run `npm run lint` locally to see errors. |
| Typecheck fails | TypeScript strict mode errors. Run `npm run typecheck` locally. |
| Tests fail | Jest tests are failing. Run `npm test` locally to debug. |
| Build fails | Usually missing environment variables (check GitHub Secrets) or a compilation error. |
| E2E tests fail | Playwright tests are failing. Check screenshot diffs, responsive overflow, or accessibility violations. Run the relevant local batch (`e2e:gate` / `e2e:home` / `e2e:admin`). |
| "Invalid API key" on admin writes (local prod-mode audit) | Build made without `.env.e2e` (URL production inlined). Rebuild with `.env.e2e` (see audit procedure above). |
