# Runbook — attivazione `enforce` (P0-3)

> **Nessuna attivazione in questo documento.** Solo procedura.
> `VOTE_RATE_LIMIT_MODE=observe` e `voting_enabled=true` restano invariati fino
> ad autorizzazione separata.

## Campione minimo di osservazione (precondizione)

- Almeno **4 ore** di `observe` durante la fiera e **≥ 300** marker
  `vote_request_end` complessivi.
- Distribuzione su almeno **2 finestre di picco** (15–30 min).
- **`rateLimited429 = 0`** in observe sul percorso voto.
- `noTrustedIpPct` misurato e stabile (fonte/confidence note).
- Review manuale dei `wouldBlock` per scope.

Raccolta: `npm run monitor:votes` (o `vercel logs --json -n 1000 --level warning | node scripts/vote-monitor.mjs --stdin`).

## Soglie separate IP / identità (nessun /24)

| Ambito | Env | Default | Nota |
|---|---|---|---|
| Identità | `VOTE_RATE_ID_MAX` | 12 / 10 min | limite stretto per identità |
| IP | `VOTE_RATE_IP_MAX` | 60 / 10 min | limite largo per IP |
| Finestra | `VOTE_RATE_WINDOW_MS` | 10 min | |

- **Non** si usa il raggruppamento `/24`: aggregherebbe NAT/CGNAT grandi e
  produrrebbe falsi positivi.
- Se i dati mostrano che `VOTE_RATE_IP_MAX` colpisce reti condivise, si **alza**
  la soglia IP **prima** di attivare enforce.
- Regola Cloudflare `20 richieste/60s per IP`: **invariata**.

## Criterio di decisione

- I `wouldBlock` osservati stimano i blocchi futuri.
- Attivare `enforce` solo se i `wouldBlock` attesi corrispondono a pattern
  anomali (es. molte identità diverse dallo stesso IP in pochi minuti) e non a
  traffico legittimo dietro NAT.

## Attivazione

1. Impostare `VOTE_RATE_LIMIT_MODE=enforce` in Vercel **Production**.
2. Redeploy (un push su `master` o redeploy manuale).
3. Monitorare per 30–60 min: `429`, latenza, error rate, `wouldBlock`.
4. `voting_enabled` resta `true`.

## Rollback (non fail-open)

- Impostare `VOTE_RATE_LIMIT_MODE=observe` → redeploy.
- Il rollback **non** abilita voti extra: smette solo di bloccare.
- Nessuna cancellazione dati, nessuna modifica a `voting_enabled`.

## Alert

- Spike di `429`, error rate, p95 latenza `/api/vota`.
- Soglie e canali da concordare col proprietario.
