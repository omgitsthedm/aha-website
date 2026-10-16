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
//   npm run catalog -- pull                    turn admin publish requests into design specs (ADMIN_AUTOMATION_TOKEN)
//   npm run catalog -- images <slug> --files a.jpg b.jpg …   attach front/back/detail/folded garment images
//
// Exit codes: 0 ok · 1 error · 2 drift · 3 missing credentials · 4 blocked intent · 5 margin/approval gate.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { apliiqCredentials, createApliiqClient, designPayload, withIntent } from "./apliiq.mjs";
import { renderFulfillmentCatalog } from "./generate.mjs";
import { fulfillmentFromLedger, ledgerFromLive, loadLedger, saveLedger, validateLedger } from "./ledger.mjs";
import { APP, CATALOG_DIR, CatalogError, PATHS, expectedSku, listDesigns, log, readJson, sha256, writeJsonAtomic, writeTextAtomic } from "./lib.mjs";

const CATALOG_BLANKS = path.join(CATALOG_DIR, "blanks");
import { buildGallery } from "./images.mjs";
import { marginReport } from "./margin.mjs";
import { createSquareClient, itemObject, squareIdempotencyKey, squareToken, verifyItem } from "./square.mjs";

const PRODUCT_FIELDS = ["gender", "feed", "description", "fit", "weightOz", "composition", "sizeGuide", "measurementGuidance", "collection", "typeLabel", "fabricType", "constructionDetails", "sleeveMeasurementGuidance", "campaignSetting", "gallery", "campaign"];

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
  const spec = { ...raw, sizes: raw.sizes ?? defaults?.sizes, product: { ...(defaults?.product ?? {}), ...(raw.product ?? {}) } };
  const required = ["slug", "title", "color", "priceCents", "sizes", "blank", "apliiq", "product", "fulfillment"];
  const missing = required.filter((key) => spec[key] === undefined);
  if (missing.length) throw new CatalogError(`${path.basename(file)}: missing ${missing.join(", ")}.`, { code: "spec_invalid" });
  if (!/^[a-z0-9-]+$/.test(spec.slug)) throw new CatalogError(`${spec.slug}: slug must be lowercase letters, numbers and hyphens.`, { code: "spec_invalid" });
  if (!Number.isSafeInteger(spec.priceCents) || spec.priceCents < 100) throw new CatalogError(`${spec.slug}: priceCents must be whole cents.`, { code: "spec_invalid" });
  if (!spec.apliiq.designId && spec.apliiq.label?.id !== 6208403) throw new CatalogError(`${spec.slug}: only the approved SB-3-161622 label (6208403) may be used.`, { code: "spec_invalid" });
  for (const size of spec.sizes) expectedSku(1, size);
  return { ...spec, description: spec.product.description, file };
}

function approved(spec) { return spec.status === "approved" && typeof spec.approval?.by === "string" && typeof spec.approval?.at === "string"; }

function productRecord(spec, itemId, variationIds, skus) {
  const record = { slug: spec.slug, title: spec.title, color: spec.color, price: spec.priceCents / 100, currency: "USD", squareItemId: itemId };
  for (const key of PRODUCT_FIELDS) if (spec.product[key] !== undefined) record[key] = spec.product[key];
  record.variants = spec.sizes.map((size) => ({ size, id: variationIds[size], sku: skus[size] }));
  return record;
}

const SITE = process.env.AHA_ADMIN_ORIGIN || "https://afterhoursagenda.com";
function automationToken() {
  const token = process.env.ADMIN_AUTOMATION_TOKEN;
  if (!token) throw new CatalogError("ADMIN_AUTOMATION_TOKEN is required to read publish requests.", { code: "automation_token_missing", exit: 3 });
  return token;
}
async function automation(route, init = {}) {
  const response = await fetch(`${SITE}/api/admin/automation/${route}`, { ...init, headers: { authorization: `Bearer ${automationToken()}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000) });
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
    const inputs = flags.files ?? [];
    const gallery = await buildGallery({ slug, collection: entry.spec.product?.collection ?? entry.spec.title, title: entry.spec.title, color: entry.spec.color, inputs });
    writeJsonAtomic(entry.file, { ...entry.spec, product: { ...entry.spec.product, gallery } });
    return { slug, images: gallery.length };
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
        for (const [id, value] of Object.entries(expected)) {
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
        design = { Id: spec.apliiq.designId, Variants: (spec.apliiq.skus ?? spec.sizes.map((size) => expectedSku(spec.apliiq.designId, size))).map((sku) => ({ SKU: sku })) };
      } else {
        for (const art of spec.apliiq.artwork) {
          if (art.id) { artworkIds[art.key] = art.id; continue; }
          const response = await withIntent(`artwork-${spec.slug}-${art.key}`, { Name: art.name, ImagePath: art.imagePath }, apliiq.createArtwork);
          artworkIds[art.key] = response.Id;
        }
        design = await withIntent(`design-${spec.slug}`, designPayload(spec, artworkIds), apliiq.createDesign);
      }
      const skus = {};
      for (const size of spec.sizes) {
        const sku = expectedSku(design.Id, size);
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
    else positional.push(token);
  }
  return { command, arg: positional[0], flags };
}

export async function run(argv) {
  const { command, arg, flags } = parse(argv);
  const handler = commands[command];
  if (!handler) throw new CatalogError(`Unknown command ${command ?? "(none)"}. Commands: ${Object.keys(commands).join(", ")}.`, { code: "usage" });
  const result = await handler(arg, flags);
  const logged = log(command, { ok: true, result });
  return { ok: true, command, ...result, log: logged };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run(process.argv.slice(2)).then(
    (summary) => { process.stdout.write(`${JSON.stringify(summary)}\n`); },
    (error) => {
      const code = error instanceof CatalogError ? error.code : "unexpected";
      const logged = log(process.argv[2] ?? "unknown", { ok: false, code, message: error.message, details: error.details });
      process.stdout.write(`${JSON.stringify({ ok: false, command: process.argv[2], code, message: error.message, details: Array.isArray(error.details) ? error.details.slice(0, 10) : undefined, log: logged })}\n`);
      process.exitCode = error instanceof CatalogError ? error.exit : 1;
    },
  );
}
