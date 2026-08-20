# Redesign SuccessSection — Design

## Summary

Riprogettare la pagina che si sblocca dopo il voto (`SuccessSection`): da layout
a due colonne con mockup iPhone a una **colonna unica centrata** in stile
"sticker party", allineata ai token dell'app. Si eliminano il mockup iPhone e le
icone social inline attuali; si aggiunge uno scontrino-personale con i punteggi
pallet delle 3 aziende votate, un bottone **Condividi** (Web Share API) e le
icone social Lucide linkate ai profili, poste sotto gli sponsor.

Nessuna modifica a dati o API: `SuccessSection` legge già tutto dal
`VoteContext` (`selectedCompanies` con pallet) e da `/api/public/sponsors`.

## Design approvato

### Struttura (colonna unica centrata, dall'alto)

1. **"SEI FORTE!"** — headline attuale (`success.youRock`), `text-purple`,
   uppercase, font-black, tracking tight. Sul bianco in cima al gradiente.
2. **Badge "HAI VOTATO!"** — sticker giallo (`bg-bright`), `border-2 border-ink`,
   `shadow-[3px_3px_0_#000]`, `rotate-(-2deg)`, uppercase, font-black. Testo da
   chiave `success.voted` **aggiornata** a "Hai votato!" / "You voted!".
3. **Scontrino "IL TUO VOTO"** — card bianca `border-2 border-ink` con ombra dura,
   `rotate-1deg`. Intestazione "IL TUO VOTO" (nuova chiave i18n), separatore
   tratteggiato. 3 righe: nome azienda (sinistra) + cerchietto punteggio pallet
   (destra): cerchio bianco `border-2 border-ink shadow-[2px_2px_0_#000]` con il
   numero `4|2|1` in `text-purple` font-black (stesso linguaggio dei selettori
   pallet della SearchSection). **Senza totale.** Larghezza ≤ `280px` fluidi.
4. **Testo condivisione** — "Condividi il tuo voto taggando **@fanta.cer** e
   ritira il tuo premio qui" (nuove chiavi i18n `success.shareTaglinePre` +
   `success.shareTaglinePost`, divise attorno al tag sticker),
   uppercase font-bold, con il tag `@fanta.cer` a sticker giallo
   (`bg-bright border-2 border-ink shadow rotate-1`).
5. **Bottone "Condividi"** — pill corallo (`bg-coral`) con bordo nero + ombra
   dura, icona `Share2` di lucide + testo. Azione:
   - `navigator.share` con `text` del messaggio e `url` della homepage;
   - fallback su desktop/assenza API: `navigator.clipboard.writeText` del testo
     + stato "Copiato!" temporaneo (3s).
   - Testo da chiave `success.shareButton`.
6. **Card sponsor con stand** — `<SponsorCards variant="default" standOnly />`
   (stile attuale, ombra morbida; nessuna modifica al componente). In produzione
   mostra le 2 aziende con `has_stand=true`.
7. **Icone social** — sotto gli sponsor, in riga centrata: nuovi componenti
   `InstagramIcon` / `FacebookIcon` in `src/components/ui/social-icons.tsx` con
   i **percorsi SVG ufficiali lucide** (gli stessi già usati inline oggi,
   righe 121-122 — lucide-react non esporta più le icone brand in v1.16.0),
   stilizzabili via `className`. Cerchi a sticker (`bg-coral`/`bg-purple`),
   `border-2 border-ink shadow`, **linkati ai profili** (URL in
   `src/lib/social-links.ts`).

### Confetti

Invariato: animazione confetti esistente con guardia `prefers-reduced-motion`.

### Responsive

- Colonna unica centrata: si adatta senza breakpoint dedicati.
- Titolo/testi fluidi (`clamp`, token esistenti `--fs-headline`).
- Scontrino `w-full max-w-[280px]`; su mobile si restringe, righe wrap-no (i
  nomi azienda si troncano con `truncate`).
- Sezione `grow` già attiva in `SuccessSection` (`SectionFrame grow`) → cresce
  col contenuto, nessun micro-scroll.
- Da verificare con `visual:audit:homepage` e `visual:audit:ios` (la sezione
  success NON è coperta dagli audit standard: verificare via dev preview e
  snapshot dedicati se necessario).

## Componenti

### Nuovi elementi (in `src/components/sections/success-section.tsx`)

- Rimozione di `IphoneStoryMockup` e del layout a due colonne (`lg:flex-row`)
  con la colonna destra (mockup + stelle decorative): le stelle decorative
  appartenevano alla colonna del mockup e vengono rimosse insieme.
- Sostituzione dei due SVG inline (Instagram/Facebook righe 121-122) con i
  componenti `InstagramIcon`/`FacebookIcon` da `src/components/ui/social-icons.tsx`
  (percorsi lucide ufficiali, extract da quelli inline attuali).
- Nuovo componente interno `VoteReceipt` (scontrino) e `ShareButton` (Web Share
  API + fallback clipboard).

### URL profili social

Costanti in `src/lib/social-links.ts`:
- `INSTAGRAM_URL = 'https://instagram.com/fanta.cer'` (handle confermato).
- `FACEBOOK_URL = ''` (non ancora noto): l'icona Facebook viene resa **solo se**
  l'URL non è vuoto. Con Facebook vuoto si mostra solo l'icona Instagram.

### Chiavi i18n (it/en/dictionary)

Nuove: `success.shareTaglinePre`, `success.shareTaglinePost`,
`success.shareButton`, `success.shareCopied`, `success.receiptTitle`.
Rimangono in uso: `success.youRock`, `success.voted` (testo aggiornato).
**Rimozione definitiva** (verificato: ogni chiave ha un solo uso, tutto in
`success-section.tsx`): `success.noCompany`, `success.bestStand`,
`success.playToo1`, `success.playToo2`, `success.shareSocial`,
`success.shareTagging`, `success.collectPrize` → da eliminare da
`src/i18n/it.ts`, `src/i18n/en.ts`, `src/i18n/dictionary.ts`.

## Test

- **Unit** (`tests/components/sections/success-section.test.tsx` o file nuovo):
  - rendering di `selectedCompanies` nello scontrino con pallet corretti
    (4/2/1);
  - `ShareButton`: se `navigator.share` esiste → chiamato; altrimenti
    fallback clipboard + stato "Copiato!";
  - assenza totale (nessuna riga "Totale");
  - icone social linkate ai profili (`href` attesi): Instagram sempre presente,
    Facebook assente quando `FACEBOOK_URL` è vuoto;
  - guardia `prefers-reduced-motion` per confetti (invariata).
- **Dev preview**: `?dev_success=1&dev_companies=1` (tool esistente) per
  verificare visualmente la sezione senza votare.
- **Audit**: `npm run visual:audit:homepage` + `:ios` per regressione sezioni
  adiacenti (DOM invariato: la sezione resta `main > section`).

## Rischi / note

- Web Share API non consente di pubblicare direttamente in Stories IG/FB (limite
  noto, condiviso con l'utente): il bottone apre il foglio di condivisione nativo
  (su iOS include "Instagram Stories"); le icone social sono link ai profili,
  non azioni di sharing.
- `SelectedCompany` contiene solo `{id, name}` + `pallet`: lo scontrino mostra i
  **nomi**, non i logo aziendali. Mostrare i logo richiederebbe estendere
  `VoteContext`/`SET_COMPANY` (fuori scope).
- Il tag testo usa **@fanta.cer** (handle confermato dall'utente).