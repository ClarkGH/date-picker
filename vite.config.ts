import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // public/ holds the demo page's assets, not the library's
    copyPublicDir: false,
    lib: {
      entry: { index: 'src/index.ts', define: 'src/define.ts', react: 'src/react.ts' },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      // Peer-style deps stay out of the bundle, so an app that already has them doesn't ship them twice
      external: [/^lit/, /^@lit\//, /^@popperjs\/core/, /^react($|\/)/],
    },
  },
})
