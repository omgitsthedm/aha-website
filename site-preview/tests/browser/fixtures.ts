import { test as base, expect } from "@playwright/test";

// Tests may mock vendor SDKs, but may never deliver synthetic visits or orders
// to live analytics, payment, email, or fulfillment services.
export const test = base.extend<{ networkBoundary: void }>({
  networkBoundary: [async ({ context, baseURL }, use) => {
    const origin = new URL(baseURL || "http://127.0.0.1:48379").origin;
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      // Supply inert versions of the three expected SDKs. Aborting these
      // expected requests creates console errors unrelated to storefront health.
      // Test-specific page routes still take precedence over this default.
      const trackerSdk = (url.origin === origin && url.pathname.startsWith("/api/partytown/meta-pixel/"))
        || (url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js")
        || (url.hostname === "connect.facebook.net" && url.pathname === "/en_US/fbevents.js")
        || (url.hostname === "us-assets.i.posthog.com" && url.pathname === "/static/array.js");
      if (trackerSdk) return route.fulfill({ status: 200, contentType: "application/javascript", body: "/* Local test stub: no vendor execution. */" });
      return url.origin === origin || !["http:", "https:"].includes(url.protocol)
        ? route.continue() : route.abort("blockedbyclient");
    });
    await use();
  }, { auto: true }],
});
export { expect };
export type { Page } from "@playwright/test";
