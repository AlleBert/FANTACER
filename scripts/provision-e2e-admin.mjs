#!/usr/bin/env node
/**
 * Provisioning E2E admin (Supabase Auth user + admin_users row + verified TOTP factor).
 *
 * Interactive by default; non-interactive via --email/--password/--yes.
 *
 * Usage:
 *   npm run provision:e2e:admin
 *   npm run provision:e2e:admin -- --email=admin@fantacer.it --role=admin
 *   npm run provision:e2e:admin -- --email=a@b.it --password=<pwd> --yes --role=viewer
 *   npm run provision:e2e:admin -- --force        # re-enroll TOTP even if a verified factor exists
 *   npm run provision:e2e:admin -- --verify       # full login (password + TOTP) after provisioning
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (loaded from .env by the npm script via --env-file-if-exists=.env).
 * The E2E_ADMIN_* variables are written to the file given by --env-file (default .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import readline from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEFAULT_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@fantacer.it'

function fail(message) {
  console.error('\nError:', message)
  process.exit(1)
}

/* ------------------------------------------------------------------ */
/* CLI arg parsing                                                     */
/* ------------------------------------------------------------------ */

const FLAG_RE = /^--([a-z-]+)(?:=(.*))?$/
const ROLES = ['admin', 'viewer']
const args = { email: null, password: null, force: false, verify: false, yes: false, role: null, help: false, envFile: null }
for (const raw of process.argv.slice(2)) {
  const m = raw.match(FLAG_RE)
  if (!m) fail(`Argomento non riconosciuto: ${raw}. Uso: --email=, --password=, --role=, --force, --verify, --yes, --help`)
  const key = m[1]
  const value = m[2]
  if (key === 'help') args.help = true
  else if (key === 'force') args.force = true
  else if (key === 'verify') args.verify = true
  else if (key === 'yes') args.yes = true
  else if (key === 'email' && value) args.email = value
  else if (key === 'password' && value) args.password = value
  else if (key === 'role' && value && ROLES.includes(value)) args.role = value
  else if (key === 'env-file' && value) args.envFile = value
  else if (key === 'role') fail(`Valore role non valido: --role=${value} (attesi: ${ROLES.join(' | ')}).`)
  else fail(`Flag non riconosciuto o valore mancante: --${key}`)
}

if (args.help) {
  console.log(`
Usage: npm run provision:e2e:admin [-- --flags]

  Provisiona (o aggiorna) l'utente admin E2E per i test Playwright:
    - crea o trova l'utente in Supabase Auth (email + password)
    - garantisce la riga admin_users (is_active=true, role, auth_id linkato)
    - enroll e verifica un factor TOTP (sessione AAL2) — solo per role=admin
    - stampa E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD / E2E_ADMIN_TOTP_SECRET
      + URI otpauth:// + QR SVG scansionabile in ./.qr/ (solo admin)

Flags:
  --email=...     email dell'admin E2E (default: ${DEFAULT_EMAIL})
  --password=...  password (se omesso viene chiesta interattivamente)
  --role=...      ruolo da assegnare: admin (default, MFA TOTP obbligatoria)
                  oppure viewer (read-only, AAL1, niente TOTP)
  --env-file=...  file dove scrivere E2E_ADMIN_* (default: .env.local)
  --force         rimuove il factor TOTP esistente (se verified) e ne enrolla uno nuovo
  --verify        esegue un login E2E completo (password + TOTP) per validare le env
  --yes           risponde "sì" ai prompt (uso non-interattivo)
  --help          questo messaggio
`)
  process.exit(0)
}

/* ------------------------------------------------------------------ */
/* TOTP (RFC 6238) — specchia tests/e2e/helpers/auth.ts                */
/* ------------------------------------------------------------------ */

function generateTotp(secret, timeStep = 30, digits = 6) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const key = secret.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = ''
  for (const char of key) {
    const idx = alphabet.indexOf(char)
    if (idx === -1) throw new Error(`Carattere base32 non valido: ${char}`)
    bits += idx.toString(2).padStart(5, '0')
  }
  const buffer = Buffer.alloc(Math.ceil(bits.length / 8))
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') buffer[Math.floor(i / 8)] |= 1 << (7 - (i % 8))
  }
  const counter = Math.floor(Date.now() / 1000 / timeStep)
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', buffer).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(binary % 10 ** digits).padStart(digits, '0')
}

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

