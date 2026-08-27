# Verifica performance post-ottimizzazione

## Bundle

`npm run perf:report` → `perf-output/bundle-client.html` + `perf-output/perf-report.md`.

Pacchetti che NON devono comparire nel bundle iniziale della homepage:
- `framer-motion` / `motion-dom`
- `@sentry/nextjs` (client)
- `react-cookie-manager`

Verifica rapida sul report di bundle (`npm run analyze` → `.next/analyze/client.html`):

```bash
node -e '
const fs = require("fs");
const html = fs.readFileSync(".next/analyze/client.html", "utf8");
const checks = ["framer-motion", "motion-dom", "react-cookie-manager", "@sentry/nextjs"];
for (const c of checks) {
  console.log(c, "=>", html.includes(c) ? "PRESENTE" : "RIMOSSO");
}
'
```

Tutti i check devono riportare `RIMOSSO`. Nota: `@sentry/nextjs` può lasciare
etichette residue in altri chunk (es. `sentry.client.config`); per confermare
che l'SDK client è davvero assente cercare anche `Sentry.init` e
`captureException` (0 match).

## Re-render

`react-scan` (attivo in `npm run dev`) NON deve più evidenziare:
- `AnimatePresence` / `PresenceChild` / `PopChild` / `MeasureLayout`
- re-render esplosivi di `LiquidFillButton` al resize

## Suite

`npm run ui:health` (lint + typecheck + unit + e2e gate).
