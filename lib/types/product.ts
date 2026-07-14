// Internal product data model — After Hours Agenda owns the storefront product layer.
// Printful v2 beta has no sync-products/templates, so AHA maps its own products/variants
// to Printful v2 catalog variants + files + placements. See docs/MASTER-BUILD-INSTRUCTION.md §13/§24.

export type ProductStatus =
  | "draft"
  | "coming_soon"
  | "active"
  | "hidden"
  | "sold_out"
  | "archived"
  | "discontinued";

export type VariantStatus =
  | "active"
  | "coming_soon"
  | "sold_out"
  | "unavailable"
  | "hidden"
  | "archived"
  | "manual_review";

export type ProductType =
  | "tee"
  | "hoodie"
  | "sweater"
  | "accessory"
  | "other";

export type ProductCategory =
  | "t-shirts"
  | "hoodies-sweatshirts"
  | "sweaters-knitwear"
  | "outerwear"
  | "accessories";

export type ProductGender = "men" | "women" | "unisex";

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
export interface PrintfulPlacement {
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

  costEstimate?: number; // minor units — from Printful, for margin
  marginEstimate?: number; // minor units
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

export interface SizeGuideMeasurement {
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

export interface Drop {
  id: string;
  slug: string;
  title: string;
  story: string;
  status: "upcoming" | "live" | "archived";
  launchDate?: string;
  heroImage?: string;
}

/** The full internal storefront dataset (composed from the /data manifest + maps). */
export interface ProductManifest {
  products: AhaProduct[];
}
