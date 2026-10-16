// Vendor sources follow Square's Web Payments CSP guide. Payment scripts are
// requested only by checkout, after the customer asks to continue to payment.
// Inline JavaScript remains forbidden; Square injects dynamic CSS for its UI.
export function contentSecurityPolicy({ approved, scriptHashes }) {
  const square = approved ? "https://web.squarecdn.com" : "https://sandbox.web.squarecdn.com";
  const pci = approved ? "https://pci-connect.squareup.com" : "https://pci-connect.squareupsandbox.com";
  const cash = approved ? "https://kit.cash.app" : "https://sandbox.kit.cash.app";
  const cashApi = approved ? "https://api.cash.app" : "https://sandbox.api.cash.app";
  const afterpay = approved ? "https://portal.afterpay.com" : "https://portal.sandbox.afterpay.com";
  const marketplace = approved ? "https://js.squarecdn.com" : "https://js-sandbox.squarecdn.com";
  return [
    "default-src 'self'", "base-uri 'none'", "object-src 'none'",
    "frame-ancestors 'none'", "form-action 'none'",
    `script-src 'self' ${square} ${marketplace} ${cash}/v1/pay.js ${afterpay}/afterpay.js https://js.afterpay.com/afterpay-1.x.js https://pay.google.com/gp/p/js/pay.js ${approved ? "https://www.googletagmanager.com https://connect.facebook.net https://us-assets.i.posthog.com " : ""}${[...scriptHashes].join(" ")}`,
    `style-src 'self' 'unsafe-inline' ${square} ${cash} https://fonts.googleapis.com`,
    `img-src 'self' data: ${square} ${cashApi} https://franklin-assets.s3.amazonaws.com https://static.afterpay.com https://site-assets.afterpay.com https://www.gstatic.com${approved ? " https://www.googletagmanager.com https://www.google-analytics.com https://www.facebook.com https://connect.facebook.net" : ""}`,
    "font-src 'self' data: https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net https://cash-f.squarecdn.com https://fonts.gstatic.com",
    `connect-src 'self' ${square} ${pci} https://o160250.ingest.sentry.io https://api.lab.amplitude.com/sdk/vardata https://static.afterpay.com/modal https://google.com/pay https://www.google.com/pay https://pay.google.com${approved ? " https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.facebook.com https://us.i.posthog.com https://us-assets.i.posthog.com" : ""}`,
    `frame-src 'self' ${square} ${cash} https://pay.google.com ${afterpay}`,
    "worker-src 'self'", "upgrade-insecure-requests",
  ].join("; ");
}

export function permissionsPolicy(approved) {
  const square = approved ? "https://web.squarecdn.com" : "https://sandbox.web.squarecdn.com";
  return `camera=(), microphone=(), geolocation=(), payment=(self "${square}" "https://pay.google.com"), browsing-topics=()`;
}
