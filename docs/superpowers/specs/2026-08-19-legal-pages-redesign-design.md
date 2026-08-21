# Legal Pages Redesign — Design Spec

**Data**: 19 agosto 2026  
**Status**: Approvato per implementazione

## Obiettivo

Rifattorizzare il componente `LegalPage` e le 3 pagine legali (Cookie Policy, Privacy Policy, Termini e Condizioni) per creare un'esperienza moderna, trasparente, conforme a WCAG 2.1 AA e GDPR-friendly, mantenendo la coerenza con il brand "semiserio".

## Decisioni di Design

### Approccio Tono di Voce: "A Strati" (Layered)

**Scelta**: Separazione netta tra friendly e formal.

- **Box "In breve"** in cima a ogni pagina con tono amichevole, prima persona plurale ("Noi di Fantacer...")
- **Dettagli formali** in sezioni `<details>` collassabili, tono tecnico/GDPR-compliant
- **Razionale**: Massima chiarezza per l'utente medio, completezza legale per chi cerca dettagli

### Layout Pagine Legali

**Struttura comune**:
1. Header con gradiente brand + badge "FANTACER · Info legali"
2. Box "In breve" colorato (giallo Cookie / blu Privacy / verde Terms)
3. Sommario visuale con icone/emoji (Privacy: griglia 2x2, Terms: 3 step numerati)
4. Contenuto principale con tabelle/liste
5. Sezione `<details>` per dettagli formali collassabili
6. Sidebar sticky con indice capitoli (desktop) / accordion mobile (già presente in `LegalPage`)

**Responsive**:
- Desktop: sidebar sticky 220px a sinistra, contenuto centrato
- Mobile: accordion collapsibile per indice, contenuto full-width
- Box "In breve" e sommari: sempre full-width, padding adattivo

### Footer delle Pagine Legali

**Scelta**: Layout 2 colonne asimmetrico (Opzione B dal wireframe)

**Desktop**:
- Colonna sinistra (2fr): Brand "FANTACER" + tagline + email
- Colonna destra (3fr): Link legali (Cookie/Privacy/Terms) + CTA "Gestisci preferenze cookie" prominente
- Bottom bar: © 2026 Andrea Borghi, P.IVA + date evento

**Mobile**: Stack verticale, CTA cookie ben visibile

**Nota**: Il footer della homepage NON viene modificato. Questo footer è specifico delle pagine legali.

### Particolarità per Pagina

#### Cookie Policy
- **Box "In breve"**: "Usiamo solo cookie essenziali per far funzionare il gioco. Niente tracciamenti invasivi."
- **Tabella unificata**: Una sola tabella con tutti i cookie (essenziali + analytics), colonne: Nome, Finalità, Durata, Fornitore
- **Dettagli**: Cosa sono i cookie, categorie, come gestire

#### Privacy Policy
- **Box "In breve"**: Griglia 2x2 con icone:
  - 🏢 Chi siamo (Andrea Borghi, P.IVA)
  - 📊 Cosa raccogliamo (solo dati essenziali)
  - 🔒 Come li proteggiamo (server UE Supabase Francoforte)
  - 📧 Contattaci (team@fantacer.com)
- **Sommario visuale**: 3 card per categorie dati (Modulo contatti, Votazione, Analytics)
- **Dettagli**: Titolare, DPO, basi giuridiche, diritti Art. 15-22 GDPR, sub-responsabili

#### Termini e Condizioni
- **Box "In breve"**: "Fantacer è un gioco gratuito a Cersaie 2026. Vota e ritira un gadget mostrando la conferma!"
- **3 Regole d'Oro**: Step numerati circolari arancioni:
  1. Un voto al giorno per dispositivo (reset a mezzanotte CEST)
  2. Scegli esattamente 3 aziende distinte
  3. Supera la verifica Turnstile e mostra la schermata di conferma per ritirare il gadget
- **Dettagli legali**: Proprietà intellettuale, esclusione garanzie, limitazione danni indiretti (NO max 100€), risoluzione, legge italiana, Foro Reggio Emilia

## Componenti da Implementare

### 1. `LegalPageLayout` (riutilizzabile)

**File**: `src/components/legal/legal-page-layout.tsx`

**Props**:
- `title`: string
- `lastUpdated`: string
- `toc`: Array<{ id: string; label: string }>
- `summaryBox`: ReactNode (contenuto del box "In breve")
- `summaryColor`: 'yellow' | 'blue' | 'green'
- `children`: ReactNode

**Struttura**:
- `<SectionFrame theme="legal" grow>` (già esistente)
- Background fisso gradiente
- Container responsive con sidebar/accordion TOC
- Header con badge + titolo + data
- Box "In breve" colorato
- `{children}` per contenuto principale

### 2. `LegalFooter`

**File**: `src/components/legal/legal-footer.tsx`

