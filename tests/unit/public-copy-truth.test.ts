import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  INTERNATIONAL_SHIPPING_CENTS,
  ORIGIN_CLAIM_CLAUSE, ORIGIN_CLAIM_SENTENCE, ORIGIN_CLAIM_SHORT,
  SHIPPING_CLAIM_DETAIL, SHIPPING_CLAIM_SHORT,
} from "@/lib/commerce/policies";
import { CATEGORIES } from "@/lib/commerce/taxonomy";

// H10/H11/H12. Apliiq prints in Huntington Park CA or Philadelphia PA and puts
// that city on the shipping label; it also receives the customer's name and
// full shipping address on every order. The catalog is closed, so each of these
// claims is currently dark — and each one goes live and false the moment it
// reopens. These tests are the tripwire.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const read = (relativePath: string): string => readFileSync(`${ROOT}${relativePath}`, "utf8");

const PRODUCT_PAGE = "app/product/[slug]/page.tsx";
const SHOP_PAGE = "app/shop/[[...slug]]/page.tsx";
const PRIVACY_PAGE = "app/privacy/page.tsx";
const PRODUCT_DETAIL = "components/product/ProductDetail.tsx";
const TRUST_STRIP = "components/ui/TrustStrip.tsx";

const CITY = String.raw`(?:NYC|New York City|New York|Brooklyn|Manhattan|the city)`;

/**
 * A false origin claim is a production verb whose location is a city — "printed
 * to order in NYC", "made to order in New York", "shipped from the city".
 *
 * The approved formulation puts the city on a *design* verb and leaves the
 * production verb unlocated ("designed in NYC and printed to order"), so the
 * lookahead stops the scan at `designed`/`drawn`: once a design verb has
 * claimed the sentence, a later city reference is no longer a print claim.
 */
const FALSE_ORIGIN_CLAIM = new RegExp(
  String.raw`\b(printed|prints|printing|made|makes|manufactured|produced|sewn|shipped|ships)\b` +
    String.raw`(?:(?!\b(?:designed|drawn)\b)[^.!?])*?\b(?:in|from)\s+${CITY}\b`,
  "i",
);

/**
 * Comments quote the forbidden strings on purpose (that is how the next author
 * learns the rule), so they are blanked before the sweep. Block comments are
 * space-filled rather than removed to keep line numbers honest, and `//` is
 * only treated as a comment when it is not preceded by `:` — otherwise every
 * `https://` URL would swallow the marketing copy that follows it on the line.
 */
const stripComments = (source: string, isMarkdown: boolean): string => {
  if (isMarkdown) {
    return source
      .split("\n")
      .map((line) => (/^\s*>/.test(line) ? "" : line))
      .join("\n");
  }
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
};

/**
 * Source files only. A trailing " 2" marks an inert iCloud duplicate that the
 * build never loads — and the repo has duplicate *directories* too
 * (`app/api/integrations/apliiq 2`), not just duplicate files. Both are skipped:
 * failing this suite on a file nobody can fix would send the next author to
 * edit a path that silently does nothing.
 */
const ICLOUD_DUPLICATE = / \d+$/;

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(`${ROOT}${dir}`, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const relativePath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!ICLOUD_DUPLICATE.test(entry.name)) walk(relativePath, out);
    } else if (/\.(ts|tsx|json|md)$/.test(entry.name) && !ICLOUD_DUPLICATE.test(entry.name.replace(/\.[^.]+$/, ""))) {
      out.push(relativePath);
    }
  }
  return out;
};

