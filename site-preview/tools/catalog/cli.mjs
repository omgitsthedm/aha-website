#!/usr/bin/env node
// After Hours Agenda catalog engine. One command per step; stdout is always a
// single JSON line, details go to tools/catalog/logs/*.jsonl.
//
//   npm run catalog -- import                  adopt live products into catalog/ledger.json (no provider calls)
//   npm run catalog -- generate                write server/fulfillment/catalog.mjs from the ledger
//   npm run catalog -- verify                  ledger ↔ products.json ↔ allow list ↔ built feeds; exit 2 on drift
//   npm run catalog -- margin [slug]           per-size contribution for design specs; exit 5 below the floor
//   npm run catalog -- plan                    hashed plan for approved design specs not yet in the ledger
//   npm run catalog -- apply --plan <file>     execute exactly that plan (Apliiq → Square → ledger → site data)
//   npm run catalog -- explain <slug>          everything known about one product
//   npm run catalog -- publish-live <slug>     put an applied product on the live site now, no site build (ADMIN_AUTOMATION_TOKEN)
//   npm run catalog -- unpublish-live <slug>   take a live-published product down
//   npm run catalog -- square-skus [--apply]       report (or fix) Square variation SKUs that differ from the ledger
//   npm run catalog -- retire-sync              drop products removed in the admin from the code (ADMIN_AUTOMATION_TOKEN)
//   npm run catalog -- usage [days]            runs, time and provider calls per command (default 7 days)
//   npm run catalog -- ship                    pull → margin → plan → apply → Square photos → build → verify → tests → live → commit
//   npm run catalog -- square-images <slug>    upload any gallery view Square doesn't have yet
//   npm run catalog -- pull                    turn admin publish requests into design specs (ADMIN_AUTOMATION_TOKEN)
//   npm run catalog -- images <slug> --files front back print-detail folded [--campaign a b c --setting "…"]
//
// Exit codes: 0 ok · 1 error · 2 drift · 3 missing credentials · 4 blocked intent · 5 margin/approval gate.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { apliiqCredentials, createApliiqClient, designPayload, withIntent } from "./apliiq.mjs";
import { renderFulfillmentCatalog } from "./generate.mjs";
import { fulfillmentFromLedger, ledgerFromLive, loadLedger, saveLedger, validateLedger } from "./ledger.mjs";
import { APP, CATALOG_DIR, CatalogError, PATHS, confirmedArtworkId, expectedSku, listDesigns, log, readJson, sha256, writeJsonAtomic, writeTextAtomic } from "./lib.mjs";

const CATALOG_BLANKS = path.join(CATALOG_DIR, "blanks");
import { buildCampaign, buildGallery } from "./images.mjs";
import { marginReport } from "./margin.mjs";
import { replaceUnreleased } from "./replace-unreleased.mjs";
import { createSquareClient, itemObject, squareIdempotencyKey, squareToken, verifyItem } from "./square.mjs";
import { productImageKeys } from "../../server/catalog/publish.mjs";
import { PRIVATE_LABEL, SITE_ORIGIN } from "../../server/platform/client.mjs";

const PRODUCT_FIELDS = ["gender", "feed", "description", "fit", "weightOz", "composition", "sizeGuide", "measurementGuidance", "collection", "typeLabel", "fabricType", "constructionDetails", "blank", "printMethod", "sleeveMeasurementGuidance", "campaignSetting", "gallery", "campaign"];

async function loadAllowList() {
  const module = await import(`${pathToFileURL(PATHS.fulfillment).href}?t=${Date.now()}`);
  return module.AHA_FULFILLMENT_CATALOG;
}

function blankDefaults(blank) {
  const file = path.join(CATALOG_BLANKS, `${blank}.json`);
  return existsSync(file) ? readJson(file) : null;
}

function normalizeSpec(raw, file) {
  const defaults = raw.blank ? blankDefaults(raw.blank) : null;
  // Product pages say how a piece is printed when every placement uses the same Apliiq service.
  const services = new Set((raw.apliiq?.locations ?? []).map((location) => location.service));
  const printMethod = services.size === 1 && services.has("dtgprint") ? { printMethod: "direct to garment (DTG)" } : {};
  const spec = { ...raw, sizes: raw.sizes ?? defaults?.sizes, product: { ...(defaults?.product ?? {}), ...printMethod, ...(raw.product ?? {}) } };
  const required = ["slug", "title", "color", "priceCents", "sizes", "blank", "apliiq", "product", "fulfillment"];
  const missing = required.filter((key) => spec[key] === undefined);
  if (missing.length) throw new CatalogError(`${path.basename(file)}: missing ${missing.join(", ")}.`, { code: "spec_invalid" });
  if (!/^[a-z0-9-]+$/.test(spec.slug)) throw new CatalogError(`${spec.slug}: slug must be lowercase letters, numbers and hyphens.`, { code: "spec_invalid" });
  if (!Number.isSafeInteger(spec.priceCents) || spec.priceCents < 100) throw new CatalogError(`${spec.slug}: priceCents must be whole cents.`, { code: "spec_invalid" });
  if (!spec.apliiq.designId && PRIVATE_LABEL && spec.apliiq.label?.id !== PRIVATE_LABEL.id) throw new CatalogError(`${spec.slug}: only the approved ${PRIVATE_LABEL.code} label (${PRIVATE_LABEL.id}) may be used.`, { code: "spec_invalid" });
  for (const size of spec.sizes) expectedSku(1, size, spec.apliiq.sizeCodes);
  return { ...spec, description: spec.product.description, file };
}

