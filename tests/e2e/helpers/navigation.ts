import { type Page } from '@playwright/test';

/**
 * Fail-fast sulle navigazioni.
 *
 * Con un server dev appeso (porta occupata da un processo morto, o Next in
 * ricompilazione infinita) `page.goto` andrebbe in `ERR_ABORTED` e il test
 * resterebbe bloccato fino al timeout del test (anche 120-300s). Impostando un
 * timeout di navigazione esplicito (~20s) il test fallisce subito con un
 * messaggio chiaro. Usato da tutti gli spec di audit.
 */
export function setNavigationFailFast(page: Page, navigationTimeoutMs = 20000): void {
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
}
