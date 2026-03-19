import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 9444,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});
