#!/usr/bin/env node
/**
 * Installa `cloudflared` (quick tunnel) in `~/.local/bin`.
 *
 * - Scarica il binario linux-x86_64 dalle GitHub releases di Cloudflare.
 * - Idempotente: se `cloudflared` è già presente e risponde, salta il download.
 * - Usato da `npm run setup:tunnel`.
 */
import { mkdirSync, chmodSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const DOWNLOAD_URL =
  'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
const BIN_DIR = join(homedir(), '.local', 'bin');
const BIN_PATH = join(BIN_DIR, 'cloudflared');

const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function errorAndExit(message) {
  console.error(`\x1b[31m✖ ${message}\x1b[0m`);
  process.exit(1);
}

function alreadyUsable(path) {
  try {
    execFileSync(path, ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    errorAndExit(
      'setup:tunnel supporta solo Linux x86_64 (WSL2). ' +
        `Qui: ${process.platform}/${process.arch}. Installa cloudflared manualmente.`
    );
  }

  if (existsSync(BIN_PATH) && statSync(BIN_PATH).size > 0 && alreadyUsable(BIN_PATH)) {
    const version = execFileSync(BIN_PATH, ['--version'], { encoding: 'utf8' }).trim();
    console.log(`✓ cloudflared già presente: ${BIN_PATH} (${version})`);
    return;
  }

  console.log(`⬇ Scaricamento cloudflared → ${BIN_PATH}`);
  mkdirSync(BIN_DIR, { recursive: true });

  const response = await fetch(DOWNLOAD_URL);
  if (!response.ok) {
    errorAndExit(`Download fallito (HTTP ${response.status}): ${DOWNLOAD_URL}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await import('node:fs/promises').then(({ writeFile }) => writeFile(BIN_PATH, buffer));
  chmodSync(BIN_PATH, 0o755);

  if (!alreadyUsable(BIN_PATH)) {
    errorAndExit(`Binario scaricato ma non eseguibile: ${BIN_PATH}`);
  }
  const version = execFileSync(BIN_PATH, ['--version'], { encoding: 'utf8' }).trim();
  console.log(`✓ cloudflared installato: ${BIN_PATH}`);
  console.log(`  ${version}`);
  console.log(`\n${bold('Ora usa:')} npm run dev:tunnel`);
}

main().catch((err) => errorAndExit(err instanceof Error ? err.message : String(err)));
