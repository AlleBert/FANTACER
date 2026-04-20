# DESIGN.md — Fuser Studio
> A dark, editorial creative workspace for AI-forward artists, designers, and agencies who ship.

---

## 1. Visual Theme & Atmosphere

**Mood:** Nocturnal, editorial, tactile, expansive, anti-corporate

**Design philosophy:** Fuser is built for makers, not managers. The UI communicates creative seriousness — a canvas you live in, not a dashboard you report to. The design borrows from art gallery aesthetics: dark ground, content that glows, ample negative space, and a typographic hierarchy that feels more like a magazine than a SaaS landing page. The product is confident in its own strangeness; it does not chase Silicon Valley convention.

**Density:** Intentionally low. Large whitespace (or blackspace) between sections. Text is given room to breathe. Images are editorial-sized and uncropped. The rhythm is slow, deliberate, and cinematic.

**Light theme character:** Off-white, warm parchment canvas with near-black ink text. Feels like a sketch journal or a well-printed editorial magazine. Borders are muted and subtle. CTAs pop against the neutral ground.

**Dark theme character:** Deep near-black background (the primary mode) with bright warm-white text. Feels like a creative studio late at night — monitors glowing, ideas flowing. Subtle grain texture, hints of deep charcoal surfaces, and a single accent color that catches the eye like a neon sign in a dark studio.

---

## 2. Color Palette & Roles

### Light Theme
| Role | Token Name | Hex | Usage |
|------|-----------|-----|-------|
| Background | `--color-bg` | `#F5F2EE` | Page canvas, warm off-white |
| Surface | `--color-surface` | `#EDEBE6` | Cards, panels, nav background |
| Surface Alt | `--color-surface-alt` | `#E4E1DB` | Nested cards, hover panels |
| Border | `--color-border` | `#D4CFC8` | Dividers, outlines |
| Text Primary | `--color-text` | `#141210` | Body, headings |
| Text Secondary | `--color-text-muted` | `#6B6560` | Captions, metadata, nav links |
| Accent / Primary | `--color-accent` | `#FF5C00` | CTAs, active links, highlights |
| Accent Hover | `--color-accent-hover` | `#E04E00` | Hover state on accent elements |
| Accent Subtle | `--color-accent-subtle` | `#FFF0E8` | Accent tinted backgrounds |
| Success | `--color-success` | `#22C55E` | Confirmations |
| Warning | `--color-warning` | `#F59E0B` | Alerts |
| Error | `--color-error` | `#EF4444` | Errors, destructive actions |
| Credits / Special | `--color-credits` | `#E8C84A` | ✦ credit icons, pricing callouts |

### Dark Theme
| Role | Token Name | Hex | Usage |
|------|-----------|-----|-------|
| Background | `--color-bg` | `#0D0C0B` | Page canvas, deep near-black |
| Surface | `--color-surface` | `#181614` | Cards, panels |
| Surface Alt | `--color-surface-alt` | `#221F1C` | Nested cards, hover panels |
| Border | `--color-border` | `#2E2A26` | Dividers, outlines |
| Text Primary | `--color-text` | `#F0EDE8` | Body, headings — warm white |
| Text Secondary | `--color-text-muted` | `#8C8882` | Captions, metadata, nav links |
| Accent / Primary | `--color-accent` | `#FF6A1A` | CTAs, links, active indicators |
| Accent Hover | `--color-accent-hover` | `#FF8040` | Hover state — slightly lighter orange |
| Accent Subtle | `--color-accent-subtle` | `#2A1800` | Accent tinted dark backgrounds |
| Success | `--color-success` | `#34D399` | Confirmations |
| Warning | `--color-warning` | `#FBBF24` | Alerts |
| Error | `--color-error` | `#F87171` | Errors |
| Credits / Special | `--color-credits` | `#F0C040` | ✦ credit icons, pricing callouts |

---

## 3. Typography Rules

