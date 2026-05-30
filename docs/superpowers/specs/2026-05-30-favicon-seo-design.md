# Favicon + SEO Minimo

## Stato iniziale
- Nessun favicon nel progetto attivo
- SEO: solo title e description in layout.tsx — nessun Open Graph, canonical URL, Twitter Card
- Accessibilità: lang="it", viewport, themeColor già presenti

## Design approvato

### 1. Favicon
- **File**: `public/favicon.svg`
- **Formato**: SVG 32×32
- **Design**: Sfondo `#814545` (themeColor del sito), lettera "F" bianca, font Open Sauce One, centrata
- **Collegamento**: `metadata.icons` in layout.tsx

### 2. SEO
- **metadataBase**: `new URL("https://fantacer.it")`
- **openGraph**: title, description, siteName: "FANTACER", type: "website"
- Niente Twitter Card, robots.txt, sitemap, manifest, JSON-LD

### 3. Accessibilità
- Nessuna modifica — già coperta da lang="it" e viewport

## File modificati
| File | Modifica |
|---|---|
| `public/favicon.svg` | Nuovo — favicon SVG |
| `src/app/layout.tsx` | Aggiunti: `metadataBase`, `icons`, `openGraph` |
