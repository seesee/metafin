import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Listen on all interfaces in development
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  define: {
    __PUBLIC_BASE_PATH__: JSON.stringify(process.env.PUBLIC_BASE_PATH || ''),
  },
});
