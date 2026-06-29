import { defineConfig, devices } from '@playwright/test';

// E2E config for the boss-battle browser tests.
// Reuses the already-running `npm run dev` on :5173 (won't spawn a second).
// Override when an app is already running on a non-default port (e.g. other
// vite instances pushed it off 5173): SMOKE_BASE_URL=http://localhost:5178
const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
