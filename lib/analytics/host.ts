export const CANONICAL_ANALYTICS_HOST = "afterhoursagenda.com";

/**
 * Analytics is intentionally limited to the public canonical host. Preview,
 * local, `www`, and Netlify compatibility hosts must not blend their traffic
 * into the production GA4 property, even when a visitor has granted consent.
 */
export function isCanonicalAnalyticsHost(hostname: string | null | undefined): boolean {
  return hostname?.trim().toLowerCase().replace(/\.$/, "") === CANONICAL_ANALYTICS_HOST;
}
