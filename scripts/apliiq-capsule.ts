/**
 * APLIIQ capsule tool — the one path from "art + blank" to a sellable variant.
 *
 *   npx tsx scripts/apliiq-capsule.ts create [--apply] [--only <slug>]
 *     For each product in data/apliiq-capsule.json: POST /Artwork (hosted PNG),
 *     then POST /Design with the artwork attached to the front location and the
 *     hosted mockup as the design image. Records design ids and per-size APQ SKUs
 *     in data/apliiq-capsule-designs.json. Dry-run without --apply.
 *
 *   npx tsx scripts/apliiq-capsule.ts map --slug <slug> [--apply]
 *     Converges only the selected capsule entries in data/apliiq-map.json from
 *     the recorded design plus live blank pricing (GET /Product): item cost =
 *     blank + DTF + private label + plus-size fee, real per-size weight, and a
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

const KEY = process.env.APLIIQ_API_KEY as string;
const SEC = process.env.APLIIQ_SHARED_SECRET as string;
const SPEC_PATH = "data/apliiq-capsule.json";
const DESIGNS_PATH = "data/apliiq-capsule-designs.json";
const MAP_PATH = "data/apliiq-map.json";
const MIN_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35");

// APLIIQ published add-ons, cents. DTF is $7.49 on every dropship garment; the
// sewn private label is $2.50 per unit.
const DTF_CENTS = 749;
const PRIVATE_LABEL_CENTS = 250;

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
interface CapsuleSpec { colorId: number; service: string; privateLabel: string; products: CapsuleProduct[] }
interface DesignsFile { _generated: string; designs: Record<string, DesignCreationState> }

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
  const spec = readJson<CapsuleSpec>(SPEC_PATH);
  let designs: DesignsFile;
  try { designs = readJson<DesignsFile>(DESIGNS_PATH); } catch { designs = { _generated: "", designs: {} }; }
  if (only && !spec.products.some((product) => product.slug === only)) throw new Error(`${only} is not in ${SPEC_PATH}`);
  let created = 0;
  for (const p of spec.products) {
    if (only && p.slug !== only) continue;
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
    privateLabel: spec.privateLabel,
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
      privateLabel: spec.privateLabel,
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
    const itemCost = Math.round(Number(blank.Price) * 100) + DTF_CENTS + PRIVATE_LABEL_CENTS + Math.round(v.plusSizeFee * 100);
    const prior = existing[key];
    const approval = approvalsByKey.get(key)!;
    const base: ApliiqMapEntry = {
      apliiqSku: v.sku,
      apliiqSkuVerified: true,
      apliiqProductId: String(d.designId),
      apliiqVariantId: `${d.designId}-${sizeKey(v.size)}`,
      apliiqDecorationSnapshot: { front: { method: "DTF", service: spec.service, apliiqArtworkId: d.artworkId, artworkUrl: p.artworkUrl, note: p.printNote } },
      apliiqPrivateLabelSnapshot: { neckLabel: { subscription: spec.privateLabel, artworkUrl: "https://afterhoursagenda.com/art/aha-neck-label.svg" } },
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

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "create") {
    const only = rest.includes("--only") ? rest[rest.indexOf("--only") + 1] : undefined;
    await create(rest.includes("--apply"), only);
  } else if (command === "map") {
    const only = rest.includes("--slug")
      ? rest[rest.indexOf("--slug") + 1]
      : rest.includes("--only") ? rest[rest.indexOf("--only") + 1] : undefined;
    await map(rest.includes("--apply"), only);
  } else if (command === "delete" && rest[0]) {
    const ids = rest[0].split(",").map((id) => id.trim()).filter(Boolean);
    if (!rest.includes("--apply")) {
      console.log(`(dry run — would delete APLIIQ design(s) ${ids.join(", ")}; pass --apply only after separate review)`);
      return;
    }
    for (const id of ids) {
      await call("DELETE", `/Design/${id}`);
      console.log(`  deleted design ${id}`);
    }
  } else {
    console.error("usage: apliiq-capsule.ts create [--apply] [--only slug] | map --slug <slug> [--apply] | delete <ids> [--apply]");
    process.exit(2);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
