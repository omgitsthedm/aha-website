import { getAllProducts } from "@/lib/square/catalog";
import { getColorCountMap, getColorNamesMap, getPurchasableSizesMap } from "@/lib/data/purchasable-sizes";
import { CategoryShopContent } from "@/components/shop/CategoryShopContent";
import { CollectionJsonLd } from "@/components/seo/CollectionJsonLd";
import { PageHeader } from "@/components/ui/PageHeader";
import { filterProductsByCategory } from "@/lib/commerce/taxonomy";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { CatalogMigrationPage, catalogMigrationMetadata } from "@/components/shop/CatalogMigrationPage";
import { isStorefrontPublic } from "@/lib/commerce/catalog-policy";

export const revalidate = 300;

export const metadata = isStorefrontPublic() ? buildMetadata({
  title: "Totes, Hats, Socks & Stickers",
  description:
    "Counting Sheep totes, embroidered black sheep socks, hats, pins, and stickers — small pieces from After Hours Agenda, made to order.",
  path: "/accessories",
}) : catalogMigrationMetadata("/accessories");

export default async function AccessoriesPage() {
  if (!isStorefrontPublic()) return <CatalogMigrationPage />;
  const allProducts = await getAllProducts();
  const products = filterProductsByCategory(allProducts, "accessories");

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <CollectionJsonLd name="Accessories" path="/accessories" products={products} />
      <div className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Accessories"
          title="The finishing pieces"
          description="Counting Sheep totes, embroidered black sheep socks, hats, pins, and stickers — the small pieces that finish the fit. Every one made to order."
        />
        {/* Products are pre-filtered to accessories; no category pills — a self-link
            pill here 404s (/accessories/accessories has no catch-all route). */}
        <CategoryShopContent
          products={products} purchasableSizes={getPurchasableSizesMap(products)} colorCounts={getColorCountMap(products)} colorNames={getColorNamesMap(products)}
          categories={[]}
          basePath="/accessories"
        />
      </div>
    </div>
  );
}
