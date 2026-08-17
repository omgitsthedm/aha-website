import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  authorized: vi.fn(),
  parse: vi.fn(),
  upsert: vi.fn(),
  search: vi.fn(),
}));

vi.mock("@/lib/apliiq/product-callbacks", () => ({
  ApliiqProductCallbackUnavailableError: class ApliiqProductCallbackUnavailableError extends Error {},
  ApliiqProductCallbackValidationError: class ApliiqProductCallbackValidationError extends Error {},
  isApliiqProductCallbackConfigured: mocks.configured,
  isAuthorizedApliiqProductCallback: mocks.authorized,
  parseApliiqAddToStorePayload: mocks.parse,
  upsertApliiqProductDraft: mocks.upsert,
  searchApprovedApliiqProducts: mocks.search,
}));

import { POST } from "@/app/api/integrations/apliiq/products/upsert/route";
import { GET } from "@/app/api/integrations/apliiq/products/search/route";

describe("APLIIQ product callback routes", () => {
  beforeEach(() => {
    mocks.configured.mockReturnValue(true);
    mocks.authorized.mockReturnValue(true);
    mocks.parse.mockReturnValue({ variants: [] });
    mocks.upsert.mockResolvedValue("review:apliiq:abcd");
    mocks.search.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("rejects an unauthenticated upsert before parsing or persistence", async () => {
    mocks.authorized.mockReturnValue(false);
    const response = await POST(new Request("https://afterhoursagenda.test/api/integrations/apliiq/products/upsert", {
      method: "POST", body: JSON.stringify(documentedPayload),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ hasError: true, stepsCompleted: [] });
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("returns APLIIQ's documented response envelope after creating review-only drafts", async () => {
    const response = await POST(new Request("https://afterhoursagenda.test/api/integrations/apliiq/products/upsert", {
      method: "POST", body: JSON.stringify(documentedPayload),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      storeProductId: "review:apliiq:abcd", stepsCompleted: ["DraftCreated"], hasError: false, errorMessages: [],
    });
    expect(mocks.upsert).toHaveBeenCalledWith({ variants: [] });
  });

  it("rejects an oversized callback before parsing or persistence", async () => {
    const response = await POST(new Request("https://afterhoursagenda.test/api/integrations/apliiq/products/upsert", {
      method: "POST", body: JSON.stringify({ padding: "x".repeat(512 * 1024) }),
    }));
    expect(response.status).toBe(413);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("does not expose product search without callback authentication", async () => {
    mocks.authorized.mockReturnValue(false);
    const response = GET(new Request("https://afterhoursagenda.test/api/integrations/apliiq/products/search?search=shirt"));
    expect(response.status).toBe(401);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("passes APLIIQ's documented search text through to the approved-map-only helper", async () => {
    mocks.search.mockReturnValue([{ store_ProductId: "approved-tee", name: "Approved Tee", imageUrls: ["https://assets.example/tee.jpg"] }]);
    const response = GET(new Request("https://afterhoursagenda.test/api/integrations/apliiq/products/search?search=tee"));
    expect(response.status).toBe(200);
    expect(mocks.search).toHaveBeenCalledWith("tee");
    expect(await response.json()).toEqual([{ store_ProductId: "approved-tee", name: "Approved Tee", imageUrls: ["https://assets.example/tee.jpg"] }]);
  });
});

const documentedPayload = { name: "Midweight Fleece Joggers", imageUrls: ["https://blob.apliiq.com/product.jpg"], variants: [] };
