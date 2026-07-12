import { Entrance } from "@/components/homepage/Entrance";
import { LatestDrop } from "@/components/homepage/LatestDrop";
import { ThePromise } from "@/components/homepage/ThePromise";
import { MostWanted } from "@/components/homepage/MostWanted";
import { Collections } from "@/components/homepage/Collections";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { DesignFiles } from "@/components/homepage/DesignFiles";
import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300; // ISR: 5 minutes
export const metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  let products: Product[] = [];
  let collections: Collection[] = [];

  try {
    [products, collections] = await Promise.all([
      getAllProducts(),
      getAllCollections(),
    ]);
  } catch (error) {
    // Fallback: render with empty data, site still looks good
    console.error("Failed to fetch catalog:", error);
  }

  // Editorial catalog selection. No popularity ranking is implied.
  const catalogEdit = products.slice(0, 6);
  // Prefer products explicitly assigned to the New Arrivals collection.
  const newArrivalsId = "FAIJ7SE5DJP25N26ND3L76SU";
  const latestDrop = products
    .filter((p) => p.collectionIds.includes(newArrivalsId))
    .slice(0, 4);
  const featured = latestDrop.length > 0 ? latestDrop : products.slice(6, 11);

  return (
    <>
      <Entrance hasNewArrivals={latestDrop.length > 0} />
      <DesignFiles compact />
      <LatestDrop products={featured} isNewArrivalEdit={latestDrop.length > 0} />
      <ThePromise />
      <MostWanted products={catalogEdit} totalProducts={products.length} />
      <Collections collections={collections} />
      <GetOnTheList />
    </>
  );
}
