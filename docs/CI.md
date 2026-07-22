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

## Required GitHub Secrets

The E2E and build steps need environment variables. Set them as repository secrets in
**Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

Both values are in `.env` (local) or `.env.example` (template). They are prefixed
`NEXT_PUBLIC_` — safe to expose to the client, but the build process needs them
at compile time.

Private keys (`SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`) are **not**
required by the build or E2E steps. The Playwright webServer config injects dummy
Turnstile keys and the dev bypass env var automatically.

## Common failures

| Failure | Likely cause |
|---|---|
| `npm ci` fails | `package-lock.json` is out of sync with `package.json`. Run `npm install` locally and commit the updated lockfile. |
| Lint fails | ESLint rules are violated. Run `npm run lint` locally to see errors. |
| Typecheck fails | TypeScript strict mode errors. Run `npm run typecheck` locally. |
| Tests fail | Jest tests are failing. Run `npm test` locally to debug. |
| Build fails | Usually missing environment variables (check GitHub Secrets) or a compilation error. |
| E2E tests fail | Playwright tests are failing. Run `npm run test:e2e` locally. Check screenshot diffs, responsive overflow, or accessibility violations. |
