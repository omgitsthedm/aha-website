export type CommerceEnvironment = "production" | "sandbox";
export type FulfillmentMode = "manual" | "dry-run" | "auto";

export const DEFAULT_SITE_URL = "https://afterhoursagenda.com";

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

export function getSquareLocationId(): string {
  return process.env.SQUARE_LOCATION_ID || "";
}

const SQUARE_WEB_SDK_URLS: Record<CommerceEnvironment, string> = {
  production: "https://web.squarecdn.com/v1/square.js",
  sandbox: "https://sandbox.web.squarecdn.com/v1/square.js",
};

/** Public config for the browser Web Payments SDK. Resolved server-side, passed to the client. */
export interface SquareWebPaymentsConfig {
  environment: CommerceEnvironment;
  applicationId: string;
  locationId: string;
  sdkUrl: string;
}

export function getSquareWebPaymentsConfig(): SquareWebPaymentsConfig {
  const environment = getCommerceEnvironment();
  return {
    environment,
    applicationId: process.env.NEXT_PUBLIC_SQUARE_APP_ID || process.env.SQUARE_APPLICATION_ID || "",
    locationId: getSquareLocationId(),
    sdkUrl: SQUARE_WEB_SDK_URLS[environment],
  };
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

export function getEnvPresence(names: string[]): Record<string, boolean> {
  return names.reduce<Record<string, boolean>>((presence, name) => {
    presence[name] = Boolean(process.env[name]?.trim());
    return presence;
  }, {});
}
