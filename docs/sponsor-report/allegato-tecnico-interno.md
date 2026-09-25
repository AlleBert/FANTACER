# FantaCer — Allegato tecnico interno (verifica dati report sponsor)

**Edizione di riferimento:** Cersaie 2026 — batch `cersaie_14092026`
**Periodo fiera:** 21–25 settembre 2026
**Confronto pre-fiera:** 7–20 settembre 2026 (dove disponibile)
**Data di estrazione:** 25/09/2026
**Modalità:** sola lettura (nessuna scrittura su DB/infrastruttura)
**Fonti:** database Supabase prod (voti), Vercel Web Analytics (traffico), Cloudflare (richieste edge), Google Analytics 4 (sessioni/canali) — tutte ora accessibili

---

## 1. Disponibilità delle fonti (stato verificato il 25/09/2026)

| Fonte | Stato | Dettaglio |
|---|---|---|
| **Database progetto** | ✅ Disponibile | Supabase prod `zdfverdwdsigizxktilz`, tabelle `vote_sessions`, `companies`, `company_totals` |
| **Vercel Web Analytics** | ✅ Disponibile | Progetto `fantacer` (`prj_ZKNB1JJQhGQjAIhRqIMuNGTzjq32`), account `allebert`. `GET /v1/query/web-analytics/visits/{aggregate,count}`. Copre la **sola produzione** (`www.fantacer.com`) |
| **Google Analytics 4** | ✅ Disponibile dal 25/09 | Property `277701335` (`G-P6FGPEEJRH`), service account `opencode@fantacer-analytics.iam.gserviceaccount.com` ora **Viewer**. `runReport` → **200** |
| **Cloudflare** | ✅ Disponibile dal 25/09 | Zona `fantacer.com` (`f0869f2c56bd8b72332d08780bdd4831`). GraphQL `httpRequests1dGroups` → **OK**. `tokens/verify` resta 401 (manca `User API Tokens: Read`) ma è **irrilevante**: i dati zona si leggono |

**Nessun dato inventato o stimato.** Tutti i numeri provengono da una delle fonti sopra, con periodo e metodo dichiarati.

---

## 2. Le tre fonti web misurano lo stesso periodo con numeri diversi

| Grandezza 21–25/09 | Vercel | Cloudflare | GA4 |
|---|---|---|---|
| Visitatori / unici / utenti | **4.756** | **7.930** (unici per IP) | **2.266** (utenti) |
| Pageview | **8.408** | **10.549** (pageViews edge) | **5.112** (screenPageViews) |
| Richieste HTTP | — | **347.728** | — |
| Sessioni | — | — | **3.571** |

**Perché differiscono (spiegazione da tenere presente, non da sommare):**
- **Cloudflare** conta a livello edge: include asset (JS/CSS/immagini), prefetch, richieste bot e cache. "Unici" è per IP, quindi sovrastima le persone (un IP = più device/persone dietro NAT).
- **GA4** filtra per consent/cookie e misura "utenti" come client browser, non IP. Numero più conservativo.
- **Vercel** è cookieless, solo produzione, modello a "visitor" deduplicato: valore intermedio e difendibile.
- **Non si sommano** mai tra loro: misurano la stessa attività in modi diversi.

---

## 3. KPI riportati nel documento commerciale (fonte scelta e motivazione)

### 3a. Voti (fonte: database FantaCer — dato nativo, non confrontabile con web)

| KPI | Valore | Periodo | Metodo | Nel report |
|---|---|---|---|---|
| Voti registrati | **2.982** | 21–25/09 | `count(*)` `vote_sessions` | Sì |
| Votanti unici | **2.324** | 21–25/09 | `count(distinct fingerprint)` | Sì |
| Aziende in gara | **312** | edizione | `count(*)` `companies` batch | Sì |
| Aziende votate | **244** (78%) | 21–25/09 | aziende con ≥1 voto | Sì |
| Top azienda | Ceramiche Mariner **1.107** voti | 21–25/09 | somma podi | Sì |

### 3b. Traffico web — fonte scelta per KPI

| KPI nel report | Valore | Fonte scelta | Perché questa fonte | Alternative disponibili |
|---|---|---|---|---|
| Richieste al sito | **347.728** | **Cloudflare** | È l'unica fonte che misura le richieste edge: numero grande e reale, perfetto per il KPI "portata" | Vercel/GA non espongono le richieste |
| Richieste nel picco (23/09) | **117.365** | **Cloudflare** | Idem; evidenzia il picco reale | — |
| Visitatori web | **4.756** | **Vercel** | Unità "persona distinta" cookieless, la più difendibile davanti a uno sponsor | Cloudflare 7.930 (per IP, sovrastima), GA4 2.266 (utenti) |
| Visualizzazioni pagina | **8.408** | **Vercel** | Coerente con la fonte "visitatori" scelta: stesso sistema, nessun mescolamento | Cloudflare 10.549, GA4 5.112 |
| Picco visitatori | **1.430** (23/09) | **Vercel** | Coerente con la serie visitatori | — |
| Paesi | **19** | **Vercel** | Fonte della serie visitatori | GA4 11+, CF non usato |
| Quota mobile | **82%** (3.845) | **Vercel** | Fonte della serie visitatori | GA4 88% sessioni mobile |
| Canali (diretto/social/ricerca) | **3.571 sessioni** | **GA4** | È l'unica fonte con la dimensione "canale di acquisizione" | — |
| Device OS (iOS/Android) | **2.505 / 1.352** | **Vercel** | Coerente con device Vercel | — |

