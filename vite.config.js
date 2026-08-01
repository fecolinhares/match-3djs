import { defineConfig } from 'vite';

export default defineConfig({
  // base relativa: funciona em qualquer subpath (GitHub Pages project site
  // fica em /match-3djs/, não na raiz). './' = assets relativos ao index.html.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3456,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // build output dir override
    outDir: 'dist',
    emptyOutDir: true,
  },
});
