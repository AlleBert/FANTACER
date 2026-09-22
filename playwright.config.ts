import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { config as loadDotEnv } from 'dotenv';

loadDotEnv({ path: '.env.e2e', override: true });
loadEnvConfig(process.cwd());

const E2E_SUPABASE_HOST = 'ookipybsnjtvdrzqzpsl.supabase.co';

const e2eSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const e2eHostname = e2eSupabaseUrl ? new URL(e2eSupabaseUrl).hostname : '';
if (!e2eSupabaseUrl || e2eHostname !== E2E_SUPABASE_HOST) {
  throw new Error(
    `E2E bloccato: NEXT_PUBLIC_SUPABASE_URL='${e2eSupabaseUrl}' punta a '${e2eHostname}', atteso '${E2E_SUPABASE_HOST}'. Carica .env.e2e (progetto fantacer-e2e). Mai E2E su production.`,
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // workers: 2 — i login MFA admin (AAL2) condividono rate limit e sessione
  // (cachedAdminCookies per worker); il margine è dato da ADMIN_LOGIN_RATE_MAX /
  // ADMIN_MFA_VERIFY_RATE_MAX (STEP A). Le suite serial (voting-flow,
  // scroll-blocking) usano mode:'serial' → nessun conflitto parallelo. I progetti
  // WebKit e iOS restano a workers=1 (cap per-project).
  workers: 2,
  timeout: 30000,
  snapshotPathTemplate: '{testDir}/screenshots/{projectName}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'it-IT',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      workers: 2,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'firefox',
      workers: 1,
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chrome',
      workers: 2,
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'mobile-webkit',
      workers: 1,
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'ios-se',
      workers: 1,
      use: {
        ...devices['iPhone SE (3rd gen)'],
      },
    },
    {
      name: 'ios-iphone',
      workers: 1,
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'ios-pro-max',
      workers: 1,
      use: {
        ...devices['iPhone 15 Pro Max'],
      },
    },
    {
      name: 'ios-ipad-portrait',
      workers: 1,
      use: {
        ...devices['iPad Mini'],
      },
    },
    {
      name: 'ios-ipad-landscape',
      workers: 1,
      use: {
        ...devices['iPad Mini landscape'],
      },
    },
    {
      name: 'ios-ipad-pro-portrait',
      workers: 1,
      use: {
        ...devices['iPad Pro 11'],
      },
    },
    {
      name: 'ios-ipad-pro-landscape',
      workers: 1,
      use: {
        ...devices['iPad Pro 11 landscape'],
      },
    },
  ],
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      // Il limite giornaliero reale è attivo in E2E: l'identità è un UUID per
      // test (voter id), quindi non servono bypass. Così si testano voto
      // ripetuto e richieste concorrenti contro l'indice unico.
      DEV_BYPASS_VOTE_LIMIT: '0',
    },
  },
});
