import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAllProducts: vi.fn(),
  buildChannelListings: vi.fn(),
  buildMetaProductFeed: vi.fn(),
  buildGoogleProductFeed: vi.fn(),
}));

vi.mock("@/lib/square/catalog", () => ({ getAllProducts: mocks.getAllProducts }));
vi.mock("@/lib/seo/product-feed", () => ({
  buildChannelListings: mocks.buildChannelListings,
  buildMetaProductFeed: mocks.buildMetaProductFeed,
  buildGoogleProductFeed: mocks.buildGoogleProductFeed,
}));

import { GET as getMetaFeed } from "@/app/feeds/meta/route";
import { GET as getGoogleFeed } from "@/app/feeds/google.xml/route";
import { GET as getLegacyFeed } from "@/app/product-feed.xml/route";

describe("product feed routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllProducts.mockResolvedValue([{ id: "square-item" }]);
    mocks.buildChannelListings.mockReturnValue([{ id: "AHA-1-M" }]);
    mocks.buildMetaProductFeed.mockReturnValue("id,item_group_id\nAHA-1-M,AHA-1");
    mocks.buildGoogleProductFeed.mockReturnValue("<?xml version=\"1.0\"?><rss />");
  });

  it("keeps Meta CSV IDs on /feeds/meta through the canonical listing model", async () => {
    const response = await getMetaFeed();

    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(await response.text()).toContain("AHA-1-M");
    expect(mocks.buildChannelListings).toHaveBeenCalledWith([{ id: "square-item" }], "https://afterhoursagenda.com");
    expect(mocks.buildMetaProductFeed).toHaveBeenCalledWith([{ id: "AHA-1-M" }]);
  });

  it("serves new Google XML and the legacy XML endpoint from the same model", async () => {
    const [google, legacy] = await Promise.all([getGoogleFeed(), getLegacyFeed()]);

    expect(google.headers.get("content-type")).toContain("application/rss+xml");
    expect(legacy.headers.get("content-type")).toContain("application/rss+xml");
    expect(legacy.headers.get("cache-control")).toBe(google.headers.get("cache-control"));
    expect(await google.text()).toContain("<rss");
    expect(await legacy.text()).toContain("<rss");
    expect(mocks.buildGoogleProductFeed).toHaveBeenCalledTimes(2);
    expect(mocks.buildGoogleProductFeed).toHaveBeenCalledWith([{ id: "AHA-1-M" }], "https://afterhoursagenda.com");
  });
});
