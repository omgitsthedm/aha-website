// Product drafts: the inbox between Apliiq's "Add to Store" button (or the
// admin form) and the catalog engine. A draft is never sellable; publishing
// goes through the engine, which writes the ledger, Square and the site.
import { randomUUID, timingSafeEqual, createHash } from "node:crypto";

const STATUSES = new Set(["draft", "approved", "rejected", "published", "failed"]);
const SKU_PATTERN = /^APQ-(\d+)S(\d+)A1$/;
const MAX_TEXT = 512;
const MAX_DESCRIPTION = 8000;
const MAX_IMAGES = 32;
const MAX_VARIANTS = 64;

export class DraftValidationError extends Error {
  constructor(message) { super(message); this.status = 422; }
}

const json = (value) => (typeof value === "string" ? JSON.parse(value) : value);
const row = (value) => (value ? { ...value, payload_json: json(value.payload_json), apliiq_design_id: value.apliiq_design_id === null || value.apliiq_design_id === undefined ? null : Number(value.apliiq_design_id) } : null);

function text(value, field, max = MAX_TEXT, { optional = false } = {}) {
  if ((value === null || value === undefined || value === "") && optional) return null;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new DraftValidationError(`${field} must be text up to ${max} characters.`);
  return value.trim();
}
function httpsUrl(value, field) {
  const candidate = text(value, field, 2048);
  let url;
  try { url = new URL(candidate.startsWith("//") ? `https:${candidate}` : candidate); } catch { throw new DraftValidationError(`${field} must be an HTTPS URL.`); }
  if (url.protocol !== "https:" || url.username || url.password) throw new DraftValidationError(`${field} must be an HTTPS URL.`);
  return url.href;
}
function money(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10_000) throw new DraftValidationError(`${field} must be a price.`);
  return Math.round(number * 100);
}

/** Validate Apliiq's Add to Store payload into a draft payload. */
export function normalizeAddToStore(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new DraftValidationError("Body must be a JSON object.");
  const variantsRaw = Array.isArray(body.variants) ? body.variants : [];
  if (!variantsRaw.length || variantsRaw.length > MAX_VARIANTS) throw new DraftValidationError(`variants must list 1–${MAX_VARIANTS} sizes.`);
  const designIds = new Set();
  const variants = variantsRaw.map((variant, index) => {
    const sku = text(variant?.sku, `variants[${index}].sku`, 64);
    const match = SKU_PATTERN.exec(sku);
    if (!match) throw new DraftValidationError(`variants[${index}].sku must be a decorated Apliiq SKU (APQ-…A1).`);
    designIds.add(Number(match[1]));
    return {
      sku,
      size: text(variant.size, `variants[${index}].size`, 16),
      color: text(variant.color, `variants[${index}].color`, 64, { optional: true }),
      supplierPriceCents: money(variant.price ?? 0, `variants[${index}].price`),
      imageUrl: variant.imageUrl ? httpsUrl(variant.imageUrl, `variants[${index}].imageUrl`) : null,
      weight: Number.isFinite(Number(variant.weight)) ? Number(variant.weight) : null,
      weightUnit: typeof variant.weightUnit === "string" ? variant.weightUnit.slice(0, 8) : null,
    };
  });
  if (designIds.size !== 1) throw new DraftValidationError("All variants must belong to one Apliiq design.");
  const imageUrls = (Array.isArray(body.imageUrls) ? body.imageUrls : []).slice(0, MAX_IMAGES).map((url, index) => httpsUrl(url, `imageUrls[${index}]`));
  return {
    apliiqDesignId: [...designIds][0],
    name: text(body.name, "name"),
    description: text(body.description, "description", MAX_DESCRIPTION, { optional: true }),
    type: text(body.type, "type", 128, { optional: true }),
    currency: text(body.currency ?? "USD", "currency", 8),
    colors: (Array.isArray(body.colors) ? body.colors : []).map((color, index) => text(color, `colors[${index}]`, 64)),
    sizes: (Array.isArray(body.sizes) ? body.sizes : variants.map((variant) => variant.size)).map((size, index) => text(size, `sizes[${index}]`, 16)),
    imageUrls,
    variants,
    replaceProduct: body.replaceProduct === true,
    receivedStoreProductId: body.store_ProductId ? text(String(body.store_ProductId), "store_ProductId", 128) : null,
  };
}

