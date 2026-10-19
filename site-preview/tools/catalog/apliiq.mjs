// Apliiq API client for the catalog engine. Apliiq has no sandbox, no
// idempotency key and no design list/get/update endpoint, so every create is
// preceded by a durable intent file and an ambiguous outcome is never retried.
import { createHmac, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { CatalogError, PATHS, readJson, writeJsonAtomic } from "./lib.mjs";

const API = "https://api.apliiq.com/v1";

export function apliiqCredentials(env = process.env) {
  const apiKey = env.AHA_APLIIQ_API_KEY;
  const sharedSecret = env.AHA_APLIIQ_SHARED_SECRET;
  if (!apiKey || !sharedSecret) throw new CatalogError("AHA_APLIIQ_API_KEY and AHA_APLIIQ_SHARED_SECRET are required for Apliiq calls.", { code: "apliiq_credentials_missing", exit: 3 });
  return { apiKey, sharedSecret };
}

export function signature({ apiKey, sharedSecret }, body, { timestamp = Math.floor(Date.now() / 1000), nonce = randomUUID() } = {}) {
  const encoded = Buffer.from(body, "utf8").toString("base64");
  const signed = createHmac("sha256", sharedSecret).update(`${apiKey}${timestamp}${nonce}${encoded}`, "utf8").digest("base64");
  return `x-apliiq-auth ${timestamp}:${signed}:${apiKey}:${nonce}`;
}

export function createApliiqClient({ credentials, fetchImpl = fetch, timeoutMs = 20_000 }) {
  async function request(route, { method = "GET", body } = {}) {
    const raw = body === undefined ? "" : JSON.stringify(body);
    let response;
    try {
      response = await fetchImpl(`${API}${route}`, {
        method,
        headers: { Authorization: signature(credentials, raw), Accept: "application/json", ...(raw ? { "Content-Type": "application/json" } : {}) },
        ...(raw ? { body: raw } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new CatalogError(`Apliiq ${method} ${route} had no confirmed response (${error.name}).`, { code: "apliiq_uncertain" });
    }
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { throw new CatalogError(`Apliiq ${method} ${route} returned non-JSON (${response.status}).`, { code: "apliiq_uncertain" }); }
    // A wrong HMAC signature comes back as HTTP 500, not 401.
    if (!response.ok) throw new CatalogError(`Apliiq ${method} ${route} failed (${response.status}).`, { code: response.status >= 500 ? "apliiq_uncertain" : "apliiq_rejected", details: data });
    return data;
  }
  return {
    getProduct: (productId) => request(`/Product/${productId}`),
    createArtwork: (payload) => request("/Artwork", { method: "POST", body: payload }),
    createDesign: (payload) => request("/Design", { method: "POST", body: payload }),
  };
}

/**
 * Run one provider create behind an intent file. A completed intent returns its
 * saved response; a pending, uncertain or rejected intent stops the run until
 * someone reconciles it in the Apliiq dashboard.
 */
export async function withIntent(key, payload, create, { directory = PATHS.intents } = {}) {
  const file = path.join(directory, `${key}.json`);
  if (existsSync(file)) {
    const saved = readJson(file);
    if (saved.state === "complete") return saved.response;
    throw new CatalogError(`${key} has a ${saved.state} intent from ${saved.createdAt}. Check Apliiq for a matching record, then mark the intent complete or delete it. Never retry blindly.`, { code: "intent_blocked", exit: 4 });
  }
  const intent = { schemaVersion: 1, key, state: "pending", createdAt: new Date().toISOString(), payload };
  writeJsonAtomic(file, intent);
  try {
    const response = await create(payload);
    if (!Number.isSafeInteger(response?.Id)) throw new CatalogError(`${key}: Apliiq accepted the request but returned no Id.`, { code: "apliiq_uncertain" });
    writeJsonAtomic(file, { ...intent, state: "complete", finishedAt: new Date().toISOString(), response });
    return response;
  } catch (error) {
    const state = error.code === "apliiq_rejected" ? "rejected" : "uncertain";
    writeJsonAtomic(file, { ...intent, state, finishedAt: new Date().toISOString(), error: error.message });
    throw error;
  }
}

export function designPayload(spec, artworkIds) {
  const { apliiq } = spec;
  return {
    ProductId: apliiq.productId,
    ProductCode: apliiq.productCode,
    ColorId: apliiq.colorId,
    ...(apliiq.mockupTemplateId ? { MockupTemplateId: apliiq.mockupTemplateId } : {}),
    Locations: apliiq.locations.map((location) => ({
      Id: location.id,
      ImagePath: location.imagePath,
      Artworks: [{ Id: artworkIds[location.artworkKey], Service: location.service, Note: location.note, ...(location.boxId ? { BoxId: location.boxId } : {}), ...(location.printColors ? { PrintColors: location.printColors } : {}) }],
    })),
    Subscriptions: [{ Placement: { Id: apliiq.label.placementId, Name: apliiq.label.placementName }, Label: { Id: apliiq.label.id } }],
    Name: spec.title + (spec.color ? ` — ${spec.color}` : ""),
    Description: spec.apliiq.productionNote ?? spec.description,
  };
}