### Font Families
- **Primary / Display / Heading:** `"Instrument Serif"` or `"DM Serif Display"` — elegant, slightly editorial serif with warmth. Used for hero headlines and large display copy.
- **Body / UI / Nav:** `"Inter"` or `"DM Sans"` — clean, contemporary grotesque sans-serif for all interface elements, body text, buttons, labels.
- **Monospace / Code:** `"JetBrains Mono"` or `"IBM Plex Mono"` — for technical content, node references in docs.
- **Fallback stack:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

### Type Scale
| Role | Size | Weight | Line Height | Letter Spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| Display | 64–80px | 400–600 | 1.0–1.1 | -0.03em | Hero headline ("Your workspace for evolving ideas") |
| H1 | 48–56px | 500–700 | 1.1 | -0.02em | Page-level titles |
| H2 | 32–40px | 600–700 | 1.2 | -0.01em | Section headings |
| H3 | 22–26px | 600 | 1.3 | 0 | Card titles, sub-section heads |
| Body Large | 18–20px | 400 | 1.6 | 0 | Lead text under heroes, marketing copy |
| Body | 15–16px | 400 | 1.65 | 0 | Paragraphs, descriptions |
| Small / Caption | 12–13px | 400–500 | 1.5 | 0.01em | Labels, tags, timestamps |
| Eyebrow / Label | 11–12px | 600 | 1.4 | 0.08–0.12em | Uppercase section labels ("### Workflows", "### Pricing") |
| Code | 13–14px | 400 | 1.6 | 0 | Node references, docs code |

**Eyebrow labels** — e.g. `### Workflows` — appear in uppercase with tracked-out letterspacing, muted color, and a smaller size than the section title below them. They are a key part of Fuser's editorial hierarchy.

---

## 4. Component Stylings

### Announcement Banner
A full-width sticky strip above the header. Dark-on-dark or inverted (near-black on warm-white or vice versa). Text is small (13px), centered, with an inline text link and no close button.
- Background: `--color-surface` | Text: `--color-text-muted` | Link: `--color-accent`
- Hover on link: color → `--color-accent-hover`, subtle underline
- Transition: color 150ms ease

### Primary Button ("Get Started")
- Background: `--color-accent` | Text: `#FFFFFF` | Border: none | Radius: `6px`
- Padding: `10px 22px`
- Font: 500 weight, 15px, Inter
- Hover: background → `--color-accent-hover`, transition: background 200ms ease, subtle scale(1.02) transform
- Focus: outline 2px `--color-accent` offset 2px
- Disabled: opacity 0.45, cursor not-allowed
- Dark: No override needed — accent orange works on both themes

### Secondary / Ghost Button
- Background: transparent | Text: `--color-text` | Border: 1px solid `--color-border` | Radius: `6px`
- Padding: `10px 22px`
- Hover: background → `--color-surface-alt`, border-color → `--color-text-muted`
- Transition: background 150ms ease, border-color 150ms ease

### Navigation Header
**Structure:**
- Fixed or sticky at top of page
- Left: Wordmark `Fuser` — logotype, text-based, primary font weight ~700
- Center: Nav links — `Workflows · Features · Pricing · Blog · Careers`
- Right: `Get Started` CTA button

**Styling:**
- Background: transparent over hero, transitions to `--color-surface` with slight `backdrop-filter: blur(12px)` on scroll
- Nav links: `--color-text-muted`, 14px, weight 400–500
- Nav link hover: color → `--color-text`, transition: color 150ms ease
- No underline on hover — color change only
- Active / current link: `--color-text`, weight 500
- On mobile: nav links collapse into hamburger menu, logo remains visible left, CTA remains right
- Header height: ~60–64px desktop, ~52px mobile
- Border-bottom: `1px solid --color-border` appears on scroll alongside blur background

### Cards
- Background: `--color-surface` | Border: `1px solid --color-border` | Radius: `10–12px`
- Padding: `24–32px`
- Hover: border-color → `--color-accent`, background → `--color-surface-alt`
- Transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease
- Hover shadow: `0 4px 20px rgba(255,106,26,0.08)` (subtle orange glow in dark)
- No hover shadow in light mode — use background shift only

