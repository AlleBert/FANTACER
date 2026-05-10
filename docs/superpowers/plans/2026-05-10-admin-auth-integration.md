# Admin Dashboard Implementation Plan - Integration with Supabase Auth

**Goal:** Integrare la admin dashboard con Supabase Auth usando la tabella admin_users e le RLS policies esistenti, mostrando i nuovi campi dei voti.

**Architecture:** Modificare il sistema di login per usare Supabase Auth invece del session token in-memory. La tabella admin_users diventa la fonte delle credenziali admin, con RLS policies che verificano `auth.uid()`.

**Tech Stack:** Next.js 16, Supabase Auth, Supabase RLS, TypeScript.

---

## Task 1: Preparare la struttura dati per Supabase Auth

**Files:**
- Modify: `supabase/migrations/20260510_add_admin_users_and_policies.sql`

- [ ] **Step 1: Verificare lo stato attuale di admin_users**

Eseguire query:
```sql
SELECT * FROM admin_users;
```
Verificare che esista la riga per admin@fantacer.it

- [ ] **Step 2: Aggiungere colonna auth_id per link con Supabase Auth**

```sql
ALTER TABLE admin_users ADD COLUMN auth_id UUID UNIQUE;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260510_add_admin_users_and_policies.sql
git commit -m "feat: add auth_id column to admin_users for Supabase Auth integration"
```

---

## Task 2: Configurare il login con Supabase Auth

**Files:**
- Modify: `src/app/api/admin/login/route.ts`

- [ ] **Step 1: Modificare l'API login per usare Supabase Auth**

Sostituire l'intero contenuto del file con:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, mfaCode } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenziali richieste' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Verify user exists in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      return NextResponse.json({ error: 'Credenziali non valide' }, { status: 401 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 401 })
    }

    // Update admin_users with auth_id if not set
    if (!adminUser.auth_id) {
      await supabase
        .from('admin_users')
        .update({ auth_id: authData.user.id })
        .eq('id', adminUser.id)
    }

    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, email: authData.user.email }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )

  if (error || !user) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  // Verify user is in admin_users
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('auth_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminUser) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  return NextResponse.json({ valid: true, email: user.email })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/login/route.ts
git commit -m "feat: update login API to use Supabase Auth"
```

---

## Task 3: Aggiornare la pagina di login

**Files:**
- Modify: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Modificare la gestione della risposta login**

Modificare la sezione `handleSubmit` (righe 48-64):

```typescript
      if (!res.ok) {
        setError(data.error || 'Login failed')
      } else {
        // Store the access token
        localStorage.setItem('admin_session', data.user.id)
        router.push('/admin/dashboard')
      }
```

- [ ] **Step 2: Aggiornare il layout della risposta per usare il token**

Modificare la sezione useEffect per il bypass (righe 26-32):

```typescript
  useEffect(() => {
    if (isBypassEnabled()) {
      localStorage.setItem('admin_session', 'dev-bypass-token')
      router.push('/admin/dashboard')
    }
  }, [router])
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/login/page.tsx
git commit -m "feat: update login page to handle Supabase Auth response"
```

---

## Task 4: Aggiornare la dashboard per usare il nuovo auth

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Modificare la verifica sessione**

Trovare la funzione `checkAuth` (circa righe 147-175) e sostituire:

```typescript
  const checkAuth = async () => {
    if (isBypassEnabled()) {
      setLoading(false)
      return
    }

    const session = localStorage.getItem('admin_session')
    if (!session) {
      router.push('/admin/login')
      return
    }

    // Verify with Supabase Auth
    const res = await fetch('/api/admin/login', {
      headers: { Authorization: `Bearer ${session}` }
    })

    if (!res.ok) {
      localStorage.removeItem('admin_session')
      router.push('/admin/login')
      return
    }

    loadData()
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/dashboard/page.tsx
git commit -m "feat: update dashboard auth check to use Supabase Auth"
```

---

## Task 5: Applicare le modifiche al database

**Files:**
- (database migration)

- [ ] **Step 1: Applicare la migration per auth_id**

```bash
cd /mnt/c/fantacer && npx supabase db push
```

- [ ] **Step 2: Creare utente admin in Supabase Auth**

L'utente admin@fantacer.it deve essere creato in Supabase Auth. Per farlo, si può usare la dashboard Supabase o un comando CLI. Questo passaggio richiede azione manuale o script dedicato.

- [ ] **Step 3: Linkare admin_users con auth_id**

```sql
-- Eseguire dopo aver creato l'utente in Supabase Auth
UPDATE admin_users
SET auth_id = <auth_user_id>
WHERE email = 'admin@fantacer.it';
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: apply auth_id migration and setup admin user"
```

---

## Task 6: Testare il flusso completo

- [ ] **Step 1: Testare il login**

1. Aprire http://localhost:3000/admin/login
2. Inserire admin@fantacer.it e password
3. Verificare redirect a /admin/dashboard
4. Verificare che i dati siano visualizzati correttamente

- [ ] **Step 2: Testare i nuovi campi voti**

1. Nella dashboard, andare alla sezione "Registro Voti"
2. Verificare che siano visualizzate le colonne: Commento, Aggettivo, Innovazione, Vendibilità, Wow
3. Verificare che i dati siano corretti

- [ ] **Step 3: Testare le RLS policies**

1. Tentare di accedere ai dati senza essere loggati (incarnare un utente non-admin)
2. Verificare che l'accesso sia negato

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "test: verify login flow and new vote fields"
```

---

## Task 7: Gestire il logout

**Files:**
- Modify: `src/components/admin/sidebar.tsx` (o dove si trova il logout)

- [ ] **Step 1: Aggiungere funzionalità logout con Supabase Auth**

Trovare il button di logout e aggiungere:

```typescript
const handleLogout = async () => {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await supabase.auth.signOut()
  localStorage.removeItem('admin_session')
  router.push('/admin/login')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sidebar.tsx
git commit -m "feat: add logout functionality with Supabase Auth"
```

---

## Riepilogo delle modifiche

| File | Modifica |
|------|----------|
| `supabase/migrations/20260510_add_admin_users_and_policies.sql` | Aggiungere colonna auth_id |
| `src/app/api/admin/login/route.ts` | Usare Supabase Auth per login |
| `src/app/admin/login/page.tsx` | Adattare gestione risposta |
| `src/app/admin/dashboard/page.tsx` | Verificare sessione con Supabase Auth |
| `src/components/admin/sidebar.tsx` | Implementare logout |