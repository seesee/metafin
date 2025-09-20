import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Get backend configuration from environment
  const backendPort = env.APP_PORT || '8080';
  const backendHost = env.BACKEND_HOST === '0.0.0.0' ? 'localhost' : (env.BACKEND_HOST || 'localhost'); // Use localhost for proxy connections
  const frontendPort = parseInt(env.FRONTEND_PORT || '3000');

  return {
    plugins: [sveltekit()],
    server: {
      port: frontendPort,
      host: '0.0.0.0', // Listen on all interfaces in development
      proxy: {
        '/api': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      __PUBLIC_BASE_PATH__: JSON.stringify(env.PUBLIC_BASE_PATH || ''),
    },
  };
});
