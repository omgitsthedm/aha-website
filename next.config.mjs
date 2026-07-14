const isDevelopment = process.env.NODE_ENV === "development";

const resetPublicRoutes = [
  "/best-sellers",
  "/catalog-edit",
  "/collections/:path*",
  "/drops",
  "/drops/:path*",
  "/lookbook/:path+",
  "/coming-soon",
  "/product-feed.xml",
];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://web.squarecdn.com https://sandbox.web.squarecdn.com https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline' https://web.squarecdn.com https://sandbox.web.squarecdn.com",
  "img-src 'self' data: blob: https://items-images-production.s3.us-west-2.amazonaws.com https://images.squarespace-cdn.com https://*.printful.com https://*.squarecdn.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com",
  "font-src 'self' data: https://cash-f.squarecdn.com https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
  "connect-src 'self' https://web.squarecdn.com https://sandbox.web.squarecdn.com https://pci-connect.squareup.com https://pci-connect.squareupsandbox.com https://*.ingest.sentry.io https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'self' https://web.squarecdn.com https://sandbox.web.squarecdn.com https://*.squarecdn.com https://pay.google.com https://appleid.apple.com https://*.cardinalcommerce.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep route metadata in <head> for crawlers and link unfurlers. Netlify's
  // streaming response otherwise places dynamic metadata after <body>.
  htmlLimitedBots: /.*/,
  images: {
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
    return resetPublicRoutes.map((source) => ({
      source,
      destination: "/",
      permanent: false,
    }));
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
            key: "X-XSS-Protection",
            value: "1; mode=block",
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
    ];
  },
};

export default nextConfig;
