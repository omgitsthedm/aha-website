#!/usr/bin/env tsx
/**
 * Safe end-to-end publisher for one selected APLIIQ capsule product.
 *
 * Dry-run is the default and performs only local reads. `--apply` is required
 * before this command can create or converge the APLIIQ design, landed-cost map,
 * Square item/media/copy, or local product files. Every provider result is
 * revalidated before the next stage, and approval evidence is never inferred.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { buildPreviewProducts } from "@/lib/data/preview-catalog";
import { loadProducts } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import { isSellableProvider, isStorefrontPublic } from "@/lib/commerce/catalog-policy";
import { buildProductFeed } from "@/lib/seo/product-feed";
import { computeSellableSlugs } from "@/scripts/generate-sellable-slugs";
import { parseApliiqMapDocument, type ApliiqMapEntry } from "@/lib/data/apliiq-map";
import {
  capsuleApprovalFingerprint,
  resolveCapsuleVariantApprovals,
  type CapsuleApprovalMetadata,
  type CapsuleProductProductionIdentity,
} from "@/scripts/lib/apliiq-capsule-approvals";
import {
  assertApliiqDesignIdentity,
  isCompleteDesignRecord,
  type DesignCreationState,
} from "@/scripts/lib/apliiq-capsule-creation";

const REQUIRED_IMAGES = ["front", "detail", "art"] as const;
const APQ_A1 = /^APQ-\d+S\d+A1$/;
const SIZE_ALIASES: Record<string, string> = { XXL: "2XL", XXXL: "3XL" };
export const COMMITTABLE_PRODUCT_FILES = new Set([
  "data/apliiq-capsule.json",
  "data/apliiq-capsule-designs.json",
  "data/apliiq-map.json",
  "data/product-manifest.json",
  "lib/commerce/sellable-slugs.generated.ts",
]);
const PUBLISHER_CONTINUATION: unique symbol = Symbol("aha-publisher-continuation");

interface CapsuleProduct {
  slug: string;
  title?: string;
  productCode?: string;
  frontLocationId?: number;
  productType?: string;
  sizeGuideId?: string;
  fabricDescription?: string;
  retailPrice?: number;
  sizeRetail?: Record<string, number>;
  artworkUrl?: string;
  mockupUrl?: string;
  printNote?: string;
  story?: string;
  approvals?: CapsuleApprovalMetadata;
  square?: { itemId?: string; variations?: Record<string, string> };
}
interface CapsuleSpec {
  colorId?: number;
  service?: string;
  privateLabelStatus?: "not-attached";
  products?: CapsuleProduct[];
}
interface PublisherArgs {
  slug: string;
  apply: boolean;
  commit: boolean;
  push: boolean;
}
export interface PublisherContinuation {
  readonly [PUBLISHER_CONTINUATION]: true;
  readonly branch: string;
  readonly head: string;
}
export interface PublishSourcePreflight {
  slug: string;
  title: string;
  images: string[];
  sizeGuideId: string;
  priorMappedVariants: number;
}
export interface PublishDesignPreflight extends PublishSourcePreflight {
  sizes: string[];
  designId: number;
  variantCount: number;
}
export interface PublishPreflight extends PublishDesignPreflight {
  itemId: string;
}

export class PreparationMissingError extends Error {
  constructor(readonly step: "apliiq-design" | "square-mapping", message: string) {
    super(message);
    this.name = "PreparationMissingError";
  }
}

function readJson<T>(file: string): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch (error) {
    throw new Error(`Cannot read valid JSON from ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readApliiqMap(root: string): Record<string, ApliiqMapEntry> {
  const file = join(root, "data", "apliiq-map.json");
  if (!existsSync(file)) return {};
  return parseApliiqMapDocument(readJson<unknown>(file)).map;
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeCapsuleSize(value: string): string {
  const upper = value.trim().toUpperCase();
  return SIZE_ALIASES[upper] ?? upper;
}

function requiredImage(root: string, slug: string, stem: typeof REQUIRED_IMAGES[number]): string {
  const dir = join(root, "public", "products", slug);
  for (const extension of ["jpg", "jpeg", "png"]) {
    const file = join(dir, `${stem}.${extension}`);
    if (existsSync(file) && statSync(file).isFile() && statSync(file).size > 0) return file;
  }
  throw new Error(`${slug}: missing nonempty product image public/products/${slug}/${stem}.jpg (jpeg/png also accepted)`);
}

/** Read-only, fail-closed staged validation used before and between provider steps. */
export function preflightApliiqProduct(root: string, slug: string): PublishPreflight;
export function preflightApliiqProduct(root: string, slug: string, stage: "source"): PublishSourcePreflight;
export function preflightApliiqProduct(root: string, slug: string, stage: "design"): PublishDesignPreflight;
export function preflightApliiqProduct(root: string, slug: string, stage: "complete"): PublishPreflight;
export function preflightApliiqProduct(
  root: string,
  slug: string,
  stage: "source" | "design" | "complete" = "complete",
): PublishSourcePreflight | PublishDesignPreflight | PublishPreflight {
  if (!nonempty(slug)) throw new Error("A selected --slug is required.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid product slug: ${slug}`);

  const specPath = join(root, "data", "apliiq-capsule.json");
  if (!existsSync(specPath)) throw new Error(`Missing capsule spec: ${specPath}`);
  const spec = readJson<CapsuleSpec>(specPath);
  if (!Array.isArray(spec.products)) throw new Error("Capsule spec has no products array.");
  const matches = spec.products.filter((entry) => entry.slug === slug);
  if (matches.length !== 1) throw new Error(`${slug}: expected exactly one product in data/apliiq-capsule.json; found ${matches.length}`);
  const product = matches[0];

  const requiredText: Array<[string, unknown]> = [
    ["title", product.title],
    ["productCode", product.productCode],
    ["productType", product.productType],
    ["sizeGuideId", product.sizeGuideId],
    ["fabricDescription", product.fabricDescription],
    ["artworkUrl", product.artworkUrl],
    ["mockupUrl", product.mockupUrl],
    ["printNote", product.printNote],
    ["story", product.story],
    ["service", spec.service],
  ];
  for (const [field, value] of requiredText) {
    if (!nonempty(value)) throw new Error(`${slug}: missing ${field} in the capsule spec`);
  }
  if (spec.privateLabelStatus !== "not-attached") {
    throw new Error(`${slug}: privateLabelStatus must be explicitly \"not-attached\" until APLIIQ design attachment is implemented and provider-verified`);
  }
  for (const [field, value] of [["artworkUrl", product.artworkUrl], ["mockupUrl", product.mockupUrl]] as const) {
    try {
      if (new URL(value!).protocol !== "https:") throw new Error("not HTTPS");
    } catch {
      throw new Error(`${slug}: ${field} must be a valid HTTPS URL`);
    }
  }
  if (!Number.isInteger(product.frontLocationId) || product.frontLocationId! <= 0) throw new Error(`${slug}: missing valid frontLocationId`);
  if (!Number.isInteger(spec.colorId) || spec.colorId! <= 0) throw new Error(`${slug}: missing valid colorId`);
  if (!Number.isInteger(product.retailPrice) || product.retailPrice! <= 0) throw new Error(`${slug}: missing positive integer retailPrice in cents`);
  for (const [size, price] of Object.entries(product.sizeRetail ?? {})) {
    if (!Number.isInteger(price) || price <= 0) throw new Error(`${slug}: sizeRetail.${size} must be positive integer cents`);
  }
  if (!/<p(?:\s|>)/i.test(product.story!)) throw new Error(`${slug}: story must contain authored paragraph HTML`);

  const images = REQUIRED_IMAGES.map((stem) => requiredImage(root, slug, stem));

  const sizeGuidesPath = join(root, "data", "size-guides.json");
  if (!existsSync(sizeGuidesPath)) throw new Error(`${slug}: missing data/size-guides.json`);
  const sizeGuides = readJson<{ sizeGuides?: Array<{ id?: string; measurements?: Array<{ size?: string }> }> }>(sizeGuidesPath).sizeGuides;
  const sizeGuide = sizeGuides?.find((guide) => guide.id === product.sizeGuideId);
  if (!sizeGuide) throw new Error(`${slug}: size guide ${product.sizeGuideId} does not exist`);
  if (!Array.isArray(sizeGuide.measurements) || sizeGuide.measurements.length === 0) throw new Error(`${slug}: size guide ${product.sizeGuideId} has no measurements`);
  const guideSizes = new Set(sizeGuide.measurements.map((entry) => normalizeCapsuleSize(entry.size ?? "")));
  const existingMap = readApliiqMap(root);
  const priorMappedVariants = Object.keys(existingMap).filter((key) => key.startsWith(`${slug}-`)).length;
  // Approval binding includes provider-assigned design/artwork ids and APQ SKUs,
  // so source preflight deliberately permits design preparation. No later stage
  // is allowed through until the exact post-design fingerprint is approved.
  const source: PublishSourcePreflight = {
    slug,
    title: product.title!,
    images: images.map((file) => file.slice(resolve(root).length + 1)),
    sizeGuideId: product.sizeGuideId!,
    priorMappedVariants,
  };
  if (stage === "source") return source;

  const designsPath = join(root, "data", "apliiq-capsule-designs.json");
  if (!existsSync(designsPath)) throw new PreparationMissingError("apliiq-design", `${slug}: APLIIQ design registry will be generated under --apply`);
  const design = readJson<{ designs?: Record<string, DesignCreationState> }>(designsPath).designs?.[slug];
  if (!design) throw new PreparationMissingError("apliiq-design", `${slug}: APLIIQ design will be created under --apply`);
  assertApliiqDesignIdentity(product as Required<Pick<CapsuleProduct, "slug" | "title" | "productCode" | "frontLocationId" | "artworkUrl" | "mockupUrl" | "printNote">>, {
    colorId: spec.colorId!,
    service: spec.service!,
  }, design);
  if (!isCompleteDesignRecord(design)) throw new Error(`${slug}: APLIIQ design creation is incomplete`);
  if (!Number.isInteger(design.designId) || design.designId <= 0) throw new Error(`${slug}: APLIIQ design has no valid designId`);
  if (!Number.isInteger(design.artworkId) || design.artworkId <= 0) throw new Error(`${slug}: APLIIQ design has no valid artworkId`);
  if (!Array.isArray(design.variants) || design.variants.length === 0) throw new Error(`${slug}: APLIIQ design has no variants`);

  const productionIdentity: CapsuleProductProductionIdentity = {
    slug,
    productCode: product.productCode!,
    colorId: spec.colorId!,
    frontLocationId: product.frontLocationId!,
    designId: design.designId,
    artworkId: design.artworkId,
    artworkUrl: product.artworkUrl!,
    service: spec.service!,
    printNote: product.printNote!,
    privateLabelStatus: spec.privateLabelStatus,
    sizeGuideId: product.sizeGuideId!,
    variants: design.variants.map(({ size, sku }) => ({ size, sku })),
  };
  const expectedApprovalFingerprint = capsuleApprovalFingerprint(productionIdentity);
  const sizes: string[] = [];
  const seenSizes = new Set<string>();
  const seenSkus = new Set<string>();
  for (const variant of design.variants) {
    const size = normalizeCapsuleSize(variant.size ?? "");
    if (!size) throw new Error(`${slug}: APLIIQ design variant is missing its size`);
    if (seenSizes.has(size)) throw new Error(`${slug}: duplicate APLIIQ design size ${size}`);
    seenSizes.add(size);
    sizes.push(size);
    if (!nonempty(variant.sku) || !APQ_A1.test(variant.sku)) throw new Error(`${slug}/${size}: APLIIQ SKU must be a production APQ SKU ending in A1`);
    if (seenSkus.has(variant.sku)) throw new Error(`${slug}/${size}: duplicate APLIIQ SKU ${variant.sku}`);
    seenSkus.add(variant.sku);
    const weight = Number(String(variant.weight ?? "").replace(/[^\d.]/g, ""));
    if (!(weight > 0)) throw new Error(`${slug}/${size}: missing positive APLIIQ shipped weight`);
    if (!guideSizes.has(size)) throw new Error(`${slug}/${size}: selected size guide ${product.sizeGuideId} has no measurement row`);
    const variantId = `${slug}-${size.toLowerCase()}`;
    resolveCapsuleVariantApprovals(slug, variantId, existingMap[variantId], product.approvals, {
      designId: design.designId,
      sku: variant.sku,
      artworkId: design.artworkId,
      artworkUrl: product.artworkUrl!,
      service: spec.service!,
      printNote: product.printNote!,
      privateLabelStatus: spec.privateLabelStatus,
      sizeGuideId: product.sizeGuideId!,
    }, expectedApprovalFingerprint);
  }
  const designPreflight: PublishDesignPreflight = {
    ...source,
    sizes,
    designId: design.designId,
    variantCount: design.variants.length,
  };
  if (stage === "design") return designPreflight;

  const itemId = product.square?.itemId;
  if (!nonempty(itemId)) throw new PreparationMissingError("square-mapping", `${slug}: Square item and variation mappings will be created under --apply`);
  const squareVariations = product.square?.variations;
  if (!squareVariations || typeof squareVariations !== "object") throw new PreparationMissingError("square-mapping", `${slug}: Square variation mappings will be created under --apply`);
  const seenSquareIds = new Set<string>();
  for (const size of sizes) {
    const id = squareVariations[size];
    if (!nonempty(id)) throw new PreparationMissingError("square-mapping", `${slug}/${size}: Square variation mapping will be created under --apply`);
    if (seenSquareIds.has(id)) throw new Error(`${slug}/${size}: duplicate Square variation mapping ${id}`);
    seenSquareIds.add(id);
  }

  return { ...designPreflight, itemId };
}

export function parsePublisherArgs(argv: string[]): PublisherArgs {
  let slug = "";
  let apply = false;
  let commit = false;
  let push = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--slug") {
      slug = argv[++index] ?? "";
    } else if (arg === "--apply") {
      apply = true;
    } else if (arg === "--commit") {
      commit = true;
    } else if (arg === "--push") {
      push = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!slug) throw new Error("A selected --slug is required.");
  if ((commit || push) && !apply) throw new Error("--commit and --push require --apply.");
  if (push && !commit) throw new Error("--push requires --commit so an uncommitted product is never pushed.");
  return { slug, apply, commit, push };
}

