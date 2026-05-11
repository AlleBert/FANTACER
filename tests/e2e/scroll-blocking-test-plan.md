# Test Plan: Scroll Blocking Bug Fix

## Background

### Problema
Dopo aver votato, l'utente viene portato alla sezione "sei forte!" ma non può scrollare verso altre sezioni senza refresh della pagina.

### Causa Root
Gli overlay (TurnstileOverlay, MessageOverlay) con `z-index: 100` rimangono nel DOM anche quando non visibili (opacity: 0) e bloccano gli eventi touch.

### Modifiche Implementate

1. **page.tsx** - Snap sempre attivo (rimossa condizione `!gameUnlock.success`)
2. **innovation-section.tsx** - useEffect per chiudere overlay quando `gameUnlock.success = true`

## Piano di Test

### Test 1: Scroll Dopo Voto (Critical)

**Obiettivo:** Verificare che l'utente possa scrollare dalla sezione "sei forte" dopo il voto

**Steps:**
1. Completa il flusso di voting (search → comment → adjective → sliders → submit)
2. Arriva alla sezione successo ("sei forte!")
3. Prova a scrollare verso altre sezioni
4. Verifica che lo scroll funzioni senza refresh

**Expected:** Scroll funziona ✅

---

### Test 2: Snap Attivo Dopo Voto (Critical)

**Obiettivo:** Verificare che lo snap tra sezioni funzioni anche dopo il voto

**Steps:**
1. Completa il flusso di voting
2. Arriva alla sezione successo
3. Scrolla e verifica lo snap sulle sezioni
4. Verifica che main abbia `snap-y snap-mandatory`

**Expected:** Snap attivo ✅

---

### Test 3: Overlay Chiusi Dopo Voto

**Obiettivo:** Verificare che gli overlay siano effettivamente chiusi (non solo invisibili)

**Steps:**
1. Completa il flusso di voting
2. Arriva alla sezione successo
3. Verifica che NON ci siano elementi fixed con pointer-events: auto e visibility: visible
4. Verifica che TurnstileOverlay e MessageOverlay non siano nel DOM o non siano visibili

**Expected:** Nessun overlay bloccante ✅

---

### Test 4: Button "FATTO!" Funziona (Regression)

**Obiettivo:** Verificare che il click sul button "FATTO!" apra il captcha

**Steps:**
1. Completa i 3 slider, seleziona aggettivo, scrivi commento
2. Clicca "FATTO!"
3. Verifica che appaia il Turnstile (captcha)

**Expected:** Captcha visibile ✅

---

## Test Execution

### Run Singolo Test
```bash
npx playwright test tests/e2e/scroll-blocking.spec.ts -g "test name"
```

### Run Tutti i Test
```bash
npx playwright test tests/e2e/scroll-blocking.spec.ts
```

### Run con UI
```bash
npx playwright test tests/e2e/scroll-blocking.spec.ts --ui
```

## CI Integration

```yaml
# .github/workflows/test.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test tests/e2e/scroll-blocking.spec.ts
```

## Acceptance Criteria

- [ ] Test 1: Scroll dopo voto funziona
- [ ] Test 2: Snap attivo dopo voto
- [ ] Test 3: Overlay non bloccanti
- [ ] Test 4: Button "FATTO!" funziona (no regression)
- [ ] Tutti i test esistenti passano

## Note

- I test usano mock per Turnstile ( Cloudflare captcha non disponibile in test)
- I test simulano il flusso completo di voting
- Viewport testati: Desktop (1280x720), Mobile (375x812)