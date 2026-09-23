# Report — Voti anomali su REFIN e REFIN-DTS-CITY

**Data analisi:** 23 settembre 2026, ore 22:45 (Europe/Rome)
**Ambito:** produzione (`zdfverdwdsigizxktilz`), sola lettura
**Batch attivo:** `cersaie_14092026`
**Aziende:** REFIN `077d5326-a5db-4077-9f62-9d37c167e8a4`, REFIN-DTS-CITY `8841836f-ee25-48b4-88e6-baa9fe93ea7b`
**Inizio fiera (primo voto registrato):** 21 settembre 2026, ore 07:46 (Europe/Rome)

> I conteggi sono una fotografia: il totale voti è cresciuto durante l'analisi
> (1.618 → 1.619). I valori chiave restano stabili nelle proporzioni.

---

## 1. Sintesi

- **REFIN è 1ª in classifica** con **2.136 pallet** e **551 schede**; **REFIN-DTS-CITY è 4ª** con **878 pallet** e **442 schede**.
- Il **77,5% delle schede di REFIN** (427 su 551) presenta la **firma identica**:
  `REFIN 1ª scelta → REFIN-DTS-CITY 2ª scelta`. Persone diverse non scelgono tutte lo stesso identico ordine.
- Un **cluster di 13 indirizzi di rete** ha prodotto **213 schede** (38,7% di REFIN) **esclusivamente su REFIN**, di cui **187 con la coppia esatta**, **tutte il 23 settembre**, con **un'identità-dispositivo nuova a ogni scheda** e quasi sempre **un solo user-agent**.
- **Trend in forte crescita:** le schede di REFIN passano da 21 (21/09) a 87 (22/09) a **443 (23/09)**; la coppia esatta da 8 → 58 → **361**.
- **Meccanismo di aggiramento:** l'identità di voto è un UUID **fornito dal client** (cookie `fantacer_voter_id` oppure campo `voterId` nel payload, salvato come `v1:<uuid>`). Un programma può generare un'identità nuova a ogni richiesta, quindi il limite "un voto al giorno" **non scatta mai**.
- Il rate limit esiste (IP 60/10min, identità 12/10min) ma è in modalità **`observe`**: calcola e registra, **non blocca**.

---

## 2. Trend per giornata (schede che coinvolgono l'azienda)

| Giorno | REFIN | REFIN-DTS-CITY | Coppia esatta `REFIN → DTS` |
|---|---:|---:|---:|
| 21/09 | 21 | 11 | 8 |
| 22/09 | 87 | 60 | 58 |
| 23/09 | 443 | 370 | 361 |
| **Totale** | **551** | **442** | **427** |

La coppia esatta cresce in modo quasi proporzionale al totale: la firma anomala
è ormai la modalità dominante del voto per REFIN, non un caso sporadico.

---

## 3. Cluster di indirizzi dedicati (prova principale)

Filtro: indirizzi con **≥ 3 voti**, **≥ 80% su REFIN**, **nessun'altra azienda in 1ª scelta** oltre alla coppia.

| Indirizzo (hash, troncato) | Schede | su REFIN | coppia esatta | identità distinte | user-agent | giorno | intervallo mediano |
|---|---:|---:|---:|---:|---:|---|---:|
| `58f7da636b35…` | 40 | 40 | 40 | 40 | 1 | 23/09 | 44 s |
| `14edd9b12397…` | 38 | 37 | 34 | 38 | 1 | 23/09 | 75 s |
| `cce864b21671…` | 37 | 37 | 18 | 37 | 4 | 23/09 | 121 s |
| `15879e85e060…` | 22 | 22 | 22 | 22 | 1 | 23/09 | 72 s |
| `aefc7bea9fe7…` | 20 | 20 | 20 | 20 | 1 | 23/09 | 49 s |
| `94381bc988da…` | 17 | 17 | 17 | 17 | 1 | 23/09 | 58 s |
| `7534d36ca7eb…` | 9 | 9 | 6 | 9 | 4 | 23/09 | 142 s |
| `75225f8cb9d2…` | 9 | 9 | 9 | 9 | 1 | 23/09 | 53 s |
| altri 5 indirizzi | 21 | 21 | 21 | 21 | 2 | 23/09 | — |
| **Totale cluster** | **213** | **212** | **187** | **213** | — | — | — |

**Perché è inequivocabile**

1. **Un'identità nuova per ogni voto.** 213 schede → 213 identità distinte, ma solo 13 indirizzi. Nessun dispositivo fisico genera centinaia di identità in un giorno: è una nuova identità creata a comando per ogni richiesta.
2. **Sempre la stessa scheda.** 187 su 213 sono esattamente `REFIN 1ª → REFIN-DTS-CITY 2ª`.
3. **Nessun'altra azienda.** Questi indirizzi non hanno **mai** votato un'azienda diversa da REFIN/DTS: un visitatore reale vota 3 aziende diverse, non sempre le stesse due.
4. **Ritmo da macchina.** Intervalli mediani di 44–142 secondi, con minimi di **8 millisecondi** (due schede consecutive). Il voto umano non ha questa cadenza.
5. **User-agent quasi sempre unico.** 1 solo user-agent per indirizzo in 6 indirizzi su 13: i device reali mostrano varietà.

