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

Tutti i test usano `completeVotingFlow(page)` che esegue: ricerca aziende → selezione pallet → conferma → invio voto → attesa sezione successo.

### TEST 1: Scroll Dopo Voto (Critical)

**Obiettivo:** Verificare che l'utente possa scrollare dalla sezione "sei forte" dopo il voto

**Steps:**
1. Completa il flusso di voting (`completeVotingFlow`)
2. Verifica che `main` sia visibile
3. Confronta `scrollHeight` con `clientHeight`

**Expected:** `scrollHeight > clientHeight` — il contenuto si estende oltre la viewport, lo scroll è possibile ✅

---

### TEST 2: Snap Attivo Dopo Voto (Critical)

**Obiettivo:** Verificare che lo snap tra sezioni funzioni anche dopo il voto

**Steps:**
1. Completa il flusso di voting
2. Legge la classe di `main`
3. Verifica presenza di `snap-y` e `snap-mandatory`

**Expected:** Snap attivo ✅

---

### TEST 3: Nessun Overlay Bloccante Dopo Voto

**Obiettivo:** Verificare che gli overlay siano effettivamente chiusi (non solo invisibili)

**Steps:**
1. Completa il flusso di voting
2. Attende 1 secondo per eventuali transizioni
3. Controlla tutti gli elementi `position: fixed` nel DOM
4. Filtra quelli con `pointer-events` diverso da `none`, `visibility` diverso da `hidden`, `opacity > 0`
5. Verifica che nessuno abbia `z-index: 100` o `z-index: auto`

**Expected:** Nessun overlay bloccante (`blockingOverlays.length === 0`) ✅

---

### TEST 4: Success Section Visible Dopo Voto

**Obiettivo:** Verificare che la sezione di successo sia visibile dopo il voto

**Steps:**
1. Completa il flusso di voting
2. Cerca `[data-section="success"]`
3. Cerca `h2:has-text("sei forte!")`

**Expected:** Entrambi visibili — conferma che il flusso si è concluso correttamente ✅

---

### TEST 5: Scroll Funziona su Mobile

**Obiettivo:** Verificare che lo scroll funzioni anche su viewport mobile

**Steps:**
1. Imposta viewport a 375×812 (iPhone/Pixel)
2. Completa il flusso di voting
3. Verifica `scrollHeight > clientHeight`

**Expected:** Scroll possibile anche su mobile ✅

---

### TEST 6: Snap su Mobile Funziona

**Obiettivo:** Verificare che lo snap sia attivo anche su mobile dopo il voto

**Steps:**
1. Imposta viewport a 375×812
2. Completa il flusso di voting
3. Verifica classe `snap-y snap-mandatory`

**Expected:** Snap attivo su mobile ✅

---

## Test Execution

### Run Singolo Test
```bash
npx playwright test tests/e2e/scroll-blocking.spec.ts -g "TEST 1"
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

Questi test fanno parte della suite E2E principale e vengono eseguiti automaticamente nel workflow CI (`.github/workflows/ci.yml`) dopo build e su tutti e 4 i progetti browser Playwright.

Poiché usano `test.describe.configure({ mode: 'serial' })`, vengono eseguiti in serie all'interno di ogni progetto, impedendo conflitti di stato tra test consecutivi dello stesso describe.

```bash
# Nella CI vengono eseguiti come parte di:
npm run test:e2e
```

## Acceptance Criteria

- [ ] TEST 1: Scroll dopo voto funziona (desktop)
- [ ] TEST 2: Snap attivo dopo voto (desktop)
- [ ] TEST 3: Overlay non bloccanti
- [ ] TEST 4: Success section visibile
- [ ] TEST 5: Scroll funziona su mobile
- [ ] TEST 6: Snap attivo su mobile
- [ ] Il flusso di voting (`completeVotingFlow`) è condiviso con `voting.helper.ts`

## Note

- Turnstile CAPTCHA è bypassato in test tramite `NEXT_PUBLIC_X7K2M9QS3P=hx7k2m9Qs3P` (dev bypass)
- I test usano `completeVotingFlow(page)` da `voting.helper.ts` — lo stesso helper usato da `voting-flow.spec.ts`
- Viewport testati: Desktop (1440×900, default Playwright), Mobile (375×812, `page.setViewportSize`)
- I test sono in modalità seriale (`serial`) — se TEST 1 fallisce, TEST 2-6 vengono saltati per quel progetto
- I dati di test sono seedati automaticamente da `global-setup.ts` via Supabase admin client (aziende: Test Co, GreenEnergy, Third Co, batch: TEST)