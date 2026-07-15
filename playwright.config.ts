/**
 * Playwright E2E test configuration for LMS Mahasiswa.
 *
 * Tests run against the local Nuxt dev server.
 * Covers student and instructor core flows in demo mode.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './app/test/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3000',
    port: 3000,
    timeout: 60000,
    reuseExistingServer: true,
  },
})
