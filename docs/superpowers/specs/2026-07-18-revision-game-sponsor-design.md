# Revisione Gioco e Sponsor — Design Document

Data: 2026-07-18
Stato: Bozza

## Panoramica

Ristrutturazione del flusso di voto e introduzione del sistema sponsor.

## Modifiche DB

### Nuova tabella: `sponsors`

```sql
create table sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  website_url text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sponsors enable row level security;

create policy "sponsors_public_select" on sponsors
  for select using (is_active = true);

create policy "sponsors_service_insert" on sponsors
  for insert to service_role with check (true);

create policy "sponsors_service_update" on sponsors
  for update to service_role using (true) with check (true);

create policy "sponsors_service_delete" on sponsors
  for delete to service_role using (true);
```

### Nuova tabella: `vote_sessions`

Sostituisce il modello attuale (1 company + comment + adjective + 3 sliders) con voto a 3 aziende.

```sql
create table vote_sessions (
  id bigint primary key generated always as identity,
  fingerprint text not null,
  ip_hash text,
  user_agent text,
  country text default 'IT',
  company1_id uuid not null references companies(id) on delete cascade,
  company2_id uuid not null references companies(id) on delete cascade,
  company3_id uuid not null references companies(id) on delete cascade,
  pallet1 integer not null default 4 check (pallet1 = 4),
  pallet2 integer not null default 2 check (pallet2 = 2),
  pallet3 integer not null default 1 check (pallet3 = 1),
  created_at timestamptz default now(),
  constraint different_companies check (
    company1_id != company2_id and
    company1_id != company3_id and
    company2_id != company3_id
  )
);

create index idx_vote_sessions_fingerprint on vote_sessions(fingerprint, created_at desc);
create index idx_vote_sessions_company1 on vote_sessions(company1_id);
create index idx_vote_sessions_company2 on vote_sessions(company2_id);
create index idx_vote_sessions_company3 on vote_sessions(company3_id);

alter table vote_sessions enable row level security;

create policy "vote_sessions_service_select" on vote_sessions
  for select to service_role using (true);

create policy "vote_sessions_service_insert" on vote_sessions
  for insert to service_role with check (true);
```

### Modifiche alla tabella `votes`

Rimuovere colonne ormai inutilizzate (mantenendo la tabella per rollback):
- `comment` (text)
- `adjective` (text)
- `slider_innovation` (int)
- `slider_sales` (int)
- `slider_wow` (int)

### RPC `submit_vote` riscritta

```sql
create or replace function submit_vote(
  fingerprint_param text,
  ip_param text,
  user_agent_param text,
  country_param text default 'IT',
  company1_id_param uuid,
  company2_id_param uuid,
  company3_id_param uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  already_voted boolean;
begin
  select exists (
    select 1 from vote_sessions
    where fingerprint = fingerprint_param
      and created_at::date = current_date
  ) into already_voted;

  if already_voted then
    return jsonb_build_object('success', false, 'error', 'Hai già votato oggi');
  end if;

  insert into vote_sessions (
    fingerprint, ip_hash, user_agent, country,
    company1_id, company2_id, company3_id
  ) values (
    fingerprint_param,
    md5(ip_param),
    user_agent_param,
    country_param,
    company1_id_param,
    company2_id_param,
    company3_id_param
  );

  -- Update daily_stats for each company (admin analytics)
  insert into daily_stats (company_id, date, vote_count, unique_voters)
  values
    (company1_id_param, current_date, 1, 1),
    (company2_id_param, current_date, 1, 1),
    (company3_id_param, current_date, 1, 1)
  on conflict (company_id, date)
  do update set
    vote_count = daily_stats.vote_count + 1,
    unique_voters = daily_stats.unique_voters + 1;

  insert into audit_logs (event_type, fingerprint, ip_address, metadata)
  values (
    'vote_submitted',
    fingerprint_param,
    ip_param,
    jsonb_build_object(
      'company1', company1_id_param,
      'company2', company2_id_param,
      'company3', company3_id_param
    )
  );

  return jsonb_build_object('success', true);
exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;
```

## Nuovo componente: `SponsorCards`

Componente riutilizzabile che mostra max 4 card sponsor.

API pubblica: `GET /api/public/sponsors` → `{ sponsors: Sponsor[] }` con `is_active = true` ordinati per `sort_order`.

Layout: 4 card in griglia 2x2 su mobile, row su desktop. Click → apre sito web in nuova tab. Se tutte disattive: non renderizza.

## Sezioni — Ordine aggiornato

