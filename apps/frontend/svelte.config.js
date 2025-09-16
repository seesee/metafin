import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
    paths: {
      base: process.env.PUBLIC_BASE_PATH || '',
    },
    alias: {
      '@metafin/shared': '../../packages/shared/src',
    },
  },
};

export default config;
