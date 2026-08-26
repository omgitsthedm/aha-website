/**
 * APLIIQ capsule tool — the one path from "art + blank" to a sellable variant.
 *
 *   npx tsx scripts/apliiq-capsule.ts create --slug <slug> [--apply]
 *     For exactly one product in data/apliiq-capsule.json: POST /Artwork
 *     (hosted PNG), then POST /Design with the artwork attached to the front
 *     location and the hosted mockup as the design image. Records design ids
 *     and per-size APQ SKUs in data/apliiq-capsule-designs.json. Dry-run
 *     without --apply.
 *
 *   npx tsx scripts/apliiq-capsule.ts map --slug <slug> [--apply]
 *     Converges only the selected capsule entries in data/apliiq-map.json from
 *     the recorded design plus live blank pricing (GET /Product): item cost =
 *     blank + DTF + plus-size fee, real per-size weight, and a
 *     landed-cost margin computed by the storefront gate. It is a dry run
 *     unless --apply is present, preserves unrelated entries and refuses to
 *     auto-delete stale mappings.
 *
 *   npx tsx scripts/apliiq-capsule.ts delete <designId,designId> [--apply]
 *     Dry-run by default. This is a separate manual cleanup command and is
 *     never invoked by the product publisher.
 *
 * Contract: https://help.apliiq.com/portal/en/kb/articles/create-design and
 * .../artwork-api. SKUs are APQ-{design}S{size}A{artworks}; A0 means a blank
 * design that would print nothing, so `map` refuses any A0 SKU.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createApliiqAuthorization } from "@/lib/apliiq/auth";
import { isApliiqSku } from "@/lib/apliiq/orders";
import { resolveApliiqLandedCost } from "@/lib/commerce/landed-cost";
import { parseApliiqMapDocument, type ApliiqMapEntry } from "@/lib/data/apliiq-map";
import {
  capsuleApprovalFingerprint,
  resolveCapsuleVariantApprovals,
  type CapsuleApprovalMetadata,
  type CapsuleProductProductionIdentity,
} from "@/scripts/lib/apliiq-capsule-approvals";
import {
  assertApliiqDesignIdentity,
  createOrResumeApliiqDesign,
  isCompleteDesignRecord,
  type DesignCreationState,
} from "@/scripts/lib/apliiq-capsule-creation";
import {
  assertGitPublishContinuationSafety,
  assertGitPublishSafety,
  preflightApliiqProduct,
} from "@/scripts/apliiq-product-publisher";

const KEY = process.env.APLIIQ_API_KEY as string;
const SEC = process.env.APLIIQ_SHARED_SECRET as string;
const SPEC_PATH = "data/apliiq-capsule.json";
const DESIGNS_PATH = "data/apliiq-capsule-designs.json";
const MAP_PATH = "data/apliiq-map.json";
const MIN_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35");

// APLIIQ published add-ons, cents. DTF is $7.49 on every dropship garment.
// The current API designs send Subscriptions: [] and therefore must not claim
// or cost a private-label service.
const DTF_CENTS = 749;

interface CapsuleProduct {
  slug: string;
  title: string;
  productCode: string;
  frontLocationId: number;
  productType: string;
  sizeGuideId: string;
  fabricDescription: string;
  retailPrice: number;
  sizeRetail?: Record<string, number>;
  artworkUrl: string;
  mockupUrl: string;
  printNote: string;
  squareItemId?: string;
  approvals?: CapsuleApprovalMetadata;
}
interface CapsuleSpec { colorId: number; service: string; privateLabelStatus: "not-attached"; products: CapsuleProduct[] }
interface DesignsFile { _generated: string; designs: Record<string, DesignCreationState> }

export type ApliiqCapsuleCommand = "create" | "map";
export type ParsedApliiqCapsuleArgs =
  | { command: ApliiqCapsuleCommand; slug: string; apply: boolean }
  | { command: "delete"; ids: string[]; apply: boolean };

export function privateLabelSnapshot(status: CapsuleSpec["privateLabelStatus"]): Record<string, unknown> {
  if (status !== "not-attached") throw new Error("Private-label attachment is not implemented or provider-verified.");
  return { status };
}

export function apliiqProviderItemCostCents(blankPrice: number, plusSizeFee: number): number {
  if (!Number.isFinite(blankPrice) || blankPrice < 0 || !Number.isFinite(plusSizeFee) || plusSizeFee < 0) {
    throw new Error("APLIIQ blank and plus-size prices must be finite nonnegative amounts.");
  }
  return Math.round(blankPrice * 100) + DTF_CENTS + Math.round(plusSizeFee * 100);
}

async function call(method: string, path: string, body?: unknown) {
  if (!KEY || !SEC) throw new Error("APLIIQ_API_KEY and APLIIQ_SHARED_SECRET are required.");
  const raw = body === undefined ? "" : JSON.stringify(body);
  const auth = createApliiqAuthorization({ apiKey: KEY, sharedSecret: SEC,
    timestamp: Math.floor(Date.now() / 1000), nonce: randomUUID(), rawBody: raw });
  const r = await fetch("https://api.apliiq.com/v1" + path, { method,
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: auth },
    ...(raw ? { body: raw } : {}) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const readJson = <T,>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const sizeKey = (name: string) => {
  const n = name.toLowerCase();
  return n === "xxl" ? "2xl" : n === "xxxl" ? "3xl" : n;
};
const sizeLabel = (name: string) => sizeKey(name).toUpperCase();

function persistDesigns(designs: DesignsFile): void {
  designs._generated = new Date().toISOString().slice(0, 10);
  const temporaryPath = `${DESIGNS_PATH}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(designs, null, 2)}\n`);
  renameSync(temporaryPath, DESIGNS_PATH);
}

async function create(apply: boolean, only?: string) {
  if (!only) throw new Error("create requires one selected --slug");
  const spec = readJson<CapsuleSpec>(SPEC_PATH);
  privateLabelSnapshot(spec.privateLabelStatus);
  let designs: DesignsFile;
  try { designs = readJson<DesignsFile>(DESIGNS_PATH); } catch { designs = { _generated: "", designs: {} }; }
  if (!spec.products.some((product) => product.slug === only)) throw new Error(`${only} is not in ${SPEC_PATH}`);
  let created = 0;
  for (const p of spec.products) {
    if (p.slug !== only) continue;
    const existing = designs.designs[p.slug];
    if (!apply) {
      if (existing) assertApliiqDesignIdentity(p, spec, existing);
      if (existing && isCompleteDesignRecord(existing)) {
        console.log(`  ${p.slug.padEnd(36)} immutable identity verified for design ${existing.designId}; skip`);
      } else {
        console.log(`  ${p.slug.padEnd(36)} ${p.productCode} front ${p.frontLocationId}\n     art  ${p.artworkUrl}\n     mock ${p.mockupUrl}${existing ? `\n     resume checkpoint ${existing._creation.status}` : ""}`);
      }
      continue;
    }

    const result = await createOrResumeApliiqDesign({
      product: p,
      spec,
      existing,
      callProvider: call,
      persist: (state) => {
        // The checkpoint is slug-scoped and is atomically replaced before and
        // immediately after each provider write.
        designs.designs[p.slug] = state;
        persistDesigns(designs);
      },
    });
    if (result.created) {
      created++;
      console.log(`  ${p.slug.padEnd(36)} artwork ${result.record.artworkId} design ${result.record.designId} ${result.record.variants.length} sizes`);
    } else {
      console.log(`  ${p.slug.padEnd(36)} already recorded as design ${result.record.designId}; skip`);
    }
  }
  if (!apply) {
    console.log("\n(dry run — pass --apply to create artwork and designs)");
  } else if (!created) {
    console.log("\n✓ recorded design already exists; no provider write needed");
  }
}

function withoutVerificationTimes(entry: ApliiqMapEntry): unknown {
  const { costVerifiedAt: _costVerifiedAt, marginVerifiedAt: _marginVerifiedAt, marginFloorOverride, ...rest } = entry;
  return {
    ...rest,
    ...(marginFloorOverride ? { marginFloorOverride: { ...marginFloorOverride, approvedAt: undefined } } : {}),
  };
}

async function map(apply: boolean, only?: string) {
  if (!only) throw new Error("map requires one selected --slug");
  const spec = readJson<CapsuleSpec>(SPEC_PATH);
  privateLabelSnapshot(spec.privateLabelStatus);
  const p = spec.products.find((product) => product.slug === only);
  if (!p) throw new Error(`${only} is not in ${SPEC_PATH}`);
  const designs = readJson<DesignsFile>(DESIGNS_PATH).designs;
  const existing = parseApliiqMapDocument(readJson<unknown>(MAP_PATH)).map;
  const d = designs[p.slug];
  if (!d) throw new Error(`${p.slug} has no recorded design; run create first`);
  assertApliiqDesignIdentity(p, spec, d);
  if (!isCompleteDesignRecord(d)) throw new Error(`${p.slug} has an incomplete creation checkpoint (${d._creation.status}); resume or reconcile create first`);
  if (!d.variants.length) throw new Error(`${p.slug} design has no variants`);
  const productionIdentity: CapsuleProductProductionIdentity = {
    slug: p.slug,
    productCode: p.productCode,
    colorId: spec.colorId,
    frontLocationId: p.frontLocationId,
    designId: d.designId,
    artworkId: d.artworkId,
    artworkUrl: p.artworkUrl,
    service: spec.service,
    printNote: p.printNote,
    privateLabelStatus: spec.privateLabelStatus,
    sizeGuideId: p.sizeGuideId,
    variants: d.variants.map(({ size, sku }) => ({ size, sku })),
  };
  const expectedApprovalFingerprint = capsuleApprovalFingerprint(productionIdentity);
  const approvalsByKey = new Map<string, Pick<ApliiqMapEntry, "apliiqMappingApproval" | "apliiqSampleApproval">>();
  for (const variant of d.variants) {
    if (!isApliiqSku(variant.sku) || !/A1$/.test(variant.sku)) throw new Error(`${p.slug} ${variant.size}: SKU ${variant.sku} is not an artwork-bearing A1 production SKU`);
    const key = `${p.slug}-${sizeKey(variant.size)}`;
    approvalsByKey.set(key, resolveCapsuleVariantApprovals(p.slug, key, existing[key], p.approvals, {
      designId: d.designId,
      sku: variant.sku,
      artworkId: d.artworkId,
      artworkUrl: p.artworkUrl,
      service: spec.service,
      printNote: p.printNote,
      privateLabelStatus: spec.privateLabelStatus,
      sizeGuideId: p.sizeGuideId,
    }, expectedApprovalFingerprint));
  }
  const catalog = (await call("GET", "/Product")).Products as Record<string, any>[];
  const blank = catalog.find((entry) => entry.Code === p.productCode);
  if (!blank) throw new Error(`APLIIQ catalog has no product ${p.productCode}`);

  const now = new Date().toISOString();
  const next: Record<string, ApliiqMapEntry> = { ...existing };
  const desiredKeys = new Set<string>();
  let overrides = 0;
  for (const v of d.variants) {
    const key = `${p.slug}-${sizeKey(v.size)}`;
    desiredKeys.add(key);
    const retail = p.sizeRetail?.[sizeLabel(v.size)] ?? p.retailPrice;
    const weightOz = Math.round(Number(String(v.weight).replace(/[^\d.]/g, "")) * 100) / 100;
    const itemCost = apliiqProviderItemCostCents(Number(blank.Price), v.plusSizeFee);
    const prior = existing[key];
    const approval = approvalsByKey.get(key)!;
    const base: ApliiqMapEntry = {
      apliiqSku: v.sku,
      apliiqSkuVerified: true,
      apliiqProductId: String(d.designId),
      apliiqVariantId: `${d.designId}-${sizeKey(v.size)}`,
      apliiqDecorationSnapshot: { front: { method: "DTF", service: spec.service, apliiqArtworkId: d.artworkId, artworkUrl: p.artworkUrl, note: p.printNote } },
      apliiqPrivateLabelSnapshot: privateLabelSnapshot(spec.privateLabelStatus),
      apliiqAssetUrls: [p.artworkUrl, p.mockupUrl],
      apliiqRegionAvailability: ["US"],
      apliiqSizeGuideReference: p.sizeGuideId,
      apliiqMappingApproval: approval.apliiqMappingApproval,
      apliiqSampleApproval: approval.apliiqSampleApproval,
      squareMappingStatus: prior?.squareMappingStatus ?? "active",
      weightOz,
      apliiqItemCost: itemCost,
      apliiqCostBasis: "standard",
      costEstimate: itemCost,
      costVerifiedAt: now,
      marginVerifiedAt: now,
      marginEstimate: 0,
    };
    const landed = resolveApliiqLandedCost({ ...base, retailPrice: retail });
    if (!landed.ok) throw new Error(`${key}: ${landed.reasons.join("; ")}`);
    const margin = landed.landed.margin;
    if (margin.contributionMargin <= 0) throw new Error(`${key}: landed cost ${retail - margin.contributionMargin} exceeds retail ${retail}; raise the price`);
    base.marginEstimate = margin.contributionMargin;
    if (margin.contributionMarginRatio < MIN_MARGIN_RATIO) {
      overrides++;
      base.marginFloorOverride = {
        minRatio: Math.floor(margin.contributionMarginRatio * 100) / 100,
        reason: p.productType === "tee"
          ? "APLIIQ plus-size fee against a flat tee price; merchant holds one price across sizes"
          : `${blank.SKU} held at merchant price; profitable, under the ${Math.round(MIN_MARGIN_RATIO * 100)}% floor`,
        approvedAt: now.slice(0, 10),
      };
    }
    if (prior && JSON.stringify(withoutVerificationTimes(prior)) === JSON.stringify(withoutVerificationTimes(base))) {
      base.costVerifiedAt = prior.costVerifiedAt;
      base.marginVerifiedAt = prior.marginVerifiedAt;
      if (base.marginFloorOverride && prior.marginFloorOverride) base.marginFloorOverride.approvedAt = prior.marginFloorOverride.approvedAt;
    }
    next[key] = base;
    console.log(`  ${key.padEnd(44)} ${v.sku.padEnd(20)} ${String(weightOz).padStart(5)}oz  cost ${itemCost}  margin ${margin.contributionMargin} (${(margin.contributionMarginRatio * 100).toFixed(1)}%)${base.marginFloorOverride ? "  override" : ""}`);
  }

  const stale = Object.keys(existing).filter((key) => key.startsWith(`${p.slug}-`) && !desiredKeys.has(key));
  if (stale.length) throw new Error(`${p.slug}: refusing to auto-delete stale mapping(s): ${stale.join(", ")}; review them manually`);
  parseApliiqMapDocument({ map: next });
  const rendered = `${JSON.stringify({ map: next }, null, 2)}\n`;
  if (apply) {
    if (readFileSync(MAP_PATH, "utf8") !== rendered) writeFileSync(MAP_PATH, rendered);
    console.log(`\n✓ ${desiredKeys.size} selected variants converged in ${MAP_PATH} (${overrides} with a margin-floor override)`);
  } else {
    console.log(`\n(dry run — ${desiredKeys.size} selected variants; pass --apply to write ${MAP_PATH})`);
  }
}

export function parseApliiqCapsuleArgs(argv: string[]): ParsedApliiqCapsuleArgs {
  const [command, ...rest] = argv;
  if (command === "create" || command === "map") {
    let slug = "";
    let apply = false;
    for (let index = 0; index < rest.length; index++) {
      const arg = rest[index];
      if (arg === "--slug" || arg === "--only") {
        if (slug) throw new Error(`${command} accepts exactly one selected slug`);
        slug = rest[++index] ?? "";
      } else if (arg === "--apply") {
        if (apply) throw new Error(`${command} accepts --apply only once`);
        apply = true;
      } else {
        throw new Error(`Unknown ${command} argument: ${arg}`);
      }
    }
    if (!slug || slug.startsWith("--")) throw new Error(`${command} requires one selected --slug`);
    return { command, slug, apply };
  }
  if (command === "delete") {
    const [rawIds, ...flags] = rest;
    if (!rawIds || flags.some((flag) => flag !== "--apply") || flags.filter((flag) => flag === "--apply").length > 1) {
      throw new Error("delete requires one comma-separated design-id list and optional --apply");
    }
    const ids = rawIds.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0 || ids.some((id) => !/^\d+$/.test(id))) {
      throw new Error("delete design ids must be positive numeric provider ids");
    }
    return { command, ids, apply: flags.includes("--apply") };
  }
  throw new Error("usage: apliiq-capsule.ts create|map --slug <slug> [--apply] | delete <ids> [--apply]");
}

export function assertApliiqExecutionSafety(root: string, continuation?: unknown): string {
  return continuation === undefined
    ? assertGitPublishSafety(root)
    : assertGitPublishContinuationSafety(root, continuation);
}

export type SquareCapsuleMappingVerifier = (slug: string) => Promise<unknown>;

/** A sale-ready map may be written only after a fresh provider GET verifies every Square id. */
export async function assertApliiqMapActivationReady(
  root: string,
  slug: string,
  verifySquare?: SquareCapsuleMappingVerifier,
): Promise<void> {
  preflightApliiqProduct(root, slug, "complete");
  const verifier = verifySquare
    ?? (await import("./square-capsule.mjs")).verifySquareCapsuleMapping;
  await verifier(slug);
}

export async function applyApliiqCapsuleCommand(
  command: ApliiqCapsuleCommand,
  slug: string,
  continuation?: unknown,
): Promise<void> {
  const root = process.cwd();
  assertApliiqExecutionSafety(root, continuation);
  preflightApliiqProduct(root, slug, "source");
  if (command === "create") {
    await create(true, slug);
    return;
  }
  await assertApliiqMapActivationReady(root, slug);
  await map(true, slug);
}

async function main() {
  const args = parseApliiqCapsuleArgs(process.argv.slice(2));
  if (args.command !== "delete") {
    if (args.apply) await applyApliiqCapsuleCommand(args.command, args.slug);
    else if (args.command === "create") await create(false, args.slug);
    else await map(false, args.slug);
    return;
  }

  if (!args.apply) {
    console.log(`(dry run — would delete APLIIQ design(s) ${args.ids.join(", ")}; pass --apply only after separate review)`);
    return;
  }
  assertApliiqExecutionSafety(process.cwd());
  for (const id of args.ids) {
    await call("DELETE", `/Design/${id}`);
    console.log(`  deleted design ${id}`);
  }
}

if (process.argv[1] && basename(process.argv[1]) === "apliiq-capsule.ts") {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
