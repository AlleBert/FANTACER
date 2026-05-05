# iPhone Safe-Area Edge-to-Edge Design for MOCKUP

## Goal

Update `MOCKUP` so the experience feels like a modern iPhone web app:

- the visual background continues underneath the notch and home indicator
- readable and interactive content stays inside safe areas
- the notch does not appear as a separate header, bar, or device frame
- full-screen sections keep their immersive snap-scrolling behavior

## Current State

`MOCKUP` already includes the core browser prerequisites:

- `viewportFit: "cover"` is enabled in `MOCKUP/app/layout.tsx`
- safe-area CSS variables are defined in `MOCKUP/app/global.css`

However, the current structure applies safe-area padding globally on `body` and treats sections as generic `100dvh` panels. This makes the UI compatible with iPhone safe areas, but it does not create an intentional edge-to-edge visual system.

## Chosen Approach

Use a `bleed background + safe content` model.

- Each section's visual layer extends fully to the screen edges, including the notch area.
- Content wrappers inside each section apply top/bottom/side padding derived from `env(safe-area-inset-*)`.
- No persistent header, fake notch, or separate top bar is introduced.
- Only sections that need extra readability support may use a very subtle top overlay, visually fused with the section background.

This preserves the user's preferred effect: the notch area feels like a continuation of what is already on screen.

## Layout Model

### Root Layout

- Remove global safe-area padding from `body`.
- Keep `viewportFit: "cover"`.
- Keep the page background capable of reaching screen edges.

### Section Structure

Each full-screen section should follow this structure:

1. An outer section that fills the viewport edge-to-edge.
2. A background layer that can occupy the full viewport, including unsafe areas.
3. An inner content wrapper that uses safe-area-aware spacing for text, buttons, and controls.

### Viewport Height Strategy

- Use dynamic viewport units compatible with mobile browsers.
- Prefer a shared section height token rather than scattered inline `100dvh` usage.
- The scroll container should remain full-screen and snap-based.

## Component-Level Changes

### `MOCKUP/app/layout.tsx`

- Keep metadata and viewport configuration.
- Stop applying safe-area padding directly on `body`.
- Let sections own content spacing.

### `MOCKUP/app/global.css`

- Preserve safe-area variables in `:root`.
- Introduce reusable utility classes or CSS variables for:
  - full-screen section height
  - safe top padding
  - safe bottom padding
  - safe horizontal padding
- Add a reusable content wrapper pattern for edge-to-edge sections.

### `MOCKUP/app/page.tsx`

- Replace repeated inline height calculations with a consistent section wrapper pattern.
- Keep snap scrolling, but ensure the scroll container itself is the immersive full-screen surface.

### Section Components

Priority sections:

- `HeroSection`
- `IntroSection`
- `SearchSection`

Expected changes:

- backgrounds continue under the notch
- content gains safe-area-aware padding
- bottom CTA spacing respects the home indicator area
- large titles avoid colliding with the top inset on small iPhones

Additional sections can adopt the same wrapper so the behavior is consistent across the full mockup.

## Visual Rules

- The top of the screen must feel continuous with the current section.
- No separate notch decoration should be visible.
- Avoid introducing a new header chrome pattern unless a later product requirement needs it.
- For photographic or high-contrast top areas, a faint gradient veil is allowed only if it improves legibility without reading as a bar.

## Error Handling and Fallbacks

- Browsers without safe-area support fall back to zero insets through `env(..., 0)`.
- Desktop should keep looking natural without exaggerated top spacing.
- Sections must remain usable even if the browser reports no safe-area values.

## Verification Plan

- Confirm the first section visually reaches behind the notch area on iPhone Safari.
- Confirm CTA and interactive controls stay clear of the home indicator.
- Confirm snap scrolling still works across sections.
- Confirm desktop and Android layouts do not regress.

## Implementation Scope

This design covers `MOCKUP` layout behavior only. It does not add:

- PWA installation flows
- native status-bar theming
- a persistent mobile navbar
- device-frame presentation chrome
