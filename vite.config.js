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
    // outDir padrão 'dist' — universal. Pode ser sobrescrito por env var
    // (ex: M3D_OUT_DIR=/some/out/dir npm run build) para filesystems que
    // bloqueiam copyfile (copyfile-restricted filesystems/9p).
    outDir: process.env.M3D_OUT_DIR || 'dist',
    emptyOutDir: true,
  },
});
