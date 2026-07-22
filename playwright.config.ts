import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  timeout: 30000,
  snapshotPathTemplate: '{testDir}/screenshots/{projectName}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'ios-se',
      use: {
        ...devices['iPhone SE (3rd gen)'],
      },
    },
    {
      name: 'ios-iphone',
      use: {
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'ios-pro-max',
      use: {
        ...devices['iPhone 15 Pro Max'],
      },
    },
    {
      name: 'ios-ipad-portrait',
      use: {
        ...devices['iPad Mini'],
      },
    },
    {
      name: 'ios-ipad-landscape',
      use: {
        ...devices['iPad Mini landscape'],
      },
    },
    {
      name: 'ios-ipad-pro-portrait',
      use: {
        ...devices['iPad Pro 11'],
      },
    },
    {
      name: 'ios-ipad-pro-landscape',
      use: {
        ...devices['iPad Pro 11 landscape'],
      },
    },
  ],
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_X7K2M9QS3P: 'hx7k2m9Qs3P',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    },
  },
});