// Su stdin non-interattivo (piped, es. `printf ... | script` o CI) readline.question()
// sequenziali si rompono in Node 24: dopo la prima risposta stdin chiude e le question
// successive non si risolvono mai. Quindi bufferizziamo stdin subito e serviamo le
// risposte da una coda. In TTY interattivo usiamo invece readline con masking.
const isTty = Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY)
const rl = isTty ? readline.createInterface({ input, output, terminal: true }) : null
const pipedAnswers = isTty ? [] : readFileSync(0, 'utf8').split('\n').map((l) => l.trim())
let nextAnswerIndex = 0

function question(label) {
  return new Promise((resolve) => rl.question(label, (ans) => resolve(ans.trim())))
}

async function nextAnswer(label) {
  if (isTty) {
    return question(label)
  }
  const ans = pipedAnswers[nextAnswerIndex] ?? ''
  nextAnswerIndex += 1
  process.stdout.write(`${label} ${ans || '<vuoto>'}\n`)
  return ans
}

function askEmail(promptText) {
  return nextAnswer(promptText).then((ans) => (ans || DEFAULT_EMAIL))
}

async function askPassword(label) {
  if (!isTty) {
    const ans = pipedAnswers[nextAnswerIndex] ?? ''
    nextAnswerIndex += 1
    process.stdout.write(`${label} ${ans ? '*'.repeat(ans.length) : '<vuoto>'}\n`)
    return ans
  }
  const orig = rl._writeToOutput.bind(rl)
  rl._writeToOutput = (str) => {
    if (str.includes('\n') || str.includes('\x1b')) orig(str)
    else orig('*'.repeat(str.length))
  }
  try {
    return await question(label)
  } finally {
    rl._writeToOutput = orig
  }
}

async function askYesNo(promptText) {
  const ans = (await nextAnswer(promptText)).trim().toLowerCase()
  if (!ans) return false
  return ans === 'sì' || ans === 'si' || ans === 'y' || ans === 'yes' || ans === 'true'
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

async function stepCreateUser(admin, email, password) {
  // Promemoria password: Supabase Auth richiede min 8 caratteri. Per il test E2E va bene una
  // password generata lunga, ma devi ricordarla: è quella che Playwright usa per il login
  // (E2E_ADMIN_PASSWORD, scritta in .env.local). Il secret TOTP, se perso, si può ri-generare
  // con --force; la password con la riga admin_users è legata all'utente Auth e non va persa.
  process.stdout.write(`[1/4] Crea/trova utente in Supabase Auth (${email})... `)
  const emailField = email.toLowerCase()
  const { data: found, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) fail(`listUsers fallita: ${listError.message}`)
  const existing = found?.users?.find((u) => u.email && u.email.toLowerCase() === emailField)
  if (existing) {
    console.log('utente esistente')
    return existing
  }
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: emailField,
    password,
    email_confirm: true,
  })
  if (createError) fail(`createUser fallita: ${createError.message}`)
  if (!created.user) fail('createUser non ha restituito un utente')
  console.log('creato')
  return created.user
}

async function stepEnsureAdminRow(admin, email, userId, role) {
  process.stdout.write('[2/4] Verifica/crea riga admin_users... ')
  const { data: existing } = await admin
    .from('admin_users')
    .select('id, auth_id, is_active, role')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (existing) {
    const patch = {}
    if (existing.auth_id !== userId) patch.auth_id = userId
    if (!existing.is_active) patch.is_active = true
    if (existing.role !== role) patch.role = role
    if (Object.keys(patch).length) {
      const { error } = await admin.from('admin_users').update(patch).eq('id', existing.id)
      if (error) fail(`update admin_users fallita: ${error.message}`)
    }
    console.log('presente')
    return
  }
  const { error } = await admin.from('admin_users').insert({
    email: email.toLowerCase(),
    auth_id: userId,
    is_active: true,
    role,
  })
  if (error) fail(`insert admin_users fallita: ${error.message}`)
  console.log('creata')
}

