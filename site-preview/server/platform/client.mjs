// One store's identity and providers, from client.config.json. Everything
// that differs between LiFi client stores is read from here, so a new client
// starts by editing that file and running `npm run client:check`. No secrets
// belong in it; credentials stay in each site's Netlify environment.
import config from "../../client.config.json" with { type: "json" };

/** Providers with a working connector. Others are listed so a config naming them fails clearly. */
export const PRINT_PROVIDERS = Object.freeze({
  apliiq: { name: "Apliiq", implemented: true, capabilities: { createArtwork: true, createDesign: true, privateLabel: true, orderApi: true, cancelApi: false, sandbox: false, idempotencyKeys: false, blankStock: false } },
  printify: { name: "Printify", implemented: false, capabilities: { createDesign: true, orderApi: true, cancelApi: true, sandbox: false, idempotencyKeys: false, requestsPerMinute: 600 } },
  printful: { name: "Printful", implemented: false, capabilities: { createDesign: true, orderApi: true, cancelApi: true, sandbox: false, idempotencyKeys: false, requestsPerMinute: 120, maxVariantsPerProduct: 100 } },
});
export const COMMERCE_TARGETS = Object.freeze({
  square: { name: "Square", implemented: true, capabilities: { catalogApi: true, catalogImages: true, webPayments: true, idempotencyKeys: true, sandbox: true } },
  shopify: { name: "Shopify", implemented: false, capabilities: { catalogApi: true, bulkImport: true, webPayments: false, idempotencyKeys: false, sandbox: false } },
});

const ORIGIN = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX = /^#[0-9a-f]{6}$/i;

/** Every problem with a client config, in plain words (empty when valid). */
export function clientConfigProblems(value) {
  const problems = [];
  const need = (condition, message) => { if (!condition) problems.push(message); };
  need(value?.schemaVersion === 1, "schemaVersion must be 1.");
  need(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value?.client?.slug ?? ""), "client.slug must be lowercase words joined by hyphens.");
  need(typeof value?.client?.name === "string" && value.client.name.trim().length > 0, "client.name is required.");
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value?.client?.email ?? ""), "client.email must be an email address.");
  need(ORIGIN.test(value?.site?.origin ?? ""), "site.origin must be an https origin with no path, e.g. https://example.com.");
  need(UUID.test(value?.site?.netlifySiteId ?? ""), "site.netlifySiteId must be the exact Netlify site ID from the fleet manifest.");
  need(value?.site?.previewOrigin === undefined || ORIGIN.test(value.site.previewOrigin), "site.previewOrigin must be an https origin.");
  const commerce = COMMERCE_TARGETS[value?.commerce?.provider];
  need(Boolean(commerce), `commerce.provider must be one of: ${Object.keys(COMMERCE_TARGETS).join(", ")}.`);
  need(!commerce || commerce.implemented, `commerce.provider ${value?.commerce?.provider} has no connector yet; build it before using it.`);
  need(/^\d{4}-\d{2}-\d{2}$/.test(value?.commerce?.apiVersion ?? ""), "commerce.apiVersion must be a pinned YYYY-MM-DD API version.");
  need(value?.commerce?.currency === "USD", "commerce.currency must be USD (the only currency checkout supports).");
  const print = PRINT_PROVIDERS[value?.print?.provider];
  need(Boolean(print), `print.provider must be one of: ${Object.keys(PRINT_PROVIDERS).join(", ")}.`);
  need(!print || print.implemented, `print.provider ${value?.print?.provider} has no connector yet; build it before using it.`);
  const label = value?.print?.privateLabel;
  need(label === null || (typeof label?.code === "string" && Number.isSafeInteger(label?.id) && Number.isSafeInteger(label?.placementId)), "print.privateLabel must be null or { code, id, placementId }.");
  need(Array.isArray(value?.feeds) && value.feeds.every((feed) => ["google", "meta"].includes(feed)), "feeds must list google and/or meta.");
  need(value?.analytics?.ga4 === null || /^G-[A-Z0-9]+$/.test(value?.analytics?.ga4 ?? ""), "analytics.ga4 must be a G- measurement ID or null.");
  need(value?.analytics?.metaPixel === null || /^\d{10,20}$/.test(value?.analytics?.metaPixel ?? ""), "analytics.metaPixel must be a numeric dataset ID or null.");
  need(ORIGIN.test(value?.analytics?.posthogHost ?? ""), "analytics.posthogHost must be an https origin.");
  need(value?.analytics?.posthogProjectUrl === undefined || /^https:\/\/(us|eu)\.posthog\.com\/project\/\d+$/.test(value.analytics.posthogProjectUrl), "analytics.posthogProjectUrl must be the PostHog project URL, e.g. https://us.posthog.com/project/123.");
  for (const key of ["paper", "ink", "accent"]) need(HEX.test(value?.brand?.[key] ?? ""), `brand.${key} must be a #rrggbb color.`);
  need(Array.isArray(value?.brand?.fonts) && value.brand.fonts.length > 0, "brand.fonts must list at least one font.");
  const text = JSON.stringify(value ?? {});
  need(!/(sk_|EAAA|sq0[a-z]{3}-|phx_|re_[A-Za-z0-9]{8,}|secret|password|token)/i.test(text), "client.config.json must not contain secrets; use Netlify environment variables.");
  return problems;
}

const problems = clientConfigProblems(config);
if (problems.length) throw new Error(`client.config.json is invalid: ${problems.join(" ")}`);

export const CLIENT = Object.freeze(config);
export const SITE_ORIGIN = config.site.origin;
export const SITE_HOST = new URL(config.site.origin).host;
export const NETLIFY_SITE_ID = config.site.netlifySiteId;
export const SQUARE_VERSION = config.commerce.apiVersion;
export const PRIVATE_LABEL = config.print.privateLabel;
export const POSTHOG_PROJECT_URL = config.analytics.posthogProjectUrl ?? null;