export function buildPublishPlan(preflight: PublishPreflight): string[] {
  return buildStagedPublishPlan(preflight, preflight, preflight);
}

export function buildStagedPublishPlan(
  source: PublishSourcePreflight,
  design: PublishDesignPreflight | null,
  complete: PublishPreflight | null,
): string[] {
  return [
    `validate spec, ${source.images.length} required images, story, price, and size guide ${source.sizeGuideId}`,
    design
      ? `run APLIIQ create safely; recorded design ${design.designId} will be skipped`
      : "create the missing APLIIQ artwork/design with create --slug <slug> --apply",
    design
      ? `require and revalidate ${design.variantCount} production A1 design variant(s)`
      : "require and revalidate production A1 design variants after creation",
    "derive only the selected slug's landed-cost map without inventing mapping or sample approval",
    complete
      ? `converge existing Square item ${complete.itemId}, including images and authored copy`
      : "create or resume the Square item, variations, images, and authored copy",
    "require and revalidate complete Square item and per-size variation mappings",
    "upsert only the selected product's local manifest row",
    "regenerate the client-safe sellable-slug registry",
    "run validate:all and verify local product-route/feed eligibility",
  ];
}

function git(root: string, args: string[], stdio: "pipe" | "inherit" = "pipe"): string {
  const result = execFileSync("git", args, { cwd: root, encoding: "utf8", stdio });
  return typeof result === "string" ? result.trim() : "";
}

