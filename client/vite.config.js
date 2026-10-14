import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // During development, API calls and photos are forwarded to the Express server.
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
  build: {
    target: 'es2019', // works on older Android phones
    cssCodeSplit: true,
    reportCompressedSize: true,
  },
});
