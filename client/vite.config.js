import { defineConfig } from 'vite';

export default defineConfig({
  // Force vite restart
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
