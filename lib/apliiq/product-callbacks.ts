import { createHash, timingSafeEqual } from "node:crypto";
import { providerProductDrafts } from "@/db/schema";
import { db, isDbConfigured } from "@/lib/db/client";
import { loadProducts } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import { isApliiqSku } from "@/lib/apliiq/orders";

const CALLBACK_TOKEN_ENV = "APLIIQ_PRODUCT_CALLBACK_TOKEN";
const MAX_STRING_LENGTH = 512;
const MAX_IMAGES = 32;
const MAX_VARIANTS = 256;
const MAX_ADDITIONAL_METADATA_BYTES = 64 * 1024;

export interface ApliiqAddToStoreVariant {
  sku: string;
  price: number;
  color: string;
  size: string;
  imageUrl?: string;
  weight?: number;
  weightUnit?: string;
  default?: boolean;
  width?: number;
  height?: number;
  length?: number;
  dimensionUnit?: string;
  additionalFields?: Record<string, unknown>;
}

export interface ApliiqAddToStorePayload {
  store_ProductId: string | null;
  shippingProfileId: string | null;
  type: string;
  name: string;
  currency: string;
  taxonomyId: string | null;
  description: string | null;
  imageUrls: string[];
  replaceProduct: boolean;
  sizes: string[];
  colors: string[];
  variants: ApliiqAddToStoreVariant[];
  additionalFields?: Record<string, unknown>;
}

export interface ApliiqProductSearchResult {
  store_ProductId: string;
  name: string;
  imageUrls: string[];
}

export class ApliiqProductCallbackValidationError extends Error {}
export class ApliiqProductCallbackUnavailableError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, field: string, maxLength = MAX_STRING_LENGTH): string {
  if (typeof value !== "string" || value.trim() === "" || value.trim().length > maxLength) {
    throw new ApliiqProductCallbackValidationError(`${field} must be a nonempty string no longer than ${maxLength} characters.`);
  }
  return value.trim();
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return nonEmptyString(value, field);
}

function httpsUrl(value: unknown, field: string): string {
  const url = nonEmptyString(value, field, 2048);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApliiqProductCallbackValidationError(`${field} must be an absolute HTTPS URL.`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new ApliiqProductCallbackValidationError(`${field} must be an absolute HTTPS URL without credentials.`);
  }
  return url;
}

function stringList(value: unknown, field: string, maximum: number): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    throw new ApliiqProductCallbackValidationError(`${field} must contain between 1 and ${maximum} values.`);
  }
  const values = value.map((item, index) => nonEmptyString(item, `${field}[${index}]`));
  if (new Set(values).size !== values.length) {
    throw new ApliiqProductCallbackValidationError(`${field} must not contain duplicates.`);
  }
  return values;
}

function imageList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IMAGES) {
    throw new ApliiqProductCallbackValidationError(`${field} must contain between 1 and ${MAX_IMAGES} HTTPS images.`);
  }
  const values = value.map((item, index) => httpsUrl(item, `${field}[${index}]`));
  // APLIIQ's own documented sample repeats a product URL. Normalize it while
  // preserving first-seen order instead of rejecting a valid callback.
  return [...new Set(values)];
}

function positiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new ApliiqProductCallbackValidationError(`${field} must be a positive finite number.`);
  }
  return value;
}

function nonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ApliiqProductCallbackValidationError(`${field} must be a nonnegative finite number.`);
  }
  return value;
}

function optionalNonNegativeNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  return nonNegativeNumber(value, field);
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return nonEmptyString(value, field);
}

function additionalFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): Record<string, unknown> | undefined {
  const entries = Object.entries(value).filter(([key]) => !allowed.includes(key));
  if (entries.length === 0) return undefined;
  const extra = Object.fromEntries(entries);
  if (Buffer.byteLength(JSON.stringify(extra), "utf8") > MAX_ADDITIONAL_METADATA_BYTES) {
    throw new ApliiqProductCallbackValidationError(
      `${field} contains more than ${MAX_ADDITIONAL_METADATA_BYTES} bytes of additional metadata.`,
    );
  }
  return extra;
}

