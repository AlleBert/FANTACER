# P0-3 — Rate limit del percorso voto

Modulo: `src/lib/vote-rate-limit.ts`. Valuta due ambiti per ogni richiesta:
- **IP**: solo se esiste un IP trusted (P0-2), pseudonimizzato via HMAC (`hmacIp`).
  Chiave `vote:ip:<key_id>.<hex>`. Nessun IP grezzo.
- **Identità**: chiave `vote:id:v1:<uuid>` (fingerprint corrente).

Riusa il rate limiter DB-backed esistente (`check_rate_limit`).

## Modalità

| `VOTE_RATE_LIMIT_MODE` | Comportamento |
|---|---|
| `observe` (default) | Calcola e **registra** la decisione, **non blocca** (nessuna modifica per l'utente). |
| `enforce` | Applica il blocco: `429` + header `Retry-After`. |

Il deploy iniziale durante la fiera deve restare in **`observe`** per misurare i
falsi positivi su reti mobili/CGNAT. L'attivazione di `enforce` richiede:
verifica dei dati osservati + autorizzazione separata.

## Configurazione

| Env | Default | Note |
|---|---|---|
| `VOTE_RATE_LIMIT_MODE` | `observe` | `enforce` per bloccare. |
| `VOTE_RATE_WINDOW_MS` | `600000` (10 min) | Finestra. |
| `VOTE_RATE_IP_MAX` | `60` | Richieste per IP trusted nella finestra. |
| `VOTE_RATE_ID_MAX` | `12` | Richieste per identità nella finestra. |

`Retry-After` = durata della finestra (limite superiore del fixed window).

## Telemetria

A ogni decisione di blocco potenziale (in entrambe le modalità) viene emesso un
log **senza valori sensibili**:

```
[vote-rate] would-block { mode, scopes: [{ scope, allowed }] }
```

## Regola Cloudflare

Non modificare la regola edge attuale (`20 richieste / 60s per IP`): durante la
fiera un limite più basso bloccherebbe partecipanti dietro NAT condivisi.

## Non fail-open

`enforce` blocca su decisione negativa. Un errore infrastrutturale del limiter
ricade nel comportamento di `checkRateLimit` (fail-open su errore infra, mai su
limite raggiunto): la modalità `observe` è la rete di sicurezza durante l'evento.
