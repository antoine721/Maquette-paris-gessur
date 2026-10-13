import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = `http://localhost:${process.env.API_PORT || 3001}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: { '/api': api, '/mock-img': api },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
