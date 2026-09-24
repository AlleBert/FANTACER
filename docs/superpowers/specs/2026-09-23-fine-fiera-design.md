# FINE FIERA — Design

**Data:** 23 settembre 2026

## Obiettivo
Toggle "FINE FIERA" in Impostazioni che disabilita il voto (anche server-side) e
mostra nella sezione voto una card in due fasi:
- **Fase A (attesa)**: "LE VOTAZIONI SONO CONCLUSE" + countdown al reveal.
- **Fase B (finale)**: classifica finale 1°/2°/3° (nome + punti + orario premiazione) + ringraziamento.

## Decisioni
- Controllo: **toggle + orario configurabile** (`revealTime`, default 12:30). Interpretato "oggi a Roma"; al salvataggio si persiste `revealAt` assoluto (ISO).
- Countdown a **durata piena** (es. reveal tra 10h → `10:00:00`), non limitato a 24h; allo zero switch automatico a fase B.
- Orari premiazione **personalizzabili** (1°/2°/3°), default 14:00 / 13:45 / 13:30.
- **Classifica nascosta in fase A**, visibile in fase B.
- **Flag separato** `fair_end_enabled` + config, con **blocco server-side** del voto (indipendente da `voting_enabled`).
- FINE FIERA ha **precedenza** sulle card antibot/pre-fiera.
- Stile: **ibrido sobrio** (countdown in A, podio sobrio in B, niente coriandoli).

## Dati
`site_settings`:
- `fair_end_enabled` = `'true' | 'false'`
- `fair_end_config` = JSON `{ revealTime, revealAt, ceremony: { "1","2","3" } }`

## Architettura
- Logica pura `src/lib/fair-end.ts` (parse/validazione/`resolveRevealAt`/`computeFairEndPhase`).
- Stato client in `RealtimeContext` (bootstrap `/api/public/flag/fair-end` + realtime `site_settings`).
- Gate server in `/api/vota` (`getFairEndState()`).
- Card `fair-end-card.tsx`; fase derivata da `useFairEndPhase()` (tick 1s).
- Classifica: `get_company_ranking` (effettiva), top 3.

## Fuori scope
- Nessuna nuova tabella; nessun coriandolo/animazione pesante.
