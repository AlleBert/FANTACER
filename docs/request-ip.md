# Estrazione IP attendibile (P0-2)

Unica fonte server-side: `src/lib/request-ip.ts` → `getTrustedClientIp(request)`.
Nessun'altra parte dell'app legge header IP (guard: `tests/lib/request-ip-usage.test.ts`).

## Modello di fiducia

| Evidenza | `source` | `confidence` | `ip` |
|---|---|---|---|
| `cf-connecting-ip` + `cf-ray` | `cf-connecting-ip` | `medium` | canonical |
| `cf-connecting-ip` senza `cf-ray` | `cf-connecting-ip` | `low` | `null` |
| `x-real-ip` (Vercel, diretto/preview) | `x-real-ip` | `low` | canonical |
| `x-forwarded-for` (solo non-produzione) | `x-forwarded-for` | `low` | canonical |
| nessuna | `none` | `none` | `null` |

- `cf-ray` è la prova di provenienza Cloudflare disponibile: Cloudflare
  sovrascrive `cf-connecting-ip` e `cf-ray`, quindi il client non può forgiarli.
  Per questo `cf-connecting-ip` è **medium**, non `high`.
- **`x-forwarded-for` è client-controllabile**: in produzione è ignorato.
  Usato solo in locale/development per esercitare il rate limit per-IP.
- Un IP **mancante restituisce `null`**, mai un valore condiviso (`0.0.0.0`).
- `high` è riservato a una futura prova forte di provenienza (es. header segreto
  iniettato da una Transform Rule Cloudflare e verificato server-side).

## Canonicalizzazione

`canonicalizeIp()` valida con `node:net` e normalizza:
- IPv4 dotted-decimal; rimozione porta (`1.2.3.4:5678`).
- IPv6 lowercase + compressione del run di zeri più lungo (`2001:0DB8::0001` → `2001:db8::1`).
- IPv4-mapped → IPv4 (`::ffff:192.168.1.10` e `::ffff:c0a8:010a` → `192.168.1.10`).
- rimozione bracket (`[::1]:443`) e zone id (`fe80::1%eth0`).

## Pseudonimizzazione

- **Nessun IP grezzo** viene aggiunto a log o persistenza.
- `hmacIp(ip)` usa HMAC-SHA256 con `SIGNAL_HMAC_KEY` (base64) e `SIGNAL_HMAC_KEY_ID`
  (default `k1`); formato `k1.<hex>`. Se la chiave manca ritorna `null` (fail-safe).
- La persistenza legacy (`submit_vote` → `md5(ip)`) resta invariata in P0-2;
  la sostituzione con HMAC è prevista in `submit_vote_v2` (P1/P0-4).

## Misura dell'assenza

`src/lib/ip-signal-metrics.ts` conta `total`, `noTrustedIp`, `byConfidence` ed
emette un log strutturato **senza valori**:

```
[ip] no trusted client ip { source, confidence }
```

Misurabile dai log Vercel. Serve a capire quanto spesso, in produzione, la
catena Cloudflare non fornisce un segnale attendibile.

## Comportamento per ambiente

- **Produzione (Vercel dietro Cloudflare)**: `cf-connecting-ip` + `cf-ray` → medium.
- **Preview**: normalmente `x-real-ip` (low) → il rate limit per-IP resta attivo ma non attendibile.
- **Locale / E2E**: nessun header Cloudflare → fallback `x-forwarded-for` (low) per non disabilitare i test.
