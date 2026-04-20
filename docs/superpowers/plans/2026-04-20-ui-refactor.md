# Complete UI Refactor Plan

**Goal:** Refactor ALL UI components in FANTACER to have consistent, modern design following DESIGN.md principles.

**Requirements:**
- Complete refactor (option C)
- Keep current theme (light/dark based on shadcn)
- All components: header, company-card, ranking-bar, gdpr-banner, buttons

---

## Design System

Based on DESIGN.md principles adapted to current shadcn/ui theme:

### Color Palette (Dark Theme - Primary)
| Role | Token | Hex |
|------|-------|-----|
| Background | `--color-bg` | `#0D0C0B` |
| Surface | `--color-surface` | `#181614` |
| Border | `--color-border` | `#2E2A26` |
| Text Primary | `--color-text` | `#F0EDE8` |
| Text Muted | `--color-text-muted` | `#8C8882` |
| Accent | `--color-accent` | `#FF6A1A` |

### Typography
- Display: DM Serif Display (fallback: serif)
- Body/UI: Inter (fallback: system-ui)
- Font sizes: 12, 14, 16, 18, 24, 32, 48px

### Spacing Scale (8px base)
8 · 16 · 24 · 32 · 48 · 64px

---

## Task 1: globals.css - Update Design Tokens

**Files:**
- Modify: `/mnt/c/FANTACER/fantacer/src/app/globals.css`

Add new design tokens for dark theme:

```css
/* Dark Theme - Editorial Style */
:root, .dark {
  /* Override shadcn defaults for dark theme */
  --background: #0D0C0B;
  --foreground: #F0EDE8;
  --card: #181614;
  --card-foreground: #F0EDE8;
  --popover: #181614;
  --popover-foreground: #F0EDE8;
  --primary: #FF6A1A;
  --primary-foreground: #FFFFFF;
  --secondary: #221F1C;
  --secondary-foreground: #F0EDE8;
  --muted: #221F1C;
  --muted-foreground: #8C8882;
  --accent: #FF6A1A;
  --accent-foreground: #FFFFFF;
  --destructive: #F87171;
  --border: #2E2A26;
  --input: #2E2A26;
  --ring: #FF6A1A;
}

/* Light Theme */
:root {
  --background: #F5F2EE;
  --foreground: #141210;
  --card: #FFFFFF;
  --card-foreground: #141210;
  --popover: #FFFFFF;
  --popover-foreground: #141210;
  --primary: #FF5C00;
  --primary-foreground: #FFFFFF;
  --secondary: #EDEBE6;
  --secondary-foreground: #141210;
  --muted: #EDEBE6;
  --muted-foreground: #6B6560;
  --accent: #FF5C00;
  --accent-foreground: #FFFFFF;
  --destructive: #EF4444;
  --border: #D4CFC8;
  --input: #D4CFC8;
  --ring: #FF5C00;
}

/* Accent glow for dark mode */
.dark .accent-glow {
  box-shadow: 0 4px 20px rgba(255, 106, 26, 0.15);
}
```

---

## Task 2: CompanyCard - Refactor

**Files:**
- Modify: `/mnt/c/FANTACER/fantacer/src/components/company-card.tsx`

New design:
- Card: dark surface (#181614), border #2E2A26, radius 10px
- Hover: border shifts to accent (#FF6A1A), subtle glow
- Image area: editorial style, no gradient
- Badge: position indicator with accent glow for top 3
- Button: full-width, accent color

```tsx
// Key changes:
- Add accent-glow effect on hover for top 3
- Position badge with top-3 highlight
- Consistent border radius (10px)
- Better image handling
```

---

## Task 3: Header - Refactor

**Files:**
- Modify: `/mnt/c/FANTACER/fantacer/src/components/layout/header.tsx`

New design:
- Sticky header with blur backdrop
- Trophy icon + FANTACER logo (DM Serif Display style)
- Timer display for vote reset
- Search input with icon
- Dark surface background

---

## Task 4: RankingBar - Refactor

**Files:**
- Modify: `/mnt/c/FANTACER/fantacer/src/components/ranking-bar.tsx`

New design:
- Dark surface card
- Trophy icon with accent color
- Top 3 with gold/silver/bronze styling
- Vote count with accent highlight
- Trend indicators (if available)
- Smooth transitions

---

## Task 5: GDPRBanner - Refactor

**Files:**
- Modify: `/mnt/c/FANTACER/fantacer/src/components/gdpr-banner.tsx`

New design:
- Modal overlay with dark glass effect
- Cookie icon + "Cookie & Privacy" title
- Italian compliance text
- Two buttons: "Solo necessari" (outline) + "Accetta tutto" (accent)
- Close X button
- Surface card with border

---

## Task 6: Button - Refactor

**Files:**
- Modify: `/mnt/c/FANTACER/fantacer/src/components/ui/button.tsx`

New styles:
- Primary: accent background (#FF6A1A), white text, 6px radius
- Hover: slightly lighter accent (#FF8040), scale(1.02)
- Focus: 2px accent outline with offset
- Transition: 200ms ease

---

## Execution

Each task should be done with:
1. Read current component
2. Apply new design
3. Test with `npm run dev` (manual)
4. Commit changes

No TDD needed for UI - visual verification only.