/** Constant-time comparison of Apliiq's callback token (Apliiq signs nothing). */
export function callbackTokenValid(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || expected.length < 24) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function createDraftFromApliiq(db, body, { createId = randomUUID } = {}) {
  const payload = normalizeAddToStore(body);
  const existing = row((await db.sql`
    SELECT * FROM aha_product_drafts
    WHERE apliiq_design_id = ${payload.apliiqDesignId} AND status IN ('draft', 'approved')
    LIMIT 1
  `)[0]);
  if (existing) {
    // Pressing Add to Store again refreshes the open draft instead of duplicating it.
    return row((await db.sql`
      UPDATE aha_product_drafts SET payload_json = ${JSON.stringify(payload)}, status = 'draft', approved_by = NULL, approved_at = NULL, updated_at = now()
      WHERE id = ${existing.id} RETURNING *
    `)[0]);
  }
  return row((await db.sql`
    INSERT INTO aha_product_drafts (id, source, status, payload_json, apliiq_design_id)
    VALUES (${`draft_${createId()}`}, 'apliiq-add-to-store', 'draft', ${JSON.stringify(payload)}, ${payload.apliiqDesignId})
    RETURNING *
  `)[0]);
}

export async function listDrafts(db, { status } = {}) {
  if (status && !STATUSES.has(status)) throw new DraftValidationError("Unknown status.");
  const rows = status
    ? await db.sql`SELECT * FROM aha_product_drafts WHERE status = ${status} ORDER BY updated_at DESC LIMIT 200`
    : await db.sql`SELECT * FROM aha_product_drafts ORDER BY updated_at DESC LIMIT 200`;
  return rows.map(row);
}

export async function getDraft(db, id) {
  return row((await db.sql`SELECT * FROM aha_product_drafts WHERE id = ${id} LIMIT 1`)[0]);
}

/** Owner edits (title, copy, price, slug) on an unpublished draft. */
export async function updateDraft(db, id, patch) {
  const current = await getDraft(db, id);
  if (!current) return null;
  if (!["draft", "rejected", "failed"].includes(current.status)) throw new DraftValidationError(`A ${current.status} draft can't be edited.`);
  const next = { ...current.payload_json };
  if (patch.title !== undefined) next.title = text(patch.title, "title");
  if (patch.color !== undefined) next.color = text(patch.color, "color", 64);
  if (patch.description !== undefined) next.storeDescription = text(patch.description, "description", MAX_DESCRIPTION);
  if (patch.priceCents !== undefined) {
    if (!Number.isSafeInteger(patch.priceCents) || patch.priceCents < 100 || patch.priceCents > 100_000) throw new DraftValidationError("priceCents must be whole cents.");
    next.priceCents = patch.priceCents;
  }
  const slug = patch.designSlug === undefined ? current.design_slug : text(patch.designSlug, "designSlug", 80);
  if (slug && !/^[a-z0-9-]+$/.test(slug)) throw new DraftValidationError("designSlug must be lowercase letters, numbers and hyphens.");
  return row((await db.sql`
    UPDATE aha_product_drafts SET payload_json = ${JSON.stringify(next)}, design_slug = ${slug}, status = 'draft', updated_at = now()
    WHERE id = ${id} RETURNING *
  `)[0]);
}

export async function approveDraft(db, id, { actor }) {
  const actorName = text(actor, "actor", 128);
  return row((await db.sql`
    UPDATE aha_product_drafts SET status = 'approved', approved_by = ${actorName}, approved_at = now(), error = NULL, updated_at = now()
    WHERE id = ${id} AND status = 'draft' RETURNING *
  `)[0]);
}

export async function rejectDraft(db, id, { actor, reason }) {
  const actorName = text(actor, "actor", 128);
  const why = text(reason, "reason", 500);
  return row((await db.sql`
    UPDATE aha_product_drafts SET status = 'rejected', approved_by = ${actorName}, approved_at = now(), error = ${why}, updated_at = now()
    WHERE id = ${id} AND status IN ('draft', 'approved') RETURNING *
  `)[0]);
}

/** Apliiq's Product Search callback: open drafts that match a name. */
export async function searchDrafts(db, search) {
  const term = `%${String(search ?? "").slice(0, 80).replace(/[%_]/g, "")}%`;
  const rows = await db.sql`
    SELECT * FROM aha_product_drafts
    WHERE status IN ('draft', 'approved', 'published') AND payload_json->>'name' ILIKE ${term}
    ORDER BY updated_at DESC LIMIT 20
  `;
  return rows.map(row).map((draft) => ({ store_ProductId: draft.id, name: draft.payload_json.name, imageUrls: draft.payload_json.imageUrls ?? [] }));
}
