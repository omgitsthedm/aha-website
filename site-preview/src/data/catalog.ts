import manifest from "./launch-catalog.json" with { type: "json" };
export interface Variant {
  id: string;
  size: string;
  color: string;
  price: number;
  available: number;
  squareVariationId: string;
  providerSku: string;
  sampleApproved: boolean;
}
export interface Piece {
  slug: string;
  title: string;
  category: string;
  description: string;
  images: string[];
  imageNote: string;
  colors: string[];
  material: string;
  fit: string;
  care: string;
  variants: Variant[];
  status: "development" | "approved";
  verifiedOn?: string;
  countryOfOrigin?: string;
  labelEvidence?: string;
  qcEvidence?: string;
  measurements?: { size: string; chest: number; length: number }[];
}
export const developmentPieces: Piece[] = [
  {
    slug: "yikes",
    title: "Yikes",
    category: "Hoods & tees",
    description:
      "A downward swing, an open Y and a long underline. A familiar feeling, in our own handwriting.",
    images: ["/images/collection/yikes.webp"],
    imageNote:
      "Collection development mockup · not a photograph of a finished product",
    colors: ["Bone / Rose", "Navy / Cream", "White / Rose"],
    material:
      "Garment and decoration specifications are being confirmed. The image is a design study.",
    fit: "Final measurements and the size range will be published after sample approval.",
    care: "The finished garment label will be the authority. Care instructions are not yet confirmed.",
    variants: [],
    status: "development",
  },
  {
    slug: "insomniac",
    title: "Insomniac",
    category: "Hoods & crews",
    description:
      "Still awake. A sheep, a streetlight and a little company for the late hours.",
    images: ["/images/collection/insomniac.webp"],
    imageNote:
      "Collection development mockup · not a photograph of a finished product",
    colors: ["Navy / Cream + Red", "Black / Cream + Red"],
    material:
      "Garment and decoration specifications are being confirmed. The illustration is a development study.",
    fit: "Final measurements and the size range will follow approved physical samples.",
    care: "Follow the label on an existing piece. This development study does not establish new care instructions.",
    variants: [],
    status: "development",
  },
];
export const launch = manifest;
export const approvedPieces = manifest.products as Piece[];
export const pieces: Piece[] =
  process.env.AHA_PRODUCTION_BUILD === "approved"
    ? approvedPieces
    : [...approvedPieces, ...developmentPieces];
export function validateCatalog(products: Piece[], releaseApproved = false) {
  const errors: string[] = [];
  const slugs = new Set<string>();
  const ids = new Set<string>();
  for (const p of products) {
    if (!/^[a-z0-9-]+$/.test(p.slug) || slugs.has(p.slug))
      errors.push("Invalid or duplicate product slug");
    slugs.add(p.slug);
    if (
      p.status !== "approved" ||
      !p.verifiedOn ||
      !p.title ||
      !p.description ||
      !p.material ||
      !p.fit ||
      !p.care ||
      !p.images.length ||
      !p.variants.length ||
      !p.measurements?.length
    )
      errors.push(p.slug + ": incomplete approved product");
    if (!p.countryOfOrigin || !p.labelEvidence || !p.qcEvidence)
      errors.push(p.slug + ": origin, label and physical QC evidence required");
    if (
      p.images.some(
        (src) =>
          !/^\/images\/[a-zA-Z0-9_./-]+\.(webp|jpg|png)$/.test(src) ||
          src.includes(".."),
      )
    )
      errors.push(p.slug + ": unsafe image path");
    if (
      p.measurements?.some(
        (row) =>
          !row.size ||
          !Number.isFinite(row.chest) ||
          row.chest <= 0 ||
          !Number.isFinite(row.length) ||
          row.length <= 0,
      )
    )
      errors.push(p.slug + ": invalid measurement");
    for (const v of p.variants) {
      if (
        ids.has(v.id) ||
        !v.id ||
        !v.size ||
        !v.color ||
        !Number.isSafeInteger(v.price) ||
        v.price < 1 ||
        !Number.isSafeInteger(v.available) ||
        v.available < 0 ||
        !v.squareVariationId ||
        !/^APQ-/.test(v.providerSku) ||
        !v.sampleApproved
      )
        errors.push(p.slug + ": invalid variant");
      if (!p.measurements?.some((row) => row.size === v.size))
        errors.push(p.slug + ": missing size measurement");
      ids.add(v.id);
    }
  }
  if (releaseApproved && !products.length)
    errors.push("An empty catalog cannot open checkout");
  return errors;
}
