import { defineConfig } from 'vitest/config';

// A fixed timezone with a nasty DST history: Brazil's DST began at midnight, so on 2018-11-04
// local midnight did not exist. Date math that survives this survives anywhere. Set before workers start
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  test: {
    // The component tests need customElements and shadow DOM. Not happy-dom: its <select> reports the wrong value (docs/date-picker.md#testing)
    environment: 'jsdom',
    restoreMocks: true,
    include: ['src/**/*.spec.ts'],
  },
});
