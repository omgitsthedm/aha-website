import type { AhaVariant } from "@/lib/types/product";

export type ApliiqMapEntry = Pick<AhaVariant,
  | "apliiqSku"
  | "apliiqProductId"
  | "apliiqVariantId"
  | "apliiqDecorationSnapshot"
  | "apliiqPrivateLabelSnapshot"
  | "apliiqAssetUrls"
  | "apliiqRegionAvailability"
  | "apliiqSizeGuideReference"
  | "apliiqMappingApproval"
  | "apliiqSampleApproval"
  | "squareMappingStatus"
  | "costEstimate"
  | "marginEstimate"
  | "costVerifiedAt"
  | "marginVerifiedAt"
>;

export interface ApliiqMapDocument {
  map: Record<string, ApliiqMapEntry>;
}

const ALLOWED_ENTRY_FIELDS = new Set<keyof ApliiqMapEntry>([
  "apliiqSku", "apliiqProductId", "apliiqVariantId", "apliiqDecorationSnapshot",
  "apliiqPrivateLabelSnapshot", "apliiqAssetUrls", "apliiqRegionAvailability",
  "apliiqSizeGuideReference", "apliiqMappingApproval", "apliiqSampleApproval",
  "squareMappingStatus", "costEstimate", "marginEstimate", "costVerifiedAt", "marginVerifiedAt",
]);

function fail(path: string, message: string): never {
  throw new Error(`Invalid data/apliiq-map.json at ${path}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(path, "must be a nonempty string");
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, path);
}

function cents(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    fail(path, "must be a finite nonnegative integer number of cents");
  }
  return value;
}

function isoTimestamp(value: unknown, path: string): string {
  const timestamp = requiredString(value, path);
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== timestamp) {
    fail(path, "must be a canonical ISO-8601 UTC timestamp");
  }
  return timestamp;
}

function httpsUrl(value: unknown, path: string): string {
  const url = requiredString(value, path);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail(path, "must be an absolute HTTPS URL");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    fail(path, "must be an absolute HTTPS URL without embedded credentials");
  }
  return url;
}

function stringList(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length === 0) fail(path, "must be a nonempty string array");
  const result = value.map((item, index) => requiredString(item, `${path}[${index}]`));
  if (new Set(result).size !== result.length) fail(path, "must not contain duplicates");
  return result;
}

function validateStructuredValue(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(path, "contains a non-finite number");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateStructuredValue(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) fail(path, "must contain only JSON-compatible values");
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (/urls?$/i.test(key)) {
      if (Array.isArray(child)) child.forEach((item, index) => httpsUrl(item, `${childPath}[${index}]`));
      else httpsUrl(child, childPath);
    } else {
      validateStructuredValue(child, childPath);
    }
  }
}

function structuredSnapshot(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).length === 0) fail(path, "must be a nonempty object");
  validateStructuredValue(value, path);
  return value;
}

function approved(value: unknown, path: string): "approved" {
  if (value !== "approved") fail(path, "must be explicitly approved");
  return value;
}

function active(value: unknown, path: string): "active" {
  if (value !== "active") fail(path, "must be explicitly active");
  return value;
}

function parseEntry(value: unknown, path: string): ApliiqMapEntry {
  if (!isRecord(value)) fail(path, "must be an object");
  for (const key of Object.keys(value)) {
    if (!ALLOWED_ENTRY_FIELDS.has(key as keyof ApliiqMapEntry)) fail(`${path}.${key}`, "is not a recognized field");
  }

  const assetUrls = value.apliiqAssetUrls === undefined
    ? undefined
    : (() => {
      if (!Array.isArray(value.apliiqAssetUrls) || value.apliiqAssetUrls.length === 0) {
        return fail(`${path}.apliiqAssetUrls`, "must be a nonempty HTTPS URL array when present");
      }
      const urls = value.apliiqAssetUrls.map((item, index) => httpsUrl(item, `${path}.apliiqAssetUrls[${index}]`));
      if (new Set(urls).size !== urls.length) fail(`${path}.apliiqAssetUrls`, "must not contain duplicates");
      return urls;
    })();

  return {
    apliiqSku: requiredString(value.apliiqSku, `${path}.apliiqSku`),
    apliiqProductId: optionalString(value.apliiqProductId, `${path}.apliiqProductId`),
    apliiqVariantId: optionalString(value.apliiqVariantId, `${path}.apliiqVariantId`),
    apliiqDecorationSnapshot: structuredSnapshot(value.apliiqDecorationSnapshot, `${path}.apliiqDecorationSnapshot`),
    apliiqPrivateLabelSnapshot: structuredSnapshot(value.apliiqPrivateLabelSnapshot, `${path}.apliiqPrivateLabelSnapshot`),
    apliiqAssetUrls: assetUrls,
    apliiqRegionAvailability: stringList(value.apliiqRegionAvailability, `${path}.apliiqRegionAvailability`),
    apliiqSizeGuideReference: requiredString(value.apliiqSizeGuideReference, `${path}.apliiqSizeGuideReference`),
    apliiqMappingApproval: approved(value.apliiqMappingApproval, `${path}.apliiqMappingApproval`),
    apliiqSampleApproval: approved(value.apliiqSampleApproval, `${path}.apliiqSampleApproval`),
    squareMappingStatus: active(value.squareMappingStatus, `${path}.squareMappingStatus`),
    costEstimate: cents(value.costEstimate, `${path}.costEstimate`),
    marginEstimate: cents(value.marginEstimate, `${path}.marginEstimate`),
    costVerifiedAt: isoTimestamp(value.costVerifiedAt, `${path}.costVerifiedAt`),
    marginVerifiedAt: isoTimestamp(value.marginVerifiedAt, `${path}.marginVerifiedAt`),
  };
}

/** Fail-closed runtime parser for the committed, sale-ready APLIIQ registry. */
export function parseApliiqMapDocument(value: unknown): ApliiqMapDocument {
  if (!isRecord(value)) fail("$", "document must be an object");
  const rootKeys = Object.keys(value);
  if (rootKeys.length !== 1 || rootKeys[0] !== "map") fail("$", "document must contain only the map object");
  if (!isRecord(value.map)) fail("$.map", "must be an object keyed by ahaVariantId");

  const map: Record<string, ApliiqMapEntry> = {};
  for (const [variantId, entry] of Object.entries(value.map)) {
    const normalizedId = requiredString(variantId, "$.map key");
    map[normalizedId] = parseEntry(entry, `$.map.${normalizedId}`);
  }
  return { map };
}
