# Admin Dashboard Redesign

## Problem Statement

L'admin dashboard è poco funzionale su mobile: navigazione macchinosa (tab in alto overflowano), visualizzazione ammassata (tabelle a 9 colonne su schermo 375px), stats grid troppo compressa. Desktop è sostanzialmente ok.

## Approach

**Approccio 1: Bottom Nav + Schede semplificate**. Scelto perché:
- Bottom navigation mobile è thumb-friendly, standard de facto per admin mobile (Stripe, Google Analytics, Shopify)
- Desktop resta invariato — nessuna regressione
- Ogni tab diventa una schermata focalizzata, niente overflow

## Struttura Navigazione

### Mobile (< 1024px)
- Bottom nav bar fissa in basso con 5 voci: `Panoramica` | `Aziende` | `Voti` | `Import` | `Impostazioni`
- Ogni voce: icona (lucide-react) + label breve (1 parola)
- Sidebar hamburger scompare su mobile — sostituita dal bottom nav
- Header ridotto: solo nome sezione + bottone "Aggiorna"

### Desktop (≥ 1024px)
- Sidebar invariata (come ora)
- Tab navigation interna alle card per sotto-viste

## Panoramica (mobile)

Layout verticale, scroll singolo:
1. **Batch selector** — dropdown compatto in alto
2. **Stats cards** — row scrollabile orizzontalmente (`overflow-x-auto`, `snap-x snap-mandatory`). Ogni card snap. 4 card: Voti Totali, Elettori Unici, Voti Oggi, Attivi Ora
3. **Grafico** — altezza ridotta a 200px (da 300px), responsive
4. **Export buttons** — full-width, impilati (CSV, Excel, Import Aziende)

Desktop: invariato (griglia 4 colonne + grafico largo + sidebar).

## Tabelle (mobile)

Trasformate da `<table>` a **card list** con paginazione:

### Tab Aziende
Ogni card mostra: rank, nome, categoria, voti, trend (▲/▼). 10 card per pagina.
Tap sulla card: no azione extra (solo classifica).

### Tab Voti
Card compatte: azienda, timestamp, commento, aggettivo.
Info secondarie (fingerprint, slider, device, paese) accessibili aprendo un detail sheet al tap sulla card — da implementare come expand/collapse inline o modal leggero.

### Tab Sicurezza (Audit Log)
Card con icona security per eventi critici. Stessa logica.

### Desktop
Tabelle full-width come ora. Nessun cambiamento.

## Pagine Aggiuntive

### Import
- `/admin/import` esiste già come pagina separata — nel bottom nav diventa un reindirizzamento o un wrapper
- In futuro si può unificare sotto il layout dashboard, per ora resta separata ma accessibile dal nav

### Impostazioni
- Diventa una pagina nel bottom nav (prima era in un tab interno)
- Contiene: Coming Soon toggle (già responsive) + sezione **Sicurezza / Audit Log** espandibile
- Audit Log collassato di default, si apre al tap per vedere gli eventi di sicurezza
- In futuro altre impostazioni seguiranno pattern lista compatta

## File da modificare / creare

### Nuovi file
- `src/app/admin/dashboard/layout.tsx` — layout con bottom nav (mobile) + sidebar (desktop)
- `src/app/admin/dashboard/panoramica/page.tsx` — sezione Panoramica
- `src/app/admin/dashboard/aziende/page.tsx` — sezione Aziende (card list)
- `src/app/admin/dashboard/voti/page.tsx` — sezione Voti (card list)
- `src/app/admin/dashboard/impostazioni/page.tsx` — sezione Impostazioni (da tab a pagina)
- `src/components/admin/bottom-nav.tsx` — componente BottomNav
- `src/components/admin/company-card-list.tsx` — card list per aziende
- `src/components/admin/vote-card-list.tsx` — card list per voti (con detail sheet)
- `src/components/admin/audit-card-list.tsx` — card list per audit log

### File da modificare
- `src/app/admin/dashboard/page.tsx` — diventa la Panoramica route (o redirect), va snellita
- `src/app/admin/layout.tsx` — rimuovere sidebar se gestita dal layout dashboard
- `src/app/admin/import/page.tsx` — già ok, verificare layout mobile
- `src/app/admin/login/page.tsx` — invariato

### File da rimuovere/aggiornare riferimenti (fase finale)
- `src/components/admin/sidebar.tsx` — le voci Import e Impostazioni sono nel bottom nav mobile, sidebar desktop rimane
- Tab internal navigation in dashboard/page.tsx — sostituita dalle route
- Security tab rimosso — Audit Log diventa sezione dentro Impostazioni

## Non incluso in questa fase
- Detail sheet per i voti (tap sulla card mostra dettagli extra) — posticipato, prima card list basic
- Filtri avanzati sulle tabelle — restano i campi search esistenti
- Notifiche push / realtime updates — esistenti già funzionano
