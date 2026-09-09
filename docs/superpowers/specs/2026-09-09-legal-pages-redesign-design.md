# Legal pages redesign — "Brand tenue" minimal

Data: 2026-09-09 · Stato: approvato (brainstorming)

## Goal

Rifare completamente le 3 pagine legali (`/cookie-policy`, `/privacy-policy`,
`/terms-and-conditions`): codice riscritto da zero dove serve, contenuti
giuridici **invariati** ma impaginati/formattati correttamente. Design minimal,
semplice, leggibile e fruibile su ogni viewport. Pochi fronzoli.

## Contesto e problemi attuali

Il codice attuale (component `legal-page-layout.tsx` + 3 `page.tsx`) è il
risultato dell'ultimo redesign "Clean Document": header sticky, pill, TOC
scrollspy con accordion mobile, riquadri riassuntivi con emoji, chip uppercase,
bordi/ombre, tabelle a card colorate. Risultato percepito come troppo
decorativo e con problemi strutturali:

1. **Contenuti rotti/vuoti**: diverse chiavi `terms.*` sono stringhe vuote
   (`serviceDescription`, `prizeCollection`, `prizeDetails`, `fairDates`,
   `gadget`, `noCashAlternative`, `unclaimedForfeited`) e il codice ci fa
   sopra `.replace()`/`.substring()` che producono paragrafi vuoti o label
   troncate con "…". `terms.voteValidity` (voti validi anche da casa) non è
   renderizzato da nessuna parte.
2. **Hack di riuso**: una stessa stringa (es. `privacyPolicy.dataContact`
   "Modulo contatti: …") usata sia come sottotitolo `h3` sia come descrizione
   con rimozione del prefisso via `.replace()`.
