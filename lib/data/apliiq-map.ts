import type { AhaVariant } from "@/lib/types/product";
import { isApliiqSku } from "@/lib/apliiq/orders";

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
  // Landed-cost inputs. Freight and the per-product fulfillment fee are billed
  // separately from product cost, so a registry entry that carries only
  // costEstimate cannot be margin-gated honestly.
  | "weightOz"
  | "apliiqItemCost"
  | "apliiqShippingCost"
  | "apliiqFulfillmentFeeCents"
  | "apliiqDestinationTaxCents"
  | "apliiqCostBasis"
  | "marginFloorOverride"
  | "apliiqSkuVerified"
>;

export interface ApliiqMapDocument {
  map: Record<string, ApliiqMapEntry>;
}

const ALLOWED_ENTRY_FIELDS = new Set<keyof ApliiqMapEntry>([
  "apliiqSku", "apliiqProductId", "apliiqVariantId", "apliiqDecorationSnapshot",
  "apliiqPrivateLabelSnapshot", "apliiqAssetUrls", "apliiqRegionAvailability",
  "apliiqSizeGuideReference", "apliiqMappingApproval", "apliiqSampleApproval",
  "squareMappingStatus", "costEstimate", "marginEstimate", "costVerifiedAt", "marginVerifiedAt",
  "weightOz", "apliiqItemCost", "apliiqShippingCost", "apliiqFulfillmentFeeCents",
  "apliiqDestinationTaxCents", "apliiqCostBasis", "marginFloorOverride", "apliiqSkuVerified",
]);

/**
 * Which APLIIQ price tier a captured cost came from. Absent means "standard",
 * so entries written before VIP existed keep validating.
 */
function costBasis(value: unknown, path: string): "standard" | "vip" | undefined {
  if (value === undefined) return undefined;
  if (value !== "standard" && value !== "vip") fail(path, 'must be "standard" or "vip"');
  return value;
}

/**
 * A per-variant margin-floor exception. Every field is required: an override
 * without a reason is how a temporary exception becomes permanent folklore.
 * A negative floor is refused — this permits a thin margin, never a loss.
 */
function marginFloorOverride(value: unknown, path: string) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) fail(path, "must be an object");
  const minRatio = value.minRatio;
  if (typeof minRatio !== "number" || !Number.isFinite(minRatio) || minRatio < 0 || minRatio > 1) {
    fail(`${path}.minRatio`, "must be a number between 0 and 1");
  }
  const reason = requiredString(value.reason, `${path}.reason`);
  const approvedAt = requiredString(value.approvedAt, `${path}.approvedAt`);
  return { minRatio, reason, approvedAt };
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") fail(path, "must be a boolean");
  return value;
}

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

function optionalCents(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  return cents(value, path);
}

/**
 * Shipped weight in ounces, capped at two decimals to match the
 * product_variants.weight_oz numeric(8,2) column and the fractional tier
 * ceilings of the APLIIQ rate ladder (7.9, 11.9, 143.99, 159.84 …).
 */
function weightOunces(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(path, "must be a finite positive number of ounces");
  }
  // Compare the ROUND-TRIPPED value, never `Math.round(v * 100) !== v * 100`.
  // `v * 100` is not exact in binary floating point — 4.35 * 100 is
  // 434.99999999999994 — so the naive form rejected 4,587 of the 48,000 legal
  // two-decimal weights between 0.01 and 480.00 oz, including everyday garment
  // weights like 4.35 and 4.40 oz. Dividing back by 100 is the same
  // normalization normalizeWeightOz() in lib/commerce/apliiq-shipping-rates.ts
  // applies before a tier lookup, and it still rejects a third decimal.
  if (Math.round(value * 100) / 100 !== value) {
    fail(path, "must have at most two decimal places");
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

function countryCodeList(value: unknown, path: string): string[] {
  const result = stringList(value, path);
  if (result.some((entry) => !/^[A-Z]{2}$/.test(entry))) {
    fail(path, "must contain uppercase ISO alpha-2 country codes");
  }
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

  const apliiqSku = requiredString(value.apliiqSku, `${path}.apliiqSku`);
  if (!isApliiqSku(apliiqSku)) fail(`${path}.apliiqSku`, "must be an APLIIQ APQ production SKU");

  return {
    apliiqSku,
    apliiqProductId: optionalString(value.apliiqProductId, `${path}.apliiqProductId`),
    apliiqVariantId: optionalString(value.apliiqVariantId, `${path}.apliiqVariantId`),
    apliiqDecorationSnapshot: structuredSnapshot(value.apliiqDecorationSnapshot, `${path}.apliiqDecorationSnapshot`),
    apliiqPrivateLabelSnapshot: structuredSnapshot(value.apliiqPrivateLabelSnapshot, `${path}.apliiqPrivateLabelSnapshot`),
    apliiqAssetUrls: assetUrls,
    apliiqRegionAvailability: countryCodeList(value.apliiqRegionAvailability, `${path}.apliiqRegionAvailability`),
    apliiqSizeGuideReference: requiredString(value.apliiqSizeGuideReference, `${path}.apliiqSizeGuideReference`),
    apliiqMappingApproval: approved(value.apliiqMappingApproval, `${path}.apliiqMappingApproval`),
    apliiqSampleApproval: approved(value.apliiqSampleApproval, `${path}.apliiqSampleApproval`),
    squareMappingStatus: active(value.squareMappingStatus, `${path}.squareMappingStatus`),
    costEstimate: cents(value.costEstimate, `${path}.costEstimate`),
    marginEstimate: cents(value.marginEstimate, `${path}.marginEstimate`),
    costVerifiedAt: isoTimestamp(value.costVerifiedAt, `${path}.costVerifiedAt`),
    marginVerifiedAt: isoTimestamp(value.marginVerifiedAt, `${path}.marginVerifiedAt`),
    // Required: freight is billed by weight tier, so an entry with no weight
    // cannot be margin-gated at all. The remaining landed-cost terms are
    // optional overrides — the rate ladder, the $1.00 per-product fee, and the
    // modelled destination tax supply the defaults.
    weightOz: weightOunces(value.weightOz, `${path}.weightOz`),
    apliiqItemCost: optionalCents(value.apliiqItemCost, `${path}.apliiqItemCost`),
    apliiqShippingCost: optionalCents(value.apliiqShippingCost, `${path}.apliiqShippingCost`),
    apliiqFulfillmentFeeCents: optionalCents(value.apliiqFulfillmentFeeCents, `${path}.apliiqFulfillmentFeeCents`),
    apliiqDestinationTaxCents: optionalCents(value.apliiqDestinationTaxCents, `${path}.apliiqDestinationTaxCents`),
    apliiqCostBasis: costBasis(value.apliiqCostBasis, `${path}.apliiqCostBasis`),
    marginFloorOverride: marginFloorOverride(value.marginFloorOverride, `${path}.marginFloorOverride`),
    apliiqSkuVerified: optionalBoolean(value.apliiqSkuVerified, `${path}.apliiqSkuVerified`),
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