function approved(spec) { return spec.status === "approved" && typeof spec.approval?.by === "string" && typeof spec.approval?.at === "string"; }

function productRecord(spec, itemId, variationIds, skus) {
  const record = { slug: spec.slug, title: spec.title, color: spec.color, price: spec.priceCents / 100, currency: "USD", squareItemId: itemId };
  for (const key of PRODUCT_FIELDS) if (spec.product[key] !== undefined) record[key] = spec.product[key];
  record.variants = spec.sizes.map((size) => ({ size, id: variationIds[size], sku: skus[size] }));
  return record;
}

const SITE = process.env.AHA_ADMIN_ORIGIN || SITE_ORIGIN;
function automationToken() {
  const token = process.env.ADMIN_AUTOMATION_TOKEN;
  if (!token) throw new CatalogError("ADMIN_AUTOMATION_TOKEN is required to read publish requests.", { code: "automation_token_missing", exit: 3 });
  return token;
}
async function automation(route, { contentType = "application/json", ...init } = {}) {
  const response = await fetch(`${SITE}/api/admin/automation/${route}`, { ...init, headers: { authorization: `Bearer ${automationToken()}`, "content-type": contentType }, signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new CatalogError(`Admin automation ${route} failed (${response.status}).`, { code: "automation_failed", details: data });
  return data;
}
const reportPublish = (id, status, result) => automation(`publish-requests/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ status, result }) });

const commands = {
  async pull() {
    // Approved drafts the owner pressed Publish on become design specs here.
    const { requests } = await automation("publish-requests");
    const written = [];
    const skipped = [];
    for (const request of requests) {
      const draft = request.payload_json;
      const slug = request.design_slug;
      if (!slug || !draft.blank || !draft.priceCents || !draft.color) { skipped.push({ request: request.id, reason: "slug, blank, color and price must be set in the admin" }); await reportPublish(request.id, "failed", { message: "Set slug, blank, color and price, then approve and publish again." }); continue; }
      const title = draft.title ?? draft.name;
      const collection = draft.collection ?? title.replace(/\s+(Crewneck|Hoodie|Long Sleeve|Pocket Long Sleeve|Cropped Hoodie)$/i, "");
      const defaults = blankDefaults(draft.blank);
      const sizes = (defaults?.sizes ?? draft.sizes).filter((size) => draft.variants.some((variant) => variant.size.toUpperCase() === size.toUpperCase() || variant.sku === expectedSku(request.apliiq_design_id, size)));
      const gallery = await buildGallery({ slug, collection, title, color: draft.color, inputs: draft.imageUrls });
      const spec = {
        slug, status: "approved",
        approval: { by: request.approved_by, at: new Date(request.approved_at).toISOString(), note: `Approved and published from the admin (request ${request.id}).` },
        publishRequestId: request.id,
        title, color: draft.color, priceCents: draft.priceCents, blank: draft.blank, sizes,
        fulfillment: { product: slug.replace(/-/g, "_") },
        apliiq: { designId: request.apliiq_design_id, skus: sizes.map((size) => expectedSku(request.apliiq_design_id, size)) },
        product: { collection, description: draft.storeDescription ?? draft.description ?? "", campaignSetting: "", gallery, campaign: [] },
      };
      writeJsonAtomic(path.join(PATHS.designs, `${slug}.json`), spec);
      await reportPublish(request.id, "running", { spec: `catalog/designs/${slug}.json` });
      written.push(slug);
    }
    return { pulled: written, skipped };
  },

  async images(slug, flags) {
    // Attach local or remote garment images (front, back, detail, folded) to a design spec.
    const entry = listDesigns().find(({ spec }) => spec.slug === slug);
    if (!entry) throw new CatalogError(`No design spec for ${slug}.`, { code: "spec_missing" });
    const collection = entry.spec.product?.collection ?? entry.spec.title;
    const product = { ...entry.spec.product };
    if (flags.files?.length) product.gallery = await buildGallery({ slug, collection, title: entry.spec.title, color: entry.spec.color, inputs: flags.files, alts: entry.spec.product?.galleryAlts ?? {} });
    if (flags.campaign?.length) {
      const setting = flags.setting ?? product.campaignSetting;
      if (!setting) throw new CatalogError("Campaign images need --setting (one place for all three).", { code: "campaign_setting" });
      product.campaignSetting = setting;
      product.campaign = await buildCampaign({ slug, collection, title: entry.spec.title, color: entry.spec.color, setting, inputs: flags.campaign, alts: entry.spec.product?.campaignAlts ?? [] });
    }
    writeJsonAtomic(entry.file, { ...entry.spec, product });
    // A product already applied keeps products.json in step with its spec.
    const products = readJson(PATHS.products);
    const live = products.findIndex((item) => item.slug === slug);
    if (live >= 0) { products[live] = { ...products[live], ...(product.description ? { description: product.description } : {}), gallery: product.gallery, campaign: product.campaign, campaignSetting: product.campaignSetting }; writeJsonAtomic(PATHS.products, products); }
    return { slug, garment: product.gallery?.length ?? 0, campaign: product.campaign?.length ?? 0, updatedLiveProduct: live >= 0 };
  },

  async import() {
    if (existsSync(PATHS.ledger)) throw new CatalogError("catalog/ledger.json already exists; import only adopts a catalog once.", { code: "ledger_exists" });
    const ledger = ledgerFromLive({ products: readJson(PATHS.products), fulfillment: await loadAllowList() });
    saveLedger(ledger);
    return { products: ledger.products.length, variants: ledger.products.reduce((sum, entry) => sum + entry.variants.length, 0) };
  },

  async generate() {
    const ledger = loadLedger();
    const problems = validateLedger(ledger);
    if (problems.length) throw new CatalogError("Ledger is invalid; nothing was written.", { code: "ledger_invalid", details: problems });
    writeTextAtomic(PATHS.fulfillment, renderFulfillmentCatalog(ledger));
    return { wrote: path.relative(APP, PATHS.fulfillment), variants: Object.keys(fulfillmentFromLedger(ledger)).length };
  },

  async verify() {
    const ledger = loadLedger();
    const drift = [...validateLedger(ledger)];
    const products = readJson(PATHS.products);
    const live = ledger.products.filter((entry) => entry.status === "live");
    const bySlug = new Map(products.map((product) => [product.slug, product]));
    for (const entry of live) {
      const product = bySlug.get(entry.slug);
      if (!product) { drift.push(`${entry.slug}: in ledger but not in products.json`); continue; }
      if (product.squareItemId !== entry.square.itemId) drift.push(`${entry.slug}: Square item differs`);
      const variants = new Map(product.variants.map((variant) => [variant.id, variant]));
      for (const variant of entry.variants) {
        const page = variants.get(variant.variationId);
        if (!page || page.sku !== variant.sku || page.size !== variant.size) drift.push(`${entry.slug} ${variant.size}: products.json variant differs`);
        if (Math.round(product.price * 100) !== variant.priceCents) drift.push(`${entry.slug} ${variant.size}: page price differs from ledger`);
      }
      if (variants.size !== entry.variants.length) drift.push(`${entry.slug}: variant count differs`);
    }
    for (const product of products) if (!live.some((entry) => entry.slug === product.slug)) drift.push(`${product.slug}: on the site but not in the ledger`);
    // Every product color needs a swatch (otherwise it falls back to Bone).
    const { COLOR_SWATCHES } = await import("../../server/catalog/garments.mjs");
    for (const color of new Set(products.map((product) => product.color))) {
      if (!COLOR_SWATCHES[color]) drift.push(`color "${color}" has no swatch in server/catalog/garments.mjs`);
    }
    const expected = fulfillmentFromLedger(ledger);
    const actual = await loadAllowList();
    if (JSON.stringify(Object.entries(expected).sort()) !== JSON.stringify(Object.entries(actual).map(([id, value]) => [id, { ...value }]).sort())) drift.push("server/fulfillment/catalog.mjs differs from the ledger; run generate");
    let feedsChecked = false;
    const feeds = ["google.xml", "meta.xml"].map((name) => path.join(PATHS.dist, "feeds", name)).filter(existsSync);
    if (feeds.length) {
      feedsChecked = true;
      const { readFileSync } = await import("node:fs");
      for (const file of feeds) {
        const xml = readFileSync(file, "utf8");
        // Products off sale (src/data/off-sale.json) are left out of the built feeds.
        const { isOffSale } = await import("../../server/catalog/off-sale.mjs");
        const offSaleIds = new Set(products.filter((product) => isOffSale(product.slug)).flatMap((product) => product.variants.map((variant) => variant.id)));
        for (const [id, value] of Object.entries(expected)) {
          if (offSaleIds.has(id)) { if (xml.includes(id)) drift.push(`${path.basename(file)}: lists ${id}, which is off sale`); continue; }
          if (!xml.includes(id)) drift.push(`${path.basename(file)}: missing ${id}`);
          else if (!xml.includes(`${(value.priceCents / 100).toFixed(2)} USD`)) drift.push(`${path.basename(file)}: no ${(value.priceCents / 100).toFixed(2)} USD price`);
        }
      }
    }
    const result = { products: live.length, variants: Object.keys(expected).length, feedsChecked, drift: drift.length };
    if (drift.length) throw new CatalogError(`${drift.length} drift issue(s).`, { code: "drift", exit: 2, details: drift });
    return result;
  },

  async margin(slug) {
    const costs = readJson(PATHS.costs);
    const specs = listDesigns().map(({ file, spec }) => normalizeSpec(spec, file)).filter((spec) => !slug || spec.slug === slug);
    if (!specs.length) throw new CatalogError(slug ? `No design spec for ${slug}.` : "No design specs in catalog/designs.", { code: "spec_missing" });
    const reports = specs.map((spec) => marginReport(spec, costs));
    log("margin", { reports });
    const failing = reports.filter((report) => !report.pass);
    if (failing.length) throw new CatalogError(`${failing.length} design(s) below the $${(costs.floorCents / 100).toFixed(2)} floor.`, { code: "margin_low", exit: 5, details: failing.map(({ slug: name, worstSize, worstContributionCents }) => ({ slug: name, worstSize, worstContributionCents })) });
    return { designs: reports.map(({ slug: name, worstSize, worstContributionCents, estimate }) => ({ slug: name, worstSize, worstContribution: worstContributionCents / 100, estimate })) };
  },

  async plan() {
    const ledger = loadLedger();
    const costs = readJson(PATHS.costs);
    const known = new Set(ledger.products.map((entry) => entry.slug));
    const pending = listDesigns().map(({ file, spec }) => normalizeSpec(spec, file)).filter((spec) => !known.has(spec.slug));
    const designs = pending.map((spec) => {
      const margin = marginReport(spec, costs);
      const gates = [...(approved(spec) ? [] : ["owner approval missing (status: approved, approval.by, approval.at)"]), ...(margin.pass ? [] : [`margin below floor at ${margin.worstSize}`])];
      return {
        slug: spec.slug,
        specHash: sha256(readJson(spec.file)),
        gates,
        steps: [
          ...(spec.apliiq.designId ? [`apliiq.useExistingDesign ${spec.apliiq.designId}`] : [...spec.apliiq.artwork.filter((art) => !art.id).map((art) => `apliiq.createArtwork ${art.key}`), "apliiq.createDesign"]),
          "square.createItem (or adopt one exact-name match)",
          ...(spec.images?.square?.length ? [`square.uploadImages ${spec.images.square.length}`] : []),
          "ledger.add + products.json.add + generate",
        ],
      };
    });
    const plan = { schemaVersion: 1, createdAt: new Date().toISOString(), designs };
    plan.hash = sha256({ designs });
    const file = path.join(PATHS.plans, `${plan.createdAt.replace(/[:.]/g, "-")}-${plan.hash.slice(0, 8)}.json`);
    writeJsonAtomic(file, plan);
    log("plan", { file: path.relative(APP, file), plan });
    return { plan: path.relative(APP, file), designs: designs.length, blocked: designs.filter((design) => design.gates.length).map((design) => ({ slug: design.slug, gates: design.gates })) };
  },

  async apply(_arg, flags) {
    if (!flags.plan) throw new CatalogError("apply requires --plan <file> from `plan`.", { code: "plan_missing" });
    const planFile = path.resolve(APP, flags.plan);
    const plan = readJson(planFile);
    if (plan.hash !== sha256({ designs: plan.designs })) throw new CatalogError("Plan file was edited after it was created.", { code: "plan_tampered" });
    const blocked = plan.designs.filter((design) => design.gates.length);
    if (blocked.length) throw new CatalogError("Plan has open gates; fix them and create a new plan.", { code: "gates_open", exit: 5, details: blocked });
    const specs = new Map(listDesigns().map(({ file, spec }) => [spec.slug, normalizeSpec(spec, file)]));
    const needsApliiq = plan.designs.some((step) => !specs.get(step.slug)?.apliiq?.designId);
    const apliiq = needsApliiq ? createApliiqClient({ credentials: apliiqCredentials() }) : null;
    const square = createSquareClient({ token: squareToken() });
    const results = [];
    for (const step of plan.designs) {
      const spec = specs.get(step.slug);
      if (!spec || sha256(readJson(spec.file)) !== step.specHash) throw new CatalogError(`${step.slug}: design spec changed since the plan; create a new plan.`, { code: "spec_changed" });
      const ledger = loadLedger();
      if (ledger.products.some((entry) => entry.slug === spec.slug)) { results.push({ slug: spec.slug, outcome: "already_in_ledger" }); continue; }
      const artworkIds = {};
      let design;
      if (spec.apliiq.designId) {
        // Designed in Apliiq and sent with Add to Store: the design and its SKUs already exist.
        design = { Id: spec.apliiq.designId, Variants: (spec.apliiq.skus ?? spec.sizes.map((size) => expectedSku(spec.apliiq.designId, size, spec.apliiq.sizeCodes))).map((sku) => ({ SKU: sku })) };
      } else {
        for (const art of spec.apliiq.artwork) {
          if (art.id) { artworkIds[art.key] = art.id; continue; }
          const confirmed = confirmedArtworkId(art.imagePath);
          if (confirmed) { artworkIds[art.key] = confirmed; continue; }
          const response = await withIntent(`artwork-${spec.slug}-${art.key}`, { Name: art.name, ImagePath: art.imagePath }, apliiq.createArtwork);
          artworkIds[art.key] = response.Id;
        }
        design = await withIntent(`design-${spec.slug}`, designPayload(spec, artworkIds), apliiq.createDesign);
      }
      const skus = {};
      for (const size of spec.sizes) {
        const sku = expectedSku(design.Id, size, spec.apliiq.sizeCodes);
        if (!(design.Variants ?? []).some((variant) => variant?.SKU === sku)) throw new CatalogError(`${spec.slug} ${size}: Apliiq design ${design.Id} did not return ${sku}. Check the size range in Apliiq.`, { code: "apliiq_sku_missing" });
        skus[size] = sku;
      }
      const name = `${spec.title} — ${spec.color}`;
      const matches = await square.exactNameMatches(name);
      if (matches.length > 1) throw new CatalogError(`${spec.slug}: Square has ${matches.length} items named “${name}”; reconcile manually.`, { code: "square_duplicate_name" });
      const item = matches.length === 1 ? await square.readItem(matches[0].id) : await square.createItem(itemObject(spec, skus), squareIdempotencyKey(spec, skus)).then((created) => square.readItem(created.id));
      const variationIds = verifyItem(spec, skus, item);
      const imageIds = [];
      for (const [index, file] of (spec.images?.square ?? []).entries()) {
        const image = await square.uploadImage({ itemId: item.id, file: path.resolve(APP, file), name: `${name} ${index + 1}`, caption: name, isPrimary: index === 0, idempotencyKey: `aha-img-${spec.slug}-${index}-${sha256(file).slice(0, 12)}` });
        imageIds.push(image?.id);
      }
      ledger.products.push({
        slug: spec.slug,
        status: "live",
        apliiq: { designId: design.Id, artworkIds },
        square: { itemId: item.id, imageIds },
        fulfillment: { product: spec.fulfillment.product, title: spec.fulfillment.title ?? name },
        variants: spec.sizes.map((size) => ({ variationId: variationIds[size], size, sku: skus[size], priceCents: spec.priceCents })),
      });
      saveLedger(ledger);
      const products = readJson(PATHS.products);
      products.push(productRecord(spec, item.id, variationIds, skus));
      writeJsonAtomic(PATHS.products, products);
      writeTextAtomic(PATHS.fulfillment, renderFulfillmentCatalog(ledger));
      results.push({ slug: spec.slug, outcome: "created", apliiqDesignId: design.Id, squareItemId: item.id, variants: spec.sizes.length });
      if (spec.publishRequestId) await reportPublish(spec.publishRequestId, "done", { slug: spec.slug, squareItemId: item.id, apliiqDesignId: design.Id }).catch(() => null);
    }
    log("apply", { plan: path.relative(APP, planFile), results });
    return { results };
  },

  async "square-skus"(_arg, flags) {
    // Make each Square variation's SKU field match the ledger (the daily health
    // check reports drift). Fulfillment always uses the ledger's SKU; this keeps
    // Square's own record honest. Without --apply it only reports.
    const ledger = loadLedger();
    const expected = new Map(ledger.products.filter((entry) => entry.status === "live").flatMap((entry) => entry.variants.map((variant) => [variant.variationId, variant.sku])));
    const square = createSquareClient({ token: squareToken() });
    const objects = await square.batchRetrieve([...expected.keys()]);
    const missing = [...expected.keys()].filter((id) => !objects.some((object) => object.id === id && !object.is_deleted));
    if (missing.length) throw new CatalogError("Some ledger variations are missing in Square.", { code: "square_missing", details: missing });
    const drift = objects.filter((object) => object.item_variation_data?.sku !== expected.get(object.id)).map((object) => ({ variationId: object.id, square: object.item_variation_data?.sku ?? null, ledger: expected.get(object.id) }));
    if (!drift.length || !flags.apply) return { checked: objects.length, drift, applied: false };
    const changed = objects.filter((object) => drift.some((row) => row.variationId === object.id)).map((object) => ({ ...object, item_variation_data: { ...object.item_variation_data, sku: expected.get(object.id) } }));
    await square.batchUpsert(changed, `aha-skus-${sha256(drift).slice(0, 24)}`);
    const after = await square.batchRetrieve(drift.map((row) => row.variationId));
    const wrong = after.filter((object) => object.item_variation_data?.sku !== expected.get(object.id));
    if (wrong.length) throw new CatalogError("Square readback still differs after the update.", { code: "square_readback_mismatch", details: wrong.map((object) => object.id) });
    return { checked: objects.length, drift, applied: true, verified: after.length };
  },

  async "replace-unreleased"(slug, flags) {
    const raw = listDesigns().find(({ spec }) => spec.slug === slug);
    if (!raw || !flags.reason || !flags["from-design-id"]) throw new CatalogError("Replacement needs slug, --from-design-id and --reason.", { code: "replacement_arguments" });
    const spec = normalizeSpec(raw.spec, raw.file);
    const ledger = loadLedger();
    const current = ledger.products.find((entry) => entry.slug === slug);
    if (!current || String(current.apliiq.designId) !== String(flags["from-design-id"])) throw new CatalogError("Supplier design changed; inspect before replacement.", { code: "replacement_changed" });
    const report = marginReport(spec, readJson(PATHS.costs));
    if (!report.pass) throw new CatalogError("Corrected product fails the margin floor.", { code: "replacement_margin" });
    const page = await fetch(`${SITE_ORIGIN}/shop/${slug}/`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    const square = createSquareClient({ token: squareToken() });
    const hasOrders = await square.hasOrdersForVariations(current.variants.map((v) => v.variationId));
    const result = await replaceUnreleased({ spec, current, square, apliiq: createApliiqClient({ credentials: apliiqCredentials() }), pageStatus: page.status, hasOrders });
    const superseded = [...(current.superseded ?? []), { at: new Date().toISOString(), reason: flags.reason, apliiq: current.apliiq, square: current.square, variants: current.variants }];
    Object.assign(current, { apliiq: { designId: result.designId, artworkIds: result.artworkIds }, square: { itemId: result.itemId, imageIds: [] }, variants: spec.sizes.map((size) => ({ variationId: result.variationIds[size], size, sku: result.skus[size], priceCents: spec.priceCents })), superseded });
    saveLedger(ledger);
    const products = readJson(PATHS.products);
    const index = products.findIndex((p) => p.slug === slug);
    if (index < 0) throw new CatalogError("Replacement has no local presentation record.", { code: "replacement_missing_page" });
    products[index] = productRecord(spec, result.itemId, result.variationIds, result.skus);
    writeJsonAtomic(PATHS.products, products);
    writeTextAtomic(PATHS.fulfillment, renderFulfillmentCatalog(ledger));
    return { slug, supersededDesign: superseded.at(-1).apliiq.designId, apliiqDesignId: result.designId, squareItemId: result.itemId, variants: spec.sizes.length, ordersChecked: true, priorPageStatus: page.status };
  },

  async "square-images"(slug) {
    // Upload any gallery view Square doesn't have yet (front first), so Square matches the site.
    if (!slug) throw new CatalogError("square-images requires a slug.", { code: "slug_missing" });
    const ledger = loadLedger();
    const entry = ledger.products.find((product) => product.slug === slug);
    const page = readJson(PATHS.products).find((product) => product.slug === slug);
    if (!entry || !page) throw new CatalogError(`${slug} is not live in the ledger and products.json.`, { code: "slug_unknown" });
    const square = createSquareClient({ token: squareToken() });
    const known = entry.square.images ?? {};
    // Older entries recorded ids only, in upload order (front, then print detail).
    if (!entry.square.images && entry.square.imageIds?.length) ["front", "print-detail"].slice(0, entry.square.imageIds.length).forEach((role, index) => { known[role] = entry.square.imageIds[index]; });
    const name = `${page.title} — ${page.color}`;
    const uploaded = [];
    for (const shot of page.gallery) {
      if (known[shot.role]) continue;
      const image = await square.uploadImage({ itemId: entry.square.itemId, file: path.join(APP, "public", shot.feedImage), name: `${name} ${shot.role}`, caption: shot.alt, isPrimary: shot.role === "front" && !known.front, idempotencyKey: `aha-img-${slug}-${shot.role}-${sha256(shot.feedImage).slice(0, 12)}` });
      known[shot.role] = image?.id;
      uploaded.push(shot.role);
    }
    entry.square = { ...entry.square, images: known };
    saveLedger(ledger);
    return { slug, uploaded, squareImages: Object.keys(known).length };
  },

  async "publish-live"(slug) {
    // Put a product on afterhoursagenda.com now, with no site build: its images
    // first, then the product. Its page, feeds and checkout pick it up at once;
    // the next build serves the same URLs as static files.
    if (!slug) throw new CatalogError("publish-live requires a slug.", { code: "slug_missing" });
    const page = readJson(PATHS.products).find((product) => product.slug === slug);
    const entry = loadLedger().products.find((product) => product.slug === slug);
    if (!page || !entry) throw new CatalogError(`${slug} must be applied (ledger and products.json) before it can go live.`, { code: "slug_unknown" });
    const product = { ...page, fulfillment: { product: entry.fulfillment.product, title: entry.fulfillment.title ?? `${page.title} — ${page.color}` } };
    const keys = productImageKeys(product);
    const missing = keys.filter((key) => !existsSync(path.join(APP, "public/images", key)));
    if (missing.length) throw new CatalogError(`${slug} is missing image files.`, { code: "images_missing", exit: 5, details: missing });
    let imageCursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, keys.length) }, async () => { while (imageCursor < keys.length) {
      const key = keys[imageCursor++];
      const upload = () => automation(`live-images/${key}`, { method: "PUT", body: readFileSync(path.join(APP, "public/images", key)), contentType: "application/octet-stream" });
      // One retry for a transient failure; images are idempotent by path.
      try { await upload(); } catch (error) { if (error.code !== "automation_failed") throw error; await new Promise((resolve) => { setTimeout(resolve, 2_000); }); await upload(); }
    } }));
    const result = await automation(`live-products/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify(product) });
    // Smoke check against the live site: the page answers with this product.
    const response = await fetch(`${SITE}/shop/${slug}/`, { signal: AbortSignal.timeout(20_000) });
    const html = await response.text();
    if (!response.ok || !html.includes(`data-product-id="${page.squareItemId}"`)) throw new CatalogError(`${slug} was published but its page didn't answer as expected (${response.status}).`, { code: "live_check_failed" });
    return { slug, url: `${SITE}/shop/${slug}/`, images: keys.length, publishedAt: result.publishedAt, cachePurged: result.purged };
  },

  async "retire-sync"() {
    // Products removed from sale in the admin leave the code here, so the next
    // site build drops their static pages. A product with unshipped orders stays
    // until they ship (its sizes must remain fulfillable).
    const { products: retired = [] } = await automation("retired");
    const ledger = loadLedger();
    const pages = readJson(PATHS.products);
    const removed = [];
    const waiting = [];
    for (const entry of retired) {
      const inCode = pages.some((product) => product.slug === entry.slug);
      if (!inCode && !entry.live) continue;
      if (entry.openOrders > 0) { waiting.push({ slug: entry.slug, openOrders: entry.openOrders }); continue; }
      const ledgerEntry = ledger.products.find((product) => product.slug === entry.slug);
      if (ledgerEntry) ledgerEntry.status = "retired";
      if (entry.live) await automation(`live-products/${encodeURIComponent(entry.slug)}`, { method: "DELETE" });
      removed.push(entry.slug);
    }
    if (removed.length) {
      writeJsonAtomic(PATHS.products, pages.filter((product) => !removed.includes(product.slug)));
      saveLedger(ledger);
      await commands.generate();
    }
    return { removed, waiting, next: removed.length ? "Build, verify and test, then open a PR; its site build drops the removed pages." : "Nothing to remove from the code." };
  },

  async "unpublish-live"(slug) {
    if (!slug) throw new CatalogError("unpublish-live requires a slug.", { code: "slug_missing" });
    return automation(`live-products/${encodeURIComponent(slug)}`, { method: "DELETE" });
  },

  async ship(_arg, flags) {
    // Admin "Publish" (or an approved design file) → live-ready commit, in one command:
    // pull → margin → plan → apply → Square photos → build → verify → tests → commit on a branch.
    const steps = [];
    const run = (command, args, env = {}) => {
      const result = spawnSync(command, args, { cwd: APP, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      if (result.status !== 0) throw new CatalogError(`${command} ${args.join(" ")} failed (exit ${result.status}).`, { code: "ship_step_failed", details: (result.stdout + result.stderr).split("\n").filter(Boolean).slice(-15) });
      return result.stdout;
    };
    if (process.env.ADMIN_AUTOMATION_TOKEN) { const pulled = await commands.pull(); steps.push({ pull: pulled }); }
    const known = new Set(loadLedger().products.map((entry) => entry.slug));
    const pending = listDesigns().map(({ file, spec }) => normalizeSpec(spec, file)).filter((spec) => !known.has(spec.slug));
    if (!pending.length) return { shipped: [], steps, message: "Nothing to ship: no approved design specs outside the ledger." };
    for (const spec of pending) {
      const costs = readJson(PATHS.costs);
      const margin = marginReport(spec, costs);
      if (!margin.pass) throw new CatalogError(`${spec.slug} is below the margin floor at ${margin.worstSize}.`, { code: "margin_low", exit: 5 });
      if (!spec.product?.gallery?.length || spec.product.gallery.length < 4) throw new CatalogError(`${spec.slug} needs four garment images (front, back, print-detail, folded) before shipping.`, { code: "images_missing", exit: 5 });
      if (spec.product?.campaign?.length !== 3) throw new CatalogError(`${spec.slug} needs three campaign images from one setting before shipping.`, { code: "images_missing", exit: 5 });
    }
    const plan = await commands.plan();
    if (plan.blocked.length) throw new CatalogError("Plan has open gates.", { code: "gates_open", exit: 5, details: plan.blocked });
    const applied = await commands.apply(undefined, { plan: plan.plan });
    steps.push({ apply: applied.results });
    for (const result of applied.results.filter((entry) => entry.outcome === "created")) steps.push({ squareImages: await commands["square-images"](result.slug) });
    if (!flags["skip-checks"]) {
      run("npm", ["run", "build"], { AHA_PRODUCTION_BUILD: "approved", PUBLIC_SITE_URL: SITE_ORIGIN });
      steps.push({ verify: await commands.verify() });
      run("npm", ["test"], { AHA_PRODUCTION_BUILD: "approved", PUBLIC_SITE_URL: SITE_ORIGIN });
      steps.push({ tests: "passed" });
    }
    const slugs = applied.results.map((entry) => entry.slug);
    // Live now, no site build needed; the commit below folds it into the next build.
    if (process.env.ADMIN_AUTOMATION_TOKEN && !flags["no-live"]) for (const slug of slugs) steps.push({ live: await commands["publish-live"](slug) });
    const branch = `catalog/${new Date().toISOString().slice(0, 10)}-${slugs.join("-").slice(0, 60)}`;
    const repo = path.resolve(APP, "..");
    const git = (...args) => { const out = spawnSync("git", args, { cwd: repo, encoding: "utf8" }); if (out.status !== 0) throw new CatalogError(`git ${args.join(" ")} failed.`, { code: "git_failed", details: out.stderr.split("\n").slice(-5) }); return out.stdout.trim(); };
    git("switch", "-c", branch);
    git("add", "site-preview/catalog", "site-preview/src/data/products.json", "site-preview/server/fulfillment/catalog.mjs", "site-preview/public/images");
    git("commit", "-q", "-m", `feat: publish ${slugs.join(", ")} via catalog ship\n\nApproved design specs applied by the catalog engine (Apliiq design, Square item and photos, ledger, products.json, generated allow list); build, verify and tests passed.\n\nBuilt with Claude Code (LiFi NYC)`);
    return { shipped: slugs, branch, commit: git("rev-parse", "HEAD"), steps, next: "Already live if published above. Push the branch and open a PR so the next site build includes it; no separate release is needed." };
  },

  /** Totals from the run logs: runs, failures, time and provider calls per command. */
  async usage(daysArg) {
    const days = Math.min(Math.max(Number(daysArg) || 7, 1), 90);
    const since = Date.now() - days * 86_400_000;
    const totals = {};
    const files = existsSync(PATHS.logs) ? readdirSync(PATHS.logs).filter((name) => name.endsWith(".jsonl") && Date.parse(name.slice(0, 10)) >= since - 86_400_000) : [];
    for (const name of files) {
      for (const line of readFileSync(path.join(PATHS.logs, name), "utf8").split("\n")) {
        if (!line) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (Date.parse(entry.at) < since) continue;
        const row = (totals[entry.command] ??= { runs: 0, failed: 0, ms: 0, apliiq: 0, square: 0, other: 0 });
        row.runs += 1;
        if (entry.ok === false) row.failed += 1;
        row.ms += entry.cost?.ms ?? 0;
        for (const key of ["apliiq", "square", "other"]) row[key] += entry.cost?.apiCalls?.[key] ?? 0;
      }
    }
    return { days, totals };
  },

  async explain(slug) {
    if (!slug) throw new CatalogError("explain requires a slug.", { code: "slug_missing" });
    const entry = loadLedger().products.find((product) => product.slug === slug);
    const page = readJson(PATHS.products).find((product) => product.slug === slug);
    const spec = listDesigns().find(({ spec: design }) => design.slug === slug)?.spec;
    const intents = existsSync(PATHS.intents) ? readdirSync(PATHS.intents).filter((name) => name.includes(slug)).map((name) => ({ name, state: readJson(path.join(PATHS.intents, name)).state })) : [];
    if (!entry && !page && !spec) throw new CatalogError(`Nothing is known about ${slug}.`, { code: "slug_unknown" });
    return { slug, ledger: entry ?? null, onSite: Boolean(page), price: page?.price ?? null, designSpec: spec ? { status: spec.status, blank: spec.blank, priceCents: spec.priceCents } : null, intents };
  },
};

function parse(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  const positional = [];
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--plan") flags.plan = rest[++index];
    else if (token === "--quiet") flags.quiet = true;
    else if (token === "--files") { flags.files = []; while (rest[index + 1] && !rest[index + 1].startsWith("--")) flags.files.push(rest[++index]); }
    else if (token === "--campaign") { flags.campaign = []; while (rest[index + 1] && !rest[index + 1].startsWith("--")) flags.campaign.push(rest[++index]); }
    else if (token === "--setting") flags.setting = rest[++index];
    else if (token === "--from-design-id") flags["from-design-id"] = rest[++index];
    else if (token === "--reason") flags.reason = rest[++index];
    else if (token === "--skip-checks") flags["skip-checks"] = true;
    else if (token === "--no-live") flags["no-live"] = true;
    else if (token === "--apply") flags.apply = true;
    else positional.push(token);
  }
  return { command, arg: positional[0], flags };
}

