// Shared paths and helpers for the catalog engine. Everything here is local:
// no provider is contacted from this module.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CATALOG_DIR = path.join(APP, "catalog");
export const PATHS = {
  ledger: path.join(CATALOG_DIR, "ledger.json"),
  costs: path.join(CATALOG_DIR, "costs.json"),
  designs: path.join(CATALOG_DIR, "designs"),
  intents: path.join(CATALOG_DIR, "intents"),
  plans: path.join(CATALOG_DIR, "plans"),
  logs: path.join(APP, "tools/catalog/logs"),
  products: path.join(APP, "src/data/products.json"),
  fulfillment: path.join(APP, "server/fulfillment/catalog.mjs"),
  dist: path.join(APP, "dist"),
};

/** Apliiq's size codes inside decorated SKUs (APQ-<design>S<code>A1). */
export const SIZE_CODES = Object.freeze({ XS: 5, S: 6, M: 7, L: 8, XL: 1, "2XL": 2, "3XL": 21, "4XL": 61, "5XL": 62 });
export const SKU_PATTERN = /^APQ-(\d+)S(\d+)A1$/;

export class CatalogError extends Error {
  constructor(message, { code = "catalog_error", exit = 1, details } = {}) {
    super(message);
    this.code = code;
    this.exit = exit;
    this.details = details;
  }
}

export function readJson(file, label = path.basename(file)) {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch (error) { throw new CatalogError(`Cannot read ${label}: ${error.message}`, { code: "read_failed" }); }
}

export function writeJsonAtomic(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  renameSync(temporary, file);
}

export function writeTextAtomic(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, text, { encoding: "utf8", flag: "wx" });
  renameSync(temporary, file);
}

export const sha256 = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

export function listDesigns(directory = PATHS.designs) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .sort()
    .map((name) => ({ file: path.join(directory, name), spec: readJson(path.join(directory, name)) }));
}

/** Details go to a JSONL log; stdout stays one JSON line for agents. */
export function log(command, entry) {
  mkdirSync(PATHS.logs, { recursive: true });
  const file = path.join(PATHS.logs, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), command, ...entry })}\n`);
  return path.relative(APP, file);
}

export function skuDesignId(sku) {
  const match = SKU_PATTERN.exec(sku ?? "");
  return match ? Number(match[1]) : null;
}

export function expectedSku(designId, size) {
  const code = SIZE_CODES[size];
  if (!code) throw new CatalogError(`Unknown size ${size}; add its Apliiq code to SIZE_CODES after verifying it.`, { code: "unknown_size" });
  return `APQ-${designId}S${code}A1`;
}
