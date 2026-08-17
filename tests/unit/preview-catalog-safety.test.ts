import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const squareRequest = vi.fn(() => {
  throw new Error("Preview catalog attempted a provider request");
});

vi.mock("@/lib/square/client", () => ({ squareRequest }));

const originalPreviewFlag = process.env.AHA_PREVIEW_CATALOG;
const originalSquareToken = process.env.SQUARE_ACCESS_TOKEN;
const originalMaintenanceKey = process.env.OPS_MAINTENANCE_KEY;

describe("preview catalog isolation", () => {
  beforeAll(() => {
    process.env.AHA_PREVIEW_CATALOG = "true";
    process.env.SQUARE_ACCESS_TOKEN = "present-but-must-not-be-used";
    process.env.OPS_MAINTENANCE_KEY = "preview-maintenance-key";
  });

  afterAll(() => {
    if (originalPreviewFlag === undefined) delete process.env.AHA_PREVIEW_CATALOG;
    else process.env.AHA_PREVIEW_CATALOG = originalPreviewFlag;
    if (originalSquareToken === undefined) delete process.env.SQUARE_ACCESS_TOKEN;
    else process.env.SQUARE_ACCESS_TOKEN = originalSquareToken;
    if (originalMaintenanceKey === undefined) delete process.env.OPS_MAINTENANCE_KEY;
    else process.env.OPS_MAINTENANCE_KEY = originalMaintenanceKey;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps legacy products and collections dark even when a Square token is present", async () => {
    const { getAllCollections, getAllProducts } = await import("@/lib/square/catalog");

    const products = await getAllProducts();
    const collections = await getAllCollections();

    expect(products).toEqual([]);
    expect(collections).toEqual([]);
    expect(squareRequest).not.toHaveBeenCalled();
  });

  it("rejects privileged catalog-maintenance routes before any provider request", async () => {
    const providerFetch = vi.fn(() => {
      throw new Error("Preview catalog attempted a direct provider request");
    });
    vi.stubGlobal("fetch", providerFetch);

    const [{ POST: createCatalogItem }, { POST: rebuildCatalog }] = await Promise.all([
      import("@/app/api/ops/catalog-create/route"),
      import("@/app/api/ops/catalog-rebuild/route"),
    ]);
    const headers = {
      "content-type": "application/json",
      "x-maintenance-key": "preview-maintenance-key",
    };

    const createResponse = await createCatalogItem(
      new Request("https://preview.example/api/ops/catalog-create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Preview-only item",
          variations: [{ name: "M", priceCents: 3_000 }],
          imageUrls: ["https://example.com/image.webp"],
        }),
      })
    );
    const rebuildResponse = await rebuildCatalog(
      new Request("https://preview.example/api/ops/catalog-rebuild?action=attach", {
        method: "POST",
        headers,
        body: JSON.stringify({
          itemId: "preview-item",
          imageUrls: ["https://example.com/image.webp"],
        }),
      })
    );

    expect(createResponse.status).toBe(403);
    expect(rebuildResponse.status).toBe(403);
    expect(squareRequest).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
