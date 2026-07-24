import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_BACKEND_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/login': {
        target: backendTarget,
        changeOrigin: true
      },
      '/logout': {
        target: backendTarget,
        changeOrigin: true
      },
      '/socket.io': {
        target: backendTarget,
        ws: true,
        changeOrigin: true
      },
      '/webhook': {
        target: backendTarget,
        changeOrigin: true
      },
      '/auth': {
        target: backendTarget,
        changeOrigin: true
      }
    }
  }
});
