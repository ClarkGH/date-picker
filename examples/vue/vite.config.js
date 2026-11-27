import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      // Tells Vue the tag is a custom element, not a Vue component it can't find
      template: { compilerOptions: { isCustomElement: (tag) => tag === 'consistent-date-picker' } },
    }),
  ],
});
