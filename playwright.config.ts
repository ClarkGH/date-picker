import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for what jsdom can't do: layout, color contrast, focus rings, form association,
 * delegatesFocus. Runs against the Vite dev server. Unit and component specs stay in Vitest.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5199',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
});
