# Admin Dashboard Visual Enhancement - Design Spec

## Design Reference

Follow Fuser Studio design tokens from `DESIGN.md`:
- **Dark theme:** bg `#0D0C0B`, surface `#181614`, border `#2E2A26`, text `#F0EDE8`, muted `#8C8882`, accent `#FF6A1A`
- **Cards:** bg surface, 1px border, radius 10-12px
- **Typography:** Inter for body/UI, 15px base
- **Buttons:** Primary (accent bg), Secondary (outline)
- **Transitions:** 200ms ease

## Overview

Add real charts and detailed data tables to the admin dashboard for better analytics visibility.

---

## 1. Chart Section

**Styling (Fuser):** Card with surface bg, border, radius 10px, padding 24px

**Component:** Recharts LineChart
- **Data:** Daily vote counts from `daily_stats` table
- **X-axis:** Date (formatted DD/MM)
- **Y-axis:** Vote count
- **Lines:** 
  - Total votes (primary color: `#FF6A1A`)
  - Unique voters (secondary color: `#8C8882`)
- **Grid lines:** border color `#2E2A26`
- **Tooltip:** surface bg, border, accent highlight
- **Tooltip:** Shows exact values on hover
- **Height:** 280px
- **View:** Last 7 days default, configurable

---

## 2. Company Rankings Table

**Styling (Fuser):** Card container, table with border-bottom per row, hover highlight

**Component:** TanStack Table (React Table) with shadcn/ui

| Column | Width | Sortable |
|--------|-------|----------|
| Rank | 60px | No |
| Logo | 48px | No |
| Company Name | flex | Yes |
| Category | 120px | Yes |
| Votes | 100px | Yes (default) |
| Trend | 80px | No |

**Features:**
- Default sort: votes desc
- Search input: filter by company name (client-side)
- Pagination: 20 per page
- Trend indicator: compare to yesterday's count (↑ +X, ↓ -X, → 0)

**Data source:** `companies` joined with vote count aggregation

---

## 3. Vote Log Table

**Styling (Fuser):** Card container, table with border-bottom per row

**Component:** TanStack Table (React Table) with shadcn/ui

| Column | Width | Sortable |
|--------|-------|----------|
| Timestamp | 160px | Yes |
| Company | 200px | Yes |
| Fingerprint | 120px | No (masked) |
| Country | 80px | Yes |
| Device | flex | No |

**Features:**
- Show last 100 votes (paginated, 25 per page)
- Search by company name
- Export to CSV button
- Fingerprint masked: first 8 chars + "..."

**Data source:** `votes` table joined with `companies`

---

## 4. Layout Structure

```
┌─────────────────────────────────────────────┐
│ Header: Admin Dashboard                      │
├─────────────────────────────────────────────┤
│ Stats Grid (4 cards)                         │
├─────────────────────────────────────────────┤
│ Actions Bar: [Export CSV] [Export Excel]     │
│            [Import] [Settings]               │
├─────────────────────────────────────────────┤
│ Chart Section                                │
│ ┌─────────────────────────────────────────┐ │
│ │         LineChart (recharts)             │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ Company Rankings Table                       │
│ [Search] [Sort by votes ▼]                  │
│ ┌─────────────────────────────────────────┐ │
│ │ Rank | Logo | Name | Cat | Votes | Trend│ │
│ └─────────────────────────────────────────┘ │
│ Pagination: < 1 2 3 ... 10 >                │
├─────────────────────────────────────────────┤
│ Vote Log                                     │
│ [Search] [Export CSV]                       │
│ ┌─────────────────────────────────────────┐ │
│ │ Time | Company | FP | Country | Device  │ │
│ └─────────────────────────────────────────┘ │
│ Pagination: < 1 2 3 ... 4 >                 │
└─────────────────────────────────────────────┘
```

---

## 5. API Requirements

### New endpoint: GET /api/admin/companies
Returns companies with vote counts and trend data.

### New endpoint: GET /api/admin/votes
Returns vote log with company names, pagination support.

### Update: GET /api/analytics
Add `days` parameter for configurable date range.

---

## 6. Dependencies

- recharts (^2.x)
- @tanstack/react-table (^8.x)
- date-fns (for date formatting)

---

## 7. Acceptance Criteria

- [ ] LineChart displays with real data from daily_stats
- [ ] Company table shows all companies with vote counts
- [ ] Company table is sortable by votes, name, category
- [ ] Company search filters results client-side
- [ ] Trend shows ↑↓→ based on yesterday comparison
- [ ] Vote log shows last 100 votes with company names
- [ ] Vote log fingerprint is masked (first 8 chars)
- [ ] Both tables have working pagination
- [ ] Export CSV works for vote log
- [ ] No console errors on load