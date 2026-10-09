import { defineConfig } from 'astro/config';
export default defineConfig({
  site:
    process.env.PUBLIC_SITE_URL ||
    'https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app',
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'never' },
  vite: { build: { sourcemap: false } },
});
