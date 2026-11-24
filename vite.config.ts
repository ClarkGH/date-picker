import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: 'src/date-picker.ts',
      formats: ['es'],
      fileName: 'date-picker.es',
    },
    rollupOptions: {
      // Peer-style deps stay out of the bundle, so an app that already has them doesn't ship them twice
      external: [/^lit/, /^@popperjs\/core/],
    },
  },
})
