import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApliiqProductionIdentity,
  capsuleCreationFingerprint,
} from "@/scripts/lib/apliiq-capsule-creation";
import { capsuleApprovalFingerprint } from "@/scripts/lib/apliiq-capsule-approvals";
import {
  assertGitPublishSafety,
  assertGitPublishContinuationSafety,
  createPublisherContinuation,
  buildPublishPlan,
  buildStagedPublishPlan,
  parsePublisherArgs,
  preflightApliiqProduct,
  publisherContinuationForArgs,
} from "@/scripts/apliiq-product-publisher";
import {
  apliiqProviderItemCostCents,
  assertApliiqExecutionSafety,
  assertApliiqMapActivationReady,
  parseApliiqCapsuleArgs,
  privateLabelSnapshot,
} from "@/scripts/apliiq-capsule";
import { assertSquareApplyApproval, assertSquareExecutionSafety } from "@/scripts/square-capsule.mjs";

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
    privateLabelStatus: "not-attached",
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
    privateLabelStatus: "not-attached",
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

  it("shares the exact design-stage approval gate with standalone Square apply commands", () => {
    expect(assertSquareApplyApproval(fixture({ omitSquare: true }), "test-tee")).toMatchObject({ slug: "test-tee", designId: 22 });
    expect(() => assertSquareApplyApproval(fixture({ omitSquare: true, omitApprovals: true }), "test-tee"))
      .toThrow(/approvals\.mapping\.status/);
    expect(() => assertSquareApplyApproval(fixture({ omitSquare: true, staleFingerprint: true }), "test-tee"))
      .toThrow(/productionFingerprint is stale or missing/);
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
    expect(() => parseApliiqCapsuleArgs(["create", "--apply"])).toThrow("--slug");
    expect(() => parseApliiqCapsuleArgs(["map", "--apply"])).toThrow("--slug");
  });

  it("keeps the lower-level APLIIQ CLI slug-scoped and truthful about unattached labels", () => {
    expect(parseApliiqCapsuleArgs(["create", "--slug", "test-tee"])).toEqual({
      command: "create", slug: "test-tee", apply: false,
    });
    expect(() => parseApliiqCapsuleArgs(["create", "--slug", "one", "--only", "two"])).toThrow("exactly one");
    expect(privateLabelSnapshot("not-attached")).toEqual({ status: "not-attached" });
    expect(apliiqProviderItemCostCents(10, 0)).toBe(1749);
  });

  it("is dry-run by default", () => {
    expect(parsePublisherArgs(["--slug", "test-tee"])).toEqual({ slug: "test-tee", apply: false, commit: false, push: false });
  });

  it("will not commit or push without apply and will not push uncommitted work", () => {
    expect(() => parsePublisherArgs(["--slug", "test-tee", "--commit"])).toThrow("require --apply");
    expect(() => parsePublisherArgs(["--slug", "test-tee", "--apply", "--push"])).toThrow("requires --commit");
  });

  it("allows provider writes only from a clean non-main branch", () => {
    const root = mkdtempSync(join(tmpdir(), "aha-apliiq-git-safety-"));
    roots.push(root);
    execFileSync("git", ["init", "-q", "-b", "feature/publish"], { cwd: root });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "--allow-empty", "-m", "Initial"], { cwd: root });
    expect(assertGitPublishSafety(root)).toBe("feature/publish");
    expect(assertApliiqExecutionSafety(root)).toBe("feature/publish");
    expect(publisherContinuationForArgs(root, parsePublisherArgs(["--slug", "test-tee"]))).toBeUndefined();
    const continuation = createPublisherContinuation(root);
    expect(continuation.branch).toBe("feature/publish");
    mkdirSync(join(root, "data"), { recursive: true });
    writeFileSync(join(root, "data", "apliiq-capsule-designs.json"), "{}");
    expect(assertGitPublishContinuationSafety(root, continuation)).toBe("feature/publish");
    expect(assertApliiqExecutionSafety(root, continuation)).toBe("feature/publish");
    expect(assertSquareExecutionSafety(root, continuation)).toBe("feature/publish");
    expect(() => assertSquareExecutionSafety(root, { branch: continuation.branch, head: continuation.head })).toThrow(/in-process capability/);
    rmSync(join(root, "data"), { recursive: true });
    writeFileSync(join(root, "dirty.txt"), "dirty");
    expect(() => publisherContinuationForArgs(root, parsePublisherArgs(["--slug", "test-tee", "--apply"]))).toThrow("completely clean");
    expect(() => assertApliiqExecutionSafety(root)).toThrow("completely clean");
    expect(() => assertSquareExecutionSafety(root)).toThrow("completely clean");
    expect(() => assertGitPublishContinuationSafety(root, continuation)).toThrow(/unexpected changed files/);
    rmSync(join(root, "dirty.txt"));
    execFileSync("git", ["switch", "-q", "-c", "main"], { cwd: root });
    expect(() => publisherContinuationForArgs(root, parsePublisherArgs(["--slug", "test-tee", "--apply"]))).toThrow(/main.*forbidden/);
    expect(() => assertSquareExecutionSafety(root)).toThrow(/main.*forbidden/);
    expect(() => assertApliiqExecutionSafety(root)).toThrow(/main.*forbidden/);
  });

  it("refuses to activate an APLIIQ map before a provider GET verifies Square mappings", async () => {
    await expect(assertApliiqMapActivationReady(
      fixture({ omitSquare: true }),
      "test-tee",
      async () => { throw new Error("provider verifier must not run before local preflight"); },
    )).rejects.toThrow(/Square item and variation mappings/);

    const forgedIds = fixture();
    const rejectForgedIds = vi.fn(async () => {
      throw new Error("Square item mapping SQUARE-ITEM is stale or does not resolve to the expected live item");
    });
    await expect(assertApliiqMapActivationReady(forgedIds, "test-tee", rejectForgedIds))
      .rejects.toThrow(/Square item mapping SQUARE-ITEM is stale/);
    expect(rejectForgedIds).toHaveBeenCalledExactlyOnceWith("test-tee");

    const verifyProviderIds = vi.fn(async () => ({ id: "SQUARE-ITEM" }));
    await expect(assertApliiqMapActivationReady(forgedIds, "test-tee", verifyProviderIds)).resolves.toBeUndefined();
    expect(verifyProviderIds).toHaveBeenCalledExactlyOnceWith("test-tee");
  });
});
