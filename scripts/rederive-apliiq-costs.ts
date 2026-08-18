/**
 * Move data/apliiq-map.json between APLIIQ's standard and VIP price tiers.
 *
 * WHY THIS EXISTS
 *
 * APLIIQ VIP is a flat 20% off products and services. The plan is to capture
 * costs at standard prices, then buy VIP immediately before selling — which is
 * the financially safe order (gating at the higher cost can never bless an
 * underwater SKU) but leaves every captured cost 20% too high the moment VIP
 * lands. lib/data/purchasable.ts reconciles each entry's stored marginEstimate
 * against the recomputed landed figure by EXACT equality, so on that day every
 * APLIIQ variant fails validate-apliiq-map and margin-check and the deploy is
 * blocked until all of them are re-derived by hand.
 *
 * This makes it one command.
 *
 * WHAT IT DOES
 *
 *   - reads every entry's apliiqCostBasis (absent = "standard")
 *   - applies or removes the 20% discount on apliiqItemCost
 *   - recomputes costEstimate and marginEstimate through resolveApliiqLandedCost,
 *     the SAME resolver the build gate uses, so the numbers agree by construction
 *   - stamps the new basis and rewrites the file
 *
 * IDEMPOTENT. An entry already on the target basis is skipped, so running twice
 * cannot double-discount. That is the whole reason apliiqCostBasis exists: with
 * only a cost field there is no way to tell a discounted number from a full one.
 *
 * Usage:
 *   npx tsx scripts/rederive-apliiq-costs.ts --to vip     [--dry-run]
 *   npx tsx scripts/rederive-apliiq-costs.ts --to standard [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseApliiqMapDocument } from "@/lib/data/apliiq-map";
import { resolveApliiqLandedCost } from "@/lib/commerce/landed-cost";

/** APLIIQ VIP: "20% off on all dropshipping products and services". */
const VIP_DISCOUNT_BASIS_POINTS = 2000;

const MAP_PATH = resolve(process.cwd(), "data/apliiq-map.json");

function parseArgs(): { target: "vip" | "standard"; dryRun: boolean } {
  const argv = process.argv.slice(2);
  const toIndex = argv.indexOf("--to");
  const target = toIndex >= 0 ? argv[toIndex + 1] : undefined;
  if (target !== "vip" && target !== "standard") {
    console.error("Usage: rederive-apliiq-costs.ts --to <vip|standard> [--dry-run]");
    process.exit(2);
  }
  return { target, dryRun: argv.includes("--dry-run") };
}

const KEEP_BASIS_POINTS = 10_000 - VIP_DISCOUNT_BASIS_POINTS;

function standardToVip(cents: number): number {
  return Math.round((cents * KEEP_BASIS_POINTS) / 10_000);
}

/**
 * VIP -> standard must be the EXACT inverse of standardToVip, not a 20% markup.
 *
 * Naive `round(c * 10000 / 8000)` fails to round-trip on ~20% of cent values
 * because both directions round: 1276 -> 1021 -> 1276 works, but plenty of
 * neighbours land a cent off. purchasable.ts compares the stored marginEstimate
 * to the recomputed landed figure by EXACT equality, so a one-cent drift is a
 * hard validation failure, not a rounding nicety.
 *
 * The discount is not injective — several standard costs can map to the same
 * VIP cost — so an exact inverse is only recoverable by finding a value that
 * maps forward to what we hold. Check the arithmetic candidate and its two
 * neighbours; if none maps back, say so rather than writing a number that will
 * fail the gate later.
 */
function vipToStandard(cents: number): number | null {
  const approx = Math.round((cents * 10_000) / KEEP_BASIS_POINTS);
  for (const candidate of [approx, approx - 1, approx + 1]) {
    if (candidate > 0 && standardToVip(candidate) === cents) return candidate;
  }
  return null;
}

function convertItemCost(cents: number, to: "vip" | "standard"): number | null {
  return to === "vip" ? standardToVip(cents) : vipToStandard(cents);
}

function main() {
  const { target, dryRun } = parseArgs();
  const raw = JSON.parse(readFileSync(MAP_PATH, "utf8"));
  const doc = parseApliiqMapDocument(raw);
  const entries = Object.entries(doc.map);

  if (entries.length === 0) {
    console.log(`✓ data/apliiq-map.json is empty — nothing to re-derive. Capture costs on the "${target}" basis and stamp apliiqCostBasis as you go.`);
    return;
  }

  let converted = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const [key, entry] of entries) {
    const basis = entry.apliiqCostBasis ?? "standard";
    if (basis === target) { skipped += 1; continue; }
    if (entry.apliiqItemCost == null) {
      failures.push(`${key}: no apliiqItemCost to convert`);
      continue;
    }

    const nextItemCost = convertItemCost(entry.apliiqItemCost, target);
    if (nextItemCost === null) {
      failures.push(`${key}: ${entry.apliiqItemCost}c has no exact standard-price inverse — re-capture this cost from APLIIQ rather than letting it drift a cent`);
      continue;
    }
    const candidate = { ...entry, apliiqItemCost: nextItemCost, apliiqCostBasis: target };

    // Re-derive through the real resolver rather than adjusting the stored
    // margin arithmetically — freight tiers are irregular and the fee is flat,
    // so a scaled margin would not match what the gate recomputes.
    const landed = resolveApliiqLandedCost(candidate as never);
    if (!landed.ok) {
      failures.push(`${key}: ${landed.reasons.join("; ")}`);
      continue;
    }

    raw.map[key] = {
      ...raw.map[key],
      apliiqItemCost: nextItemCost,
      apliiqCostBasis: target,
      costEstimate: landed.landed.itemCostCents,
      marginEstimate: landed.landed.margin.contributionMargin,
    };
    converted += 1;
  }

  if (failures.length) {
    console.error(`✗ rederive-apliiq-costs: ${failures.length} entr(y/ies) could not be converted:\n  - ${failures.join("\n  - ")}`);
    console.error("Nothing was written. Fix these and re-run — a partially converted map would ship mixed-basis pricing.");
    process.exit(1);
  }

  if (dryRun) {
    console.log(`(dry run) ${converted} entr(y/ies) would move to "${target}", ${skipped} already there. No file written.`);
    return;
  }

  writeFileSync(MAP_PATH, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`✓ rederive-apliiq-costs: ${converted} entr(y/ies) moved to "${target}", ${skipped} already there.`);
  console.log("  Run `npm run validate:all` before committing — every marginEstimate just changed.");
}

main();
