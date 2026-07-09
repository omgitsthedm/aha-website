export type CommerceEnvironment = "production" | "sandbox";
export type FulfillmentMode = "manual" | "dry-run" | "auto";

export const DEFAULT_SITE_URL = "https://www.afterhoursagenda.com";

const SQUARE_BASE_URLS: Record<CommerceEnvironment, string> = {
  production: "https://connect.squareup.com/v2",
  sandbox: "https://connect.squareupsandbox.com/v2",
};

export function getCommerceEnvironment(): CommerceEnvironment {
  const value = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
  return value === "sandbox" ? "sandbox" : "production";
}

export function getSquareBaseUrl(): string {
  return SQUARE_BASE_URLS[getCommerceEnvironment()];
}

export function getFulfillmentMode(): FulfillmentMode {
  const value = (process.env.AHA_FULFILLMENT_MODE || "manual").toLowerCase();
  if (value === "dry-run") return "dry-run";
  if (value === "auto") return "auto";
  return "manual";
}

export function normalizeSiteUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isLocalhost = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalhost) return null;
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveRequestOrigin(request: Request): string | null {
  const requestUrl = normalizeSiteUrl(request.url);
  if (requestUrl) return requestUrl;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const forwardedUrl = normalizeSiteUrl(`${forwardedProto}://${forwardedHost}`);
  if (forwardedUrl) return forwardedUrl;

  return normalizeSiteUrl(request.headers.get("origin") || undefined);
}

export function resolveSiteUrl(request?: Request): string {
  const requestOrigin = request ? resolveRequestOrigin(request) : null;
  const deployContext = process.env.CONTEXT;
  const shouldPreferRequestOrigin =
    getCommerceEnvironment() === "sandbox" ||
    Boolean(deployContext && deployContext !== "production");

  if (shouldPreferRequestOrigin && requestOrigin) return requestOrigin;

  const configured = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  if (requestOrigin) return requestOrigin;

  return DEFAULT_SITE_URL;
}

export function getEnvPresence(names: string[]): Record<string, boolean> {
  return names.reduce<Record<string, boolean>>((presence, name) => {
    presence[name] = Boolean(process.env[name]?.trim());
    return presence;
  }, {});
}
