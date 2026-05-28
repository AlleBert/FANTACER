# Coming-Soon Admin Toggle — Design

## Summary

Add an admin toggle in the FANTACER dashboard to enable/disable the coming-soon
page without redeploying. The toggle is stored in a `site_settings` table on
Supabase and read by the Next.js proxy at the edge.

## Architecture

```
Admin Dashboard (tab Impostazioni)
  └─ toggle + confirm modal
       └─ PUT /api/admin/settings/coming-soon
            └─ writes to Supabase `site_settings` table

Proxy (every request)
  ├─ checks env var override (NEXT_PUBLIC_9X4M2K8L)
  ├─ fetches GET /api/public/flag/coming-soon
  │    └─ reads from Supabase `site_settings` table
  └─ if either is active → redirect to /coming-soon (or 503 for API)
```

## Data Layer

### New table: `site_settings`

```sql
CREATE TABLE site_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (key, value)
VALUES ('coming_soon_enabled', 'false');
```

Row-level: no RLS needed — the public API route is the access gate.

## API Routes

### `GET /api/public/flag/coming-soon`

- **Auth:** none (public)
- **Response:** `{ enabled: boolean }`
- **Cache:** plain fetch, no caching (the proxy calls this on every request)

### `PUT /api/admin/settings/coming-soon`

- **Auth:** admin session (Bearer token from localStorage, same as existing admin routes)
- **Body:** `{ enabled: boolean }`
- **Response:** `{ success: true }`

## Proxy Logic

```
1. Check env var override → if active, skip DB check
2. Fetch GET /api/public/flag/coming-soon
3. If fetch fails → treat as false (failsafe: site stays live)
4. If env override OR DB flag → redirect to /coming-soon (pages), 503 (API)
```

Same exemptions as current proxy: `/coming-soon`, `/api/` (pass through),
`/_next/static`, `/favicon.ico` (matcher exclusion).

## Admin UI

- New tab "Impostazioni" in the existing tab bar (Panoramica, Aziende, Voti,
  Sicurezza, **Impostazioni**)
- Single setting card with a switch/toggle labeled "Coming Soon"
- On toggle:
  1. Show a confirmation modal: "Sei sicuro di voler attivare/disattivare la
     pagina coming-soon?"
  2. On confirm → call PUT API → update UI
  3. On cancel → reset toggle to previous state
- Uses existing shadcn components (Button, Card, Switch/Checkbox, Dialog)

## Files

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_site_settings.sql` | Create |
| `src/app/api/public/flag/coming-soon/route.ts` | Create |
| `src/app/api/admin/settings/coming-soon/route.ts` | Create |
| `src/proxy.ts` | Modify (add DB fetch) |
| `src/app/admin/dashboard/page.tsx` | Modify (add Impostazioni tab) |
