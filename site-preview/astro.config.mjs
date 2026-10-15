import { defineConfig } from 'astro/config';
import partytown from '@astrojs/partytown';
export default defineConfig({
  site:
    process.env.PUBLIC_SITE_URL ||
    'https://lfnyc-audit-2026-10-09--afterhoursagenda.netlify.app',
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'never' },
  vite: { build: { sourcemap: false } },
  integrations: [partytown({
    config: {
      forward: ['dataLayer.push', 'fbq'],
      // Meta's script does not permit cross-origin worker fetches. Both routes
      // are fixed server-side allowlist entries; no caller-provided URL passes
      // through this proxy.
      resolveUrl(url) {
        if (url.hostname !== 'connect.facebook.net') return url;
        if (url.pathname === '/en_US/fbevents.js') return new URL('/api/partytown/meta-pixel/bootstrap', self.location.origin);
        if (url.pathname === '/signals/config/1815233516346046') return new URL('/api/partytown/meta-pixel/config', self.location.origin);
        return url;
      },
    },
  })],
});
