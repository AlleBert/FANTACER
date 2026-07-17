---
name: FANTACER
description: Il primo gioco semiserio del distretto ceramico
colors:
  primary: "#ff8a26"
  accent-purple: "#8000ff"
  accent-yellow: "#fccb27"
  accent-blue: "#c2e1ff"
  accent-magenta: "#FF00FF"
  neutral-bg: "#FFFFFF"
  neutral-ink: "#231f20"
  neutral-muted: "#6B7280"
  neutral-dark: "#0D0C0B"
typography:
  display:
    fontFamily: "Open Sauce One, sans-serif"
    fontSize: "clamp(2.5rem, 7.5vw, 5.625rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "Open Sauce One, sans-serif"
    fontSize: "clamp(2rem, 6vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Open Sauce One, sans-serif"
    fontSize: "clamp(1rem, 2.5vw, 1.5rem)"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Open Sauce One, sans-serif"
    fontSize: "clamp(0.875rem, 2vw, 1rem)"
    fontWeight: 700
    letterSpacing: "0.02em"
rounded:
  sm: "0.75rem"
  md: "1.5rem"
  lg: "2.25rem"
  xl: "3rem"
  full: "9999px"
spacing:
  xs: "0.5rem"
  sm: "1rem"
  md: "1.5rem"
  lg: "2rem"
  xl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.accent-yellow}"
    textColor: "#000000"
    rounded: "{rounded.full}"
    padding: "1.5rem 3rem"
  button-secondary:
    backgroundColor: "{colors.accent-blue}"
    textColor: "#000000"
    rounded: "{rounded.full}"
    padding: "1.5rem 3rem"
  card-default:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  input-search:
    backgroundColor: "{colors.accent-blue}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.full}"
    padding: "1rem 2rem"
---

# Design System: FANTACER

## 1. Overview

**Creative North Star: "The Festival Floor"**

FANTACER è una giostra. Ogni schermo è uno stand della fiera che grida "guardami!". Colori saturi, bordi spessi, ombre dure — niente è timido o sfumato. L'energia è quella di Cersaie il primo giorno: folla, colori, movimento, sorpresa. Il sistema rifiuta esplicitamente qualsiasi deriva corporate: niente gradienti sobri, niente vetro, niente eleganza trattenuta. Se è arancione, è ARANCIONE. Se è viola, è VIOLA.

**Key Characteristics:**
- Audace e giocoso — il neo-brutalismo è la grammatica, non l'eccezione
- Mobile-native — ogni decisione parte dallo schermo più piccolo (99% utenti)
- Saturo e contrastato — la palette non ha colori "muti"
- Tattile e reattivo — ombre che si schiacciano al click, bordi che rispondono

## 2. Colors

La palette è volutamente satura e senza mezze misure. Ogni colore è usato in blocchi pieni, non come accento timido.

### Primary

- **Arancio Energia** (`#ff8a26`): Il colore primario. Usato per sfondi sezione, pulsanti CTA principali, accenti forti. Porta calore e urgenza.

### Secondary

- **Giallo Squillante** (`#fccb27`): Il colore dell'azione. Pulsanti "GIOCA", "FATTO!", ">>". Giallo taxi acceso che domina ogni bottone principale.

### Accent

- **Viola Coraggioso** (`#8000ff`): Il colore del gioco. Testi titolo, sfondi sezione, elementi interattivi. Porta profondità e contrasto con l'arancione.
- **Azzurro Ceramica** (`#c2e1ff`): Colore di sfondo per input search e pulsanti secondari. Riferimento diretto alla ceramica del distretto (smalti, maioliche).
- **Magenta Esplosivo** (`#FF00FF`): Accento raro. Transizioni sfumate tra sezioni (gradient bridge arancione → magenta → viola).

### Neutral

- **Bianco Fiera** (`#ffffff`): Sfondo principale. Puro, non sporcato.
- **Inky Black** (`#231f20`): Testo corpo e titoli su fondo chiaro. Quasi nero, caldo, mai grigio.
- **Dark Fair** (`#0D0C0B`): Sfondo dark mode. Nero caldo, non freddo.
- **Muted Grey** (`#6B7280`): Testi secondari, placeholder.

### Named Rules

**The Saturation Rule.** Mai ridurre la saturazione per "eleganza". Se un colore sembra troppo forte, il problema è il contesto, non il colore. Usalo su più superficie invece di attenuarlo.

**The Block Rule.** I colori vanno usati in blocchi pieni (sfondi sezione, card piene, bottoni pieni). Niente bordini sottili, niente stripe laterali, niente gradient text.

## 3. Typography

**Display & Body Font:** Open Sauce One (sans-serif)

**Character:** Unico family per tutto — display, corpo, label. La varietà viene dal peso (900 per titoli, 500 per corpo, 700 per label) e dalla scala, non dal cambio font. Questo dà coerenza anche quando le sezioni alternano sfondi arancione, viola e bianco. Il carattere è geometrico con un tocco di calore umanista: moderno ma non freddo.

### Hierarchy

- **Display** (900, `clamp(2.5rem, 7.5vw, 5.625rem)`, 1.1): Titoli hero e sezioni principali. Sempre lowercase, tracking stretto (-0.05em). Max ~90px.
- **Headline** (900, `clamp(2rem, 6vw, 4.5rem)`, 1.1): Sotto-titoli di sezione. Lowercase, tracking -0.03em.
- **Body** (500, `clamp(1rem, 2.5vw, 1.5rem)`, 1.4): Testo descrittivo. Lunghezza riga max 70ch.
- **Label** (700, `clamp(0.875rem, 2vw, 1rem)`, tracking 0.02em): Testi piccoli, timer, badge. Mai tutto maiuscolo tranne bottoni CTA.