describe("origin claim constants", () => {
  it("never attaches a city to a production verb", () => {
    for (const claim of [ORIGIN_CLAIM_SHORT, ORIGIN_CLAIM_CLAUSE, ORIGIN_CLAIM_SENTENCE]) {
      expect(claim).not.toMatch(FALSE_ORIGIN_CLAIM);
    }
  });

  it("scopes the city to design and leaves production unlocated", () => {
    for (const claim of [ORIGIN_CLAIM_SHORT, ORIGIN_CLAIM_CLAUSE, ORIGIN_CLAIM_SENTENCE]) {
      expect(claim).toMatch(/designed in NYC/i);
    }
    expect(ORIGIN_CLAIM_CLAUSE).toContain("printed to order");
    expect(ORIGIN_CLAIM_SENTENCE).toContain("printed to order");
  });

  it("matches the voice already shipping in TrustStrip", () => {
    // TrustStrip was the one surface that got this right. The constant exists so
    // the other surfaces borrow that wording instead of inventing a new claim.
    expect(read(TRUST_STRIP)).toContain(`"${ORIGIN_CLAIM_SHORT}"`);
  });
});

describe("H10 print-location claims", () => {
  it("leads every PDP meta description with the design claim, not a print city", () => {
    const source = read(PRODUCT_PAGE);

    expect(source).toContain("const lead = `${product.name}: ${typeLabel} ${ORIGIN_CLAIM_CLAUSE}.`");
    expect(source).toContain("ORIGIN_CLAIM_CLAUSE");
    expect(stripComments(source, false)).not.toContain("printed to order in NYC");
  });

  it("leaves the shipping claim room to survive on the longest product name", () => {
    // The design-scoped lead is 10 characters longer than "printed to order in
    // NYC", and the lead is the one sentence buildProductMetaDescription never
    // length-checks — only the optional sentences after it are budgeted. If the
    // lead plus the shipping claim ever exceeds META_DESCRIPTION_MAX, the final
    // truncateAtWord silently amputates the shipping claim, which is a second
    // truth-in-advertising bug. Longest name in the manifest today is 59 chars.
    const source = read(PRODUCT_PAGE);
    const max = Number(source.match(/const META_DESCRIPTION_MAX = (\d+);/)?.[1]);
    expect(max).toBe(160);

    const manifest = JSON.parse(read("data/product-manifest.json")) as unknown;
    const products = (Array.isArray(manifest)
      ? manifest
      : Object.values(manifest as Record<string, unknown>).find(Array.isArray)) as { title?: string; name?: string }[];
    expect(products.length).toBeGreaterThan(0);

    const claim = `${SHIPPING_CLAIM_SHORT}, ${SHIPPING_CLAIM_DETAIL.toLowerCase()}.`;
    const longestTypeLabel = "graphic tee";
    for (const product of products) {
      const name = product.title ?? product.name ?? "";
      const lead = `${name}: ${longestTypeLabel} ${ORIGIN_CLAIM_CLAUSE}.`;
      expect(`${lead} ${claim}`.length).toBeLessThanOrEqual(max);
    }
  });

  it("keeps every category description free of a city entirely", () => {
    // Four consumers concatenate these into meta descriptions and page headers,
    // and each already appends its own origin claim. A city in the raw
    // description therefore lands next to a "made-to-order" CTA it does not own.
    for (const category of CATEGORIES) {
      expect(category.description).not.toMatch(new RegExp(CITY, "i"));
      expect(category.description).not.toMatch(FALSE_ORIGIN_CLAIM);
    }
  });

  it("splits the PDP brand story so the city cannot govern the printing", () => {
    const source = read(PRODUCT_DETAIL);
    const body = stripComments(source, false);

    expect(body).toContain("drawn in New York, after the day quiets down.");
    expect(body).toContain("Each piece is then printed to order, one at a time.");
    expect(body).not.toContain("in New York, then printed");
  });
});

