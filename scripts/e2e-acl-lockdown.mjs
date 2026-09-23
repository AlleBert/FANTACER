#!/usr/bin/env node
/**
 * Verifica di contenimento ACL/policy su `fantacer-e2e`.
 *
 * Guardia fail-fast: legge la connessione da `loadE2eDbUrl()` (che rifiuta
 * qualunque host diverso da fantacer-e2e) e verifica l'host Supabase.
 *
 * Non gira mai contro produzione. Le uniche scritture sono:
 *  - un voto di prova via service_role (fingerprint `e2e-acl-probe-*`);
 *  - una tabella temporanea `public.__acl_probe_e2e` (creata e rimossa);
 * entrambe ripulite a fine corsa.
 */

import { parse } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { loadE2eDbUrl, E2E_HOST } from './loadtest/lib.mjs';

function readEnv(path) {
  if (!existsSync(path)) throw new Error(`File env mancante: ${path}`);
  return parse(readFileSync(path, 'utf8'));
}

const e2e = readEnv('.env.e2e');
const supaUrl = e2e.NEXT_PUBLIC_SUPABASE_URL;
if (new URL(supaUrl).hostname !== E2E_HOST) {
  throw new Error(`Guard: host ${new URL(supaUrl).hostname} != ${E2E_HOST}`);
}
const anonKey = e2e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svcKey = e2e.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = loadE2eDbUrl();
const MIGRATION = 'supabase/migrations/20260923000000_emergency_acl_lockdown.sql';
const RESIDUAL_MIGRATION = 'supabase/migrations/20260923000002_residual_table_privileges.sql';

const results = [];
const ok = (id, name, detail = '') => results.push({ id, name, esito: 'PASS', detail });
const ko = (id, name, detail = '') => results.push({ id, name, esito: 'FAIL', detail });
const skip = (id, name, detail = '') => results.push({ id, name, esito: 'SKIP', detail });

const db = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
const anon = createClient(supaUrl, anonKey, { auth: { persistSession: false } });
const svc = createClient(supaUrl, svcKey, { auth: { persistSession: false } });

