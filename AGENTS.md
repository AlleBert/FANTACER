# FANTACER — AI Agent Guide

**FANTACER** is a **real-time company voting platform** for a 5-day trade fair (Fiera). ~350 companies compete for votes with live top-3/top-10 rankings. Built with **Next.js 16**, **Supabase**, and **fingerprint-based voting protection**.

## Project Goals
- **Mobile-first** (99% of traffic)
- **1 vote per device/day** (device fingerprint + behavioral scoring)
- **Realtime top 3/10 rankings** (Supabase Realtime)
- **Admin dashboard** with analytics, CSV import/export, audit logs
- **Post-fair readonly mode** and 5-day event window
- See [PLAN.md](PLAN.md) for full implementation roadmap (5 phases)

## Tech Stack
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: TailwindCSS 4 + shadcn/ui + Framer Motion
- **Backend**: Supabase (PostgreSQL + Realtime) + Next.js API Routes
- **Security**: Device fingerprint (Canvas + LocalStorage), Cloudflare Turnstile, RLS policies
- **Tables & Virtualization**: @tanstack/react-table, @tanstack/react-virtual
- **Charts**: Recharts (admin analytics)
- **UI Components**: shadcn/ui (Lucide icons), @base-ui/react

⚠️ **Next.js 16 has breaking changes**. Read `node_modules/next/dist/docs/` before writing code.

## Architecture

### 1. **Voting Flow** (`src/app/page.tsx`, `src/components/voting/`)
- User lands on home → sees company cards
- Clicks vote → Turnstile CAPTCHA challenge
- **Device fingerprint** checked (Canvas + device ID from localStorage)
- **Daily vote limit** enforced via fingerprint + date
- Vote recorded → realtime top-3/top-10 updates
- Post-vote thank you screen
- **Security bypass**: Env var `NEXT_PUBLIC_X7K2M9QS3P=hx7k2m9Qs3P` disables Turnstile (dev only)

### 2. **Admin System** (`src/app/admin/`)
- **Login page** with MFA (TODO: implementation)
- **Dashboard** (`/admin/dashboard`) — realtime vote counts, trends, analytics graphs
- **Import** (`/admin/import`) — CSV batch upload for companies
- **Audit logs** — vote log table, company change history
- IP whitelist validation, rate limiting
- Analytics export (CSV/Excel) for monetization

### 3. **API Endpoints** (`src/app/api/`)
```
/api/vota                    POST   Record a vote
/api/ranking                 GET    Top 10 companies with vote counts + trends
/api/aziende                 GET    List all companies (paginated or search)
/api/aziende/:id             PUT    Update company (admin only)
/api/admin/*                 [auth] Admin endpoints
/api/analytics/*             [auth] Analytics/export endpoints
```

### 4. **Device Fingerprinting** (`src/lib/fingerprint.ts`)
- **LocalStorage-based** device ID (`fantacer_device_id`)
- **Canvas fingerprinting** for additional entropy
- **Last vote date** tracked in localStorage (`fantacer_last_vote`)
- **Behavioral scoring** (TODO: implement via server-side telemetry)
- Daily reset checks UTC midnight

### 5. **Database** (`supabase/migrations/`, `src/lib/supabase/schema.sql`)
- `companies` — 350 votable companies (name, category, image_url)
- `votes` — vote records (company_id, device_fingerprint, created_at, vote_date)
  - **Partitioned by vote_date** for performance
  - **RLS policies** enforce 1 vote per device/day
- `analytics_raw` — raw telemetry (IP, user agent, geo)
- `daily_stats` — aggregated vote counts (realtime view)
- `admin_users` — admin credentials + MFA
- **RPC**: `check_vote_allowed()` validates vote eligibility server-side

---

## Key Files & Patterns

| Path | Purpose |
|------|---------|
| [src/app/page.tsx](src/app/page.tsx) | Main voting interface (sections + company list) |
| [src/components/company-card.tsx](src/components/company-card.tsx) | Single company card with vote button |
| [src/components/ranking-bar.tsx](src/components/ranking-bar.tsx) | Live top-3/top-10 display |
| [src/app/admin/dashboard/page.tsx](src/app/admin/dashboard/page.tsx) | Admin realtime stats & charts |
| [src/app/api/vota/route.ts](src/app/api/vota/route.ts) | Vote submission + fingerprint check |
| [src/lib/fingerprint.ts](src/lib/fingerprint.ts) | Device ID + daily vote tracking |
| [src/lib/supabase/client.ts](src/lib/supabase/client.ts) | Browser Supabase client (SSR-safe) |
| [src/lib/supabase/server.ts](src/lib/supabase/server.ts) | Server-side Supabase (admin operations) |
| [supabase/migrations/](supabase/migrations/) | SQL migrations (vote protection, RPC) |

## Development Commands
```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Run production server
npm run lint     # ESLint check
```

## Important Conventions

### Supabase Client Setup
- **Browser**: Use `createBrowserClient()` from `@supabase/ssr` (handles ANON_KEY)
- **Server**: Use `createClient()` with SERVICE_ROLE_KEY for admin operations
- Import from `src/lib/supabase/{client,server}.ts`

### Vote Validation (Multi-Layer)
1. **Client-side**: Check localStorage last vote date
2. **Turnstile**: CAPTCHA challenge (can be bypassed with env var)
3. **Server-side RPC**: `check_vote_allowed()` — authoritative check before INSERT
4. **Database RLS**: Final layer, rejects duplicates

### Mobile-First Styling
- All components assume mobile viewport first
- Use TailwindCSS responsive prefixes (`md:`, `lg:`) for breakpoints
- Test on actual mobile devices (99% of users)

### Realtime Subscriptions
- Use Supabase `.on('postgres_changes')` for vote/ranking updates
- Subscribe to `daily_stats` table for top-10 changes
- Clean up subscriptions in `useEffect` cleanup

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL          Browser client URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     Browser client anon key
NEXT_PUBLIC_X7K2M9QS3P            Voting bypass (dev only)
SUPABASE_SERVICE_ROLE_KEY         Server-side admin operations
```

## Common Pitfalls & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| "Votes not appearing" | Device already voted today | Check localStorage `fantacer_last_vote` and UTC date |
| "RLS policy rejected" | Vote fingerprint doesn't match | Ensure `getCombinedFingerprint()` produces consistent hash |
| "Turnstile fails" | Wrong site key or network issue | Verify env vars, check Cloudflare dashboard |
| "Realtime not updating" | Subscription not cleanup | Add `.unsubscribe()` in useEffect cleanup |
| "Build fails" | Next.js 16 API change | Check `node_modules/next/dist/docs/` for deprecations |

## Testing & Debugging

- **Clear device**: Open DevTools → Application → Storage → Delete `fantacer_*`
- **Bypass voting protection** (dev): Set `NEXT_PUBLIC_X7K2M9QS3P=hx7k2m9Qs3P` in `.env.local`
- **Reset daily vote**: Manually update localStorage date to past date
- **Inspect fingerprint**: `console.log(getCombinedFingerprint())` in browser
- **Check RLS**: Query `daily_stats` directly via Supabase dashboard

## Related Docs & Plans
- [PLAN.md](PLAN.md) — Full 5-phase implementation roadmap
- [docs/superpowers/specs/](docs/superpowers/specs/) — Design specs and refactor plans
- [docs/superpowers/plans/](docs/superpowers/plans/) — Task breakdowns and priorities
- Supabase schema: [src/lib/supabase/schema.sql](src/lib/supabase/schema.sql)
- Migration scripts: [supabase/migrations/](supabase/migrations/)

---

**Last updated**: May 5, 2026
