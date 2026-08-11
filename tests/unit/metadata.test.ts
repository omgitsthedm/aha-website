import { describe, expect, it } from "vitest";
import { CollectionJsonLd } from "@/components/seo/CollectionJsonLd";
import { buildMetadata } from "@/components/seo/buildMetadata";
import type { Product } from "@/lib/utils/types";

describe("buildMetadata", () => {
  it("keeps canonical and Open Graph URLs on the same absolute production path", () => {
    const metadata = buildMetadata({
      title: "Contact",
      description: "Contact the store.",
      path: "/contact",
    });
    const openGraph = metadata.openGraph as unknown as { url?: string };

    expect(metadata.alternates?.canonical).toBe("/contact");
    expect(openGraph.url).toBe("https://afterhoursagenda.com/contact");
  });

  it("allows a browser title and share-card title to remain intentionally distinct", () => {
    const metadata = buildMetadata({
      title: "Independent NYC Streetwear",
      shareTitle: "After Hours Agenda | NYC Streetwear",
      description: "Independent NYC streetwear.",
      path: "/",
    });
    const openGraph = metadata.openGraph as unknown as { title?: string };

    expect(openGraph.title).toBe("After Hours Agenda | NYC Streetwear");
  });
});

describe("CollectionJsonLd", () => {
  it("declares the same number of entries that it serializes", () => {
    const products = Array.from({ length: 61 }, (_, index) => ({
      id: `product-${index + 1}`,
      slug: `product-${index + 1}`,
      name: `Product ${index + 1}`,
      images: [],
    })) as unknown as Product[];
    const element = CollectionJsonLd({ name: "Shop All", path: "/shop", products }) as unknown as {
      props: { dangerouslySetInnerHTML: { __html: string } };
    };
    const jsonLd = JSON.parse(element.props.dangerouslySetInnerHTML.__html) as {
      numberOfItems: number;
      itemListElement: unknown[];
    };

    expect(jsonLd.numberOfItems).toBe(60);
    expect(jsonLd.itemListElement).toHaveLength(60);
  });
});