### Input Fields
- Background: `--color-bg` | Border: `1px solid --color-border` | Radius: `6px`
- Padding: `10px 14px` | Font: 15px, 400
- Focus: border-color → `--color-accent`, outline: none, box-shadow: `0 0 0 3px rgba(255,106,26,0.18)`
- Placeholder: `--color-text-muted`

### Badges / Tags
- Background: `--color-surface-alt` | Text: `--color-text-muted` | Radius: `9999px`
- Padding: `3px 10px` | Font: 12px, 500, slight letter-spacing

### Provider Logos Marquee (Infinite Scroll)
- A horizontally scrolling ticker of AI provider names (OpenAI, Runway, Anthropic, etc.)
- Animation: `animation: marquee 30s linear infinite`
- Two duplicated lists side-by-side to create seamless loop
- On hover: `animation-play-state: paused`
- Text: `--color-text-muted`, uppercase, small (12–13px)
- Separator dots or spacing between names

---

## 5. Layout Principles

### Spacing Scale (8px base)
8 · 16 · 24 · 32 · 48 · 64 · 80 · 96 · 128 · 160px

### Grid
- Max content width: `1200px` (some hero sections stretch to 1440px edge-to-edge)
- Column system: fluid, often 2-column for feature/image splits; single-column for editorial sections
- Gutter: `32px` desktop, `16px` mobile
- Section vertical padding: `80–120px` desktop, `48–64px` mobile

### Whitespace Philosophy
Fuser uses whitespace as a creative statement — sections are separated by generous vertical air, letting each idea stand alone before the next. Dense content (model name marquees, image galleries) is used sparingly as a contrast moment against the otherwise spacious layout.

### Hero Image Gallery
Above the fold uses an auto-scrolling or staggered masonry of AI-generated images (Colors, Braids, Shoes, Motorcycle, Sunset, Topography) to immediately demonstrate what the tool produces. Images appear side by side with no gaps, cropped to a consistent height (~640px), forming a horizontal film-strip before the main headline below.

---

## 6. Depth & Elevation

| Level | Token | Value | Usage |
|-------|-------|-------|-------|
| 0 — Flat | `--shadow-none` | none | Default cards, nav |
| 1 — Raised | `--shadow-sm` | `0 1px 4px rgba(0,0,0,0.2)` | Dropdowns, tooltips |
| 2 — Floating | `--shadow-md` | `0 4px 16px rgba(0,0,0,0.28)` | Modals, popovers |
| 3 — Overlay | `--shadow-lg` | `0 16px 48px rgba(0,0,0,0.40)` | Full-screen dialogs |
| Accent Glow | `--shadow-accent` | `0 4px 20px rgba(255,106,26,0.15)` | CTA buttons hover, card hover (dark mode) |

**Border Radius:**
- Sharp: `4px` — inline code, tags
- Default: `6–8px` — buttons, inputs
- Card: `10–12px` — content cards
- Pill: `9999px` — badges, chips, CTA buttons alternate style
- Circle: `50%` — avatars, icon buttons

**Backdrop:** Header uses `backdrop-filter: blur(12px) saturate(180%)` on scroll for glassy depth effect. Surfaces are generally flat — no decorative gradients inside components.

---

## 7. Do's and Don'ts

### ✅ Do
- Use near-black (`#0D0C0B`) as the default canvas — this is a dark-first product; light theme is secondary
- Let images do the talking in hero sections. Full-bleed, no borders, no drop shadows on imagery
- Use the eyebrow label pattern (small, tracked, uppercase, muted) to introduce every section before the headline
- Keep nav link states to color transitions only (no underlines, no backgrounds on hover)
- Use the orange accent (`--color-accent`) sparingly — one primary CTA per section maximum
- Animate the model/provider name ticker with `marquee` keyframes, pause on hover
- Apply `backdrop-filter: blur()` to the header on scroll — don't use a solid opaque background immediately
- Use `transition: all 200ms ease` for interactive elements; prefer cubic-bezier for hover transforms
- Reserve the ✦ symbol (gold credits) exclusively for pricing/credit-related contexts
- Scale headings down aggressively on mobile — Display text of 72px should drop to ~36–40px on small screens