### Named Rules

**The Weight-Not-Font Rule.** Non esiste secondo font. La gerarchia si costruisce con peso e scala all'interno di Open Sauce One. Se serve più contrasto, aumenta il peso, non cambiare famiglia.

**The Lowercase Rule.** Titoli sempre lowercase (salvo CTA e badge). Il lowercase è più informale, più veloce da leggere, più "gioco".

## 4. Elevation

Ombre dure alla neo-brutalista. Zero ambienza. Le ombre sono strutturali: dicono "questo elemento è sopra quello" senza sfumature. Pensate come un timbro, non come un'illuminazione.

### Shadow Vocabulary

- **Neo Default** (`4px 4px 0 #000`): Ombra standard per card, bottoni, input. Dà volume netto.
- **Neo Large** (`6px 6px 0 #000`): Ombra maggiore per elementi hero (bottone GIOCA), elementi che devono emergere.
- **Neo Pressed** (`2px 2px 0 #000` translateX(2px) translateY(2px))): Stato hover/active che schiaccia l'ombra, simulando pressione.

### Named Rules

**The Hard Shadow Rule.** Mai usare `blur`, `spread`, o `rgba(0,0,0,X)` per soft shadow. Le ombre sono esagonali nette con `#000` solido. Zero trasparenza.

## 5. Components

Tutti i componenti condividono la stessa grammatica: bordo nero marcato, ombra neo-brutalista, angoli arrotondati, padding generoso. Il risultato è tattile, giocoso, immediato.

### Buttons

- **Shape:** Pill (rounded-full, 9999px), border 2-4px solid black.
- **Primary (GIALLO):** Sfondo `#fccb27`, testo nero 900. Ombra `4px 4px 0 #000`. Hover: `6px 6px 0 #000`, translateY(-1px). Active: scala 95% con ombra ridotta.
- **Secondary (BLU):** Sfondo `#c2e1ff`, testo nero. Stessa ombra e comportamento hover. Usato per "View All", azioni secondarie.
- **CTA Hero (ARANCIONE):** Sfondo `#fccb27`, testo nero, dimensione extra-large. Ombra `6px 6px 0 #000`. Riservato al bottone GIOCA in hero e sezioni richiamo.
- **Disabled:** Opacità 50%, hover non attivo, cursore not-allowed.

### Inputs / Search

- **Style:** Pill (rounded-full), sfondo `#c2e1ff`, border 3-4px solid `#231f20`. Ombra `6px 6px 0 #000`.
- **Focus:** Sfondo bianco, ombra `8px 8px 0 #000`, translateY(-1px). Placeholder in black/40.
- **Valori:** Font 900, lowercase. Icona search integrata a destra.

### Cards

- **Corner Style:** rounded-2xl/3xl (1.5rem–2.25rem). Angoli pronunciati.
- **Background:** Bianco puro (`#ffffff`). Mai sfumato o trasparente.
- **Shadow Strategy:** Neo Default (`4px 4px 0 #000`).
- **Border:** 3px solid `#231f20`.
- **Internal Padding:** 1rem–1.5rem scale.
- **Nested cards:** Proibite. Una card non contiene mai un'altra card.

### Header / Navigation

- **Style:** Sticky top, backdrop-blur-xl, border-bottom 1px black/5. Sfondo `background/70` con blur.
- **Logo area:** Trophy icona + "FANTACER" label. Font 700, tracking-tight.
- **Timer badge:** Pill arrotondato, sfondo `#FDE68A`, testo muted, icona clock.
- **Search bar:** Sotto il logo, larghezza piena su mobile. Pill, sfondo `secondary/80`, icona search.

### Slider (Innovation Section)

- **Track:** 6px solid black, rounded-full.
- **Thumb:** Stella (`lucide Star`) gialla (`#fccb27`) con stroke nero 2px e drop-shadow `2px 2px 0 #000`.
- **Range input:** Opacity 0, copre tutta l'area per la interazione touch. `touch-action: pan-x`.

### Ranking Options

- **Stile:** Pill, border 2px black, padding 1rem 2rem. Selected: sfondo `#fccb27`. Unselected: sfondo bianco.
- **Hover:** Sfondo `#c2e1ff`.

## 6. Do's and Don'ts

### Do:

- **Do** usare colori pieni e saturi per gli sfondi sezione. Ogni sezione ha un colore dominante diverso (bianco, arancione, viola, gradient).
- **Do** mantenere bordi spessi (2-4px) e ombre dure (`4px 4px 0 #000`) come firma visiva.
- **Do** usare il giallo `#fccb27` per ogni pulsante di azione primaria.
- **Do** usare `lowercase` per tutti i titoli, con tracking stretto.
- **Do** testare ogni componente a 375px viewport (iPhone SE) prima del desktop.

### Don't:

- **Don't** usare gradient text (`background-clip: text`). Mai. I titoli sono colore pieno.
- **Don't** usare ombre morbide, blur, o rgba per elevazione. Ombre dure `#000` solido o niente.
- **Don't** usare stripe laterali (border-left/right come accento). Preferire sfondi pieni.
- **Don't** annidare card. Una card contiene solo contenuto, mai altre card.
- **Don't** usare il font in pesi medi (400) per titoli. I titoli sono sempre 900.
- **Don't** usare grigio chiaro per testo corpo. Il testo è `#231f20` su fondo chiaro.
- **Don't** scrivere testi corpo in maiuscolo. Riservato a bottoni CTA e badge (≤4 parole).
- **Don't** creare sezioni con eyebrow "ABOUT" / "PROCESS" / "PRICING" in tracking largo sopra ogni titolo. Il gioco ha il suo ritmo — non serve scaffolding da landing page SaaS.
