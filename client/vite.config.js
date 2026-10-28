import { defineConfig } from 'vite';

// Dev-only: forwards /api to the Express server. In production the Express server
// serves client/dist itself, so no proxy is involved.
// Uses 127.0.0.1 (not "localhost") so Node doesn't resolve to IPv6 ::1 and get ECONNREFUSED.
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:3000';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
