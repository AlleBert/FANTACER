import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.LOAD_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/load/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
    locale: 'it-IT',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'load-chromium', use: { ...devices['Desktop Chrome'] } }],
})
