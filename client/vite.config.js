import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The dev proxy target can be changed for test setups (for example a second API instance).
const apiTarget = process.env.VITE_API_PROXY ?? 'http://localhost:4000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change less often than app code, so they get their own cached files.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react|sonner)[\\/]/ },
            { name: 'data', test: /node_modules[\\/](@tanstack|socket\.io-client|engine\.io-client)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/socket.io': { target: apiTarget, ws: true },
    },
  },
});