3. **Testi IT-only hardcoded** nelle pagine anche quando la pagina è EN
   (intro "Destinatari"/"Sub-responsabili", intestazioni tabella
   conservazione, bullet "Regole di votazione", nota finale "Come gestire i
   cookie", ecc.).
4. **Emoji e duplicazioni** nei riquadri riassuntivi ("In breve", "3 Regole
   d'Oro") che ripetono le clausole complete.
5. **Colonna di lettura stretta** (`--measure-wide: min(100%, 65ch)`) che,
   accanto all'indice, lascia molto vuoto.
6. Tipografia "shouty" sui titoli sezione (`h2` clamp fino a 2rem, lowercase
   trasform, separatori `border-top`).

## Decisioni emerse dal brainstorming

| Tema | Scelta |
|---|---|
| Fonte contenuti per sezioni rotte/vuote | **Ripristinare le clausole complete già scritte in git** (commit `e647dd3~1` = pre-redesign) per it+en. Niente testo inventato. |
| Parità EN | **Tradurre** ogni testo mancante; zero pagine miste IT/EN. |
| Direzione visiva | **C — Brand tenue**: velatura lilla tenue→off-white, articolo bianco, accento viola sobrio, indice "IN QUESTA PAGINA" testuale sticky su desktop. |
| Riquadri riassuntivi | **Intro sobria sotto il titolo**, senza emoji/box/colori; i duplicati vengono rimossi (le frasi uniche restano). |
| Larghezza colonna | **~75ch** → aggiornare token `--measure-wide` (usato solo dal legale). |
| Mobile | Niente accordion TOC: l'indice è solo desktop, su mobile la pagina scorre dritta. |
| Elementi rimossi | Emoji, pill/card colorate, summary-band, chip "FANTACER · INFO LEGALI" pill, pill "torna al gioco", accordion, ombre/bordi decorativi. |

## Design visivo

### Sfondo e superficie
- `.legal-surface` invariato: `linear-gradient(180deg, #f0eaff 0%, #faf9f6 40%, #faf9f6 100%)`.
- Articolo bianco **full-bleed** sulla superficie (nessuna card galleggiante).
- Layout dentro `.content-max` (1200px) con padding laterali/safe-area come oggi.

### Header sticky minimale
- Barra sticky (`top-0`) con `pt-(--safe-top)`, hairline inferiore, leggero
  backdrop-blur. A sinistra wordmark `fantacer★` (stella `--orange`). A
  destra **link testuale** "← torna al gioco" (`legal.backToGame`) → `/`.
  Niente pill.
- Skip link ("Salta al contenuto") mantenuto, ancorato a `#legal-content`.

### Titolo
- Overline piccola maiuscola "FANTACER · INFO LEGALI" (testuale, non pill).
- `h1` (`id="legal-page-title"`, `aria-labelledby` su article) a scala
  moderata, alto peso, tracking stretto; non più gigante.
- Riga meta "Ultimo aggiornamento: {date}".
- Eventuale **paragrafo introduttivo** sobrio sotto il titolo quando esiste
  testo naturale (vedi Contenuti).

### Indice (desktop ≥1024px)
- `aside` sticky a sinistra, larghezza fissa ~200px.
- Label "IN QUESTA PAGINA" (testuale). Link testuali, colore neutro; voce
  attiva = testo ink + barra viola sinistra (`--purple`).
- Scrollspy: `IntersectionObserver` esistente, semplificato e adattato al
  nuovo layout (rootMargin opportuno, active per blocco corrente).
- `scroll-margin-top` sulle ancore di sezione per compensare header sticky.
- Su <1024px l'aside non esiste (niente accordion).

### Tipografia (stile documentale calmato)
- Colonne di lettura: `--measure-wide` passa a `min(100%, 75ch)` in
  `globals.css` (SSOT; verifica unicità d'uso).
- Body: ~1rem, `line-height` comoda, `text-wrap: pretty`.
- `h2` sezione: sentence case, peso alto (~800), scala ridotta
  (≈ `clamp(1.15rem, 2vw, 1.5rem)`), niente `border-top` separatore pesante,
  spaziatura verticale via rythm token, `scroll-margin-top` per gli anchor.
- `h3` sottosezione: più piccolo (≈1rem, peso alto) mantenendo gerarchia.
- Link: viola + underline (come oggi), hover → ink.
- Evidenziazioni `strong` su statement legali (peso 800, non colore).

### Tabelle responsive
- Cookie (essenziali/analytics) e conservazione (privacy): `<table>`
  semantiche, intestazioni, righe a hairline, senza colori/bordi spessi.
- Su mobile: righe a stacked "label/value" tramite `data-label`
  (pattern esistente `table-card-mobile`), restyling piatto senza card
  colorate. Il wrapper scroll-orizzontale non è più necessario se lo stack
  mobile copre anche i casi stretti: mantiene `<table-scroll>` solo come
  fallback se un table ha colonne larghe in viewport intermedie.

## Contenuti e i18n

### Principi
- I testi non si riscrivono: si ripristinano/migrano/reinquadrano le frasi
  già esistenti. Uniche aggiunte: traduzioni EN mancanti (parità).
- Ogni sezione ha chiavi pulite: niente prefissi incollati dentro la stringa
  (es. "Modulo contatti: …") né `.replace()`/`.substring()` per estrarle.
- Le emoji vengono rimosse dalle stringhe di presentazione.

### Ripristino clausole (it+en) da `e647dd3~1`
- `terms.serviceDescription` → testo descrizione gioco (già usato come
  riferimento nel codice odierno, oggi vuoto).
- `terms.eligibilityDesc` → versione completa (professionisti ceramica/
  edilizia/design, visitatore professionale).
- `terms.prizeCollection`, `terms.prizeDetails`, `terms.fairDates`,
  `terms.gadget`, `terms.noCashAlternative`, `terms.unclaimedForfeited` →
  testi pieni.
- `terms.voteValidity` → testo già presente nei dizionari, da **renderizzare**
  (come nota/paragrafo in "Regole di votazione").

### Migrazione testi hardcoded → dizionari (it+en)
- Terms: bullet "Turnstile", "schermata di conferma", "script/bot vietati",
  "compravendita voti vietata".
- Privacy: intro sezione "Destinatari"; intro sezione "Sub-responsabili"
  (DPA Art. 28); intestazioni tabella conservazione ("Categoria", "Periodo di
  conservazione"); eventuali note "Il dettaglio della base giuridica…".
- Cookie: paragrafo finale "Puoi anche riaprire il banner…" (oggi IT-only).

### Riassunti → intro
- Cookie: lead dal testo unico (`cookiePolicy.summaryText`). Il summary
  completo è già `cookiePolicy.intro` (oggi inutilizzato): usare intro come
  paragrafo introduttivo.
- Terms: lead dalla descrizione del gioco (`terms.serviceDescription`
  ripristinata); "3 Regole d'Oro" rimosse (duplicano regole votazione/premio).
- Privacy: le 4 card riassuntive duplicano Controller/trasferimenti/contatti;
  unica frase non altrimenti presente = "Solo dati essenziali per il gioco"
  → confluisce in un breve lead (composizione di frasi esistenti, nessuna
  nuova scrittura).
- Chiavi `*summary*`/`goldenRules*`/`badge*`/`essentialSectionTitle`/
  `analyticsSectionTitle` non più usate dalle pagine: **rimosse** da
  dizionario e dictionary type (verificare assenza altri riferimenti).

## Architettura del codice (da zero)

- `src/lib/legal.ts` (o estensione `src/i18n`): helper `getLegalDict()`
  riusa `resolveLocale` + cookies/headers (oggi duplicato in 3 page) e
  funzione `tl(key, params)` per i dizionari. Le 3 `page.tsx` diventano
  server component snelle.
- Tipo condiviso blocco sezione:

  ```ts
  type LegalBlock =
    | { kind: 'p'; textKey: DictionaryKey }
    | { kind: 'h3'; textKey: DictionaryKey }
    | { kind: 'ul'; itemsKey: DictionaryKey[] }
    | { kind: 'note'; textKey: DictionaryKey }   // testo piccolo secondario
  type LegalSection = { id: string; headingKey: DictionaryKey; lead?: DictionaryKey; blocks?: LegalBlock[] }
  ```

  Le sezioni con strutture speciali (tabelle cookie, tabella conservazione,
  liste provider con link) vengono modellate con varianti esplicite (`table`
  con righe da dati pagina o tipizzate) restando nello stesso file pagina.
- `LegalDocumentLayout` (rinnovato) riceve: `title`, `meta date`, `intro`,
  `sections` (per TOC + render), renderizza header + aside/scrollspy +
  articolo + `SiteFooter`. Il TOC (id+label) è **derivato** dalle stesse
  sezioni → niente label duplicate/troncate.
- Niente più `use client` superfluo: il layout resta client solo per lo
  scrollspy (piccolo componente dedicato `LegalToc` con IntersectionObserver),
  il resto server. Valutare SSR-friendly senza costi.
- Gestione `formattedDate` dal locale corrente (com'è oggi).

## Modifiche CSS (`src/app/globals.css`)

- `--measure-wide: min(100%, 75ch)` (sezione design tokens).
- Restyling del blocco "Legal pages prose": ridurre scala `h1`/`h2`, togliere
  trasformazioni url-shouting e separatori pesanti; mantenere `scroll-margin`.
- Rimuovere/ridurre classi decorative non più usate (`summary-band`,
  `toc-pill`, pill header) e i relativi stili mobile accordion; tenere pattern
  table mobile (stacking) ma semplice.
- Verificare `@media print` e aggiornare selettori se cambia DOM.

## Accessibilità e comportamento

- Gerarchia heading corretta (1× `h1`, sezioni `h2`, sottosezioni `h3`).
- `aria-labelledby`, skip link, focus visibile, `prefers-reduced-motion`.
- Link esterni `target="_blank" rel="noopener noreferrer"`.
- Nessun overflow orizzontale documento; tabelle gestite; testo non troncato
  a ogni viewport (P0 responsiveness).

## Test

- `tests/components/legal/legal-page-layout.test.tsx`: riscrivere per il nuovo
  DOM (header/indice/articolo/footer, scrollspy se presente, niente `details`).
- `tests/e2e/legal-pages.spec.ts`: adattare — niente accordion mobile
  (il test `details` mobile diventa assenza del controllo o verifica flow);
  verifica sticky aside desktop; conteggi link footer invariati; superficie
  bianca `#legal-content`; zero overflow; h1 per pagina. Aggiungere un check
  leggero di assenza emoji/`summary-band`? (solo se stabile).
- Verifiche manuali/visive: 3 pagine × viewport (mobile→desktop), contrasto,
  focus ring, stampa.

## Fuori scope

- Nessuna modifica al contenuto testuale (salvo ripristini/traduzioni sopra).
- Nessun cambio a SEO/metadata oltre all'ovvia coerenza del layout.
- Homepage e altre pagine non legali non toccate (salvo token/classi condivise
  verificati).