> **Regola anti-doppio-conteggio:** per ogni KPI si usa **una sola** fonte. Visitatori e pageview sono entrambi Vercel (stesso sistema). Le richieste HTTP sono Cloudflare (grandezza diversa, dichiarata come "richieste", non visite). I canali sono GA4 (unica fonte della dimensione).

### 3c. Andamento giornaliero (fonte per colonna dichiarata)

| Giorno | Voti (DB) | Visitatori (Vercel) | Pageview (Vercel) | Richieste (Cloudflare) |
|---|---|---|---|---|
| Lun 21/09 | 140 | 177 | 221 | 25.760 |
| Mar 22/09 | 405 | 1.100 | 1.954 | 65.593 |
| Mer 23/09 | 1.084 | 1.430 | 2.920 | 117.365 |
| Gio 24/09 | 919 | 1.394 | 2.248 | 95.127 |
| Ven 25/09 | 434 | 655 | 1.065 | 43.883 |
| **Totale** | **2.982** | **4.756** | **8.408** | **347.728** |

### 3d. Confronto pre-fiera vs fiera (richieste Cloudflare)

| Periodo | Richieste | Pageview |
|---|---|---|
| 7–20/09 (pre-fiera, 14gg) | 55.927 | 3.958 |
| 21–25/09 (fiera, 5gg) | **347.728** | 10.549 |
| Giorno campione pre-fiera (7/09) | 4.088 | 286 |
| Giorno di picco (23/09) | **117.365** | 3.245 |

**Crescita richieste giorno-picco vs giorno-pre:** `117.365 / 4.088 − 1 ≈ +2.771%` (arrotondato a **+2.800%** nel report). Anche GA4 conferma: pre-fiera 7–20/09 max 17 utenti/giorno, contro 751 nella fiera.

> Il report usa il **campione del 7/09** per il confronto visivo (giorno tipo pre-fiera). Il valore "+2.800%" è calcolato esattamente e arrotondato per eccesso al centinaio: **non è un dato gonfiato, è un arrotondamento dichiarato**.

---

## 4. Stato della manifestazione al 25/09/2026 (`site_settings`)

| Chiave | Valore | Significato |
|---|---|---|
| `fair_end_enabled` | `true` | FINE FIERA attiva |
| `fair_end_config` | revealTime `12:30`, revealAt `2026-09-25T10:30:00Z` | Cerimonia: 1ª `14:00`, 2ª `13:45`, 3ª `13:30` |
| `voting_enabled` | `false` | Voto disattivato |
| `batch_settings.active_batch` | `cersaie_14092026` (dal 14/09) | Batch in gara |

---

## 5. Limiti e cautele

1. **Grandezze non sommabili**: richieste HTTP (Cloudflare) ≠ visualizzazioni pagina ≠ visitatori ≠ voti. Sempre distinte nel report.
2. **Cloudflare `unici` per IP** non è "persone": può contare più volte lo stesso utente su reti diverse. Per questo il KPI "visitatori" usa Vercel, non Cloudflare.
3. **Cloudflare `pageViews`** è calcolato lato edge e include richieste non-HTML: non coincide con le pageview GA/Vercel. Nel report non si usa come "pagina vista".
4. **Vercel copre solo produzione** (`www.fantacer.com`), esclude preview e altri domini.
5. **GA4 filtra per consent**: i suoi numeri sono i più bassi; usato solo per la dimensione canale.
6. **Nessun dato demografico** (età/sesso/professione): non raccolto, non presente.
7. **Nessuna stima di ROI o pubblico fisico**: non misurabile con le fonti disponibili.
8. **PII esclusa**: nessun fingerprint, IP o dato personale nei documenti per terzi.
9. **Fuso orario**: voti in Europe/Rome; serie web Vercel/Cloudflare in UTC (differenza trascurabile a livello giornaliero, rilevante solo sui bordi di giornata).
10. **Categorie aziende**: campo `category` vuoto nel batch; i settori citati sono contesto della manifestazione, non dato per azienda.

---

## 6. Comandi di riproducibilità (read-only)

**Database** (PostgREST, `SUPABASE_SERVICE_ROLE_KEY` da `.env`):
- `GET /rest/v1/vote_sessions?select=created_at,fingerprint,country,user_agent,company1_id,company2_id,company3_id`
- `GET /rest/v1/companies?select=id,name,category,batch&batch=eq.cersaie_14092026`

**Vercel** (token da `~/.local/share/com.vercel.cli/auth.json`):
- `GET /v1/query/web-analytics/visits/count?projectId=prj_ZKNB1JJQhGQjAIhRqIMuNGTzjq32&since=2026-09-21&until=2026-09-25`
- `GET /v1/query/web-analytics/visits/aggregate?...&by=day|country|deviceType|referrerHostname|osName`

**Cloudflare** (GraphQL, `CLOUDFLARE_API_TOKEN` da `.env.local`):
- `POST /client/v4/graphql` → `httpRequests1dGroups(filter:{date_geq,date_leq}){sum{requests pageViews threats bytes} uniq{uniques}}`

**GA4** (OAuth JWT con `GA_PRIVATE_KEY`/`GA_SERVICE_ACCOUNT_EMAIL` da `.env`):
- `POST /v1beta/properties/277701335:runReport` con `metrics: activeUsers, sessions, screenPageViews` e `dimensions: sessionDefaultChannelGroup, deviceCategory, country`

Nessuna scrittura, nessuna migration, nessuna modifica a configurazioni.
