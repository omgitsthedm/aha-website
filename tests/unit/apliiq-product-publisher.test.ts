import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildApliiqProductionIdentity,
  capsuleCreationFingerprint,
} from "@/scripts/lib/apliiq-capsule-creation";
import { capsuleApprovalFingerprint } from "@/scripts/lib/apliiq-capsule-approvals";
import {
  assertGitPublishSafety,
  buildPublishPlan,
  buildStagedPublishPlan,
  parsePublisherArgs,
  preflightApliiqProduct,
} from "@/scripts/apliiq-product-publisher";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(overrides: {
  story?: string;
  sku?: string;
  squareVariations?: Record<string, string>;
  omitImage?: string;
  omitDesign?: boolean;
  omitSquare?: boolean;
  omitApprovals?: boolean;
  staleFingerprint?: boolean;
  redesign?: "artwork" | "location";
} = {}): string {
  const root = mkdtempSync(join(tmpdir(), "aha-apliiq-publisher-"));
  roots.push(root);
  mkdirSync(join(root, "data"), { recursive: true });
  mkdirSync(join(root, "public", "products", "test-tee"), { recursive: true });
  const auditedProduct = {
    slug: "test-tee",
    title: "Test Tee",
    productCode: "mens_Test-Tee",
    frontLocationId: 4548,
    artworkUrl: "https://afterhoursagenda.com/art/test-tee.png",
    mockupUrl: "https://afterhoursagenda.com/products/test-tee/front.jpg",
    printNote: "Front print.",
  };
  const frontLocationId = overrides.redesign === "location" ? 9999 : 4548;
  const artworkUrl = overrides.redesign === "artwork" ? "https://afterhoursagenda.com/art/test-tee-v2.png" : "https://afterhoursagenda.com/art/test-tee.png";
  const approvalFingerprint = capsuleApprovalFingerprint({
    slug: "test-tee",
    productCode: "mens_Test-Tee",
    colorId: 50,
    frontLocationId,
    designId: 22,
    artworkId: 11,
    artworkUrl,
    service: "transfer_print",
    printNote: "Front print.",
    privateLabel: "SB-2-155690",
    sizeGuideId: "sg-test",
    variants: [
      { sku: overrides.sku ?? "APQ-22S6A1", size: "s" },
      { sku: "APQ-22S7A1", size: "m" },
    ],
  });
  const product = {
    slug: "test-tee",
    title: "Test Tee",
    productCode: "mens_Test-Tee",
    frontLocationId,
    productType: "tee",
    sizeGuideId: "sg-test",
    fabricDescription: "Cotton.",
    retailPrice: 4000,
    sizeRetail: {},
    artworkUrl,
    mockupUrl: "https://afterhoursagenda.com/products/test-tee/front.jpg",
    printNote: "Front print.",
    story: overrides.story ?? "<p>An authored product story.</p>",
    ...(!overrides.omitApprovals ? {
      approvals: {
        productionFingerprint: overrides.staleFingerprint ? "0".repeat(64) : approvalFingerprint,
        mapping: { status: "approved", approvedAt: "2026-08-19" },
        sample: { status: "approved", approvedAt: "2026-08-19" },
      },
    } : {}),
    ...(!overrides.omitSquare ? {
      square: {
        itemId: "SQUARE-ITEM",
        variations: overrides.squareVariations ?? { S: "SQUARE-S", M: "SQUARE-M" },
      },
    } : {}),
  };
  writeFileSync(join(root, "data", "apliiq-capsule.json"), JSON.stringify({
    colorId: 50,
    service: "transfer_print",
    privateLabel: "SB-2-155690",
    products: [product],
  }));
  const recordFields = {
    artworkId: 11,
    designId: 22,
    variants: [
      { sku: overrides.sku ?? "APQ-22S6A1", size: "s", weight: "4 oz", plusSizeFee: 0 },
      { sku: "APQ-22S7A1", size: "m", weight: "4 oz", plusSizeFee: 0 },
    ],
  };
  const creationSpec = { colorId: 50, service: "transfer_print" };
  writeFileSync(join(root, "data", "apliiq-capsule-designs.json"), JSON.stringify({
    designs: overrides.omitDesign ? {} : {
      "test-tee": {
        ...recordFields,
        productCode: "mens_Test-Tee",
        colorId: 50,
        apliiqMockupPath: "//provider/mockup.png",
        _creation: { version: 2, specFingerprint: capsuleCreationFingerprint(auditedProduct, creationSpec), status: "design-created" },
        _identity: buildApliiqProductionIdentity(auditedProduct, creationSpec, recordFields),
      },
    },
  }));
  writeFileSync(join(root, "data", "apliiq-map.json"), JSON.stringify({ map: {} }));
  writeFileSync(join(root, "data", "size-guides.json"), JSON.stringify({
    sizeGuides: [{ id: "sg-test", measurements: [{ size: "S" }, { size: "M" }] }],
  }));
  for (const name of ["front", "detail", "art"]) {
    if (name !== overrides.omitImage) writeFileSync(join(root, "public", "products", "test-tee", `${name}.jpg`), `${name}-bytes`);
  }
  return root;
}

