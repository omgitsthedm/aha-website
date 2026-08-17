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
  if (!LEGACY_CATALOG_POLICY.checkoutEnabled) {
    throw new Error("The store is being updated. Existing items cannot be purchased right now.");
  }
}
