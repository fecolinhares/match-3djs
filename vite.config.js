import { defineConfig } from 'vite';

export default defineConfig({
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
