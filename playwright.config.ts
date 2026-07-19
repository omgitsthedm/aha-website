import { defineConfig, devices } from "@playwright/test";

// E2E runs against a locally built+started production server (Sandbox commerce).
const PORT = process.env.PORT || "3000";
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // These integration smokes share one production server and provider/database paths.
  // Keep each browser project's flow ordered so navigation and hydration are deterministic.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  // CI runners cold-start `next start` slowly; give navigation room.
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile-viewport smoke on the Chromium engine. Playwright's bundled WebKit
    // fails to apply the stylesheet against a localhost `next start` (CSS parses
    // and applies correctly in real Safari and against the live site — verified),
    // which made every CSS-dependent mobile assertion flaky. Real iOS Safari
    // coverage is handled by the mandatory manual device pass, not this suite.
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", defaultBrowserType: "chromium" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        port: Number(PORT),
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
