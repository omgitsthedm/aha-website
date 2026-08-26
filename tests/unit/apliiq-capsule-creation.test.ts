import { describe, expect, it, vi } from "vitest";
import {
  buildApliiqProductionIdentity,
  capsuleCreationFingerprint,
  createOrResumeApliiqDesign,
  type DesignCreationState,
} from "@/scripts/lib/apliiq-capsule-creation";

const product = {
  slug: "test-tee",
  title: "Test Tee",
  productCode: "blank-tee",
  frontLocationId: 12,
  artworkUrl: "https://example.com/art.png",
  mockupUrl: "https://example.com/mockup.png",
  printNote: "Centered",
};
const spec = { colorId: 50, service: "DTF" };
const designResponse = {
  Id: 202,
  ProductCode: "blank-tee",
  ColorId: 50,
  Locations: [{ ImagePath: "//provider/mockup.png" }],
  Variants: [{ SKU: "APQ-202S7A1", Name: "m", Weight: "4 oz", PlusSize_Fee: 0 }],
};

function copy(state: DesignCreationState): DesignCreationState {
  return JSON.parse(JSON.stringify(state)) as DesignCreationState;
}

describe("APLIIQ capsule creation checkpoints", () => {
  it("persists slug-local intent and success state around every provider write", async () => {
    const states: DesignCreationState[] = [];
    const callProvider = vi.fn()
      .mockResolvedValueOnce({ Id: 101 })
      .mockResolvedValueOnce(designResponse);

    const result = await createOrResumeApliiqDesign({
      product,
      spec,
      persist: (state) => states.push(copy(state)),
      callProvider,
    });

    expect(states.map((state) => state._creation?.status)).toEqual([
      "artwork-pending",
      "artwork-created",
      "design-pending",
      "design-created",
    ]);
    expect(states[1]).toMatchObject({ artworkId: 101 });
    expect(states[3]).toMatchObject({ artworkId: 101, designId: 202 });
    expect(result.record._identity).toMatchObject({
      slug: "test-tee",
      productCode: "blank-tee",
      colorId: 50,
      frontLocationId: 12,
      artworkUrl: product.artworkUrl,
      artworkId: 101,
      service: "DTF",
      printNote: "Centered",
      designId: 202,
      variants: [{ size: "m", sku: "APQ-202S7A1" }],
    });
    expect(callProvider.mock.calls.map((call) => call[1])).toEqual(["/Artwork", "/Design"]);
    expect(callProvider).toHaveBeenNthCalledWith(2, "POST", "/Design", expect.objectContaining({
      Subscriptions: [],
    }));
  });

  it("reuses a persisted artwork after interruption instead of posting a duplicate", async () => {
    let durable: DesignCreationState | undefined;
    const firstCall = vi.fn().mockResolvedValue({ Id: 101 });

    await expect(createOrResumeApliiqDesign({
      product,
      spec,
      persist: (state) => {
        durable = copy(state);
        if (state._creation?.status === "artwork-created") throw new Error("simulated interruption");
      },
      callProvider: firstCall,
    })).rejects.toThrow("simulated interruption");

    expect(durable?._creation?.status).toBe("artwork-created");
    const retryCall = vi.fn().mockResolvedValue(designResponse);
    const result = await createOrResumeApliiqDesign({
      product,
      spec,
      existing: durable,
      persist: (state) => { durable = copy(state); },
      callProvider: retryCall,
    });

    expect(firstCall).toHaveBeenCalledTimes(1);
    expect(retryCall).toHaveBeenCalledTimes(1);
    expect(retryCall).toHaveBeenCalledWith("POST", "/Design", expect.objectContaining({
      Locations: [expect.objectContaining({ Artworks: [expect.objectContaining({ Id: 101 })] })],
    }));
    expect(result.record).toMatchObject({ artworkId: 101, designId: 202 });
  });

  it("fails closed rather than reusing a checkpoint after artwork or location redesign", async () => {
    const existing: DesignCreationState = {
      artworkId: 101,
      _creation: {
        version: 2,
        specFingerprint: capsuleCreationFingerprint(product, spec),
        status: "artwork-created",
      },
    };
    const callProvider = vi.fn();

    await expect(createOrResumeApliiqDesign({
      product: { ...product, frontLocationId: 99 },
      spec,
      existing,
      persist: vi.fn(),
      callProvider,
    })).rejects.toThrow(/different immutable production spec/);
    await expect(createOrResumeApliiqDesign({
      product: { ...product, artworkUrl: "https://example.com/new-art.png" },
      spec,
      existing,
      persist: vi.fn(),
      callProvider,
    })).rejects.toThrow(/different immutable production spec/);
    expect(callProvider).not.toHaveBeenCalled();
  });

  it("reuses an identity-preserving design when only its mutable mockup URL changes", async () => {
    const recordFields = {
      artworkId: 101,
      designId: 202,
      variants: [{ sku: "APQ-202S7A1", size: "m", weight: "4 oz", plusSizeFee: 0 }],
    };
    const existing: DesignCreationState = {
      ...recordFields,
      productCode: product.productCode,
      colorId: spec.colorId,
      apliiqMockupPath: "//provider/old.png",
      _creation: { version: 2, specFingerprint: capsuleCreationFingerprint(product, spec), status: "design-created" },
      _identity: buildApliiqProductionIdentity(product, spec, recordFields),
    };
    const callProvider = vi.fn();

    const result = await createOrResumeApliiqDesign({
      product: { ...product, mockupUrl: "https://example.com/new-square-photo.png" },
      spec,
      existing,
      persist: vi.fn(),
      callProvider,
    });

    expect(result).toEqual({ record: existing, created: false });
    expect(callProvider).not.toHaveBeenCalled();
  });

  it("fails closed on an ambiguous in-flight provider write", async () => {
    const existing: DesignCreationState = {
      artworkId: 101,
      _creation: {
        version: 2,
        specFingerprint: capsuleCreationFingerprint(product, spec),
        status: "design-pending",
      },
    };
    const callProvider = vi.fn();

    await expect(createOrResumeApliiqDesign({
      product,
      spec,
      existing,
      persist: vi.fn(),
      callProvider,
    })).rejects.toThrow(/unknown provider outcome/);
    expect(callProvider).not.toHaveBeenCalled();
  });
});
