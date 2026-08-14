# Frontend Quality — Responsive & Accessibility Validation

## Supported Viewports

| Name | Width | Height | Device Category |
|---|---|---|---|
| mobile-small | 320 | 640 | Small mobile |
| mobile | 375 | 812 | Standard mobile (iPhone, Pixel) |
| tablet-portrait | 768 | 1024 | iPad portrait |
| tablet-landscape | 1024 | 768 | iPad landscape |
| desktop | 1440 | 900 | Standard desktop |
| desktop-wide | 1920 | 1080 | Large desktop |

Tests cover all 6 viewports for page-level checks (overflow, text clipping, interactive reachability).

## Browser Coverage

| Project | Browser | Default Viewport | Purpose |
|---|---|---|---|
| `chromium` | Chrome/Edge | 1440×900 | Primary desktop tests, screenshots, accessibility |
| `firefox` | Firefox | 1440×900 | Cross-browser desktop validation |
| `mobile-chrome` | Chrome (mobile) | 375×812 | Android mobile |
| `mobile-webkit` | Safari (mobile) | 375×812 | iOS mobile |

Desktop viewport tests (1440, 1920) run across Chromium and Firefox. Mobile viewport tests (320, 375) run across Mobile Chrome and Mobile WebKit. Tablet viewports (768, 1024) run in Chromium.

## Responsive Philosophy

- **Mobile-first**: The layout is snap-based (`snap-y snap-mandatory`) with sections stacking vertically. All viewports must preserve this scroll container behavior.
- **No horizontal overflow**: `document.body.scrollWidth` must never exceed `document.body.clientWidth` by more than 1px. Any overflow indicates a broken layout.
- **No text clipping**: Text inside containers must not overflow their parent boundary. This detects insufficient padding, missing overflow handling, or layout shifts at narrow widths.
- **Interactive elements reachable**: Buttons, links, inputs, and `[tabindex]` elements must have non-zero dimensions, be visible (not `display:none`/`visibility:hidden`), and have positive opacity.

## Accessibility Standards

- **Level**: WCAG 2.1 AA
- **Tool**: `@axe-core/playwright`
- **Tags scanned**: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`
- **Scan frequency**: Every E2E run on critical routes

### Known Accessibility Violations

These are documented violations that pass without failing the build. Any new violation type will cause a test failure. These represent pre-existing issues that should be addressed in future design system work.

| Route | Violation ID | Impact | Reason |
|---|---|---|---|
| `/admin/login` | `color-contrast` | serious | Dashboard header text `#ff8a26` on `#ffffff` (2.35:1, needs 4.5:1) — brand color |
| `/admin/dashboard/panoramica` | `color-contrast` | serious | Red negative values (`text-red-500`) and orange primary buttons — brand palette |
| `/admin/dashboard/aziende` | `color-contrast` | serious | Orange primary buttons in batch selector — brand palette |

### How to Update Violation Baselines

When fixing an accessibility issue:

1. Remove the violation ID from `allowedViolations` in the test file
2. Run `npm run test:e2e` to confirm the fix
3. Remove the row from this table

When a new violation must be intentionally accepted:

1. Add the violation ID to `allowedViolations` in the test file
2. Add a row to this table with a clear reason
3. The `reason` field must explain why it's acceptable

## UI Health Command

A single command to validate all frontend quality gates:

```bash
npm run ui:health
```

Runs sequentially: **Lint → TypeScript check → Unit tests → E2E tests**.

### When to Run

- Before committing changes
- Before opening a pull request
- After dependency updates
- When CI fails locally and you need to reproduce

### Expected Output

```
$ npm run ui:health

> fantacer@0.1.0 lint
> eslint
✔ No ESLint errors

> fantacer@0.1.0 typecheck
> tsc --noEmit
✔ TypeScript check passed

> fantacer@0.1.0 test
> jest
 PASS  src/... (14 tests)
✔ All unit tests pass

> fantacer@0.1.0 test:e2e
> playwright test
 106 passed (4 projects)
✔ All E2E tests pass
```

### Troubleshooting

