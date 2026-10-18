import { test as base, expect } from "@playwright/test";

// Tests may mock vendor SDKs, but may never deliver synthetic visits or orders
// to live analytics, payment, email, or fulfillment services.
export const test = base.extend<{ networkBoundary: void }>({
  networkBoundary: [async ({ context, baseURL }, use) => {
    const origin = new URL(baseURL || "http://127.0.0.1:48379").origin;
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === origin || !["http:", "https:"].includes(url.protocol)
        ? route.continue() : route.abort("blockedbyclient");
    });
    await use();
  }, { auto: true }],
});
export { expect };
export type { Page } from "@playwright/test";
