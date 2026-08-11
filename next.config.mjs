const isDevelopment = process.env.NODE_ENV === "development";

// Deliberately NOT `getCommerceEnvironment()`'s `|| "production"` default.
// An over-broad CSP is inert; an over-trimmed one breaks checkout. So the
// sandbox Square hosts are only dropped when the environment says
// "production" in so many words — which `netlify.toml:25` guarantees on the
// production context. Anything unset (local dev, a one-off build) keeps them.
const isSquareProduction =
  (process.env.SQUARE_ENVIRONMENT || "").trim().toLowerCase() === "production";

/** Square's sandbox origins, present in the CSP only outside production. */
const squareSandbox = {
  webCdn: isSquareProduction ? "" : " https://sandbox.web.squarecdn.com",
  pciConnect: isSquareProduction ? "" : " https://pci-connect.squareupsandbox.com",
};

// Public URLs that were once linkable and indexable and that no longer have an
// app/ route behind them, so they redirect permanently (308) and hand their
// signal to the destination rather than leaving the old URL indexed.
// NOTE: /lookbook itself is LIVE (app/lookbook/page.tsx, in app/sitemap.ts and
// the robots allow list). Only its sub-paths are gone, which is why the pattern
// is `:path+` (one or more segments) and not `:path*`.
// CAVEAT: a 308 is cached indefinitely by any browser that followed it, and
// CLAUDE.md still names /collections/[slug] as a canonical URL shape. If
// collection pages are ever revived, that entry has to come out of this list
// first and previously-redirected browsers will need a cache-busting path.
// /best-sellers redirects to /shop below (shopping intent, not home).
// NOTE: /product-feed.xml is intentionally NOT reset — it serves the Google
// Shopping / Meta / TikTok product feed for multi-channel distribution.
const retiredPublicRoutes = [
  "/collections/:path*",
  "/drops",
  "/drops/:path*",
  "/lookbook/:path+",
];

// Internal routes: never publicly linked, `Disallow`ed in robots.ts, so there
// is no accumulated signal for a permanent redirect to consolidate. They stay
// temporary precisely because they are the two most plausible to revive, and a
// 308 is cached indefinitely by the browser of anyone who hit it once.
const parkedInternalRoutes = ["/catalog-edit", "/coming-soon"];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://web.squarecdn.com${squareSandbox.webCdn} https://pay.google.com https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com`,
  `style-src 'self' 'unsafe-inline' https://web.squarecdn.com${squareSandbox.webCdn}`,
  "img-src 'self' data: blob: https://items-images-production.s3.us-west-2.amazonaws.com https://images.squarespace-cdn.com https://*.printful.com https://*.squarecdn.com https://www.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://www.facebook.com https://analytics.tiktok.com",
  "font-src 'self' data: https://*.squarecdn.com https://cash-f.squarecdn.com https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
  // https://www.google.com is where the Google Pay payment manifest actually
  // resolves — without it googlePay() fails on every surface with a CSP error.
  // No Sentry host: the repo has zero Sentry code. Error alerting runs through
  // lib/commerce/checkout-alert.ts (throttled, idempotency-keyed email), which
  // needs no browser origin.
  `connect-src 'self' https://web.squarecdn.com${squareSandbox.webCdn} https://pci-connect.squareup.com${squareSandbox.pciConnect} https://pay.google.com https://google.com https://www.google.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://connect.facebook.net https://www.facebook.com https://analytics.tiktok.com https://*.tiktok.com https://api.zippopotam.us`,
  `frame-src 'self' https://web.squarecdn.com${squareSandbox.webCdn} https://*.squarecdn.com https://pay.google.com https://appleid.apple.com https://*.cardinalcommerce.com`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Inline the small route stylesheet into the initial document. The primary
  // LCP on the storefront is text, so removing the render-blocking CSS request
  // shortens the critical path without changing the rendered design.
  experimental: {
    inlineCss: true,
  },
  // Keep route metadata in <head> for crawlers and link unfurlers. Netlify's
  // streaming response otherwise places dynamic metadata after <body>.
  htmlLimitedBots: /.*/,
  images: {
    // Browser-matrix E2E can explicitly disable the on-demand optimizer to
    // avoid concurrent first-request encodes in its memory-limited test server.
    // Preview catalog data is otherwise orthogonal to delivery: Lighthouse,
    // deploy previews, and production all exercise the real optimized image path.
    unoptimized: process.env.AHA_UNOPTIMIZED_IMAGES === "true",
    // Serve AVIF (≈20-30% smaller than WebP) where supported, WebP otherwise.
    // Visually identical; first-request encode is cached by the Next runtime.
    formats: ["image/avif", "image/webp"],
    // Avoid a 3840px default fallback for crawlers and browsers without srcset.
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "items-images-production.s3.us-west-2.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.squarespace-cdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.printful.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      // 308, not 307: a temporary redirect tells search engines to keep the old
      // URL indexed and passes no signal to the destination, which is the whole
      // point of redirecting these rather than 404ing them.
      ...retiredPublicRoutes.map((source) => ({
        source,
        destination: "/",
        permanent: true,
      })),
      ...parkedInternalRoutes.map((source) => ({
        source,
        destination: "/",
        permanent: false,
      })),
      // Real HTTP redirect (not a prerendered meta-refresh page, which reads as
      // a soft 404 with duplicate home metadata). Shopping intent → /shop.
      {
        source: "/best-sellers",
        destination: "/shop",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/brand/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Product images are stable webp files — cache hard.
        source: "/products/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Campaign/lifestyle imagery can be swapped — cache a day + revalidate.
        source: "/campaign/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
