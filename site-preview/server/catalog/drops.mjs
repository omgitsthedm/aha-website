// Early access to drops. src/data/drops.json lists products with a release time
// and an earlier time from which signed-in account holders can buy them:
//   { "slug": "<product slug>", "earlyAccessAt": "2026-11-06T15:00:00Z", "releaseAt": "2026-11-07T15:00:00Z" }
// Before releaseAt the checkout quote refuses the product unless the shopper is
// signed in and earlyAccessAt has passed; feeds leave it out until releaseAt.
// Editing the file needs a deploy. Remove an entry once its drop is released.
import data from "../../src/data/drops.json" with { type: "json" };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/;

/** Problems with a drops list, in plain words (empty when valid). */
export function dropProblems(drops, products = []) {
  const problems = [];
  const seen = new Set();
  for (const drop of Array.isArray(drops) ? drops : [null]) {
    const label = drop?.slug ?? "a drop";
    if (typeof drop?.slug !== "string" || !/^[a-z0-9-]+$/.test(drop.slug)) { problems.push("Every drop needs a product slug."); continue; }
    if (seen.has(drop.slug)) problems.push(`${label} is listed twice.`);
    seen.add(drop.slug);
    if (products.length && !products.some((product) => product.slug === drop.slug)) problems.push(`${label} is not a product.`);
    if (!ISO.test(drop.earlyAccessAt ?? "") || !ISO.test(drop.releaseAt ?? "")) problems.push(`${label} needs earlyAccessAt and releaseAt as UTC times, e.g. 2026-11-07T15:00:00Z.`);
    else if (Date.parse(drop.earlyAccessAt) >= Date.parse(drop.releaseAt)) problems.push(`${label}: early access must open before the release.`);
  }
  return problems;
}

export const DROPS = Object.freeze(data.drops.map((drop) => Object.freeze({ ...drop })));

export const dropFor = (slug, drops = DROPS) => drops.find((drop) => drop.slug === slug) ?? null;

/** "early" (account holders only), "upcoming" (nobody yet), "released" or null for no drop. */
export function dropStage(drop, now = Date.now()) {
  if (!drop) return null;
  if (now >= Date.parse(drop.releaseAt)) return "released";
  return now >= Date.parse(drop.earlyAccessAt) ? "early" : "upcoming";
}

/** Drops not yet released to everyone. */
export const pendingDrops = (now = Date.now(), drops = DROPS) => drops.filter((drop) => dropStage(drop, now) !== "released");

/** Products shoppers may not see in feeds yet. */
export const releasedProducts = (products, now = Date.now(), drops = DROPS) => {
  const pending = new Set(pendingDrops(now, drops).map((drop) => drop.slug));
  return pending.size ? products.filter((product) => !pending.has(product.slug)) : products;
};

/** Variation IDs this shopper can't buy yet. */
export function lockedVariations(products, { now = Date.now(), signedIn = false, drops = DROPS } = {}) {
  const locked = new Set();
  for (const drop of pendingDrops(now, drops)) {
    if (signedIn && dropStage(drop, now) === "early") continue;
    for (const variant of products.find((product) => product.slug === drop.slug)?.variants ?? []) locked.add(variant.id);
  }
  return locked;
}

/** Seconds until the next drop opens to everyone, for capping feed cache lifetimes. */
export function secondsToNextRelease(now = Date.now(), drops = DROPS) {
  const next = pendingDrops(now, drops).map((drop) => Date.parse(drop.releaseAt)).sort((a, b) => a - b)[0];
  return next ? Math.max(60, Math.ceil((next - now) / 1000)) : null;
}

const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

/** The product-page note for a drop, the same in Astro's build and the live renderer. */
export const dropNote = (drop) => `Account holders can buy it from ${WHEN.format(new Date(drop.earlyAccessAt))}. Everyone can from ${WHEN.format(new Date(drop.releaseAt))}.`;