describe("H11 shop purchase-surface claims", () => {
  const source = read(SHOP_PAGE);
  const body = stripComments(source, false);

  it("no longer names Printful as the printer and shipper", () => {
    expect(body).not.toContain("Printful");
    expect(body).toContain("Nothing is printed until you order it.");
  });

  it("qualifies the shipping badge instead of claiming free shipping on every order", () => {
    // The sub-line is `sm:block`, so on mobile only the label renders. The label
    // has to be true standing alone, and "Free shipping" is not: CA/GB/AU orders
    // carry a real Square service charge at INTERNATIONAL_SHIPPING_CENTS.
    expect(body).not.toMatch(/>Free shipping</);
    expect(body).not.toContain("On every order. No code needed.");
    expect(body).toContain("{SHIPPING_CLAIM_SHORT}");
    expect(body).toContain("{SHIPPING_CLAIM_DETAIL}");
    expect(SHIPPING_CLAIM_SHORT).toBe("Free US shipping");
    // Derived, not literal: the rate is a business decision that moves (it went
    // $20 -> $25 on 2026-08-17). What must never drift is the badge stating the
    // real charged amount, so assert the relationship rather than the number.
    expect(SHIPPING_CLAIM_DETAIL).toBe(`$${INTERNATIONAL_SHIPPING_CENTS / 100} flat rate international`);
  });

  it("routes the category header origin claim through the shared constant", () => {
    expect(body).toContain("${ORIGIN_CLAIM_SENTENCE}");
    expect(body).not.toContain("Designed in NYC and printed to order.");
  });
});

describe("H12 sub-processor disclosure", () => {
  const source = read(PRIVACY_PAGE);
  const subProcessors = source
    .split("\n")
    .find((line) => line.includes("Service providers (sub-processors)"));

  it("discloses Apliiq before it can receive a name and shipping address", () => {
    expect(subProcessors).toBeDefined();
    expect(subProcessors).toContain("Apliiq");
    expect(subProcessors).toMatch(/recipient name, shipping address/);
  });

  it("keeps Printful listed for the orders it actually fulfilled", () => {
    // Deleting it would misstate the record: real orders were produced by
    // Printful and those records are retained under "Order records".
    expect(subProcessors).toContain("Printful");
    expect(subProcessors).toMatch(/before the catalog reset/);
  });

  it("still discloses every previously listed sub-processor", () => {
    for (const processor of ["Square", "Printful", "Netlify", "Neon", "Resend"]) {
      expect(subProcessors).toContain(processor);
    }
  });
});

describe("repo-wide origin-claim sweep", () => {
  it("finds no surface pairing a city with a production verb", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "components", "lib", "data", "docs"]) {
      for (const relativePath of walk(dir)) {
        const isMarkdown = relativePath.endsWith(".md");
        // Archived handoffs are historical evidence, not live copy.
        if (relativePath.includes("/archive/")) continue;
        const lines = stripComments(read(relativePath), isMarkdown).split("\n");
        lines.forEach((line, index) => {
          const match = line.match(FALSE_ORIGIN_CLAIM);
          if (match) offenders.push(`${relativePath}:${index + 1} — ${match[0]}`);
        });
      }
    }

    expect(offenders).toEqual([]);
  });

  it("still recognises the three claims this change removed", () => {
    // Guards the sweep itself: a regex that matches nothing would pass the test
    // above forever. These are the literal strings that shipped before H10/H11.
    for (const claim of [
      "Sheep Min: hoodie printed to order in NYC.",
      "Jackets and coats, printed and made to order in New York.",
      "Every piece is made to order, printed on demand, and shipped from the city.",
    ]) {
      expect(claim).toMatch(FALSE_ORIGIN_CLAIM);
    }
  });

  it("does not flag the approved design-scoped formulation", () => {
    for (const claim of [
      ORIGIN_CLAIM_SENTENCE,
      "Men's graphic tees in ringspun cotton — designed in NYC and printed when you order.",
      "Small pieces from an independent NYC label, made to order.",
      "Expressive everyday clothing from New York. Tees and hoodies, printed to order.",
    ]) {
      expect(claim).not.toMatch(FALSE_ORIGIN_CLAIM);
    }
  });
});
