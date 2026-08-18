// Internal product data model — After Hours Agenda owns the storefront product layer.
// Printful v2 beta has no sync-products/templates, so AHA maps its own products/variants
// to Printful v2 catalog variants, files, and placements. See docs/product-factory.md.

type ProductStatus =
  | "draft"
  | "coming_soon"
  | "active"
  | "hidden"
  | "sold_out"
  | "archived"
  | "discontinued";

type VariantStatus =
  | "active"
  | "coming_soon"
  | "sold_out"
  | "unavailable"
  | "hidden"
  | "archived"
  | "manual_review";

type ProductType =
  | "tee"
  | "hoodie"
  | "sweater"
  | "accessory"
  | "other";

type ProductCategory =
  | "t-shirts"
  | "hoodies-sweatshirts"
  | "sweaters-knitwear"
  | "outerwear"
  | "accessories";

type ProductGender = "men" | "women" | "unisex";

/** The fulfillment system that produces a purchased variant. */
export type FulfillmentProvider = "printful" | "apliiq";

export type PrintTechnique =
  | "dtg"
  | "dtf"
  | "dtfilm"
  | "embroidery"
  | "sublimation"
  | "cut-sew"
  | "sticker"
  | "digital"
  | "knitting"
  | "knitwear"
  | "phone-case";

/** A single print placement on a garment (front, back, sleeve, …). */
interface PrintfulPlacement {
  placement: string; // e.g. "front", "back", "sleeve_left"
  technique: PrintTechnique;
  /** Stable, versioned production-file URL OR a Printful file id (one required). */
  fileUrl?: string;
  fileId?: number;
  /** Print position in inches for catalog-source fulfillment. areaWidth/areaHeight
   *  record the blank's print-area size so the v1 order API (pixel-based, 150dpi)
   *  can express the same box. */
  position?: { width: number; height: number; top: number; left: number; areaWidth?: number; areaHeight?: number };
  /** Where the original design source lives (internal reference, not shipped). */
  sourcePath?: string;
  /** Approval / print-test state before a variant may go live. */
  approvalStatus?: "pending" | "approved" | "rejected";
}

/** AHA variant — the purchasable unit. Maps to Square + Printful v2 catalog. */
export interface AhaVariant {
  ahaVariantId: string;
  ahaProductId: string;
  sku: string;
  size: string;
  color?: string;
  retailPrice: number; // minor units (cents)
  currency: string;
  status: VariantStatus;
  sortOrder: number;

  /** Defaults to Printful for legacy catalog rows. APLIIQ rows must carry the
   * structural approval data below before they can be sold. */
  fulfillmentProvider?: FulfillmentProvider;

  // Square mapping (payments/orders source of truth)
  squareCatalogObjectId?: string;
  squareVariationId?: string;
  squareLocationId?: string;

  // Printful v2 mapping (fulfillment source of truth)
  printfulCatalogProductId?: number;
  printfulCatalogVariantId?: number;
  /** Store sync-variant id — carries the configured print art server-side; the fulfillment key. */
  printfulSyncVariantId?: number;
  /** Which Printful store the sync variant lives in (Square-integrated vs native/API store). */
  printfulStoreId?: number;
  printfulSource: "catalog" | "sync_variant";
  printfulRegionAvailability?: string[];
  printfulPlacements?: PrintfulPlacement[];
  /** Required product options for ordering (e.g. cut-sew stitch_color). */
  printfulProductOptions?: { name: string; value: string | boolean | number }[];
  printfulTechnique?: PrintTechnique;
  printfulSizeGuideReference?: string;

  // APLIIQ mapping (fulfillment source of truth when fulfillmentProvider is "apliiq")
  // This is deliberately data-only: provider calls and product creation happen elsewhere.
  apliiqSku?: string;
  apliiqProductId?: string;
  apliiqVariantId?: string;
  apliiqDecorationSnapshot?: Record<string, unknown>;
  apliiqPrivateLabelSnapshot?: Record<string, unknown>;
  apliiqAssetUrls?: string[];
  apliiqRegionAvailability?: string[];
  apliiqSizeGuideReference?: string;
  apliiqMappingApproval?: "pending" | "approved" | "rejected";
  apliiqSampleApproval?: "pending" | "approved" | "rejected";
  /** A Square mapping is not sale-ready until its operator-confirmed state is active. */
  squareMappingStatus?: "active" | "pending" | "archived";

