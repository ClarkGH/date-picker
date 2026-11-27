import { defineConfig, devices } from '@playwright/test';
import { APPS } from './apps.js';

/** Runs smoke.e2e.ts against each example's production build. Started by scripts/test-consumers.mjs. */
export default defineConfig({
  testDir: '.',
  testMatch: 'smoke.e2e.ts',
  reporter: 'list',
  use: { timezoneId: 'America/Sao_Paulo' },
  projects: APPS.map((app) => ({
    name: app.name,
    use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${app.port}` },
  })),
  webServer: APPS.map((app) => ({
    command: `pnpm --dir ${app.name} exec vite preview --port ${app.port} --strictPort`,
    url: `http://localhost:${app.port}`,
    reuseExistingServer: false,
  })),
});