// Cost meter: every run logs its duration and provider calls, so `usage` can
// show what a drop actually cost without reading the logs into a chat.
function meter() {
  const startedAt = Date.now();
  const calls = { apliiq: 0, square: 0, other: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const host = new URL(typeof input === "string" ? input : input.url).hostname;
    calls[host.endsWith("apliiq.com") ? "apliiq" : host.endsWith("squareup.com") ? "square" : "other"] += 1;
    return original(input, init);
  };
  return () => { globalThis.fetch = original; return { ms: Date.now() - startedAt, apiCalls: calls }; };
}

export async function run(argv) {
  const { command, arg, flags } = parse(argv);
  const handler = commands[command];
  if (!handler) throw new CatalogError(`Unknown command ${command ?? "(none)"}. Commands: ${Object.keys(commands).join(", ")}.`, { code: "usage" });
  const stop = meter();
  let result;
  try { result = await handler(arg, flags); }
  catch (error) { error.cost = stop(); throw error; }
  const cost = stop();
  const logged = log(command, { ok: true, cost, result });
  return { ok: true, command, ...result, cost, log: logged };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run(process.argv.slice(2)).then(
    (summary) => { process.stdout.write(`${JSON.stringify(summary)}\n`); },
    (error) => {
      const code = error instanceof CatalogError ? error.code : "unexpected";
      const logged = log(process.argv[2] ?? "unknown", { ok: false, code, message: error.message, details: error.details, cost: error.cost });
      process.stdout.write(`${JSON.stringify({ ok: false, command: process.argv[2], code, message: error.message, details: Array.isArray(error.details) ? error.details.slice(0, 10) : undefined, log: logged })}\n`);
      process.exitCode = error instanceof CatalogError ? error.exit : 1;
    },
  );
}