**Struttura**:
- Background gradiente (stesso delle pagine legali)
- Layout 2 colonne desktop / stack mobile
- Colonna sinistra: brand + tagline + email
- Colonna destra: link legali + CTA "Gestisci preferenze cookie"
- Bottom bar: copyright + P.IVA + date evento
- CTA cookie dispatcha evento `OPEN_COOKIE_PREFERENCES_EVENT`

### 3. Refactor Pagine Legali

**File**: `src/app/cookie-policy/page.tsx`, `privacy-policy/page.tsx`, `terms-and-conditions/page.tsx`

**Modifiche**:
- Usare `LegalPageLayout` invece di `LegalPage`
- Passare `summaryBox` con contenuto specifico per pagina
- Rimuovere duplicazioni (es. doppia tabella cookie)
- Aggiornare copy con tono "semiserio" nei box "In breve"
- Mantenere dettagli formali in `<details>` collassabili

### 4. Aggiornamento i18n

**File**: `src/i18n/it.ts`, `src/i18n/en.ts`

**Nuove chiavi**:
- `cookiePolicy.summary*` (box "In breve")
- `privacyPolicy.summary*` (griglia 2x2)
- `terms.summary*` + `terms.goldenRules.*` (3 regole)
- `legalFooter.*` (brand, tagline, link, CTA)

## Best Practice Applicate

### Accessibilità (WCAG 2.1 AA)
- Contrasti colori verificati (giallo/blu/verde su bianco)
- Stati focus visibili su tutti gli elementi interattivi
- Tag semantici: `<article>`, `<nav>`, `<aside>`, `<details>`
- `aria-labelledby` su sezioni
- `role="list"` su liste TOC

### Responsive Design
- Mobile-first: stack verticale di default
- Desktop: sidebar sticky + layout a colonne
- Breakpoint: `lg:` (1024px) per sidebar, `sm:` per padding
- Box "In breve" e sommari: sempre leggibili, padding adattivo
- Zero overflow orizzontale

### Performance
- `<details>` nativo (no JavaScript per collapsibili)
- Sidebar sticky con `position: sticky` (no JS)
- Nessun nuovo dependency

### SEO
- Metadata già presente (`generateMetadata`)
- Struttura heading gerarchica (h1 > h2 > h3)
- Contenuto testuale completo (no testo in immagini)

## Note Implementative

### Cosa NON Cambia
- Footer homepage (`src/app/page.tsx`) — resta invariato
- `SectionFrame` — componente esistente, riutilizzato
- `sectionThemes.legal` — gradiente esistente
- `CookieConsentUI` — modal esistente, invariato
- `OPEN_COOKIE_PREFERENCES_EVENT` — evento esistente

### Dipendenze
- Nessuna nuova dipendenza
- Tailwind CSS (già presente)
- `lucide-react` per icone (già presente)
- `react-cookie-manager` (già presente)

## Copywriting di Esempio

### Introduzione Termini e Condizioni (Box "In breve")

> **🎮 In breve — Come funziona il gioco**
>
> Fantacer è un gioco gratuito riservato ai visitatori di Cersaie 2026 (Bologna Fiere, 21-25 settembre). Vota il tuo stand preferito e ritira un gadget mostrando la conferma di voto!

### Riassunto Privacy Policy (Box "In breve")

> **🛡️ In breve — La tua privacy è al sicuro**
>
> - **🏢 Chi siamo**: Andrea Borghi, P.IVA 02108240355
> - **📊 Cosa raccogliamo**: Solo dati essenziali per il gioco
> - **🔒 Come li proteggiamo**: Server UE (Supabase Francoforte)
> - **📧 Contattaci**: team@fantacer.com

## Verifiche

### Responsive
- [ ] `npm run visual:audit:homepage` — verifica che homepage non sia affected
- [ ] Test manuale su 3 viewport mobile (375px, 390px, 414px)
- [ ] Test manuale su 2 viewport desktop (1280px, 1440px)
- [ ] Verifica zero overflow orizzontale
- [ ] Verifica sidebar sticky su desktop
- [ ] Verifica accordion TOC su mobile

### Accessibilità
- [ ] Contrasti colori box "In breve" (giallo/blu/verde su bianco) ≥ 4.5:1
- [ ] Focus visibili su CTA cookie, link, `<details>`
- [ ] Navigazione tastiera: Tab attraverso tutti gli elementi interattivi
- [ ] Screen reader: `<details>` announce corretto

### Funzionalità
- [ ] CTA "Gestisci preferenze cookie" apre modal cookie
- [ ] Link Cookie/Privacy/Terms funzionano
- [ ] `<details>` espandono/collassano correttamente
- [ ] Sidebar sticky resta visibile durante scroll

## Scope Escluso

- Modifiche al footer homepage
- Modifiche al modal `CookieConsentUI`
- Modifiche a `SectionFrame` o `sectionThemes`
- Traduzioni EN (solo IT in questo sprint)
- Modifiche al contenuto legale formale (solo copywriting box "In breve")