function parseVariant(value: unknown, index: number, imageUrls: Set<string>): ApliiqAddToStoreVariant {
  const field = `variants[${index}]`;
  if (!isRecord(value)) throw new ApliiqProductCallbackValidationError(`${field} must be an object.`);
  const allowedFields = [
    "sku", "price", "color", "size", "imageUrl", "weight", "weightUnit", "default",
    "width", "height", "length", "dimensionUnit",
  ] as const;
  const extra = additionalFields(value, allowedFields, field);

  const sku = nonEmptyString(value.sku, `${field}.sku`, 128);
  if (!isApliiqSku(sku)) {
    throw new ApliiqProductCallbackValidationError(`${field}.sku must be an uppercase APLIIQ APQ SKU.`);
  }
  const imageUrl = value.imageUrl === undefined ? undefined : httpsUrl(value.imageUrl, `${field}.imageUrl`);
  if (imageUrl && !imageUrls.has(imageUrl)) {
    throw new ApliiqProductCallbackValidationError(`${field}.imageUrl must appear in imageUrls.`);
  }
  if (value.default !== undefined && typeof value.default !== "boolean") {
    throw new ApliiqProductCallbackValidationError(`${field}.default must be a boolean.`);
  }
  return {
    sku,
    price: positiveNumber(value.price, `${field}.price`),
    color: nonEmptyString(value.color, `${field}.color`),
    size: nonEmptyString(value.size, `${field}.size`),
    ...(imageUrl ? { imageUrl } : {}),
    ...(value.weight === undefined ? {} : { weight: nonNegativeNumber(value.weight, `${field}.weight`) }),
    ...(value.weightUnit === undefined ? {} : { weightUnit: nonEmptyString(value.weightUnit, `${field}.weightUnit`, 16) }),
    ...(value.default === undefined ? {} : { default: value.default }),
    ...(value.width === undefined ? {} : { width: optionalNonNegativeNumber(value.width, `${field}.width`) }),
    ...(value.height === undefined ? {} : { height: optionalNonNegativeNumber(value.height, `${field}.height`) }),
    ...(value.length === undefined ? {} : { length: optionalNonNegativeNumber(value.length, `${field}.length`) }),
    ...(value.dimensionUnit === undefined ? {} : { dimensionUnit: optionalString(value.dimensionUnit, `${field}.dimensionUnit`) }),
    ...(extra ? { additionalFields: extra } : {}),
  };
}

/** Parse the documented fields while retaining bounded future provider metadata. */
export function parseApliiqAddToStorePayload(value: unknown): ApliiqAddToStorePayload {
  if (!isRecord(value)) throw new ApliiqProductCallbackValidationError("Payload must be a JSON object.");
  const allowedFields = [
    "store_ProductId", "shippingProfileId", "type", "name", "currency", "taxonomyId", "description",
    "imageUrls", "replaceProduct", "sizes", "colors", "variants",
  ] as const;
  const extra = additionalFields(value, allowedFields, "payload");
  if (typeof value.replaceProduct !== "boolean") {
    throw new ApliiqProductCallbackValidationError("replaceProduct must be a boolean.");
  }
  const imageUrls = imageList(value.imageUrls, "imageUrls");
  const sizes = stringList(value.sizes, "sizes", MAX_VARIANTS);
  const colors = stringList(value.colors, "colors", MAX_VARIANTS);
  if (!Array.isArray(value.variants) || value.variants.length === 0 || value.variants.length > MAX_VARIANTS) {
    throw new ApliiqProductCallbackValidationError(`variants must contain between 1 and ${MAX_VARIANTS} entries.`);
  }
  const variants = value.variants.map((variant, index) => parseVariant(variant, index, new Set(imageUrls)));
  const skus = variants.map((variant) => variant.sku);
  if (new Set(skus).size !== skus.length) {
    throw new ApliiqProductCallbackValidationError("variants must not contain duplicate APQ SKUs.");
  }
  if (variants.some((variant) => !sizes.includes(variant.size) || !colors.includes(variant.color))) {
    throw new ApliiqProductCallbackValidationError("Each variant color and size must be declared by colors and sizes.");
  }

  const currency = nonEmptyString(value.currency, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ApliiqProductCallbackValidationError("currency must be a three-letter ISO currency code.");
  }
  return {
    store_ProductId: nullableString(value.store_ProductId, "store_ProductId"),
    shippingProfileId: nullableString(value.shippingProfileId, "shippingProfileId"),
    type: nonEmptyString(value.type, "type"),
    name: nonEmptyString(value.name, "name"),
    currency,
    taxonomyId: nullableString(value.taxonomyId, "taxonomyId"),
    description: nullableString(value.description, "description"),
    imageUrls,
    replaceProduct: value.replaceProduct,
    sizes,
    colors,
    variants,
    ...(extra ? { additionalFields: extra } : {}),
  };
}

