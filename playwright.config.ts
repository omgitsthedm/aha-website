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
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium", defaultBrowserType: "chromium" } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"], browserName: "webkit", defaultBrowserType: "webkit" } },
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