### ❌ Don't
- Don't use bright white (`#FFFFFF`) as background — it clashes with the brand's warm, editorial character
- Don't underline nav links on hover — color shift only
- Don't stack multiple CTAs of the same type in a single section
- Don't use shadows heavier than `--shadow-sm` on cards — flatness is intentional
- Don't use the orange accent for body text or decorative elements — it loses punch
- Don't use tight letter-spacing (`-0.05em` or tighter) on body text — it impairs readability
- Don't use the sans-serif (Inter/DM Sans) at display sizes in hero headlines — the serif brings the editorial character
- Don't auto-play video or animation that cannot be paused — respect the user's creative focus
- Don't use dividers or horizontal rules between every section — rely on whitespace alone
- Don't center-align body paragraphs longer than 2 lines — reserve centering for short headline/subline pairs

---

## 8. Responsive Behavior

| Breakpoint | Width | Columns | Notes |
|------------|-------|---------|-------|
| Mobile | < 640px | 1 | Hero film-strip hides or shows 2 images; nav collapses |
| Tablet | 640–1024px | 1–2 | Nav links may stay visible or go to hamburger |
| Desktop | 1024–1280px | 2–3 | Full layout, marquee at full speed |
| Wide | > 1280px | max-width 1200px capped | Content centered, hero images edge-to-edge |

Touch targets: 44×44px minimum for all interactive elements.

Nav collapse strategy: Hamburger icon (top-right), slides in a full-screen overlay or side-drawer menu in dark theme with blurred background.

Image gallery (hero film-strip): Reduces to 2–3 visible images on mobile with overflow hidden and horizontal scroll or snap.

Marquee speed: Slows by ~20% on mobile for readability.

---

## 9. Agent Prompt Guide

### Quick Reference Palette
**Dark (primary):**
bg `#0D0C0B` | surface `#181614` | text `#F0EDE8` | muted `#8C8882` | accent `#FF6A1A` | accent-hover `#FF8040` | border `#2E2A26`

**Light (secondary):**
bg `#F5F2EE` | surface `#EDEBE6` | text `#141210` | muted `#6B6560` | accent `#FF5C00` | accent-hover `#E04E00` | border `#D4CFC8`

**Fonts:** Display/H1 → DM Serif Display (serif) | Body/UI → Inter or DM Sans (sans) | Code → JetBrains Mono

**Special:** Credits icon `✦` color `#F0C040`

### Ready-to-Use Prompts

- "Build a dark landing hero for a creative AI tool in the style of Fuser Studio. Use `#0D0C0B` background, `#F0EDE8` warm-white headline in DM Serif Display at 72px, `#8C8882` muted subtext in Inter at 18px, and a `#FF6A1A` orange CTA button with 200ms hover transition to `#FF8040`."

- "Create a sticky navigation bar in the Fuser style: transparent background, `backdrop-filter: blur(12px)` on scroll, wordmark left in Inter 700, center nav links in `#8C8882` that shift to `#F0EDE8` on hover with 150ms color transition, and a `Get Started` button in `#FF6A1A` right-aligned with `border-radius: 6px`."

- "Generate a dark-mode feature card component with `#181614` background, `1px solid #2E2A26` border, `border-radius: 10px`, title in Inter 600 at 20px `#F0EDE8`, body text at 15px `#8C8882`. On hover: border-color shifts to `#FF6A1A`, subtle `box-shadow: 0 4px 20px rgba(255,106,26,0.08)`, transition 200ms ease."

- "Build an infinite horizontal marquee of provider names (OpenAI, Runway, Anthropic...) using CSS `@keyframes marquee` with `transform: translateX(-50%)` loop. Text in `#8C8882`, 12px uppercase Inter with `letter-spacing: 0.08em`. Pause on hover via `animation-play-state: paused`."

- "Design a pricing section in the Fuser style: `#0D0C0B` background, section eyebrow '### Pricing' in 11px uppercase `#8C8882` with `letter-spacing: 0.10em`, large H2 headline in DM Serif Display at 40px `#F0EDE8`, subtext in Inter, and a CTA 'Start with 2,000✦' where ✦ renders in `#F0C040`."