async function main() {
  await db.connect();
  console.log('E2E host:', E2E_HOST);

  let companies = (await db.query('select id from public.companies limit 3')).rows.map((r) => r.id);
  let tempCompanies = false;
  if (companies.length < 3) {
    const ins = await db.query(
      "insert into public.companies (name, batch) values ('e2e-acl-probe-a','ACL-PROBE'),('e2e-acl-probe-b','ACL-PROBE'),('e2e-acl-probe-c','ACL-PROBE') returning id",
    );
    companies = ins.rows.map((r) => r.id);
    tempCompanies = true;
  }
  const [c1, c2, c3] = companies;
  const probeFp = `e2e-acl-probe-${Date.now()}`;

  // --- T1: anon non puo' chiamare NESSUN overload di submit_vote
  const overloads = [
    { company_id_param: c1, fingerprint_param: probeFp, ip_param: '1.1.1.1', user_agent_param: 't', country_param: 'IT' },
    { fingerprint_param: probeFp, ip_param: '1.1.1.1', user_agent_param: 't', country_param: 'IT', company1_id_param: c1, company2_id_param: c2, company3_id_param: c3 },
    { fingerprint_param: probeFp, ip_param: '1.1.1.1', user_agent_param: 't', country_param: 'IT', company1_id_param: c1, company2_id_param: c2, company3_id_param: c3, botd_param: '' },
    { company_id_param: c1, fingerprint_param: probeFp, ip_param: '1.1.1.1', user_agent_param: 't', country_param: 'IT', comment_param: '', adjective_param: '', slider_innovation_param: 1, slider_sales_param: 1, slider_wow_param: 1 },
  ];
  let t1ok = true;
  for (const args of overloads) {
    const r = await anon.rpc('submit_vote', args);
    const blocked = r.error != null && r.data == null;
    if (!blocked) { t1ok = false; ko('T1', 'anon submit_vote overload', JSON.stringify({ args: Object.keys(args).length, error: r.error?.message })); }
  }
  if (t1ok) ok('T1', 'anon non chiama nessun overload submit_vote (4/4 bloccati)');

  // --- T2: authenticated non puo' chiamare submit_vote
  try {
    const authClient = createClient(supaUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: e2e.E2E_ADMIN_EMAIL,
      password: e2e.E2E_ADMIN_PASSWORD,
    });
    if (error || !data?.session) {
      skip('T2', 'authenticated submit_vote', `sign-in non disponibile: ${error?.message ?? 'no session'}`);
    } else {
      const r = await authClient.rpc('submit_vote', {
        fingerprint_param: probeFp, ip_param: '1.1.1.1', user_agent_param: 't', country_param: 'IT',
        company1_id_param: c1, company2_id_param: c2, company3_id_param: c3, botd_param: '',
      });
      if (r.error != null && r.data == null) ok('T2', 'authenticated submit_vote bloccato');
      else ko('T2', 'authenticated submit_vote', r.error?.message ?? 'non bloccato');
    }
  } catch (e) {
    skip('T2', 'authenticated submit_vote', e.message);
  }

  // --- T3: anon non puo' chiamare check_rate_limit / check_can_vote / increment_vote
  const t3 = {
    check_rate_limit: await anon.rpc('check_rate_limit', { ip_param: probeFp, window_ms: 1000, max_requests: 1 }),
    check_can_vote: await anon.rpc('check_can_vote', { fingerprint_param: probeFp }),
    increment_vote: await anon.rpc('increment_vote', { company_id_param: c1, date_param: '2026-01-01' }),
  };
  const t3fail = Object.entries(t3).filter(([, r]) => !(r.error != null && r.data == null)).map(([k]) => k);
  if (t3fail.length === 0) ok('T3', 'anon bloccato su check_rate_limit/check_can_vote/increment_vote');
  else ko('T3', 'anon RPC legacy', 'non bloccate: ' + t3fail.join(', '));

  // --- T13 setup: trigger accounting prima del voto service_role
  const tickBefore = Number((await db.query('select version from public.ranking_tick where id=1')).rows[0].version);
  const ctBefore = await db.query('select coalesce(total_pallets,0) tp, coalesce(vote_count,0) vc from public.company_totals where company_id=$1', [c1]);
  const ctBeforeTp = ctBefore.rows[0] ? Number(ctBefore.rows[0].tp) : null;
  const ctBeforeVc = ctBefore.rows[0] ? Number(ctBefore.rows[0].vc) : null;

  // --- T4: service_role continua a votare (percorso API server-side)
  const voteRes = await svc.rpc('submit_vote', {
    fingerprint_param: probeFp, ip_param: '1.1.1.1', user_agent_param: 'e2e-harness', country_param: 'IT',
    company1_id_param: c1, company2_id_param: c2, company3_id_param: c3, botd_param: '',
  });
  const voteOk = !voteRes.error && voteRes.data?.success === true;
  if (voteOk) ok('T4', 'service_role submit_vote riuscito (percorso API)');
  else ko('T4', 'service_role submit_vote', voteRes.error?.message ?? JSON.stringify(voteRes.data));

  // --- T13: trigger vivo
  const tickAfter = Number((await db.query('select version from public.ranking_tick where id=1')).rows[0].version);
  const ctAfter = await db.query('select coalesce(total_pallets,0) tp, coalesce(vote_count,0) vc from public.company_totals where company_id=$1', [c1]);
  const ctAfterTp = ctAfter.rows[0] ? Number(ctAfter.rows[0].tp) : null;
  const ctAfterVc = ctAfter.rows[0] ? Number(ctAfter.rows[0].vc) : null;
  if (voteOk && tickAfter > tickBefore && (ctAfterVc ?? 0) > (ctBeforeVc ?? 0)) ok('T13', `trigger vivo (ranking_tick ${tickBefore}->${tickAfter}, company_totals +1)`);
  else ko('T13', 'trigger', `tick ${tickBefore}->${tickAfter} ct_vc ${ctBeforeVc}->${ctAfterVc}`);

  // --- T5: anon non inserisce in votes
  const t5 = await anon.from('votes').insert({ company_id: c1, fingerprint: probeFp });
  if (t5.error) ok('T5', 'anon insert votes bloccato'); else ko('T5', 'anon insert votes non bloccato');
  // --- T6: anon non altera daily_stats
  const t6a = await anon.from('daily_stats').insert({ company_id: c1, date: '2026-01-01', vote_count: 1 });
  const t6b = await anon.from('daily_stats').update({ vote_count: 999 }).eq('company_id', c1);
  if (t6a.error && t6b.error) ok('T6', 'anon insert/update daily_stats bloccato'); else ko('T6', 'daily_stats', 'insert/update non entrambi bloccati');
  // --- T7: settings (assente su E2E)
  const hasSettings = (await db.query("select to_regclass('public.settings') is not null as x")).rows[0].x;
  if (!hasSettings) skip('T7', 'settings', 'tabella assente su E2E (presente in produzione: policy rimossa dalla migration)');
  else {
    const t7 = await anon.from('settings').select('*').limit(1);
    if (t7.error) ok('T7', 'anon settings bloccato'); else ko('T7', 'settings non bloccato');
  }
  // --- T8: anon non legge/modifica device_sessions
  const t8a = await anon.from('device_sessions').select('fingerprint').limit(1);
  const t8b = await anon.from('device_sessions').insert({ fingerprint: probeFp });
  if (t8a.error && t8b.error) ok('T8', 'anon device_sessions bloccato (select+insert)'); else ko('T8', 'device_sessions', 'select/insert non entrambi bloccati');

  // --- T9: letture pubbliche necessarie
  const pub = {
    companies: await anon.from('companies').select('id').limit(1),
    site_settings: await anon.from('site_settings').select('key').limit(1),
    ranking_tick: await anon.from('ranking_tick').select('version').limit(1),
    sponsors: await anon.from('sponsors').select('id').limit(1),
  };
  const pubFail = Object.entries(pub).filter(([, r]) => r.error != null).map(([k]) => k);
  if (pubFail.length === 0) ok('T9', 'letture pubbliche (companies, site_settings, ranking_tick, sponsors) OK');
  else ko('T9', 'letture pubbliche', 'fallite: ' + pubFail.join(', '));

  // --- T10: classifica pubblica (percorso API = service_role); anon diretto negato
  const r10svc = await svc.rpc('get_company_ranking', { limit_count: 5 });
  const r10anon = await anon.rpc('get_company_ranking', { limit_count: 5 });
  if (!r10svc.error && r10anon.error) ok('T10', 'get_company_ranking: service_role OK, anon negato');
  else ko('T10', 'get_company_ranking', `svc_error=${r10svc.error?.message} anon_error=${r10anon.error?.message}`);

  // --- T11: nuovo oggetto in public non riceve grant ad anon
  try {
    await db.query('create table public.__acl_probe_e2e(id int)');
    const p = await db.query("select has_table_privilege('anon','public.__acl_probe_e2e','SELECT') as a, has_table_privilege('authenticated','public.__acl_probe_e2e','SELECT') as b, has_table_privilege('service_role','public.__acl_probe_e2e','SELECT') as c");
    if (p.rows[0].a === false && p.rows[0].b === false && p.rows[0].c === true) ok('T11', 'nuovo oggetto public: anon/auth=false, service_role=true');
    else ko('T11', 'default privileges', JSON.stringify(p.rows[0]));
  } finally {
    await db.query('drop table if exists public.__acl_probe_e2e');
  }

  // --- T12: idempotenza (riapplica la migration)
  try {
    const sql = readFileSync(MIGRATION, 'utf8');
    await db.query('begin'); await db.query(sql); await db.query('commit');
    const acl = await db.query("select has_function_privilege('anon', to_regprocedure('public.submit_vote(text,text,text,uuid,uuid,uuid,text,text)'),'EXECUTE') as a");
    if (acl.rows[0].a === false) ok('T12', 'riapplicazione migration: nessun errore, ACL invariata');
    else ko('T12', 'idempotenza', 'anon riacquisito');
  } catch (e) {
    await db.query('rollback').catch(() => {});
    ko('T12', 'idempotenza', e.message);
  }

  // --- D) hardening residuo: revoca grant tabella su vote_sessions/rate_limits
  try {
    const sql = readFileSync(RESIDUAL_MIGRATION, 'utf8');
    await db.query('begin'); await db.query(sql); await db.query('commit');
    ok('T14', 'migration residua applicata (revoca grant anon/auth su vote_sessions/rate_limits)');
  } catch (e) {
    await db.query('rollback').catch(() => {});
    ko('T14', 'migration residua', e.message);
  }

  const d1 = await anon.from('vote_sessions').select('id').limit(1);
  const d2 = await anon.from('rate_limits').select('ip').limit(1);
  if (d1.error && d2.error) ok('T15', 'anon bloccato su vote_sessions/rate_limits (grant revocato)');
  else ko('T15', 'grant residui', `vote_sessions=${d1.error?.message ?? 'accessibile'} rate_limits=${d2.error?.message ?? 'accessibile'}`);

  const s1 = await svc.from('vote_sessions').select('id').limit(1);
  const s2 = await svc.from('rate_limits').select('ip').limit(1);
  if (!s1.error && !s2.error) ok('T16', 'service_role legge vote_sessions/rate_limits');
  else ko('T16', 'service_role', `vote_sessions=${s1.error?.message} rate_limits=${s2.error?.message}`);

  // --- cleanup artefatti di test
  await db.query('delete from public.vote_sessions where fingerprint=$1', [probeFp]);
  await db.query('delete from public.daily_stats where company_id = any($1) and date = current_date', [[c1, c2, c3]]);
  await db.query('delete from public.audit_logs where fingerprint=$1', [probeFp]);
  if (tempCompanies) {
    await db.query('delete from public.companies where id = any($1)', [[c1, c2, c3]]);
  }
  const leftover = (await db.query('select count(*) n from public.vote_sessions where fingerprint=$1', [probeFp])).rows[0].n;
  console.log('cleanup leftover vote_sessions:', leftover, '| company_totals c1:', ctBeforeTp, '->', ctAfterTp);

  await db.end();

  console.log('\n=== RISULTATI ===');
  for (const r of results) console.log(`${r.esito.padEnd(5)} ${r.id.padEnd(4)} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  const failed = results.filter((r) => r.esito === 'FAIL').length;
  console.log(`\nTOTALE: ${results.length} test, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
