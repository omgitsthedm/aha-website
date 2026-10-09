import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:48379',
    channel: 'chrome',
    headless: true,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node scripts/serve.mjs',
        url: 'http://127.0.0.1:48379',
        reuseExistingServer: false,
        timeout: 15000,
      },
});
