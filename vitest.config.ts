import { defineConfig } from 'vitest/config';

// Brazil's DST began at midnight (2018-11-04 had no 00:00), so date math that passes here passes anywhere.
// Set before workers start
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  test: {
    // Not happy-dom: its <select> reports the wrong value (docs/testing.md#things-to-know)
    environment: 'jsdom',
    restoreMocks: true,
    include: ['src/**/*.spec.ts'],
  },
});
