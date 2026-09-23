# Estrazione IP attendibile (P0-2)

Unica fonte server-side: `src/lib/request-ip.ts` → `getTrustedClientIp(request)`.
Nessun'altra parte dell'app legge header IP (guard: `tests/lib/request-ip-usage.test.ts`).

## Segnale rilevato vs IP trusted

`getTrustedClientIp` ritorna due valori distinti:

- `detectedIp`: il valore canonicalizzato **osservato** (osservabilità), anche se non attendibile.
- `ip`: l'**unico** valore usabile per decisioni di sicurezza, valorizzato solo con `confidence` `medium`/`high`.

Con `confidence` `low`/`none`, `ip` è `null` ma `detectedIp` può essere valorizzato.

## Modello di fiducia

| Evidenza | `source` | `confidence` | `ip` | `detectedIp` |
|---|---|---|---|---|
| `cf-connecting-ip` + `cf-ray` | `cf-connecting-ip` | `medium` | canonical | canonical |
| `cf-connecting-ip` senza `cf-ray` | `cf-connecting-ip` | `low` | `null` | canonical |
| `x-real-ip` (Vercel) | `x-real-ip` | `low` | `null` | canonical |
| `x-forwarded-for` (solo non-produzione) | `x-forwarded-for` | `low` | `null` | canonical |
| nessuna | `none` | `none` | `null` | `null` |

- **`cf-ray` è un'euristica, non una prova**: indica che la richiesta ha
  attraversato Cloudflare, ma non è una prova crittografica di provenienza.
  Per questo `cf-connecting-ip` + `cf-ray` è `medium`, mai `high`.
- `high` è riservato a una futura prova forte (es. header segreto iniettato da
  una Transform Rule Cloudflare e verificato server-side).
- **`x-forwarded-for` è client-controllabile**: in produzione è ignorato.
- Un IP mancante resta `null`: **mai** un valore condiviso (`0.0.0.0`).

## Canonicalizzazione

`canonicalizeIp()` valida con `node:net` e normalizza:
- IPv4 dotted-decimal; rimozione porta (`1.2.3.4:5678`).
- IPv6 lowercase + compressione del run di zeri più lungo (`2001:0DB8::0001` → `2001:db8::1`).
- IPv4-mapped → IPv4 (`::ffff:192.168.1.10` e `::ffff:c0a8:010a` → `192.168.1.10`).
- rimozione bracket (`[::1]:443`).
- **zone id IPv6 rifiutate** (`fe80::1%eth0` → `null`).

## Pseudonimizzazione

- **Nessun IP grezzo** viene aggiunto a log o persistenza.
- `hmacIp(ip)` usa HMAC-SHA256. Richiede **`SIGNAL_HMAC_KEY`** (base64, **≥32 byte
  decodificati**) e **`SIGNAL_HMAC_KEY_ID`** obbligatorio (rotazione versionata).
  Formato `k1.<hex>`. Se manca la chiave, il key ID o la chiave è troppo corta,
  ritorna `null` (fail-safe: nessun segnale invece di un hash non protetto).
- **Persistenza legacy (invariata in P0-2)**: `/api/vota` passa a
  `submit_vote` il valore `ipSignal.ip ?? 'unknown'`. La RPC salva
  `md5(ip_param)` in `vote_sessions.ip_hash`. Quindi:
  - con IP trusted → `md5(<ip trusted>)` (pseudonimo, non IP grezzo);
  - senza IP trusted → `md5('unknown')`, un **bucket condiviso**.
  La sostituzione con HMAC/segnali versionati è prevista in `submit_vote_v2` (P1/P0-4).

## Misura dell'assenza

`src/lib/ip-signal-metrics.ts`:
- emette un log strutturato **senza valori** a ogni segnale non attendibile:
  `[ip] no trusted client ip { source, confidence, hasDetectedIp }`;
- mantiene contatori in-memory che, in **serverless, sono per-istanza** e non
  aggregabili: la fonte di verità in produzione è il log (aggregabile dai log
  Vercel). `getIpSignalSnapshot()` serve solo a test/debug locale.

## Comportamento per ambiente

- **Produzione (Vercel dietro Cloudflare)**: `cf-connecting-ip` + `cf-ray` → `medium`.
- **Preview**: tipicamente `x-real-ip` (low) → segnale, nessun IP trusted.
- **Locale / E2E**: fallback `x-forwarded-for` (low) per non disabilitare i test;
  nessun IP trusted.