function safeTokenEqual(expected: string, received: string | null): boolean {
  if (!received || received.length > 1024) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * APLIIQ documents no signature for the catalog callbacks. They remain off
 * unless a separate, server-only callback token is configured; this never
 * accepts the APLIIQ shared-secret or API credential.
 */
export function isAuthorizedApliiqProductCallback(request: Request): boolean {
  const expected = (process.env[CALLBACK_TOKEN_ENV] || "").trim();
  if (!expected || expected.length > 1024) return false;
  const url = new URL(request.url);
  return safeTokenEqual(expected, request.headers.get("x-apliiq-callback-token"))
    || safeTokenEqual(expected, url.searchParams.get("token"));
}

export function isApliiqProductCallbackConfigured(): boolean {
  return Boolean((process.env[CALLBACK_TOKEN_ENV] || "").trim());
}

function reviewDraftId(payload: ApliiqAddToStorePayload): string {
  if (payload.store_ProductId) return payload.store_ProductId;
  // The Add to Store sample permits null. A deterministic internal review ID
  // makes retries idempotent without pretending a public storefront product
  // has been created.
  const skus = payload.variants.map((variant) => variant.sku).sort().join("\n");
  return `review:apliiq:${createHash("sha256").update(skus).digest("hex").slice(0, 32)}`;
}

export async function upsertApliiqProductDraft(payload: ApliiqAddToStorePayload): Promise<string> {
  if (!isDbConfigured()) throw new ApliiqProductCallbackUnavailableError("Product draft storage is not configured.");
  const providerProductId = reviewDraftId(payload);
  const receivedAt = new Date();
  try {
    for (const variant of payload.variants) {
      await db().insert(providerProductDrafts).values({
        provider: "apliiq",
        providerProductId,
        providerVariantId: variant.sku,
        providerSku: variant.sku,
        status: "pending_review",
        payloadJson: payload,
        receivedAt,
      }).onConflictDoUpdate({
        target: [
          providerProductDrafts.provider,
          providerProductDrafts.providerProductId,
          providerProductDrafts.providerVariantId,
        ],
        // A provider re-send requires a fresh human review. This never writes
        // products, APLIIQ maps, Square rows, or an active storefront state.
        set: {
          providerSku: variant.sku,
          status: "pending_review",
          payloadJson: payload,
          receivedAt,
          reviewedAt: null,
          updatedAt: receivedAt,
        },
      });
    }
  } catch {
    throw new ApliiqProductCallbackUnavailableError("Product draft storage is temporarily unavailable.");
  }
  return providerProductId;
}

/**
 * This is intentionally file-backed rather than database-backed: only the
 * committed, structurally approved APLIIQ mapping is eligible for lookup.
 * Incoming drafts and legacy Printful product rows are never returned.
 */
export function searchApprovedApliiqProducts(search: string): ApliiqProductSearchResult[] {
  const needle = search.trim().toLocaleLowerCase();
  if (needle.length > 256) return [];
  return loadProducts()
    .flatMap((product): ApliiqProductSearchResult[] => {
      const approved = product.variants.filter((variant) => (
        variant.fulfillmentProvider === "apliiq"
        && checkVariantPurchasable(product, variant).ok
      ));
      if (approved.length === 0) return [];
      const searchable = [product.ahaProductId, product.slug, product.title, ...approved.map((variant) => variant.apliiqSku || "")]
        .join(" ")
        .toLocaleLowerCase();
      if (needle !== "" && !searchable.includes(needle)) return [];
      const mappedAssets = approved
        .flatMap((variant) => variant.apliiqAssetUrls || []);
      const imageUrls = [...new Set(mappedAssets)]
        .filter((url) => url.startsWith("https://"));
      // The documented search result requires images. Never advertise an
      // approved product to APLIIQ with an empty or unusable media contract.
      if (imageUrls.length === 0) return [];
      return [{
        store_ProductId: product.ahaProductId,
        name: product.title,
        imageUrls,
      }];
    })
    .slice(0, 50);
}
