/**
 * Backfill gender and category taxonomy into data/product-manifest.json.
 * Run: node scripts/backfill-taxonomy.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const MANIFEST_PATH = join(DATA_DIR, "product-manifest.json");

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

const CATEGORY_BY_TYPE = {
  tee: "t-shirts",
  hoodie: "hoodies-sweatshirts",
  sweater: "sweaters-knitwear",
  accessory: "accessories",
  other: "accessories",
};

let updated = 0;
for (const product of manifest.products) {
  const category = CATEGORY_BY_TYPE[product.productType] || "accessories";
  // Every current AHA product is unisex; all apparel and accessories appear in
  // Men's, Women's, and the standalone Unisex browse.
  const gender = ["men", "women", "unisex"];

  if (!product.category) {
    product.category = category;
    updated++;
  }
  if (!product.gender || product.gender.length === 0) {
    product.gender = gender;
    updated++;
  }
}

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Backfilled taxonomy for ${manifest.products.length} products (${updated} fields updated).`);