export function assertGitPublishSafety(root: string): string {
  const branch = git(root, ["branch", "--show-current"]);
  if (!branch) throw new Error("Provider/local writes require a checked-out branch; detached HEAD is not allowed.");
  if (branch === "main") throw new Error("Provider/local writes from main are forbidden; use a clean non-main branch.");
  const status = git(root, ["status", "--porcelain", "--untracked-files=all"]);
  if (status) throw new Error("Provider/local writes require a completely clean non-main branch before publishing.");
  return branch;
}

export function createPublisherContinuation(root: string): PublisherContinuation {
  const branch = assertGitPublishSafety(root);
  const head = git(root, ["rev-parse", "HEAD"]);
  return Object.freeze({ [PUBLISHER_CONTINUATION]: true as const, branch, head });
}

export function publisherContinuationForArgs(root: string, args: PublisherArgs): PublisherContinuation | undefined {
  return args.apply ? createPublisherContinuation(root) : undefined;
}

export function assertGitPublishContinuationSafety(root: string, continuation: unknown): string {
  if (!continuation || typeof continuation !== "object"
    || (continuation as Partial<PublisherContinuation>)[PUBLISHER_CONTINUATION] !== true) {
    throw new Error("Publisher continuation requires the in-process capability created by the initial clean-tree check.");
  }
  const { branch: expectedBranch, head: expectedHead } = continuation as PublisherContinuation;
  const branch = git(root, ["branch", "--show-current"]);
  const head = git(root, ["rev-parse", "HEAD"]);
  if (!branch || branch === "main" || branch !== expectedBranch) {
    throw new Error("Publisher continuation requires the same checked-out non-main branch that passed initial safety validation.");
  }
  if (!expectedHead || head !== expectedHead) {
    throw new Error("Publisher continuation requires the unchanged starting commit; reconcile the branch before retrying.");
  }
  const unexpected = changedPaths(root).filter((file) => !COMMITTABLE_PRODUCT_FILES.has(file));
  if (unexpected.length) {
    throw new Error(`Publisher continuation found unexpected changed files: ${unexpected.join(", ")}`);
  }
  return branch;
}

