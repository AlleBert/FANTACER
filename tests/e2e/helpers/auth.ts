import { type Page } from '@playwright/test';
import { createHmac } from 'crypto';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

export function hasAdminCredentials(): boolean {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
}

/**
 * Minimal RFC 6238 TOTP (30s step, 6 digits, SHA1, base32 secret).
 * Keeps MFA E2E dependency-free.
 */
export function generateTotp(secret: string, timeStep: number = 30, digits: number = 6): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const key = secret
    .toUpperCase()
    .replace(/=+$/, '')
    .replace(/\s/g, '');
  let bits = '';
  for (const char of key) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 char: ${char}`);
    bits += idx.toString(2).padStart(5, '0');
  }
  const buffer = Buffer.alloc(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') buffer[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const counter = Math.floor(timestamp / timeStep);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', buffer).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** digits;
  return code.toString().padStart(digits, '0');
}

/**
 * Performs a real UI login (password step). AAL2/MFA completion requires a
 * real TOTP factor enrolled on the test admin (E2E_ADMIN_TOTP_SECRET); the
 * full flow is exercised when those env vars are provided.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  if (!hasAdminCredentials()) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD env vars are required for authenticated admin tests.',
    );
  }

  await page.goto('/admin/login');
  await page.getByPlaceholder('admin@fantacer.it').fill(ADMIN_EMAIL as string);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.waitForLoadState('networkidle');
}

/** Full MFA login: password + TOTP code. Requires E2E_ADMIN_TOTP_SECRET. */
export async function loginAsAdminWithMfa(page: Page): Promise<void> {
  await loginAsAdmin(page);

  const totpSecret = process.env.E2E_ADMIN_TOTP_SECRET;
  if (!totpSecret) {
    throw new Error(
      'E2E_ADMIN_TOTP_SECRET env var is required to complete MFA login. Skippable with --grep-invert anyway.',
    );
  }

  const code = generateTotp(totpSecret);
  await page.getByPlaceholder('000000').fill(code);
  await page.getByRole('button', { name: 'Verifica' }).click();
  await page.waitForLoadState('networkidle');
}

export async function setupAdminForTest(page: Page, path?: string): Promise<void> {
  await loginAsAdmin(page);
  await page.goto(path || '/admin/dashboard/panoramica');
  await page.waitForLoadState('networkidle');
}