/**
 * Enroll TOTP come utente (AAL1 -> enroll -> challenge+verify -> AAL2).
 * La service key NON può enrollare: serve una sessione utente reale.
 */
async function stepEnsureTotp(email, password, { force }) {
  process.stdout.write('[3/4] Factor TOTP...\n')

  const adminWithService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const userSupabase = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: sl, error: slError } = await userSupabase.auth.signInWithPassword({ email, password })
  if (slError) fail(`Sign-in password fallito: ${slError.message}`)
  const userId = sl.user?.id
  if (!userId) fail('Sign-in password: utente mancante')

  const { data: factors, error: factorListError } =
    await adminWithService.auth.admin.mfa.listFactors({ userId })
  if (factorListError) fail(`listFactors fallita: ${factorListError.message}`)
  const verified = factors?.factors?.filter((f) => f.status === 'verified') || []

  if (verified.length > 0 && !force) {
    console.log('  - factor TOTP verified già presente → skip enroll')
    console.log("  (il secret base32 NON è ri-leggibile da Supabase; esportalo dall'authenticator o usa --force)")
    return { factorId: verified[0].id, secret: null, uri: null, qrCode: null }
  }

  if (verified.length > 0 && force) {
    for (const f of verified) {
      const { error: delError } = await adminWithService.auth.admin.mfa.deleteFactor({ id: f.id, userId })
      if (delError) fail(`deleteFactor (${f.id}) fallita: ${delError.message}`)
    }
    console.log(`  - factor esistenti rimossi per --force (${verified.length})`)
  }

  console.log('  - enroll TOTP...')
  const { data: enroll, error: enrollError } = await userSupabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'e2e-admin',
  })
  if (enrollError) {
    fail(`MFA enroll fallita: ${enrollError.message} — assicurati che MFA TOTP sia attivo nel progetto (Authentication → Multi-factor)`)
  }
  const secret = enroll.totp?.secret
  const uri = enroll.totp?.uri
  const qrCode = enroll.totp?.qr_code
  const factorId = enroll.id
  if (!secret || !factorId) fail('enroll non ha restituito secret/factorId')

  const code = generateTotp(secret)
  console.log('  - challenge + verify con codice generato...')
  const { error: cvError } = await userSupabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (cvError) fail(`MFA verify fallita: ${cvError.message}`)

  const { data: level } = await userSupabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const aal = level?.currentLevel ?? '?'
  console.log(`  - verify ok (sessione AAL: ${aal})`)

  return { factorId, secret, uri, qrCode }
}

async function stepVerifyLogin(email, password, secret) {
  if (!secret) {
    console.log("[4/4] --verify: secret TOTP non disponibile (factor già esistente) → usa --force oppure salta --verify")
    return
  }
  process.stdout.write('[4/4] --verify: login E2E password + TOTP... ')
  const supabase = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: slError } = await supabase.auth.signInWithPassword({ email, password })
  if (slError) fail(`--verify: password step fallito: ${slError.message}`)
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const all = factors?.all || []
  if (!all.length) fail('--verify: nessun factor per il challenge')
  const factorId = all[0].id
  const code = generateTotp(secret)
  const { error: cvError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (cvError) fail(`--verify: TOTP step fallito: ${cvError.message}`)
  console.log('OK — login E2E valido')
}

/* ------------------------------------------------------------------ */
/* .env.local write + QR SVG                                          */
/* ------------------------------------------------------------------ */

const QR_DIR = resolve(process.cwd(), '.qr')

