# Admin Dashboard UI Refactor - Design Spec

## Design Reference

Follow Fuser Studio design tokens from `DESIGN.md`:
- **Dark theme:** bg `#0D0C0B`, surface `#181614`, surface-alt `#221F1C`, border `#2E2A26`, text `#F0EDE8`, muted `#8C8882`, accent `#FF6A1A`
- **Cards:** bg surface, 1px border, radius 10-12px, padding 24px
- **Typography:** Inter for body/UI, 15px base
- **Buttons:** Primary (accent bg), Secondary (outline with border)
- **Transitions:** 200ms ease

---

## Overview

Refactor admin dashboard with new sidebar layout and Fuser Studio design tokens for desktop responsiveness.

---

## 1. Layout Structure

### Sidebar (Fixed Left)
- Width: 240px desktop, collapsible on mobile
- Background: `#181614` with right border `#2E2A26`
- Logo/Title at top: "FANTACER Admin"
- Nav items: Dashboard (active), Import, Settings
- Logout at bottom
- Hover state: background `#221F1C`, accent left border

### Main Content Area
- Max width: 1200px, centered
- Padding: 32px desktop, 16px mobile
- Background: `#0D0C0B`

---

## 2. Components

### Stats Grid
- 4 columns on desktop, 2 on tablet, 1 on mobile
- Cards with surface bg, border, radius 10px
- Icon + label (muted) + value (large, bold)
- Gap: 16px

### Actions Bar
- Horizontal buttons: Export CSV, Export Excel, Import Aziende
- Spacing: gap-2, wrap on mobile

### Chart Card
- Full width
- Height: 280px
- Card styling with surface bg

### Data Tables
- Company Rankings: Full width card
- Vote Log: Full width card below
- Table styling: border-bottom per row, hover highlight
- Pagination: Previous/Next buttons

---

## 3. Responsive Breakpoints

| Breakpoint | Width | Sidebar | Content |
|------------|-------|---------|---------|
| Mobile | < 640px | Hidden (hamburger) | Full width, 16px padding |
| Tablet | 640-1024px | Collapsed icons | Full width, 24px padding |
| Desktop | > 1024px | Visible (240px) | Max 1200px, 32px padding |

---

## 4. Acceptance Criteria

- [ ] Sidebar with navigation (Dashboard, Import, Settings, Logout)
- [ ] Sidebar shows active state on current page
- [ ] Stats grid: 4 cols desktop, 2 tablet, 1 mobile
- [ ] All colors match Fuser tokens
- [ ] Cards have surface bg, border, radius 10px
- [ ] Buttons use accent color for primary
- [ ] Chart card with proper styling
- [ ] Tables scrollable on mobile
- [ ] Responsive at all breakpoints
- [ ] Smooth transitions on hover states