# Homepage Responsive Visual Audit Spec

## 1. Goal

Produire una matrice di responsiveness completa della homepage su 6 viewport, con analisi per sezione e sub-elementi, per identificare overflow, touch target illegali, font non responsivi, immagini deformate e layout broken.

## 2. Routes

Singola rotta: `/` (homepage).

Niente admin, niente coming-soon, niente login.

## 3. Viewport (6)

| Name | Width | Height | Target Device |
|---|---|---|---|
| `mobile-small` | 320 | 640 | iPhone SE / piccoli Android |
| `mobile` | 375 | 812 | iPhone 12/13/14/15 |
| `tablet-portrait` | 768 | 1024 | iPad portrait |
| `tablet-landscape` | 1024 | 768 | iPad landscape |
| `desktop` | 1440 | 900 | Monitor standard |
| `desktop-wide` | 1920 | 1080 | Wide monitor |

## 4. Sezioni Homepage (9)

| # | Name | Selector |
|---|---|---|
| 1 | hero | `main > section:nth-child(1)` |
| 2 | intro | `main > section:nth-child(2)` |
| 3 | how-it-works | `main > section:nth-child(3)` |
| 4 | play-again | `main > section:nth-child(4)` |
| 5 | prize-location | `main > section:nth-child(5)` |
| 6 | search | `main > section:nth-child(6)` |
| 7 | public-ranking | `main > section:nth-child(7)` |
| 8 | live-ranking | `main > section:nth-child(8)` |
| 9 | contact | `main > section:nth-child(9)` |

## 5. Metriche per sezione

Ogni sezione produce un `SectionReport` con:

### 5.1 Metriche Base (existing `collectSectionReport`)
- box: posizione e dimensione
- layout metrics: padding, childCount, offsetTop
- typography: campionamento di h1-h4, p, button, a (tag, fontSize, lineHeight, fontWeight, text, lines)
- overflow check: elementi che eccedono i bordi del contenitore
- spacing check: sezione vuota, padding eccessivo
- touch target check: button/a/input < 36px in width o height
- wrapping check: heading/paragraph piu stretti del container

### 5.2 Sub-Element Analysis (nuova)

Per ogni sezione, raccogliere e analizzare individualmente:

#### 5.2.1 Interactive Elements
Ogni `button`, `a[href]`, `input`, `[role="button"]`:
- bounding box
- touch target size (width, height) — warn se < 36px
- visibility (display, visibility CSS)
- testo

#### 5.2.2 Images
Ogni `img` e `[style*="background-image"]`:
- rendered width/height
- natural width/height (via `naturalWidth`/`naturalHeight`)
- aspect ratio distortion: warn se |ratio - naturalRatio| > 0.05
- alt text presence
- object-fit CSS
- loading state (lazy/eager)

#### 5.2.3 Headings
Ogni `h1`, `h2`, `h3`, `h4`:
- font-size (px) e line-height
- overflow rispetto al parent
- widows/orphans detection (linee singole isolate)
- testo completo

#### 5.2.4 Text Blocks
Ogni `p` con testo > 30 caratteri:
- width vs container width — warn se < 40%
- line-height / font-size ratio
- max-width / text-wrap CSS
- overflow detection

#### 5.2.5 Layout Analysis
- Elementi con `position: absolute` o `fixed` — warn se overflowano viewport
- Container flex/grid con child count — warn se wrap inaspettato
- Elementi con `overflow: hidden` — warn se potrebbero nascondere contenuto

## 6. Struttura Output

```json
{
  "generatedAt": "ISO timestamp",
  "spec": "2026-07-22-homepage-responsive-audit-spec.md",
  "routes": [
    {
      "route": "/",
      "viewportName": "mobile-small",
      "viewportWidth": 320,
      "viewportHeight": 640,
      "sections": [
        {
          "name": "hero",
          "selector": "main > section:nth-child(1)",
          "box": { "x": 0, "y": 0, "width": 320, "height": 500 },
          "metrics": { ... },
          "typography": [ ... ],
          "issues": [ ... ],
          "subElements": {
            "interactive": [ ... ],
            "images": [ ... ],
            "headings": [ ... ],
            "textBlocks": [ ... ],
            "layoutAnomalies": [ ... ]
          },
          "subElementIssues": [ ... ]
        }
      ],
      "fullPageScreenshot": "path/to/screenshot"
    }
  ]
}
```

## 7. Score Responsiveness

Al termine, calcolare per ogni sub-elemento un **viewport coverage score**:

```
elemento X: pass su 6/6 viewport → 100% responsive
elemento Y: pass su 4/6 viewport → 67% responsive (FAIL su tablet-landscape, desktop)
```

Nel report aggiungere una sezione `responsivenessSummary`:

```json
"responsivenessSummary": {
  "totalElements": 120,
  "fullyResponsive": 95,
  "partiallyResponsive": 20,
  "broken": 5,
  "score": "79%"
}
```

## 8. File

| File | Ruolo |
|---|---|
| `tests/e2e/visual-audit-homepage.spec.ts` | Nuovo spec test |
| `tests/e2e/helpers/layout-analysis.ts` | Aggiungere `collectSubElementReport()` |
| `tests/e2e/helpers/viewports.ts` | Gia completo, da importare |
| `docs/superpowers/plans/2026-07-22-homepage-audit-implementation.md` | Implementation plan (dopo) |

## 9. Non Fare

- Non modificare gli spec esistenti (`visual-audit.spec.ts`, `visual-audit-admin-only.spec.ts`)
- Non modificare le route admin
- Non modificare la logica di `collectSectionReport` (aggiungere a fianco)
- Non aggiungere viewport extra oltre ai 6 definiti