function run(root: string, command: string, args: string[]): void {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
}

async function runSquareCapsule(root: string, command: "create" | "manifest", slug: string, continuation: PublisherContinuation): Promise<void> {
  console.log(`\n$ npm run square:capsule -- ${command} ${slug} --apply`);
  const { applySquareCapsuleCommand } = await import("./square-capsule.mjs");
  await applySquareCapsuleCommand(command, slug, continuation);
}

async function runApliiqCapsule(root: string, command: "create" | "map", slug: string, continuation: PublisherContinuation): Promise<void> {
  console.log(`\n$ npm run apliiq:capsule -- ${command} --slug ${slug} --apply`);
  const { applyApliiqCapsuleCommand } = await import("./apliiq-capsule");
  if (resolve(root) !== resolve(process.cwd())) throw new Error("APLIIQ publisher must run from the repository root.");
  await applyApliiqCapsuleCommand(command, slug, continuation);
}

function changedPaths(root: string): string[] {
  const status = git(root, ["status", "--porcelain", "--untracked-files=all"]);
  if (!status) return [];
  return status.split("\n").map((line) => line.slice(3)).map((entry) => entry.includes(" -> ") ? entry.split(" -> ")[1] : entry);
}

function commitProductFiles(root: string, slug: string): boolean {
  const changed = changedPaths(root);
  const unexpected = changed.filter((file) => !COMMITTABLE_PRODUCT_FILES.has(file));
  if (unexpected.length) throw new Error(`Refusing to commit unexpected files: ${unexpected.join(", ")}`);
  if (!changed.length) {
    console.log("\nNo product-file changes to commit.");
    return false;
  }
  run(root, "git", ["add", "--", ...changed]);
  run(root, "git", ["commit", "-m", `Publish APLIIQ product ${slug}`]);
  return true;
}

