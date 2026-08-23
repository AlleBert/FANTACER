# Success Section — Action Bar Consolidation

## Summary

Consolidare la action bar nella `SuccessSection`: eliminare le icone social
dalla posizione attuale (sotto sponsor) e unirle in una singola riga accanto
al bottone "Condividi il tuo voto". Aggiungere un bottone "Salva" che
cattura la schermata di successo come PNG tramite `html2canvas`.

## Motivazione

- Ridurre la frammentazione visiva: attualmente share button e social icons
  sono separati in zone diverse della pagina
- Unificare tutte le azioni di condivisione/salvataggio in un unico locus
- Aggiungere la funzionalità "salva screenshot" che manca

## Layout

### Desktop (≥ 60rem / 960px container query)

```
[ Condividi il tuo voto ]  [IG] [FB] [💾]
```

- Share button a sinistra (testo + icona Share2)
- Gruppo icone a destra: Instagram, Facebook (condizionale), Salva
- `justify-content: space-between` nel container flex
- Gap: `--space-md`

### Mobile (< 60rem)

```
   [ Condividi il tuo voto ]
      [IG] [FB] [💾]
```

- Share button full-width centrato
- Gruppo icone centrato sotto
- `flex-col items-center`

## Componenti coinvolti

### ShareButton (`src/components/sections/share-button.tsx`)

- Nessuna modifica funzionale: mantiene `navigator.share` + fallback clipboard
- Rimane il design attuale (pill bright, border-ink, shadow)

### SocialLinksRow → refactoring

- **Eliminare** `SocialLinksRow` come componente separato
- Le icone social vengono incorporate direttamente nella action bar
- Stesse dimensioni attuali: 44×44px, border-2, shadow-[2px_2px_0_#000]
- Instagram: `bg-coral text-white` (stesso attuale)
- Facebook: `bg-purple text-white` (stesso attuale), **mostrato solo se** `FACEBOOK_URL` non è vuoto

### SaveButton — nuovo componente

- Icona `Download` da `lucide-react`
- Stesse dimensioni/stile delle icone social (44×44px circolare)
- `bg-bright text-ink border-2 border-ink shadow-[2px_2px_0_#000]`
- Funzionalità:
  1. Importa `html2canvas` (da `html2canvas` npm package)
  2. Cattura il contenuto della `SuccessSection` (ref sul container)
  3. Converte in PNG e scarica via `document.createElement('a')`
  4. Stato "Salvato!" temporaneo (3s) con icona `Check`
  5. Guardia `prefers-reduced-motion` per l'animazione di stato

### SuccessSection (`src/components/sections/success-section.tsx`)

- Rimuovere il blocco social links separato (sia desktop che mobile)
- Creare un nuovo blocco action bar che contiene: ShareButton + icone + SaveButton
- La action bar appare **una sola volta** (non duplicata desktop/mobile)
- Posizionamento: dopo il tagline, prima degli sponsor

### Rimozioni

- `SocialLinksRow` non viene più importato/uso in success-section
- Il blocco "Seguici" (testo + SocialLinksRow) viene rimosso completamente
- Le icone social ora fanno parte della action bar, non più separate

## Dependency

- **`html2canvas`**: nuovo package npm da installare
  - `npm install html2canvas`
  - `npm install -D @types/html2canvas` (se disponibile, altrimenti type manuali)

## Chiavi i18n

- Nessuna nuova chiave necessaria
- `success.shareCta` esistente ("Condividi il tuo voto") — invariato
- `success.shareCopied` esistente ("Copiato!") — invariato
- Nuova chiave per stato "Salvato!": `success.saveCta` / `success.saveDone`
  (da aggiungere a dictionary/it/en)

## Test

### Unit

- **ShareButton**: invariato (test esistente)
- **SaveButton**: mocking `html2canvas`, verificare che:
  - `html2canvas` viene chiamato con il container ref
  - Il PNG viene scaricato (mock `createElement('a').click`)
  - Stato "Salvato!" appare dopo il click
  - Guardia reduced-motion rispettata
- **Social links**: verificare che:
  - Instagram sempre presente con href corretto
  - Facebook assente quando `FACEBOOK_URL` è vuoto
  - Nessun link vuoto/nullo
- **Layout**: verificare che la action bar è un singolo blocco (no duplicazione)

### Visual

- Dev preview: `?dev_success=1&dev_companies=1`
- Verificare layout desktop e mobile
- Verificare che le icone social non appaiono più nella posizione vecchia

## Note

- `FACEBOOK_URL` attualmente è stringa vuota → Facebook non mostrato in dev/prod
- html2canvas non cattura elementi cross-origin (immagini esterne): ok因为我们 non abbiamo immagini esterne nella success section
- Il download PNG include solo il contenuto della success section, non tutta la pagina
