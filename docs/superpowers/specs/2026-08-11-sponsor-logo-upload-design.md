# Sponsor Logo Upload — Design

**Data:** 2026-08-11
**Stato:** approvato (in attesa di review)

## Obiettivo

Nella pagina admin `/admin/dashboard/sponsor`, sostituire l'input testuale "URL Logo" con un caricamento classico da PC: drag & drop e/o selezione file. Il file viene caricato in un bucket Supabase Storage e l'URL pubblico risultante salvato nella colonna `image_url` (che resta `text`).

## Requisiti

1. Input logo solo via drag & drop / selezione file — il campo URL testuale viene rimosso.
2. Storage: bucket pubblico Supabase `sponsor-logos`.
3. Vincoli file: tipi `png`, `jpg`, `jpeg`, `webp`, `svg`; dimensione max 5MB. Rifiuto con messaggio chiaro.
4. Cleanup: al cambio logo o alla cancellazione dello sponsor, il file orfano nel bucket viene eliminato.
5. Compatibilità: sponsor esistenti con `image_url` esterno continuano a funzionare; solo l'input cambia.
6. Nessuna dipendenza nuova; nessuna alterazione schema DB.

## Architettura

Approccio A — upload integrato nella save (unica request `multipart/form-data` verso `/api/admin/sponsors`).

### Bucket Storage (migrazione)

Nuovo file `supabase/migrations/20260811000000_sponsor_logos_bucket.sql`:

```sql
insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do nothing;

create policy "sponsor_logos_public_select" on storage.objects
  for select using (bucket_id = 'sponsor-logos');
```

Le operazioni write avvengono con il client service-role (bypassa RLS), quindi non servono policy di insert/delete.

### Helper `src/lib/sponsor-logo.ts`

Funzioni pure di supporto:

- `BUCKET = 'sponsor-logos'`
- `ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg']`
- `MAX_FILE_BYTES = 5 * 1024 * 1024`
- `buildLogoPath(seed: string, ext: string): string` → `sponsors/{seed}.{ext}` dove `seed` è un uuid generato con `crypto.randomUUID()` ad ogni upload (POST e PUT). Seed univoco ad ogni caricamento evita collisioni di path quando un logo viene sostituito con un file della stessa estensione (`upsert: false` non sovrascrive).
- `getExtFromFilename(name: string): string | null` → estensione in minuscolo se ammessa, altrimenti null.
- `getPublicLogoUrl(bucketUrl: string, path: string): string` → concatena `NEXT_PUBLIC_SUPABASE_URL` + `/storage/v1/object/public/{bucket}/{path}`.
- `isBucketUrl(url: string): boolean` → vero se `url` contiene `/storage/v1/object/public/sponsor-logos/`.
- `extractPathFromUrl(url: string): string | null` → restituisce il path dopo `sponsor-logos/` se `isBucketUrl`, altrimenti null.

### API `/api/admin/sponsors/route.ts`

POST e PUT devono gestire sia JSON (backward compat per `handleToggleActive` e client esistenti) sia `multipart/form-data`.

Rilevamento: `request.headers.get('content-type')?.includes('multipart/form-data')`.

**POST (FormData):**
1. `requireRoleAdmin(request)`.
2. `const form = await request.formData()`; legge `name`, `website_url`, `is_active`, `sort_order`, `file`.
3. Se `name` vuoto → 400 "Nome obbligatorio".
4. Se `file` presente: estrai estensione ammessa (`getExtFromFilename`); se non ammessa → 400 "Formato immagine non supportato. Usa PNG, JPG, JPEG, WEBP o SVG". Se `file.size > MAX_FILE_BYTES` → 400 "Immagine troppo grande (max 5MB)".
5. Upload con `createAdminClient().storage.from(BUCKET).upload(buildLogoPath(crypto.randomUUID(), ext), file, { contentType: file.type, upsert: false })`. Su errore → 500.
6. `image_url = getPublicLogoUrl(...)`.
7. Insert nello `sponsors`, `.select().single()`, ritorna l'oggetto.

**PUT (FormData):**
1. `requireRoleAdmin(request)`; richiede `id` → 400 se assente.
2. Legge campi + `file` opzionale.
3. Fetch dello sponsor esistente (per recuperare il vecchio `image_url`).
4. Se `file` presente: valida come sopra, carica con `buildLogoPath(crypto.randomUUID(), ext)`, nuova `image_url`; se il vecchio `image_url` è nel bucket (`isBucketUrl`), elimina il vecchio oggetto (`storage.from(BUCKET).remove([path])`).
5. Se `file` assente: `image_url` resta quello del corpo (se fornito) oppure quello esistente.
6. Update con `.select().single()`.

**PUT (JSON)** — invariato rispetto a oggi, per `handleToggleActive` e backward compat.

**DELETE:**
1. `requireRoleAdmin(request)`; richiede `id`.
2. Fetch dello sponsor; se `image_url` è nel bucket, `remove([path])`.
3. `delete().eq('id', id)`.
4. Su errore storage: logga ma non blocca la cancellazione del record (best-effort cleanup).

### UI `src/app/admin/dashboard/sponsor/page.tsx`

- Rimuovere l'input "URL Logo".
- Aggiungere dropzone (pattern di `src/app/admin/dashboard/import/page.tsx`):
  - input nascosto `<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">` + area cliccabile.
  - `onDragOver`/`onDragLeave`/`onDrop` per evidenziare e catturare il file.
  - Messaggio: "Trascina il logo qui o clicca per caricare".
  - Validazione client di tipo/estensione e dimensione (≤5MB) prima dell'invio, con messaggio d'errore inline.
- Stato form: aggiungere `logoFile: File | null`. Mantenere `image_url` per l'anteprima dello sponsor esistente.
- Anteprima:
  - Se `logoFile` selezionato → thumbnail via `URL.createObjectURL(logoFile)` + pulsante "Rimuovi".
  - Altrimenti se `image_url` esistente → thumbnail dello sponsor attuale.
- `handleSave`:
  - `FormData`: append di `name`, `website_url`, `sort_order`, `is_active`, e `logoFile` se presente.
  - `fetch('/api/admin/sponsors', { method: editing ? 'PUT' : 'POST', body: formData })`.
  - Reset di `logoFile` a chiusura modal.
- `handleToggleActive` invariato (JSON).

## Gestione errori

- Errori server: risposta JSON `{ error: string }` con status 400/401/403/500; messaggi in italiano.
- Errori client (tipo/dimensione): mostrati nella dropzone senza inviare la request.
- Fallimento upload: mostra l'errore e non chiude il modal.

## Test

- Unit: helper `sponsor-logo.ts` (estrazione estensione, `isBucketUrl`, `extractPathFromUrl`, `getPublicLogoUrl`, `buildLogoPath`).
- E2E su `/admin/dashboard/sponsor`: crea sponsor con logo via upload file (fixture PNG), verifica `image_url` popolato e anteprima; modifica logo (verifica rimozione vecchio); delete (verifica rimozione file). Verifica rifiuto formato non ammesso e file >5MB.

## File coinvolti

| File | Azione |
|---|---|
| `supabase/migrations/20260811000000_sponsor_logos_bucket.sql` | nuovo |
| `src/lib/sponsor-logo.ts` | nuovo |
| `src/app/api/admin/sponsors/route.ts` | modificato |
| `src/app/admin/dashboard/sponsor/page.tsx` | modificato |