function writeQrSvg(qrCode) {
  if (!qrCode) return null
  const svg = qrCode.startsWith('data:image/svg+xml;utf-8,')
    ? qrCode.slice('data:image/svg+xml;utf-8,'.length)
    : qrCode
  mkdirSync(QR_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = resolve(QR_DIR, `e2e-admin-${stamp}.svg`)
  writeFileSync(path, svg, 'utf8')
  return path
}

function writeEnvFile(email, password, secret) {
  const envPath = resolve(process.cwd(), args.envFile || '.env.local')
  let content = ''
  try {
    content = readFileSync(envPath, 'utf8')
  } catch {
    // file assente → creiamo
  }
  const block = [
    '',
    '# E2E admin (generato da npm run provision:e2e:admin)',
    `E2E_ADMIN_EMAIL=${email}`,
    `E2E_ADMIN_PASSWORD=${password}`,
    `E2E_ADMIN_TOTP_SECRET=${secret ? secret.toLowerCase() : ''}`,
    '',
  ].join('\n')
  content = content.trimEnd() + (content.trimEnd() ? '\n' : '') + block
  writeFileSync(envPath, content, 'utf8')
  console.log(`  → scritte in ${envPath}`)
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  if (!SUPABASE_URL) fail('NEXT_PUBLIC_SUPABASE_URL mancante (esegui via npm run provision:e2e:admin)')
  if (!SERVICE_ROLE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY mancante (esegui via npm run provision:e2e:admin)')

  console.log(`\nProvisioning E2E admin per ${SUPABASE_URL}`)

  const email = args.email || (await askEmail(`> Email utente E2E [${DEFAULT_EMAIL}]: `))
  let password = args.password
  if (!password && !args.yes) {
    password = await askPassword('> Password utente E2E (nascosta): ')
  }
  if (!password) fail('Password mancante (usa --password o rispondi al prompt)')
  if (password.length < 8) {
    fail('Password troppo corta (< 8 caratteri — Supabase Auth richiede almeno 8). ' +
      '\nPromemoria: per i test E2E può essere una password generata lunga, ma DEVI ricordarla: ' +
      'è quella che Playwright usa per il login (E2E_ADMIN_PASSWORD nel file --env-file).')
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const user = await stepCreateUser(admin, email, password)
  const role = args.role || 'admin'
  await stepEnsureAdminRow(admin, email, user.id, role)

  let totp = null
  if (role === 'admin') {
    totp = await stepEnsureTotp(email, password, { force: args.force })
  } else {
    console.log('[3/4] Role viewer: nessun factor TOTP (login AAL1, read-only)')
  }

  const secretLine = role === 'admin'
    ? (totp.secret
        ? `E2E_ADMIN_TOTP_SECRET=${totp.secret}`
        : 'E2E_ADMIN_TOTP_SECRET=<non disponibile — esporta dall\'authenticator o usa --force>')
    : 'E2E_ADMIN_TOTP_SECRET=<nessuno — role=viewer (AAL1, niente MFA)>'

  const qrPath = role === 'admin' ? writeQrSvg(totp.qrCode) : null

  console.log(`
──────────────────────────────────────────────
Ruolo: ${role}
E2E_ADMIN_EMAIL=${email}
E2E_ADMIN_PASSWORD=${password}
${secretLine}
${role === 'admin' && totp.uri ? `E2E_ADMIN_TOTP_URI=${totp.uri}` : ''}
${qrPath ? `QR SVG: ${qrPath} — apri il file e scansiona con l'app authenticator` : ''}
──────────────────────────────────────────────`)

  if (role === 'admin' && totp.secret) {
    const writeOk = args.yes ? true : await askYesNo(`\nScrivere queste variabili in ${args.envFile || '.env.local'}? (sì/no): `)
    if (writeOk) {
      writeEnvFile(email, password, totp.secret)
    } else {
      console.log('  (il secret TOTP si vede SOLO qui — copialo subito)')
    }
  } else {
    console.log(`  (role viewer: nessuna variabile TOTP da scrivere in ${args.envFile || '.env.local'})`)
  }

  if (args.verify && role === 'admin') {
    await stepVerifyLogin(email, password, totp.secret)
  } else if (args.verify && role === 'viewer') {
    process.stdout.write('[4/4] --verify: login E2E password (AAL1)... ')
    const supabase = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: slError } = await supabase.auth.signInWithPassword({ email, password })
    if (slError) fail(`--verify: password step fallito: ${slError.message}`)
    console.log('OK — login E2E viewer valido')
  } else if (role === 'admin' && totp.secret) {
    console.log('\nSuggerimento: riesegui con --verify per validare le env con un login completo.')
  }

  if (rl) rl.close()
}

main().catch((err) => {
  if (rl) rl.close()
  console.error('\nErrore inatteso:', err)
  process.exit(1)
})