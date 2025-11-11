import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    runtime: 'nodejs20.x'
  }),
  integrations: [
    preact({ compat: true })
  ]
});