  // ── APLIIQ landed cost (see lib/commerce/landed-cost.ts) ───────────────────
  // APLIIQ bills product cost, freight, and a per-product fulfillment fee as
  // three separate lines, so a margin gate that only knows product cost is
  // wrong by roughly a quarter of the retail price on a tee.
  /** Provider product cost for one unit, minor units. Must agree with costEstimate when both are set. */
  apliiqItemCost?: number;
  /** Conservative single-unit tier freight, minor units. May only ever exceed the published tier rate. */
  apliiqShippingCost?: number;
  /** Per-PRODUCT fulfillment fee, minor units. Defaults to the rate sheet's $1.00 per unit. */
  apliiqFulfillmentFeeCents?: number;
  /** Destination sales tax on the provider invoice, minor units. Overrides the modelled rate. */
  apliiqDestinationTaxCents?: number;
  /**
   * Which APLIIQ price tier apliiqItemCost was captured at.
   *
   * VIP is a flat 20% off products and services. Buying it AFTER cost capture
   * makes every captured cost wrong by 20%, and purchasable.ts reconciles the
   * stored marginEstimate against the recomputed landed figure by exact
   * equality — so the day VIP lands, every APLIIQ variant fails validation.
   * Recording the basis makes that a scripted re-derive instead of a manual
   * pass, and stops a re-derive run twice from double-discounting.
   *
   * Absent is read as "standard" for backward compatibility.
   */
  apliiqCostBasis?: "standard" | "vip";
  /**
   * A knowing exception to the margin floor for THIS variant.
   *
   * The 35% floor is AHA's own rule, not a law, and a merchant may legitimately
   * choose to run an anchor product thin. What must never happen is the floor
   * being quietly lowered for the whole catalog to let one product through, so
   * the exception is per-variant, carries a required reason, and is visible in
   * margin-check output rather than silent.
   *
   * `minRatio` still floors at zero: this permits a thin margin, never a loss.
   */
  marginFloorOverride?: { minRatio: number; reason: string; approvedAt: string };
  /**
   * Shipped weight in ounces (2dp). Addresses the irregular APLIIQ rate ladder,
   * whose tier ceilings (7.9, 11.9 … 143.99, 159.84) are not whole ounces.
   */
  weightOz?: number;

  costEstimate?: number; // minor units — from Printful, for margin
  marginEstimate?: number; // minor units
  costVerifiedAt?: string;
  marginVerifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** AHA product — storytelling + storefront metadata (AHA-owned). */
export interface AhaProduct {
  ahaProductId: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  productType: ProductType;
  category: ProductCategory;
  gender: ProductGender[];
  collectionIds: string[];
  dropId?: string;
  status: ProductStatus;
  launchDate?: string;
  retailPrice: number; // minor units (default/display; variants may override)
  currency: string;

  fitDescription: string;
  fabricDescription: string;
  garmentWeight?: string;
  printMethod: string;
  careInstructions: string;
  productionNote: string;
  shippingNote: string;
  returnsNote: string;
  sizeGuideId: string;

  featuredImage: string;
  galleryImages: string[];
  lifestyleImages?: string[];

  seoTitle: string;
  seoDescription: string;
  ogImage: string;

  badges?: string[]; // "new" | "limited" | "restocked" | "best_seller" — only when true
  sortPriority?: number;
  createdAt?: string;
  updatedAt?: string;

  variants: AhaVariant[];
}

interface SizeGuideMeasurement {
  size: string;
  chestIn?: number;
  lengthIn?: number;
  sleeveIn?: number;
  shoulderIn?: number;
  waistIn?: number;
  inseamIn?: number;
}

export interface SizeGuide {
  id: string;
  productType: ProductType;
  fit: string; // "true to size" | "relaxed" | "boxy" | "oversized" | ...
  measurements: SizeGuideMeasurement[]; // inches; cm derived at render
  howToMeasure?: string;
  modelSizing?: string;
  sizeUpIf?: string;
  sizeDownIf?: string;
}