---

## 4. Controprova: gli indirizzi del Wi-Fi fiera

Gli indirizzi "grandi" legittimi mostrano un comportamento opposto: molti voti
ma distribuiti su **decine di aziende diverse**.

| Indirizzo | Schede | su REFIN | aziende diverse votate |
|---|---:|---:|---:|
| `97f1e5f44e1c…` | 221 | 59 | 33 |
| `91143dcd0767…` | 187 | 46 | 31 |
| `91fd897088ae…` | 183 | 49 | 35 |
| `e1039bc2e4e8…` | 86 | 26 | 21 |

Questi sono coerenti con un Wi-Fi condiviso (NAT): tante persone reali, tante
aziende diverse. Il cluster della sezione 3, al contrario, **vota solo REFIN**.
La concentrazione su un singolo indirizzo **non** è di per sé prova; lo diventa
quando l'indirizzo vota **solo quella coppia**, come nel cluster dedicato.

---

## 5. Meccanismo tecnico (root cause)

- `vote_sessions.fingerprint` contiene `v1:<uuid>` generato dal client:
  il cookie è **leggibile/scrivibile dal client** (`httpOnly: false`) e il
  payload accetta un `voterId` di fallback (`src/lib/vote-identity-server.ts`).
- Un programma può quindi **inventare un UUID nuovo per ogni voto**: la dedup
  giornaliera `(fingerprint, vote_day)` non trova mai un duplicato.
- 1.242 schede su 1.619 totali sono `v1:uuid`; **213 su 213** del cluster
  dedicato sono `v1:uuid`.
- Il rate limit (`src/lib/vote-rate-limit.ts`) è in modalità **`observe`**:
  `VOTE_RATE_LIMIT_MODE` non è `enforce`, quindi nessun 429 viene restituito.
- Turnstile è richiesto ma il cluster mostra user-agent e identità coerenti con
  un browser reale/automazione che lo risolve: non è una difesa sufficiente da sola.

---

## 6. Impatto stimato sulla classifica

| Voce | Valore |
|---|---:|
| REFIN — pallet attuali | 2.136 |
| di cui da cluster dedicato | 852 |
| REFIN — pallet al netto del cluster | **~1.284** |
| Coppia esatta `REFIN → DTS` — pallet per REFIN | 1.708 |
| REFIN-DTS-CITY — pallet attuali | 878 |

La rimozione del solo cluster automatico riporta REFIN da 2.136 a circa 1.284
pallet (−40%). La coppia esatta è però diffusa anche fuori dal cluster (1.708
pallet): indica una campagna coordinata più ampia, oltre all'automazione pura.

---

## 7. Raccomandazioni

1. **Intervento immediato:** escludere REFIN e REFIN-DTS-CITY dalla classifica e
   bloccare il voto sulle due aziende nel batch attivo (feature Admin in corso).
2. **Correzione punteggio:** impostare il valore ritenuto corretto al netto dei
   voti fraudolenti.
3. **Hardening (follow-up):** identità di voto lato server (non fornita dal
   client) e passaggio del rate limit a `enforce` (vedi
   `docs/vote-rate-limit-enforce-runbook.md`).

---

## 8. Intervento realizzato — Gestione aziende (Admin)

Implementata la sezione **Impostazioni → Gestione aziende** per agire sulle
aziende senza script manuali.

**Azioni disponibili** (multi-selezione aziende, batch attivo):

- **Cancella voti** — elimina le schede che toccano le aziende (backup in DB),
  ricalcola `company_totals` e `daily_stats`.
- **Escludi e blocca** — l'azienda sparisce da classifica, ricerca e voto.
- **Sblocca / ripristina** — con scelta: mantieni voti attuali · riparti da 0 ·
  riparti da N.
- **Imposta / rimuovi punteggio manuale** — base voti/pallet a N (formula
  `base + delta live`, così i voti successivi si sommano).

**Sicurezze:**

- **Anteprima obbligatoria** prima di ogni conferma: classifica *prima → dopo*
  e schede coinvolte, calcolata lato server senza scrivere.
- **Backup automatico dello stato** prima di ogni azione + pulsante **Backup
  situazione** manuale (`admin_state_backups`); le schede cancellate sono
  salvate in `admin_vote_backups`.
- Audit log `admin_company_action`; ruolo `viewer` in sola lettura.

**Database (migrazione `20260923000001_company_admin_controls.sql`, applicata):**

- `companies.blocked`; `company_score_overrides`; `admin_vote_backups`;
  `admin_state_backups`.
- `get_company_ranking` esclude le bloccate e applica l'override;
  `submit_vote` rifiuta le aziende bloccate.
- RPC: `admin_delete_company_votes`, `admin_set_company_blocked`,
  `admin_set_company_score`, `admin_clear_company_score`,
  `admin_backup_company_state`.

Applicata a **e2e** e **produzione** il 23/09/2026. Il backend è attivo subito;
l'interfaccia Admin richiede il deploy del frontend.

