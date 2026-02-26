import { Entrance } from "@/components/homepage/Entrance";
import { LatestDrop } from "@/components/homepage/LatestDrop";
import { ThePromise } from "@/components/homepage/ThePromise";
import { MostWanted } from "@/components/homepage/MostWanted";
import { EditorialGallery } from "@/components/homepage/EditorialGallery";
import { Agenda } from "@/components/homepage/Agenda";
import { Collections } from "@/components/homepage/Collections";
import { GetOnTheList } from "@/components/homepage/GetOnTheList";
import { getAllProducts, getAllCollections } from "@/lib/square/catalog";
import type { Product, Collection } from "@/lib/utils/types";

export const revalidate = 300; // ISR: 5 minutes

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

  // Most wanted: first 6 products (we'll refine this later)
  const mostWanted = products.slice(0, 6);
  // Latest drop: products from "New Arrivals" collection, or last 4
  const newArrivalsId = "FAIJ7SE5DJP25N26ND3L76SU";
  const latestDrop = products
    .filter((p) => p.collectionIds.includes(newArrivalsId))
    .slice(0, 4);
  const featured = latestDrop.length > 0 ? latestDrop : products.slice(-4);

  return (
    <>
      <Entrance />
      <LatestDrop products={featured} />
      <div className="platform-edge" />
      <ThePromise />
      <div className="platform-edge" />
      <MostWanted products={mostWanted} />
      <EditorialGallery />
      <Agenda />
      <Collections collections={collections} />
      <div className="platform-edge" />
      <GetOnTheList />
      <div className="platform-edge" />
    </>
  );
}