| # | Sezione | Stato |
|---|---------|-------|
| 1 | HeroSection | Invariata |
| 2 | IntroSection | **+ SponsorCards** |
| 3 | HowItWorksSection | **Step 2 rimosso** (3 card rimanenti) |
| 4 | PlayAgainSection | Invariata |
| 5 | PrizeLocationSection | Invariata |
| 6 | SearchSection | **Riscritta** — 3 aziende + pallet + classifica locale |
| 7 | SubmitSection | **Nuova** — riepilogo + sponsor + bottone INVIA |
| 8 | PublicRankingSection | **Nuova** — "GUARDA LA CLASSIFICA" + sponsor |
| 9 | LiveRankingSection | **Nuova** — top 5/10 LIVE + sponsor |
| 10 | ContactSection | **Spostata** come ultima |

## VoteContext — Nuovo stato

```ts
interface VoteState {
  selectedCompanies: {
    company: { id: string; name: string };
    pallet: 4 | 2 | 1;
  }[];
  currentSection: 1 | 2;
  gameUnlock: { submit: boolean; success: boolean };
}
```

Azioni: `SET_COMPANY`, `REMOVE_COMPANY`, `SET_PALLET`, `UNLOCK_GAME_STEP`, `RESET`.

## SearchSection — Comportamento

1. Barra ricerca (fetch activeBatch + Supabase)
2. Click risultato → scegli 4/2/1 pallet
3. Classifica locale sotto barra (nome + badge pallet + 🗑️)
4. Ogni valore pallet una volta sola
5. Con 3 selezionate → ">>" abilitato
6. ">>" → unlock submit → scroll SubmitSection

## SubmitSection + Success

- Riepilogo 3 aziende con pallet
- SponsorCards sotto
- Bottone "INVIA IL TUO VOTO"
- Turnstile → POST /api/vota
- Successo → confetti → scroll PublicRankingSection

## PublicRankingSection

- Sempre visibile
- Mostra le 3 aziende votate (se ha votato) + SponsorCards

## LiveRankingSection

- Sempre visibile
- `GET /api/public/ranking` → top aziende per pallet totali (query aggregation)
- Refetch 30s
- SponsorCards sotto

## Admin — Gestione Sponsor

Nuova pagina: `/admin/dashboard/sponsor`
API: `GET/POST/PUT/DELETE /api/admin/sponsors[/:id]`
Tabella `@tanstack/react-table` + modal CRUD.
Sidebar + bottom nav: nuovo link Sponsor.

## API /api/vota — Riscritta

Input: `{ company1Id, company2Id, company3Id, fingerprint, turnstile_token }`
Validazioni: rate limit, geoblocking, company batch, Turnstile.
Chiama `submit_vote` RPC con 3 company_id.

## Cose da rimuovere

- **UI:** `comment-section.tsx`, `ranking-section.tsx`, `innovation-section.tsx`
- **UI:** `ranking-option.tsx`, `ranking-bar.tsx`
- **DB:** colonne `comment`, `adjective`, `slider_innovation`, `slider_sales`, `slider_wow`
- **VoteContext:** `comment`, `adjective`, `sliders`, vecchi `gameUnlock` flag
- **Admin pagina voti:** leggere da `vote_sessions` invece di `votes`
- **Admin analytics:** update query `daily_stats` per `vote_sessions` (già gestito in RPC)

## Cose da creare

- `SponsorCards` (componente)
- `SubmitSection`, `PublicRankingSection`, `LiveRankingSection`
- `src/app/api/public/ranking/route.ts`
- `src/app/api/public/sponsors/route.ts`
- `src/app/api/admin/sponsors/route.ts`
- Migrazione Supabase
- Pagina admin sponsor
- `admin/sponsor-table.tsx`

## Cose da modificare

- `IntroSection` (+ SponsorCards)
- `HowItWorksSection` (step 2 rimosso)
- `SearchSection` (3 aziende + pallet)
- `VoteContext` (nuovo stato)
- `page.tsx` (nuovo ordine)
- `src/app/api/vota/route.ts` (nuovo input)
- `src/lib/supabase/vote-api.ts` (nuova logica)
- Admin `src/app/api/admin/votes/route.ts` (leggere da `vote_sessions`)
- Admin `src/app/dashboard/voti/page.tsx` (adattare a nuovo schema)
- Admin `src/app/api/analytics/route.ts` (verificare compatibilità con `daily_stats`)
- Sidebar + bottom nav admin (+ link sponsor)