export function verifyLocalProductEligibility(root: string, slug: string): { variants: number; feedItems: number } {
  if (resolve(root) !== resolve(process.cwd())) throw new Error("Local eligibility verification must run from the repository root.");
  const product = loadProducts().find((entry) => entry.slug === slug);
  if (!product) throw new Error(`${slug}: product is missing from the local manifest after publish`);
  const eligible = product.variants.filter((variant) => isSellableProvider(variant.fulfillmentProvider) && checkVariantPurchasable(product, variant).ok);
  if (eligible.length !== product.variants.length || eligible.length === 0) {
    const failures = product.variants.flatMap((variant) => checkVariantPurchasable(product, variant).reasons.map((reason) => `${variant.size}: ${reason}`));
    throw new Error(`${slug}: not every manifest variant is locally sellable (${failures.join("; ")})`);
  }
  if (!isStorefrontPublic()) throw new Error(`${slug}: storefront policy excludes the product route`);
  if (!computeSellableSlugs().includes(slug)) throw new Error(`${slug}: missing from computed sellable slugs`);
  const generated = readFileSync(join(root, "lib", "commerce", "sellable-slugs.generated.ts"), "utf8");
  if (!generated.includes(JSON.stringify(slug))) throw new Error(`${slug}: generated sellable-slug registry is stale`);

  const preview = buildPreviewProducts().find((entry) => entry.slug === slug);
  if (!preview) throw new Error(`${slug}: local catalog projection excludes the product`);
  const feed = buildProductFeed([preview], "https://afterhoursagenda.com");
  const route = `/product/${slug}`;
  if (!feed.includes(route)) throw new Error(`${slug}: local product feed does not contain its route`);
  const feedItems = (feed.match(/<item>/g) ?? []).length;
  if (feedItems !== eligible.length) throw new Error(`${slug}: local feed has ${feedItems} variants; expected ${eligible.length}`);
  return { variants: eligible.length, feedItems };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const args = parsePublisherArgs(process.argv.slice(2));
  const continuation = publisherContinuationForArgs(root, args);
  const branch = continuation?.branch ?? "";
  const source = preflightApliiqProduct(root, args.slug, "source");
  let design: PublishDesignPreflight | null = null;
  let complete: PublishPreflight | null = null;
  try {
    design = preflightApliiqProduct(root, args.slug, "design");
  } catch (error) {
    if (!(error instanceof PreparationMissingError) || error.step !== "apliiq-design") throw error;
  }
  if (design) {
    try {
      complete = preflightApliiqProduct(root, args.slug, "complete");
    } catch (error) {
      if (!(error instanceof PreparationMissingError) || error.step !== "square-mapping") throw error;
    }
  }
  console.log(`${args.apply ? "APPLY" : "DRY RUN"}: ${source.title} (${source.slug})`);
  for (const step of buildStagedPublishPlan(source, design, complete)) console.log(`  - ${step}`);

  if (!args.apply) {
    if (complete) {
      try {
        const local = verifyLocalProductEligibility(root, args.slug);
        console.log(`\nAlready locally eligible: ${local.variants} route/feed variant(s).`);
      } catch (error) {
        console.log(`\nPrepared but not yet locally eligible: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log(`\nPreparation needed: ${design ? "Square item/mappings" : "APLIIQ design, then Square item/mappings"}.`);
    }
    console.log("\nDry run only. Pass --apply to perform provider and product-file writes.");
    return;
  }

  await runApliiqCapsule(root, "create", args.slug, continuation!);
  preflightApliiqProduct(root, args.slug, "design");
  // Price, freight, margin, and approval validation must pass before creating
  // any Square record. This dry map makes only the provider catalog read.
  run(root, "npm", ["run", "apliiq:capsule", "--", "map", "--slug", args.slug]);
  await runSquareCapsule(root, "create", args.slug, continuation!);
  preflightApliiqProduct(root, args.slug, "complete");
  // Write the sale-ready map only after the Square item and every variation
  // exist, so `squareMappingStatus: active` is never fabricated.
  await runApliiqCapsule(root, "map", args.slug, continuation!);
  await runSquareCapsule(root, "manifest", args.slug, continuation!);
  run(root, "npm", ["run", "generate:sellable-slugs"]);
  run(root, "npm", ["run", "validate:all"]);
  const local = verifyLocalProductEligibility(root, args.slug);
  console.log(`\n✓ ${args.slug}: locally route/feed eligible with ${local.variants} variant(s)`);

  if (args.commit) {
    const currentBranch = git(root, ["branch", "--show-current"]);
    if (!currentBranch || currentBranch === "main" || currentBranch !== branch) throw new Error("Branch changed during publish; refusing to commit.");
    commitProductFiles(root, args.slug);
  }
  if (args.push) {
    const currentBranch = git(root, ["branch", "--show-current"]);
    if (!currentBranch || currentBranch === "main" || currentBranch !== branch) throw new Error("Branch changed during publish; refusing to push.");
    run(root, "git", ["push", "--set-upstream", "origin", currentBranch]);
  }
}

if (process.argv[1] && basename(process.argv[1]) === "apliiq-product-publisher.ts") {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