describe("APLIIQ product publisher preflight", () => {
  it("accepts one fully prepared slug and produces a selected, non-destructive plan", () => {
    const checked = preflightApliiqProduct(fixture(), "test-tee");
    expect(checked).toMatchObject({ slug: "test-tee", itemId: "SQUARE-ITEM", sizes: ["S", "M"], designId: 22, variantCount: 2 });
    expect(buildPublishPlan(checked).join("\n")).toContain("selected slug's landed-cost map");
    expect(buildPublishPlan(checked).join("\n")).not.toMatch(/delete|archive/i);
  });

  it("lets a new product prepare its design but cannot progress past design without the exact fingerprint", () => {
    const sourceOnlyRoot = fixture({ omitDesign: true, omitSquare: true, omitApprovals: true });
    const source = preflightApliiqProduct(sourceOnlyRoot, "test-tee", "source");
    expect(source).toMatchObject({ slug: "test-tee", priorMappedVariants: 0 });
    expect(() => preflightApliiqProduct(sourceOnlyRoot, "test-tee", "design")).toThrow(/design will be created/);
    expect(buildStagedPublishPlan(source, null, null)).toEqual(expect.arrayContaining([
      expect.stringContaining("create the missing APLIIQ"),
      expect.stringContaining("create or resume the Square item"),
    ]));

    const preparedDesignRoot = fixture({ omitSquare: true, omitApprovals: true });
    expect(() => preflightApliiqProduct(preparedDesignRoot, "test-tee", "design"))
      .toThrow(/approvals\.mapping\.status.*Expected production fingerprint: [a-f0-9]{64}/);
  });

  it("rejects stale approval metadata and prints the exact expected fingerprint", () => {
    expect(() => preflightApliiqProduct(fixture({ staleFingerprint: true }), "test-tee", "design"))
      .toThrow(/productionFingerprint is stale or missing.*Expected production fingerprint: [a-f0-9]{64}/);
  });

  it.each([
    ["artwork redesign", { redesign: "artwork" }, /different immutable production spec/],
    ["location redesign", { redesign: "location" }, /different immutable production spec/],
    ["authored story", { story: "" }, /missing story/],
    ["required image", { omitImage: "detail" }, /missing nonempty product image/],
    ["A1 production SKU", { sku: "APQ-22S6A0" }, /ending in A1/],
    ["Square size mapping", { squareVariations: { S: "SQUARE-S" } }, /M: Square variation mapping will be created/],
    ["identity-bound approvals after design", { omitApprovals: true, omitSquare: true }, /approvals.mapping.status/],
  ])("fails closed on a missing %s", (_label, override, expected) => {
    expect(() => preflightApliiqProduct(fixture(override as Parameters<typeof fixture>[0]), "test-tee")).toThrow(expected);
  });
});

describe("publisher CLI safety", () => {
  it("requires an explicit selected slug", () => {
    expect(() => parsePublisherArgs([])).toThrow("--slug");
  });

  it("is dry-run by default", () => {
    expect(parsePublisherArgs(["--slug", "test-tee"])).toEqual({ slug: "test-tee", apply: false, commit: false, push: false });
  });

  it("will not commit or push without apply and will not push uncommitted work", () => {
    expect(() => parsePublisherArgs(["--slug", "test-tee", "--commit"])).toThrow("require --apply");
    expect(() => parsePublisherArgs(["--slug", "test-tee", "--apply", "--push"])).toThrow("requires --commit");
  });

  it("allows release automation only from a clean non-main branch", () => {
    const root = mkdtempSync(join(tmpdir(), "aha-apliiq-git-safety-"));
    roots.push(root);
    execFileSync("git", ["init", "-q", "-b", "feature/publish"], { cwd: root });
    expect(assertGitPublishSafety(root)).toBe("feature/publish");
    writeFileSync(join(root, "dirty.txt"), "dirty");
    expect(() => assertGitPublishSafety(root)).toThrow("completely clean");
    rmSync(join(root, "dirty.txt"));
    execFileSync("git", ["switch", "-q", "-c", "main"], { cwd: root });
    expect(() => assertGitPublishSafety(root)).toThrow("main is forbidden");
  });
});