| Fails at | Likely cause |
|---|---|
| `lint` | ESLint rule violation — run `npm run lint` to see details |
| `typecheck` | Type error — run `npx tsc --noEmit` for full error list |
| `test` | Unit test failure — run `npm test -- --verbose` for details |
| `test:e2e` | Missing dev server or env vars — see below |

## How to Run Locally

```bash
# Terminal 1 (dev server with dev bypass for testing)
NEXT_PUBLIC_X7K2M9QS3P=hx7k2m9Qs3P npm run dev

# Terminal 2 (run all E2E tests)
npm run test:e2e

# Or with Playwright UI mode
npm run test:e2e:ui

# Run a specific test file
npx playwright test tests/e2e/homepage.spec.ts

# Run with specific project
npx playwright test --project=chromium
```

### Running Without Dev Bypass

If you want to test against a production build:

```bash
npm run build
NEXT_PUBLIC_X7K2M9QS3P=hx7k2m9Qs3P npm run start &
sleep 3
npm run test:e2e
```

The `NEXT_PUBLIC_X7K2M9QS3P` env var is required for playwright tests because:
- It skips admin authentication checks (dashboard layout and API routes)
- It bypasses Turnstile CAPTCHA requirement during voting

This is safe because the bypass only works with the specific value `hx7k2m9Qs3P`.

## Screenshot Tests

### What's Captured

| Page | Screenshot | Wait Strategy |
|---|---|---|
| Homepage | Hero section | `networkidle` (waits for async images) |
| Homepage | Search section | `networkidle` + `scrollIntoViewIfNeeded` (waits for batch fetch) |

### Browser Coverage

Visual regression runs on **Chromium** (consistent desktop rendering) and **Mobile WebKit** (real iOS rendering). Firefox and Mobile Chrome run functional tests only (responsive, accessibility) — screenshot baselines are not maintained for them.

### Screenshot Storage

Baselines are stored in `tests/e2e/screenshots/{projectName}/{testFile}/{testName}.png`.

Only `chromium/` and `mobile-webkit/` directories are actively maintained. If `firefox/` or `mobile-chrome/` directories exist they are stale and should be removed (the code skips those projects for screenshot tests).

Screenshots are committed to git. CI compares against these committed baselines.

### Updating Screenshots

```bash
# Regenerate all screenshots
npx playwright test --update-snapshots

# Regenerate specific test file screenshots
npx playwright test tests/e2e/homepage.spec.ts --update-snapshots
```

Review the diff before committing. Blur/font differences between OSes are expected for cross-platform screenshots.

### Configuration

- `maxDiffPixelRatio`: Not set (uses Playwright default of 0)
- Thresholds can be added per-test via `expect().toHaveScreenshot({ maxDiffPixels: N })` if needed

## CI Behavior

1. CI runs `npm run build` to create the production bundle
2. Playwright's `webServer` auto-starts `npm run start` (production server)
3. All 4 Playwright projects run tests in parallel
4. Screenshots are compared against committed baselines
5. Accessibility violations are scanned; new violation types fail the build
6. Responsive overflow/text-clipping failures fail the build

Screenshots are captured on Chromium and Mobile WebKit only. Firefox and Mobile Chrome run functional tests (responsive, accessibility).

CI uses `npm run start` for production-accurate testing. Local development uses `npm run dev` (fast HMR) with `reuseExistingServer: true` to avoid unnecessary rebuilds.

### Test Data

Voting flow tests (voting-flow, scroll-blocking) seed their own test data at runtime using the Supabase admin client. Companies are created with `batch = 'TEST'` and cleaned up after the suite finishes. The `batch_settings` table is upserted to ensure `active_batch = 'TEST'`. No manual SQL seeding is required.

## Extending Tests

### Adding a New Route

1. Add the route to `tests/e2e/accessibility.spec.ts` with appropriate `allowedViolations`
2. If the route has visual importance, add a screenshot test
3. If the route has dynamic data, add responsive checks

### Adding a New Viewport

1. Add to `tests/e2e/helpers/viewports.ts`
2. The viewport is automatically covered by all parameterized responsive tests

### Adding a New Playwright Project (Browser)

1. Add to `playwright.config.ts` projects array
2. Tests that should run on all projects use project-independent viewport logic
3. Tests limited to specific projects (screenshots, accessibility) use `test.skip()` based on project name
