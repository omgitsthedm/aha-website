/**
 * The legacy Printful/Square catalog is deliberately dark while the Apliiq
 * migration is prepared. Keep this as a small, committed switch instead of
 * changing historical manifests or provider mappings: those records remain the
 * audit and rollback source until the replacement catalog is independently
 * verified.
 *
 * Re-opening sale requires an intentional replacement of this policy together
 * with the new provider's verified catalog mapping; do not toggle it from an
 * environment variable or a client-controlled value.
 */
export const LEGACY_CATALOG_POLICY = Object.freeze({
  publicCatalogEnabled: false,
  checkoutEnabled: false,
  reason: "Apliiq provider migration in progress",
} as const);

/**
 * The APLIIQ capsule sells while the legacy catalog stays dark.
 *
 * These are two different questions and conflating them is dangerous. Flipping
 * LEGACY_CATALOG_POLICY to true was measured on 2026-08-18 to make **1,005
 * legacy Printful variants** purchasable again — products whose Square items are
 * archived, whose public artwork was deleted in the reset, whose provider is
 * retired, and which include SKUs deliberately withdrawn for IP and platform
 * policy risk. Not one of them could be fulfilled.
 *
 * So the gate is per-provider, not global. A product is sellable only if it is
 * mapped to APLIIQ; everything still on the Printful path stays closed no matter
 * what this file says.
 */
export const APLIIQ_CATALOG_POLICY = Object.freeze({
  publicCatalogEnabled: true,
  checkoutEnabled: true,
  reason: "Apliiq capsule live; order submission still gated by APLIIQ_ALLOW_CREATE_ORDERS",
} as const);

/**
 * Is the storefront open at all?
 *
 * Distinct from isLegacyCatalogPublic, which answers the narrower "may LEGACY
 * products be shown". Route-level gates want this one: the shop, category, PDP
 * and checkout pages should render whenever anything is sellable. What keeps the
 * retired catalog out is not the route gate — it is the per-variant provider
 * filter in buildEligibleSquareIndex and buildPreviewProducts.
 */
export function isStorefrontPublic(): boolean {
  return LEGACY_CATALOG_POLICY.publicCatalogEnabled || APLIIQ_CATALOG_POLICY.publicCatalogEnabled;
}

/** True only for a variant on the APLIIQ path. Printful variants are never sellable. */
export function isSellableProvider(fulfillmentProvider: string | undefined): boolean {
  return fulfillmentProvider === "apliiq" && APLIIQ_CATALOG_POLICY.publicCatalogEnabled;
}

/** Whether legacy catalog data may be returned by any public storefront surface. */
export function isLegacyCatalogPublic(): boolean {
  return LEGACY_CATALOG_POLICY.publicCatalogEnabled;
}

/**
 * Server-side checkout guard. This must stay independent of the public catalog
 * projection so a saved browser cart cannot reach Square pricing after the
 * catalog has been hidden.
 */
export function assertLegacyCatalogCheckoutAllowed(): void {
  if (!LEGACY_CATALOG_POLICY.checkoutEnabled && !APLIIQ_CATALOG_POLICY.checkoutEnabled) {
    throw new Error("The store is being updated. Existing items cannot be purchased right now.");
  }
}

/**
 * Per-line checkout guard. assertLegacyCatalogCheckoutAllowed answers "is the
 * till open at all"; this answers "may THIS line be sold", which is the question
 * that keeps a saved browser cart full of legacy Printful items from checking
 * out now that the till is open for the capsule.
 */
export function assertVariantSellable(fulfillmentProvider: string | undefined, label: string): void {
  if (!isSellableProvider(fulfillmentProvider)) {
    throw new Error(`${label} is no longer available.`);
  }
}
