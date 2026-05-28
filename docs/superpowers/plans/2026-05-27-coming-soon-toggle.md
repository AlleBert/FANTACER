# Coming-Soon Admin Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a toggle in the admin dashboard to enable/disable the coming-soon page, with a confirmation modal.

**Architecture:** New `site_settings` table in Supabase stores the flag. A public API route serves the flag to the proxy. An admin API route writes the flag. The admin dashboard calls the admin API on toggle.

**Tech Stack:** Supabase (PostgreSQL), Next.js 16 Route Handlers, shadcn/ui

---

### Task 1: Create migration for `site_settings` table

**Files:**
- Create: `supabase/migrations/20260527000000_site_settings.sql`

- [ ] **Write migration SQL**

Write file `supabase/migrations/20260527000000_site_settings.sql`:

```sql
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (key, value)
VALUES ('coming_soon_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Commit**

```bash
git add supabase/migrations/20260527000000_site_settings.sql
git commit -m "feat: add site_settings table for coming-soon toggle"
```

---

### Task 2: Create public API route to read the flag

**Files:**
- Create: `src/app/api/public/flag/coming-soon/route.ts`

- [ ] **Write the route**

Create `src/app/api/public/flag/coming-soon/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'coming_soon_enabled')
      .single();

    if (error) throw error;
    return NextResponse.json({ enabled: data.value === 'true' });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/public/flag/coming-soon/route.ts
git commit -m "feat: add public API to read coming-soon flag"
```

---

### Task 3: Create admin API route to write the flag

**Files:**
- Create: `src/app/api/admin/settings/coming-soon/route.ts`

- [ ] **Write the route**

Create `src/app/api/admin/settings/coming-soon/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify admin session via Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const enabled = body.enabled === true;

    const { error } = await supabase
      .from('site_settings')
      .update({ value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() })
      .eq('key', 'coming_soon_enabled');

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'coming_soon_enabled')
      .single();

    if (error) throw error;
    return NextResponse.json({ enabled: data.value === 'true' });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/admin/settings/coming-soon/route.ts
git commit -m "feat: add admin API to toggle coming-soon flag"
```

---

### Task 4: Update proxy to check DB flag

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Update proxy.ts**

Edit `src/proxy.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const envOverride = process.env.NEXT_PUBLIC_9X4M2K8L === 'm9fK2pL7xQ';

  let dbEnabled = false;
  try {
    const flagUrl = new URL('/api/public/flag/coming-soon', request.url);
    const res = await fetch(flagUrl);
    if (res.ok) {
      const data = await res.json();
      dbEnabled = data.enabled === true;
    }
  } catch {
    // failsafe: if fetch fails, site stays live
  }

  if (!envOverride && !dbEnabled) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (pathname === '/coming-soon') {
    return NextResponse.next();
  }

  const url = new URL('/coming-soon', request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

- [ ] **Build check**

Run: `npx next build`
Expected: Compiles, Proxy shows in routes.

- [ ] **Commit**

```bash
git add src/proxy.ts
git commit -m "feat: proxy now checks DB flag alongside env override"
```

---

### Task 5: Add Impostazioni tab to admin dashboard

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`

- [ ] **Add Impostazioni tab with toggle + confirmation modal**

Replace `# Sicurezza Tab` section and add new tab entry. Key changes:

1. Add `Settings` icon to imports
2. Add `'impostazioni'` to `activeTab` state type
3. Add Impostazioni tab button
4. Add Impostazioni tab content with toggle card + modal

```typescript
// After vote tab button, add:
<button
  onClick={() => setActiveTab('settings')}
  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${
    activeTab === 'settings'
      ? 'border-primary text-primary bg-primary/5'
      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
  }`}
>
  <Settings className="h-4 w-4" />
  Impostazioni
</button>
```

For the Impostazioni content, add a new section:

```tsx
{activeTab === 'settings' && <SettingsTabContent />}
```

Define the `SettingsTabContent` component:

```tsx
function SettingsTabContent() {
  const [comingSoonEnabled, setComingSoonEnabled] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingValue, setPendingValue] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [loadingFlag, setLoadingFlag] = useState(true)

  useEffect(() => {
    fetch('/api/admin/settings/coming-soon')
      .then(res => res.json())
      .then(data => setComingSoonEnabled(data.enabled))
      .finally(() => setLoadingFlag(false))
  }, [])

  const handleToggle = async () => {
    const newValue = !comingSoonEnabled
    setPendingValue(newValue)
    setShowConfirmModal(true)
  }

  const confirmToggle = async () => {
    setUpdating(true)
    try {
      const res = await fetch('/api/admin/settings/coming-soon', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: pendingValue }),
      })
      if (res.ok) {
        setComingSoonEnabled(pendingValue)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(false)
      setShowConfirmModal(false)
    }
  }

  return (
    <>
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Impostazioni Sito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-foreground">Coming Soon</p>
              <p className="text-sm text-muted-foreground">
                {comingSoonEnabled
                  ? 'Attivo — il sito mostra la pagina coming-soon'
                  : 'Disattivo — il sito è accessibile normalmente'}
              </p>
            </div>
            {loadingFlag ? (
              <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
            ) : (
              <button
                onClick={handleToggle}
                disabled={updating}
                className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                  comingSoonEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    comingSoonEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">
              {pendingValue ? 'Attivare coming-soon?' : 'Disattivare coming-soon?'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {pendingValue
                ? 'Tutti gli utenti verranno reindirizzati alla pagina coming-soon. Le API rimarranno accessibili.'
                : 'Il sito tornerà accessibile a tutti gli utenti.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                disabled={updating}
              >
                Annulla
              </button>
              <button
                onClick={confirmToggle}
                disabled={updating}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                  pendingValue
                    ? 'bg-destructive hover:bg-destructive/90'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {updating ? 'Aggiornamento...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

Import `Settings` from lucide-react.

- [ ] **Build check**

Run: `npx next build`
Expected: Compiles, all 19 routes present.

- [ ] **Commit**

```bash
git add src/app/admin/dashboard/page.tsx
git commit -m "feat: add Impostazioni tab with coming-soon toggle + confirmation modal"
```

---

### Verification

- [ ] **Full build**

Run: `npx next build`
Expected: Success, no errors.

- [ ] **Push**

```bash
git push origin master
```
