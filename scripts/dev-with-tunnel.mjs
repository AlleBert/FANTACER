#!/usr/bin/env node
/**
 * `npm run dev:tunnel` — avvia `next dev` insieme a un quick tunnel Cloudflare.
 *
 * - `next dev` riceve `stdio: inherit` (log identici al comando `dev`).
 * - Gli argomenti extra vengono passati a `next dev` (es. `-- -p 4000`).
 * - L'URL pubblico `https://*.trycloudflare.com` viene estratto e mostrato in evidenza.
 * - Ciclo di vita: se `next dev` esce (chiusura/Ctrl+C) il tunnel muore con lui.
 *   Se invece il tunnel muore da solo, il server continua su `localhost`.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import QRCodeTerm from 'qrcode-terminal';

const BIN = process.env.CLOUDFLARED_BIN || join(homedir(), '.local', 'bin', 'cloudflared');
const TUNNEL_URL_RE = /https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com/;

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function ensureCloudflared() {
  if (!existsSync(BIN)) {
    console.error(
      `\x1b[31m✖ cloudflared non trovato in ${BIN}\x1b[0m\n` +
        `  Installa con: ${bold('npm run setup:tunnel')}\n` +
        `  Oppure imposta CLOUDFLARED_BIN sul percorso del binario.`
    );
    process.exit(1);
  }
}

function parsePort(args) {
  const i = args.indexOf('-p');
  if (i !== -1 && args[i + 1] && /^\d+$/.test(args[i + 1])) return args[i + 1];
  const j = args.indexOf('--port');
  if (j !== -1 && args[j + 1] && /^\d+$/.test(args[j + 1])) return args[j + 1];
  return '3000';
}

function printQr(url) {
  return new Promise((resolve) => {
    QRCodeTerm.generate(url, { small: true }, (qr) => resolve(qr));
  });
}

function printUrl(url) {
  const width = Math.max(44, url.length + 8);
  const bar = '─'.repeat(width);
  const pad = (s) => '  ' + s + ' '.repeat(Math.max(1, width - s.length - 2));
  console.log('\n' + bar);
  console.log(pad(''));
  console.log(pad(`${bold('✓ Tunnel Cloudflare attivo')}`));
  console.log(pad(''));
  console.log(pad(`Apri da iPhone / cellulare:`));
  console.log(pad(`${bold(url)}`));
  console.log(pad(''));
  console.log(pad(dim('URL effimero: cambia a ogni avvio e resta pubblico.')));
  console.log(bar + '\n');

  // QR in terminale (nessun file: solo output su stdout), per connettersi
  // dal telefono senza digitare l'URL.
  printQr(url).then((qr) => {
    console.log(dim('oppure scansiona il QR:') + '\n');
    for (const line of qr.split('\n')) {
      if (line.trim() !== '') console.log('  ' + line);
    }
    console.log('');
  });
}

function main() {
  ensureCloudflared();

  const nextArgs = process.argv.slice(2);
  const port = parsePort(nextArgs);

  console.log(`▸ Avvio server dev su http://localhost:${port} + tunnel Cloudflare…\n`);

  const next = spawn('next', ['dev', ...nextArgs], { stdio: 'inherit', shell: process.platform === 'win32' });
  const tunnel = spawn(
    BIN,
    ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate', '--loglevel', 'info'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let urlPrinted = false;
  let buffer = '';

  const scan = (chunk) => {
    buffer += chunk.toString();
    const match = buffer.match(TUNNEL_URL_RE);
    if (match && !urlPrinted) {
      urlPrinted = true;
      printUrl(match[0]);
    }
    if (buffer.length > 1_000_000) buffer = buffer.slice(-100_000);
  };
  tunnel.stdout.on('data', scan);
  tunnel.stderr.on('data', scan);

  const forward = (chunk) => process.stderr.write(chunk);
  tunnel.stdout.on('data', forward);
  tunnel.stderr.on('data', forward);

  let shuttingDown = false;
  const killAll = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    tunnel.kill('SIGINT');
    next.kill('SIGINT');
    // Hard fallback: chiude il wrapper anche se un figlio ignora il segnale.
    setTimeout(() => process.exit(code), 200).unref();
  };

  process.on('SIGINT', () => killAll(130));
  process.on('SIGTERM', () => killAll(143));

  next.on('exit', (code) => {
    if (shuttingDown) return;
    console.log('\n▸ Server chiuso: termino il tunnel Cloudflare.');
    killAll(code ?? 0);
  });

  tunnel.on('exit', (code) => {
    if (shuttingDown) return;
    if (urlPrinted) {
      console.error('\n⚠ Il tunnel Cloudflare è terminato. Il server resta attivo su localhost.');
      console.error('  Riavvia con `npm run dev:tunnel` per un nuovo URL pubblico.');
    }
  });
}

main();
