import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: '../public',   // reuse SAM models from main project
  resolve: {
    alias: {
      // Reuse analysis code from main project without copying
      '@analysis': path.resolve(__dirname, '../src/analysis'),
      '@types_': path.resolve(__dirname, '../src/types.ts'),
    },
  },
  server: {
    port: 5200,
    proxy: {
      '/api/profile-landmarks': 'http://localhost:5201',
      '/api/annotations': 'http://localhost:5201',
      '/api/annotations/count': 'http://localhost:5201',
    },
  },
});
